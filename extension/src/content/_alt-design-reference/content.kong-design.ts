/**

1) YouTube 홈/추천 피드 DOM을 관찰하여 새로 로드되는 영상 카드를 감지 (MutationObserver)
2) 각 카드에서 메타데이터(title, channel, videoId, thumbnail, isShorts 등) 추출
3) 추출한 메타데이터를 background(수현: llmClient / AI 파이프라인)로 전달해 relevance_score를 요청
4) 받은 점수와 사용자 필터 설정(storage.ts, 주영)을 기준으로 카드에 필터(숨김/흐림/배지) 적용
5) "다양성 다이얼(diversityDial)" 값에 따라, 필터에 걸리는 낮은 점수 영상 중 일부를
      확률적으로 그대로 노출시켜 새로운 카테고리 발견을 허용
 
[content.ts → background] 점수 요청
chrome.runtime.sendMessage({
type: "SCORE_VIDEOS",
payload: { videos: VideoCardData[] }
})
 → 응답: { type: "SCORE_VIDEOS_RESULT", payload: { scores: Record<videoId, number> } }

[background → content.ts] 설정/프로필 변경 브로드캐스트 (storage.ts, 주영이 chrome.storage.onChanged로 트리거)
chrome.runtime.onMessage.addListener(
{ type: "SETTINGS_UPDATED", payload: FilterSettings }
)
 
[content.ts → storage.ts] 사용자 행동 로그 저장 (좋아요/싫어요/클릭)
 chrome.runtime.sendMessage({
type: "LOG_FEEDBACK",
payload: { videoId, action: "like" | "dislike" | "click" | "hidden_shown" }
})
 storage.ts(주영)가 chrome.storage.local 에 아래 키로 데이터를 유지한다고 가정:
- "filterSettings": FilterSettings
- "preferenceProfile": PreferenceProfile (Planner가 생성한 JSON, 참고용)
 
 */



export interface VideoCardData {
  videoId: string;
  title: string;
  channelName: string;
  channelId: string | null;
  thumbnailUrl: string | null;
  viewCountText: string | null;
  publishedText: string | null;
  durationText: string | null;
  isShorts: boolean;
  isAd: boolean;
  sourceSection: "home_feed" | "shorts_shelf" | "sidebar" | "search" | "unknown";
  extractedAt: number;
}

export interface FilterSettings {
  enabledCategories: string[];
  diversityDial: number;/
  relevanceThreshold: number;
  filterMode: "hide" | "blur" | "badge_only";
  enabled: boolean;
}

const DEFAULT_SETTINGS: FilterSettings = {
  enabledCategories: [],
  diversityDial: 0.2,
  relevanceThreshold: 0.5,
  filterMode: "blur",
  enabled: true,
};

type ScoreMap = Record<string, number>;

// 1. 설정 (DOM 셀렉터) — YouTube 마크업 변경 시 이 부분만 수정


const SELECTORS = {
  homeFeedCard: "ytd-rich-item-renderer",
  shortsCard: "ytd-rich-shelf-renderer[is-shorts] ytd-rich-item-renderer, ytm-shorts-lockup-view-model",
  sidebarCard: "ytd-compact-video-renderer",
  searchCard: "ytd-video-renderer",
  adBadge: "ytd-badge-supported-renderer, .ytd-display-ad-renderer",
  feedContainers: [
    "ytd-two-column-browse-results-renderer #contents",
    "ytd-watch-next-secondary-results-renderer #contents",
    "ytd-search #contents",
    "ytd-rich-grid-renderer #contents",
  ],
} as const;

const FILTER_BADGE_CLASS = "yt-curator-filtered";
const FILTER_BLUR_CLASS = "yt-curator-blurred";
const CURATOR_PROCESSED_ATTR = "data-yt-curator-processed";
const CURATOR_BADGE_ELEMENT_CLASS = "yt-curator-badge";

