from app.curator.curator import cosine_similarity


def test_cosine_similarity_identical_vectors():
    assert cosine_similarity([1, 0, 0], [1, 0, 0]) == 1.0


def test_cosine_similarity_orthogonal_vectors():
    assert cosine_similarity([1, 0], [0, 1]) == 0.5


def test_cosine_similarity_opposite_vectors():
    assert cosine_similarity([1, 0], [-1, 0]) == 0.0


def test_cosine_similarity_rejects_mismatched_dimensions():
    import pytest

    with pytest.raises(ValueError):
        cosine_similarity([1, 0], [1, 0, 0])


# score_candidates()는 sentence-transformers 모델 다운로드가 필요해
# (all-MiniLM-L6-v2, 최초 실행 시 인터넷 필요) 여기서는 단위 테스트를 생략했다.
# 통합 테스트는 별도 test_curator_integration.py에서 다룰 예정.
