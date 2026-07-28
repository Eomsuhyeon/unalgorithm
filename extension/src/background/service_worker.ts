/**
 * Service Worker (Manifest V3 background) — 담당: 수현 / 수연
 *
 * TODO:
 * - content script ↔ popup ↔ 백엔드 API 사이의 메시지 라우팅
 * - 추천 결과 캐싱
 */

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  // TODO: 메시지 타입별 분기 처리
  return true;
});
