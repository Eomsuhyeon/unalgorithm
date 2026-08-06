# API 명세서

베이스 URL (로컬 개발): `http://localhost:8000`

> ⚠️ **경로 통일 필요**: 현재 백엔드 코드(`routes.py`)는 `/planner`로, 확장 쪽 develop 코드는
> `/api/planner`로 서로 다르게 부르고 있습니다. 이 문서는 **`/api` 프리픽스로 통일**하는 것을
> 기준으로 작성했습니다. 백엔드에서 `app.include_router(router, prefix="/api")`로 맞추면 됩니다.

---

## POST /api/planner

자연어 입력을 Preference Profile(JSON)로 변환한다.

**Request**
```json
{
  "user_id": "string (로컬에서 생성한 UUID)",
  "text": "게임 영상은 줄이고 AI 강의를 더 보여줘"
}
```

**Response 200**
```json
{
  "allow_category": ["AI", "education"],
  "block_category": ["gaming"],
  "preferred_language": ["ko"],
  "diversity_level": 0.2,
  "novelty_level": 0.15,
  "popularity_weight": 0.3,
  "strictness": 0.65,
  "profile_text": "AI 강의와 교육 콘텐츠를 선호하고 게임 영상은 피함"
}
```

**Response 4xx/5xx**
```json
{ "detail": "에러 메시지" }
```

---

## POST /api/recommend

저장된 Preference Profile을 기준으로 최종 추천 영상 리스트를 생성한다.
(먼저 `/api/planner`로 프로필이 생성되어 있어야 함)

**Request**
```json
{ "user_id": "string" }
```

**Response 200**
```json
{
  "recommendations": [
    {
      "video_id": "abc123",
      "title": "AI 최신 논문 리뷰",
      "channel": "OO채널",
      "relevance_score": 0.91,
      "borda_score": 0.87,
      "rescored": false
    }
  ]
}
```

**Response 200 (프로필 없을 때)**
```json
{ "error": "먼저 /planner로 취향 프로필을 생성해주세요" }
```

---

## POST /api/feedback

사용자의 좋아요/싫어요/스킵/클릭 이벤트를 서버 DB에 저장한다.

**Request**
```json
{
  "user_id": "string",
  "video_id": "abc123",
  "feedback_type": "like"
}
```
`feedback_type`은 `"like" | "dislike" | "skip" | "click"` 중 하나.

**Response 200**
```json
{ "status": "saved" }
```

---

## GET /health

서버 생존 확인용.

**Response 200**
```json
{ "status": "ok" }
```

---

## 확장 프로그램 내부 메시지 (참고용, HTTP API 아님)

`chrome.runtime.sendMessage`로 content/popup ↔ background(service_worker.ts) 사이에 주고받는
메시지들. 타입 정의는 `extension/src/types.ts` 참고.

| 메시지 타입 | 방향 | 용도 |
|---|---|---|
| `VIDEOS_COLLECTED` | content → background | 수집한 영상 목록 전달 |
| `REQUEST_PREFERENCE_PROFILE` | popup → background | 자연어 입력 → 프로필 생성 요청 (내부적으로 `/api/planner` 호출) |
| `GET_PREFERENCE_PROFILE` | popup/content → background | 저장된 프로필 조회 |
| `LOG_USER_EVENT` | popup/content → background | 피드백 이벤트 기록 |
| `GET_REPORT_STATS` | popup → background | 리포트용 통계 조회 |
