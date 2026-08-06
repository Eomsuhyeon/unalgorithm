/**
 * Content Script — 담당: 지영
 *
 * MutationObserver로 YouTube 추천 피드(Home/Related/Shorts) DOM 변경을 감지하고,
 * 영상 카드에서 메타데이터를 추출해 background로 전달한다.
 */

import { RuntimeMessage, VideoMetadata } from "../types";

const VIDEO_CARD_SELECTOR = [
  "ytd-rich-item-renderer", // 홈 피드
  "ytd-video-renderer", // 검색/일반 목록
  "ytd-compact-video-renderer", // 관련 영상(사이드바)
  "ytd-reel-item-renderer", // Shorts
].join(", ");

const COLLECT_DEBOUNCE_MS = 400;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function extractVideoId(anchor: HTMLAnchorElement | null): string | null {
  if (!anchor) return null;
  const href = anchor.getAttribute("href") ?? "";
  const watchMatch = href.match(/[?&]v=([^&]+)/);
  if (watchMatch) return watchMatch[1];
  const shortsMatch = href.match(/\/shorts\/([^/?&]+)/);
  if (shortsMatch) return shortsMatch[1];
  return null;
}

function parseCard(card: Element): VideoMetadata | null {
  const titleEl = card.querySelector<HTMLElement>(
    "#video-title, .ytd-video-meta-block #video-title"
  );
  const channelEl = card.querySelector<HTMLElement>(
    "ytd-channel-name #text, .ytd-channel-name a"
  );
  const anchor = card.querySelector<HTMLAnchorElement>("a#thumbnail, a#video-title-link");

  const videoId = extractVideoId(anchor);
  const title = titleEl?.textContent?.trim() ?? "";

  if (!videoId || !title) return null;

  return {
    videoId,
    title,
    channel: channelEl?.textContent?.trim() ?? "",
    // YouTube DOM에는 피드 화면에서 설명 전문이 노출되지 않는 경우가 많다.
    // 상세 설명이 필요하면 백엔드 Sourcer가 YouTube Data API로 보강한다.
    description: card.querySelector<HTMLElement>("#description-text")?.textContent?.trim() ?? "",
    isShorts: card.tagName.toLowerCase() === "ytd-reel-item-renderer" || /\/shorts\//.test(anchor?.getAttribute("href") ?? ""),
  };
}

function collectVisibleVideos(): VideoMetadata[] {
  const cards = Array.from(document.querySelectorAll(VIDEO_CARD_SELECTOR));
  const videos: VideoMetadata[] = [];
  const seen = new Set<string>();

  for (const card of cards) {
    const video = parseCard(card);
    if (video && !seen.has(video.videoId)) {
      seen.add(video.videoId);
      videos.push(video);
    }
  }
  return videos;
}

function sendVideos(videos: VideoMetadata[]) {
  if (videos.length === 0) return;
  const message: RuntimeMessage = { type: "VIDEOS_COLLECTED", payload: videos };
  chrome.runtime.sendMessage(message).catch(() => {
    // 팝업이 닫혀있거나 background가 아직 준비되지 않은 경우는 무시한다.
  });
}

function scheduleCollect() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    sendVideos(collectVisibleVideos());
  }, COLLECT_DEBOUNCE_MS);
}

function observeFeed() {
  const target = document.querySelector("ytd-app") ?? document.body;
  const observer = new MutationObserver(() => scheduleCollect());
  observer.observe(target, { childList: true, subtree: true });

  // 최초 로드 시점에도 한 번 수집한다.
  scheduleCollect();
}

observeFeed();
