import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .database import engine, Base, SessionLocal
from .config import RECEIPTS_DIR
from . import crud
from .routers import transactions, receipts, analytics, budgets, categories, ai, system

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("spendwise")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing SpendWise database...")
    # Safe table creation (does not drop or overwrite existing tables)
    Base.metadata.create_all(bind=engine)
    
    # Seed default categories and payment methods
    db = SessionLocal()
    try:
        crud.seed_defaults(db)
        logger.info("Default categories and payment methods verified.")
    finally:
        db.close()
    
    yield
    logger.info("Shutting down SpendWise backend.")

app = FastAPI(
    title="SpendWise — Daily Expenditure Analyser API",
    description="Privacy-focused personal expenditure analyser backend with local database, OCR, and AI explanation.",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware for local frontend dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(system.router)
app.include_router(transactions.router)
app.include_router(receipts.router)
app.include_router(analytics.router)
app.include_router(budgets.router)
app.include_router(categories.router)
app.include_router(ai.router)

# Mount receipts static directory for secure receipt previews
RECEIPTS_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/receipts-static", StaticFiles(directory=str(RECEIPTS_DIR)), name="receipts-static")

@app.get("/")
def root():
    return {
        "app": "SpendWise — Daily Expenditure Analyser",
        "status": "online",
        "docs_url": "/docs",
        "privacy": "100% offline & local"
    }
