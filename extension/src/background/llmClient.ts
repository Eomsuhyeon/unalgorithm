/**
 * [llmClient]
 * 이 파일이 하는 일:
 * 사용자가 팝업에 입력한 자연어를 백엔드 /planner API로 보내고,
 * 응답으로 받은 Preference Profile(JSON)을 검증해서 돌려주는 코드.
 *
 * 여기서 하는 방어:
 * 1. 입력값 sanitize: 너무 길거나 이상한 입력은 사전에 차단 (Prompt Injection 표면적 축소)
 * 2. 응답 검증: 백엔드가 이상한 값을 주면(필드 누락, 타입 불일치) 그대로 믿지 않고 에러 처리
 *
 * 실제 프롬프트 작성/LLM 호출은 backend/app/planner/planner.py에서 담당한다.
 * (여기서는 절대 LLM API 키를 직접 다루지 않는다 — 확장 프로그램 코드는 사용자에게 노출되므로
 *  키가 담기면 안 되고, 항상 백엔드를 거쳐야 한다.)
 */

const BACKEND_BASE_URL = "http://localhost:8000";
const MAX_INPUT_LENGTH = 500;

export interface PreferenceProfile {
  allow_category: string[];
  block_category: string[];
  preferred_language: string[];
  diversity_level: number;
  novelty_level: number;
  popularity_weight: number;
  strictness: number;
  profile_text: string;
}

/** 입력값을 정리한다: 길이 제한, 앞뒤 공백 제거. */
function sanitizeInput(rawInput: string): string {
  const trimmed = rawInput.trim();
  if (trimmed.length === 0) {
    throw new Error("입력이 비어 있습니다");
  }
  if (trimmed.length > MAX_INPUT_LENGTH) {
    return trimmed.slice(0, MAX_INPUT_LENGTH);
  }
  return trimmed;
}

/** 백엔드 응답이 PreferenceProfile 스키마와 맞는지 최소한으로 검증한다. */
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
 * 자연어 입력을 Preference Profile로 변환해서 반환한다.
 * 실패하면 에러를 던지므로, 호출하는 쪽(popup)에서 try/catch로 사용자에게 안내해야 한다.
 */
export async function requestPreferenceProfile(
  userId: string,
  naturalLanguageInput: string
): Promise<PreferenceProfile> {
  const safeInput = sanitizeInput(naturalLanguageInput);

  const response = await fetch(`${BACKEND_BASE_URL}/planner`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId, text: safeInput }),
  });

  if (!response.ok) {
    throw new Error(`Planner API 호출 실패: ${response.status}`);
  }

  const data = await response.json();

  if (!isValidPreferenceProfile(data)) {
    throw new Error("Planner API 응답 형식이 올바르지 않습니다");
  }

  return data;
}

/** 최종 추천 리스트를 백엔드에서 가져온다. */
export async function requestRecommendations(userId: string): Promise<unknown[]> {
  const response = await fetch(`${BACKEND_BASE_URL}/recommend`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId }),
  });

  if (!response.ok) {
    throw new Error(`Recommend API 호출 실패: ${response.status}`);
  }

  const data = await response.json();
  return Array.isArray(data.recommendations) ? data.recommendations : [];
}
