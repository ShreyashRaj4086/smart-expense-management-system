import re
from datetime import date, datetime
from typing import Optional, List, Tuple
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, and_, func

from . import models, schemas

# --- Default Seeding ---
DEFAULT_CATEGORIES = [
    "Food & Dining",
    "Snacks & Beverages",
    "Groceries",
    "Transportation",
    "Shopping",
    "Education",
    "Entertainment",
    "Health",
    "Bills & Utilities",
    "Subscriptions",
    "Personal Care",
    "Travel",
    "Other"
]

DEFAULT_PAYMENT_METHODS = [
    "UPI",
    "Cash",
    "Debit Card",
    "Credit Card",
    "Bank Transfer",
    "Other"
]

def seed_defaults(db: Session):
    # Seed payment methods
    existing_methods = {pm.method_name for pm in db.query(models.PaymentMethod).all()}
    for pm_name in DEFAULT_PAYMENT_METHODS:
        if pm_name not in existing_methods:
            db.add(models.PaymentMethod(method_name=pm_name))
    
    # Seed categories
    existing_cats = {c.category_name for c in db.query(models.Category).all()}
    for cat_name in DEFAULT_CATEGORIES:
        if cat_name not in existing_cats:
            db.add(models.Category(category_name=cat_name))
    
    db.commit()


# --- Merchants ---
def normalize_merchant_name(name: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9\s]", "", name).strip().lower()
    return " ".join(cleaned.split())

def get_or_create_merchant(db: Session, merchant_name: Optional[str]) -> Optional[models.Merchant]:
    if not merchant_name or not merchant_name.strip():
        return None
    name = merchant_name.strip()
    norm = normalize_merchant_name(name)
    if not norm:
        return None
    
    merchant = db.query(models.Merchant).filter(models.Merchant.normalized_name == norm).first()
    if not merchant:
        merchant = models.Merchant(merchant_name=name, normalized_name=norm)
        db.add(merchant)
        db.flush()
    return merchant


# --- Categories ---
def get_categories(db: Session) -> List[models.Category]:
    return db.query(models.Category).order_by(models.Category.category_name.asc()).all()

def get_category_by_id(db: Session, category_id: int) -> Optional[models.Category]:
    return db.query(models.Category).filter(models.Category.category_id == category_id).first()

def create_category(db: Session, cat: schemas.CategoryCreate) -> models.Category:
    existing = db.query(models.Category).filter(
        func.lower(models.Category.category_name) == cat.category_name.strip().lower()
    ).first()
    if existing:
        raise ValueError(f"Category '{cat.category_name}' already exists.")
    
    db_cat = models.Category(
        category_name=cat.category_name.strip(),
        parent_category_id=cat.parent_category_id
    )
    db.add(db_cat)
    db.commit()
    db.refresh(db_cat)
    return db_cat

def update_category(db: Session, category_id: int, cat: schemas.CategoryUpdate) -> Optional[models.Category]:
    db_cat = get_category_by_id(db, category_id)
    if not db_cat:
        return None
    if cat.category_name is not None:
        db_cat.category_name = cat.category_name.strip()
    if cat.parent_category_id is not None:
        db_cat.parent_category_id = cat.parent_category_id
    db.commit()
    db.refresh(db_cat)
    return db_cat

def delete_category(db: Session, category_id: int, reassign_to_id: Optional[int] = None) -> bool:
    db_cat = get_category_by_id(db, category_id)
    if not db_cat:
        return False
    
    # Check references
    txn_count = db.query(models.Transaction).filter(models.Transaction.category_id == category_id).count()
    item_count = db.query(models.ReceiptItem).filter(models.ReceiptItem.category_id == category_id).count()
    
    if (txn_count > 0 or item_count > 0):
        if reassign_to_id:
            # Reassign
            db.query(models.Transaction).filter(models.Transaction.category_id == category_id).update(
                {"category_id": reassign_to_id}
            )
            db.query(models.ReceiptItem).filter(models.ReceiptItem.category_id == category_id).update(
                {"category_id": reassign_to_id}
            )
        else:
            raise ValueError(
                f"Cannot delete category '{db_cat.category_name}': it is referenced by {txn_count} transaction(s) and {item_count} receipt item(s). Reassign them first."
            )
            
    db.delete(db_cat)
    db.commit()
    return True


