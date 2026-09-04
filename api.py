"""
Agent-Abuse Sentinel -- FastAPI Inference Endpoint
===================================================
Minimal API wrapper around score_session.py.
No auth, no DB -- designed for Stitch UI integration.

Routes:
  GET  /health
  POST /score         -- one session JSON -> scored result
  POST /score_batch   -- JSON list of sessions OR CSV file upload

Run with:
  uvicorn api:app --reload --port 8000
"""

import sys, io
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8")

import json
import time
import pathlib
import tempfile
import traceback
from typing import Any

import pandas as pd
from fastapi import FastAPI, HTTPException, UploadFile, File, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Import the scoring layer -- must be in the same directory
from score_session import score_session, score_batch, RAW_FEATURE_COLS, ML_LOAD_ERROR

app = FastAPI(
    title="Agent-Abuse Sentinel API",
    description="Real-time session abuse detection with rule-based + ML hybrid scoring.",
    version="1.0.0",
)

# Allow all origins for Stitch / local dev -- lock this down in production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class SessionPayload(BaseModel):
    """One raw session. All RAW_FEATURE_COLS must be present."""
    session_id: str | None = None
    num_requests: int
    session_duration_sec: float
    mean_inter_request_time: float
    std_inter_request_time: float
    min_inter_request_time: float
    unique_params_touched: int
    param_reuse_rate: float
    failed_request_rate: float
    endpoint_diversity: int
    user_agent_entropy: float
    mouse_or_client_signal_present: bool
    discount_code_attempts: int
    geo_ip_consistency: bool
    time_of_day_bucket: str  # "morning" | "afternoon" | "evening" | "night"
    # Optional pass-through metadata (not used in scoring)
    label: str | None = None
    sub_pattern: str | None = None

    class Config:
        extra = "allow"   # tolerate extra fields from Stitch


class BatchPayload(BaseModel):
    sessions: list[dict[str, Any]]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _tier_counts(results: list[dict]) -> dict:
    counts = {"pass": 0, "review_queue": 0, "high_confidence": 0}
    for r in results:
        counts[r["tier"]] = counts.get(r["tier"], 0) + 1
    return counts


def _make_response(results: list[dict], elapsed_ms: float) -> dict:
    return {
        "results": results,
        "summary": {
            "total_sessions": len(results),
            "tier_counts": _tier_counts(results),
            "ml_available": ML_LOAD_ERROR is None,
            "ml_warning": ML_LOAD_ERROR,
        },
        "elapsed_ms": round(elapsed_ms, 2),
    }


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/health", tags=["Meta"])
def health():
    """Liveness check. Also reports whether the ML model loaded successfully."""
    return {
        "status": "ok",
        "ml_available": ML_LOAD_ERROR is None,
        "ml_warning": ML_LOAD_ERROR,
        "required_fields": RAW_FEATURE_COLS,
    }


@app.post("/score", tags=["Scoring"])
def score_one(payload: SessionPayload):
    """
    Score a single session.

    Returns the full scored result including tier, rule breakdown,
    ML probability, fired signals, and top model features.
    """
    t0 = time.perf_counter()
    session_dict = payload.model_dump()
    try:
        result = score_session(session_dict)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Scoring error: {e}")

    elapsed_ms = (time.perf_counter() - t0) * 1000
    return {"result": result, "elapsed_ms": round(elapsed_ms, 2)}


@app.post("/score_batch", tags=["Scoring"])
async def score_batch_endpoint(request: Request):
    """
    Score a batch of sessions.

    Accepts either:
      - JSON body: {"sessions": [ {...}, {...} ]}
      - multipart/form-data with a single 'file' field containing a CSV

    Returns list of scored results + tier-count summary.
    """
    t0 = time.perf_counter()
    content_type = request.headers.get("content-type", "")

    try:
        if "multipart/form-data" in content_type:
            # CSV upload path
            form = await request.form()
            file = form.get("file")
            if file is None:
                raise HTTPException(status_code=422, detail="multipart form must include a 'file' field")
            contents = await file.read()
            with tempfile.NamedTemporaryFile(suffix=".csv", delete=False, mode="wb") as tmp:
                tmp.write(contents)
                tmp_path = tmp.name
            results = score_batch(tmp_path)
            pathlib.Path(tmp_path).unlink(missing_ok=True)

        else:
            # JSON path
            body = await request.json()
            sessions = body.get("sessions")
            if not isinstance(sessions, list) or len(sessions) == 0:
                raise HTTPException(status_code=422, detail="body must have a non-empty 'sessions' list")
            results = [score_session(s) for s in sessions]

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Batch scoring error: {traceback.format_exc()}")

    elapsed_ms = (time.perf_counter() - t0) * 1000
    return _make_response(results, elapsed_ms)
