"""
[Sourcer]
이 파일이 하는 일:
사용자 Preference Profile(allow_category 등)을 바탕으로
YouTube Data API v3에서 새로운 후보 영상들을 검색해오는 코드.

- allow_category 각각을 검색어로 사용 (Query Expansion)
- novelty_level이 높으면 관련 있지만 아직 안 본 분야도 섞어서 검색 (Novelty Search)
- 결과를 Curator가 바로 쓸 수 있는 형태(dict 리스트)로 변환해서 반환
"""

import os

import httpx

YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY", "")
YOUTUBE_SEARCH_URL = "https://www.googleapis.com/youtube/v3/search"

RESULTS_PER_QUERY = 15


def _search_youtube(query: str, max_results: int = RESULTS_PER_QUERY) -> list[dict]:
    """YouTube Data API search.list 호출. 실패하면 빈 리스트 반환 (파이프라인이 멈추지 않게)."""
    if not YOUTUBE_API_KEY:
        print("[sourcer] YOUTUBE_API_KEY가 없어 검색을 건너뜁니다")
        return []

    try:
        response = httpx.get(
            YOUTUBE_SEARCH_URL,
            params={
                "key": YOUTUBE_API_KEY,
                "q": query,
                "part": "snippet",
                "type": "video",
                "maxResults": max_results,
                "relevanceLanguage": "ko",
                "order": "relevance",
            },
            timeout=10.0,
        )
        response.raise_for_status()
        return response.json().get("items", [])
    except httpx.HTTPError as error:
        print(f"[sourcer] YouTube API 호출 실패 (query={query!r}): {error}")
        return []


def _to_candidate(item: dict) -> dict:
    """YouTube API 응답 하나를 Curator 입력 형태로 변환한다."""
    snippet = item.get("snippet", {})
    return {
        "video_id": item.get("id", {}).get("videoId", ""),
        "title": snippet.get("title", ""),
        "description": snippet.get("description", ""),
        "tags": [],  # search.list에는 tags가 없음 (videos.list로 추가 조회하면 얻을 수 있음, 필요시 확장)
        "channel": snippet.get("channelTitle", ""),
        "published_at": snippet.get("publishedAt", ""),
    }


def fetch_candidates(preference_profile: dict) -> list[dict]:
    """
    preference_profile: {
        "allow_category": [...],
        "block_category": [...],
        "novelty_level": float,
    }
    반환: 중복 제거된 후보 영상 dict 리스트
    """
    allow_category = preference_profile.get("allow_category", [])
    block_category = set(preference_profile.get("block_category", []))
    novelty_level = preference_profile.get("novelty_level", 0.15)

    queries = list(allow_category) if allow_category else ["youtube 추천"]

    # novelty_level이 높을수록 취향 밖 새 분야도 탐색해보도록 쿼리를 살짝 넓힘
    if novelty_level > 0.3 and allow_category:
        queries.append(f"{allow_category[0]} 관련 새로운 채널")

    seen_video_ids: set[str] = set()
    candidates: list[dict] = []

    for query in queries:
        for raw_item in _search_youtube(query):
            candidate = _to_candidate(raw_item)
            if not candidate["video_id"] or candidate["video_id"] in seen_video_ids:
                continue
            if candidate["channel"] in block_category:
                continue
            seen_video_ids.add(candidate["video_id"])
            candidates.append(candidate)

    return candidates
