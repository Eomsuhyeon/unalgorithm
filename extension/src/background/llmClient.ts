/**
 * llmClient — 담당: 수현
 *
 * TODO:
 * - 자연어 입력을 백엔드 Planner API로 전달
 * - 응답(Preference Profile JSON) 검증
 * - Prompt Injection 방어 (입력 sanitize, 응답 스키마 검증)
 */

export interface PreferenceProfile {
  allow_category: string[];
  block_category: string[];
  preferred_language: string[];
  diversity_level: number;
  novelty_level: number;
  popularity_weight: number;
  strictness: number;
}

export async function requestPreferenceProfile(
  naturalLanguageInput: string
): Promise<PreferenceProfile> {
  // TODO: 수현 - 백엔드 /planner API 호출
  throw new Error("not implemented");
}
