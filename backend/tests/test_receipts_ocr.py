import io
from datetime import date
from backend.app import models, ocr

def test_ocr_parsing_heuristics():
    raw_sample = (
        "STARBUCKS COFFEE\n"
        "Store #1042 Indiranagar\n"
        "Date: 15/10/2026\n"
        "Caffe Latte 280.00\n"
        "Blueberry Muffin 220.00\n"
        "Sub Total 500.00\n"
        "GST 5% 25.00\n"
        "Total Amount: ₹525.00\n"
    )
    parsed = ocr.parse_receipt_text(raw_sample)
    assert parsed["merchant_name"] == "STARBUCKS COFFEE"
    assert parsed["transaction_date"] == date(2026, 10, 15)
    assert parsed["total_rupees"] == 525.00
    assert len(parsed["items"]) == 2
    assert parsed["items"][0]["item_name"] == "Caffe Latte"
    assert parsed["items"][0]["line_total_rupees"] == 280.00

def test_receipt_scan_and_confirm(client, db_session):
    cat = db_session.query(models.Category).first()
    pm = db_session.query(models.PaymentMethod).first()

    # Create dummy text receipt file
    content = b"CHAI POINT\nDate: 2026-10-08\nGinger Chai 120.00\nTotal: 120.00"
    file_tuple = ("receipt.png", io.BytesIO(content), "image/png")

    scan_res = client.post("/api/receipts/scan", files={"file": file_tuple})
    assert scan_res.status_code == 200
    scan_data = scan_res.json()
    assert scan_data["is_duplicate"] == False
    assert scan_data["file_id"] is not None

    # Confirm receipt transaction
    confirm_payload = {
        "file_id": scan_data["file_id"],
        "transaction_date": "2026-10-08",
        "amount_rupees": 120.0,
        "description": "Chai Point - Evening tea",
        "category_id": cat.category_id,
        "merchant_name": "Chai Point",
        "payment_method_id": pm.payment_method_id,
        "items": [
            {
                "item_name": "Ginger Chai",
                "quantity": 1.0,
                "line_total_rupees": 120.0,
                "category_id": cat.category_id
            }
        ]
    }
    confirm_res = client.post("/api/receipts/confirm", json=confirm_payload)
    assert confirm_res.status_code == 201
    confirmed_data = confirm_res.json()
    assert confirmed_data["amount_rupees"] == 120.0
    assert confirmed_data["source"] == "receipt"
