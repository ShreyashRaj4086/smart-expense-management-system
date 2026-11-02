import React from 'react';
import { Plus, ScanLine, Calendar } from 'lucide-react';
import { formatMonthName } from '../utils/formatters';

interface NavbarProps {
  title: string;
  subtitle: string;
  selectedMonth: string;
  onSelectMonth: (month: string) => void;
  onOpenAddExpense: () => void;
  onOpenScanReceipt: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  title,
  subtitle,
  selectedMonth,
  onSelectMonth,
  onOpenAddExpense,
  onOpenScanReceipt,
}) => {
  const availableMonths = [
    '2026-10',
    '2026-09',
    '2026-08',
    '2026-07',
  ];

  return (
    <header className="h-16 bg-white/95 backdrop-blur-xs border-b border-slate-200/80 px-8 flex items-center justify-between sticky top-0 z-20 transition-all">
      <div className="min-w-0 pr-4">
        <h2 className="text-lg font-bold text-slate-900 tracking-tight truncate">{title}</h2>
        <p className="text-xs text-slate-500 font-normal truncate mt-0.5">{subtitle}</p>
      </div>

      <div className="flex items-center space-x-2.5 shrink-0">
        {/* Month Selector */}
        <div className="h-9 flex items-center space-x-2 bg-slate-50 hover:bg-slate-100/70 rounded-xl px-3 border border-slate-200/80 transition-colors shadow-2xs">
          <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <select
            value={selectedMonth}
            onChange={(e) => onSelectMonth(e.target.value)}
            className="bg-transparent text-xs font-semibold text-slate-700 outline-none cursor-pointer pr-1"
            aria-label="Select reporting month"
          >
            {availableMonths.map((m) => (
              <option key={m} value={m}>
                {formatMonthName(m)}
              </option>
            ))}
          </select>
        </div>

        {/* Scan Receipt Action */}
        <button
          onClick={onOpenScanReceipt}
          className="h-9 flex items-center space-x-1.5 px-3.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 hover:text-slate-900 border border-slate-200/90 rounded-xl shadow-2xs transition-all cursor-pointer"
        >
          <ScanLine className="w-3.5 h-3.5 text-slate-500" />
          <span>Scan Receipt</span>
        </button>

        {/* Add Expense Action */}
        <button
          onClick={onOpenAddExpense}
          className="h-9 flex items-center space-x-1.5 px-4 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs shadow-indigo-100 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Add Expense</span>
        </button>
      </div>
    </header>
  );
};
