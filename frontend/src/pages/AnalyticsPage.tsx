import React, { useEffect, useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Sparkles,
  AlertTriangle,
  HelpCircle,
  Cpu,
  RefreshCw,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  ShieldCheck,
  Send,
  Zap,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import { api } from '../services/api';
import {
  CategoryComparison,
  AnomalyItem,
  AIExplainResponse,
  InsightCard,
} from '../types';
import { formatRupees, formatDate, formatMonthName } from '../utils/formatters';

interface AnalyticsPageProps {
  selectedMonth: string;
}

const SUGGESTION_PROMPTS = [
  'Where did food price increase?',
  'What is my largest purchase?',
  'Which category changed the most?',
  'Summarize this month budget risks',
];

export const AnalyticsPage: React.FC<AnalyticsPageProps> = ({ selectedMonth }) => {
  const [loading, setLoading] = useState(true);
  const [comparisons, setComparisons] = useState<CategoryComparison[]>([]);
  const [anomalies, setAnomalies] = useState<AnomalyItem[]>([]);
  const [largestTxns, setLargestTxns] = useState<any[]>([]);
  const [aiData, setAiData] = useState<AIExplainResponse | null>(null);
  const [userQuestion, setUserQuestion] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [compRes, anomRes, largeRes, aiRes] = await Promise.all([
        api.getCategoryComparison(selectedMonth),
        api.getAnomalies(selectedMonth),
        api.getLargestTransactions(selectedMonth, 5),
        api.explainExpenditure(selectedMonth),
      ]);

      setComparisons(compRes);
      setAnomalies(anomRes);
      setLargestTxns(largeRes);
      setAiData(aiRes);
    } catch (err) {
      console.error('Failed to load analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedMonth]);

  const handleAskAI = async (e?: React.FormEvent, questionText?: string) => {
    if (e) e.preventDefault();
    const query = questionText !== undefined ? questionText : userQuestion;
    setAiLoading(true);
    try {
      const res = await api.explainExpenditure(selectedMonth, query || undefined);
      setAiData(res);
      if (questionText !== undefined) {
        setUserQuestion(questionText);
      }
    } catch (err) {
      console.error('AI query failed:', err);
    } finally {
      setAiLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 space-y-6 max-w-7xl mx-auto">
        <div className="h-64 bg-white rounded-2xl border border-slate-200/80 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-72 bg-white rounded-2xl border border-slate-200/80 animate-pulse" />
          <div className="h-72 bg-white rounded-2xl border border-slate-200/80 animate-pulse" />
        </div>
      </div>
    );
  }

  // Chart data for comparisons (sorted by absolute difference or current spend)
  const compChartData = comparisons.slice(0, 8).map((c) => ({
    name: c.category_name,
    'This Month': c.current_rupees,
    'Last Month': c.prev_rupees,
  }));

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      {/* 1. AI Explanation & Natural Language Intelligence Panel */}
      <div className="bg-white rounded-2xl border border-indigo-100/90 shadow-xs p-6 md:p-7 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">
                  Spending Insights & Local AI Explanation
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Verified SQL analytics explained in natural language. Zero cloud exposure or fabricated data.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {aiData?.mode === 'ollama_local' ? (
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Local Ollama ({aiData.model_name})</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                <Cpu className="w-3.5 h-3.5 text-indigo-600" />
                <span>Deterministic SQL Mode</span>
              </span>
            )}
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Offline</span>
            </span>
          </div>
        </div>

        {/* AI Synthesis Summary Text Box */}
        {aiData?.summary_text && (
          <div className="relative p-5 bg-gradient-to-br from-indigo-50/50 via-slate-50 to-white rounded-xl border border-indigo-100 text-slate-800 text-[13px] leading-relaxed font-normal shadow-2xs">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 mt-0.5">
                <Zap className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 space-y-2">
                <div className="font-semibold text-xs text-indigo-900 uppercase tracking-wider">
                  Analysis for {formatMonthName(selectedMonth)}
                </div>
                <div className="text-slate-800 leading-relaxed font-normal whitespace-pre-line">
                  {aiData.summary_text}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Ask Question Input with Suggestion Chips */}
        <div className="space-y-3">
          <form onSubmit={(e) => handleAskAI(e)} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Ask a question about your spending (e.g. 'Where did food price increase?')..."
                value={userQuestion}
                onChange={(e) => setUserQuestion(e.target.value)}
                className="w-full bg-slate-50/80 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 outline-none focus:border-indigo-500 focus:bg-white transition-all shadow-2xs"
              />
            </div>
            <button
              type="submit"
              disabled={aiLoading}
              className="px-5 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
            >
              {aiLoading ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              <span>{aiLoading ? 'Analyzing...' : 'Ask AI'}</span>
            </button>
          </form>

          {/* Quick Prompt Suggestion Chips */}
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            <span className="text-[11px] font-medium text-slate-600 mr-1 flex items-center gap-1">
              Suggestions:
            </span>
            {SUGGESTION_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => handleAskAI(undefined, prompt)}
                disabled={aiLoading}
                className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200/80 hover:border-indigo-200 transition-colors cursor-pointer disabled:opacity-50"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>

        {/* Structured Insight Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
          {aiData?.insights.map((card) => {
            const isAlert = card.type === 'alert';
            const isWarning = card.type === 'warning';
            const isTip = card.type === 'tip';

            return (
              <div
                key={card.id}
                className={`p-4 rounded-xl border text-xs space-y-2.5 transition-all shadow-2xs ${
                  isAlert
                    ? 'bg-rose-50/50 border-rose-200 text-rose-950'
                    : isWarning
                    ? 'bg-amber-50/50 border-amber-200 text-amber-950'
                    : isTip
                    ? 'bg-emerald-50/50 border-emerald-200 text-emerald-950'
                    : 'bg-white border-slate-200/80 text-slate-900'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold uppercase tracking-wider text-[10px] text-slate-500">
                    {card.category}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isAlert
                        ? 'bg-rose-100 text-rose-700'
                        : isWarning
                        ? 'bg-amber-100 text-amber-700'
                        : isTip
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-indigo-50 text-indigo-700'
                    }`}
                  >
                    {card.metric_basis}
                  </span>
                </div>
                <h5 className="font-bold text-slate-900 text-xs">{card.title}</h5>
                <p className="text-[11px] text-slate-600 leading-relaxed font-normal">
                  {card.text}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Month-over-Month Category Comparison */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 md:p-7 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Month-over-Month Category Comparison
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Comparative analysis for {formatMonthName(selectedMonth)} against the preceding month.
            </p>
          </div>
        </div>

        {/* Comparison Bar Chart */}
        {compChartData.length > 0 && (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={compChartData}
                margin={{ top: 10, right: 10, left: 0, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="name"
                  stroke="#94a3b8"
                  fontSize={11}
                  interval={0}
                  angle={-15}
                  textAnchor="end"
                />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={11}
                  tickFormatter={(val) => `₹${val}`}
                />
                <Tooltip
                  formatter={(value: any) => [`₹${Number(value || 0).toFixed(2)}`, '']}
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderRadius: '12px',
                    borderColor: '#e2e8f0',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Bar
                  dataKey="Last Month"
                  fill="#94a3b8"
                  radius={[4, 4, 0, 0]}
                  barSize={20}
                />
                <Bar
                  dataKey="This Month"
                  fill="#4f46e5"
                  radius={[4, 4, 0, 0]}
                  barSize={20}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Comparison Table */}
        <div className="border border-slate-200/80 rounded-xl overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 font-semibold text-[11px]">
              <tr>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4 text-right">Current Month</th>
                <th className="py-3 px-4 text-right">Previous Month</th>
                <th className="py-3 px-4 text-right">Difference</th>
                <th className="py-3 px-4 text-center">Trend Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {comparisons.map((c) => (
                <tr key={c.category_id || c.category_name} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3 px-4 font-semibold text-slate-900">{c.category_name}</td>
                  <td className="py-3 px-4 text-right font-semibold text-slate-900 tabular-nums">
                    {formatRupees(c.current_rupees)}
                  </td>
                  <td className="py-3 px-4 text-right text-slate-500 tabular-nums font-medium">
                    {formatRupees(c.prev_rupees)}
                  </td>
                  <td className="py-3 px-4 text-right font-semibold tabular-nums">
                    {c.difference_rupees > 0 ? (
                      <span className="text-rose-600">+{formatRupees(c.difference_rupees)}</span>
                    ) : c.difference_rupees < 0 ? (
                      <span className="text-emerald-600">-{formatRupees(Math.abs(c.difference_rupees))}</span>
                    ) : (
                      <span className="text-slate-400">₹0.00</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {c.status === 'increased' && (
                      <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 border border-rose-200/80 px-2 py-0.5 rounded-full text-[10px] font-semibold">
                        <TrendingUp className="w-3 h-3" />
                        +{c.percentage_change}%
                      </span>
                    )}
                    {c.status === 'decreased' && (
                      <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200/80 px-2 py-0.5 rounded-full text-[10px] font-semibold">
                        <TrendingDown className="w-3 h-3" />
                        {c.percentage_change}%
                      </span>
                    )}
                    {c.status === 'new_spending' && (
                      <span className="bg-indigo-50 text-indigo-700 border border-indigo-200/80 px-2 py-0.5 rounded-full text-[10px] font-semibold">
                        New Category
                      </span>
                    )}
                    {c.status === 'stopped_spending' && (
                      <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-[10px] font-medium">
                        Zero Spending
                      </span>
                    )}
                    {c.status === 'steady' && (
                      <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-[10px] font-medium">
                        Steady
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Unusual Purchases / ML Anomaly Detection Panel */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 md:p-7 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span>Unusual Purchase Detection</span>
              <span className="text-[10px] font-bold bg-amber-50 text-amber-700 px-2.5 py-0.5 rounded-full border border-amber-200">
                scikit-learn Isolation Forest
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Statistical and machine learning anomaly model flags purchases deviating from habitual spending distributions. Flagged items are never modified automatically.
            </p>
          </div>
        </div>

        {anomalies.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 bg-slate-50/70 rounded-xl border border-slate-100">
            No unusual spending anomalies detected in {formatMonthName(selectedMonth)}. All purchases fall within standard bounds.
          </div>
        ) : (
          <div className="space-y-3">
            {anomalies.map((anom) => (
              <div
                key={anom.transaction_id}
                className="p-4 bg-amber-50/30 border border-amber-200/70 rounded-xl flex flex-wrap sm:flex-nowrap items-start justify-between gap-4"
              >
                <div className="flex items-start space-x-3.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-xs text-slate-900">
                        {anom.merchant_name || 'Expense'}
                      </span>
                      <span className="bg-white text-slate-700 border border-slate-200 px-2 py-0.5 rounded text-[10px] font-medium">
                        {anom.category_name}
                      </span>
                      <span className="text-slate-400 text-[11px]">{formatDate(anom.date)}</span>
                    </div>
                    <p className="text-xs text-amber-950 mt-1.5 leading-relaxed font-medium">
                      {anom.reason}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-bold text-slate-900 tabular-nums">
                    {formatRupees(anom.amount_rupees)}
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 uppercase">
                    {anom.method}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. Largest Transactions in Month */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 md:p-7 space-y-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Largest Purchases in Period</h3>
          <p className="text-xs text-slate-500 mt-0.5">Top expenditures by total monetary amount.</p>
        </div>
        <div className="divide-y divide-slate-100">
          {largestTxns.map((t, idx) => (
            <div key={t.transaction_id} className="py-3 flex items-center justify-between text-xs">
              <div className="flex items-center space-x-3.5">
                <span className="w-6 h-6 rounded-md bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-[11px]">
                  {idx + 1}
                </span>
                <div>
                  <div className="font-bold text-slate-900">{t.merchant_name || t.description}</div>
                  <div className="text-slate-400 text-[11px]">
                    {formatDate(t.transaction_date)} • {t.category_name}
                  </div>
                </div>
              </div>
              <div className="font-bold text-slate-900 text-sm tabular-nums">
                {formatRupees(t.amount_rupees)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
