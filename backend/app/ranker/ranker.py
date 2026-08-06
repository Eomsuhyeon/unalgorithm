"""
[Ranker]
이 파일이 하는 일:
Curator가 걸러낸 영상들의 "최종 노출 순서"를 정하는 코드.

2단계로 동작한다:
1. Weighted Borda Count: 관련성(relevance) / 최신성(recency) / 인기도(popularity)를
   각각 순위 매긴 뒤 가중합쳐서 하나의 통합 점수로 만든다.
2. MMR (Maximal Marginal Relevance): 점수 순서대로 그냥 뽑으면 비슷한 영상만 몰릴 수 있어서,
   "이미 뽑은 영상들과 너무 비슷하면 순위를 뒤로 미루는" 방식으로 다양성을 확보한다.
"""

from datetime import datetime, timezone

from app.curator.curator import cosine_similarity
from app.curator.embedding import build_video_text, embed_texts

# Weighted Borda Count에서 각 기준의 가중치 (합이 1일 필요는 없음, 상대 비율만 중요)
RELEVANCE_WEIGHT = 0.6
RECENCY_WEIGHT = 0.2
POPULARITY_WEIGHT = 0.2


def _borda_ranks(values: list[float]) -> list[float]:
    """값이 클수록 높은 순위(점수)를 주는 Borda 점수 리스트를 만든다 (0~1로 정규화)."""
    n = len(values)
    if n <= 1:
        return [1.0] * n
    order = sorted(range(n), key=lambda i: values[i])  # 낮은 값 -> 높은 값 순
    ranks = [0.0] * n
    for position, idx in enumerate(order):
        ranks[idx] = position / (n - 1)  # 0(꼴등) ~ 1(1등)
    return ranks


def _recency_score(published_at: str) -> float:
    """최근에 올라온 영상일수록 1에 가까운 점수 (30일 지나면 0에 수렴)."""
    if not published_at:
        return 0.0
    try:
        published = datetime.fromisoformat(published_at.replace("Z", "+00:00"))
        days_ago = (datetime.now(timezone.utc) - published).days
        return max(0.0, 1 - days_ago / 30)
    except ValueError:
        return 0.0


def _weighted_borda_score(candidates: list[dict]) -> list[dict]:
    relevance_ranks = _borda_ranks([c.get("relevance_score", 0.0) for c in candidates])
    recency_ranks = _borda_ranks([_recency_score(c.get("published_at", "")) for c in candidates])
    popularity_ranks = _borda_ranks([c.get("view_count", 0) for c in candidates])

    result = []
    for candidate, rel, rec, pop in zip(candidates, relevance_ranks, recency_ranks, popularity_ranks):
        borda_score = (
            RELEVANCE_WEIGHT * rel + RECENCY_WEIGHT * rec + POPULARITY_WEIGHT * pop
        )
        result.append({**candidate, "borda_score": borda_score})
    return result


def _mmr_reorder(candidates: list[dict], diversity_level: float, top_k: int) -> list[dict]:
    """
    diversity_level(0~1)이 높을수록 다양성을 더 챙긴다.
    lambda_ = 1 - diversity_level : borda_score(관련성) 비중
    diversity_level              : 이미 뽑힌 영상들과의 비유사도 비중
    """
    if not candidates:
        return []

    lambda_ = 1 - diversity_level
    texts = [build_video_text(c["title"], c.get("description", ""), c.get("tags")) for c in candidates]
    embeddings = embed_texts(texts)

    remaining = list(range(len(candidates)))
    selected: list[int] = []

    while remaining and len(selected) < top_k:
        best_idx = None
        best_score = float("-inf")

        for idx in remaining:
            relevance_term = candidates[idx]["borda_score"]

            if selected:
                max_similarity = max(
                    cosine_similarity(embeddings[idx], embeddings[s]) for s in selected
                )
            else:
                max_similarity = 0.0

            mmr_score = lambda_ * relevance_term - (1 - lambda_) * max_similarity
            if mmr_score > best_score:
                best_score = mmr_score
                best_idx = idx

        selected.append(best_idx)
        remaining.remove(best_idx)

    return [candidates[i] for i in selected]


def rank(scored_candidates: list[dict], preference_profile: dict, top_k: int = 20) -> list[dict]:
    """
    scored_candidates: Curator를 거쳐 relevance_score가 붙은 영상 리스트
    preference_profile: {"diversity_level": float, ...}
    반환: 최종 노출 순서가 정해진 상위 top_k개 영상 리스트
    """
    diversity_level = preference_profile.get("diversity_level", 0.2)

    with_borda = _weighted_borda_score(scored_candidates)
    with_borda.sort(key=lambda c: c["borda_score"], reverse=True)

    return _mmr_reorder(with_borda, diversity_level, top_k)
