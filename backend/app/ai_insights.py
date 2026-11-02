import json
import logging
import httpx
from datetime import date
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session

from .config import OLLAMA_BASE_URL, OLLAMA_MODEL
from . import models, schemas, analytics, crud

logger = logging.getLogger("spendwise.ai")

def resolve_best_model(configured_model: str, models_list: List[str]) -> Tuple[str, bool]:
    """Resolves configured model against installed models or picks best lightweight text model."""
    if not models_list:
        return configured_model, False
    # Exclude vision/multimodal models from text completion (e.g. mllama architecture)
    text_models = [m for m in models_list if "vision" not in m.lower() and "vl" not in m.lower()]
    candidate_pool = text_models if text_models else models_list

    # Priority fallbacks for local lightweight text models
    preferred = ["gemma3:4b", "qwen3:4b", "gemma4:e4b", "gemma4:12b", "qwen3.6-35b:latest", "llama3.2", "llama3"]
    for p in preferred:
        for m in candidate_pool:
            if p in m.lower():
                return m, True
    return candidate_pool[0], True

async def check_ollama_status() -> Dict[str, Any]:
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            resp = await client.get(f"{OLLAMA_BASE_URL}/api/tags")
            if resp.status_code == 200:
                data = resp.json()
                models_list = [m.get("name") for m in data.get("models", [])]
                active_model, model_present = resolve_best_model(OLLAMA_MODEL, models_list)
                return {
                    "available": True,
                    "url": OLLAMA_BASE_URL,
                    "configured_model": active_model,
                    "available_models": models_list,
                    "model_installed": model_present,
                    "message": f"Ollama is running with {len(models_list)} models available. Active: {active_model}."
                }
    except Exception as e:
        logger.debug(f"Ollama check failed: {e}")

    return {
        "available": False,
        "url": OLLAMA_BASE_URL,
        "configured_model": OLLAMA_MODEL,
        "available_models": [],
        "model_installed": False,
        "message": (
            "Ollama is not running locally. SpendWise is operating in deterministic SQL insight mode. "
            "To use local LLM: run 'ollama serve' in a terminal and ensure http://127.0.0.1:11434 is active."
        )
    }

