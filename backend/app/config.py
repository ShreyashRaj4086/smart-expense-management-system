import os
from pathlib import Path
from pydantic import BaseModel

BASE_DIR = Path(__file__).resolve().parent.parent.parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

RECEIPTS_DIR = DATA_DIR / "receipts"
RECEIPTS_DIR.mkdir(parents=True, exist_ok=True)

DB_PATH = os.getenv("SPENDWISE_DB_PATH", str(DATA_DIR / "spendwise.db"))
DATABASE_URL = f"sqlite:///{DB_PATH}"

TESSERACT_CMD = os.getenv("TESSERACT_PATH", "tesseract")
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2")
DEFAULT_CURRENCY = "INR"
