"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { getAuthHeaders } from "@/lib/auth";
import { extractApiError } from "@/lib/utils";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api/v1";

interface Ingredient {
  id: number;
  name: string;
  baseUnit: string;
  currentQty: number;
  minThreshold: number;
  averageCost: number;
  category: string;
  managementType: string;
  isActive: boolean;
}

const BASE_UNIT_LABEL: Record<string, string> = {
  LIT: "Lít", KG: "Kg", CHAI: "Chai", HOP: "Hộp", GOI: "Gói", PIECE: "Cái/Miếng",
};
const CATEGORY_LABEL: Record<string, string> = {
  MEAT: "Thịt", FISH: "Cá", SEAFOOD: "Hải sản", VEGETABLE: "Rau củ",
  DRY_GOODS: "Khô / Đồ hộp", SPICE: "Gia vị", DRINK: "Đồ uống", OTHER: "Khác",
};
const MANAGEMENT_LABEL: Record<string, string> = {
  AUTO: "Tự động (đồ uống)", RECIPE: "Theo công thức (đồ ăn)", PERIODIC: "Định kỳ (gia vị)",
};

const EMPTY_FORM = { name: "", baseUnit: "", category: "", managementType: "", minThreshold: "" };

export default function AdminKhoPage() {
  const [items, setItems] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [keyword, setKeyword] = useState("");
  const [keywordInput, setKeywordInput] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [showLow, setShowLow] = useState(false);
  const [toast, setToast] = useState("");

  // Modal tạo/sửa
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [editTarget, setEditTarget] = useState<Ingredient | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let url: string;
      if (showLow) {
        url = `${BASE}/inventory/ingredients/low-stock`;
      } else {
        const params = new URLSearchParams({ page: String(page), size: "20" });
        if (keyword.trim()) params.set("keyword", keyword.trim());
        if (filterCategory) params.set("category", filterCategory);
        url = `${BASE}/inventory/ingredients?${params}`;
      }
      const res = await fetch(url, { headers: getAuthHeaders() });
      const json = await res.json();
      if (json.statusCode === 200) {
        const d = json.data;
        if (Array.isArray(d)) { setItems(d); setTotalPages(1); }
        else { setItems(d.content ?? []); setTotalPages(d.totalPages ?? 0); }
      }
    } finally { setLoading(false); }
  }, [page, keyword, filterCategory, showLow]);

  useEffect(() => { load(); }, [load]);

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(""), 3000); }

  function openCreate() {
    setForm(EMPTY_FORM);
    setFormError("");
    setModal("create");
  }

  function openEdit(item: Ingredient) {
    setEditTarget(item);
    setForm({
      name: item.name,
      baseUnit: item.baseUnit,
      category: item.category,
      managementType: item.managementType,
      minThreshold: String(item.minThreshold),
    });
    setFormError("");
    setModal("edit");
  }

  async function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!form.name.trim()) return setFormError("Tên không được để trống");
    if (!form.baseUnit) return setFormError("Chọn đơn vị lưu kho");
    if (!form.category) return setFormError("Chọn danh mục");
    if (!form.managementType) return setFormError("Chọn cách quản lý");
    setFormLoading(true);
    try {
      const body = {
        name: form.name.trim(),
        baseUnit: form.baseUnit,
        category: form.category,
        managementType: form.managementType,
        minThreshold: form.minThreshold ? Number(form.minThreshold) : 0,
      };
      const res = await fetch(`${BASE}/inventory/ingredients`, {
        method: "POST", headers: getAuthHeaders(), body: JSON.stringify(body),
      });
      const json = await res.json();
      if (res.ok && json.statusCode === 200) {
        showToast(`Đã tạo nguyên liệu "${json.data.name}"`);
        setModal(null);
        load();
      } else {
        setFormError(extractApiError(json, "Tạo thất bại"));
      }
    } catch { setFormError("Không kết nối được máy chủ"); }
    finally { setFormLoading(false); }
  }

  async function submitEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editTarget) return;
    setFormError("");
    setFormLoading(true);
    try {
      const body: Record<string, unknown> = {};
      if (form.name.trim() !== editTarget.name) body.name = form.name.trim();
      if (form.baseUnit !== editTarget.baseUnit) body.baseUnit = form.baseUnit;
      if (form.category !== editTarget.category) body.category = form.category;
      if (form.managementType !== editTarget.managementType) body.managementType = form.managementType;
      const threshold = form.minThreshold ? Number(form.minThreshold) : 0;
      if (threshold !== editTarget.minThreshold) body.minThreshold = threshold;

      const res = await fetch(`${BASE}/inventory/ingredients/${editTarget.id}`, {
        method: "PUT", headers: getAuthHeaders(), body: JSON.stringify(body),
      });
      const json = await res.json();
      if (res.ok && json.statusCode === 200) {
        showToast("Đã cập nhật nguyên liệu");
        setModal(null);
        load();
      } else {
        setFormError(extractApiError(json, "Cập nhật thất bại"));
      }
    } catch { setFormError("Không kết nối được máy chủ"); }
    finally { setFormLoading(false); }
  }

  async function deactivate(id: number, name: string) {
    if (!confirm(`Ngừng sử dụng "${name}"?`)) return;
    const res = await fetch(`${BASE}/inventory/ingredients/${id}/deactivate`, {
      method: "PATCH", headers: getAuthHeaders(),
    });
    const json = await res.json();
    if (json.statusCode === 200) { showToast("Đã ngừng sử dụng"); load(); }
    else showToast(json.message ?? "Thất bại");
  }

  function stockColor(item: Ingredient) {
    if (item.currentQty <= 0) return "text-red-600 font-bold";
    if (item.minThreshold > 0 && item.currentQty <= item.minThreshold) return "text-yellow-600 font-semibold";
    return "text-green-700";
  }

  function renderModal() {
    if (!modal) return null;
    const isCreate = modal === "create";
    const title = isCreate ? "Thêm nguyên liệu mới" : `Sửa: ${editTarget?.name}`;
    const onSubmit = isCreate ? submitCreate : submitEdit;
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setModal(null)}>
        <div className="bg-canvas rounded-lg border border-hairline p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
          <div className="flex justify-between items-center mb-5">
            <h2 className="font-bold text-ink">{title}</h2>
            <button onClick={() => setModal(null)} className="text-muted-soft hover:text-gray-600 text-xl leading-none">×</button>
          </div>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase">Tên nguyên liệu *</label>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="VD: Thịt bò, Nước mắm..." maxLength={200}
                className="w-full border border-hairline px-3 py-2 text-sm outline-none focus:border-primary rounded" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase">Đơn vị lưu kho *</label>
                <select value={form.baseUnit} onChange={e => setForm(p => ({ ...p, baseUnit: e.target.value }))}
                  className="w-full border border-hairline px-3 py-2 text-sm outline-none focus:border-primary rounded bg-white">
                  <option value="">-- Chọn --</option>
                  {Object.entries(BASE_UNIT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase">Ngưỡng tối thiểu</label>
                <input type="number" step="0.001" min="0" value={form.minThreshold}
                  onChange={e => setForm(p => ({ ...p, minThreshold: e.target.value }))}
                  placeholder="0"
                  className="w-full border border-hairline px-3 py-2 text-sm outline-none focus:border-primary rounded" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase">Danh mục *</label>
              <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                className="w-full border border-hairline px-3 py-2 text-sm outline-none focus:border-primary rounded bg-white">
                <option value="">-- Chọn danh mục --</option>
                {Object.entries(CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase">Cách quản lý *</label>
              <select value={form.managementType} onChange={e => setForm(p => ({ ...p, managementType: e.target.value }))}
                className="w-full border border-hairline px-3 py-2 text-sm outline-none focus:border-primary rounded bg-white">
                <option value="">-- Chọn --</option>
                {Object.entries(MANAGEMENT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            {formError && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-2 rounded">{formError}</div>
            )}
            <div className="flex gap-3 pt-1">
              <button type="submit" disabled={formLoading}
                className="px-5 py-2 bg-primary text-white text-sm font-semibold rounded hover:bg-primary-dark disabled:opacity-60">
                {formLoading ? "Đang lưu..." : "Lưu"}
              </button>
              <button type="button" onClick={() => setModal(null)}
                className="px-5 py-2 bg-canvas text-gray-600 text-sm font-semibold rounded hover:bg-surface-card">
                Hủy
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {toast && <div className="fixed top-4 right-4 bg-gray-800 text-white text-sm px-4 py-2.5 rounded shadow-lg z-50">{toast}</div>}

      {renderModal()}

      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-ink">Kho nguyên liệu</h1>
          <p className="text-sm text-muted">Quản lý tồn kho nguyên liệu nhà hàng</p>
        </div>
        <div className="flex gap-2">
          <button onClick={openCreate}
            className="px-4 py-2 bg-primary text-white text-sm font-semibold rounded hover:bg-primary-dark">
            + Thêm nguyên liệu
          </button>
          <Link href="/admin/kho/xuat-kho" className="px-4 py-2 bg-orange-500 text-white text-sm font-semibold rounded hover:bg-orange-600">
            Xuất kho
          </Link>
          <Link href="/admin/kho/nhap-kho" className="px-4 py-2 bg-blue-500 text-white text-sm font-semibold rounded hover:bg-blue-600">
            Nhập kho
          </Link>
        </div>
      </div>

      <div className="flex gap-3 mb-4 flex-wrap items-center">
        <form onSubmit={(e) => { e.preventDefault(); setPage(0); setKeyword(keywordInput); setShowLow(false); }} className="flex gap-2">
          <input value={keywordInput} onChange={(e) => setKeywordInput(e.target.value)}
            placeholder="Tìm nguyên liệu..."
            className="border border-hairline px-3 py-1.5 text-sm outline-none focus:border-primary rounded w-52" />
          <button type="submit" className="px-3 py-1.5 bg-canvas text-sm rounded hover:bg-surface-card">Tìm</button>
        </form>

        <select value={filterCategory}
          onChange={e => { setFilterCategory(e.target.value); setPage(0); setShowLow(false); }}
          className="border border-hairline px-3 py-1.5 text-sm rounded outline-none focus:border-primary bg-white">
          <option value="">Tất cả danh mục</option>
          {Object.entries(CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>

        <button
          onClick={() => { setShowLow(p => !p); setPage(0); setKeyword(""); setKeywordInput(""); setFilterCategory(""); }}
          className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors ${showLow ? "bg-red-500 text-white border-red-500" : "bg-canvas text-red-500 border-red-300 hover:bg-red-50"}`}>
          Sắp hết kho
        </button>

        {(keyword || filterCategory) && !showLow && (
          <button onClick={() => { setKeyword(""); setKeywordInput(""); setFilterCategory(""); setPage(0); }}
            className="text-xs text-muted-soft hover:text-gray-600 underline">
            Xóa bộ lọc
          </button>
        )}
      </div>

      <div className="bg-canvas rounded-lg border border-hairline overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-soft border-b border-hairline text-xs text-muted uppercase">
                <th className="text-left px-4 py-3">Nguyên liệu</th>
                <th className="text-center px-4 py-3">Danh mục</th>
                <th className="text-center px-4 py-3">Quản lý</th>
                <th className="text-center px-4 py-3">Tồn kho</th>
                <th className="text-center px-4 py-3">Tối thiểu</th>
                <th className="text-center px-4 py-3">Giá vốn TB</th>
                <th className="text-center px-4 py-3">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {loading ? (
                <tr><td colSpan={7} className="text-center py-8 text-muted-soft">Đang tải...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-muted-soft">Không có nguyên liệu nào</td></tr>
              ) : items.map((item) => (
                <tr key={item.id} className="hover:bg-surface-soft">
                  <td className="px-4 py-3 font-medium text-ink">{item.name}</td>
                  <td className="px-4 py-3 text-center text-xs text-muted">
                    {CATEGORY_LABEL[item.category] ?? item.category}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-xs text-muted-soft">
                      {item.managementType === "AUTO" ? "Tự động" : item.managementType === "RECIPE" ? "Công thức" : "Định kỳ"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={stockColor(item)}>
                      {item.currentQty} {BASE_UNIT_LABEL[item.baseUnit] ?? item.baseUnit}
                    </span>
                    {item.minThreshold > 0 && item.currentQty <= item.minThreshold && item.currentQty > 0 && (
                      <span className="ml-1 text-xs text-yellow-500">⚠</span>
                    )}
                    {item.currentQty <= 0 && <span className="ml-1 text-xs text-red-500">❌</span>}
                  </td>
                  <td className="px-4 py-3 text-center text-muted text-xs">
                    {item.minThreshold > 0 ? `${item.minThreshold} ${BASE_UNIT_LABEL[item.baseUnit] ?? item.baseUnit}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-center text-xs text-muted">
                    {item.averageCost > 0
                      ? new Intl.NumberFormat("vi-VN").format(item.averageCost) + `đ/${BASE_UNIT_LABEL[item.baseUnit] ?? item.baseUnit}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex gap-1.5 justify-center">
                      <button onClick={() => openEdit(item)}
                        className="px-2 py-1 bg-blue-50 text-blue-600 text-xs rounded hover:bg-blue-100">
                        Sửa
                      </button>
                      <button onClick={() => deactivate(item.id, item.name)}
                        className="px-2 py-1 bg-red-50 text-red-500 text-xs rounded hover:bg-red-100">
                        Ngừng dùng
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!showLow && totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 p-4 border-t border-hairline">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              className="px-3 py-1 text-sm border rounded disabled:opacity-40 hover:bg-surface-soft">← Trước</button>
            <span className="text-sm text-gray-600">Trang {page + 1} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
              className="px-3 py-1 text-sm border rounded disabled:opacity-40 hover:bg-surface-soft">Tiếp →</button>
          </div>
        )}
      </div>
    </div>
  );
}
