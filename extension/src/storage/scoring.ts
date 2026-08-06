/**
 * scoring.ts — 담당: 주영
 *
 * 사용자 피드백(좋아요/싫어요/스킵)을 바탕으로 키워드/카테고리 점수를 갱신하고,
 * Report 화면에서 쓸 통계를 계산한다.
 */

import { FeedbackType, ReportStats, UserEvent } from "../types";
import { getEventLog, getKeywordScores, saveKeywordScores } from "./storage";

/** 피드백 종류별 가중치. like는 가점, dislike는 감점, skip은 약한 감점. */
const FEEDBACK_WEIGHT: Record<FeedbackType, number> = {
  like: 0.15,
  dislike: -0.2,
  skip: -0.05,
  click: 0.05,
};

const SCORE_MIN = -1;
const SCORE_MAX = 1;

export function updateKeywordScore(currentScore: number, feedback: FeedbackType): number {
  const next = currentScore + FEEDBACK_WEIGHT[feedback];
  return Math.min(SCORE_MAX, Math.max(SCORE_MIN, next));
}

/** 특정 영상에 연결된 키워드들의 점수를 한 번에 갱신하고 저장한다. */
export async function applyFeedbackToKeywords(
  keywords: string[],
  feedback: FeedbackType
): Promise<Record<string, number>> {
  const scores = await getKeywordScores();
  for (const keyword of keywords) {
    const current = scores[keyword] ?? 0;
    scores[keyword] = updateKeywordScore(current, feedback);
  }
  await saveKeywordScores(scores);
  return scores;
}

/** Report 화면에 필요한 통계를 이벤트 로그 + 키워드 점수로부터 계산한다. */
export async function computeReportStats(): Promise<ReportStats> {
  const [log, scores] = await Promise.all([getEventLog(), getKeywordScores()]);

  const byType: Record<FeedbackType, number> = {
    like: 0,
    dislike: 0,
    skip: 0,
    click: 0,
  };
  for (const event of log as UserEvent[]) {
    byType[event.type] += 1;
  }

  const topKeywords = Object.entries(scores)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([keyword, score]) => ({ keyword, score }));

  return {
    totalEvents: log.length,
    byType,
    topKeywords,
  };
}
