/**
 * llmClient — 담당: 수현
 *
 * 자연어 입력을 백엔드 Planner API(FastAPI, backend/app/planner)로 전달하고
 * Preference Profile JSON을 받아온다.
 *
 * - 입력값은 서버로 그대로 전달하되 길이를 제한해 과도한 payload를 막는다.
 * - 응답은 스키마 검증 후 사용한다 (Prompt Injection으로 조작된 필드 방어).
 */

import { PreferenceProfile } from "../types";

// TODO: 배포 시 환경별 백엔드 URL로 교체 (개발 중엔 로컬 FastAPI 서버 기준)
const BACKEND_BASE_URL = "http://localhost:8000";
const PLANNER_ENDPOINT = `${BACKEND_BASE_URL}/api/planner`;

const MAX_INPUT_LENGTH = 500;

class PlannerApiError extends Error {}

function sanitizeInput(raw: string): string {
  return raw.trim().slice(0, MAX_INPUT_LENGTH);
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
    typeof p.strictness === "number"
  );
}

export async function requestPreferenceProfile(
  naturalLanguageInput: string
): Promise<PreferenceProfile> {
  const input = sanitizeInput(naturalLanguageInput);
  if (input.length === 0) {
    throw new PlannerApiError("입력이 비어 있습니다.");
  }

  const response = await fetch(PLANNER_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: input }),
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