# --- Payment Methods ---
def get_payment_methods(db: Session) -> List[models.PaymentMethod]:
    return db.query(models.PaymentMethod).order_by(models.PaymentMethod.payment_method_id.asc()).all()


# --- Transactions ---
def get_transactions(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    category_id: Optional[int] = None,
    payment_method_id: Optional[int] = None,
    source: Optional[str] = None,
    transaction_type: Optional[str] = None,
    search: Optional[str] = None,
    month: Optional[str] = None # format YYYY-MM
) -> Tuple[List[models.Transaction], int]:
    query = db.query(models.Transaction).options(
        joinedload(models.Transaction.category),
        joinedload(models.Transaction.merchant),
        joinedload(models.Transaction.payment_method),
        joinedload(models.Transaction.receipt).joinedload(models.Receipt.items)
    )

    if month:
        parts = month.split("-")
        if len(parts) == 2:
            year, m = int(parts[0]), int(parts[1])
            start_m = date(year, m, 1)
            if m == 12:
                end_m = date(year + 1, 1, 1)
            else:
                end_m = date(year, m + 1, 1)
            query = query.filter(models.Transaction.transaction_date >= start_m, models.Transaction.transaction_date < end_m)

    if start_date:
        query = query.filter(models.Transaction.transaction_date >= start_date)
    if end_date:
        query = query.filter(models.Transaction.transaction_date <= end_date)
    if category_id:
        query = query.filter(models.Transaction.category_id == category_id)
    if payment_method_id:
        query = query.filter(models.Transaction.payment_method_id == payment_method_id)
    if source:
        query = query.filter(models.Transaction.source == source)
    if transaction_type:
        query = query.filter(models.Transaction.transaction_type == transaction_type)
    if search and search.strip():
        term = f"%{search.strip().lower()}%"
        query = query.outerjoin(models.Merchant).outerjoin(models.Category).filter(
            or_(
                func.lower(models.Transaction.description).like(term),
                func.lower(models.Transaction.notes).like(term),
                func.lower(models.Merchant.merchant_name).like(term),
                func.lower(models.Category.category_name).like(term)
            )
        )

    total_count = query.count()
    txns = query.order_by(models.Transaction.transaction_date.desc(), models.Transaction.transaction_id.desc()).offset(skip).limit(limit).all()
    return txns, total_count

def get_transaction_by_id(db: Session, transaction_id: int) -> Optional[models.Transaction]:
    return db.query(models.Transaction).options(
        joinedload(models.Transaction.category),
        joinedload(models.Transaction.merchant),
        joinedload(models.Transaction.payment_method),
        joinedload(models.Transaction.receipt).joinedload(models.Receipt.items)
    ).filter(models.Transaction.transaction_id == transaction_id).first()

def create_transaction(db: Session, txn_in: schemas.TransactionCreate, is_demo: bool = False) -> models.Transaction:
    # Verify foreign keys
    if txn_in.category_id:
        cat = db.query(models.Category).filter(models.Category.category_id == txn_in.category_id).first()
        if not cat:
            raise ValueError(f"Category ID {txn_in.category_id} does not exist.")
    
    pm = db.query(models.PaymentMethod).filter(models.PaymentMethod.payment_method_id == txn_in.payment_method_id).first()
    if not pm:
        raise ValueError(f"Payment Method ID {txn_in.payment_method_id} does not exist.")

    # Merchant lookup or creation
    merchant = None
    if txn_in.merchant_id:
        merchant = db.query(models.Merchant).filter(models.Merchant.merchant_id == txn_in.merchant_id).first()
    elif txn_in.merchant_name:
        merchant = get_or_create_merchant(db, txn_in.merchant_name)

    db_txn = models.Transaction(
        transaction_date=txn_in.transaction_date,
        amount_paise=txn_in.amount_paise,
        transaction_type=txn_in.transaction_type,
        description=txn_in.description or (merchant.merchant_name if merchant else "Expense"),
        category_id=txn_in.category_id,
        merchant_id=merchant.merchant_id if merchant else None,
        payment_method_id=txn_in.payment_method_id,
        source=txn_in.source,
        notes=txn_in.notes,
        is_demo=is_demo
    )
    db.add(db_txn)
    db.commit()
    db.refresh(db_txn)
    return db_txn

