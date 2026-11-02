from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from .. import ai_insights, schemas

router = APIRouter(prefix="/api/ai", tags=["Local AI"])

@router.get("/status")
async def get_ai_status():
    return await ai_insights.check_ollama_status()

@router.post("/explain", response_model=schemas.AIExplainResponse)
async def explain_expenditure(
    payload: schemas.AIExplainRequest,
    db: Session = Depends(get_db)
):
    year, m = date.today().year, date.today().month
    if payload.month:
        parts = payload.month.split("-")
        if len(parts) == 2:
            try:
                year, m = int(parts[0]), int(parts[1])
            except ValueError:
                pass

    return await ai_insights.get_ai_explanation(
        db=db,
        year=year,
        month=m,
        user_question=payload.user_question
    )
