from datetime import date, datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict, model_validator

# --- Categories ---
class CategoryBase(BaseModel):
    category_name: str = Field(..., min_length=1, max_length=100)
    parent_category_id: Optional[int] = None

class CategoryCreate(CategoryBase):
    pass

class CategoryUpdate(BaseModel):
    category_name: Optional[str] = Field(None, min_length=1, max_length=100)
    parent_category_id: Optional[int] = None

class CategoryResponse(CategoryBase):
    category_id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# --- Merchants ---
class MerchantBase(BaseModel):
    merchant_name: str = Field(..., min_length=1, max_length=150)

class MerchantResponse(MerchantBase):
    merchant_id: int
    normalized_name: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# --- Payment Methods ---
class PaymentMethodResponse(BaseModel):
    payment_method_id: int
    method_name: str
    model_config = ConfigDict(from_attributes=True)


# --- Receipt Items ---
class ReceiptItemBase(BaseModel):
    item_name: str = Field(..., min_length=1, max_length=255)
    quantity: float = Field(default=1.0, gt=0)
    unit_price_rupees: Optional[float] = None
    unit_price_paise: Optional[int] = None
    line_total_rupees: Optional[float] = None
    line_total_paise: Optional[int] = None
    category_id: Optional[int] = None
    confidence_score: Optional[float] = None

    @model_validator(mode="after")
    def compute_item_paise(self):
        if self.line_total_paise is None and self.line_total_rupees is not None:
            self.line_total_paise = int(round(self.line_total_rupees * 100))
        elif self.line_total_paise is not None and self.line_total_rupees is None:
            self.line_total_rupees = round(self.line_total_paise / 100.0, 2)
        elif self.line_total_paise is None and self.line_total_rupees is None:
            self.line_total_paise = 0
            self.line_total_rupees = 0.0

        if self.unit_price_paise is None and self.unit_price_rupees is not None:
            self.unit_price_paise = int(round(self.unit_price_rupees * 100))
        elif self.unit_price_paise is not None and self.unit_price_rupees is None:
            self.unit_price_rupees = round(self.unit_price_paise / 100.0, 2)
        return self

class ReceiptItemCreate(ReceiptItemBase):
    pass

class ReceiptItemResponse(ReceiptItemBase):
    item_id: int
    receipt_id: int
    model_config = ConfigDict(from_attributes=True)


# --- Receipts ---
class ReceiptResponse(BaseModel):
    receipt_id: int
    transaction_id: int
    stored_path: str
    original_filename: str
    file_hash: str
    raw_ocr_text: Optional[str] = None
    extraction_status: str
    scanned_at: datetime
    items: List[ReceiptItemResponse] = []
    model_config = ConfigDict(from_attributes=True)


# --- Transactions ---
class TransactionBase(BaseModel):
    transaction_date: date
    amount_rupees: Optional[float] = None
    amount_paise: Optional[int] = None
    transaction_type: str = Field(default="expense", pattern="^(expense|income|refund)$")
    description: Optional[str] = None
    category_id: Optional[int] = None
    merchant_name: Optional[str] = None
    merchant_id: Optional[int] = None
    payment_method_id: int
    source: str = Field(default="manual", pattern="^(manual|receipt)$")
    notes: Optional[str] = None

    @model_validator(mode="after")
    def sync_amount(self):
        if self.amount_paise is None and self.amount_rupees is not None:
            if self.amount_rupees <= 0:
                raise ValueError("Amount must be greater than zero")
            self.amount_paise = int(round(self.amount_rupees * 100))
        elif self.amount_paise is not None and self.amount_rupees is None:
            if self.amount_paise <= 0:
                raise ValueError("Amount must be greater than zero")
            self.amount_rupees = round(self.amount_paise / 100.0, 2)
        elif self.amount_paise is not None and self.amount_rupees is not None:
            if self.amount_paise <= 0:
                raise ValueError("Amount must be greater than zero")
        else:
            raise ValueError("Either amount_rupees or amount_paise must be provided")
        return self

class TransactionCreate(TransactionBase):
    pass

class TransactionUpdate(BaseModel):
    transaction_date: Optional[date] = None
    amount_rupees: Optional[float] = None
    amount_paise: Optional[int] = None
    transaction_type: Optional[str] = Field(None, pattern="^(expense|income|refund)$")
    description: Optional[str] = None
    category_id: Optional[int] = None
    merchant_name: Optional[str] = None
    merchant_id: Optional[int] = None
    payment_method_id: Optional[int] = None
    notes: Optional[str] = None

    @model_validator(mode="after")
    def sync_update_amount(self):
        if self.amount_rupees is not None and self.amount_paise is None:
            if self.amount_rupees <= 0:
                raise ValueError("Amount must be positive")
            self.amount_paise = int(round(self.amount_rupees * 100))
        elif self.amount_paise is not None and self.amount_rupees is None:
            if self.amount_paise <= 0:
                raise ValueError("Amount must be positive")
            self.amount_rupees = round(self.amount_paise / 100.0, 2)
        return self

class TransactionResponse(BaseModel):
    transaction_id: int
    transaction_date: date
    amount_paise: int
    amount_rupees: float
    transaction_type: str
    description: Optional[str] = None
    category_id: Optional[int] = None
    category_name: Optional[str] = None
    merchant_id: Optional[int] = None
    merchant_name: Optional[str] = None
    payment_method_id: int
    payment_method_name: Optional[str] = None
    source: str
    notes: Optional[str] = None
    is_demo: bool
    created_at: datetime
    updated_at: datetime
    receipt: Optional[ReceiptResponse] = None
    model_config = ConfigDict(from_attributes=True)


