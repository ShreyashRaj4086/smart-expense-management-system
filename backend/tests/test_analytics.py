from datetime import date
from backend.app import models, crud, analytics

def test_monthly_kpi_and_comparison(client, db_session):
    food_cat = db_session.query(models.Category).filter(models.Category.category_name == "Food & Dining").first()
    pm = db_session.query(models.PaymentMethod).first()

    # September 2026: 2 transactions totaling ₹1000
    client.post("/api/transactions", json={
        "transaction_date": "2026-09-10",
        "amount_rupees": 600.0,
        "category_id": food_cat.category_id,
        "payment_method_id": pm.payment_method_id
    })
    client.post("/api/transactions", json={
        "transaction_date": "2026-09-20",
        "amount_rupees": 400.0,
        "category_id": food_cat.category_id,
        "payment_method_id": pm.payment_method_id
    })

    # October 2026: 2 transactions totaling ₹1500 (+50% increase)
    client.post("/api/transactions", json={
        "transaction_date": "2026-10-05",
        "amount_rupees": 1000.0,
        "category_id": food_cat.category_id,
        "payment_method_id": pm.payment_method_id
    })
    client.post("/api/transactions", json={
        "transaction_date": "2026-10-15",
        "amount_rupees": 500.0,
        "category_id": food_cat.category_id,
        "payment_method_id": pm.payment_method_id
    })

    # Test October KPIs
    res = client.get("/api/analytics/summary?month=2026-10")
    assert res.status_code == 200
    data = res.json()
    assert data["total_expense_rupees"] == 1500.0
    assert data["prev_month_expense_rupees"] == 1000.0
    assert data["change_rupees"] == 500.0
    assert data["percentage_change"] == 50.0
    assert data["change_type"] == "increase"
    assert data["transaction_count"] == 2

def test_zero_baseline_handling(client, db_session):
    food_cat = db_session.query(models.Category).filter(models.Category.category_name == "Food & Dining").first()
    pm = db_session.query(models.PaymentMethod).first()

    # Create transaction only in November 2026 (October has 0)
    client.post("/api/transactions", json={
        "transaction_date": "2026-11-05",
        "amount_rupees": 800.0,
        "category_id": food_cat.category_id,
        "payment_method_id": pm.payment_method_id
    })

    res = client.get("/api/analytics/summary?month=2026-11")
    assert res.status_code == 200
    data = res.json()
    assert data["total_expense_rupees"] == 800.0
    assert data["prev_month_expense_rupees"] == 0.0
    assert data["percentage_change"] is None  # Does not invent infinite %
    assert data["change_type"] == "new_spending"

def test_double_counting_prevention(client, db_session):
    # An itemized receipt of ₹500 with two ₹250 items
    food_cat = db_session.query(models.Category).filter(models.Category.category_name == "Food & Dining").first()
    pm = db_session.query(models.PaymentMethod).first()

    # Create receipt transaction
    txn = models.Transaction(
        transaction_date=date(2026, 10, 12),
        amount_paise=50000,  # ₹500
        transaction_type="expense",
        description="Restaurant Bill",
        category_id=food_cat.category_id,
        payment_method_id=pm.payment_method_id,
        source="receipt"
    )
    db_session.add(txn)
    db_session.flush()

    receipt = models.Receipt(
        transaction_id=txn.transaction_id,
        stored_path="test_path.jpg",
        original_filename="receipt.jpg",
        file_hash="dummyhash123",
        raw_ocr_text="DUMMY TEXT",
        extraction_status="success"
    )
    db_session.add(receipt)
    db_session.flush()

    # Add 2 items totaling ₹500
    db_session.add(models.ReceiptItem(
        receipt_id=receipt.receipt_id,
        item_name="Item 1",
        quantity=1.0,
        line_total_paise=25000,
        category_id=food_cat.category_id
    ))
    db_session.add(models.ReceiptItem(
        receipt_id=receipt.receipt_id,
        item_name="Item 2",
        quantity=1.0,
        line_total_paise=25000,
        category_id=food_cat.category_id
    ))
    db_session.commit()

    # Check total expenditure
    kpi = analytics.get_kpi_summary(db_session, 2026, 10)
    # Total expense must be exactly ₹500, NOT ₹500 + ₹250 + ₹250 = ₹1000!
    assert kpi.total_expense_rupees == 500.0
    assert kpi.transaction_count == 1