function injectStyles(): void {
  if (document.getElementById("yt-curator-styles")) return;
  const style = document.createElement("style");
  style.id = "yt-curator-styles";
  style.textContent = `
    .${FILTER_BLUR_CLASS} {
      filter: blur(6px);
      opacity: 0.55;
      transition: filter 0.15s ease, opacity 0.15s ease;
    }
    .${FILTER_BLUR_CLASS}:hover {
      filter: blur(0);
      opacity: 1;
    }
    [${CURATOR_PROCESSED_ATTR}="hidden"] {
      display: none !important;
    }
    .${CURATOR_BADGE_ELEMENT_CLASS} {
      position: absolute;
      top: 6px;
      left: 6px;
      z-index: 999;
      background: rgba(0,0,0,0.75);
      color: #fff;
      font-size: 11px;
      padding: 2px 6px;
      border-radius: 4px;
      pointer-events: none;
      font-family: Roboto, Arial, sans-serif;
    }
    .${CURATOR_BADGE_ELEMENT_CLASS}.discover {
      background: rgba(26, 115, 232, 0.85);
    }
  `;
  document.head.appendChild(style);
}

function textOf(el: Element | null | undefined): string | null {
  const t = el?.textContent?.trim();
  return t && t.length > 0 ? t : null;
}

function extractVideoId(card: Element): string | null {
  const anchor = card.querySelector<HTMLAnchorElement>(
    'a#thumbnail, a.ytd-thumbnail, a[href*="watch?v="], a[href*="/shorts/"]'
  );
  const href = anchor?.getAttribute("href");
  if (!href) return null;

  const watchMatch = href.match(/[?&]v=([a-zA-Z0-9_-]{6,})/);
  if (watchMatch) return watchMatch[1];

  const shortsMatch = href.match(/\/shorts\/([a-zA-Z0-9_-]{6,})/);
  if (shortsMatch) return shortsMatch[1];

  return null;
}

function isAdCard(card: Element): boolean {
  if (card.querySelector(SELECTORS.adBadge)) return true;
  if (card.closest("ytd-display-ad-renderer, ytd-promoted-video-renderer")) return true;
  return false;
}

function detectSourceSection(card: Element): VideoCardData["sourceSection"] {
  if (card.closest("ytd-watch-next-secondary-results-renderer")) return "sidebar";
  if (card.closest("ytd-search")) return "search";
  if (card.closest('[is-shorts], [page-subtype="shorts"]') || card.tagName.toLowerCase().includes("shorts")) {
    return "shorts_shelf";
  }
  if (card.closest("ytd-rich-grid-renderer, ytd-two-column-browse-results-renderer")) return "home_feed";
  return "unknown";
}

function extractFromStandardCard(card: Element): VideoCardData | null {
  const videoId = extractVideoId(card);
  if (!videoId) return null;

  const titleEl = card.querySelector("#video-title, #video-title-link, h3 a, .ytd-video-meta-block #video-title");
  const channelEl = card.querySelector(
    "ytd-channel-name #text, ytd-channel-name a, #channel-name a, .ytd-video-meta-block #channel-name"
  );
  const channelAnchor = card.querySelector<HTMLAnchorElement>('ytd-channel-name a, a[href^="/@"], a[href^="/channel/"]');
  const metaSpans = card.querySelectorAll("#metadata-line span, .inline-metadata-item");
  const thumbImg = card.querySelector<HTMLImageElement>("img#img, img.yt-core-image, yt-image img");
  const durationEl = card.querySelector("ytd-thumbnail-overlay-time-status-renderer #text, .ytp-time-duration");

  const sourceSection = detectSourceSection(card);
  const isShorts = sourceSection === "shorts_shelf" || card.matches(SELECTORS.shortsCard);

  return {
    videoId,
    title: textOf(titleEl) ?? "",
    channelName: textOf(channelEl) ?? "",
    channelId: channelAnchor?.getAttribute("href") ?? null,
    thumbnailUrl: thumbImg?.getAttribute("src") ?? thumbImg?.getAttribute("data-src") ?? null,
    viewCountText: metaSpans[0] ? textOf(metaSpans[0]) : null,
    publishedText: metaSpans[1] ? textOf(metaSpans[1]) : null,
    durationText: textOf(durationEl),
    isShorts,
    isAd: isAdCard(card),
    sourceSection,
    extractedAt: Date.now(),
  };
}


function extractCardData(card: Element): VideoCardData | null {
  try {
    return extractFromStandardCard(card);
  } catch (err) {
    console.warn("[yt-curator] 메타데이터 추출 실패", err, card);
    return null;
  }
}

