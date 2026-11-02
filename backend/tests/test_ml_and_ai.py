from datetime import date
from backend.app import models, ml_anomaly, ai_insights

def test_anomaly_detection_isolation_forest(db_session):
    cat = db_session.query(models.Category).first()
    pm = db_session.query(models.PaymentMethod).first()

    # Generate 15 regular expenses around ₹150 - ₹300
    for day in range(1, 16):
        db_session.add(models.Transaction(
            transaction_date=date(2026, 10, day),
            amount_paise=(150 + (day * 10)) * 100,
            transaction_type="expense",
            category_id=cat.category_id,
            payment_method_id=pm.payment_method_id,
            source="manual"
        ))

    # Add 1 huge outlier expense of ₹15,000
    db_session.add(models.Transaction(
        transaction_date=date(2026, 10, 16),
        amount_paise=1500000,
        transaction_type="expense",
        category_id=cat.category_id,
        payment_method_id=pm.payment_method_id,
        source="manual"
    ))
    db_session.commit()

    anomalies = ml_anomaly.detect_anomalies(db_session, 2026, 10)
    assert len(anomalies) > 0
    # Outlier must be detected
    outlier = next((a for a in anomalies if a.amount_rupees == 15000.0), None)
    assert outlier is not None
    assert outlier.method == "isolation_forest"
    assert "higher" in outlier.reason.lower() or "stands out" in outlier.reason.lower() or "pattern" in outlier.reason.lower()

def test_anomaly_detection_small_data_fallback(db_session):
    cat = db_session.query(models.Category).first()
    pm = db_session.query(models.PaymentMethod).first()

    # Only 4 transactions (< 10)
    for amt in [200, 250, 300, 3000]:
        db_session.add(models.Transaction(
            transaction_date=date(2026, 10, 5),
            amount_paise=amt * 100,
            transaction_type="expense",
            category_id=cat.category_id,
            payment_method_id=pm.payment_method_id,
            source="manual"
        ))
    db_session.commit()

    anomalies = ml_anomaly.detect_anomalies(db_session, 2026, 10)
    # The ₹3000 expense should be caught by statistical IQR fallback
    assert any(a.amount_rupees == 3000.0 for a in anomalies)

def test_ai_status_and_deterministic_fallback(client, db_session):
    # Test AI status endpoint
    status_res = client.get("/api/ai/status")
    assert status_res.status_code == 200
    data = status_res.json()
    assert "available" in data
    assert "configured_model" in data

    # Test explain endpoint (will return honest deterministic fallback if Ollama is not active)
    explain_res = client.post("/api/ai/explain", json={"month": "2026-10"})
    assert explain_res.status_code == 200
    explain_data = explain_res.json()
    assert explain_data["mode"] in ("ollama_local", "deterministic_fallback")
    assert len(explain_data["insights"]) >= 0
    assert "summary_text" in explain_data
