from datetime import date
from backend.app import models

def test_budget_lifecycle_and_alerts(client, db_session):
    food_cat = db_session.query(models.Category).filter(models.Category.category_name == "Food & Dining").first()
    pm = db_session.query(models.PaymentMethod).first()

    # 1. Set budget for Food & Dining = ₹2000 for October 2026
    budget_payload = {
        "category_id": food_cat.category_id,
        "month_start": "2026-10-01",
        "budget_rupees": 2000.0
    }
    b_res = client.post("/api/budgets", json=budget_payload)
    assert b_res.status_code == 201
    assert b_res.json()["budget_rupees"] == 2000.0
    assert b_res.json()["status"] == "ok"
    assert b_res.json()["remaining_rupees"] == 2000.0

    # 2. Add spending of ₹1700 (85% utilization -> warning status)
    client.post("/api/transactions", json={
        "transaction_date": "2026-10-10",
        "amount_rupees": 1700.0,
        "category_id": food_cat.category_id,
        "payment_method_id": pm.payment_method_id
    })

    list_res = client.get("/api/budgets?month=2026-10")
    assert list_res.status_code == 200
    b_data = list_res.json()[0]
    assert b_data["spent_rupees"] == 1700.0
    assert b_data["remaining_rupees"] == 300.0
    assert b_data["percentage_used"] == 85.0
    assert b_data["status"] == "warning"

    # 3. Add spending of ₹400 (total ₹2100 -> exceeded status)
    client.post("/api/transactions", json={
        "transaction_date": "2026-10-15",
        "amount_rupees": 400.0,
        "category_id": food_cat.category_id,
        "payment_method_id": pm.payment_method_id
    })

    list_res2 = client.get("/api/budgets?month=2026-10")
    b_data2 = list_res2.json()[0]
    assert b_data2["spent_rupees"] == 2100.0
    assert b_data2["remaining_rupees"] == -100.0
    assert b_data2["status"] == "exceeded"

    # 4. Delete budget
    del_res = client.delete(f"/api/budgets/{b_data2['budget_id']}")
    assert del_res.status_code == 200
    assert len(client.get("/api/budgets?month=2026-10").json()) == 0
