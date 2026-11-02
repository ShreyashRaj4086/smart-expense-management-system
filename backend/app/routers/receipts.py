import os
import uuid
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..config import RECEIPTS_DIR
from .. import crud, schemas, models, ocr

router = APIRouter(prefix="/api/receipts", tags=["Receipts"])

ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".pdf"}
MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024  # 15 MB

@router.post("/scan", response_model=schemas.ReceiptScanResult)
async def scan_receipt(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    ext = Path(file.filename or "receipt.jpg").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format '{ext}'. Allowed formats: PNG, JPG, JPEG, WEBP, PDF."
        )

    # Read bytes safely
    content = await file.read()
    if len(content) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(status_code=400, detail="File size exceeds maximum limit of 15MB.")

    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    # Calculate SHA256 file hash
    file_hash = ocr.compute_file_hash(content)

    # Check duplicate
    existing_receipt = crud.get_receipt_by_hash(db, file_hash)
    is_duplicate = existing_receipt is not None
    dup_txn_id = existing_receipt.transaction_id if existing_receipt else None

    # Save to disk with safe UUID filename
    file_id = f"{uuid.uuid4().hex}{ext}"
    saved_path = RECEIPTS_DIR / file_id
    with open(saved_path, "wb") as f:
        f.write(content)

    # Perform local text extraction
    ocr_available = True
    ocr_note = None
    raw_text = ""
    status_str = "success"

    if ext == ".pdf":
        raw_text = ocr.extract_text_from_pdf(saved_path)
        if not raw_text.strip():
            # If text PDF extraction returned empty, try OCR if available
            raw_text, ocr_available, ocr_note = ocr.extract_text_from_image(saved_path)
    else:
        raw_text, ocr_available, ocr_note = ocr.extract_text_from_image(saved_path)

    if not ocr_available:
        status_str = "failed"
    elif not raw_text.strip():
        status_str = "partial"
    else:
        status_str = "success"

    # Parse extracted text with heuristics
    parsed = ocr.parse_receipt_text(raw_text)

    # Suggest Category
    suggested_cat_id = None
    suggested_cat_name = None
    if parsed["merchant_name"]:
        cat_name = ocr.guess_category_name(parsed["merchant_name"])
        if not cat_name and raw_text:
            cat_name = ocr.guess_category_name(raw_text)
        if cat_name:
            cat_obj = db.query(models.Category).filter(models.Category.category_name == cat_name).first()
            if cat_obj:
                suggested_cat_id = cat_obj.category_id
                suggested_cat_name = cat_obj.category_name

    # Check reconciliation warning
    items_total = sum(i["line_total_rupees"] for i in parsed["items"])
    reconciliation_warning = None
    if parsed["total_rupees"] and items_total > 0:
        diff = abs(parsed["total_rupees"] - items_total)
        if diff > 1.0:
            reconciliation_warning = (
                f"Sum of item rows (₹{items_total:,.2f}) does not match receipt total (₹{parsed['total_rupees']:,.2f}). "
                f"Difference: ₹{diff:,.2f}. Please review line items and adjust before confirming."
            )

    # Suggest default payment method (UPI)
    upi_pm = db.query(models.PaymentMethod).filter(models.PaymentMethod.method_name == "UPI").first()
    pm_id = upi_pm.payment_method_id if upi_pm else 1

    extracted_items = [
        schemas.ExtractedItem(
            item_name=item["item_name"],
            quantity=item["quantity"],
            unit_price_rupees=item.get("unit_price_rupees"),
            line_total_rupees=item["line_total_rupees"],
            confidence=item.get("confidence", 0.85)
        )
        for item in parsed["items"]
    ]

    return schemas.ReceiptScanResult(
        file_id=file_id,
        filename=file.filename or "receipt",
        file_hash=file_hash,
        is_duplicate=is_duplicate,
        duplicate_transaction_id=dup_txn_id,
        extraction_status=status_str,
        raw_ocr_text=raw_text,
        merchant_name=parsed["merchant_name"],
        transaction_date=parsed["transaction_date"],
        total_rupees=parsed["total_rupees"],
        tax_rupees=parsed["tax_rupees"],
        suggested_category_id=suggested_cat_id,
        suggested_category_name=suggested_cat_name,
        suggested_payment_method_id=pm_id,
        items=extracted_items,
        reconciliation_warning=reconciliation_warning,
        ocr_engine_available=ocr_available,
        ocr_engine_note=ocr_note
    )

@router.post("/confirm", response_model=schemas.TransactionResponse, status_code=status.HTTP_201_CREATED)
def confirm_receipt(payload: schemas.ReceiptConfirmPayload, db: Session = Depends(get_db)):
    file_path = RECEIPTS_DIR / payload.file_id
    if not file_path.exists():
        raise HTTPException(status_code=400, detail="Uploaded receipt file not found on server.")

    with open(file_path, "rb") as f:
        file_bytes = f.read()
    file_hash = ocr.compute_file_hash(file_bytes)

    try:
        txn = crud.create_receipt_with_items(
            db=db,
            payload=payload,
            stored_path=str(file_path),
            original_filename=payload.file_id,
            file_hash=file_hash,
            raw_ocr_text="",
            status="confirmed"
        )
        return schemas.TransactionResponse(
            transaction_id=txn.transaction_id,
            transaction_date=txn.transaction_date,
            amount_paise=txn.amount_paise,
            amount_rupees=round(txn.amount_paise / 100.0, 2),
            transaction_type=txn.transaction_type,
            description=txn.description,
            category_id=txn.category_id,
            category_name=txn.category.category_name if txn.category else None,
            merchant_id=txn.merchant_id,
            merchant_name=txn.merchant.merchant_name if txn.merchant else None,
            payment_method_id=txn.payment_method_id,
            payment_method_name=txn.payment_method.method_name if txn.payment_method else None,
            source=txn.source,
            notes=txn.notes,
            is_demo=txn.is_demo,
            created_at=txn.created_at,
            updated_at=txn.updated_at
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{receipt_id}", response_model=schemas.ReceiptResponse)
def get_receipt(receipt_id: int, db: Session = Depends(get_db)):
    r = crud.get_receipt_by_id(db, receipt_id)
    if not r:
        raise HTTPException(status_code=404, detail="Receipt not found.")
    return r
