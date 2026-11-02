import React, { useState } from 'react';
import {
  LayoutDashboard,
  Receipt,
  ScanLine,
  TrendingUp,
  Wallet,
  Tags,
  Settings,
  ShieldCheck,
  Database,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  systemStatus?: { ocrOk: boolean; aiOk: boolean };
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onSelectTab }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'transactions', label: 'Transactions', icon: Receipt },
    { id: 'scan', label: 'Scan Receipt', icon: ScanLine },
    { id: 'analytics', label: 'Analytics & Insights', icon: TrendingUp },
    { id: 'budgets', label: 'Budgets', icon: Wallet },
    { id: 'categories', label: 'Categories', icon: Tags },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside
      className={`bg-white border-r border-slate-200/80 flex flex-col h-screen select-none sticky top-0 shrink-0 transition-all duration-200 ease-in-out z-20 ${
        isCollapsed ? 'w-[76px]' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div className={`border-b border-slate-100 flex items-center justify-between ${isCollapsed ? 'p-4 justify-center' : 'p-5'}`}>
        <div className="flex items-center space-x-3 overflow-hidden">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-sm shadow-indigo-200 shrink-0">
            <Wallet className="w-4.5 h-4.5" />
          </div>
          {!isCollapsed && (
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-base text-slate-900 tracking-tight">SpendWise</span>
                <span className="text-[10px] font-bold bg-indigo-50 text-indigo-600 px-1.5 py-0.2 rounded border border-indigo-100/60">
                  DBMS
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium truncate">Expenditure Analyser</p>
            </div>
          )}
        </div>

        {/* Collapse Toggle */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={`text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg p-1.5 transition-colors cursor-pointer ${
            isCollapsed ? 'hidden' : 'block'
          }`}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      {/* When collapsed, show small expand button */}
      {isCollapsed && (
        <div className="flex justify-center pt-2">
          <button
            onClick={() => setIsCollapsed(false)}
            className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg p-1.5 transition-colors cursor-pointer"
            title="Expand sidebar"
            aria-label="Expand sidebar"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Navigation Links */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              title={isCollapsed ? item.label : undefined}
              className={`w-full flex items-center rounded-xl text-xs font-semibold transition-all cursor-pointer relative group ${
                isCollapsed
                  ? 'justify-center p-3'
                  : 'space-x-3 px-3.5 py-2.5'
              } ${
                isActive
                  ? 'bg-indigo-50/90 text-indigo-700 shadow-2xs font-bold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-indigo-600 rounded-r-full" />
              )}
              <Icon
                className={`w-4 h-4 shrink-0 transition-colors ${
                  isActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'
                }`}
              />
              {!isCollapsed && <span className="truncate">{item.label}</span>}

              {/* Floating Tooltip when Collapsed */}
              {isCollapsed && (
                <span className="fixed left-[84px] ml-1 px-2.5 py-1 bg-slate-900 text-white text-xs font-medium rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap shadow-md">
                  {item.label}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Status Footer */}
      <div className={`border-t border-slate-100 bg-slate-50/50 ${isCollapsed ? 'p-3 flex flex-col items-center gap-2' : 'p-3.5 space-y-2'}`}>
        {!isCollapsed ? (
          <>
            <div className="flex items-center justify-between text-xs text-slate-600 px-1">
              <span className="flex items-center gap-1.5 font-medium text-[11px] text-slate-700">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                SQLite 3NF Active
              </span>
              <span className="text-[10px] text-slate-600 font-mono">127.0.0.1</span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-600 pt-1.5 border-t border-slate-200/50 px-1">
              <span className="flex items-center gap-1 font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                100% Offline & Local
              </span>
              <span className="text-[10px] text-slate-600 font-mono">v1.0</span>
            </div>
          </>
        ) : (
          <div className="group relative cursor-pointer" title="SQLite Database Active - 100% Local & Private">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
          </div>
        )}
      </div>
    </aside>
  );
};

