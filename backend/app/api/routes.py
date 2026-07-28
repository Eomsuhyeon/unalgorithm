"""
API 라우터 — 담당: 수현 (오케스트레이션), 주영 (DB 연동)

TODO:
- POST /planner       : 자연어 입력 -> Preference Profile
- POST /recommend      : Preference Profile -> Sourcer -> Curator -> Ranker -> 추천 리스트
- POST /feedback       : 사용자 피드백 저장 (좋아요/싫어요/스킵)
"""

from fastapi import APIRouter

router = APIRouter()


@router.post("/planner")
def planner():
    # TODO: 수현
    raise NotImplementedError


@router.post("/recommend")
def recommend():
    # TODO: 수현
    raise NotImplementedError


@router.post("/feedback")
def feedback():
    # TODO: 주영
    raise NotImplementedError
