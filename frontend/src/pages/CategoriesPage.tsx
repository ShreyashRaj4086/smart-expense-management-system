import React, { useEffect, useState } from 'react';
import {
  Tags,
  Plus,
  Edit2,
  Trash2,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  FolderTree,
} from 'lucide-react';
import { api } from '../services/api';
import { Category } from '../types';
import { Modal } from '../components/Modal';

export const CategoriesPage: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);
  const [reassignToId, setReassignToId] = useState<string>('');

  const [formName, setFormName] = useState('');
  const [formError, setFormError] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.getCategories();
      setCategories(res);
    } catch (err) {
      console.error('Failed to load categories:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenAdd = () => {
    setFormName('');
    setFormError('');
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (c: Category) => {
    setEditingCategory(c);
    setFormName(c.category_name);
    setFormError('');
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formName.trim()) {
      setFormError('Category name cannot be empty.');
      return;
    }

    try {
      if (editingCategory) {
        await api.updateCategory(editingCategory.category_id, {
          category_name: formName.trim(),
        });
        setEditingCategory(null);
      } else {
        await api.createCategory({
          category_name: formName.trim(),
        });
        setIsAddModalOpen(false);
      }
      setFormName('');
      loadData();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save category.');
    }
  };

  const handleDeleteCategory = async () => {
    if (!deletingCategory) return;
    try {
      await api.deleteCategory(
        deletingCategory.category_id,
        reassignToId ? parseInt(reassignToId, 10) : undefined
      );
      setDeletingCategory(null);
      setReassignToId('');
      loadData();
    } catch (err: any) {
      alert(`Deletion blocked: ${err.message}`);
    }
  };

  return (
    <div className="p-8 space-y-6 max-w-5xl mx-auto">
      {/* Header Bar */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h3 className="text-base font-bold text-slate-900">Manage Categories</h3>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
              {categories.length} total
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Classify and group expenditures with database referential integrity protection.
          </p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Category</span>
        </button>
      </div>

      {/* Relational Schema Notice */}
      <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-xl flex items-start gap-3 text-xs text-slate-700">
        <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
        <div>
          <strong className="font-semibold text-indigo-950">Relational Database Integrity:</strong>{' '}
          Each category forms a foreign-key relationship with recorded transactions and scanned receipt line items. If a category is removed, all dependent transactions must be reassigned to prevent orphaned records.
        </div>
      </div>

      {/* Categories Grid */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {categories.map((c) => (
            <div
              key={c.category_id}
              className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/40 flex items-center justify-between hover:bg-white hover:border-indigo-200 hover:shadow-xs transition-all"
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs uppercase">
                  {c.category_name.charAt(0)}
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-900 block">{c.category_name}</span>
                  <span className="text-[10px] text-slate-600 font-mono">ID #{c.category_id}</span>
                </div>
              </div>
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => handleOpenEdit(c)}
                  className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 transition-colors"
                  title="Rename category"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => {
                    setDeletingCategory(c);
                    setReassignToId('');
                  }}
                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 transition-colors"
                  title="Delete category"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add / Edit Modal */}
      <Modal
        isOpen={isAddModalOpen || editingCategory !== null}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingCategory(null);
        }}
        title={editingCategory ? 'Rename Category' : 'Create New Category'}
        maxWidth="sm"
      >
        <form onSubmit={handleSaveCategory} className="space-y-4">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium">
              {formError}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Category Name</label>
            <input
              type="text"
              required
              autoFocus
              placeholder="e.g. Health & Fitness, Investments"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 font-semibold outline-none focus:border-indigo-500 focus:bg-white transition-colors"
            />
          </div>

          <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                setIsAddModalOpen(false);
                setEditingCategory(null);
              }}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs cursor-pointer transition-colors"
            >
              Save Category
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete / Reassign Modal */}
      <Modal
        isOpen={deletingCategory !== null}
        onClose={() => setDeletingCategory(null)}
        title="Delete Category"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            Deleting <strong className="text-slate-900">{deletingCategory?.category_name}</strong>. If
            any existing transactions or receipt line items reference this category, foreign-key rules require
            reassigning them to an alternate category.
          </p>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Reassign Existing Records To:
            </label>
            <select
              value={reassignToId}
              onChange={(e) => setReassignToId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="">Leave Uncategorized (if unreferenced)</option>
              {categories
                .filter((c) => c.category_id !== deletingCategory?.category_id)
                .map((c) => (
                  <option key={c.category_id} value={c.category_id.toString()}>
                    {c.category_name}
                  </option>
                ))}
            </select>
          </div>

          <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
            <button
              onClick={() => setDeletingCategory(null)}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteCategory}
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