function isCardTag(el: Element): boolean {
  return (
    el.matches(SELECTORS.homeFeedCard) ||
    el.matches(SELECTORS.sidebarCard) ||
    el.matches(SELECTORS.searchCard) ||
    el.matches(SELECTORS.shortsCard)
  );
}

function findUnprocessedCards(root: ParentNode): Element[] {
  const combinedSelector = [
    SELECTORS.homeFeedCard,
    SELECTORS.sidebarCard,
    SELECTORS.searchCard,
    SELECTORS.shortsCard,
  ].join(", ");

  const found = Array.from(root.querySelectorAll(combinedSelector));
  return found.filter((el) => !el.hasAttribute(CURATOR_PROCESSED_ATTR));
}

function shouldExposeForDiversity(diversityDial: number): boolean {
  const clamped = Math.min(1, Math.max(0, diversityDial));
  return Math.random() < clamped;
}

function clearFilterState(card: Element): void {
  card.removeAttribute(CURATOR_PROCESSED_ATTR);
  card.classList.remove(FILTER_BLUR_CLASS);
  card.querySelector(`.${CURATOR_BADGE_ELEMENT_CLASS}`)?.remove();
}

function addBadge(card: Element, label: string, variant: "filtered" | "discover"): void {
  if (card.querySelector(`.${CURATOR_BADGE_ELEMENT_CLASS}`)) return;
  const badge = document.createElement("div");
  badge.className = `${CURATOR_BADGE_ELEMENT_CLASS}${variant === "discover" ? " discover" : ""}`;
  badge.textContent = label;

  const host = card.querySelector("ytd-thumbnail, #thumbnail") ?? card;
  if (host instanceof HTMLElement) {
    if (getComputedStyle(host).position === "static") {
      host.style.position = "relative";
    }
    host.appendChild(badge);
  }
}

function applyFilterToCard(card: Element, data: VideoCardData, score: number | undefined, settings: FilterSettings): void {
  if (data.isAd) {
    card.setAttribute(CURATOR_PROCESSED_ATTR, "skipped_ad");
    return;
  }

  if (!settings.enabled) {
    clearFilterState(card);
    card.setAttribute(CURATOR_PROCESSED_ATTR, "disabled");
    return;
  }

  if (score === undefined) {
    return;
  }

  const belowThreshold = score < settings.relevanceThreshold;

  if (!belowThreshold) {
    clearFilterState(card);
    card.setAttribute(CURATOR_PROCESSED_ATTR, "kept");
    return;
  }

  const exposeAnyway = shouldExposeForDiversity(settings.diversityDial);

  if (exposeAnyway) {
    clearFilterState(card);
    addBadge(card, "새로운 카테고리 탐색 중", "discover");
    card.setAttribute(CURATOR_PROCESSED_ATTR, "discovered");
    notifyFeedback(data.videoId, "hidden_shown");
    return;
  }

  if (settings.filterMode === "hide") {
    card.setAttribute(CURATOR_PROCESSED_ATTR, "hidden");
  } else if (settings.filterMode === "blur") {
    card.classList.add(FILTER_BLUR_CLASS);
    addBadge(card, "관심사와 낮은 관련성", "filtered");
    card.setAttribute(CURATOR_PROCESSED_ATTR, "blurred");
  } else {
    addBadge(card, "관심사와 낮은 관련성", "filtered");
    card.setAttribute(CURATOR_PROCESSED_ATTR, "badged");
  }
}

const pendingCards = new Map<string, { element: Element; data: VideoCardData }>();
let currentSettings: FilterSettings = DEFAULT_SETTINGS;
let scoreRequestScheduled = false;
const SCORE_REQUEST_BATCH_DELAY_MS = 400;
const SCORE_REQUEST_MAX_BATCH = 40;

function notifyFeedback(videoId: string, action: "like" | "dislike" | "click" | "hidden_shown"): void {
  try {
    chrome.runtime?.sendMessage?.({
      type: "LOG_FEEDBACK",
      payload: { videoId, action, timestamp: Date.now() },
    });
  } catch (err) {
    console.warn("[yt-curator] 피드백 전송 실패", err);
  }
}

