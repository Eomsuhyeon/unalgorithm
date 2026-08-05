# 병합 노트 (unalgorithm-feature-kong + extension-skeleton)

두 zip을 비교해보니 `extension/` 폴더 구조는 동일하지만 내용물의 완성도가 달랐습니다.

## 병합 기준

- **extension-skeleton**의 `extension/` 폴더를 기준(base)으로 사용했습니다.
  - `unalgorithm-feature-kong`의 `extension/src/*` 파일들은 대부분 `// TODO` 주석만 있는 미구현 스켈레톤이었고,
  - `extension-skeleton`의 동일 파일들은 실제 로직(백엔드 API 연동, DOM 파싱, chrome.storage 연동, Chart.js 리포트 등)이 구현되어 있었습니다.
  - `extension-skeleton`에만 있던 `src/types.ts`(공유 타입 정의), 아이콘(`public/icons/`), `package-lock.json`도 그대로 포함했습니다.

- **unalgorithm-feature-kong**에만 있고 skeleton에는 없던 다음 폴더/파일을 그대로 가져왔습니다.
  - `backend/` — FastAPI 서버 전체 (planner/sourcer/curator/ranker/db/api)
  - `docs/` — 설계 문서 PDF 3종
  - `README.md` — 프로젝트 개요 및 팀 역할 분담 문서

## ⚠️ 충돌 주의: content script가 2가지 설계로 존재합니다

`unalgorithm-feature-kong`의 루트에 있던 `content.ts`는 `extension/src/content/content.ts`와는
**다른 메시지 프로토콜**을 사용하는, 훨씬 더 발전된 버전의 content script였습니다.

| | skeleton 버전 (현재 채택됨, `extension/src/content/content.ts`) | kong 루트 버전 (`_alt-design-reference/content.kong-design.ts`) |
|---|---|---|
| 데이터 타입 | `VideoMetadata` (`types.ts`) | `VideoCardData` (자체 정의) |
| 메시지 타입 | `VIDEOS_COLLECTED` | `SCORE_VIDEOS`, `LOG_FEEDBACK`, `SETTINGS_UPDATED` |
| 기능 | 영상 목록 수집 → background 전달 | 수집 + 관련도 점수 요청 + 필터링(숨김/블러/배지) + 다양성 다이얼까지 content script 안에서 직접 처리 |

두 파일은 서로 다른 백엔드 계약(contract)을 전제로 하고 있어 기계적으로 합칠 수 없었습니다.
현재 `background/service_worker.ts`, `storage.ts` 등은 skeleton 버전의 프로토콜(`VIDEOS_COLLECTED` 등)에 맞춰
구현되어 있으므로, 우선 skeleton 버전을 실제 코드로 채택하고 kong 버전은
`extension/src/content/_alt-design-reference/content.kong-design.ts` 에 참고용으로 보존해두었습니다.

**다음에 할 일:** 두 설계 중 하나로 통일하려면
1) kong 버전의 필터링/배지 UX를 채택 → `types.ts`에 `VideoCardData`/`FilterSettings` 타입과
   `SCORE_VIDEOS`/`LOG_FEEDBACK`/`SETTINGS_UPDATED` 메시지를 추가하고 `service_worker.ts`도 맞춰 수정, 또는
2) skeleton 버전을 유지하고 kong 버전의 필터링(블러/배지/다양성 노출) 로직만 골라서 이식

## 최종 폴더 구조

```
merged/
├── README.md              (kong)
├── MERGE_NOTES.md          (이 파일)
├── extension/              (skeleton 기준, 완전 구현됨)
│   ├── package.json
│   ├── package-lock.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── public/
│   │   ├── manifest.json
│   │   └── icons/
│   └── src/
│       ├── types.ts
│       ├── background/
│       ├── content/
│       │   └── _alt-design-reference/
│       │       └── content.kong-design.ts   (kong의 대안 설계, 참고용)
│       ├── popup/
│       └── storage/
├── backend/                 (kong, FastAPI 서버)
└── docs/                    (kong, 설계 문서 PDF)
```
