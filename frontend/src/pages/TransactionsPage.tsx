import React, { useEffect, useState } from 'react';
import {
  Search,
  Filter,
  Plus,
  Trash2,
  Edit2,
  Receipt,
  FileText,
  AlertCircle,
  Calendar,
  CreditCard,
  Tag,
} from 'lucide-react';
import { api } from '../services/api';
import { Transaction, Category, PaymentMethod } from '../types';
import { formatRupees, formatDate, formatMonthName, getTodayISO } from '../utils/formatters';
import { Modal } from '../components/Modal';
import { EmptyState } from '../components/EmptyState';

interface TransactionsPageProps {
  selectedMonth: string;
  isAddModalOpen: boolean;
  onCloseAddModal: () => void;
  onOpenAddModal: () => void;
}

export const TransactionsPage: React.FC<TransactionsPageProps> = ({
  selectedMonth,
  isAddModalOpen,
  onCloseAddModal,
  onOpenAddModal,
}) => {
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCatFilter, setSelectedCatFilter] = useState<string>('all');
  const [selectedSourceFilter, setSelectedSourceFilter] = useState<string>('all');

  // Edit State
  const [editingTxn, setEditingTxn] = useState<Transaction | null>(null);

  // Delete State
  const [deletingTxn, setDeletingTxn] = useState<Transaction | null>(null);

  // Form State for Add / Edit
  const [formDate, setFormDate] = useState(getTodayISO());
  const [formAmount, setFormAmount] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formMerchant, setFormMerchant] = useState('');
  const [formCatId, setFormCatId] = useState<string>('');
  const [formPmId, setFormPmId] = useState<string>('');
  const [formNotes, setFormNotes] = useState('');
  const [formError, setFormError] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [txnsRes, catsRes, pmsRes] = await Promise.all([
        api.getTransactions({
          month: selectedMonth,
          category_id: selectedCatFilter !== 'all' ? parseInt(selectedCatFilter, 10) : undefined,
          source: selectedSourceFilter !== 'all' ? selectedSourceFilter : undefined,
          search: searchTerm || undefined,
          limit: 200,
        }),
        api.getCategories(),
        api.getPaymentMethods(),
      ]);

      setTransactions(txnsRes.items);
      setCategories(catsRes);
      setPaymentMethods(pmsRes);

      if (pmsRes.length > 0 && !formPmId) {
        setFormPmId(pmsRes[0].payment_method_id.toString());
      }
      if (catsRes.length > 0 && !formCatId) {
        setFormCatId(catsRes[0].category_id.toString());
      }
    } catch (err) {
      console.error('Failed to load transactions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedMonth, selectedCatFilter, selectedSourceFilter, searchTerm]);

  const handleOpenEdit = (t: Transaction) => {
    setEditingTxn(t);
    setFormDate(t.transaction_date);
    setFormAmount(t.amount_rupees.toString());
    setFormDesc(t.description || '');
    setFormMerchant(t.merchant_name || '');
    setFormCatId(t.category_id ? t.category_id.toString() : '');
    setFormPmId(t.payment_method_id.toString());
    setFormNotes(t.notes || '');
    setFormError('');
  };

  const resetForm = () => {
    setFormDate(getTodayISO());
    setFormAmount('');
    setFormDesc('');
    setFormMerchant('');
    setFormNotes('');
    setFormError('');
    setEditingTxn(null);
  };

  const handleSaveTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const amt = parseFloat(formAmount);
    if (isNaN(amt) || amt <= 0) {
      setFormError('Please enter a valid positive amount in rupees.');
      return;
    }
    if (!formDate) {
      setFormError('Please select a valid transaction date.');
      return;
    }
    if (!formPmId) {
      setFormError('Please select a payment method.');
      return;
    }

    try {
      if (editingTxn) {
        await api.updateTransaction(editingTxn.transaction_id, {
          transaction_date: formDate,
          amount_rupees: amt,
          description: formDesc || formMerchant || 'Expense',
          merchant_name: formMerchant || undefined,
          category_id: formCatId ? parseInt(formCatId, 10) : null,
          payment_method_id: parseInt(formPmId, 10),
          notes: formNotes || undefined,
        });
        setEditingTxn(null);
      } else {
        await api.createTransaction({
          transaction_date: formDate,
          amount_rupees: amt,
          description: formDesc || formMerchant || 'Expense',
          merchant_name: formMerchant || undefined,
          category_id: formCatId ? parseInt(formCatId, 10) : null,
          payment_method_id: parseInt(formPmId, 10),
          notes: formNotes || undefined,
          source: 'manual',
        });
        onCloseAddModal();
      }
      resetForm();
      loadData();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save transaction.');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingTxn) return;
    try {
      await api.deleteTransaction(deletingTxn.transaction_id);
      setDeletingTxn(null);
      loadData();
    } catch (err: any) {
      alert(`Failed to delete transaction: ${err.message}`);
    }
  };

  const totalFilteredAmount = transactions.reduce((sum, t) => sum + t.amount_rupees, 0);
  const hasActiveFilters = searchTerm !== '' || selectedCatFilter !== 'all' || selectedSourceFilter !== 'all';

  const clearAllFilters = () => {
    setSearchTerm('');
    setSelectedCatFilter('all');
    setSelectedSourceFilter('all');
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Filter and Actions Bar */}
      <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by merchant, description or notes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200/90 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-900 placeholder-slate-400 outline-none focus:border-indigo-500 focus:bg-white transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer p-0.5"
              >
                ✕
              </button>
            )}
          </div>

          {/* Category Filter */}
          <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200/90 rounded-xl px-2.5 py-1.5">
            <Tag className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedCatFilter}
              onChange={(e) => setSelectedCatFilter(e.target.value)}
              className="bg-transparent text-xs text-slate-700 font-semibold outline-none cursor-pointer pr-1"
            >
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c.category_id} value={c.category_id.toString()}>
                  {c.category_name}
                </option>
              ))}
            </select>
          </div>

          {/* Source Filter */}
          <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200/90 rounded-xl px-2.5 py-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedSourceFilter}
              onChange={(e) => setSelectedSourceFilter(e.target.value)}
              className="bg-transparent text-xs text-slate-700 font-semibold outline-none cursor-pointer pr-1"
            >
              <option value="all">All Sources</option>
              <option value="manual">Manual Entry</option>
              <option value="receipt">Scanned Receipt</option>
            </select>
          </div>

          {/* Add Transaction Button */}
          <button
            onClick={onOpenAddModal}
            className="flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs shadow-indigo-100 transition-all cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Add Expense</span>
          </button>
        </div>

        {/* Active Filter Chips & Summary */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              {transactions.length} record{transactions.length === 1 ? '' : 's'}
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-[11px] font-bold text-slate-900 tabular-nums">
              Total: {formatRupees(totalFilteredAmount)}
            </span>

            {hasActiveFilters && (
              <>
                <span className="text-slate-300 ml-1">•</span>
                {selectedCatFilter !== 'all' && (
                  <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md text-[11px] font-semibold flex items-center gap-1">
                    Category: {categories.find((c) => c.category_id.toString() === selectedCatFilter)?.category_name}
                    <button onClick={() => setSelectedCatFilter('all')} className="hover:text-indigo-900 cursor-pointer">✕</button>
                  </span>
                )}
                {selectedSourceFilter !== 'all' && (
                  <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md text-[11px] font-semibold flex items-center gap-1">
                    Source: {selectedSourceFilter === 'receipt' ? 'Receipt' : 'Manual'}
                    <button onClick={() => setSelectedSourceFilter('all')} className="hover:text-indigo-900 cursor-pointer">✕</button>
                  </span>
                )}
                {searchTerm && (
                  <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md text-[11px] font-semibold flex items-center gap-1">
                    Search: "{searchTerm}"
                    <button onClick={() => setSearchTerm('')} className="hover:text-indigo-900 cursor-pointer">✕</button>
                  </span>
                )}
                <button
                  onClick={clearAllFilters}
                  className="text-[11px] font-semibold text-rose-600 hover:text-rose-800 underline ml-1 cursor-pointer"
                >
                  Clear all
                </button>
              </>
            )}
          </div>
          <div className="text-[11px] text-slate-400 font-medium">
            Month: {formatMonthName(selectedMonth)}
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        {transactions.length === 0 ? (
          <div className="p-12">
            <EmptyState
              icon={Receipt}
              title="No transactions found"
              description={
                hasActiveFilters
                  ? "No transactions match your active search or filter criteria. Try clearing filters."
                  : `No expenses have been recorded for ${formatMonthName(selectedMonth)}.`
              }
              actionText={hasActiveFilters ? "Clear Filters" : "+ Add Expense"}
              onAction={hasActiveFilters ? clearAllFilters : onOpenAddModal}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-6">Date</th>
                  <th className="py-3 px-6">Merchant & Notes</th>
                  <th className="py-3 px-6">Category</th>
                  <th className="py-3 px-6">Payment Method</th>
                  <th className="py-3 px-6">Source</th>
                  <th className="py-3 px-6 text-right">Amount (₹)</th>
                  <th className="py-3 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {transactions.map((t) => (
                  <tr key={t.transaction_id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-6 font-medium text-slate-500 whitespace-nowrap">
                      {formatDate(t.transaction_date)}
                    </td>
                    <td className="py-3.5 px-6 font-bold text-slate-900">
                      <div className="flex items-center space-x-2.5">
                        <span className="w-7 h-7 rounded-lg bg-slate-100 border border-slate-200/60 flex items-center justify-center text-slate-600 font-bold text-xs shrink-0">
                          {t.merchant_name ? t.merchant_name.charAt(0).toUpperCase() : '₹'}
                        </span>
                        <div>
                          <div>{t.merchant_name || t.description || 'Expense'}</div>
                          {t.notes && <div className="text-[11px] font-normal text-slate-400 truncate max-w-xs">{t.notes}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-6 whitespace-nowrap">
                      <span className="bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-md text-[11px] font-semibold border border-slate-200/50">
                        {t.category_name || 'Uncategorized'}
                      </span>
                    </td>
                    <td className="py-3.5 px-6 whitespace-nowrap text-slate-600 font-medium">
                      {t.payment_method_name}
                    </td>
                    <td className="py-3.5 px-6 whitespace-nowrap">
                      {t.source === 'receipt' ? (
                        <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md text-[10px] font-bold border border-indigo-100">
                          <Receipt className="w-3 h-3" />
                          Receipt
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md text-[10px] font-medium border border-slate-200/40">
                          <FileText className="w-3 h-3" />
                          Manual
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-6 text-right font-extrabold text-slate-900 text-sm whitespace-nowrap tabular-nums">
                      {formatRupees(t.amount_rupees)}
                    </td>
                    <td className="py-3.5 px-6 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end space-x-1">
                        <button
                          onClick={() => handleOpenEdit(t)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                          title="Edit Transaction"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeletingTxn(t)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Delete Transaction"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Transaction Modal */}
      <Modal
        isOpen={isAddModalOpen || editingTxn !== null}
        onClose={() => {
          onCloseAddModal();
          resetForm();
        }}
        title={editingTxn ? 'Edit Expense Record' : 'Record New Expense'}
        subtitle="Saved to your local SQLite database with integer paise accuracy."
      >
        <form onSubmit={handleSaveTransaction} className="space-y-4">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {/* Amount */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Amount (₹) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-xs">
                  ₹
                </span>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-7 pr-3 py-2 text-xs text-slate-900 font-semibold outline-none focus:border-indigo-500 focus:bg-white"
                />
              </div>
            </div>

            {/* Date */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none focus:border-indigo-500 focus:bg-white"
              />
            </div>
          </div>

          {/* Merchant */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Merchant / Store</label>
            <input
              type="text"
              placeholder="e.g. Swiggy, Chai Point, D-Mart"
              value={formMerchant}
              onChange={(e) => setFormMerchant(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none focus:border-indigo-500 focus:bg-white"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Description</label>
            <input
              type="text"
              placeholder="e.g. Grocery staples, evening snacks"
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none focus:border-indigo-500 focus:bg-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Category */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
              <select
                value={formCatId}
                onChange={(e) => setFormCatId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none focus:border-indigo-500 focus:bg-white cursor-pointer"
              >
                <option value="">Uncategorized</option>
                {categories.map((c) => (
                  <option key={c.category_id} value={c.category_id.toString()}>
                    {c.category_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Payment Method */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Payment Method <span className="text-rose-500">*</span>
              </label>
              <select
                required
                value={formPmId}
                onChange={(e) => setFormPmId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none focus:border-indigo-500 focus:bg-white cursor-pointer"
              >
                {paymentMethods.map((pm) => (
                  <option key={pm.payment_method_id} value={pm.payment_method_id.toString()}>
                    {pm.method_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Notes</label>
            <textarea
              rows={2}
              placeholder="Optional notes or details..."
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none focus:border-indigo-500 focus:bg-white"
            />
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                onCloseAddModal();
                resetForm();
              }}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              {editingTxn ? 'Save Changes' : 'Record Expense'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deletingTxn !== null}
        onClose={() => setDeletingTxn(null)}
        title="Delete Expense Record"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            Are you sure you want to delete this expense of{' '}
            <strong className="text-slate-900">{formatRupees(deletingTxn?.amount_rupees)}</strong> on{' '}
            {formatDate(deletingTxn?.transaction_date)}? This action cannot be undone.
          </p>
          <div className="flex items-center justify-end space-x-2 pt-2">
            <button
              onClick={() => setDeletingTxn(null)}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteConfirm}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors cursor-pointer"
            >
              Delete
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
