from datetime import date
from backend.app import models

def test_health_check(client):
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert data["database"] == "connected"

def test_create_and_get_transaction(client, db_session):
    # Fetch a seeded category and payment method
    cat = db_session.query(models.Category).first()
    pm = db_session.query(models.PaymentMethod).first()

    payload = {
        "transaction_date": "2026-10-05",
        "amount_rupees": 450.50,
        "transaction_type": "expense",
        "description": "Lunch at Udipi Cafe",
        "category_id": cat.category_id,
        "merchant_name": "Udipi Cafe",
        "payment_method_id": pm.payment_method_id,
        "source": "manual",
        "notes": "Masala dosa and coffee"
    }
    res = client.post("/api/transactions", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert data["amount_paise"] == 45050
    assert data["amount_rupees"] == 450.50
    assert data["merchant_name"] == "Udipi Cafe"
    txn_id = data["transaction_id"]

    # Retrieve
    get_res = client.get(f"/api/transactions/{txn_id}")
    assert get_res.status_code == 200
    assert get_res.json()["description"] == "Lunch at Udipi Cafe"

def test_reject_invalid_amount(client, db_session):
    cat = db_session.query(models.Category).first()
    pm = db_session.query(models.PaymentMethod).first()

    payload = {
        "transaction_date": "2026-10-05",
        "amount_rupees": -100.0,  # Negative amount rejected
        "category_id": cat.category_id,
        "payment_method_id": pm.payment_method_id
    }
    res = client.post("/api/transactions", json=payload)
    assert res.status_code == 422 or res.status_code == 400

def test_reject_invalid_foreign_key(client, db_session):
    pm = db_session.query(models.PaymentMethod).first()
    payload = {
        "transaction_date": "2026-10-05",
        "amount_rupees": 200.0,
        "category_id": 999999,  # Non-existent category
        "payment_method_id": pm.payment_method_id
    }
    res = client.post("/api/transactions", json=payload)
    assert res.status_code == 400

def test_update_and_delete_transaction(client, db_session):
    cat = db_session.query(models.Category).first()
    pm = db_session.query(models.PaymentMethod).first()

    res = client.post("/api/transactions", json={
        "transaction_date": "2026-10-01",
        "amount_rupees": 300.0,
        "description": "Initial text",
        "category_id": cat.category_id,
        "payment_method_id": pm.payment_method_id
    })
    txn_id = res.json()["transaction_id"]

    # Update
    update_res = client.put(f"/api/transactions/{txn_id}", json={
        "amount_rupees": 350.0,
        "description": "Updated text"
    })
    assert update_res.status_code == 200
    assert update_res.json()["amount_rupees"] == 350.0
    assert update_res.json()["description"] == "Updated text"

    # Delete
    del_res = client.delete(f"/api/transactions/{txn_id}")
    assert del_res.status_code == 200

    # Ensure gone
    get_res = client.get(f"/api/transactions/{txn_id}")
    assert get_res.status_code == 404
