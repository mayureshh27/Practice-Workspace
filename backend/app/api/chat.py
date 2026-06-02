"""Chat API — tutor chat sessions with SSE streaming.

POST /api/chat/sessions      — create a new chat session
POST /api/chat/message        — send a message and get a Socratic response
POST /api/chat/sessions/{id}/end — end session and trigger summary
"""

from __future__ import annotations

import asyncio
from typing import Annotated

from fastapi import APIRouter, HTTPException, Path, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.agents import session_service, tutor_service
from app.storage.database import DatabaseDep

router = APIRouter(prefix="/api/chat", tags=["chat"])


# ── Request / Response models ───────────────────────────────────────


class ChatMessageRequest(BaseModel):
    """Request body for sending a chat message."""

    session_id: str
    message: str
    concept_ids: list[str] = []
    source_ids: list[str] = []


class ChatMessageResponse(BaseModel):
    """Response body for a chat message."""

    session_id: str
    response: str
    hint_event_id: str | None = None


class SessionCreateResponse(BaseModel):
    """Response body for creating a chat session."""

    session_id: str


class SessionEndResponse(BaseModel):
    """Response body for ending a chat session."""

    session_id: str
    summary_text: str | None = None
    event_count: int = 0


# ── Endpoints ───────────────────────────────────────────────────────


@router.post("/sessions")
def create_chat_session() -> SessionCreateResponse:
    """Create a new chat session and return the session ID."""
    session_id = session_service.create_session()
    return SessionCreateResponse(session_id=session_id)


@router.post("/message")
async def send_message(
    body: ChatMessageRequest,
    db_session: DatabaseDep,
    request: Request,
) -> ChatMessageResponse:
    """Send a message to the Socratic tutor and receive a response.

    The response is validated by the Socratic Gate before delivery.
    A HintRequested event is recorded in the event log.
    """
    try:
        response_text = await tutor_service.handle_chat_turn(
            db_session=db_session,
            session_id=body.session_id,
            user_message=body.message,
            concept_ids=body.concept_ids,
            source_ids=body.source_ids,
            retrieval_router=getattr(request.app.state, "retrieval_router", None),
            graph_layer=getattr(request.app.state, "graph_layer", None),
        )
        return ChatMessageResponse(
            session_id=body.session_id,
            response=response_text,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/message/stream")
async def send_message_stream(
    body: ChatMessageRequest,
    db_session: DatabaseDep,
    request: Request,
) -> StreamingResponse:
    """Send a message and receive the response as an SSE stream.

    Each chunk is sent as a Server-Sent Event with ``data: {text}\\n\\n``.
    The final event is ``data: [DONE]\\n\\n``.
    """

    async def event_stream():
        try:
            response_text = await tutor_service.handle_chat_turn(
                db_session=db_session,
                session_id=body.session_id,
                user_message=body.message,
                concept_ids=body.concept_ids,
                source_ids=body.source_ids,
                retrieval_router=getattr(request.app.state, "retrieval_router", None),
                graph_layer=getattr(request.app.state, "graph_layer", None),
            )

            # Simulate streaming by sending word-by-word
            # (Real streaming from the model will replace this when
            # Pydantic AI streaming is wired)
            words = response_text.split()
            chunk_size = 5  # words per chunk
            for i in range(0, len(words), chunk_size):
                chunk = " ".join(words[i : i + chunk_size])
                yield f"data: {chunk}\n\n"
                await asyncio.sleep(0.03)

            yield "data: [DONE]\n\n"

        except Exception as e:
            yield f"data: Error: {e}\n\n"
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/sessions/{session_id}/end")
async def end_chat_session(
    session_id: Annotated[str, Path(description="The session ID to end")],
    db_session: DatabaseDep,
) -> SessionEndResponse:
    """End a chat session and trigger a session summary.

    The SessionSummaryAgent produces a compressed pedagogical record.
    Mastery deltas are verified against actual events before writing.
    """
    try:
        summary = await session_service.end_session(db_session, session_id)
        return SessionEndResponse(
            session_id=session_id,
            summary_text=summary.summary_text if summary else None,
            event_count=summary.event_count if summary else 0,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
