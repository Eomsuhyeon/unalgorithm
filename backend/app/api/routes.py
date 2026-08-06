"""
[API Routes]
이 파일이 하는 일:
확장 프로그램(llmClient.ts)이 호출하는 API 엔드포인트 3개를 정의하고,
Planner -> Sourcer -> Curator -> Ranker 파이프라인을 순서대로 실행해서
최종 추천 리스트를 만들어주는 코드.

- POST /planner   : 자연어 입력 -> Preference Profile(JSON)
- POST /recommend : Preference Profile -> 최종 추천 영상 리스트
- POST /feedback  : 좋아요/싫어요/스킵 저장
"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.curator.curator import score_candidates
from app.db.database import get_db
from app.db.models import PreferenceProfile as PreferenceProfileModel
from app.db.models import UserFeedback
from app.planner.planner import PreferenceProfile, parse_natural_language
from app.ranker.ranker import rank
from app.sourcer.sourcer import fetch_candidates

router = APIRouter()


# ---------- /planner ----------

class PlannerRequest(BaseModel):
    user_id: str
    text: str


@router.post("/planner", response_model=PreferenceProfile)
def planner(request: PlannerRequest, db: Session = Depends(get_db)):
    existing_row = (
        db.query(PreferenceProfileModel)
        .filter(PreferenceProfileModel.user_id == request.user_id)
        .first()
    )
    existing_profile = (
        PreferenceProfile(**existing_row.profile_json) if existing_row else None
    )

    new_profile = parse_natural_language(request.text, existing_profile)

    if existing_row:
        existing_row.profile_json = new_profile.model_dump()
    else:
        db.add(
            PreferenceProfileModel(
                user_id=request.user_id, profile_json=new_profile.model_dump()
            )
        )
    db.commit()

    return new_profile


# ---------- /recommend ----------

class RecommendRequest(BaseModel):
    user_id: str


@router.post("/recommend")
def recommend(request: RecommendRequest, db: Session = Depends(get_db)):
    profile_row = (
        db.query(PreferenceProfileModel)
        .filter(PreferenceProfileModel.user_id == request.user_id)
        .first()
    )
    if not profile_row:
        return {"error": "먼저 /planner로 취향 프로필을 생성해주세요"}

    profile_dict = profile_row.profile_json

    candidates = fetch_candidates(profile_dict)
    if not candidates:
        return {"recommendations": []}

    scored = score_candidates(candidates, profile_dict)
    ranked = rank(scored, profile_dict)

    return {"recommendations": ranked}


# ---------- /feedback ----------

class FeedbackRequest(BaseModel):
    user_id: str
    video_id: str
    feedback_type: str  # like / dislike / skip / click


@router.post("/feedback")
def feedback(request: FeedbackRequest, db: Session = Depends(get_db)):
    db.add(
        UserFeedback(
            user_id=request.user_id,
            video_id=request.video_id,
            feedback_type=request.feedback_type,
        )
    )
    db.commit()
    return {"status": "saved"}
