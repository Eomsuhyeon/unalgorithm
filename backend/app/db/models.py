"""
models.py — 담당: 주영

TODO:
- PreferenceProfile, UserFeedback, SearchHistory, RecommendationHistory 테이블 정의
"""

from sqlalchemy import Column, Integer, String, Float, DateTime, JSON
from sqlalchemy.sql import func

from app.db.database import Base


class PreferenceProfile(Base):
    __tablename__ = "preference_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True)
    profile_json = Column(JSON, default=dict)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class UserFeedback(Base):
    __tablename__ = "user_feedback"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True)
    video_id = Column(String, index=True)
    feedback_type = Column(String)  # like / dislike / skip / click
    created_at = Column(DateTime(timezone=True), server_default=func.now())
