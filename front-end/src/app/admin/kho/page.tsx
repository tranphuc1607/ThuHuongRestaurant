"use client";
import { useState, useEffect, useCallback, useRef } from "react";
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
const CATEGORY_ICON: Record<string, string> = {
  MEAT: "🥩", FISH: "🐟", SEAFOOD: "🦐", VEGETABLE: "🥦",
  DRY_GOODS: "🥫", SPICE: "🧂", DRINK: "🥤", OTHER: "📦",
};
const MANAGEMENT_LABEL: Record<string, string> = {
  AUTO: "Tự động", RECIPE: "Công thức", PERIODIC: "Định kỳ",
};

const EMPTY_FORM = { name: "", baseUnit: "", category: "", managementType: "", minThreshold: "" };

export default function AdminKhoPage() {
  const [items, setItems] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const savedScroll = useRef(0);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [keyword, setKeyword] = useState("");
  const [keywordInput, setKeywordInput] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [showLow, setShowLow] = useState(false);
  const [toast, setToast] = useState("");

  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [editTarget, setEditTarget] = useState<Ingredient | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState("");

  const load = useCallback(async (preserveScroll = false) => {
    if (preserveScroll) {
      const el = document.getElementById("admin-scroll-content");
      savedScroll.current = el ? el.scrollTop : window.scrollY;
      setRefreshing(true);
    } else {
      setLoading(true);
    }
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
    } finally {
      setLoading(false);
      setRefreshing(false);
      if (preserveScroll) {
        setTimeout(() => {
          const el = document.getElementById("admin-scroll-content");
          if (el) el.scrollTop = savedScroll.current;
          else window.scrollTo(0, savedScroll.current);
        }, 30);
      }
    }
  }, [page, keyword, filterCategory, showLow]);

  useEffect(() => { load(); }, [load]);

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(""), 3000); }

  function openCreate() { setForm(EMPTY_FORM); setFormError(""); setModal("create"); }

  function openEdit(item: Ingredient) {
    setEditTarget(item);
    setForm({
      name: item.name, baseUnit: item.baseUnit, category: item.category,
      managementType: item.managementType, minThreshold: String(item.minThreshold),
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
        name: form.name.trim(), baseUnit: form.baseUnit, category: form.category,
        managementType: form.managementType,
        minThreshold: form.minThreshold ? Number(form.minThreshold) : 0,
      };
      const res = await fetch(`${BASE}/inventory/ingredients`, {
        method: "POST", headers: getAuthHeaders(), body: JSON.stringify(body),
      });
      const json = await res.json();
      if (res.ok && json.statusCode === 200) {
        showToast(`Đã tạo "${json.data.name}"`);
        setModal(null);
        load();
      } else { setFormError(extractApiError(json, "Tạo thất bại")); }
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
        load(true);
      } else { setFormError(extractApiError(json, "Cập nhật thất bại")); }
    } catch { setFormError("Không kết nối được máy chủ"); }
    finally { setFormLoading(false); }
  }

  async function deactivate(id: number, name: string) {
    if (!confirm(`Ngừng sử dụng "${name}"?`)) return;
    const res = await fetch(`${BASE}/inventory/ingredients/${id}/deactivate`, {
      method: "PATCH", headers: getAuthHeaders(),
    });
    const json = await res.json();
    if (json.statusCode === 200) { showToast("Đã ngừng sử dụng"); load(true); }
    else showToast(json.message ?? "Thất bại");
  }

  function stockStatus(item: Ingredient): "empty" | "low" | "ok" {
    if (item.currentQty <= 0) return "empty";
    if (item.minThreshold > 0 && item.currentQty <= item.minThreshold) return "low";
    return "ok";
  }

  const STOCK_STYLE = {
    empty: { dot: "bg-red-500", text: "text-red-600 font-bold" },
    low: { dot: "bg-yellow-400", text: "text-yellow-600 font-semibold" },
    ok: { dot: "bg-green-400", text: "text-green-700" },
  };

  function IngredientModal() {
    if (!modal) return null;
    const isCreate = modal === "create";
    const title = isCreate ? "Thêm nguyên liệu" : `Sửa: ${editTarget?.name}`;
    const onSubmit = isCreate ? submitCreate : submitEdit;
    return (
      <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50"
        onClick={() => setModal(null)}>
        <div className="bg-white w-full sm:max-w-md sm:mx-4 sm:rounded-2xl rounded-t-2xl"
          onClick={e => e.stopPropagation()}>
          {/* Handle bar mobile */}
          <div className="flex justify-center pt-3 pb-1 sm:hidden">
            <div className="w-10 h-1 bg-gray-300 rounded-full" />
          </div>
          <div className="flex justify-between items-center px-5 pt-3 pb-2 border-b border-hairline">
            <h2 className="font-bold text-ink text-base">{title}</h2>
            <button onClick={() => setModal(null)}
              className="w-8 h-8 flex items-center justify-center text-muted rounded-full hover:bg-surface-card text-xl leading-none touch-manipulation"
              style={{ WebkitTapHighlightColor: "transparent" }}>×</button>
          </div>
          <form onSubmit={onSubmit} className="px-5 py-4 space-y-4 overflow-y-auto max-h-[80vh]">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase">Tên nguyên liệu *</label>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="VD: Thịt bò, Nước mắm..." maxLength={200}
                className="w-full border border-hairline px-3 py-2.5 text-sm outline-none focus:border-primary rounded-xl" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase">Đơn vị *</label>
                <select value={form.baseUnit} onChange={e => setForm(p => ({ ...p, baseUnit: e.target.value }))}
                  className="w-full border border-hairline px-3 py-2.5 text-sm outline-none focus:border-primary rounded-xl bg-white">
                  <option value="">-- Chọn --</option>
                  {Object.entries(BASE_UNIT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase">Tối thiểu</label>
                <input type="number" step="0.001" min="0" value={form.minThreshold}
                  onChange={e => setForm(p => ({ ...p, minThreshold: e.target.value }))}
                  placeholder="0"
                  className="w-full border border-hairline px-3 py-2.5 text-sm outline-none focus:border-primary rounded-xl" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase">Danh mục *</label>
              <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                className="w-full border border-hairline px-3 py-2.5 text-sm outline-none focus:border-primary rounded-xl bg-white">
                <option value="">-- Chọn danh mục --</option>
                {Object.entries(CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase">Cách quản lý *</label>
              <select value={form.managementType} onChange={e => setForm(p => ({ ...p, managementType: e.target.value }))}
                className="w-full border border-hairline px-3 py-2.5 text-sm outline-none focus:border-primary rounded-xl bg-white">
                <option value="">-- Chọn --</option>
                {Object.entries(MANAGEMENT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            {formError && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-2 rounded-xl">{formError}</div>
            )}
            <div className="flex gap-3 pt-1 pb-2">
              <button type="submit" disabled={formLoading}
                className="flex-1 py-3 bg-primary text-white text-sm font-bold rounded-xl hover:bg-primary-dark disabled:opacity-60 touch-manipulation"
                style={{ WebkitTapHighlightColor: "transparent" }}>
                {formLoading ? "Đang lưu..." : "Lưu"}
              </button>
              <button type="button" onClick={() => setModal(null)}
                className="flex-1 py-3 bg-surface-card text-gray-600 text-sm font-semibold rounded-xl hover:bg-hairline touch-manipulation"
                style={{ WebkitTapHighlightColor: "transparent" }}>
                Hủy
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  const skeletonRows = Array.from({ length: 8 });

  return (
    <div className="p-3 md:p-6">
      {/* Toast */}
      {toast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 md:top-4 md:right-4 md:left-auto md:translate-x-0 bg-gray-800 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg z-50 whitespace-nowrap">
          {toast}
        </div>
      )}

      {/* Refresh bar */}
      {refreshing && (
        <div className="fixed top-0 left-0 right-0 h-0.5 bg-primary/20 z-40">
          <div className="h-0.5 bg-primary animate-pulse w-2/3" />
        </div>
      )}

      <IngredientModal />

      {/* Header */}
      <div className="mb-4">
        <h1 className="text-lg md:text-xl font-bold text-ink">Kho nguyên liệu</h1>
        <p className="text-xs md:text-sm text-muted mt-0.5">Quản lý tồn kho nguyên liệu nhà hàng</p>
      </div>

      {/* Quick action buttons — mobile scroll row */}
      <div className="overflow-x-auto -mx-3 px-3 md:mx-0 md:px-0 mb-4">
        <div className="flex gap-2 min-w-max md:flex-wrap">
          <button onClick={openCreate}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary-dark touch-manipulation"
            style={{ WebkitTapHighlightColor: "transparent" }}>
            <span className="text-base leading-none">+</span> Thêm nguyên liệu
          </button>
          <Link href="/admin/kho/nhap-kho"
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-500 text-white text-sm font-semibold rounded-xl hover:bg-blue-600 touch-manipulation"
            style={{ WebkitTapHighlightColor: "transparent" }}>
            📥 Nhập kho
          </Link>
          <Link href="/admin/kho/xuat-kho"
            className="flex items-center gap-1.5 px-4 py-2 bg-orange-500 text-white text-sm font-semibold rounded-xl hover:bg-orange-600 touch-manipulation"
            style={{ WebkitTapHighlightColor: "transparent" }}>
            📤 Xuất kho
          </Link>
          <Link href="/admin/kho/cong-thuc"
            className="flex items-center gap-1.5 px-4 py-2 bg-surface-card text-ink text-sm font-semibold rounded-xl hover:bg-hairline border border-hairline touch-manipulation"
            style={{ WebkitTapHighlightColor: "transparent" }}>
            📋 Công thức
          </Link>
          <Link href="/admin/kho/quy-doi"
            className="flex items-center gap-1.5 px-4 py-2 bg-surface-card text-ink text-sm font-semibold rounded-xl hover:bg-hairline border border-hairline touch-manipulation"
            style={{ WebkitTapHighlightColor: "transparent" }}>
            🔄 Quy đổi
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-2 mb-4">
        {/* Search */}
        <form onSubmit={(e) => { e.preventDefault(); setPage(0); setKeyword(keywordInput); setShowLow(false); }}
          className="flex gap-2">
          <input value={keywordInput} onChange={(e) => setKeywordInput(e.target.value)}
            placeholder="Tìm nguyên liệu..."
            className="flex-1 border border-hairline px-3 py-2 text-sm outline-none focus:border-primary rounded-xl" />
          <button type="submit"
            className="px-4 py-2 bg-surface-card text-sm font-semibold rounded-xl hover:bg-hairline border border-hairline touch-manipulation"
            style={{ WebkitTapHighlightColor: "transparent" }}>
            Tìm
          </button>
        </form>

        {/* Category + low-stock filter */}
        <div className="flex gap-2 items-center overflow-x-auto -mx-3 px-3 md:mx-0 md:px-0">
          <div className="min-w-max">
            <select value={filterCategory}
              onChange={e => { setFilterCategory(e.target.value); setPage(0); setShowLow(false); }}
              className="border border-hairline px-3 py-2 text-sm rounded-xl outline-none focus:border-primary bg-white min-w-[160px]">
              <option value="">Tất cả danh mục</option>
              {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{CATEGORY_ICON[k]} {v}</option>
              ))}
            </select>
          </div>
          <button
            onPointerDown={(e) => { if (e.pointerType === "touch") { e.preventDefault(); setShowLow(p => !p); setPage(0); setKeyword(""); setKeywordInput(""); setFilterCategory(""); } }}
            onClick={() => { setShowLow(p => !p); setPage(0); setKeyword(""); setKeywordInput(""); setFilterCategory(""); }}
            className={`min-w-max px-3 py-2 text-xs font-bold rounded-xl border transition-colors touch-manipulation ${showLow ? "bg-red-500 text-white border-red-500" : "bg-white text-red-500 border-red-300 hover:bg-red-50"}`}
            style={{ WebkitTapHighlightColor: "transparent" }}>
            🔴 Sắp hết kho
          </button>
          {(keyword || filterCategory) && !showLow && (
            <button onClick={() => { setKeyword(""); setKeywordInput(""); setFilterCategory(""); setPage(0); }}
              className="min-w-max text-xs text-muted-soft hover:text-gray-600 underline touch-manipulation"
              style={{ WebkitTapHighlightColor: "transparent" }}>
              Xóa lọc
            </button>
          )}
        </div>
      </div>

      {/* ── MOBILE CARD LIST ── */}
      <div className="block md:hidden">
        {loading && !refreshing ? (
          <div className="space-y-2">
            {skeletonRows.map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-hairline p-4 animate-pulse">
                <div className="flex gap-3">
                  <div className="w-10 h-10 bg-gray-200 rounded-full shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-2/3" />
                    <div className="h-3 bg-gray-100 rounded w-1/2" />
                  </div>
                  <div className="h-5 bg-gray-200 rounded w-16" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-2xl border border-hairline p-10 text-center text-muted-soft text-sm">
            Không có nguyên liệu nào
          </div>
        ) : (
          <div className={`space-y-2 ${refreshing ? "opacity-60" : ""} transition-opacity`}>
            {items.map((item) => {
              const status = stockStatus(item);
              const s = STOCK_STYLE[status];
              const unit = BASE_UNIT_LABEL[item.baseUnit] ?? item.baseUnit;
              return (
                <div key={item.id} className="bg-white rounded-2xl border border-hairline p-4">
                  {/* Row 1: dot + name + qty */}
                  <div className="flex items-start gap-3">
                    {/* Status dot + category icon */}
                    <div className="relative shrink-0 mt-0.5">
                      <div className="w-10 h-10 rounded-full bg-surface-card flex items-center justify-center text-lg">
                        {CATEGORY_ICON[item.category] ?? "📦"}
                      </div>
                      <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${s.dot}`} />
                    </div>

                    {/* Name + badges */}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-ink text-sm leading-snug truncate">{item.name}</div>
                      <div className="flex gap-1.5 mt-1 flex-wrap">
                        <span className="text-xs bg-surface-card text-muted px-2 py-0.5 rounded-full">
                          {CATEGORY_LABEL[item.category] ?? item.category}
                        </span>
                        <span className="text-xs text-muted-soft">
                          {MANAGEMENT_LABEL[item.managementType] ?? item.managementType}
                        </span>
                      </div>
                    </div>

                    {/* Qty */}
                    <div className={`text-right shrink-0 ${s.text}`}>
                      <div className="text-base font-bold leading-tight">{item.currentQty}</div>
                      <div className="text-xs font-normal text-muted">{unit}</div>
                    </div>
                  </div>

                  {/* Row 2: threshold + avg cost */}
                  <div className="flex gap-4 mt-3 pt-3 border-t border-hairline text-xs text-muted">
                    <div>
                      <span className="text-muted-soft">Tối thiểu: </span>
                      <span className="font-medium text-ink">
                        {item.minThreshold > 0 ? `${item.minThreshold} ${unit}` : "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-soft">Giá TB: </span>
                      <span className="font-medium text-ink">
                        {item.averageCost > 0
                          ? new Intl.NumberFormat("vi-VN").format(item.averageCost) + "đ"
                          : "—"}
                      </span>
                    </div>
                  </div>

                  {/* Row 3: actions */}
                  <div className="flex gap-2 mt-3">
                    <button
                      onPointerDown={(e) => { if (e.pointerType === "touch") { e.preventDefault(); openEdit(item); } }}
                      onClick={() => openEdit(item)}
                      className="flex-1 py-2 bg-blue-50 text-blue-600 text-xs font-semibold rounded-xl hover:bg-blue-100 touch-manipulation"
                      style={{ WebkitTapHighlightColor: "transparent" }}>
                      ✏️ Sửa
                    </button>
                    <button
                      onPointerDown={(e) => { if (e.pointerType === "touch") { e.preventDefault(); deactivate(item.id, item.name); } }}
                      onClick={() => deactivate(item.id, item.name)}
                      className="flex-1 py-2 bg-red-50 text-red-500 text-xs font-semibold rounded-xl hover:bg-red-100 touch-manipulation"
                      style={{ WebkitTapHighlightColor: "transparent" }}>
                      🚫 Ngừng dùng
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── DESKTOP TABLE ── */}
      <div className={`hidden md:block bg-canvas rounded-lg border border-hairline overflow-hidden ${refreshing ? "opacity-70" : ""}`}>
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
              {loading && !refreshing ? (
                <tr><td colSpan={7} className="text-center py-8 text-muted-soft">Đang tải...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-muted-soft">Không có nguyên liệu nào</td></tr>
              ) : items.map((item) => {
                const status = stockStatus(item);
                const s = STOCK_STYLE[status];
                const unit = BASE_UNIT_LABEL[item.baseUnit] ?? item.baseUnit;
                return (
                  <tr key={item.id} className="hover:bg-surface-soft">
                    <td className="px-4 py-3 font-medium text-ink">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${s.dot}`} />
                        {item.name}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-muted">
                      {CATEGORY_ICON[item.category]} {CATEGORY_LABEL[item.category] ?? item.category}
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-muted-soft">
                      {MANAGEMENT_LABEL[item.managementType] ?? item.managementType}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={s.text}>
                        {item.currentQty} {unit}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-muted text-xs">
                      {item.minThreshold > 0 ? `${item.minThreshold} ${unit}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-muted">
                      {item.averageCost > 0
                        ? new Intl.NumberFormat("vi-VN").format(item.averageCost) + `đ/${unit}`
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
                );
              })}
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

      {/* Mobile pagination */}
      {!showLow && totalPages > 1 && (
        <div className="flex md:hidden items-center justify-center gap-3 pt-4">
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
            className="w-10 h-10 flex items-center justify-center rounded-xl border border-hairline disabled:opacity-40 hover:bg-surface-soft touch-manipulation text-sm"
            style={{ WebkitTapHighlightColor: "transparent" }}>←</button>
          <span className="text-sm text-muted">{page + 1} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
            className="w-10 h-10 flex items-center justify-center rounded-xl border border-hairline disabled:opacity-40 hover:bg-surface-soft touch-manipulation text-sm"
            style={{ WebkitTapHighlightColor: "transparent" }}>→</button>
        </div>
      )}
    </div>
  );
}
