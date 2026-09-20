from __future__ import annotations

import asyncio
import os
from contextlib import asynccontextmanager
from hmac import compare_digest
from typing import AsyncIterator

from fastapi import FastAPI, Header, HTTPException, Request
from pydantic import BaseModel, Field

from rag import Retriever, build_default_retriever


class RetrieveRequest(BaseModel):
    question: str = Field(min_length=1, max_length=5000)
    top_k: int = Field(default=2, ge=1, le=10)


class MatchResponse(BaseModel):
    document_id: str
    claim_id: str
    score: float
    text: str


class RetrieveResponse(BaseModel):
    question: str
    model: str
    matches: list[MatchResponse]


def create_app(retriever: Retriever | None = None) -> FastAPI:
    model_name = os.getenv(
        "RAG_MODEL",
        "sentence-transformers/all-MiniLM-L6-v2",
    )
    internal_token = os.getenv("RAG_INTERNAL_TOKEN")

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        app.state.retriever = retriever or await asyncio.to_thread(
            build_default_retriever,
            model_name,
        )
        yield

    app = FastAPI(
        title="ClaimFlow RAG Lab",
        version="0.2.0",
        lifespan=lifespan,
    )

    def authorize(authorization: str | None) -> None:
        if not internal_token:
            return
        expected = f"Bearer {internal_token}"
        if authorization is None or not compare_digest(authorization, expected):
            raise HTTPException(status_code=401, detail="unauthorized")

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok", "service": "claimflow-rag-lab"}

    @app.get("/ready")
    async def ready(request: Request) -> dict[str, str]:
        if not getattr(request.app.state, "retriever", None):
            raise HTTPException(status_code=503, detail="retriever unavailable")
        return {"status": "ready"}

    @app.post("/retrieve", response_model=RetrieveResponse)
    async def retrieve(
        payload: RetrieveRequest,
        request: Request,
        authorization: str | None = Header(default=None),
    ) -> RetrieveResponse:
        authorize(authorization)
        current: Retriever | None = getattr(request.app.state, "retriever", None)
        if current is None:
            raise HTTPException(status_code=503, detail="retriever unavailable")

        try:
            matches = await asyncio.to_thread(
                current.retrieve,
                payload.question,
                payload.top_k,
            )
        except ValueError as error:
            raise HTTPException(status_code=400, detail=str(error)) from error

        return RetrieveResponse(
            question=payload.question,
            model=model_name,
            matches=[
                MatchResponse(
                    document_id=match.document_id,
                    claim_id=match.claim_id,
                    score=match.score,
                    text=match.text,
                )
                for match in matches
            ],
        )

    return app


app = create_app()