def generate_deterministic_insights(
    kpi: schemas.KPISummary,
    categories: List[schemas.CategorySpend],
    comparisons: List[schemas.CategoryComparison],
    budgets: List[schemas.BudgetResponse]
) -> List[schemas.InsightCard]:
    cards: List[schemas.InsightCard] = []

    # 1. Month-over-Month Overview Insight
    if kpi.change_type == "increase" and kpi.percentage_change:
        cards.append(schemas.InsightCard(
            id="mom_increase",
            title="Monthly Expenditure Increase",
            category="Overview",
            text=(
                f"Your overall spending is ₹{kpi.total_expense_rupees:,.2f}, an increase of "
                f"₹{kpi.change_rupees:,.2f} (+{kpi.percentage_change:.1f}%) compared to the previous month (₹{kpi.prev_month_expense_rupees:,.2f}). "
                f"Consider reviewing your top discretionary categories."
            ),
            type="warning",
            metric_basis=f"+{kpi.percentage_change:.1f}% vs last month",
            is_ai_generated=False
        ))
    elif kpi.change_type == "decrease" and kpi.percentage_change:
        cards.append(schemas.InsightCard(
            id="mom_decrease",
            title="Monthly Spending Reduced",
            category="Overview",
            text=(
                f"Great progress! You have spent ₹{abs(kpi.change_rupees):,.2f} less (-{abs(kpi.percentage_change):.1f}%) "
                f"than last month. Total expense stands at ₹{kpi.total_expense_rupees:,.2f}."
            ),
            type="tip",
            metric_basis=f"{kpi.percentage_change:.1f}% vs last month",
            is_ai_generated=False
        ))
    elif kpi.change_type == "new_spending":
        cards.append(schemas.InsightCard(
            id="mom_new",
            title="Initial Expenditure Recorded",
            category="Overview",
            text=f"Total spending recorded this month is ₹{kpi.total_expense_rupees:,.2f}. No prior month baseline was recorded.",
            type="info",
            metric_basis="New recording period",
            is_ai_generated=False
        ))

    # 2. Dominant Category Insight
    if categories:
        top_cat = categories[0]
        if top_cat.percentage >= 35.0:
            cards.append(schemas.InsightCard(
                id="top_cat_dominance",
                title=f"High Concentration in {top_cat.category_name}",
                category=top_cat.category_name,
                text=(
                    f"{top_cat.category_name} accounts for {top_cat.percentage:.1f}% of your total spending "
                    f"(₹{top_cat.amount_rupees:,.2f} across {top_cat.transaction_count} transaction{'s' if top_cat.transaction_count > 1 else ''})."
                ),
                type="info",
                metric_basis=f"{top_cat.percentage:.1f}% of monthly budget",
                is_ai_generated=False
            ))

    # 3. Notable Category Shift Insight
    for comp in comparisons:
        if comp.status == "increased" and comp.difference_rupees >= 300 and comp.percentage_change:
            cards.append(schemas.InsightCard(
                id=f"cat_spike_{comp.category_id}",
                title=f"Spending Surge in {comp.category_name}",
                category=comp.category_name,
                text=(
                    f"Your {comp.category_name.lower()} expenditure increased by ₹{comp.difference_rupees:,.2f} "
                    f"(+{comp.percentage_change:.1f}%) compared with the previous month. Review transaction history "
                    f"to identify whether larger purchases or higher frequency drove the increase."
                ),
                type="warning",
                metric_basis=f"+₹{comp.difference_rupees:,.2f} (+{comp.percentage_change:.1f}%)",
                is_ai_generated=False
            ))
            break

    # 4. Budget Alert Insight
    for b in budgets:
        if b.status == "exceeded":
            cards.append(schemas.InsightCard(
                id=f"budget_exceeded_{b.budget_id}",
                title=f"Budget Exceeded: {b.category_name}",
                category=b.category_name,
                text=(
                    f"You have spent ₹{b.spent_rupees:,.2f} on {b.category_name}, exceeding your "
                    f"monthly budget limit of ₹{b.budget_rupees:,.2f} by ₹{abs(b.remaining_rupees):,.2f} ({b.percentage_used:.1f}% utilized)."
                ),
                type="alert",
                metric_basis=f"{b.percentage_used:.1f}% utilized",
                is_ai_generated=False
            ))
            break
        elif b.status == "warning":
            cards.append(schemas.InsightCard(
                id=f"budget_warn_{b.budget_id}",
                title=f"Approaching Limit: {b.category_name}",
                category=b.category_name,
                text=(
                    f"{b.percentage_used:.1f}% of your {b.category_name} budget has been spent. "
                    f"Only ₹{b.remaining_rupees:,.2f} remains for the rest of the month."
                ),
                type="warning",
                metric_basis=f"{b.percentage_used:.1f}% utilized",
                is_ai_generated=False
            ))
            break

    # 5. Daily Pace Insight
    if kpi.avg_daily_rupees > 0:
        cards.append(schemas.InsightCard(
            id="daily_pace",
            title="Daily Spending Pace",
            category="Pacing",
            text=f"Your average expenditure is ₹{kpi.avg_daily_rupees:,.2f} per day across {kpi.transaction_count} recorded purchases.",
            type="info",
            metric_basis=f"₹{kpi.avg_daily_rupees:,.2f}/day",
            is_ai_generated=False
        ))

    return cards

