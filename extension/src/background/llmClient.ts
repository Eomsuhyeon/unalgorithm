/**
 * [llmClient]
 * 이 파일이 하는 일:
 * 사용자가 팝업에 입력한 자연어를 백엔드 /api/planner API로 보내고,
 * 응답으로 받은 Preference Profile(JSON)을 검증해서 돌려주는 코드.
 * 추천 리스트 조회(/api/recommend), 서버에 저장된 최신 프로필 조회(GET /api/planner/{id})도 담당한다.
 *
 * 여기서 하는 방어:
 * 1. 입력값 sanitize: 너무 길거나 빈 입력은 사전에 차단 (Prompt Injection 표면적 축소)
 * 2. 응답 검증: 백엔드가 이상한 값을 주면(필드 누락, 타입 불일치) 그대로 믿지 않고 에러 처리
 *
 * 실제 프롬프트 작성/LLM 호출은 backend/app/planner/planner.py에서 담당한다.
 * (여기서는 절대 LLM API 키를 직접 다루지 않는다 — 확장 프로그램 코드는 사용자에게 노출되므로
 *  키가 담기면 안 되고, 항상 백엔드를 거쳐야 한다.)
 *
 * [팀 조율 반영 - 2026-08-06]
 * - API 경로는 /api 프리픽스로 통일 (백엔드 main.py에서 router에 prefix="/api" 적용됨)
 * - "서버 DB가 정본, chrome.storage는 캐시" 원칙에 따라 fetchPreferenceProfileFromServer 추가
 * - 사용자 구분은 로그인 없이 storage.ts의 getOrCreateUserId()로 만든 로컬 UUID를 사용
 */

import { PreferenceProfile } from "../types";

// TODO: 배포 시 환경별 백엔드 URL로 교체 (개발 중엔 로컬 FastAPI 서버 기준)
const BACKEND_BASE_URL = "http://localhost:8000";
const API_BASE = `${BACKEND_BASE_URL}/api`;

const MAX_INPUT_LENGTH = 500;

export class PlannerApiError extends Error {}

/** 입력값을 정리한다: 길이 제한, 앞뒤 공백 제거. */
function sanitizeInput(rawInput: string): string {
  return rawInput.trim().slice(0, MAX_INPUT_LENGTH);
}

/** 백엔드가 돌려준 JSON이 PreferenceProfile 스키마를 만족하는지 최소한으로 검증한다. */
function isValidPreferenceProfile(data: unknown): data is PreferenceProfile {
  if (typeof data !== "object" || data === null) return false;
  const p = data as Record<string, unknown>;
  return (
    Array.isArray(p.allow_category) &&
    Array.isArray(p.block_category) &&
    Array.isArray(p.preferred_language) &&
    typeof p.diversity_level === "number" &&
    typeof p.novelty_level === "number" &&
    typeof p.popularity_weight === "number" &&
    typeof p.strictness === "number" &&
    typeof p.profile_text === "string"
  );
}

/**
 * 자연어 입력을 Preference Profile로 변환해서 서버 DB에 저장하고 반환한다.
 * (응답을 storage.ts의 savePreferenceProfile()로 캐시에 반영하는 건 service_worker.ts가 담당)
 */
export async function requestPreferenceProfile(
  userId: string,
  naturalLanguageInput: string
): Promise<PreferenceProfile> {
  const input = sanitizeInput(naturalLanguageInput);
  if (input.length === 0) {
    throw new PlannerApiError("입력이 비어 있습니다.");
  }

  const response = await fetch(`${API_BASE}/planner`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId, text: input }),
  });

  if (!response.ok) {
    throw new PlannerApiError(`Planner API 오류: ${response.status}`);
  }

  const data = await response.json();
  if (!isValidPreferenceProfile(data)) {
    throw new PlannerApiError("Planner API 응답 형식이 올바르지 않습니다.");
  }

  return data;
}

/**
 * 서버 DB에 저장된 최신 Preference Profile을 조회한다.
 * "서버가 정본" 원칙에 따라 프로필이 필요할 때 항상 먼저 이걸 시도해야 한다.
 * 아직 서버에 프로필이 없으면(첫 사용자) null을 반환한다 (에러 아님).
 */
export async function fetchPreferenceProfileFromServer(
  userId: string
): Promise<PreferenceProfile | null> {
  const response = await fetch(`${API_BASE}/planner/${userId}`);

  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new PlannerApiError(`프로필 조회 실패: ${response.status}`);
  }

  const data = await response.json();
  if (!isValidPreferenceProfile(data)) {
    throw new PlannerApiError("Planner API 응답 형식이 올바르지 않습니다.");
  }

  return data;
}

/** 최종 추천 리스트를 백엔드에서 가져온다. */
export async function requestRecommendations(userId: string): Promise<unknown[]> {
  const response = await fetch(`${API_BASE}/recommend`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId }),
  });

  if (!response.ok) {
    throw new PlannerApiError(`Recommend API 호출 실패: ${response.status}`);
  }

  const data = await response.json();
  return Array.isArray(data.recommendations) ? data.recommendations : [];
}

/** 사용자 피드백(좋아요/싫어요/스킵/클릭)을 서버 DB에도 기록한다. */
export async function sendFeedback(
  userId: string,
  videoId: string,
  feedbackType: "like" | "dislike" | "skip" | "click"
): Promise<void> {
  const response = await fetch(`${API_BASE}/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId, video_id: videoId, feedback_type: feedbackType }),
  });

  if (!response.ok) {
    throw new PlannerApiError(`Feedback API 호출 실패: ${response.status}`);
  }
}
