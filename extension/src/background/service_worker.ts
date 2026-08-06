/**
 * Service Worker (Manifest V3 background) — 담당: 수현 / 수연
 *
 * content script ↔ popup ↔ 백엔드 API 사이의 메시지 라우팅과
 * 추천 결과/영상 목록 캐싱을 담당한다.
 */

import { fetchPreferenceProfileFromServer, requestPreferenceProfile } from "./llmClient";
import {
  applyFeedbackToKeywords,
  computeReportStats,
} from "../storage/scoring";
import {
  getOrCreateUserId,
  getPreferenceProfile,
  logUserEvent,
  savePreferenceProfile,
} from "../storage/storage";
import { RuntimeMessage, VideoMetadata } from "../types";

/** content script가 마지막으로 수집한 영상 목록 캐시 (탭별 저장이 필요하면 sender.tab.id로 확장) */
let latestCollectedVideos: VideoMetadata[] = [];

chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
  switch (message.type) {
    case "VIDEOS_COLLECTED": {
      latestCollectedVideos = message.payload;
      // TODO: 수현 - Curator/Ranker 백엔드 호출로 재정렬된 추천 목록 반환
      sendResponse({ ok: true, count: latestCollectedVideos.length });
      return false;
    }

    case "REQUEST_PREFERENCE_PROFILE": {
      // [팀 조율 반영] 서버 DB가 정본이므로, 로컬 user_id로 서버에 새 프로필을 만들고
      // 응답을 chrome.storage 캐시에도 반영한다.
      getOrCreateUserId()
        .then((userId) => requestPreferenceProfile(userId, message.payload.text))
        .then(async (profile) => {
          await savePreferenceProfile(profile);
          sendResponse({ type: "PREFERENCE_PROFILE_UPDATED", payload: profile });
        })
        .catch((error: Error) => {
          sendResponse({ ok: false, error: error.message });
        });
      return true; // 비동기 응답을 위해 채널을 열어둔다
    }

    case "GET_PREFERENCE_PROFILE": {
      // [팀 조율 반영] "서버가 정본, chrome.storage는 캐시" 원칙:
      // 1. 서버에 최신 프로필을 물어본다
      // 2. 성공하면 캐시를 갱신하고 그 값을 돌려준다
      // 3. 서버가 없거나(첫 사용자) 오프라인이면 로컬 캐시로 대체한다 (화면이 멈추지 않도록)
      getOrCreateUserId()
        .then((userId) => fetchPreferenceProfileFromServer(userId))
        .then(async (serverProfile) => {
          if (serverProfile) {
            await savePreferenceProfile(serverProfile);
            sendResponse(serverProfile);
          } else {
            const cached = await getPreferenceProfile();
            sendResponse(cached);
          }
        })
        .catch(async () => {
          // 서버 연결 실패(오프라인 등) -> 캐시라도 보여준다
          const cached = await getPreferenceProfile();
          sendResponse(cached);
        });
      return true;
    }

    case "LOG_USER_EVENT": {
      const event = message.payload;
      const video = latestCollectedVideos.find((v) => v.videoId === event.videoId);
      const keywords = video ? extractKeywords(video) : [];
      Promise.all([logUserEvent(event), applyFeedbackToKeywords(keywords, event.type)]).then(
        () => sendResponse({ ok: true })
      );
      return true;
    }

    case "GET_REPORT_STATS": {
      computeReportStats().then((stats) =>
        sendResponse({ type: "REPORT_STATS", payload: stats })
      );
      return true;
    }

    default:
      return false;
  }
});

/** 영상 제목/채널명에서 아주 단순한 키워드 후보를 뽑는다. (KeyBERT 등 정교한 추출은 백엔드 담당) */
function extractKeywords(video: VideoMetadata): string[] {
  const words = `${video.title} ${video.channel}`
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 2);
  return Array.from(new Set(words)).slice(0, 10);
}
