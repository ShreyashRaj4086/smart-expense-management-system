# SpendWise — Daily Expenditure Analyser

[![Python](https://img.shields.io/badge/Python-3.13-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688.svg)](https://fastapi.tiangolo.com/)
[![SQLite](https://img.shields.io/badge/SQLite-3NF%20ACID-003B57.svg)](https://www.sqlite.org/)
[![React](https://img.shields.io/badge/React-19.0-61DAFB.svg)](https://react.dev/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-4.0-38B2AC.svg)](https://tailwindcss.com/)
[![Tests](https://img.shields.io/badge/Pytest-17%2F17%20Passing-brightgreen.svg)](backend/tests/)
[![Privacy](https://img.shields.io/badge/Privacy-100%25%20On--Device-success.svg)](#privacy-guarantee)

**SpendWise** is a privacy-first, local personal expenditure analyser engineered for university DBMS evaluation and daily financial management. It couples a normalized relational database (SQLite in 3NF), local optical character recognition (OCR) with 2D spatial clustering, manual transaction bookkeeping, statistical cashflow analytics, machine learning anomaly detection (`IsolationForest`), and on-device natural language explanations via Ollama (`gemma3:4b`).

---

## Architecture Overview

```
                                  +------------------------------------------+
                                  |         SpendWise React 19 Frontend       |
                                  |    (TypeScript + Tailwind 4 + Recharts)  |
                                  +--------------------+---------------------+
                                                       | REST API (127.0.0.1:8000)
                                                       v
+----------------------------------------------------------------------------------------------------+
|                                     FastAPI Backend Engine                                         |
|                                                                                                    |
|  +---------------------+   +--------------------+   +-----------------------+   +---------------+  |
|  |   Relational ORM    |   |    Local OCR       |   |     Machine Learning  |   |   Local AI    |  |
|  |  (SQLAlchemy 2.0)   |   | (RapidOCR/Tesseract|   | (scikit-learn Forest) |   | (Ollama Gemma)|  |
|  +----------+----------+   +---------+----------+   +-----------+-----------+   +-------+-------+  |
|             |                        |                          |                       |          |
|             v                        v                          v                       v          |
|  +---------------------+   +--------------------+   +-----------------------+   +---------------+  |
|  |  SQLite Database    |   | 2D Box Spatial     |   | Outlier Transaction   |   | Natural Lang  |  |
|  |  (3NF Integer Paise)|   | Line Item Parser   |   | Habit Scoring         |   | Fact Synthesis|  |
|  +---------------------+   +--------------------+   +-----------------------+   +---------------+  |
+----------------------------------------------------------------------------------------------------+
```

---

## Key Features

1. **100% Offline & Privacy-Guaranteed:** Zero cloud dependencies. All financial records, receipts, and prompts execute entirely on `127.0.0.1` on your machine.
2. **Normalized Relational Database (3NF):** Persistent SQLite schema enforcing foreign-key referential integrity (`ON DELETE RESTRICT`), unique constraints, integer paise precision, and indexed queries.
3. **Advanced Receipt OCR:** Drag-and-drop receipt scanning (PNG, JPG, JPEG, WEBP, PDF) utilizing RapidOCR / Tesseract with 2D bounding-box spatial clustering and whole-rupee heuristics.
4. **Duplicate Receipt Prevention:** SHA-256 cryptographic file hashing detects and prevents duplicate receipt entries.
5. **Double-Counting Safe:** Transaction totals and decomposed receipt items are queried independently, guaranteeing zero discrepancy in cumulative reporting.
6. **Machine Learning Anomaly Detection:** Employs `scikit-learn` Isolation Forest to detect unusual spending spikes and irregular merchant patterns with explainable reasons.
7. **Local AI / Ollama Synthesis:** On-device language model (`gemma3:4b` / `llama3.2`) synthesizes verified SQL facts into concise natural-language answers (e.g., *"Where did food price increase?"*), with instant deterministic SQL fallback.
8. **Budget Controls:** Monthly category spending caps with color-coded threshold progress bars (`On Track`, `Approaching Limit`, `Exceeded`).
9. **Data Portability:** 1-click CSV transaction export and binary `.db` database download.
10. **University Project Demo Mode:** Load 3 months of realistic Indian expenditure records (August to October 2026) and safely reset demo records anytime without affecting user transactions.

---

## Database Architecture & Normalization

The SQLite database (`data/spendwise.db`) is structured in strict **Third Normal Form (3NF)**:

| Table | Primary Key | Foreign Keys | Responsibility |
| :--- | :--- | :--- | :--- |
| `categories` | `category_id` | — | Expenditure taxonomy (Food, Utilities, Transit, etc.) |
| `payment_methods` | `method_id` | — | Supported payment modes (`upi`, `cash`, `debit`, `credit`, `netbanking`) |
| `merchants` | `merchant_id` | `default_category_id` $\to$ `categories` | Merchant directory with category associations |
| `transactions` | `transaction_id` | `category_id`, `method_id`, `merchant_id`, `receipt_id` | Core ledger entries stored in integer paise (`amount_paise`) |
| `receipts` | `receipt_id` | — | OCR receipt metadata, SHA-256 hash, and raw recognized text |
| `receipt_items` | `item_id` | `receipt_id`, `category_id` | Granular itemized lines extracted from receipts |
| `budgets` | `budget_id` | `category_id` | Monthly spending limits per category |

### Financial Precision
To eliminate IEEE-754 floating-point inaccuracies, currency is stored as integer paise:
$$\text{Rupees} = \frac{\text{Paise}}{100}$$
All database aggregates (`SUM`, `AVG`, `MAX`) compute with integer arithmetic and are rendered as formatted Rupees (`₹`) in the UI.

---

## Quick Start on Windows

### Prerequisites
* **Python 3.10+** (tested on Python 3.13)
* **Node.js 18+** (tested on Node.js v24)
* *(Optional)* **Ollama** installed from [ollama.com](https://ollama.com) with `ollama pull gemma3:4b`

---

### Method 1: One-Click Startup (Recommended)

1. **Initial Setup (First time only):**
   Double-click `setup.bat` (or run in CMD/PowerShell):
   ```cmd
   setup.bat
   ```
   *This creates the Python virtual environment, installs backend/frontend dependencies, and initializes the SQLite database schema.*

2. **Launch Application:**
   Double-click `start.bat`:
   ```cmd
   start.bat
   ```
   *This automatically opens 3 dedicated terminal windows:*
   * **SpendWise - Ollama Local AI** (Port 11434)
   * **SpendWise - FastAPI Backend** (Port 8000)
   * **SpendWise - React Frontend** (Port 5173)
   * *Launches your default browser to `http://127.0.0.1:5173`.*

---

### Method 2: Manual Terminal Launch

#### Terminal 1 — Ollama (Optional)
```cmd
ollama serve
```

#### Terminal 2 — FastAPI Backend
```cmd
call .\venv\Scripts\activate.bat
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```
*API Swagger Documentation: `http://127.0.0.1:8000/docs`*

#### Terminal 3 — React Frontend
```cmd
cd frontend
npm run dev
```
*Dashboard Interface: `http://127.0.0.1:5173`*

---

## Demonstration & Academic Evaluation Walkthrough

When evaluating or presenting SpendWise, use this recommended flow:

1. **Dashboard Overview:**
   * Select **October 2026** in the month dropdown.
   * Review the 4 KPI summary cards (Total Expenditure, Daily Average, Total Transactions, Budget Status).
   * Toggle the timeline between **Daily Spend** and **Cumulative Total**.
   * Explore category share distribution on the donut chart.

2. **Receipt Scanning & Line-Item Verification:**
   * Navigate to **Scan Receipt**.
   * Drag-and-drop a receipt image (e.g. thermal bill or sample invoice).
   * Observe the 4-step stepper, automatic RapidOCR extraction, and balanced reconciliation check.
   * Click **Save Verified Receipt to Database**.

3. **Transaction History & Filtering:**
   * Navigate to **Transactions**.
   * Test active filter chips (e.g. Category = *Food & Dining*, Method = *UPI*).
   * Dismiss individual chips or click **Clear all**.
   * Click **+ Add Expense** to record a manual transaction.

4. **Analytics & Local AI Insights:**
   * Navigate to **Analytics & AI**.
   * Observe the active **Local Ollama (`gemma3:4b`)** status pill with pulse indicator.
   * Click the suggestion prompt: *"Where did food price increase?"*
   * Review the AI explanation highlighting exact merchants (Swiggy, Truffles) and percentage increases (+25.2%).
   * Inspect the **scikit-learn Isolation Forest** unusual purchase cards.

5. **Budgets & Referential Integrity:**
   * Navigate to **Budgets** to inspect category limits and threshold progress bars.
   * Navigate to **Categories** to review normalized classifications and safe reassign protection on deletion.

6. **Data Export & Diagnostics:**
   * Navigate to **Settings** to download a CSV transaction export, download a full SQLite binary database (`.db`), or reset demonstration records.

---

## Automated Test Suite

SpendWise includes an extensive test suite verifying mathematical consistency, database ACID compliance, OCR heuristics, and AI fallbacks.

Run the test suite with:
```cmd
.\venv\Scripts\python.exe -m pytest backend/tests/ -v
```

### Verified Test Results (17/17 Passed):
```
backend/tests/test_analytics.py::test_monthly_kpi_and_comparison PASSED
backend/tests/test_analytics.py::test_zero_baseline_handling PASSED
backend/tests/test_analytics.py::test_double_counting_prevention PASSED
backend/tests/test_budgets.py::test_budget_lifecycle_and_alerts PASSED
backend/tests/test_demo_and_export.py::test_demo_data_load_and_safe_clear PASSED
backend/tests/test_demo_and_export.py::test_csv_export PASSED
backend/tests/test_demo_and_export.py::test_category_referential_integrity PASSED
backend/tests/test_ml_and_ai.py::test_anomaly_detection_isolation_forest PASSED
backend/tests/test_ml_and_ai.py::test_anomaly_detection_small_data_fallback PASSED
backend/tests/test_ml_and_ai.py::test_ai_status_and_deterministic_fallback PASSED
backend/tests/test_receipts_ocr.py::test_ocr_parsing_heuristics PASSED
backend/tests/test_receipts_ocr.py::test_receipt_scan_and_confirm PASSED
backend/tests/test_transactions.py::test_health_check PASSED
backend/tests/test_transactions.py::test_create_and_get_transaction PASSED
backend/tests/test_transactions.py::test_reject_invalid_amount PASSED
backend/tests/test_transactions.py::test_reject_invalid_foreign_key PASSED
backend/tests/test_transactions.py::test_update_and_delete_transaction PASSED
============================== 17 passed in 21.33s ==============================
```

Frontend production verification:
```cmd
cd frontend
npm run build
```
*(Produces zero TypeScript errors and zero CSS warnings).*

---

## REST API Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | System health check and database connectivity |
| `GET` | `/api/system/status` | Diagnostics for SQLite, RapidOCR/Tesseract, and Ollama |
| `GET` | `/api/transactions` | Filterable transaction query (pagination, category, date, method) |
| `POST` | `/api/transactions` | Create manual transaction |
| `PUT` | `/api/transactions/{id}` | Update existing transaction |
| `DELETE` | `/api/transactions/{id}` | Remove transaction |
| `POST` | `/api/receipts/scan` | Upload and OCR process receipt image/PDF |
| `POST` | `/api/receipts/confirm` | Confirm verified receipt and write to SQLite |
| `GET` | `/api/analytics/summary` | Monthly expenditure aggregates, comparison, and budget stats |
| `GET` | `/api/analytics/categories` | Category expenditure distribution |
| `GET` | `/api/analytics/trend` | Daily spending trajectory |
| `GET` | `/api/analytics/anomalies` | scikit-learn Isolation Forest detected outliers |
| `POST` | `/api/ai/explain` | Natural language insight synthesis (Ollama or Deterministic) |
| `GET` | `/api/budgets` | Category budget limits and utilization percentages |
| `POST` | `/api/budgets` | Set or update category budget |
| `GET` | `/api/categories` | Normalized category list |
| `GET` | `/api/export/csv` | Download transactions as CSV |
| `GET` | `/api/backup/db` | Download raw SQLite binary database |
| `POST` | `/api/demo/load` | Pre-populate 3-month sample Indian expenditure |
| `POST` | `/api/demo/clear` | Clear demo records while preserving user entries |

---

## Project Structure

```
DBMS/
│
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI initialization and CORS setup
│   │   ├── database.py          # SQLAlchemy engine, session, and SQLite PRAGMAs
│   │   ├── models.py            # 3NF Relational database models
│   │   ├── schemas.py           # Pydantic v2 validation contracts
│   │   ├── crud.py              # Database query logic and transaction handling
│   │   ├── analytics.py         # SQL aggregation, MoM diffs, and burn rate
│   │   ├── ocr.py                # 2D Bounding-box clustering & RapidOCR/Tesseract
│   │   ├── ml_anomaly.py        # scikit-learn Isolation Forest outlier detection
│   │   ├── ai_insights.py       # Ollama integration & deterministic SQL fallback
│   │   ├── demo_data.py         # Realistic 3-month Indian demonstration dataset
│   │   └── routers/             # API sub-routers (transactions, receipts, ai, etc.)
│   ├── tests/                   # 17 Pytest backend test suites
│   └── requirements.txt         # Python dependencies
│
├── frontend/
│   ├── src/
│   │   ├── components/          # Reusable UI (Sidebar, Navbar, Modal, EmptyState)
│   │   ├── pages/               # Views (Overview, Transactions, Scan, Analytics, Budgets, etc.)
│   │   ├── services/api.ts      # Type-safe Axios client for all backend endpoints
│   │   ├── types/               # TypeScript interfaces
│   │   └── utils/formatters.ts  # Indian Rupee (₹), date, and tabular number utilities
│   ├── index.html
│   ├── package.json
│   └── vite.config.ts
│
├── data/                        # Persistent local data (SQLite db and receipt files)
├── docs/                        # Complete DBMS documentation and ER diagrams
├── setup.bat                    # One-time Windows installation script
├── start.bat                    # 1-Click launcher opening Frontend, Backend, and Ollama
└── README.md                    # Project documentation
```

---

## Privacy Guarantee

* **127.0.0.1 Binding:** Development servers strictly listen on localhost.
* **Zero Telemetry:** No cloud analytics, trackers, or remote APIs are packaged.
* **On-Device Machine Learning & AI:** OCR runs via local ONNX runtime; anomaly detection runs via local CPU `scikit-learn`; conversational synthesis runs via local Ollama.
* **Local File Retention:** Receipts reside in `data/receipts/` on your storage drive and are never uploaded externally.

---

## License

This project is licensed under the MIT License — designed for university DBMS coursework and personal expenditure auditing.
