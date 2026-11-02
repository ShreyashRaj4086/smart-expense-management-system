from datetime import date
from backend.app import models

def test_demo_data_load_and_safe_clear(client, db_session):
    cat = db_session.query(models.Category).first()
    pm = db_session.query(models.PaymentMethod).first()

    # User creates a real transaction
    client.post("/api/transactions", json={
        "transaction_date": "2026-10-01",
        "amount_rupees": 999.0,
        "description": "User real transaction",
        "category_id": cat.category_id,
        "payment_method_id": pm.payment_method_id
    })
    initial_user_txns = db_session.query(models.Transaction).filter(models.Transaction.is_demo == False).count()
    assert initial_user_txns == 1

    # Load Demo Data
    load_res = client.post("/api/system/demo/load")
    assert load_res.status_code == 200
    assert load_res.json()["loaded"] == True

    # Verify transactions increased
    total_txns = db_session.query(models.Transaction).count()
    demo_txns = db_session.query(models.Transaction).filter(models.Transaction.is_demo == True).count()
    assert demo_txns > 20
    assert total_txns == initial_user_txns + demo_txns

    # Clear Demo Data
    clear_res = client.post("/api/system/demo/clear")
    assert clear_res.status_code == 200
    assert clear_res.json()["cleared"] == True

    # User's transaction must remain completely intact!
    remaining_txns = db_session.query(models.Transaction).all()
    assert len(remaining_txns) == 1
    assert remaining_txns[0].description == "User real transaction"

def test_csv_export(client, db_session):
    cat = db_session.query(models.Category).first()
    pm = db_session.query(models.PaymentMethod).first()

    client.post("/api/transactions", json={
        "transaction_date": "2026-10-02",
        "amount_rupees": 750.0,
        "description": "Test Export Item",
        "category_id": cat.category_id,
        "payment_method_id": pm.payment_method_id
    })

    res = client.get("/api/export/transactions")
    assert res.status_code == 200
    assert res.headers["content-type"] == "text/csv; charset=utf-8"
    assert "Test Export Item" in res.text
    assert "Transaction ID,Date,Amount (INR)" in res.text

def test_category_referential_integrity(client, db_session):
    cat = db_session.query(models.Category).first()
    pm = db_session.query(models.PaymentMethod).first()

    # Create transaction in this category
    client.post("/api/transactions", json={
        "transaction_date": "2026-10-02",
        "amount_rupees": 100.0,
        "category_id": cat.category_id,
        "payment_method_id": pm.payment_method_id
    })

    # Attempt to delete referenced category without reassignment -> should be blocked!
    del_res = client.delete(f"/api/categories/{cat.category_id}")
    assert del_res.status_code == 400
    assert "referenced by" in del_res.json()["detail"].lower()