def update_transaction(db: Session, transaction_id: int, txn_in: schemas.TransactionUpdate) -> Optional[models.Transaction]:
    db_txn = get_transaction_by_id(db, transaction_id)
    if not db_txn:
        return None

    if txn_in.transaction_date is not None:
        db_txn.transaction_date = txn_in.transaction_date
    if txn_in.amount_paise is not None:
        db_txn.amount_paise = txn_in.amount_paise
    if txn_in.transaction_type is not None:
        db_txn.transaction_type = txn_in.transaction_type
    if txn_in.description is not None:
        db_txn.description = txn_in.description
    if txn_in.category_id is not None:
        if txn_in.category_id != 0:
            cat = db.query(models.Category).filter(models.Category.category_id == txn_in.category_id).first()
            if not cat:
                raise ValueError(f"Category ID {txn_in.category_id} does not exist.")
            db_txn.category_id = txn_in.category_id
        else:
            db_txn.category_id = None
    if txn_in.payment_method_id is not None:
        pm = db.query(models.PaymentMethod).filter(models.PaymentMethod.payment_method_id == txn_in.payment_method_id).first()
        if not pm:
            raise ValueError(f"Payment Method ID {txn_in.payment_method_id} does not exist.")
        db_txn.payment_method_id = txn_in.payment_method_id
    if txn_in.notes is not None:
        db_txn.notes = txn_in.notes

    if txn_in.merchant_id is not None:
        db_txn.merchant_id = txn_in.merchant_id
    elif txn_in.merchant_name is not None:
        merchant = get_or_create_merchant(db, txn_in.merchant_name)
        db_txn.merchant_id = merchant.merchant_id if merchant else None

    db_txn.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(db_txn)
    return db_txn

def delete_transaction(db: Session, transaction_id: int) -> bool:
    db_txn = db.query(models.Transaction).filter(models.Transaction.transaction_id == transaction_id).first()
    if not db_txn:
        return False
    db.delete(db_txn)
    db.commit()
    return True


# --- Receipts ---
def get_receipt_by_hash(db: Session, file_hash: str) -> Optional[models.Receipt]:
    return db.query(models.Receipt).filter(models.Receipt.file_hash == file_hash).first()

def get_receipt_by_id(db: Session, receipt_id: int) -> Optional[models.Receipt]:
    return db.query(models.Receipt).options(
        joinedload(models.Receipt.items),
        joinedload(models.Receipt.transaction)
    ).filter(models.Receipt.receipt_id == receipt_id).first()

