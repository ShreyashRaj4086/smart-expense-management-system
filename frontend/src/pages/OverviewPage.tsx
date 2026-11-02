import React, { useEffect, useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  Wallet,
  Receipt,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  PieChart as PieIcon,
  AlertCircle,
  Clock,
  Plus,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from 'recharts';
import { api } from '../services/api';
import { KPISummary, CategorySpend, DailySpend, CategoryComparison, Transaction, InsightCard } from '../types';
import { formatRupees, formatDate, formatMonthName } from '../utils/formatters';
import { EmptyState } from '../components/EmptyState';

const CATEGORY_COLORS = [
  '#4f46e5', // indigo
  '#06b6d4', // cyan
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ec4899', // pink
  '#8b5cf6', // violet
  '#64748b', // slate
  '#ef4444', // red
];

interface OverviewPageProps {
  selectedMonth: string;
  onOpenAddExpense: () => void;
  onOpenScanReceipt: () => void;
  onGoToTransactions: () => void;
  onGoToAnalytics: () => void;
}

export const OverviewPage: React.FC<OverviewPageProps> = ({
  selectedMonth,
  onOpenAddExpense,
  onOpenScanReceipt,
  onGoToTransactions,
  onGoToAnalytics,
}) => {
  const [loading, setLoading] = useState(true);
  const [kpi, setKpi] = useState<KPISummary | null>(null);
  const [categories, setCategories] = useState<CategorySpend[]>([]);
  const [dailyTrend, setDailyTrend] = useState<DailySpend[]>([]);
  const [comparisons, setComparisons] = useState<CategoryComparison[]>([]);
  const [recentTxns, setRecentTxns] = useState<Transaction[]>([]);
  const [insights, setInsights] = useState<InsightCard[]>([]);
  const [chartMode, setChartMode] = useState<'daily' | 'cumulative'>('daily');

  const loadData = async () => {
    setLoading(true);
    try {
      const [kpiRes, catRes, trendRes, compRes, txnsRes, aiRes] = await Promise.all([
        api.getKPISummary(selectedMonth),
        api.getCategorySpending(selectedMonth),
        api.getSpendingTrend(selectedMonth),
        api.getCategoryComparison(selectedMonth),
        api.getTransactions({ limit: 6, month: selectedMonth }),
        api.explainExpenditure(selectedMonth),
      ]);

      setKpi(kpiRes);
      setCategories(catRes);
      setDailyTrend(trendRes);
      setComparisons(compRes);
      setRecentTxns(txnsRes.items);
      setInsights(aiRes.insights);
    } catch (err) {
      console.error('Failed to load overview data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedMonth]);

  if (loading) {
    return (
      <div className="p-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-white rounded-2xl border border-slate-200 animate-pulse p-6" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-80 bg-white rounded-2xl border border-slate-200 animate-pulse" />
          <div className="h-80 bg-white rounded-2xl border border-slate-200 animate-pulse" />
        </div>
      </div>
    );
  }

  const hasData = kpi && kpi.transaction_count > 0;

  if (!hasData) {
    return (
      <div className="p-8">
        <EmptyState
          icon={Receipt}
          title={`No expenses recorded in ${formatMonthName(selectedMonth)}`}
          description="Start tracking by adding a manual expense, scanning a receipt, or loading sample demonstration records."
          actionText="+ Add Expense"
          onAction={onOpenAddExpense}
          secondaryActionText="Load Demo Data"
          onSecondaryAction={async () => {
            await api.loadDemoData();
            loadData();
          }}
        />
      </div>
    );
  }

  // Formatting chart data (cumulative vs daily)
  let runningTotal = 0;
  const chartTrend = dailyTrend.map((d) => {
    runningTotal += d.amount_rupees;
    return {
      day: parseInt(d.date.split('-')[2], 10),
      amount: chartMode === 'cumulative' ? runningTotal : d.amount_rupees,
      date: d.date,
    };
  });

  const pieData = categories.slice(0, 6).map((c) => ({
    name: c.category_name,
    value: c.amount_rupees,
    percentage: c.percentage,
  }));

  const avgTxnSize = kpi && kpi.transaction_count > 0 ? kpi.total_expense_rupees / kpi.transaction_count : 0;

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* 4 Primary Metric KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Expenditure */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-2.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Expenditure</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 tracking-tight tabular-nums">
            {formatRupees(kpi?.total_expense_rupees)}
          </div>
          <div className="mt-2.5 flex items-center text-xs">
            {kpi?.change_type === 'increase' && (
              <span className="inline-flex items-center text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200/60 px-2 py-0.5 rounded-full">
                <ArrowUpRight className="w-3 h-3 mr-0.5" />
                +{kpi.percentage_change}% (+{formatRupees(kpi.change_rupees)})
              </span>
            )}
            {kpi?.change_type === 'decrease' && (
              <span className="inline-flex items-center text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-full">
                <ArrowDownRight className="w-3 h-3 mr-0.5" />
                {kpi.percentage_change}% ({formatRupees(kpi.change_rupees)})
              </span>
            )}
            {kpi?.change_type === 'new_spending' && (
              <span className="text-[11px] text-indigo-700 font-semibold bg-indigo-50 px-2 py-0.5 rounded-full">
                New Period
              </span>
            )}
            {kpi?.change_type === 'same' && (
              <span className="text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                No change vs last mo
              </span>
            )}
            <span className="text-[11px] text-slate-400 ml-1.5 font-medium">vs prior month</span>
          </div>
        </div>

        {/* Card 2: Average Daily Spending */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-2.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Daily Average</span>
            <div className="w-8 h-8 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 tracking-tight tabular-nums">
            {formatRupees(kpi?.avg_daily_rupees)}
          </div>
          <div className="mt-2.5 text-[11px] text-slate-500 flex items-center font-medium">
            <Clock className="w-3.5 h-3.5 mr-1 text-slate-400" />
            <span>Paced over calendar days in {formatMonthName(selectedMonth).split(' ')[0]}</span>
          </div>
        </div>

        {/* Card 3: Total Transactions */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-2.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Transactions</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 tracking-tight tabular-nums">
            {kpi?.transaction_count}
          </div>
          <div className="mt-2.5 text-[11px] text-slate-500 font-medium flex items-center justify-between">
            <span>Avg {formatRupees(avgTxnSize)} / purchase</span>
            <span className="text-slate-400 font-mono text-[10px]">{formatMonthName(selectedMonth).split(' ')[0]}</span>
          </div>
        </div>

        {/* Card 4: Budget Status */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-2.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Budget Status</span>
            <div className="w-8 h-8 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          {kpi?.budget_total_rupees && kpi.budget_total_rupees > 0 ? (
            <>
              <div className="flex items-baseline justify-between">
                <span className="text-3xl font-extrabold text-slate-900 tracking-tight tabular-nums">
                  {kpi.budget_utilization_pct}%
                </span>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                  kpi.budget_utilization_pct >= 100
                    ? 'bg-rose-50 text-rose-700 border border-rose-200/60'
                    : kpi.budget_utilization_pct >= 80
                    ? 'bg-amber-50 text-amber-700 border border-amber-200/60'
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                }`}>
                  {kpi.budget_utilization_pct >= 100 ? 'Exceeded' : kpi.budget_utilization_pct >= 80 ? 'Warning' : 'Healthy'}
                </span>
              </div>
              <div className="mt-2.5">
                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      kpi.budget_utilization_pct >= 100
                        ? 'bg-rose-500'
                        : kpi.budget_utilization_pct >= 80
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(kpi.budget_utilization_pct, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-slate-500 mt-1.5 font-medium">
                  <span>Rem: {formatRupees(kpi.budget_remaining_rupees)}</span>
                  <span>Cap: {formatRupees(kpi.budget_total_rupees)}</span>
                </div>
              </div>
            </>
          ) : (
            <div className="py-1">
              <p className="text-xs text-slate-500 font-medium">No budgets set for this month.</p>
              <span className="text-[11px] text-indigo-600 font-semibold cursor-pointer hover:underline" onClick={onGoToAnalytics}>
                Configure limits in Budgets →
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Verified AI / Statistical Insights Banner */}
      {insights.length > 0 && (
        <div className="bg-gradient-to-r from-indigo-50/90 via-white to-indigo-50/50 p-4.5 rounded-2xl border border-indigo-100 shadow-2xs flex items-center justify-between gap-4">
          <div className="flex items-start space-x-3.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                  {insights[0].title}
                </h4>
                <span className="text-[10px] font-bold bg-indigo-100/80 text-indigo-700 px-2 py-0.5 rounded-full">
                  {insights[0].metric_basis}
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5 leading-relaxed font-normal">{insights[0].text}</p>
            </div>
          </div>
          <button
            onClick={onGoToAnalytics}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 whitespace-nowrap px-3.5 py-1.5 bg-white border border-indigo-200/80 rounded-xl shadow-2xs hover:bg-indigo-50 transition-all cursor-pointer shrink-0"
          >
            All Insights →
          </button>
        </div>
      )}

      {/* Charts Section: Daily Spending Trend & Category Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Spending Trend Area Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Spending Over Time</h3>
              <p className="text-xs text-slate-500 font-normal">
                {chartMode === 'daily' ? 'Daily expenses recorded' : 'Cumulative spending pace'} in {formatMonthName(selectedMonth)}
              </p>
            </div>
            {/* Toggle between Daily & Cumulative */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200/60">
              <button
                onClick={() => setChartMode('daily')}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all cursor-pointer ${
                  chartMode === 'daily' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Daily
              </button>
              <button
                onClick={() => setChartMode('cumulative')}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all cursor-pointer ${
                  chartMode === 'cumulative' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Cumulative
              </button>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  tickFormatter={(val) => `₹${val}`}
                />
                <Tooltip
                  formatter={(value: any) => [`₹${Number(value || 0).toFixed(2)}`, chartMode === 'cumulative' ? 'Cumulative Total' : 'Day Total']}
                  labelFormatter={(label) => `Day ${label}`}
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderRadius: '12px',
                    borderColor: '#e2e8f0',
                    fontSize: '12px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.08)',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="amount"
                  stroke="#4f46e5"
                  strokeWidth={2.2}
                  fillOpacity={1}
                  fill="url(#spendGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Breakdown Donut Chart */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Category Share</h3>
              <p className="text-xs text-slate-500 font-normal">Top expenditure categories</p>
            </div>
            <PieIcon className="w-4 h-4 text-slate-400" />
          </div>

          <div className="h-44 w-full my-auto relative flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={56}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {pieData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val: any) => [`₹${Number(val || 0).toFixed(2)}`, 'Amount']}
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderRadius: '12px',
                    borderColor: '#e2e8f0',
                    fontSize: '12px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.08)',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Clean Legend */}
          <div className="space-y-2 pt-3 border-t border-slate-100">
            {categories.slice(0, 4).map((c, i) => (
              <div
                key={c.category_id || i}
                onClick={onGoToTransactions}
                className="flex items-center justify-between text-xs hover:bg-slate-50 p-1 rounded-lg transition-colors cursor-pointer"
                title="View transactions for this category"
              >
                <span className="flex items-center gap-2 text-slate-600 truncate max-w-[140px] font-medium">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }}
                  />
                  {c.category_name}
                </span>
                <span className="font-bold text-slate-900 tabular-nums">
                  {formatRupees(c.amount_rupees)} <span className="text-slate-400 font-normal text-[11px]">({c.percentage}%)</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Transactions List */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Recent Transactions</h3>
            <p className="text-xs text-slate-500 font-normal">Latest recorded expenses in {formatMonthName(selectedMonth)}</p>
          </div>
          <button
            onClick={onGoToTransactions}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1 cursor-pointer"
          >
            <span>View All ({kpi?.transaction_count})</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="divide-y divide-slate-100">
          {recentTxns.map((t) => (
            <div key={t.transaction_id} className="px-6 py-3.5 flex items-center justify-between hover:bg-slate-50/70 transition-colors">
              <div className="flex items-center space-x-3.5">
                <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200/60 flex items-center justify-center text-slate-700 font-bold text-xs shrink-0">
                  {t.merchant_name ? t.merchant_name.charAt(0).toUpperCase() : '₹'}
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900">
                    {t.merchant_name || t.description || 'Expense'}
                  </div>
                  <div className="flex items-center space-x-2 text-xs text-slate-500 mt-0.5">
                    <span className="font-medium text-slate-600">{formatDate(t.transaction_date)}</span>
                    <span className="text-slate-300">•</span>
                    <span className="bg-slate-100/90 text-slate-700 px-2 py-0.5 rounded-md text-[11px] font-semibold border border-slate-200/40">
                      {t.category_name || 'Uncategorized'}
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="text-[11px] text-slate-600 font-medium">{t.payment_method_name}</span>
                    {t.source === 'receipt' && (
                      <span className="bg-indigo-50 text-indigo-700 px-1.5 py-0.2 rounded text-[10px] font-bold border border-indigo-100">
                        Receipt
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-sm font-extrabold text-slate-900 tracking-tight tabular-nums">
                {formatRupees(t.amount_rupees)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
