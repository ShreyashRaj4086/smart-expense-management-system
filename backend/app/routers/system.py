import io
import csv
import shutil
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse, FileResponse
from sqlalchemy.orm import Session

from ..database import get_db
from ..config import DB_PATH, RECEIPTS_DIR
from .. import crud, demo_data, ocr, ai_insights, models

router = APIRouter(prefix="/api", tags=["System & Settings"])

@router.get("/health")
def health_check(db: Session = Depends(get_db)):
    try:
        db.execute(models.Transaction.__table__.select().limit(1))
        db_healthy = True
    except Exception:
        db_healthy = False

    return {
        "status": "healthy" if db_healthy else "unhealthy",
        "app_name": "SpendWise — Daily Expenditure Analyser",
        "version": "1.0.0",
        "database": "connected" if db_healthy else "disconnected"
    }

@router.get("/system/status")
async def get_system_status(db: Session = Depends(get_db)):
    ocr_avail, ocr_path, ocr_msg = ocr.detect_tesseract()
    ai_status = await ai_insights.check_ollama_status()
    total_txns = db.query(models.Transaction).count()
    demo_txns = db.query(models.Transaction).filter(models.Transaction.is_demo == True).count()
    user_txns = total_txns - demo_txns

    return {
        "database": {
            "path": DB_PATH,
            "exists": Path(DB_PATH).exists(),
            "total_transactions": total_txns,
            "user_transactions": user_txns,
            "demo_transactions": demo_txns
        },
        "storage": {
            "receipts_directory": str(RECEIPTS_DIR),
            "receipt_files_count": len(list(RECEIPTS_DIR.glob("*")))
        },
        "ocr": {
            "available": ocr_avail,
            "executable_path": ocr_path,
            "instructions": ocr_msg
        },
        "ai": ai_status,
        "currency": "INR (₹)"
    }

@router.get("/payment-methods")
def get_payment_methods(db: Session = Depends(get_db)):
    return crud.get_payment_methods(db)

@router.post("/system/demo/load")
def load_demo(db: Session = Depends(get_db)):
    res = demo_data.load_demo_dataset(db)
    return res

@router.post("/system/demo/clear")
def clear_demo(db: Session = Depends(get_db)):
    res = demo_data.clear_demo_dataset(db)
    return res

@router.get("/export/transactions")
def export_transactions_csv(db: Session = Depends(get_db)):
    txns, _ = crud.get_transactions(db, skip=0, limit=100000)

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Transaction ID",
        "Date",
        "Amount (INR)",
        "Type",
        "Description",
        "Category",
        "Merchant",
        "Payment Method",
        "Source",
        "Notes",
        "Is Demo"
    ])

    for t in txns:
        writer.writerow([
            t.transaction_id,
            t.transaction_date.strftime("%Y-%m-%d"),
            f"{t.amount_paise / 100.0:.2f}",
            t.transaction_type,
            t.description or "",
            t.category.category_name if t.category else "Uncategorized",
            t.merchant.merchant_name if t.merchant else "",
            t.payment_method.method_name if t.payment_method else "",
            t.source,
            t.notes or "",
            "Yes" if t.is_demo else "No"
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=spendwise_transactions.csv"}
    )

@router.get("/system/backup")
def backup_database():
    db_file = Path(DB_PATH)
    if not db_file.exists():
        raise HTTPException(status_code=404, detail="Database file does not exist yet.")

    return FileResponse(
        path=str(db_file),
        filename="spendwise_backup.db",
        media_type="application/x-sqlite3"
    )
