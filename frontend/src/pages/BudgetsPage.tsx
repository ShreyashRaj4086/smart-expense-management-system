import React, { useEffect, useState } from 'react';
import {
  Wallet,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Edit2,
  ArrowRight,
  TrendingUp,
  Percent,
} from 'lucide-react';
import { api } from '../services/api';
import { Budget, Category } from '../types';
import { formatRupees, formatMonthName } from '../utils/formatters';
import { Modal } from '../components/Modal';
import { EmptyState } from '../components/EmptyState';

interface BudgetsPageProps {
  selectedMonth: string;
}

export const BudgetsPage: React.FC<BudgetsPageProps> = ({ selectedMonth }) => {
  const [loading, setLoading] = useState(true);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [deletingBudget, setDeletingBudget] = useState<Budget | null>(null);

  // Form State
  const [formCatId, setFormCatId] = useState<string>('');
  const [formBudgetRupees, setFormBudgetRupees] = useState('');
  const [formError, setFormError] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [bRes, cRes] = await Promise.all([
        api.getBudgets(selectedMonth),
        api.getCategories(),
      ]);
      setBudgets(bRes);
      setCategories(cRes);
      if (cRes.length > 0 && !formCatId) {
        setFormCatId(cRes[0].category_id.toString());
      }
    } catch (err) {
      console.error('Failed to load budgets:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedMonth]);

  const handleOpenAddOrEdit = (b?: Budget) => {
    if (b) {
      setEditingBudget(b);
      setFormCatId(b.category_id.toString());
      setFormBudgetRupees(b.budget_rupees.toString());
    } else {
      setEditingBudget(null);
      setFormBudgetRupees('');
      if (categories.length > 0) {
        setFormCatId(categories[0].category_id.toString());
      }
    }
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const amt = parseFloat(formBudgetRupees);
    if (isNaN(amt) || amt <= 0) {
      setFormError('Please enter a valid positive budget amount in rupees.');
      return;
    }
    if (!formCatId) {
      setFormError('Please select a category.');
      return;
    }

    try {
      await api.setBudget({
        category_id: parseInt(formCatId, 10),
        month_start: `${selectedMonth}-01`,
        budget_rupees: amt,
      });
      setIsModalOpen(false);
      setFormBudgetRupees('');
      setEditingBudget(null);
      loadData();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save budget.');
    }
  };

  const handleDeleteBudget = async () => {
    if (!deletingBudget) return;
    try {
      await api.deleteBudget(deletingBudget.budget_id);
      setDeletingBudget(null);
      loadData();
    } catch (err: any) {
      alert(`Failed to delete budget: ${err.message}`);
    }
  };

  const totalBudget = budgets.reduce((acc, b) => acc + b.budget_rupees, 0);
  const totalSpent = budgets.reduce((acc, b) => acc + b.spent_rupees, 0);
  const totalRemaining = totalBudget - totalSpent;
  const overallPct = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;

  if (loading) {
    return (
      <div className="p-8 space-y-6 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="h-28 bg-white rounded-2xl border border-slate-200/80 animate-pulse" />
          <div className="h-28 bg-white rounded-2xl border border-slate-200/80 animate-pulse" />
          <div className="h-28 bg-white rounded-2xl border border-slate-200/80 animate-pulse" />
          <div className="h-28 bg-white rounded-2xl border border-slate-200/80 animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-40 bg-white rounded-2xl border border-slate-200/80 animate-pulse" />
          <div className="h-40 bg-white rounded-2xl border border-slate-200/80 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6 max-w-6xl mx-auto">
      {/* Page Header Bar */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-900">
            Monthly Budget Overview — {formatMonthName(selectedMonth)}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Set and track category limits with automatic threshold alerts.
          </p>
        </div>

        <button
          onClick={() => handleOpenAddOrEdit()}
          className="flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Set Category Budget</span>
        </button>
      </div>

      {/* 4 Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Budgeted */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Total Budgeted
          </span>
          <div className="mt-2">
            <div className="text-2xl font-bold text-slate-900 tabular-nums">
              {formatRupees(totalBudget)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Across {budgets.length} monitored {budgets.length === 1 ? 'category' : 'categories'}
            </div>
          </div>
        </div>

        {/* Total Spent */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Total Spent
          </span>
          <div className="mt-2">
            <div className="text-2xl font-bold text-slate-900 tabular-nums">
              {formatRupees(totalSpent)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              In {formatMonthName(selectedMonth)}
            </div>
          </div>
        </div>

        {/* Remaining */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            {totalRemaining >= 0 ? 'Remaining Balance' : 'Net Overspend'}
          </span>
          <div className="mt-2">
            <div
              className={`text-2xl font-bold tabular-nums ${
                totalRemaining >= 0 ? 'text-emerald-600' : 'text-rose-600'
              }`}
            >
              {totalRemaining >= 0
                ? formatRupees(totalRemaining)
                : `-${formatRupees(Math.abs(totalRemaining))}`}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              {totalRemaining >= 0 ? 'Available buffer' : 'Exceeded total budget'}
            </div>
          </div>
        </div>

        {/* Overall Utilization */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Overall Utilization
          </span>
          <div className="mt-2">
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold text-slate-900 tabular-nums">
                {overallPct}%
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  overallPct >= 100
                    ? 'bg-rose-100 text-rose-700'
                    : overallPct >= 80
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-emerald-100 text-emerald-700'
                }`}
              >
                {overallPct >= 100 ? 'Exceeded' : overallPct >= 80 ? 'Near Limit' : 'Healthy'}
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2.5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  overallPct >= 100
                    ? 'bg-rose-500'
                    : overallPct >= 80
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(overallPct, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Category Budgets Grid */}
      {budgets.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title={`No budgets configured for ${formatMonthName(selectedMonth)}`}
          description="Create your first category budget to keep expenditure under control."
          actionText="+ Set Category Budget"
          onAction={() => handleOpenAddOrEdit()}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {budgets.map((b) => {
            const isExceeded = b.status === 'exceeded' || b.percentage_used >= 100;
            const isWarning = b.status === 'warning' || (b.percentage_used >= 80 && !isExceeded);

            return (
              <div
                key={b.budget_id}
                className={`p-6 rounded-2xl border bg-white shadow-xs space-y-4 transition-all ${
                  isExceeded
                    ? 'border-rose-200/90 shadow-rose-50/50'
                    : isWarning
                    ? 'border-amber-200/90 shadow-amber-50/50'
                    : 'border-slate-200/80 hover:border-slate-300'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">{b.category_name}</h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Budget limit: <span className="font-semibold text-slate-800 tabular-nums">{formatRupees(b.budget_rupees)}</span>
                    </p>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span
                      className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                        isExceeded
                          ? 'bg-rose-100 text-rose-700'
                          : isWarning
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {isExceeded ? 'Exceeded' : isWarning ? 'Warning' : 'On Track'}
                    </span>
                    <button
                      onClick={() => handleOpenAddOrEdit(b)}
                      className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 transition-colors"
                      title="Edit limit"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDeletingBudget(b)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 transition-colors"
                      title="Delete budget"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Progress Bar & Details */}
                <div className="space-y-2">
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        isExceeded
                          ? 'bg-rose-500'
                          : isWarning
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(b.percentage_used, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-medium text-slate-700">
                      Spent:{' '}
                      <strong className="font-semibold text-slate-900 tabular-nums">
                        {formatRupees(b.spent_rupees)}
                      </strong>{' '}
                      <span className="text-slate-400">({b.percentage_used}%)</span>
                    </span>
                    <span
                      className={`font-semibold tabular-nums ${
                        b.remaining_rupees < 0 ? 'text-rose-600' : 'text-slate-600'
                      }`}
                    >
                      {b.remaining_rupees < 0
                        ? `Over by ${formatRupees(Math.abs(b.remaining_rupees))}`
                        : `${formatRupees(b.remaining_rupees)} left`}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Set / Edit Budget Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingBudget ? 'Edit Category Budget' : 'Set Category Budget'}
        subtitle={`Applies to ${formatMonthName(selectedMonth)}.`}
        maxWidth="sm"
      >
        <form onSubmit={handleSaveBudget} className="space-y-4">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium">
              {formError}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Category</label>
            <select
              value={formCatId}
              onChange={(e) => setFormCatId(e.target.value)}
              disabled={editingBudget !== null}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none focus:border-indigo-500 focus:bg-white cursor-pointer disabled:opacity-60"
            >
              {categories.map((c) => (
                <option key={c.category_id} value={c.category_id.toString()}>
                  {c.category_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Monthly Budget Limit (₹)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">
                ₹
              </span>
              <input
                type="number"
                step="1"
                required
                placeholder="e.g. 5000"
                value={formBudgetRupees}
                onChange={(e) => setFormBudgetRupees(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-900 font-semibold outline-none focus:border-indigo-500 focus:bg-white tabular-nums"
              />
            </div>
          </div>

          <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs cursor-pointer transition-colors"
            >
              Save Budget
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deletingBudget !== null}
        onClose={() => setDeletingBudget(null)}
        title="Delete Budget Limit"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            Are you sure you want to remove the monthly spending limit for{' '}
            <strong className="text-slate-900">{deletingBudget?.category_name}</strong> in{' '}
            {formatMonthName(selectedMonth)}? Past transactions will remain intact.
          </p>
          <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
            <button
              onClick={() => setDeletingBudget(null)}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteBudget}
              className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl cursor-pointer transition-colors shadow-xs"
            >
              Confirm Delete
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
