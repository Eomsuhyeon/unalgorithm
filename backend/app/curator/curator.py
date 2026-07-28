"""
Curator — 담당: 수현

TODO:
- 1단계(상시): all-MiniLM-L6-v2 임베딩 + Cosine Similarity로 relevance_score 계산
- 2단계(가끔): score가 임계 구간(strictness 기반)이면 LLM 재채점
"""


def score_candidates(candidates: list[dict], preference_profile: dict) -> list[dict]:
    # TODO: 수현 - 임베딩 유사도 계산 + 경계 구간 LLM 재채점
    raise NotImplementedError
