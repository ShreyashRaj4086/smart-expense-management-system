from datetime import date
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ..database import get_db
from .. import crud, schemas, models

router = APIRouter(prefix="/api/transactions", tags=["Transactions"])

@router.get("", response_model=dict)
def list_transactions(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    month: Optional[str] = Query(None, description="Month in YYYY-MM format"),
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    category_id: Optional[int] = None,
    payment_method_id: Optional[int] = None,
    source: Optional[str] = None,
    transaction_type: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    txns, total = crud.get_transactions(
        db=db,
        skip=skip,
        limit=limit,
        start_date=start_date,
        end_date=end_date,
        category_id=category_id,
        payment_method_id=payment_method_id,
        source=source,
        transaction_type=transaction_type,
        search=search,
        month=month
    )

    items = []
    for t in txns:
        items.append({
            "transaction_id": t.transaction_id,
            "transaction_date": t.transaction_date,
            "amount_paise": t.amount_paise,
            "amount_rupees": round(t.amount_paise / 100.0, 2),
            "transaction_type": t.transaction_type,
            "description": t.description,
            "category_id": t.category_id,
            "category_name": t.category.category_name if t.category else "Uncategorized",
            "merchant_id": t.merchant_id,
            "merchant_name": t.merchant.merchant_name if t.merchant else None,
            "payment_method_id": t.payment_method_id,
            "payment_method_name": t.payment_method.method_name if t.payment_method else "Unknown",
            "source": t.source,
            "notes": t.notes,
            "is_demo": t.is_demo,
            "created_at": t.created_at,
            "updated_at": t.updated_at,
            "has_receipt": t.receipt is not None,
            "receipt_id": t.receipt.receipt_id if t.receipt else None
        })

    return {
        "items": items,
        "total": total,
        "skip": skip,
        "limit": limit
    }

@router.post("", response_model=schemas.TransactionResponse, status_code=status.HTTP_201_CREATED)
def create_transaction(txn_in: schemas.TransactionCreate, db: Session = Depends(get_db)):
    try:
        t = crud.create_transaction(db, txn_in)
        return schemas.TransactionResponse(
            transaction_id=t.transaction_id,
            transaction_date=t.transaction_date,
            amount_paise=t.amount_paise,
            amount_rupees=round(t.amount_paise / 100.0, 2),
            transaction_type=t.transaction_type,
            description=t.description,
            category_id=t.category_id,
            category_name=t.category.category_name if t.category else None,
            merchant_id=t.merchant_id,
            merchant_name=t.merchant.merchant_name if t.merchant else None,
            payment_method_id=t.payment_method_id,
            payment_method_name=t.payment_method.method_name if t.payment_method else None,
            source=t.source,
            notes=t.notes,
            is_demo=t.is_demo,
            created_at=t.created_at,
            updated_at=t.updated_at
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{transaction_id}", response_model=schemas.TransactionResponse)
def get_transaction(transaction_id: int, db: Session = Depends(get_db)):
    t = crud.get_transaction_by_id(db, transaction_id)
    if not t:
        raise HTTPException(status_code=404, detail="Transaction not found.")
    
    return schemas.TransactionResponse(
        transaction_id=t.transaction_id,
        transaction_date=t.transaction_date,
        amount_paise=t.amount_paise,
        amount_rupees=round(t.amount_paise / 100.0, 2),
        transaction_type=t.transaction_type,
        description=t.description,
        category_id=t.category_id,
        category_name=t.category.category_name if t.category else None,
        merchant_id=t.merchant_id,
        merchant_name=t.merchant.merchant_name if t.merchant else None,
        payment_method_id=t.payment_method_id,
        payment_method_name=t.payment_method.method_name if t.payment_method else None,
        source=t.source,
        notes=t.notes,
        is_demo=t.is_demo,
        created_at=t.created_at,
        updated_at=t.updated_at
    )

@router.put("/{transaction_id}", response_model=schemas.TransactionResponse)
def update_transaction(transaction_id: int, txn_in: schemas.TransactionUpdate, db: Session = Depends(get_db)):
    try:
        t = crud.update_transaction(db, transaction_id, txn_in)
        if not t:
            raise HTTPException(status_code=404, detail="Transaction not found.")
        return schemas.TransactionResponse(
            transaction_id=t.transaction_id,
            transaction_date=t.transaction_date,
            amount_paise=t.amount_paise,
            amount_rupees=round(t.amount_paise / 100.0, 2),
            transaction_type=t.transaction_type,
            description=t.description,
            category_id=t.category_id,
            category_name=t.category.category_name if t.category else None,
            merchant_id=t.merchant_id,
            merchant_name=t.merchant.merchant_name if t.merchant else None,
            payment_method_id=t.payment_method_id,
            payment_method_name=t.payment_method.method_name if t.payment_method else None,
            source=t.source,
            notes=t.notes,
            is_demo=t.is_demo,
            created_at=t.created_at,
            updated_at=t.updated_at
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/{transaction_id}")
def delete_transaction(transaction_id: int, db: Session = Depends(get_db)):
    success = crud.delete_transaction(db, transaction_id)
    if not success:
        raise HTTPException(status_code=404, detail="Transaction not found.")
    return {"message": "Transaction deleted successfully.", "transaction_id": transaction_id}
