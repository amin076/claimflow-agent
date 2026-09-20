from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol, Sequence

import numpy as np

from documents import SAMPLE_DOCUMENTS


class Encoder(Protocol):
    def encode(
        self,
        sentences: str | Sequence[str],
        *,
        normalize_embeddings: bool = True,
    ) -> np.ndarray: ...


@dataclass(frozen=True)
class Document:
    id: str
    claim_id: str
    text: str


@dataclass(frozen=True)
class Match:
    document_id: str
    claim_id: str
    score: float
    text: str


class Retriever:
    def __init__(self, documents: Sequence[Document], encoder: Encoder):
        if not documents:
            raise ValueError("At least one document is required.")

        self._documents = tuple(documents)
        self._encoder = encoder
        vectors = encoder.encode(
            [document.text for document in self._documents],
            normalize_embeddings=True,
        )
        self._document_embeddings = np.asarray(vectors, dtype=np.float32)

        expected_shape = (len(self._documents),)
        if (
            self._document_embeddings.ndim != 2
            or self._document_embeddings.shape[0] != expected_shape[0]
        ):
            raise ValueError("Encoder returned an invalid document embedding matrix.")

    def retrieve(self, question: str, top_k: int = 2) -> list[Match]:
        if not question.strip():
            raise ValueError("Question must not be empty.")
        if top_k < 1:
            raise ValueError("top_k must be at least 1.")

        query = np.asarray(
            self._encoder.encode(question, normalize_embeddings=True),
            dtype=np.float32,
        )
        if query.ndim != 1 or query.shape[0] != self._document_embeddings.shape[1]:
            raise ValueError("Encoder returned an invalid query embedding.")

        scores = self._document_embeddings @ query
        limit = min(top_k, len(self._documents))
        top_indices = np.argsort(scores)[::-1][:limit]

        return [
            Match(
                document_id=self._documents[index].id,
                claim_id=self._documents[index].claim_id,
                score=float(scores[index]),
                text=self._documents[index].text,
            )
            for index in top_indices
        ]


def sample_documents() -> list[Document]:
    return [
        Document(id=item["id"], claim_id=item["claim_id"], text=item["text"])
        for item in SAMPLE_DOCUMENTS
    ]


def build_default_retriever(
    model_name: str = "sentence-transformers/all-MiniLM-L6-v2",
) -> Retriever:
    from sentence_transformers import SentenceTransformer

    encoder = SentenceTransformer(model_name)
    return Retriever(sample_documents(), encoder)
