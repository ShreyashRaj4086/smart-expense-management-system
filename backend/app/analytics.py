import calendar
from datetime import date
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, extract, and_

from . import models, schemas

def get_month_date_range(year: int, month: int) -> tuple[date, date, int]:
    days_in_month = calendar.monthrange(year, month)[1]
    start_date = date(year, month, 1)
    end_date = date(year, month, days_in_month)
    return start_date, end_date, days_in_month

def get_prev_month(year: int, month: int) -> tuple[int, int]:
    if month == 1:
        return year - 1, 12
    return year, month - 1

def get_kpi_summary(db: Session, year: int, month: int) -> schemas.KPISummary:
    start_cur, end_cur, days_in_cur = get_month_date_range(year, month)
    prev_y, prev_m = get_prev_month(year, month)
    start_prev, end_prev, days_in_prev = get_month_date_range(prev_y, prev_m)

    # Current month expenses
    cur_stats = db.query(
        func.coalesce(func.sum(models.Transaction.amount_paise), 0).label("total_paise"),
        func.count(models.Transaction.transaction_id).label("count")
    ).filter(
        models.Transaction.transaction_date >= start_cur,
        models.Transaction.transaction_date <= end_cur,
        models.Transaction.transaction_type == "expense"
    ).first()

    cur_total = cur_stats.total_paise if cur_stats else 0
    cur_count = cur_stats.count if cur_stats else 0

    # Previous month expenses
    prev_stats = db.query(
        func.coalesce(func.sum(models.Transaction.amount_paise), 0).label("total_paise")
    ).filter(
        models.Transaction.transaction_date >= start_prev,
        models.Transaction.transaction_date <= end_prev,
        models.Transaction.transaction_type == "expense"
    ).first()

    prev_total = prev_stats.total_paise if prev_stats else 0

    # MoM calculations
    diff_paise = cur_total - prev_total
    diff_rupees = round(diff_paise / 100.0, 2)

    pct_change: Optional[float] = None
    if prev_total > 0:
        pct_change = round((diff_paise / prev_total) * 100.0, 1)
        if pct_change > 0:
            change_type = "increase"
        elif pct_change < 0:
            change_type = "decrease"
        else:
            change_type = "same"
    else:
        if cur_total > 0:
            pct_change = None
            change_type = "new_spending"
        else:
            pct_change = 0.0
            change_type = "no_spending"

    # Daily average
    avg_daily_paise = int(cur_total / days_in_cur) if days_in_cur > 0 else 0

    # Budget summary for current month
    budgets = db.query(
        func.coalesce(func.sum(models.Budget.budget_paise), 0).label("total_budget")
    ).filter(models.Budget.month_start == start_cur).first()

    budget_total_paise = budgets.total_budget if budgets else 0
    budget_remaining_paise = max(0, budget_total_paise - cur_total) if budget_total_paise > 0 else 0
    budget_utilization_pct = round((cur_total / budget_total_paise * 100.0), 1) if budget_total_paise > 0 else 0.0

    return schemas.KPISummary(
        total_expense_paise=cur_total,
        total_expense_rupees=round(cur_total / 100.0, 2),
        prev_month_expense_paise=prev_total,
        prev_month_expense_rupees=round(prev_total / 100.0, 2),
        change_rupees=diff_rupees,
        percentage_change=pct_change,
        change_type=change_type,
        avg_daily_paise=avg_daily_paise,
        avg_daily_rupees=round(avg_daily_paise / 100.0, 2),
        transaction_count=cur_count,
        budget_total_paise=budget_total_paise,
        budget_total_rupees=round(budget_total_paise / 100.0, 2),
        budget_remaining_paise=budget_remaining_paise,
        budget_remaining_rupees=round(budget_remaining_paise / 100.0, 2),
        budget_utilization_pct=budget_utilization_pct
    )

def get_category_spending(db: Session, year: int, month: int) -> List[schemas.CategorySpend]:
    start_date, end_date, _ = get_month_date_range(year, month)

    rows = db.query(
        models.Transaction.category_id,
        models.Category.category_name,
        func.sum(models.Transaction.amount_paise).label("total_paise"),
        func.count(models.Transaction.transaction_id).label("count")
    ).outerjoin(
        models.Category, models.Transaction.category_id == models.Category.category_id
    ).filter(
        models.Transaction.transaction_date >= start_date,
        models.Transaction.transaction_date <= end_date,
        models.Transaction.transaction_type == "expense"
    ).group_by(
        models.Transaction.category_id, models.Category.category_name
    ).order_by(
        func.sum(models.Transaction.amount_paise).desc()
    ).all()

    overall_paise = sum((r.total_paise or 0) for r in rows)

    results = []
    for r in rows:
        amount_paise = r.total_paise or 0
        pct = round((amount_paise / overall_paise * 100.0), 1) if overall_paise > 0 else 0.0
        results.append(schemas.CategorySpend(
            category_id=r.category_id,
            category_name=r.category_name or "Uncategorized",
            amount_paise=amount_paise,
            amount_rupees=round(amount_paise / 100.0, 2),
            percentage=pct,
            transaction_count=r.count or 0
        ))
    return results

