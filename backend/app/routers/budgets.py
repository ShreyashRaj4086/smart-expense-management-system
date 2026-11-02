from datetime import date
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ..database import get_db
from .. import crud, schemas

router = APIRouter(prefix="/api/budgets", tags=["Budgets"])

@router.get("", response_model=List[schemas.BudgetResponse])
def get_budgets(
    month: Optional[str] = Query(None, description="Month in YYYY-MM format"),
    db: Session = Depends(get_db)
):
    if month:
        parts = month.split("-")
        if len(parts) == 2:
            try:
                m_start = date(int(parts[0]), int(parts[1]), 1)
            except ValueError:
                today = date.today()
                m_start = date(today.year, today.month, 1)
        else:
            today = date.today()
            m_start = date(today.year, today.month, 1)
    else:
        today = date.today()
        m_start = date(today.year, today.month, 1)

    return crud.get_budgets_for_month(db, m_start)

@router.post("", response_model=schemas.BudgetResponse, status_code=status.HTTP_201_CREATED)
def set_category_budget(budget_in: schemas.BudgetCreate, db: Session = Depends(get_db)):
    try:
        b = crud.set_budget(db, budget_in)
        # Re-fetch with calculated status
        all_b = crud.get_budgets_for_month(db, b.month_start)
        match = next((item for item in all_b if item.budget_id == b.budget_id), None)
        if match:
            return match
        return schemas.BudgetResponse(
            budget_id=b.budget_id,
            category_id=b.category_id,
            category_name=b.category.category_name if b.category else "Category",
            month_start=b.month_start,
            budget_paise=b.budget_paise,
            budget_rupees=round(b.budget_paise / 100.0, 2),
            spent_paise=0,
            spent_rupees=0.0,
            remaining_paise=b.budget_paise,
            remaining_rupees=round(b.budget_paise / 100.0, 2),
            percentage_used=0.0,
            status="ok",
            created_at=b.created_at
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/{budget_id}")
def delete_budget(budget_id: int, db: Session = Depends(get_db)):
    success = crud.delete_budget(db, budget_id)
    if not success:
        raise HTTPException(status_code=404, detail="Budget not found.")
    return {"message": "Budget deleted successfully.", "budget_id": budget_id}
