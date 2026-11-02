import math
import numpy as np
from datetime import date
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func

from . import models, schemas

MIN_TRANSACTIONS_FOR_ML = 10

def detect_anomalies(db: Session, year: Optional[int] = None, month: Optional[int] = None) -> List[schemas.AnomalyItem]:
    # Fetch expense transactions
    query = db.query(models.Transaction).filter(
        models.Transaction.transaction_type == "expense"
    )

    if year and month:
        start_date = date(year, month, 1)
        import calendar
        _, last_day = calendar.monthrange(year, month)
        end_date = date(year, month, last_day)
        query = query.filter(models.Transaction.transaction_date >= start_date, models.Transaction.transaction_date <= end_date)

    txns = query.order_by(models.Transaction.transaction_date.desc()).all()
    if not txns:
        return []

    amounts = [t.amount_paise / 100.0 for t in txns]
    n = len(amounts)

    anomalies: List[schemas.AnomalyItem] = []

    # If dataset has >= MIN_TRANSACTIONS_FOR_ML, use scikit-learn Isolation Forest
    if n >= MIN_TRANSACTIONS_FOR_ML:
        try:
            from sklearn.ensemble import IsolationForest

            # Features:
            # 1. log1p of amount
            # 2. day of month
            # 3. day of week
            features = []
            for t in txns:
                amt = t.amount_paise / 100.0
                features.append([
                    math.log1p(amt),
                    t.transaction_date.day,
                    t.transaction_date.weekday()
                ])
            X = np.array(features)

            # Fit IsolationForest with reproducible seed
            clf = IsolationForest(contamination=0.08, random_state=42)
            clf.fit(X)
            preds = clf.predict(X)  # -1 for anomaly, 1 for normal
            scores = clf.decision_function(X)

            mean_amt = float(np.mean(amounts))
            median_amt = float(np.median(amounts))

            for idx, t in enumerate(txns):
                if preds[idx] == -1:
                    amt = t.amount_paise / 100.0
                    raw_score = float(scores[idx])
                    cat_name = t.category.category_name if t.category else "General"
                    merchant = t.merchant.merchant_name if t.merchant else (t.description or "Expense")

                    # Helpful explanation
                    if amt > mean_amt * 2.5:
                        reason = f"Expenditure (₹{amt:,.2f}) is significantly higher than your typical average (₹{mean_amt:,.2f})."
                    elif amt > median_amt * 2.0:
                        reason = f"Transaction amount stands out noticeably compared to regular spending patterns in {cat_name}."
                    else:
                        reason = f"Unusual purchase timing or amount frequency pattern identified for {merchant}."

                    anomalies.append(schemas.AnomalyItem(
                        transaction_id=t.transaction_id,
                        date=t.transaction_date,
                        merchant_name=merchant,
                        category_name=cat_name,
                        amount_rupees=amt,
                        score=round(float(raw_score), 4),
                        reason=reason,
                        method="isolation_forest"
                    ))
            return anomalies
        except Exception:
            # Fall back to IQR if IsolationForest throws an unexpected error
            pass

    # Statistical Fallback: Interquartile Range (IQR) / Upper Bound
    q25 = float(np.percentile(amounts, 25))
    q75 = float(np.percentile(amounts, 75))
    iqr = q75 - q25
    upper_threshold = q75 + (1.75 * iqr) if iqr > 0 else (float(np.mean(amounts)) * 2.0)

    for t in txns:
        amt = t.amount_paise / 100.0
        if amt > upper_threshold and amt > 500:  # Avoid flagging trivial expenses
            cat_name = t.category.category_name if t.category else "General"
            merchant = t.merchant.merchant_name if t.merchant else (t.description or "Expense")
            anomalies.append(schemas.AnomalyItem(
                transaction_id=t.transaction_id,
                date=t.transaction_date,
                merchant_name=merchant,
                category_name=cat_name,
                amount_rupees=amt,
                score=round(amt / upper_threshold, 2),
                reason=f"Statistical outlier: ₹{amt:,.2f} exceeds the threshold (₹{upper_threshold:,.2f}) for your recorded purchases.",
                method="statistical_iqr"
            ))

    return anomalies
