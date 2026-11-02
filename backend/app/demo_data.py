import hashlib
from datetime import date, datetime
from typing import Dict, Any
from sqlalchemy.orm import Session

from . import models, crud

def load_demo_dataset(db: Session) -> Dict[str, Any]:
    # Ensure default categories and payment methods exist
    crud.seed_defaults(db)

    # Categories map
    cats = {c.category_name: c.category_id for c in db.query(models.Category).all()}
    # Payment methods map
    pms = {p.method_name: p.payment_method_id for p in db.query(models.PaymentMethod).all()}

    upi = pms.get("UPI", 1)
    cash = pms.get("Cash", 2)
    debit = pms.get("Debit Card", 3)
    credit = pms.get("Credit Card", 4)

    # If demo transactions already exist, do not duplicate
    existing_demo_count = db.query(models.Transaction).filter(models.Transaction.is_demo == True).count()
    if existing_demo_count > 0:
        return {"loaded": False, "message": f"Demo data already loaded ({existing_demo_count} records)."}

    # Realistic 3-month dataset (August, September, October 2026)
    demo_transactions = [
        # --- August 2026 ---
        {"date": date(2026, 8, 2), "cat": "Groceries", "merchant": "D-Mart", "desc": "Monthly pantry & household groceries", "amt": 3450.00, "pm": debit},
        {"date": date(2026, 8, 4), "cat": "Transportation", "merchant": "Namma Metro", "desc": "Smart card monthly pass recharge", "amt": 600.00, "pm": upi},
        {"date": date(2026, 8, 6), "cat": "Food & Dining", "merchant": "Swiggy", "desc": "Dinner order - Biryani & Paneer", "amt": 580.00, "pm": upi},
        {"date": date(2026, 8, 9), "cat": "Snacks & Beverages", "merchant": "Chai Point", "desc": "Ginger chai and bun maska", "amt": 160.00, "pm": upi},
        {"date": date(2026, 8, 12), "cat": "Bills & Utilities", "merchant": "BESCOM", "desc": "Electricity bill payment", "amt": 1420.00, "pm": upi},
        {"date": date(2026, 8, 14), "cat": "Subscriptions", "merchant": "Netflix", "desc": "Standard HD monthly plan", "amt": 499.00, "pm": credit},
        {"date": date(2026, 8, 16), "cat": "Education", "merchant": "Sapna Book House", "desc": "Database systems reference textbook", "amt": 850.00, "pm": debit},
        {"date": date(2026, 8, 19), "cat": "Snacks & Beverages", "merchant": "Samosa Party", "desc": "Evening snacks with classmates", "amt": 240.00, "pm": cash},
        {"date": date(2026, 8, 22), "cat": "Shopping", "merchant": "Decathlon", "desc": "Sports water bottle and running socks", "amt": 799.00, "pm": debit},
        {"date": date(2026, 8, 25), "cat": "Groceries", "merchant": "Blinkit", "desc": "Fruits, oats, and dairy essentials", "amt": 620.00, "pm": upi},
        {"date": date(2026, 8, 28), "cat": "Food & Dining", "merchant": "Zomato", "desc": "Weekend family lunch delivery", "amt": 980.00, "pm": upi},
        {"date": date(2026, 8, 30), "cat": "Transportation", "merchant": "Shell Petrol Bunk", "desc": "Two-wheeler full tank fuel", "amt": 750.00, "pm": upi},

        # --- September 2026 ---
        {"date": date(2026, 9, 1), "cat": "Bills & Utilities", "merchant": "ACT Fibernet", "desc": "150 Mbps Broadband monthly bill", "amt": 825.00, "pm": upi},
        {"date": date(2026, 9, 3), "cat": "Groceries", "merchant": "D-Mart", "desc": "Staples, cooking oil, and pulses", "amt": 3890.00, "pm": debit},
        {"date": date(2026, 9, 5), "cat": "Food & Dining", "merchant": "Meghna Biryani", "desc": "Lunch with friends", "amt": 720.00, "pm": upi},
        {"date": date(2026, 9, 8), "cat": "Snacks & Beverages", "merchant": "Blue Tokai Coffee", "desc": "Pour-over coffee & croissant", "amt": 340.00, "pm": debit},
        {"date": date(2026, 9, 11), "cat": "Transportation", "merchant": "Uber", "desc": "Auto ride to tech conference", "amt": 220.00, "pm": upi},
        {"date": date(2026, 9, 14), "cat": "Subscriptions", "merchant": "Spotify", "desc": "Student individual premium plan", "amt": 59.00, "pm": credit},
        {"date": date(2026, 9, 17), "cat": "Education", "merchant": "Coursera", "desc": "Database administration course exam", "amt": 2499.00, "pm": credit},
        {"date": date(2026, 9, 20), "cat": "Shopping", "merchant": "Amazon India", "desc": "Ergonomic laptop stand & mousepad", "amt": 1250.00, "pm": credit},
        {"date": date(2026, 9, 23), "cat": "Food & Dining", "merchant": "Swiggy", "desc": "Dinner order - Dosa & Filter Coffee", "amt": 390.00, "pm": upi},
        {"date": date(2026, 9, 25), "cat": "Snacks & Beverages", "merchant": "Chai Point", "desc": "Ginger lemon tea & banana cake", "amt": 210.00, "pm": upi},
        {"date": date(2026, 9, 27), "cat": "Groceries", "merchant": "Zepto", "desc": "Quick groceries & snacks delivery", "amt": 480.00, "pm": upi},
        {"date": date(2026, 9, 29), "cat": "Transportation", "merchant": "Shell Petrol Bunk", "desc": "Vehicle fuel top up", "amt": 800.00, "pm": upi},

        # --- October 2026 ---
        {"date": date(2026, 10, 1), "cat": "Bills & Utilities", "merchant": "BESCOM", "desc": "Monthly electricity utility payment", "amt": 1380.00, "pm": upi},
        {"date": date(2026, 10, 2), "cat": "Groceries", "merchant": "Nature's Basket", "desc": "Organic groceries, fruits & grains", "amt": 4250.00, "pm": debit},
        {"date": date(2026, 10, 3), "cat": "Snacks & Beverages", "merchant": "Third Wave Coffee", "desc": "Cold brew coffee & pastry", "amt": 410.00, "pm": upi},
        {"date": date(2026, 10, 5), "cat": "Food & Dining", "merchant": "Truffles", "desc": "Burger and fries lunch combo", "amt": 650.00, "pm": upi},
        {"date": date(2026, 10, 6), "cat": "Transportation", "merchant": "Uber", "desc": "Cab ride from university campus", "amt": 310.00, "pm": upi},
        {"date": date(2026, 10, 8), "cat": "Shopping", "merchant": "Uniqlo", "desc": "Casual cotton shirts & trousers", "amt": 3990.00, "pm": credit},
        {"date": date(2026, 10, 9), "cat": "Snacks & Beverages", "merchant": "Chai Point", "desc": "Masala chai flask for project study group", "amt": 380.00, "pm": upi},
        {"date": date(2026, 10, 10), "cat": "Food & Dining", "merchant": "Swiggy", "desc": "Late night pizza delivery", "amt": 740.00, "pm": upi},
        {"date": date(2026, 10, 11), "cat": "Groceries", "merchant": "Blinkit", "desc": "Fresh milk, brown bread & snacks", "amt": 395.00, "pm": upi},
    ]

    txns_created = 0
    for item in demo_transactions:
        merchant = crud.get_or_create_merchant(db, item["merchant"])
        cat_id = cats.get(item["cat"])
        amount_paise = int(round(item["amt"] * 100))

        db_txn = models.Transaction(
            transaction_date=item["date"],
            amount_paise=amount_paise,
            transaction_type="expense",
            description=item["desc"],
            category_id=cat_id,
            merchant_id=merchant.merchant_id if merchant else None,
            payment_method_id=item["pm"],
            source="manual",
            is_demo=True,
            notes="Seeded demo expenditure record"
        )
        db.add(db_txn)
        txns_created += 1

    db.flush()

    # Create 2 itemized demo receipts to demonstrate receipt itemization
    # Receipt 1: Cafe receipt
    cafe_merchant = crud.get_or_create_merchant(db, "Blue Tokai Coffee Roasters")
    snack_cat_id = cats.get("Snacks & Beverages")
    receipt_1_txn = models.Transaction(
        transaction_date=date(2026, 10, 4),
        amount_paise=61000,  # ₹610.00
        transaction_type="expense",
        description="Blue Tokai Coffee - Scanned Receipt",
        category_id=snack_cat_id,
        merchant_id=cafe_merchant.merchant_id,
        payment_method_id=upi,
        source="receipt",
        is_demo=True,
        notes="Itemized demo receipt"
    )
    db.add(receipt_1_txn)
    db.flush()

    raw_text_1 = (
        "BLUE TOKAI COFFEE ROASTERS\n"
        "Indiranagar, Bengaluru\n"
        "Date: 04-10-2026\n"
        "Flat White (Regular) 240.00\n"
        "Almond Croissant 210.00\n"
        "Iced Americano 160.00\n"
        "Subtotal: 610.00\n"
        "Total Amount: ₹610.00\n"
        "Payment: UPI\n"
    )

    r1 = models.Receipt(
        transaction_id=receipt_1_txn.transaction_id,
        stored_path="demo_receipt_bluetokai.jpg",
        original_filename="blue_tokai_bill.jpg",
        file_hash=hashlib.sha256(raw_text_1.encode()).hexdigest(),
        raw_ocr_text=raw_text_1,
        extraction_status="success"
    )
    db.add(r1)
    db.flush()

    db.add(models.ReceiptItem(receipt_id=r1.receipt_id, item_name="Flat White (Regular)", quantity=1.0, unit_price_paise=24000, line_total_paise=24000, category_id=snack_cat_id, confidence_score=0.95))
    db.add(models.ReceiptItem(receipt_id=r1.receipt_id, item_name="Almond Croissant", quantity=1.0, unit_price_paise=21000, line_total_paise=21000, category_id=snack_cat_id, confidence_score=0.92))
    db.add(models.ReceiptItem(receipt_id=r1.receipt_id, item_name="Iced Americano", quantity=1.0, unit_price_paise=16000, line_total_paise=16000, category_id=snack_cat_id, confidence_score=0.94))

    # Receipt 2: Supermarket receipt
    super_merchant = crud.get_or_create_merchant(db, "Nature's Basket")
    groc_cat_id = cats.get("Groceries")
    receipt_2_txn = models.Transaction(
        transaction_date=date(2026, 10, 7),
        amount_paise=89500,  # ₹895.00
        transaction_type="expense",
        description="Nature's Basket Grocery - Scanned Receipt",
        category_id=groc_cat_id,
        merchant_id=super_merchant.merchant_id,
        payment_method_id=debit,
        source="receipt",
        is_demo=True,
        notes="Itemized demo receipt"
    )
    db.add(receipt_2_txn)
    db.flush()

    raw_text_2 = (
        "NATURE'S BASKET\n"
        "Koramangala Store\n"
        "Date: 07-10-2026\n"
        "Greek Yogurt 180.00\n"
        "Rolled Oats 1kg 320.00\n"
        "Almond Milk 1L 295.00\n"
        "Dark Chocolate 100.00\n"
        "Grand Total: ₹895.00\n"
        "Mode: Debit Card\n"
    )

    r2 = models.Receipt(
        transaction_id=receipt_2_txn.transaction_id,
        stored_path="demo_receipt_naturesbasket.jpg",
        original_filename="natures_basket_receipt.jpg",
        file_hash=hashlib.sha256(raw_text_2.encode()).hexdigest(),
        raw_ocr_text=raw_text_2,
        extraction_status="success"
    )
    db.add(r2)
    db.flush()

    db.add(models.ReceiptItem(receipt_id=r2.receipt_id, item_name="Greek Yogurt", quantity=1.0, unit_price_paise=18000, line_total_paise=18000, category_id=groc_cat_id, confidence_score=0.96))
    db.add(models.ReceiptItem(receipt_id=r2.receipt_id, item_name="Rolled Oats 1kg", quantity=1.0, unit_price_paise=32000, line_total_paise=32000, category_id=groc_cat_id, confidence_score=0.95))
    db.add(models.ReceiptItem(receipt_id=r2.receipt_id, item_name="Almond Milk 1L", quantity=1.0, unit_price_paise=29500, line_total_paise=29500, category_id=groc_cat_id, confidence_score=0.93))
    db.add(models.ReceiptItem(receipt_id=r2.receipt_id, item_name="Dark Chocolate", quantity=1.0, unit_price_paise=10000, line_total_paise=10000, category_id=snack_cat_id, confidence_score=0.90))

    # Seed Budgets for October 2026
    oct_1 = date(2026, 10, 1)
    budgets_to_seed = [
        ("Food & Dining", 4000.00),
        ("Snacks & Beverages", 1800.00),
        ("Groceries", 6000.00),
        ("Transportation", 2500.00),
        ("Shopping", 5000.00),
        ("Bills & Utilities", 3000.00)
    ]
    for b_cat, b_amt in budgets_to_seed:
        c_id = cats.get(b_cat)
        if c_id:
            existing_b = db.query(models.Budget).filter(
                models.Budget.category_id == c_id,
                models.Budget.month_start == oct_1
            ).first()
            if not existing_b:
                db.add(models.Budget(
                    category_id=c_id,
                    month_start=oct_1,
                    budget_paise=int(round(b_amt * 100))
                ))

    db.commit()
    return {
        "loaded": True,
        "transactions_seeded": txns_created + 2,
        "receipts_seeded": 2,
        "message": f"Successfully loaded demo dataset with {txns_created + 2} transactions, 2 itemized receipts, and monthly budgets across August-October 2026."
    }

def clear_demo_dataset(db: Session) -> Dict[str, Any]:
    # Only delete transactions where is_demo == True
    demo_txns = db.query(models.Transaction).filter(models.Transaction.is_demo == True).all()
    count = len(demo_txns)
    for t in demo_txns:
        db.delete(t)
    db.commit()
    return {
        "cleared": True,
        "deleted_count": count,
        "message": f"Successfully removed {count} demo records. All user transactions remain intact."
    }
