"""
[Curator]
이 파일이 하는 일:
Sourcer가 가져온 후보 영상들이 사용자 취향과 얼마나 관련 있는지 점수를 매기고,
관련 없는 영상은 걸러내는 코드.

2단계로 동작한다 (비용 최소화 목적):
1단계 (전부 다) : 임베딩(MiniLM) + 코사인 유사도로 relevance_score 계산 (무료, 빠름)
2단계 (애매한 것만): 점수가 경계 구간(strictness 근처)인 영상만 LLM한테 다시 물어봄 (느리지만 정확)
"""

import json
import math
import os

import httpx

from app.curator.embedding import build_video_text, embed_text, embed_texts

LLM_API_URL = os.getenv("LLM_API_URL", "https://api.openai.com/v1/chat/completions")
LLM_API_KEY = os.getenv("LLM_API_KEY", "")
LLM_MODEL = os.getenv("LLM_MODEL", "gpt-4o-mini")

# 이 범위 안에 들어오는 relevance_score만 LLM 재채점 대상 (경계 구간 폭 ±BORDERLINE_MARGIN)
BORDERLINE_MARGIN = 0.1


def cosine_similarity(vec_a: list[float], vec_b: list[float]) -> float:
    """두 벡터 사이의 코사인 유사도를 0~1 사이 값으로 반환한다."""
    if len(vec_a) != len(vec_b):
        raise ValueError("벡터 차원이 일치하지 않습니다")

    dot = sum(a * b for a, b in zip(vec_a, vec_b))
    norm_a = math.sqrt(sum(a * a for a in vec_a))
    norm_b = math.sqrt(sum(b * b for b in vec_b))

    if norm_a == 0 or norm_b == 0:
        return 0.0

    similarity = dot / (norm_a * norm_b)
    return (similarity + 1) / 2


def _is_borderline(score: float, strictness: float) -> bool:
    return abs(score - strictness) <= BORDERLINE_MARGIN


def _llm_rescore(video_title: str, video_description: str, profile_text: str) -> float | None:
    """애매한 영상 하나를 LLM에게 다시 채점시킨다. 실패하면 None (기존 임베딩 점수 유지)."""
    if not LLM_API_KEY:
        return None

    prompt = (
        f"사용자 취향: {profile_text}\n"
        f"영상 제목: {video_title}\n"
        f"영상 설명: {video_description}\n\n"
        '이 영상이 사용자 취향과 얼마나 관련 있는지 0.0~1.0 사이 숫자로만 답해라. '
        '반드시 {"score": 0.0~1.0} 형식의 JSON으로만 답해라.'
    )

    try:
        response = httpx.post(
            LLM_API_URL,
            headers={"Authorization": f"Bearer {LLM_API_KEY}"},
            json={
                "model": LLM_MODEL,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.0,
                "response_format": {"type": "json_object"},
            },
            timeout=15.0,
        )
        response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"]
        score = json.loads(content)["score"]
        return max(0.0, min(1.0, float(score)))
    except Exception as error:  # noqa: BLE001 - 재채점 실패는 치명적이지 않으므로 조용히 넘어감
        print(f"[curator] LLM 재채점 실패, 임베딩 점수 유지: {error}")
        return None


def score_candidates(candidates: list[dict], preference_profile: dict) -> list[dict]:
    """
    candidates: [{"video_id": ..., "title": ..., "description": ..., "tags": [...]}]
    preference_profile: {"profile_text": "...", "strictness": float}

    반환: relevance_score가 붙고, 점수 높은 순으로 정렬된 리스트
    """
    profile_text = preference_profile.get("profile_text")
    strictness = preference_profile.get("strictness", 0.65)
    if not profile_text:
        raise ValueError("preference_profile에 profile_text가 없습니다")

    # 1단계: 임베딩 + 코사인 유사도
    profile_embedding = embed_text(profile_text)
    video_texts = [
        build_video_text(c["title"], c.get("description", ""), c.get("tags"))
        for c in candidates
    ]
    video_embeddings = embed_texts(video_texts)

    scored = []
    for candidate, video_embedding in zip(candidates, video_embeddings):
        relevance_score = cosine_similarity(video_embedding, profile_embedding)
        scored.append({**candidate, "relevance_score": relevance_score, "rescored": False})

    # 2단계: 경계 구간만 LLM 재채점
    for item in scored:
        if _is_borderline(item["relevance_score"], strictness):
            llm_score = _llm_rescore(item["title"], item.get("description", ""), profile_text)
            if llm_score is not None:
                item["relevance_score"] = llm_score
                item["rescored"] = True

    return sorted(scored, key=lambda c: c["relevance_score"], reverse=True)
