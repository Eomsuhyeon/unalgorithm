"""
Planner — 담당: 수현

TODO:
- 자연어 입력 -> Preference Profile(JSON) 변환 (로컬 LLM: Qwen3-4B-Instruct / Gemma3-4B)
- 기존 프로필과 병합 (누적, 덮어쓰기 아님)
- 사용자 피드백을 프로필 가중치에 반영
"""

from pydantic import BaseModel


class PreferenceProfile(BaseModel):
    allow_category: list[str] = []
    block_category: list[str] = []
    preferred_language: list[str] = []
    diversity_level: float = 0.2
    novelty_level: float = 0.15
    popularity_weight: float = 0.3
    strictness: float = 0.65


def parse_natural_language(text: str) -> PreferenceProfile:
    # TODO: 수현 - LLM 호출 및 파싱
    raise NotImplementedError
