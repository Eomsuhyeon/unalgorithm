# DB 구조

백엔드 SQLite DB (`backend/app/db/models.py` 기준). `chrome.storage.local`은 별도이며
[ARCHITECTURE.md](ARCHITECTURE.md)의 미해결 항목 참고.

## preference_profiles

사용자 취향 프로필. `/api/planner` 호출 시 생성/갱신됨.

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | Integer, PK | |
| user_id | String, index | 확장에서 생성한 로컬 사용자 ID |
| profile_json | JSON | PreferenceProfile 전체 (allow_category, block_category 등) |
| updated_at | DateTime | 마지막 갱신 시각 (자동 갱신) |

## user_feedback

좋아요/싫어요/스킵/클릭 이벤트 로그. `/api/feedback` 호출 시 쌓임.

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | Integer, PK | |
| user_id | String, index | |
| video_id | String, index | |
| feedback_type | String | `like` \| `dislike` \| `skip` \| `click` |
| created_at | DateTime | 자동 기록 |

## ⚠️ 아직 테이블로 안 만들어진 것 (계획서 대비 부족한 부분)

계획 문서(`정리.pdf`)에는 아래도 DB에 저장한다고 되어 있는데 현재 모델에 없음:
- **Search History** (Sourcer가 어떤 검색어로 뭘 찾았는지)
- **Recommendation History** (매번 어떤 추천 리스트가 나갔는지 — 나중에 "왜 이 영상 추천됐는지" 설명하려면 필요)

지금 마감 급하면 스킵해도 동작에는 문제없지만, 발표 때 "재현성" 강조하려면 있는 게 좋습니다.
필요해지면 `models.py`에 `SearchHistory`, `RecommendationHistory` 테이블 추가 예정 (주영 담당 영역).

## chrome.storage.local (확장 쪽, 참고용)

`extension/src/storage/storage.ts` 기준. 백엔드 DB와 별개로 로컬에도 저장됨.

| 키 | 내용 |
|---|---|
| `preferenceProfile` | PreferenceProfile 단일 객체 (백엔드 응답 캐시) |
| `userEventLog` | UserEvent 배열, 최근 500개까지만 보관 |
| `keywordScores` | `{ [keyword: string]: number }` |
