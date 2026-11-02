export interface Category {
  category_id: number;
  category_name: string;
  parent_category_id?: number | null;
  created_at?: string;
}

export interface PaymentMethod {
  payment_method_id: number;
  method_name: string;
}

export interface ReceiptItem {
  item_id?: number;
  item_name: string;
  quantity: number;
  unit_price_rupees?: number | null;
  unit_price_paise?: number | null;
  line_total_rupees: number;
  line_total_paise?: number | null;
  category_id?: number | null;
  confidence_score?: number | null;
}

export interface Receipt {
  receipt_id: number;
  transaction_id: number;
  stored_path: string;
  original_filename: string;
  file_hash: string;
  raw_ocr_text?: string;
  extraction_status: string;
  scanned_at: string;
  items: ReceiptItem[];
}

export interface Transaction {
  transaction_id: number;
  transaction_date: string;
  amount_paise: number;
  amount_rupees: number;
  transaction_type: 'expense' | 'income' | 'refund';
  description?: string;
  category_id?: number | null;
  category_name?: string | null;
  merchant_id?: number | null;
  merchant_name?: string | null;
  payment_method_id: number;
  payment_method_name?: string;
  source: 'manual' | 'receipt';
  notes?: string | null;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
  has_receipt?: boolean;
  receipt_id?: number | null;
  receipt?: Receipt;
}

export interface KPISummary {
  total_expense_paise: number;
  total_expense_rupees: number;
  prev_month_expense_paise: number;
  prev_month_expense_rupees: number;
  change_rupees: number;
  percentage_change: number | null;
  change_type: 'increase' | 'decrease' | 'same' | 'new_spending' | 'no_spending';
  avg_daily_paise: number;
  avg_daily_rupees: number;
  transaction_count: number;
  budget_total_paise: number;
  budget_total_rupees: number;
  budget_remaining_paise: number;
  budget_remaining_rupees: number;
  budget_utilization_pct: number;
}

export interface CategorySpend {
  category_id: number | null;
  category_name: string;
  amount_paise: number;
  amount_rupees: number;
  percentage: number;
  transaction_count: number;
}

export interface DailySpend {
  date: string;
  amount_paise: number;
  amount_rupees: number;
  count: number;
}

export interface CategoryComparison {
  category_id: number | null;
  category_name: string;
  current_paise: number;
  current_rupees: number;
  prev_paise: number;
  prev_rupees: number;
  difference_rupees: number;
  percentage_change: number | null;
  status: 'increased' | 'decreased' | 'steady' | 'new_spending' | 'stopped_spending';
}

export interface AnomalyItem {
  transaction_id: number;
  date: string;
  merchant_name?: string;
  category_name: string;
  amount_rupees: number;
  score: number;
  reason: string;
  method: 'isolation_forest' | 'statistical_iqr';
}

export interface InsightCard {
  id: string;
  title: string;
  category: string;
  text: string;
  type: 'info' | 'warning' | 'tip' | 'alert';
  metric_basis: string;
  is_ai_generated: boolean;
}

export interface AIExplainResponse {
  insights: InsightCard[];
  ai_available: boolean;
  model_name: string;
  mode: 'ollama_local' | 'deterministic_fallback';
  summary_text: string;
}

export interface Budget {
  budget_id: number;
  category_id: number;
  category_name: string;
  month_start: string;
  budget_paise: number;
  budget_rupees: number;
  spent_paise: number;
  spent_rupees: number;
  remaining_paise: number;
  remaining_rupees: number;
  percentage_used: number;
  status: 'ok' | 'warning' | 'exceeded';
  created_at: string;
}

export interface ReceiptScanResult {
  file_id: string;
  filename: string;
  file_hash: string;
  is_duplicate: boolean;
  duplicate_transaction_id?: number | null;
  extraction_status: string;
  raw_ocr_text: string;
  merchant_name?: string | null;
  transaction_date?: string | null;
  total_rupees?: number | null;
  tax_rupees?: number | null;
  suggested_category_id?: number | null;
  suggested_category_name?: string | null;
  suggested_payment_method_id?: number | null;
  items: Array<{
    item_name: string;
    quantity: number;
    unit_price_rupees?: number | null;
    line_total_rupees: number;
    confidence: number;
  }>;
  reconciliation_warning?: string | null;
  ocr_engine_available: boolean;
  ocr_engine_note?: string | null;
}

export interface SystemStatus {
  database: {
    path: string;
    exists: boolean;
    total_transactions: number;
    user_transactions: number;
    demo_transactions: number;
  };
  storage: {
    receipts_directory: string;
    receipt_files_count: number;
  };
  ocr: {
    available: boolean;
    executable_path: string;
    instructions: string;
  };
  ai: {
    available: boolean;
    url: string;
    configured_model: string;
    available_models: string[];
    model_installed: boolean;
    message: string;
  };
  currency: string;
}
