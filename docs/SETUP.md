# 개발 환경 세팅 매뉴얼

## 0. 저장소 클론 & 브랜치

```bash
git clone https://github.com/Eomsuhyeon/unalgorithm.git
cd unalgorithm
git checkout develop
git checkout -b feature/<이름>-<기능>
```

---

## 1. Backend (FastAPI)

### 필요 프로그램
- Python 3.11+

### 설치
```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate
# Mac/Linux
source .venv/bin/activate

pip install -r requirements.txt
```
> `sentence-transformers`가 PyTorch를 같이 설치해서 시간이 좀 걸립니다 (수백MB~2GB).

### 환경변수
```bash
cp .env.example .env
```
`.env` 채우기:
| 변수 | 어디서 발급 | 없으면 어떻게 됨 |
|---|---|---|
| `YOUTUBE_API_KEY` | Google Cloud Console → YouTube Data API v3 사용 설정 → API 키 발급 | Sourcer가 검색을 건너뛰고 빈 리스트 반환 |
| `LLM_API_KEY` | OpenAI 등 사용하는 LLM 제공자 | Planner/Curator 2단계가 조용히 스킵됨 (기본값만 나옴) |

### 실행
```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```
확인: 브라우저에서 `http://127.0.0.1:8000/health` → `{"status":"ok"}`
API 문서(Swagger): `http://127.0.0.1:8000/docs`

### 테스트
```bash
pytest
```

---

## 2. Extension (Chrome)

### 필요 프로그램
- Node.js 18+

### 설치 & 빌드
```bash
cd extension
npm install
npm run build     # 또는 개발 중엔 npm run dev (watch 모드)
```

### 크롬에 로드하기
1. 크롬 주소창에 `chrome://extensions` 입력
2. 우측 상단 **개발자 모드** 켜기
3. **압축해제된 확장 프로그램을 로드합니다** 클릭
4. `extension/dist` 폴더 선택
5. YouTube 접속해서 정상 동작 확인

### 코드 수정 후 반영
`npm run dev`(watch 모드)로 빌드해두면 파일 저장 시 자동 재빌드됩니다.
단, 크롬에는 자동 반영 안 되니 `chrome://extensions`에서 새로고침 버튼(⟳) 눌러야 합니다.

---

## 3. 전체 통합 확인 (Extension ↔ Backend)

1. 백엔드 먼저 켜기 (`uvicorn ...`)
2. 확장 프로그램 로드 후 YouTube 접속
3. 팝업 열어서 자연어 입력 → 백엔드 콘솔에 요청 로그 뜨는지 확인
4. 안 되면 다음을 의심:
   - 백엔드가 `127.0.0.1:8000`에서 켜져 있는지 (`llmClient.ts`의 `BACKEND_BASE_URL`과 일치해야 함)
   - CORS 에러 (`app/main.py`에 CORSMiddleware 등록되어 있어야 함, 이미 되어있음)
   - API 경로 불일치 (`/planner` vs `/api/planner` — [API_SPEC.md](API_SPEC.md) 참고, 통일 필요)

---

## 4. Git 협업 규칙

- 브랜치명: `feature/<이름>-<기능>` (예: `feature/suhyeon-ai-backend`)
- 항상 `develop`에서 브랜치 따서 작업, PR도 `develop`으로
- PR 올리기 전에 `git fetch origin && git merge origin/develop`으로 미리 최신화하고 충돌 로컬에서 해결
- 커밋 메시지: 무엇을/왜 했는지 한글로 간단히