def answer_question_deterministically(
    user_question: str,
    comparisons: List[schemas.CategoryComparison],
    curr_txns: list,
    prev_txns: list
) -> Optional[str]:
    """Answers specific questions (e.g. food increase) using verified relational data without LLM."""
    q = user_question.lower()
    for comp in comparisons:
        cat_lower = comp.category_name.lower()
        words = [w for w in cat_lower.replace("&", " ").split() if len(w) > 2]
        if any(w in q for w in words) or ("food" in q and "food" in cat_lower) or ("snack" in q and "snack" in cat_lower) or ("grocer" in q and "grocer" in cat_lower):
            cat_curr = [t for t in curr_txns if t.category and t.category.category_id == comp.category_id]
            merchants = [f"{t.merchant.merchant_name if t.merchant else 'Store'} (₹{t.amount_paise / 100.0:,.2f})" for t in cat_curr[:2]]
            merchant_str = f", primarily driven by {', '.join(merchants)}" if merchants else ""

            if comp.status == "increased":
                pct = f"+{comp.percentage_change:.1f}%" if comp.percentage_change else "N/A"
                return (
                    f"Your {comp.category_name} spending increased by ₹{comp.difference_rupees:,.2f} ({pct}) from "
                    f"₹{comp.prev_rupees:,.2f} in the previous month to ₹{comp.current_rupees:,.2f} this month{merchant_str}."
                )
            elif comp.status == "decreased":
                pct = f"{comp.percentage_change:.1f}%" if comp.percentage_change else "N/A"
                return (
                    f"Your {comp.category_name} spending decreased by ₹{abs(comp.difference_rupees):,.2f} ({pct}) from "
                    f"₹{comp.prev_rupees:,.2f} in the previous month to ₹{comp.current_rupees:,.2f} this month."
                )
            else:
                return f"Your {comp.category_name} spending this month is ₹{comp.current_rupees:,.2f} across {len(cat_curr)} purchases{merchant_str}."

    for t in curr_txns:
        if t.merchant and t.merchant.merchant_name.lower() in q and len(t.merchant.merchant_name) > 3:
            m_name = t.merchant.merchant_name
            total_m = sum(x.amount_paise / 100.0 for x in curr_txns if x.merchant and x.merchant.merchant_name == m_name)
            cnt = sum(1 for x in curr_txns if x.merchant and x.merchant.merchant_name == m_name)
            return f"You spent a total of ₹{total_m:,.2f} at {m_name} across {cnt} purchase{'s' if cnt > 1 else ''} this month."

    return None

