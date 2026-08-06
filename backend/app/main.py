"""
[Main]
이 파일이 하는 일:
FastAPI 앱을 만들고, DB 테이블을 생성하고, 라우터(routes.py)를 등록하는
서버 진입점 코드. `uvicorn app.main:app --reload`로 실행한다.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.db import models  # noqa: F401 - Base.metadata에 테이블 등록되도록 import
from app.db.database import Base, engine

Base.metadata.create_all(bind=engine)

app = FastAPI(title="umalgoritm backend")

# 크롬 확장 프로그램(다른 origin)에서 호출할 수 있도록 허용
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api")


@app.get("/health")
def health():
    return {"status": "ok"}