def get_daily_spending_trend(db: Session, year: int, month: int) -> List[schemas.DailySpend]:
    start_date, end_date, _ = get_month_date_range(year, month)

    rows = db.query(
        models.Transaction.transaction_date,
        func.sum(models.Transaction.amount_paise).label("total_paise"),
        func.count(models.Transaction.transaction_id).label("count")
    ).filter(
        models.Transaction.transaction_date >= start_date,
        models.Transaction.transaction_date <= end_date,
        models.Transaction.transaction_type == "expense"
    ).group_by(
        models.Transaction.transaction_date
    ).order_by(
        models.Transaction.transaction_date.asc()
    ).all()

    daily_map = {r.transaction_date.strftime("%Y-%m-%d"): (r.total_paise, r.count) for r in rows}

    # Generate entries for all days in month
    num_days = calendar.monthrange(year, month)[1]
    trend = []
    for day in range(1, num_days + 1):
        dt_str = f"{year:04d}-{month:02d}-{day:02d}"
        val_paise, cnt = daily_map.get(dt_str, (0, 0))
        trend.append(schemas.DailySpend(
            date=dt_str,
            amount_paise=val_paise,
            amount_rupees=round(val_paise / 100.0, 2),
            count=cnt
        ))
    return trend

def get_category_comparison(db: Session, year: int, month: int) -> List[schemas.CategoryComparison]:
    start_cur, end_cur, _ = get_month_date_range(year, month)
    prev_y, prev_m = get_prev_month(year, month)
    start_prev, end_prev, _ = get_month_date_range(prev_y, prev_m)

    # Current month by category
    cur_rows = db.query(
        models.Transaction.category_id,
        models.Category.category_name,
        func.sum(models.Transaction.amount_paise).label("total_paise")
    ).outerjoin(
        models.Category, models.Transaction.category_id == models.Category.category_id
    ).filter(
        models.Transaction.transaction_date >= start_cur,
        models.Transaction.transaction_date <= end_cur,
        models.Transaction.transaction_type == "expense"
    ).group_by(models.Transaction.category_id, models.Category.category_name).all()

    # Previous month by category
    prev_rows = db.query(
        models.Transaction.category_id,
        models.Category.category_name,
        func.sum(models.Transaction.amount_paise).label("total_paise")
    ).outerjoin(
        models.Category, models.Transaction.category_id == models.Category.category_id
    ).filter(
        models.Transaction.transaction_date >= start_prev,
        models.Transaction.transaction_date <= end_prev,
        models.Transaction.transaction_type == "expense"
    ).group_by(models.Transaction.category_id, models.Category.category_name).all()

    cur_map = {r.category_id: (r.category_name or "Uncategorized", r.total_paise or 0) for r in cur_rows}
    prev_map = {r.category_id: (r.category_name or "Uncategorized", r.total_paise or 0) for r in prev_rows}

    all_cat_ids = set(cur_map.keys()).union(set(prev_map.keys()))
    comparisons = []

    for cat_id in all_cat_ids:
        cat_name = cur_map.get(cat_id, (None, 0))[0] or prev_map.get(cat_id, (None, 0))[0] or "Uncategorized"
        cur_paise = cur_map.get(cat_id, (None, 0))[1]
        prev_paise = prev_map.get(cat_id, (None, 0))[1]

        diff_paise = cur_paise - prev_paise
        diff_rupees = round(diff_paise / 100.0, 2)

        if prev_paise > 0 and cur_paise > 0:
            pct = round((diff_paise / prev_paise) * 100.0, 1)
            status = "increased" if pct > 0 else ("decreased" if pct < 0 else "steady")
        elif prev_paise == 0 and cur_paise > 0:
            pct = None
            status = "new_spending"
        elif prev_paise > 0 and cur_paise == 0:
            pct = -100.0
            status = "stopped_spending"
        else:
            pct = 0.0
            status = "steady"

        comparisons.append(schemas.CategoryComparison(
            category_id=cat_id,
            category_name=cat_name,
            current_paise=cur_paise,
            current_rupees=round(cur_paise / 100.0, 2),
            prev_paise=prev_paise,
            prev_rupees=round(prev_paise / 100.0, 2),
            difference_rupees=diff_rupees,
            percentage_change=pct,
            status=status
        ))

    comparisons.sort(key=lambda x: abs(x.difference_rupees), reverse=True)
    return comparisons

def get_largest_transactions(db: Session, year: int, month: int, limit: int = 5) -> List[models.Transaction]:
    start_date, end_date, _ = get_month_date_range(year, month)
    return db.query(models.Transaction).filter(
        models.Transaction.transaction_date >= start_date,
        models.Transaction.transaction_date <= end_date,
        models.Transaction.transaction_type == "expense"
    ).order_by(models.Transaction.amount_paise.desc()).limit(limit).all()

def get_merchant_totals(db: Session, year: int, month: int, limit: int = 10) -> List[Dict[str, Any]]:
    start_date, end_date, _ = get_month_date_range(year, month)
    rows = db.query(
        models.Merchant.merchant_name,
        func.sum(models.Transaction.amount_paise).label("total_paise"),
        func.count(models.Transaction.transaction_id).label("count")
    ).join(
        models.Merchant, models.Transaction.merchant_id == models.Merchant.merchant_id
    ).filter(
        models.Transaction.transaction_date >= start_date,
        models.Transaction.transaction_date <= end_date,
        models.Transaction.transaction_type == "expense"
    ).group_by(models.Merchant.merchant_name).order_by(
        func.sum(models.Transaction.amount_paise).desc()
    ).limit(limit).all()

    return [
        {
            "merchant_name": r.merchant_name,
            "total_rupees": round((r.total_paise or 0) / 100.0, 2),
            "count": r.count
        }
        for r in rows
    ]
