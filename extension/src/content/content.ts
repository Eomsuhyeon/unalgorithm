/**
 * Content Script — 담당: 지영
 *
 * TODO:
 * - MutationObserver로 YouTube 추천 피드(Home/Related/Shorts) DOM 변경 감지
 * - 영상 카드에서 메타데이터 추출 (title, channel, description, tags, shorts 여부 등)
 * - 다양성 다이얼 값에 따라 필터링/신규 카테고리 노출 적용
 */

export interface VideoMetadata {
  videoId: string;
  title: string;
  channel: string;
  description: string;
  isShorts: boolean;
}

function collectVisibleVideos(): VideoMetadata[] {
  // TODO: 지영 - 실제 DOM 파싱 로직 구현
  return [];
}

function observeFeed() {
  // TODO: 지영 - MutationObserver 등록
}

observeFeed();
