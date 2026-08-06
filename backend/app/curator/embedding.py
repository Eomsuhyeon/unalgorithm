"""
embedding.py — 담당: 수현

all-MiniLM-L6-v2로 텍스트를 384차원 벡터로 변환한다.
모델은 최초 호출 시 한 번만 로드해서 이후 요청에서 재사용한다 (lazy singleton).
"""

from functools import lru_cache

from sentence_transformers import SentenceTransformer

MODEL_NAME = "all-MiniLM-L6-v2"


@lru_cache(maxsize=1)
def _get_model() -> SentenceTransformer:
    return SentenceTransformer(MODEL_NAME)


def embed_text(text: str) -> list[float]:
    """단일 텍스트를 384차원 임베딩 벡터로 변환한다."""
    model = _get_model()
    vector = model.encode(text, normalize_embeddings=False)
    return vector.tolist()


def embed_texts(texts: list[str]) -> list[list[float]]:
    """여러 텍스트를 한 번에 임베딩한다 (배치 처리가 개별 호출보다 빠름)."""
    model = _get_model()
    vectors = model.encode(texts, normalize_embeddings=False)
    return vectors.tolist()


def build_video_text(title: str, description: str = "", tags: list[str] | None = None) -> str:
    """영상 메타데이터를 임베딩 입력용 텍스트 하나로 합친다."""
    parts = [title, description]
    if tags:
        parts.append(" ".join(tags))
    return " ".join(p for p in parts if p)