def create_receipt_with_items(
    db: Session,
    payload: schemas.ReceiptConfirmPayload,
    stored_path: str,
    original_filename: str,
    file_hash: str,
    raw_ocr_text: str,
    status: str
) -> models.Transaction:
    # 1. Create Transaction
    amount_paise = int(round(payload.amount_rupees * 100))
    if amount_paise <= 0:
        raise ValueError("Transaction amount must be positive.")

    merchant = get_or_create_merchant(db, payload.merchant_name)

    db_txn = models.Transaction(
        transaction_date=payload.transaction_date,
        amount_paise=amount_paise,
        transaction_type="expense",
        description=payload.description or (f"Receipt: {merchant.merchant_name}" if merchant else "Scanned Receipt"),
        category_id=payload.category_id,
        merchant_id=merchant.merchant_id if merchant else None,
        payment_method_id=payload.payment_method_id,
        source="receipt",
        notes=payload.notes,
        is_demo=False
    )
    db.add(db_txn)
    db.flush()

    # 2. Create Receipt Record
    db_receipt = models.Receipt(
        transaction_id=db_txn.transaction_id,
        stored_path=stored_path,
        original_filename=original_filename,
        file_hash=file_hash,
        raw_ocr_text=raw_ocr_text,
        extraction_status=status
    )
    db.add(db_receipt)
    db.flush()

    # 3. Create Receipt Items
    for item in payload.items:
        db_item = models.ReceiptItem(
            receipt_id=db_receipt.receipt_id,
            item_name=item.item_name,
            quantity=item.quantity,
            unit_price_paise=item.unit_price_paise,
            line_total_paise=item.line_total_paise or int(round((item.line_total_rupees or 0) * 100)),
            category_id=item.category_id or payload.category_id,
            confidence_score=item.confidence_score or 0.9
        )
        db.add(db_item)

    db.commit()
    db.refresh(db_txn)
    return db_txn


# --- Budgets ---
def get_budgets_for_month(db: Session, month_start: date) -> List[schemas.BudgetResponse]:
    budgets = db.query(models.Budget).options(
        joinedload(models.Budget.category)
    ).filter(models.Budget.month_start == month_start).all()

    # Calculate actual spending for each category in this month
    if month_start.month == 12:
        next_month_start = date(month_start.year + 1, 1, 1)
    else:
        next_month_start = date(month_start.year, month_start.month + 1, 1)

    spend_query = db.query(
        models.Transaction.category_id,
        func.sum(models.Transaction.amount_paise).label("total_spent")
    ).filter(
        models.Transaction.transaction_date >= month_start,
        models.Transaction.transaction_date < next_month_start,
        models.Transaction.transaction_type == "expense"
    ).group_by(models.Transaction.category_id).all()

    spend_map = {row.category_id: (row.total_spent or 0) for row in spend_query}

    results = []
    for b in budgets:
        spent = spend_map.get(b.category_id, 0)
        remaining = b.budget_paise - spent
        pct = (spent / b.budget_paise * 100.0) if b.budget_paise > 0 else 0.0
        
        status = "ok"
        if pct >= 100.0:
            status = "exceeded"
        elif pct >= 80.0:
            status = "warning"

        results.append(schemas.BudgetResponse(
            budget_id=b.budget_id,
            category_id=b.category_id,
            category_name=b.category.category_name if b.category else "Unknown",
            month_start=b.month_start,
            budget_paise=b.budget_paise,
            budget_rupees=round(b.budget_paise / 100.0, 2),
            spent_paise=spent,
            spent_rupees=round(spent / 100.0, 2),
            remaining_paise=remaining,
            remaining_rupees=round(remaining / 100.0, 2),
            percentage_used=round(pct, 1),
            status=status,
            created_at=b.created_at
        ))
    return results

def set_budget(db: Session, budget_in: schemas.BudgetCreate) -> models.Budget:
    # Ensure month_start is first day of month
    m_start = date(budget_in.month_start.year, budget_in.month_start.month, 1)
    existing = db.query(models.Budget).filter(
        models.Budget.category_id == budget_in.category_id,
        models.Budget.month_start == m_start
    ).first()

    if existing:
        existing.budget_paise = budget_in.budget_paise
        db.commit()
        db.refresh(existing)
        return existing
    else:
        new_b = models.Budget(
            category_id=budget_in.category_id,
            month_start=m_start,
            budget_paise=budget_in.budget_paise
        )
        db.add(new_b)
        db.commit()
        db.refresh(new_b)
        return new_b

def delete_budget(db: Session, budget_id: int) -> bool:
    b = db.query(models.Budget).filter(models.Budget.budget_id == budget_id).first()
    if not b:
        return False
    db.delete(b)
    db.commit()
    return True