function requestScoresForPending(): void {
  if (pendingCards.size === 0) return;

  const batch = Array.from(pendingCards.values()).slice(0, SCORE_REQUEST_MAX_BATCH);
  const videos = batch.map((b) => b.data);

  chrome.runtime?.sendMessage?.(
    { type: "SCORE_VIDEOS", payload: { videos } },
    (response: { type: string; payload: { scores: ScoreMap } } | undefined) => {
      if (chrome.runtime.lastError) {
        console.warn("[yt-curator] 점수 요청 실패:", chrome.runtime.lastError.message);
        return;
      }
      const scores = response?.payload?.scores ?? {};
      for (const { element, data } of batch) {
        applyFilterToCard(element, data, scores[data.videoId], currentSettings);
        pendingCards.delete(data.videoId);
      }
    }
  );
}

function scheduleScoreRequest(): void {
  if (scoreRequestScheduled) return;
  scoreRequestScheduled = true;
  setTimeout(() => {
    scoreRequestScheduled = false;
    requestScoresForPending();
  }, SCORE_REQUEST_BATCH_DELAY_MS);
}

function loadSettings(): Promise<FilterSettings> {
  return new Promise((resolve) => {
    try {
      chrome.storage?.local.get(["filterSettings"], (result) => {
        const stored = result?.filterSettings as Partial<FilterSettings> | undefined;
        resolve({ ...DEFAULT_SETTINGS, ...(stored ?? {}) });
      });
    } catch (err) {
      console.warn("[yt-curator] 설정 로드 실패, 기본값 사용", err);
      resolve(DEFAULT_SETTINGS);
    }
  });
}

function listenForSettingsUpdates(): void {
  chrome.runtime?.onMessage.addListener((message) => {
    if (message?.type === "SETTINGS_UPDATED" && message.payload) {
      currentSettings = { ...DEFAULT_SETTINGS, ...message.payload };
      reevaluateAllProcessedCards();
    }
  });

  chrome.storage?.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.filterSettings) {
      currentSettings = { ...DEFAULT_SETTINGS, ...(changes.filterSettings.newValue ?? {}) };
      reevaluateAllProcessedCards();
    }
  });
}

function reevaluateAllProcessedCards(): void {
  const combinedSelector = [
    SELECTORS.homeFeedCard,
    SELECTORS.sidebarCard,
    SELECTORS.searchCard,
    SELECTORS.shortsCard,
  ].join(", ");
  document.querySelectorAll(combinedSelector).forEach((card) => {
    card.removeAttribute(CURATOR_PROCESSED_ATTR);
  });
  scanAndCollect(document.body);
}


function scanAndCollect(root: ParentNode): void {
  const cards = findUnprocessedCards(root);
  if (cards.length === 0) return;

  for (const card of cards) {
    const data = extractCardData(card);
    if (!data) {
      card.setAttribute(CURATOR_PROCESSED_ATTR, "extract_failed");
      continue;
    }
    pendingCards.set(data.videoId, { element: card, data });
  }

  if (pendingCards.size > 0) {
    scheduleScoreRequest();
  }
}


let observer: MutationObserver | null = null;

function startObserving(): void {
  if (observer) observer.disconnect();

  observer = new MutationObserver((mutations) => {
    let needsScan = false;
    for (const mutation of mutations) {
      if (mutation.addedNodes.length > 0) {
        needsScan = true;
        break;
      }
    }
    if (needsScan) {
      scanAndCollect(document.body);
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  scanAndCollect(document.body);
}

function listenForSpaNavigation(): void {
  document.addEventListener("yt-navigate-finish", () => {
    pendingCards.clear();
    scanAndCollect(document.body);
  });
}


function listenForCardClicks(): void {
  document.body.addEventListener(
    "click",
    (e) => {
      const target = e.target as Element | null;
      const card = target?.closest?.(
        `${SELECTORS.homeFeedCard}, ${SELECTORS.sidebarCard}, ${SELECTORS.searchCard}, ${SELECTORS.shortsCard}`
      );
      if (!card) return;
      const videoId = extractVideoId(card);
      if (videoId) {
        notifyFeedback(videoId, "click");
      }
    },
    { capture: true }
  );
}


async function init(): Promise<void> {
  injectStyles();
  currentSettings = await loadSettings();
  listenForSettingsUpdates();
  listenForSpaNavigation();
  listenForCardClicks();
  startObserving();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

export {
  extractCardData,
  extractVideoId,
  applyFilterToCard,
  shouldExposeForDiversity,
  DEFAULT_SETTINGS,
};
