import React, { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { OverviewPage } from './pages/OverviewPage';
import { TransactionsPage } from './pages/TransactionsPage';
import { ReceiptScanPage } from './pages/ReceiptScanPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { BudgetsPage } from './pages/BudgetsPage';
import { CategoriesPage } from './pages/CategoriesPage';
import { SettingsPage } from './pages/SettingsPage';
import { getCurrentMonthISO } from './utils/formatters';

export function App() {
  const [currentTab, setCurrentTab] = useState<string>('overview');
  // Default to October 2026 (matching our demo data & project timeframe)
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-10');
  const [isAddExpenseModalOpen, setIsAddExpenseModalOpen] = useState(false);

  const getPageInfo = () => {
    switch (currentTab) {
      case 'overview':
        return {
          title: 'Expenditure Dashboard',
          subtitle: 'Real-time overview of monthly cashflow, spending trends and key metrics',
        };
      case 'transactions':
        return {
          title: 'Transaction History',
          subtitle: 'Search, filter, view and manage all recorded manual and receipt expenses',
        };
      case 'scan':
        return {
          title: 'Scan Bill or Receipt',
          subtitle: 'Local optical character recognition with line item review and duplicate check',
        };
      case 'analytics':
        return {
          title: 'Analytics & AI Insights',
          subtitle: 'Statistical comparisons, Isolation Forest anomaly detection and local AI explanations',
        };
      case 'budgets':
        return {
          title: 'Budget Management',
          subtitle: 'Category-wise monthly spending caps and real-time threshold notifications',
        };
      case 'categories':
        return {
          title: 'Categories',
          subtitle: 'Normalized expenditure classifications with referential integrity rules',
        };
      case 'settings':
        return {
          title: 'Settings & Data Management',
          subtitle: 'Database diagnostics, CSV export, SQLite backup, OCR setup and demo controls',
        };
      default:
        return { title: 'SpendWise', subtitle: 'Personal Expenditure Analyser' };
    }
  };

  const { title, subtitle } = getPageInfo();

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 font-sans antialiased">
      {/* Left Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={(tab) => setCurrentTab(tab)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar
          title={title}
          subtitle={subtitle}
          selectedMonth={selectedMonth}
          onSelectMonth={(m) => setSelectedMonth(m)}
          onOpenAddExpense={() => {
            if (currentTab !== 'transactions') {
              setCurrentTab('transactions');
            }
            setIsAddExpenseModalOpen(true);
          }}
          onOpenScanReceipt={() => setCurrentTab('scan')}
        />

        <main className="flex-1 overflow-y-auto">
          {currentTab === 'overview' && (
            <OverviewPage
              selectedMonth={selectedMonth}
              onOpenAddExpense={() => {
                setCurrentTab('transactions');
                setIsAddExpenseModalOpen(true);
              }}
              onOpenScanReceipt={() => setCurrentTab('scan')}
              onGoToTransactions={() => setCurrentTab('transactions')}
              onGoToAnalytics={() => setCurrentTab('analytics')}
            />
          )}

          {currentTab === 'transactions' && (
            <TransactionsPage
              selectedMonth={selectedMonth}
              isAddModalOpen={isAddExpenseModalOpen}
              onCloseAddModal={() => setIsAddExpenseModalOpen(false)}
              onOpenAddModal={() => setIsAddExpenseModalOpen(true)}
            />
          )}

          {currentTab === 'scan' && (
            <ReceiptScanPage
              onGoToTransactions={() => setCurrentTab('transactions')}
            />
          )}

          {currentTab === 'analytics' && (
            <AnalyticsPage selectedMonth={selectedMonth} />
          )}

          {currentTab === 'budgets' && (
            <BudgetsPage selectedMonth={selectedMonth} />
          )}

          {currentTab === 'categories' && <CategoriesPage />}

          {currentTab === 'settings' && <SettingsPage />}
        </main>
      </div>
    </div>
  );
}

export default App;