async def get_ai_explanation(
    db: Session,
    year: int,
    month: int,
    user_question: Optional[str] = None
) -> schemas.AIExplainResponse:
    # 1. Compute verified statistics from database
    kpi = analytics.get_kpi_summary(db, year, month)
    categories = analytics.get_category_spending(db, year, month)
    comparisons = analytics.get_category_comparison(db, year, month)
    
    start_date = date(year, month, 1)
    last_day = 31 if month in [1, 3, 5, 7, 8, 10, 12] else (28 if month == 2 else 30)
    end_date = date(year, month, last_day)

    prev_year, prev_month = (year - 1, 12) if month == 1 else (year, month - 1)
    prev_start = date(prev_year, prev_month, 1)
    prev_last_day = 31 if prev_month in [1, 3, 5, 7, 8, 10, 12] else (28 if prev_month == 2 else 30)
    prev_end = date(prev_year, prev_month, prev_last_day)

    curr_txns = db.query(models.Transaction).filter(
        models.Transaction.transaction_date >= start_date,
        models.Transaction.transaction_date <= end_date
    ).order_by(models.Transaction.amount_paise.desc()).all()

    prev_txns = db.query(models.Transaction).filter(
        models.Transaction.transaction_date >= prev_start,
        models.Transaction.transaction_date <= prev_end
    ).order_by(models.Transaction.amount_paise.desc()).all()

    budgets = crud.get_budgets_for_month(db, start_date)

    # 2. Check Ollama availability and resolve active installed model
    ollama_info = await check_ollama_status()
    active_model = ollama_info.get("configured_model") or OLLAMA_MODEL

    # 3. If Ollama is available, query with rich transaction context
    if ollama_info["available"]:
        try:
            category_details = []
            for comp in comparisons:
                c_curr = [
                    {
                        "date": str(t.transaction_date),
                        "merchant": t.merchant.merchant_name if t.merchant else "Unknown",
                        "amount_inr": t.amount_paise / 100.0,
                        "description": t.description or ""
                    }
                    for t in curr_txns if t.category and t.category.category_id == comp.category_id
                ]
                c_prev = [
                    {
                        "date": str(t.transaction_date),
                        "merchant": t.merchant.merchant_name if t.merchant else "Unknown",
                        "amount_inr": t.amount_paise / 100.0,
                        "description": t.description or ""
                    }
                    for t in prev_txns if t.category and t.category.category_id == comp.category_id
                ]
                category_details.append({
                    "category": comp.category_name,
                    "current_month_inr": comp.current_rupees,
                    "prev_month_inr": comp.prev_rupees,
                    "difference_inr": comp.difference_rupees,
                    "percentage_change": f"{comp.percentage_change:+.1f}%" if comp.percentage_change is not None else "N/A",
                    "status": comp.status,
                    "current_month_purchases": c_curr,
                    "prev_month_purchases": c_prev
                })

            stats_payload = {
                "month": f"{year:04d}-{month:02d}",
                "total_expense_inr": kpi.total_expense_rupees,
                "prev_month_expense_inr": kpi.prev_month_expense_rupees,
                "overall_difference_inr": kpi.change_rupees,
                "overall_percentage_change": f"{kpi.percentage_change:+.1f}%" if kpi.percentage_change is not None else "N/A",
                "avg_daily_inr": kpi.avg_daily_rupees,
                "transaction_count": kpi.transaction_count,
                "all_category_comparisons_and_purchases": category_details
            }

            system_prompt = (
                "You are SpendWise AI, an expert, objective financial expenditure assistant.\n"
                "Analyze only the verified mathematical statistics and purchase records provided in JSON.\n"
                "Always use Indian Rupee (₹) symbol for currency. Never invent amounts, transactions, or percentages.\n"
                "When answering a question about an expenditure or category increase (e.g. food, shopping, snacks), "
                "explicitly identify the exact category difference in ₹, percentage change, and the specific merchants or purchases that contributed to the increase.\n"
                "Be concise, factual, direct, and constructive (2-3 sentences)."
            )

            prompt = (
                f"Financial Data for {year:04d}-{month:02d}:\n"
                f"{json.dumps(stats_payload, indent=2)}\n\n"
                f"User Question: {user_question or 'Summarize my spending and highlight any notable changes.'}\n\n"
                f"Provide concise, factual financial insight based strictly on these numbers."
            )

            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.post(
                    f"{OLLAMA_BASE_URL}/api/generate",
                    json={
                        "model": active_model,
                        "system": system_prompt,
                        "prompt": prompt,
                        "stream": False
                    }
                )
                if res.status_code == 200:
                    data = res.json()
                    summary_text = data.get("response", "").strip()
                    if summary_text:
                        det_insights = generate_deterministic_insights(kpi, categories, comparisons, budgets)
                        ai_card = schemas.InsightCard(
                            id="ai_summary",
                            title=f"Local AI Analysis ({active_model})",
                            category="AI Synthesis",
                            text=summary_text,
                            type="info",
                            metric_basis="Ollama Local LLM",
                            is_ai_generated=True
                        )
                        return schemas.AIExplainResponse(
                            insights=[ai_card] + det_insights,
                            ai_available=True,
                            model_name=active_model,
                            mode="ollama_local",
                            summary_text=summary_text
                        )
        except Exception as e:
            logger.warning(f"Ollama generation failed, falling back to deterministic: {e}")

    # Fallback mode: deterministic SQL insights
    det_insights = generate_deterministic_insights(kpi, categories, comparisons, budgets)
    
    # If user asked a specific question, generate targeted deterministic answer
    targeted_answer = answer_question_deterministically(user_question, comparisons, curr_txns, prev_txns) if user_question else None
    
    if targeted_answer:
        fallback_summary = targeted_answer
    else:
        fallback_summary = (
            f"In {date(year, month, 1).strftime('%B %Y')}, you recorded ₹{kpi.total_expense_rupees:,.2f} across "
            f"{kpi.transaction_count} expenses (avg ₹{kpi.avg_daily_rupees:,.2f}/day). "
        )
        if kpi.change_type == "increase" and kpi.percentage_change:
            fallback_summary += f"Spending rose by ₹{kpi.change_rupees:,.2f} (+{kpi.percentage_change:.1f}%) from the previous month."
        elif kpi.change_type == "decrease" and kpi.percentage_change:
            fallback_summary += f"Spending fell by ₹{abs(kpi.change_rupees):,.2f} (-{abs(kpi.percentage_change):.1f}%) from the previous month."

    return schemas.AIExplainResponse(
        insights=det_insights,
        ai_available=False,
        model_name="Deterministic SQL Heuristics",
        mode="deterministic_fallback",
        summary_text=fallback_summary
    )
