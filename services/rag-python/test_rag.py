from __future__ import annotations

import os
from collections.abc import Sequence

import numpy as np
from fastapi.testclient import TestClient

from app import create_app
from rag import Document, Retriever


class FakeEncoder:
    def encode(
        self,
        sentences: str | Sequence[str],
        *,
        normalize_embeddings: bool = True,
    ) -> np.ndarray:
        def vector(text: str) -> np.ndarray:
            lowered = text.lower()
            raw = (
                np.array([1.0, 0.0], dtype=np.float32)
                if "roof" in lowered or "rain" in lowered
                else np.array([0.0, 1.0], dtype=np.float32)
            )
            if normalize_embeddings:
                return raw / np.linalg.norm(raw)
            return raw

        if isinstance(sentences, str):
            return vector(sentences)
        return np.stack([vector(sentence) for sentence in sentences])


def make_retriever() -> Retriever:
    return Retriever(
        [
            Document(
                id="claim-1004",
                claim_id="1004",
                text="Heavy rain entered through damaged roof flashing.",
            ),
            Document(
                id="claim-1005",
                claim_id="1005",
                text="A vehicle damaged the garage door.",
            ),
        ],
        FakeEncoder(),
    )


def test_retriever_returns_semantic_best_match() -> None:
    matches = make_retriever().retrieve(
        "Did rain enter through roof damage?",
        top_k=1,
    )

    assert len(matches) == 1
    assert matches[0].claim_id == "1004"
    assert matches[0].score == 1.0


def test_retriever_caps_top_k_to_document_count() -> None:
    matches = make_retriever().retrieve("roof damage", top_k=10)
    assert len(matches) == 2


def test_api_retrieve_contract() -> None:
    with TestClient(create_app(make_retriever())) as client:
        health = client.get("/health")
        response = client.post(
            "/retrieve",
            json={"question": "rain through roof", "top_k": 1},
        )

    assert health.status_code == 200
    assert response.status_code == 200
    body = response.json()
    assert body["matches"][0]["claim_id"] == "1004"
    assert body["matches"][0]["document_id"] == "claim-1004"


def test_api_retrieve_requires_configured_token() -> None:
    previous = os.environ.get("RAG_INTERNAL_TOKEN")
    os.environ["RAG_INTERNAL_TOKEN"] = "x" * 64
    try:
        with TestClient(create_app(make_retriever())) as client:
            denied = client.post(
                "/retrieve",
                json={"question": "rain through roof", "top_k": 1},
            )
            allowed = client.post(
                "/retrieve",
                headers={"Authorization": f"Bearer {'x' * 64}"},
                json={"question": "rain through roof", "top_k": 1},
            )
    finally:
        if previous is None:
            os.environ.pop("RAG_INTERNAL_TOKEN", None)
        else:
            os.environ["RAG_INTERNAL_TOKEN"] = previous

    assert denied.status_code == 401
    assert allowed.status_code == 200
