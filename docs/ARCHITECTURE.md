# 프로젝트 구조

> 이 문서는 develop 브랜치에 실제로 존재하는 코드를 기준으로 작성되었습니다 (2026-08-06).

## 전체 그림

```
[YouTube 페이지]
      │ DOM
      ▼
┌─────────────────────────┐
│ content.ts (지영)         │  영상 카드 수집 → VIDEOS_COLLECTED 메시지
└──────────┬───────────────┘
           │ chrome.runtime.sendMessage
           ▼
┌─────────────────────────────────────────┐
│ service_worker.ts (수현/수연)              │  메시지 라우팅 허브
│  - VIDEOS_COLLECTED                       │
│  - REQUEST_PREFERENCE_PROFILE             │
│  - GET_PREFERENCE_PROFILE                 │
│  - LOG_USER_EVENT                         │
│  - GET_REPORT_STATS                       │
└──────┬───────────────────────┬────────────┘
       │                       │
       ▼                       ▼
┌─────────────┐      ┌──────────────────────┐
│ storage.ts    │      │ llmClient.ts (수현)     │
│ scoring.ts     │      │  → 백엔드 HTTP 호출      │
│ (주영)          │      └──────────┬────────────┘
│ chrome.storage │                 │ HTTPS
│ .local         │                 ▼
└─────────────┘      ┌──────────────────────────────┐
                       │ FastAPI 백엔드 (수현)            │
       ▲               │  /api/planner                 │
       │               │  /api/recommend                │
┌──────┴──────┐        │  /api/feedback                 │
│ Popup.tsx     │        │                                │
│ Report.tsx     │        │ Planner → Sourcer → Curator    │
│ (수연)          │        │  → Ranker                      │
└─────────────┘        └──────────────┬─────────────────┘
                                        ▼
                              ┌──────────────────┐
                              │ SQLite DB          │
                              │ YouTube Data API    │
                              │ LLM API             │
                              └──────────────────┘
```

## 폴더 구조

```
unalgorithm/
├── extension/                     Chrome Extension (Manifest V3)
│   ├── public/
│   │   ├── manifest.json
│   │   └── icons/
│   └── src/
│       ├── types.ts               ← 확장 전역 공유 타입 (모든 메시지가 이 타입 기준)
│       ├── content/
│       │   └── content.ts         담당: 지영 — DOM 파싱, 영상 카드 수집
│       ├── background/
│       │   ├── service_worker.ts  담당: 수현/수연 — 메시지 라우팅 허브
│       │   └── llmClient.ts       담당: 수현 — 백엔드 HTTP 클라이언트
│       ├── popup/
│       │   ├── Popup.tsx          담당: 수연 — 메인 UI
│       │   └── Report.tsx         담당: 수연 — 통계 리포트
│       └── storage/
│           ├── storage.ts         담당: 주영 — chrome.storage.local 읽기/쓰기
│           └── scoring.ts         담당: 주영 — 키워드 점수 업데이트
│
├── backend/                       FastAPI 서버
│   └── app/
│       ├── main.py                앱 진입점, CORS, DB 테이블 생성
│       ├── api/routes.py          엔드포인트 정의 + 파이프라인 오케스트레이션
│       ├── planner/planner.py     담당: 수현 — 자연어 → Preference Profile
│       ├── sourcer/sourcer.py     담당: 수현 — YouTube Data API 후보 검색
│       ├── curator/
│       │   ├── curator.py         담당: 수현 — 임베딩 유사도 + LLM 재채점
│       │   └── embedding.py       담당: 수현 — MiniLM 텍스트→벡터
│       ├── ranker/ranker.py       담당: 수현 — Weighted Borda + MMR
│       └── db/
│           ├── database.py        담당: 주영 — SQLAlchemy 세션
│           └── models.py          담당: 주영 — 테이블 정의
│
└── docs/                          설계 문서 (이 폴더)
```

## 데이터 흐름 요약

1. **content.ts**가 YouTube 화면에서 영상 정보를 긁어서 `VIDEOS_COLLECTED` 메시지로 background에 보냄
2. 사용자가 팝업에 자연어 입력 → `REQUEST_PREFERENCE_PROFILE` 메시지 → `llmClient.ts`가 백엔드 `/api/planner` 호출 → 결과를 `storage.ts`로 `chrome.storage.local`에 저장
3. 추천이 필요할 때 백엔드 `/api/recommend` 호출 → Sourcer(영상 검색) → Curator(관련도 채점) → Ranker(순위 결정) → 결과 반환
4. 사용자가 좋아요/싫어요 누르면 `LOG_USER_EVENT` → `storage.ts`(로컬 로그) + 필요시 백엔드 `/api/feedback`(서버 DB)

## ⚠️ 팀에서 결정하고 넘어가야 하는 것 (미해결)

1. **Preference Profile을 어디에 진짜로 저장할 것인가**
   현재 확장은 `chrome.storage.local`에만 저장하고, 백엔드는 SQLite에 별도로 저장합니다. 둘이 따로 놀면 안 되니 — **"백엔드 DB가 정본(source of truth), 확장의 chrome.storage는 캐시"**로 정하는 걸 추천합니다.
2. **user_id를 어떻게 만들 것인가**
   지금 확장에는 로그인이 없어서 사용자를 구분할 방법이 없습니다. → `chrome.storage.local`에 최초 실행 시 `crypto.randomUUID()`로 로컬 ID 하나 생성해서 저장하고, 모든 API 요청에 같이 실어 보내는 방식을 제안합니다.
3. **content script 설계가 2가지 버전으로 존재함** (`MERGE_NOTES.md` 참고) — 현재는 단순 버전(`VIDEOS_COLLECTED`)이 채택되어 있고, 더 발전된 버전은 `_alt-design-reference/`에 참고용으로만 남아있습니다. 나중에 통합할지 팀 논의 필요.