# --- Budgets ---
class BudgetBase(BaseModel):
    category_id: int
    month_start: date
    budget_rupees: Optional[float] = None
    budget_paise: Optional[int] = None

    @model_validator(mode="after")
    def sync_budget(self):
        if self.budget_paise is None and self.budget_rupees is not None:
            if self.budget_rupees <= 0:
                raise ValueError("Budget must be greater than zero")
            self.budget_paise = int(round(self.budget_rupees * 100))
        elif self.budget_paise is not None and self.budget_rupees is None:
            if self.budget_paise <= 0:
                raise ValueError("Budget must be greater than zero")
            self.budget_rupees = round(self.budget_paise / 100.0, 2)
        elif self.budget_paise is not None and self.budget_rupees is not None:
            if self.budget_paise <= 0:
                raise ValueError("Budget must be greater than zero")
        else:
            raise ValueError("Budget amount must be provided")
        return self

class BudgetCreate(BudgetBase):
    pass

class BudgetUpdate(BaseModel):
    budget_rupees: Optional[float] = None
    budget_paise: Optional[int] = None

    @model_validator(mode="after")
    def sync_update_budget(self):
        if self.budget_rupees is not None and self.budget_paise is None:
            if self.budget_rupees <= 0:
                raise ValueError("Budget must be greater than zero")
            self.budget_paise = int(round(self.budget_rupees * 100))
        elif self.budget_paise is not None and self.budget_rupees is None:
            if self.budget_paise <= 0:
                raise ValueError("Budget must be greater than zero")
            self.budget_rupees = round(self.budget_paise / 100.0, 2)
        return self

class BudgetResponse(BaseModel):
    budget_id: int
    category_id: int
    category_name: str
    month_start: date
    budget_paise: int
    budget_rupees: float
    spent_paise: int = 0
    spent_rupees: float = 0.0
    remaining_paise: int = 0
    remaining_rupees: float = 0.0
    percentage_used: float = 0.0
    status: str = "ok"  # ok, warning (>80%), exceeded (>100%)
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# --- Receipt OCR Extraction Result ---
class ExtractedItem(BaseModel):
    item_name: str
    quantity: float = 1.0
    unit_price_rupees: Optional[float] = None
    line_total_rupees: float
    suggested_category_id: Optional[int] = None
    confidence: float = 0.8

class ReceiptScanResult(BaseModel):
    file_id: str
    filename: str
    file_hash: str
    is_duplicate: bool = False
    duplicate_transaction_id: Optional[int] = None
    extraction_status: str  # success, partial, failed, manual
    raw_ocr_text: str
    merchant_name: Optional[str] = None
    transaction_date: Optional[date] = None
    total_rupees: Optional[float] = None
    tax_rupees: Optional[float] = None
    suggested_category_id: Optional[int] = None
    suggested_category_name: Optional[str] = None
    suggested_payment_method_id: Optional[int] = None
    items: List[ExtractedItem] = []
    reconciliation_warning: Optional[str] = None
    ocr_engine_available: bool = True
    ocr_engine_note: Optional[str] = None


class ReceiptConfirmPayload(BaseModel):
    file_id: str
    transaction_date: date
    amount_rupees: float
    description: Optional[str] = None
    category_id: Optional[int] = None
    merchant_name: Optional[str] = None
    payment_method_id: int
    notes: Optional[str] = None
    items: List[ReceiptItemCreate] = []


# --- Analytics & Insights Schemas ---
class KPISummary(BaseModel):
    total_expense_paise: int
    total_expense_rupees: float
    prev_month_expense_paise: int
    prev_month_expense_rupees: float
    change_rupees: float
    percentage_change: Optional[float] = None
    change_type: str  # "increase", "decrease", "same", "new_spending", "no_spending"
    avg_daily_paise: int
    avg_daily_rupees: float
    transaction_count: int
    budget_total_paise: int
    budget_total_rupees: float
    budget_remaining_paise: int
    budget_remaining_rupees: float
    budget_utilization_pct: float

class CategorySpend(BaseModel):
    category_id: Optional[int] = None
    category_name: str
    amount_paise: int
    amount_rupees: float
    percentage: float
    transaction_count: int

class DailySpend(BaseModel):
    date: str
    amount_paise: int
    amount_rupees: float
    count: int

class CategoryComparison(BaseModel):
    category_id: Optional[int]
    category_name: str
    current_paise: int
    current_rupees: float
    prev_paise: int
    prev_rupees: float
    difference_rupees: float
    percentage_change: Optional[float] = None
    status: str  # "increased", "decreased", "steady", "new_spending", "stopped_spending"

class AnomalyItem(BaseModel):
    transaction_id: int
    date: date
    merchant_name: Optional[str]
    category_name: str
    amount_rupees: float
    score: float
    reason: str
    method: str  # "isolation_forest" or "statistical_iqr"

class InsightCard(BaseModel):
    id: str
    title: str
    category: str
    text: str
    type: str  # "info", "warning", "tip", "alert"
    metric_basis: str
    is_ai_generated: bool = False
    supporting_transaction_ids: List[int] = []

class AIExplainRequest(BaseModel):
    month: Optional[str] = None  # YYYY-MM
    user_question: Optional[str] = None

class AIExplainResponse(BaseModel):
    insights: List[InsightCard]
    ai_available: bool
    model_name: str
    mode: str  # "ollama_local" or "deterministic_fallback"
    summary_text: str
