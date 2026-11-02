from datetime import date
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..database import get_db
from .. import analytics, ml_anomaly, schemas

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])

def parse_month_param(month: Optional[str]) -> tuple[int, int]:
    if month:
        parts = month.split("-")
        if len(parts) == 2:
            try:
                return int(parts[0]), int(parts[1])
            except ValueError:
                pass
    today = date.today()
    return today.year, today.month

@router.get("/summary", response_model=schemas.KPISummary)
def get_kpis(
    month: Optional[str] = Query(None, description="Month in YYYY-MM format"),
    db: Session = Depends(get_db)
):
    year, m = parse_month_param(month)
    return analytics.get_kpi_summary(db, year, m)

@router.get("/categories", response_model=List[schemas.CategorySpend])
def get_category_breakdown(
    month: Optional[str] = Query(None, description="Month in YYYY-MM format"),
    db: Session = Depends(get_db)
):
    year, m = parse_month_param(month)
    return analytics.get_category_spending(db, year, m)

@router.get("/trend", response_model=List[schemas.DailySpend])
def get_spending_trend(
    month: Optional[str] = Query(None, description="Month in YYYY-MM format"),
    db: Session = Depends(get_db)
):
    year, m = parse_month_param(month)
    return analytics.get_daily_spending_trend(db, year, m)

@router.get("/comparison", response_model=List[schemas.CategoryComparison])
def get_category_comparison(
    month: Optional[str] = Query(None, description="Month in YYYY-MM format"),
    db: Session = Depends(get_db)
):
    year, m = parse_month_param(month)
    return analytics.get_category_comparison(db, year, m)

@router.get("/merchants")
def get_merchants(
    month: Optional[str] = Query(None, description="Month in YYYY-MM format"),
    limit: int = 10,
    db: Session = Depends(get_db)
):
    year, m = parse_month_param(month)
    return analytics.get_merchant_totals(db, year, m, limit=limit)

@router.get("/largest", response_model=List[dict])
def get_largest(
    month: Optional[str] = Query(None, description="Month in YYYY-MM format"),
    limit: int = 5,
    db: Session = Depends(get_db)
):
    year, m = parse_month_param(month)
    txns = analytics.get_largest_transactions(db, year, m, limit=limit)
    return [
        {
            "transaction_id": t.transaction_id,
            "transaction_date": t.transaction_date,
            "amount_rupees": round(t.amount_paise / 100.0, 2),
            "description": t.description,
            "category_name": t.category.category_name if t.category else "Uncategorized",
            "merchant_name": t.merchant.merchant_name if t.merchant else None,
            "payment_method_name": t.payment_method.method_name if t.payment_method else None,
            "source": t.source
        }
        for t in txns
    ]

@router.get("/anomalies", response_model=List[schemas.AnomalyItem])
def get_anomalies(
    month: Optional[str] = Query(None, description="Month in YYYY-MM format"),
    db: Session = Depends(get_db)
):
    year, m = parse_month_param(month) if month else (None, None)
    return ml_anomaly.detect_anomalies(db, year, m)
