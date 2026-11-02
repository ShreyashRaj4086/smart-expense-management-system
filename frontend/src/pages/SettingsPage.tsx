import React, { useEffect, useState } from 'react';
import {
  Database,
  Download,
  Upload,
  HardDrive,
  Cpu,
  ScanLine,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Trash2,
  FileSpreadsheet,
  ExternalLink,
  Laptop,
} from 'lucide-react';
import { api } from '../services/api';
import { SystemStatus } from '../types';

export const SettingsPage: React.FC = () => {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isClearing, setIsClearing] = useState(false);
  const [isLoadingDemo, setIsLoadingDemo] = useState(false);

  const loadStatus = async () => {
    setLoading(true);
    try {
      const res = await api.getSystemStatus();
      setStatus(res);
    } catch (err) {
      console.error('Failed to load system status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleLoadDemo = async () => {
    setIsLoadingDemo(true);
    setActionMsg(null);
    try {
      const res = await api.loadDemoData();
      setActionMsg({
        type: 'success',
        text: res.message,
      });
      loadStatus();
    } catch (err: any) {
      setActionMsg({ type: 'error', text: err.message || 'Failed to load demo data.' });
    } finally {
      setIsLoadingDemo(false);
    }
  };

  const handleClearDemo = async () => {
    if (!confirm('Are you sure you want to clear demo records? All your real manual and scanned expenses will be kept intact.')) {
      return;
    }
    setIsClearing(true);
    setActionMsg(null);
    try {
      const res = await api.clearDemoData();
      setActionMsg({
        type: 'success',
        text: res.message,
      });
      loadStatus();
    } catch (err: any) {
      setActionMsg({ type: 'error', text: err.message || 'Failed to clear demo records.' });
    } finally {
      setIsClearing(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 space-y-6 max-w-5xl mx-auto">
        <div className="h-44 bg-white rounded-2xl border border-slate-200/80 animate-pulse" />
        <div className="h-44 bg-white rounded-2xl border border-slate-200/80 animate-pulse" />
        <div className="h-44 bg-white rounded-2xl border border-slate-200/80 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6 max-w-5xl mx-auto">
      {/* Toast Alert */}
      {actionMsg && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-center gap-3 transition-all ${
            actionMsg.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {actionMsg.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span className="font-medium">{actionMsg.text}</span>
        </div>
      )}

      {/* 1. Local Storage & Relational Database Info */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-4">
        <div className="flex items-center space-x-3.5 border-b border-slate-100 pb-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Local Relational Database (SQLite)</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              3NF relational schema with ACID guarantees and foreign-key referential integrity.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-100 space-y-1.5">
            <span className="font-bold text-slate-400 text-[10px] uppercase tracking-wider">
              Database File Path
            </span>
            <div className="font-mono text-slate-800 text-[11px] break-all bg-white p-2 rounded-lg border border-slate-200/60">
              {status?.database.path}
            </div>
          </div>
          <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-100 space-y-1.5">
            <span className="font-bold text-slate-400 text-[10px] uppercase tracking-wider">
              Total Transactions in Database
            </span>
            <div className="text-slate-900 font-bold text-base tabular-nums">
              {status?.database.total_transactions} records
            </div>
            <div className="text-[11px] text-slate-500">
              {status?.database.user_transactions} User-created • {status?.database.demo_transactions} Demo records
            </div>
          </div>
        </div>
      </div>

      {/* 2. OCR Engine Status */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center">
              <ScanLine className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Local OCR Engine (RapidOCR / Tesseract)</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Local optical character recognition with 2D bounding-box spatial clustering.
              </p>
            </div>
          </div>
          <span
            className={`text-xs font-semibold px-3 py-1 rounded-full border ${
              status?.ocr.available
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}
          >
            {status?.ocr.available ? 'OCR Engine Ready' : 'Fallback Mode'}
          </span>
        </div>

        <div className="text-xs text-slate-700 space-y-2 leading-relaxed">
          <p className="font-medium text-slate-600">{status?.ocr.instructions}</p>
          {!status?.ocr.available && (
            <div className="p-3 bg-slate-50 rounded-xl font-mono text-[11px] text-slate-800 border border-slate-200">
              pip install rapidocr-onnxruntime
            </div>
          )}
        </div>
      </div>

      {/* 3. Local AI / Ollama Status */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Local AI Model (Ollama)</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                On-device language model integration with deterministic SQL verification.
              </p>
            </div>
          </div>
          <span
            className={`text-xs font-semibold px-3 py-1 rounded-full border flex items-center gap-1.5 ${
              status?.ai.available
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-slate-100 text-slate-600 border-slate-200'
            }`}
          >
            {status?.ai.available ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Active ({status.ai.configured_model})</span>
              </>
            ) : (
              'Standby / Deterministic'
            )}
          </span>
        </div>

        <div className="text-xs text-slate-700 space-y-2 leading-relaxed">
          <p className="font-medium text-slate-600">{status?.ai.message}</p>
          {!status?.ai.available && (
            <div className="p-3 bg-slate-50 rounded-xl font-mono text-[11px] text-slate-800 border border-slate-200">
              ollama run gemma3:4b
            </div>
          )}
        </div>
      </div>

      {/* 4. Data Export & Backup Actions */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-4">
        <div className="border-b border-slate-100 pb-3">
          <h3 className="text-sm font-bold text-slate-900">Data Export & Backup</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Export all financial transactions or download the raw SQLite binary database anytime.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <a
            href={api.getExportUrl()}
            download="spendwise_transactions.csv"
            className="flex items-center space-x-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200/80 text-slate-800 rounded-xl text-xs font-semibold transition-colors cursor-pointer border border-slate-200"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Export Transactions (CSV)</span>
          </a>

          <a
            href={api.getBackupUrl()}
            download="spendwise_backup.db"
            className="flex items-center space-x-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200/80 text-slate-800 rounded-xl text-xs font-semibold transition-colors cursor-pointer border border-slate-200"
          >
            <Download className="w-4 h-4 text-indigo-600" />
            <span>Download Database Backup (.db)</span>
          </a>
        </div>
      </div>

      {/* 5. Demo Data Management */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-4">
        <div className="border-b border-slate-100 pb-3">
          <h3 className="text-sm font-bold text-slate-900">Demonstration Dataset Controls</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Pre-populate realistic Indian expenditure records (August to October 2026) for demonstration and evaluation.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleLoadDemo}
            disabled={isLoadingDemo}
            className="flex items-center space-x-2 px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
          >
            {isLoadingDemo ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            <span>Load Demonstration Dataset (3 Months)</span>
          </button>

          <button
            onClick={handleClearDemo}
            disabled={isClearing}
            className="flex items-center space-x-2 px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
          >
            {isClearing ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            <span>Clear Demonstration Records Only</span>
          </button>
        </div>
      </div>

      {/* 6. Privacy & Offline Guarantee */}
      <div className="p-4 bg-emerald-50/70 border border-emerald-200/80 rounded-xl flex items-center space-x-3.5 text-xs text-emerald-900">
        <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
        <div className="leading-relaxed">
          <strong className="font-bold">100% On-Device & Privacy Guaranteed:</strong> SpendWise executes completely on <code>127.0.0.1</code> on your laptop. No financial records, receipt scans, or queries ever leave this machine.
        </div>
      </div>
    </div>
  );
};
