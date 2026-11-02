import React, { useState, useEffect } from 'react';
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Trash2,
  ScanLine,
  Eye,
  Info,
  Calendar,
  CreditCard,
  Tag,
  ArrowRight,
} from 'lucide-react';
import { api } from '../services/api';
import { Category, PaymentMethod, ReceiptScanResult } from '../types';
import { formatRupees, getTodayISO } from '../utils/formatters';

interface ReceiptScanPageProps {
  onGoToTransactions: () => void;
}

export const ReceiptScanPage: React.FC<ReceiptScanPageProps> = ({ onGoToTransactions }) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ReceiptScanResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successSavedTxn, setSuccessSavedTxn] = useState<any | null>(null);

  // Review Form Fields
  const [merchantName, setMerchantName] = useState('');
  const [txnDate, setTxnDate] = useState(getTodayISO());
  const [totalRupees, setTotalRupees] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [pmId, setPmId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<
    Array<{ item_name: string; quantity: number; unit_price_rupees?: number; line_total_rupees: number }>
  >([]);
  const [showRawText, setShowRawText] = useState(false);

  useEffect(() => {
    Promise.all([api.getCategories(), api.getPaymentMethods()]).then(([cats, pms]) => {
      setCategories(cats);
      setPaymentMethods(pms);
      if (pms.length > 0) setPmId(pms[0].payment_method_id.toString());
    });
  }, []);

  const handleFileUpload = async (file: File) => {
    setErrorMsg('');
    setSuccessSavedTxn(null);
    setIsScanning(true);

    try {
      const res = await api.scanReceipt(file);
      setScanResult(res);

      setMerchantName(res.merchant_name || '');
      setTxnDate(res.transaction_date || getTodayISO());
      setTotalRupees(res.total_rupees ? res.total_rupees.toString() : '');
      if (res.suggested_category_id) {
        setCategoryId(res.suggested_category_id.toString());
      }
      if (res.suggested_payment_method_id) {
        setPmId(res.suggested_payment_method_id.toString());
      }
      setItems(
        res.items.map((i) => ({
          item_name: i.item_name,
          quantity: i.quantity,
          unit_price_rupees: i.unit_price_rupees || undefined,
          line_total_rupees: i.line_total_rupees,
        }))
      );
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to scan receipt.');
    } finally {
      setIsScanning(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileUpload(e.target.files[0]);
    }
  };

  const handleAddItemRow = () => {
    setItems((prev) => [
      ...prev,
      { item_name: 'New item', quantity: 1, line_total_rupees: 0 },
    ]);
  };

  const handleRemoveItemRow = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleItemChange = (idx: number, field: string, value: any) => {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i === idx) {
          const updated = { ...item, [field]: value };
          if (field === 'quantity' || field === 'unit_price_rupees') {
            const q = parseFloat(field === 'quantity' ? value : item.quantity.toString()) || 1;
            const u = parseFloat(field === 'unit_price_rupees' ? value : (item.unit_price_rupees || 0).toString()) || 0;
            if (u > 0) {
              updated.line_total_rupees = Math.round(q * u * 100) / 100;
            }
          }
          return updated;
        }
        return item;
      })
    );
  };

  const itemsSum = items.reduce((sum, item) => sum + (parseFloat(item.line_total_rupees.toString()) || 0), 0);
  const parsedTotal = parseFloat(totalRupees) || 0;
  const isReconciled = items.length === 0 || Math.abs(itemsSum - parsedTotal) <= 1.0;

  const handleConfirmAndSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanResult) return;

    if (parsedTotal <= 0) {
      setErrorMsg('Total amount must be greater than zero.');
      return;
    }

    try {
      const savedTxn = await api.confirmReceipt({
        file_id: scanResult.file_id,
        transaction_date: txnDate,
        amount_rupees: parsedTotal,
        description: merchantName ? `Receipt: ${merchantName}` : 'Scanned Receipt',
        merchant_name: merchantName || undefined,
        category_id: categoryId ? parseInt(categoryId, 10) : null,
        payment_method_id: parseInt(pmId, 10),
        notes: notes || undefined,
        items: items.map((i) => ({
          item_name: i.item_name,
          quantity: i.quantity,
          unit_price_rupees: i.unit_price_rupees,
          line_total_rupees: i.line_total_rupees,
          category_id: categoryId ? parseInt(categoryId, 10) : null,
        })),
      });

      setSuccessSavedTxn(savedTxn);
      setScanResult(null);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save receipt transaction.');
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      {/* Workflow Stepper */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-500 overflow-x-auto">
          <div className="flex items-center gap-2 text-indigo-600 font-bold shrink-0">
            <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[11px]">1</span>
            <span>Upload Receipt</span>
          </div>
          <span className="text-slate-300">→</span>
          <div className={`flex items-center gap-2 shrink-0 ${scanResult ? 'text-indigo-600 font-bold' : 'text-slate-400'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] ${scanResult ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'}`}>2</span>
            <span>Local OCR Engine</span>
          </div>
          <span className="text-slate-300">→</span>
          <div className={`flex items-center gap-2 shrink-0 ${scanResult ? 'text-indigo-600 font-bold' : 'text-slate-400'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] ${scanResult ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'}`}>3</span>
            <span>Review Fields</span>
          </div>
          <span className="text-slate-300">→</span>
          <div className={`flex items-center gap-2 shrink-0 ${successSavedTxn ? 'text-emerald-600 font-bold' : 'text-slate-400'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] ${successSavedTxn ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'}`}>4</span>
            <span>Commit to SQLite</span>
          </div>
        </div>
      </div>

      {/* Success Notification */}
      {successSavedTxn && (
        <div className="bg-emerald-50 border border-emerald-200 p-5 rounded-2xl flex items-center justify-between shadow-2xs">
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-emerald-900">Receipt Recorded Successfully!</h4>
              <p className="text-xs text-emerald-700 mt-0.5 font-medium">
                Saved ₹{successSavedTxn.amount_rupees.toFixed(2)} on {successSavedTxn.transaction_date} to local database.
              </p>
            </div>
          </div>
          <button
            onClick={onGoToTransactions}
            className="flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer"
          >
            <span>View in Transactions</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Upload Dropzone */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-3xl p-10 text-center transition-all ${
          isScanning
            ? 'border-indigo-400 bg-indigo-50/60'
            : 'border-slate-300/90 hover:border-indigo-400 bg-white hover:bg-slate-50/50 shadow-2xs'
        }`}
      >
        <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-4 border border-indigo-100 shadow-xs">
          {isScanning ? (
            <ScanLine className="w-8 h-8 animate-pulse text-indigo-600" />
          ) : (
            <UploadCloud className="w-8 h-8 stroke-[1.75]" />
          )}
        </div>

        {isScanning ? (
          <div className="space-y-1.5">
            <h3 className="text-base font-bold text-indigo-900">Extracting Receipt Data Locally...</h3>
            <p className="text-xs text-indigo-600 font-medium">
              Running spatial bounding-box OCR clustering and token recognition...
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <h3 className="text-base font-bold text-slate-900">Drag & drop your receipt or bill</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                Upload thermal paper bills, grocery receipts, or text/scanned PDFs up to 15 MB.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 pt-1 text-[11px] text-slate-500 font-medium">
              <span className="bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/60">PNG</span>
              <span className="bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/60">JPG / JPEG</span>
              <span className="bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/60">WEBP</span>
              <span className="bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/60">PDF</span>
              <span className="text-slate-300">•</span>
              <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60 font-semibold">
                🔒 100% On-Device
              </span>
            </div>

            <div className="pt-2">
              <label className="inline-flex items-center px-4.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs shadow-indigo-100 transition-all cursor-pointer">
                <span>Browse Files</span>
                <input
                  type="file"
                  accept=".png,.jpg,.jpeg,.webp,.pdf"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Error Message */}
      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Review & Edit Extracted Results */}
      {scanResult && (
        <form onSubmit={handleConfirmAndSave} className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden space-y-6 p-8">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>Review & Correct Extracted Fields</span>
                <span className="text-[11px] font-semibold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">
                  {scanResult.extraction_status.toUpperCase()}
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Inspect extracted numbers before committing to your SQLite database.
              </p>
            </div>

            {scanResult.raw_ocr_text && (
              <button
                type="button"
                onClick={() => setShowRawText(!showRawText)}
                className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 font-medium px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-50"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>{showRawText ? 'Hide Raw Text' : 'View Raw OCR'}</span>
              </button>
            )}
          </div>

          {/* Duplicate Warning */}
          {scanResult.is_duplicate && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 text-xs flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold">Duplicate Receipt Detected:</strong> An identical receipt file with matching SHA-256 hash has already been recorded in your transactions. You may still save it if this is a separate transaction.
              </div>
            </div>
          )}

          {/* Engine note if OCR was unavailable */}
          {!scanResult.ocr_engine_available && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-700 text-xs flex items-start gap-3">
              <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold">Manual Entry Fallback:</strong> {scanResult.ocr_engine_note}
              </div>
            </div>
          )}

          {/* Raw Text Viewer */}
          {showRawText && (
            <div className="bg-slate-900 text-slate-200 p-4 rounded-2xl text-xs font-mono max-h-48 overflow-y-auto whitespace-pre-wrap">
              {scanResult.raw_ocr_text || 'No raw text extracted.'}
            </div>
          )}

          {/* Key Fields */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Merchant */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Merchant / Store Name</label>
              <input
                type="text"
                placeholder="e.g. Starbucks, Blinkit"
                value={merchantName}
                onChange={(e) => setMerchantName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 font-semibold outline-none focus:border-indigo-500 focus:bg-white"
              />
            </div>

            {/* Date */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Transaction Date</label>
              <input
                type="date"
                required
                value={txnDate}
                onChange={(e) => setTxnDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 outline-none focus:border-indigo-500 focus:bg-white"
              />
            </div>

            {/* Total Amount */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Total Amount (₹) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">₹</span>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={totalRupees}
                  onChange={(e) => setTotalRupees(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-7 pr-3.5 py-2 text-xs text-slate-900 font-bold outline-none focus:border-indigo-500 focus:bg-white"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Category */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 outline-none focus:border-indigo-500 focus:bg-white cursor-pointer"
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
              <label className="block text-xs font-bold text-slate-700 mb-1">Payment Method</label>
              <select
                value={pmId}
                onChange={(e) => setPmId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 outline-none focus:border-indigo-500 focus:bg-white cursor-pointer"
              >
                {paymentMethods.map((pm) => (
                  <option key={pm.payment_method_id} value={pm.payment_method_id.toString()}>
                    {pm.method_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Itemized Lines */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-900">Itemized Breakdown (Optional)</h4>
                <p className="text-[11px] text-slate-500">
                  Individual item purchases extracted from this receipt.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddItemRow}
                className="flex items-center space-x-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Item</span>
              </button>
            </div>

            {items.length > 0 && (
              <div className="border border-slate-200/90 rounded-2xl overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200/80 text-slate-400 font-bold text-[11px] uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-4">Item Description</th>
                      <th className="py-2.5 px-4 w-24">Qty</th>
                      <th className="py-2.5 px-4 w-32 text-right">Line Total (₹)</th>
                      <th className="py-2.5 px-4 w-12 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-2 px-4">
                          <input
                            type="text"
                            value={item.item_name}
                            onChange={(e) => handleItemChange(idx, 'item_name', e.target.value)}
                            className="w-full bg-transparent border-0 outline-none font-semibold text-slate-900 focus:bg-slate-50 rounded px-1"
                          />
                        </td>
                        <td className="py-2 px-4">
                          <input
                            type="number"
                            min="0.1"
                            step="0.5"
                            value={item.quantity}
                            onChange={(e) => handleItemChange(idx, 'quantity', parseFloat(e.target.value) || 1)}
                            className="w-16 bg-slate-50 border border-slate-200/80 rounded-lg px-2 py-1 text-xs outline-none focus:border-indigo-500 font-medium"
                          />
                        </td>
                        <td className="py-2 px-4 text-right">
                          <input
                            type="number"
                            step="0.01"
                            value={item.line_total_rupees}
                            onChange={(e) => handleItemChange(idx, 'line_total_rupees', parseFloat(e.target.value) || 0)}
                            className="w-24 bg-slate-50 border border-slate-200/80 rounded-lg px-2 py-1 text-xs font-bold text-right outline-none focus:border-indigo-500 tabular-nums"
                          />
                        </td>
                        <td className="py-2 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItemRow(idx)}
                            className="text-slate-400 hover:text-rose-600 p-1 transition-colors cursor-pointer"
                            title="Remove item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50/80 border-t border-slate-200/80 font-bold text-xs text-slate-900">
                    <tr>
                      <td colSpan={2} className="py-2 px-4 text-slate-500 font-semibold">
                        Total Extracted Items Sum
                      </td>
                      <td className="py-2 px-4 text-right tabular-nums text-slate-900">
                        ₹{itemsSum.toFixed(2)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* Reconciliation Status Callout */}
            {items.length > 0 && isReconciled && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200/80 rounded-xl text-emerald-800 text-xs flex items-center gap-2.5 font-medium shadow-2xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  ✓ <strong>Balanced Reconciliation:</strong> Extracted line items (₹{itemsSum.toFixed(2)}) perfectly reconcile with the receipt grand total.
                </span>
              </div>
            )}

            {items.length > 0 && !isReconciled && (
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                  <span>
                    <strong>Reconciliation Discrepancy:</strong> Line items sum (₹{itemsSum.toFixed(2)}) differs from the total amount (₹{parsedTotal.toFixed(2)}) by ₹{Math.abs(itemsSum - parsedTotal).toFixed(2)}.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setTotalRupees(itemsSum.toFixed(2))}
                  className="px-2.5 py-1 text-[11px] font-bold bg-white text-amber-900 border border-amber-300 rounded-lg hover:bg-amber-100 transition-colors cursor-pointer shrink-0"
                >
                  Set total to ₹{itemsSum.toFixed(2)}
                </button>
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setScanResult(null)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 transition-colors cursor-pointer"
            >
              Discard
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs shadow-indigo-100 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Confirm & Save Expense</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
