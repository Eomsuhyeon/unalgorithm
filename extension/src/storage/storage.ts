/**
 * storage.ts — 담당: 주영
 *
 * chrome.storage.local 기반으로 Preference Profile, 행동 로그(UserEvent[]),
 * 키워드 점수를 저장/조회한다.
 *
 * - Preference Profile: 단일 값 (STORAGE_KEYS.PROFILE)
 * - 행동 로그: 배열, 최근 EVENT_LOG_LIMIT개까지만 보관 (용량 제한 회피)
 * - 키워드 점수: { [keyword: string]: number } 형태의 맵
 */

import {
  DEFAULT_PREFERENCE_PROFILE,
  PreferenceProfile,
  UserEvent,
} from "../types";

const STORAGE_KEYS = {
  PROFILE: "preferenceProfile",
  EVENT_LOG: "userEventLog",
  KEYWORD_SCORES: "keywordScores",
} as const;

const EVENT_LOG_LIMIT = 500;

export async function getPreferenceProfile(): Promise<PreferenceProfile> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.PROFILE);
  return (result[STORAGE_KEYS.PROFILE] as PreferenceProfile) ?? DEFAULT_PREFERENCE_PROFILE;
}

export async function savePreferenceProfile(profile: PreferenceProfile): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.PROFILE]: profile });
}

export async function getEventLog(): Promise<UserEvent[]> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.EVENT_LOG);
  return (result[STORAGE_KEYS.EVENT_LOG] as UserEvent[]) ?? [];
}

export async function logUserEvent(event: Omit<UserEvent, "timestamp">): Promise<void> {
  const log = await getEventLog();
  const nextLog = [...log, { ...event, timestamp: Date.now() }].slice(-EVENT_LOG_LIMIT);
  await chrome.storage.local.set({ [STORAGE_KEYS.EVENT_LOG]: nextLog });
}

export async function getKeywordScores(): Promise<Record<string, number>> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.KEYWORD_SCORES);
  return (result[STORAGE_KEYS.KEYWORD_SCORES] as Record<string, number>) ?? {};
}

export async function saveKeywordScores(scores: Record<string, number>): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.KEYWORD_SCORES]: scores });
}

export async function clearAllData(): Promise<void> {
  await chrome.storage.local.remove([
    STORAGE_KEYS.PROFILE,
    STORAGE_KEYS.EVENT_LOG,
    STORAGE_KEYS.KEYWORD_SCORES,
  ]);
}
