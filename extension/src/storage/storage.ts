/**
 * storage.ts — 담당: 주영
 *
 * TODO:
 * - chrome.storage(local/sync)에 Preference Profile, 행동 로그, 추천 이력 저장/조회
 */

export async function getPreferenceProfile() {
  // TODO: 주영
}

export async function savePreferenceProfile(profile: unknown) {
  // TODO: 주영
}

export async function logUserEvent(event: {
  type: "like" | "dislike" | "skip" | "click";
  videoId: string;
}) {
  // TODO: 주영
}
