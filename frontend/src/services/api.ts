import {
  Category,
  PaymentMethod,
  Transaction,
  KPISummary,
  CategorySpend,
  DailySpend,
  CategoryComparison,
  AnomalyItem,
  AIExplainResponse,
  Budget,
  ReceiptScanResult,
  SystemStatus,
} from '../types';

const API_BASE = '/api';

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Accept': 'application/json',
    ...(options.headers || {}),
  };

  const response = await fetch(url, { ...options, headers });
  
  if (!response.ok) {
    let errorMsg = `Error ${response.status}: ${response.statusText}`;
    try {
      const errJson = await response.json();
      if (errJson.detail) {
        errorMsg = typeof errJson.detail === 'string' ? errJson.detail : JSON.stringify(errJson.detail);
      }
    } catch {
      // ignore
    }
    throw new Error(errorMsg);
  }

  return response.json();
}

export const api = {
  // System & Health
  getHealth: () => request<{ status: string; database: string }>('/health'),
  getSystemStatus: () => request<SystemStatus>('/system/status'),
  getPaymentMethods: () => request<PaymentMethod[]>('/payment-methods'),
  loadDemoData: () => request<{ loaded: boolean; message: string; transactions_seeded?: number }>('/system/demo/load', { method: 'POST' }),
  clearDemoData: () => request<{ cleared: boolean; message: string; deleted_count?: number }>('/system/demo/clear', { method: 'POST' }),
  getExportUrl: () => `${API_BASE}/export/transactions`,
  getBackupUrl: () => `${API_BASE}/system/backup`,

  // Categories
  getCategories: () => request<Category[]>('/categories'),
  createCategory: (data: { category_name: string; parent_category_id?: number | null }) =>
    request<Category>('/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  updateCategory: (id: number, data: { category_name?: string }) =>
    request<Category>(`/categories/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  deleteCategory: (id: number, reassign_to_id?: number) => {
    const q = reassign_to_id ? `?reassign_to_id=${reassign_to_id}` : '';
    return request<{ message: string }>(`/categories/${id}${q}`, { method: 'DELETE' });
  },

  // Transactions
  getTransactions: (params: {
    skip?: number;
    limit?: number;
    month?: string;
    category_id?: number;
    payment_method_id?: number;
    source?: string;
    search?: string;
  } = {}) => {
    const searchParams = new URLSearchParams();
    if (params.skip !== undefined) searchParams.append('skip', params.skip.toString());
    if (params.limit !== undefined) searchParams.append('limit', params.limit.toString());
    if (params.month) searchParams.append('month', params.month);
    if (params.category_id) searchParams.append('category_id', params.category_id.toString());
    if (params.payment_method_id) searchParams.append('payment_method_id', params.payment_method_id.toString());
    if (params.source) searchParams.append('source', params.source);
    if (params.search) searchParams.append('search', params.search);
    return request<{ items: Transaction[]; total: number; skip: number; limit: number }>(`/transactions?${searchParams.toString()}`);
  },
  getTransaction: (id: number) => request<Transaction>(`/transactions/${id}`),
  createTransaction: (data: {
    transaction_date: string;
    amount_rupees: number;
    transaction_type?: string;
    description?: string;
    category_id?: number | null;
    merchant_name?: string;
    payment_method_id: number;
    source?: string;
    notes?: string;
  }) =>
    request<Transaction>('/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  updateTransaction: (id: number, data: {
    transaction_date?: string;
    amount_rupees?: number;
    description?: string;
    category_id?: number | null;
    merchant_name?: string;
    payment_method_id?: number;
    notes?: string;
  }) =>
    request<Transaction>(`/transactions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  deleteTransaction: (id: number) => request<{ message: string }>(`/transactions/${id}`, { method: 'DELETE' }),

  // Receipts
  scanReceipt: async (file: File): Promise<ReceiptScanResult> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`${API_BASE}/receipts/scan`, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) {
      let msg = `Error ${response.status}`;
      try {
        const err = await response.json();
        if (err.detail) msg = err.detail;
      } catch {}
      throw new Error(msg);
    }
    return response.json();
  },
  confirmReceipt: (data: {
    file_id: string;
    transaction_date: string;
    amount_rupees: number;
    description?: string;
    category_id?: number | null;
    merchant_name?: string;
    payment_method_id: number;
    notes?: string;
    items: Array<{
      item_name: string;
      quantity: number;
      unit_price_rupees?: number | null;
      line_total_rupees: number;
      category_id?: number | null;
    }>;
  }) =>
    request<Transaction>('/receipts/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  // Analytics
  getKPISummary: (month?: string) => request<KPISummary>(`/analytics/summary${month ? `?month=${month}` : ''}`),
  getCategorySpending: (month?: string) => request<CategorySpend[]>(`/analytics/categories${month ? `?month=${month}` : ''}`),
  getSpendingTrend: (month?: string) => request<DailySpend[]>(`/analytics/trend${month ? `?month=${month}` : ''}`),
  getCategoryComparison: (month?: string) => request<CategoryComparison[]>(`/analytics/comparison${month ? `?month=${month}` : ''}`),
  getAnomalies: (month?: string) => request<AnomalyItem[]>(`/analytics/anomalies${month ? `?month=${month}` : ''}`),
  getLargestTransactions: (month?: string, limit: number = 5) =>
    request<any[]>(`/analytics/largest?limit=${limit}${month ? `&month=${month}` : ''}`),

  // Budgets
  getBudgets: (month?: string) => request<Budget[]>(`/budgets${month ? `?month=${month}` : ''}`),
  setBudget: (data: { category_id: number; month_start: string; budget_rupees: number }) =>
    request<Budget>('/budgets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  deleteBudget: (id: number) => request<{ message: string }>(`/budgets/${id}`, { method: 'DELETE' }),

  // Local AI
  getAIStatus: () => request<{ available: boolean; configured_model: string; message: string }>('/ai/status'),
  explainExpenditure: (month?: string, user_question?: string) =>
    request<AIExplainResponse>('/ai/explain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month, user_question }),
    }),
};
