# umalgoritm

AI 기반 YouTube 콘텐츠 큐레이션 Chrome Extension.
기존 YouTube 추천 피드를 사용자의 자연어 선호와 의미적 유사도 기반으로 재해석해 개인화 추천을 제공합니다.

## 폴더 구조

```
umalgoritm/
├── extension/         # Chrome Extension (Manifest V3)
│   ├── public/
│   │   └── manifest.json
│   └── src/
│       ├── content/    # DOM 파싱, MutationObserver → 지영
│       ├── background/ # LLM 호출, API 통신 → 수현
│       ├── popup/       # Popup / Report UI → 수연
│       └── storage/     # chrome.storage, 행동 로그 → 주영
│
├── backend/            # FastAPI 서버
│   └── app/
│       ├── planner/    # 자연어 → Preference Profile → 수현
│       ├── sourcer/    # YouTube Data API 후보 검색 → 수현
│       ├── curator/    # 임베딩 + LLM 2단 스코어링 → 수현
│       ├── ranker/     # Weighted Borda + MMR → 수현
│       ├── db/         # DB 모델 / 세션 → 주영
│       └── api/        # FastAPI 라우터
│
└── docs/                # 설계 문서
```

## 담당 (계획 5주 기준)

| 담당 | 영역 | 주요 디렉터리 |
|---|---|---|
| 지영 | Content Script | `extension/src/content` |
| 수현 | AI / Backend | `extension/src/background`, `backend/app/{planner,sourcer,curator,ranker}` |
| 수연 | Extension / UI | `extension/src/popup`, `extension/public/manifest.json` |
| 주영 | Storage / DB | `extension/src/storage`, `backend/app/db` |

## 로컬 실행

### Backend
```bash
cd backend
python -m venv .venv
.venv/Scripts/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Extension
```bash
cd extension
npm install
npm run dev
```
`chrome://extensions` → 개발자 모드 → "압축해제된 확장 프로그램 로드" → `extension/dist` 선택

## 브랜치 전략

- `main`: 항상 동작하는 상태 유지
- 각자 `feature/<이름>-<기능>` 브랜치에서 작업 후 PR로 머지
- 예: `feature/jiyoung-content-script`, `feature/juyoung-storage`
