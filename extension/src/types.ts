/**
 * types.ts — 확장 프로그램 전역에서 공유하는 타입 정의
 *
 * content ↔ background ↔ popup 사이의 메시지는 전부 이 파일의
 * 타입을 기준으로 주고받는다. 새 메시지 타입을 추가할 때는
 * RuntimeMessage 유니온에 추가하면 된다.
 */

export interface VideoMetadata {
  videoId: string;
  title: string;
  channel: string;
  description: string;
  isShorts: boolean;
}

export interface PreferenceProfile {
  allow_category: string[];
  block_category: string[];
  preferred_language: string[];
  diversity_level: number; // 0 ~ 1
  novelty_level: number; // 0 ~ 1
  popularity_weight: number; // 0 ~ 1
  strictness: number; // 0 ~ 1
}

export const DEFAULT_PREFERENCE_PROFILE: PreferenceProfile = {
  allow_category: [],
  block_category: [],
  preferred_language: ["ko"],
  diversity_level: 0.5,
  novelty_level: 0.5,
  popularity_weight: 0.5,
  strictness: 0.5,
};

export type FeedbackType = "like" | "dislike" | "skip" | "click";

export interface UserEvent {
  type: FeedbackType;
  videoId: string;
  timestamp: number;
}

export interface ReportStats {
  totalEvents: number;
  byType: Record<FeedbackType, number>;
  topKeywords: { keyword: string; score: number }[];
}

/** content → background */
export interface VideosCollectedMessage {
  type: "VIDEOS_COLLECTED";
  payload: VideoMetadata[];
}

/** popup → background */
export interface RequestPreferenceProfileMessage {
  type: "REQUEST_PREFERENCE_PROFILE";
  payload: { text: string };
}

/** background → popup (response) */
export interface PreferenceProfileUpdatedMessage {
  type: "PREFERENCE_PROFILE_UPDATED";
  payload: PreferenceProfile;
}

/** popup/content → background */
export interface LogUserEventMessage {
  type: "LOG_USER_EVENT";
  payload: UserEvent;
}

/** popup → background */
export interface GetReportStatsMessage {
  type: "GET_REPORT_STATS";
}

/** background → popup (response) */
export interface ReportStatsMessage {
  type: "REPORT_STATS";
  payload: ReportStats;
}

/** popup → background, background → content */
export interface GetPreferenceProfileMessage {
  type: "GET_PREFERENCE_PROFILE";
}

export type RuntimeMessage =
  | VideosCollectedMessage
  | RequestPreferenceProfileMessage
  | PreferenceProfileUpdatedMessage
  | LogUserEventMessage
  | GetReportStatsMessage
  | ReportStatsMessage
  | GetPreferenceProfileMessage;
