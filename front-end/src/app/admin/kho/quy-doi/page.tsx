"use client";
import { useState, useEffect, useCallback } from "react";
import { getAuthHeaders } from "@/lib/auth";
import { extractApiError } from "@/lib/utils";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api/v1";

interface Ingredient { id: number; name: string; baseUnit: string; category: string; }
interface Conversion {
  id: number; ingredientId: number; ingredientName: string;
  saleUnit: string; baseQtyPerSaleUnit: number; note?: string;
}

const SALE_UNIT_OPTIONS: { value: string; label: string; desc: string }[] = [
  { value: "THUNG",   label: "Thùng",        desc: "VD: 1 thùng = 24 chai" },
  { value: "BAO",     label: "Bao",          desc: "VD: 1 bao gạo = 50 kg" },
  { value: "HOP",     label: "Hộp",          desc: "VD: 1 hộp trứng = 30 quả" },
  { value: "VI",      label: "Vỉ",           desc: "VD: 1 vỉ = 10 quả" },
  { value: "BINH",    label: "Bình",         desc: "VD: 1 bình = 19 lít" },
  { value: "GOI",     label: "Gói",          desc: "VD: 1 gói = 0.5 kg" },
  { value: "CHAI",    label: "Chai",         desc: "VD: 1 chai = 1 lít" },
  { value: "CUP",     label: "Ly",           desc: "" },
  { value: "PIECE",   label: "Cái/Miếng/Lon", desc: "" },
  { value: "KG",      label: "Kg",           desc: "" },
  { value: "PORTION", label: "Phần",         desc: "" },
  { value: "DISH",    label: "Đĩa/Tô",      desc: "" },
];

const SALE_UNIT_LABEL: Record<string, string> = Object.fromEntries(
  SALE_UNIT_OPTIONS.map(o => [o.value, o.label])
);

const CATEGORY_LABEL: Record<string, string> = {
  MEAT: "Thịt", FISH: "Cá", SEAFOOD: "Hải sản", VEGETABLE: "Rau củ",
  DRY_GOODS: "Khô / Đồ hộp", SPICE: "Gia vị", DRINK: "Đồ uống", OTHER: "Khác",
};
const CATEGORY_ICON: Record<string, string> = {
  MEAT: "🥩", FISH: "🐟", SEAFOOD: "🦐", VEGETABLE: "🥦",
  DRY_GOODS: "🥫", SPICE: "🧂", DRINK: "🥤", OTHER: "📦",
};

const EMPTY_FORM = { saleUnit: "", baseQtyPerSaleUnit: "", note: "" };

function fmtQty(n: number) {
  return n % 1 === 0
    ? n.toLocaleString("vi-VN")
    : n.toLocaleString("vi-VN", { maximumFractionDigits: 3 });
}

export default function QuyDoiPage() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [search, setSearch]           = useState("");
  const [selected, setSelected]       = useState<Ingredient | null>(null);
  const [mobileView, setMobileView]   = useState<"list" | "detail">("list");
  const [conversions, setConversions] = useState<Conversion[]>([]);
  const [loading, setLoading]         = useState(false);
  const [form, setForm]               = useState(EMPTY_FORM);
  const [formError, setFormError]     = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [editId, setEditId]           = useState<number | null>(null);
  const [editForm, setEditForm]       = useState({ baseQtyPerSaleUnit: "", note: "" });
  const [toast, setToast]             = useState("");

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  useEffect(() => {
    fetch(`${BASE}/inventory/ingredients?page=0&size=200`, { headers: getAuthHeaders() })
      .then(r => r.json())
      .then(j => setIngredients(j.data?.content ?? j.data ?? []))
      .catch(() => {});
  }, []);

  const loadConversions = useCallback(async (id: number) => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/inventory/conversions/ingredient/${id}`, { headers: getAuthHeaders() });
      const j = await res.json();
      setConversions(j.data ?? []);
    } finally { setLoading(false); }
  }, []);

  function selectIngredient(ing: Ingredient) {
    setSelected(ing);
    setForm(EMPTY_FORM);
    setFormError("");
    setEditId(null);
    loadConversions(ing.id);
    setMobileView("detail");
  }

  function backToList() {
    setMobileView("list");
  }

  const usedUnits = new Set(conversions.map(c => c.saleUnit));

  async function addConversion(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    if (!form.saleUnit) return setFormError("Chọn đơn vị mua");
    const qty = Number(form.baseQtyPerSaleUnit);
    if (!qty || qty <= 0) return setFormError("Số lượng quy đổi phải lớn hơn 0");
    setFormError("");
    setFormLoading(true);
    try {
      const res = await fetch(`${BASE}/inventory/conversions`, {
        method: "POST", headers: getAuthHeaders(),
        body: JSON.stringify({
          ingredientId: selected.id, saleUnit: form.saleUnit,
          baseQtyPerSaleUnit: qty,
          note: form.note.trim() || undefined,
        }),
      });
      const j = await res.json();
      if (res.ok && j.statusCode === 200) {
        showToast("Đã thêm quy đổi đơn vị");
        setForm(EMPTY_FORM);
        loadConversions(selected.id);
      } else { setFormError(extractApiError(j, "Thêm thất bại")); }
    } catch { setFormError("Không kết nối được máy chủ"); }
    finally { setFormLoading(false); }
  }

  function startEdit(c: Conversion) {
    setEditId(c.id);
    setEditForm({ baseQtyPerSaleUnit: String(c.baseQtyPerSaleUnit), note: c.note ?? "" });
  }

  async function saveEdit(id: number) {
    if (!selected) return;
    const qty = Number(editForm.baseQtyPerSaleUnit);
    if (!qty || qty <= 0) return showToast("Số lượng phải lớn hơn 0");
    try {
      const res = await fetch(`${BASE}/inventory/conversions/${id}`, {
        method: "PUT", headers: getAuthHeaders(),
        body: JSON.stringify({ baseQtyPerSaleUnit: qty, note: editForm.note.trim() || undefined }),
      });
      const j = await res.json();
      if (res.ok && j.statusCode === 200) {
        showToast("Đã cập nhật"); setEditId(null); loadConversions(selected.id);
      } else { showToast(extractApiError(j, "Cập nhật thất bại")); }
    } catch { showToast("Không kết nối được máy chủ"); }
  }

  async function deleteConversion(id: number, label: string) {
    if (!selected) return;
    if (!confirm(`Xóa quy đổi "${label}"?`)) return;
    try {
      const res = await fetch(`${BASE}/inventory/conversions/${id}`, {
        method: "DELETE", headers: getAuthHeaders(),
      });
      if (res.ok) { showToast("Đã xóa"); loadConversions(selected.id); }
      else { const j = await res.json(); showToast(extractApiError(j, "Xóa thất bại")); }
    } catch { showToast("Không kết nối được máy chủ"); }
  }

  const filtered = ingredients.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  /* ── shared: ingredient list panel ── */
  function IngredientList() {
    return (
      <div className="flex flex-col h-full">
        <div className="p-3 border-b border-hairline">
          <input type="text" placeholder="Tìm nguyên liệu..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full border border-hairline rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary bg-white" />
        </div>
        <div className="overflow-y-auto flex-1">
          {filtered.length === 0 ? (
            <p className="text-center text-muted text-sm py-8">Không có nguyên liệu</p>
          ) : filtered.map(ing => (
            <button key={ing.id} onClick={() => selectIngredient(ing)}
              className={`w-full text-left px-4 py-3 border-b border-hairline last:border-0 transition-colors ${
                selected?.id === ing.id
                  ? "bg-primary/10 border-l-2 border-l-primary"
                  : "hover:bg-surface-soft"
              } touch-manipulation`}
              style={{ WebkitTapHighlightColor: "transparent" }}>
              <div className="flex items-center gap-2">
                <span className="text-base">{CATEGORY_ICON[ing.category] ?? "📦"}</span>
                <div className="min-w-0">
                  <div className="font-medium text-sm text-ink truncate">{ing.name}</div>
                  <div className="text-xs text-muted mt-0.5">
                    Đ.vị cơ sở: <strong>{ing.baseUnit}</strong>
                    {" · "}{CATEGORY_LABEL[ing.category] ?? ing.category}
                  </div>
                </div>
                <span className="ml-auto text-xs text-muted-soft shrink-0">→</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  /* ── shared: conversion detail panel ── */
  function ConversionDetail({ isDesktop = false }: { isDesktop?: boolean }) {
    if (!selected) {
      return (
        <div className="bg-white border border-hairline rounded-2xl flex flex-col items-center justify-center h-48 gap-2 p-6 text-center">
          <div className="text-3xl">🔄</div>
          <p className="text-muted text-sm">Chọn nguyên liệu để cấu hình quy đổi</p>
          <p className="text-xs text-muted-soft">VD: Bia Hà Nội — baseUnit: PIECE → 1 Thùng = 24 PIECE</p>
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-4">
        {/* Ingredient info */}
        <div className="bg-white border border-hairline rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-surface-card flex items-center justify-center text-xl shrink-0">
              {CATEGORY_ICON[selected.category] ?? "📦"}
            </div>
            <div>
              <h2 className="font-bold text-ink text-base">{selected.name}</h2>
              <p className="text-xs text-muted mt-0.5">
                Đơn vị kho cơ sở: <strong className="text-ink">{selected.baseUnit}</strong>
                {" · "}{CATEGORY_LABEL[selected.category] ?? selected.category}
              </p>
              <p className="text-xs text-muted-soft mt-1">
                Quy đổi cho phép nhập kho bằng đơn vị lớn hơn — hệ thống tự nhân tỷ lệ ra đơn vị cơ sở.
              </p>
            </div>
          </div>
        </div>

        {/* Conversion list */}
        <div className="bg-white border border-hairline rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-hairline flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink">
              Quy đổi đã cấu hình
              <span className="ml-2 text-xs font-normal text-muted">({conversions.length})</span>
            </h3>
          </div>

          {loading ? (
            <div className="py-8 text-center text-muted text-sm">Đang tải...</div>
          ) : conversions.length === 0 ? (
            <div className="py-8 text-center text-muted-soft text-sm px-4">
              Chưa có quy đổi nào.<br />
              <span className="text-xs">Thêm bên dưới để nhập kho theo thùng, bao, hộp...</span>
            </div>
          ) : isDesktop ? (
            /* Desktop: table */
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-soft text-muted text-xs uppercase tracking-wider">
                  <th className="px-4 py-2.5 text-left font-semibold">Đơn vị mua</th>
                  <th className="px-4 py-2.5 text-center font-semibold">= ? {selected.baseUnit}</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Ghi chú</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {conversions.map(c => (
                  <tr key={c.id} className="hover:bg-surface-soft/60">
                    <td className="px-4 py-3 font-semibold text-ink">
                      1 {SALE_UNIT_LABEL[c.saleUnit] ?? c.saleUnit}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {editId === c.id ? (
                        <input type="number" step="0.001" min="0.001"
                          value={editForm.baseQtyPerSaleUnit}
                          onChange={e => setEditForm(f => ({ ...f, baseQtyPerSaleUnit: e.target.value }))}
                          className="w-24 border border-primary rounded px-2 py-1 text-sm text-center outline-none"
                          autoFocus />
                      ) : (
                        <span className="font-bold text-blue-700">{fmtQty(c.baseQtyPerSaleUnit)}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-soft text-xs italic">
                      {editId === c.id ? (
                        <input type="text" value={editForm.note}
                          onChange={e => setEditForm(f => ({ ...f, note: e.target.value }))}
                          placeholder="Ghi chú..."
                          className="w-full border border-hairline rounded px-2 py-1 text-sm outline-none focus:border-primary" />
                      ) : (c.note || "—")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {editId === c.id ? (
                        <div className="flex gap-1.5 justify-end">
                          <button onClick={() => saveEdit(c.id)}
                            className="text-xs px-3 py-1 bg-primary text-white rounded hover:bg-primary-dark">Lưu</button>
                          <button onClick={() => setEditId(null)}
                            className="text-xs px-3 py-1 border border-hairline rounded text-muted hover:bg-surface-soft">Hủy</button>
                        </div>
                      ) : (
                        <div className="flex gap-1.5 justify-end">
                          <button onClick={() => startEdit(c)}
                            className="text-xs px-3 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100">Sửa</button>
                          <button onClick={() => deleteConversion(c.id, SALE_UNIT_LABEL[c.saleUnit] ?? c.saleUnit)}
                            className="text-xs px-3 py-1 bg-red-50 text-red-500 rounded hover:bg-red-100">Xóa</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            /* Mobile: cards */
            <div className="divide-y divide-hairline">
              {conversions.map(c => (
                <div key={c.id} className="px-4 py-4">
                  {editId === c.id ? (
                    /* Edit mode */
                    <div className="space-y-3">
                      <div className="text-sm font-semibold text-ink">
                        1 {SALE_UNIT_LABEL[c.saleUnit] ?? c.saleUnit} = ? {selected.baseUnit}
                      </div>
                      <input type="number" step="0.001" min="0.001"
                        value={editForm.baseQtyPerSaleUnit}
                        onChange={e => setEditForm(f => ({ ...f, baseQtyPerSaleUnit: e.target.value }))}
                        placeholder="Số lượng quy đổi"
                        className="w-full border border-primary rounded-xl px-3 py-2.5 text-sm outline-none"
                        autoFocus />
                      <input type="text" value={editForm.note}
                        onChange={e => setEditForm(f => ({ ...f, note: e.target.value }))}
                        placeholder="Ghi chú (tùy chọn)"
                        className="w-full border border-hairline rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary" />
                      <div className="flex gap-2">
                        <button onClick={() => saveEdit(c.id)}
                          className="flex-1 py-2.5 bg-primary text-white text-sm font-bold rounded-xl hover:bg-primary-dark touch-manipulation"
                          style={{ WebkitTapHighlightColor: "transparent" }}>
                          Lưu
                        </button>
                        <button onClick={() => setEditId(null)}
                          className="flex-1 py-2.5 bg-surface-card text-muted text-sm font-semibold rounded-xl hover:bg-hairline touch-manipulation"
                          style={{ WebkitTapHighlightColor: "transparent" }}>
                          Hủy
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* View mode */
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <div className="text-sm font-semibold text-ink">
                          1 <span className="text-primary">{SALE_UNIT_LABEL[c.saleUnit] ?? c.saleUnit}</span>
                          {" = "}
                          <span className="text-blue-700 font-bold">{fmtQty(c.baseQtyPerSaleUnit)}</span>
                          {" "}{selected.baseUnit}
                        </div>
                        {c.note && <div className="text-xs text-muted-soft italic mt-0.5">{c.note}</div>}
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <button
                          onPointerDown={e => { if (e.pointerType === "touch") { e.preventDefault(); startEdit(c); } }}
                          onClick={() => startEdit(c)}
                          className="w-9 h-9 flex items-center justify-center bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 touch-manipulation"
                          style={{ WebkitTapHighlightColor: "transparent" }}>
                          ✏️
                        </button>
                        <button
                          onPointerDown={e => { if (e.pointerType === "touch") { e.preventDefault(); deleteConversion(c.id, SALE_UNIT_LABEL[c.saleUnit] ?? c.saleUnit); } }}
                          onClick={() => deleteConversion(c.id, SALE_UNIT_LABEL[c.saleUnit] ?? c.saleUnit)}
                          className="w-9 h-9 flex items-center justify-center bg-red-50 text-red-500 rounded-xl hover:bg-red-100 touch-manipulation"
                          style={{ WebkitTapHighlightColor: "transparent" }}>
                          🗑️
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add conversion form */}
        <div className="bg-white border border-hairline rounded-2xl p-4">
          <h3 className="text-sm font-semibold text-ink mb-3">➕ Thêm quy đổi mới</h3>
          <form onSubmit={addConversion} className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-muted uppercase block mb-1.5">
                Đơn vị mua <span className="text-red-500">*</span>
              </label>
              <select value={form.saleUnit}
                onChange={e => setForm(f => ({ ...f, saleUnit: e.target.value }))}
                className="w-full border border-hairline rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary bg-white">
                <option value="">— Chọn đơn vị —</option>
                {SALE_UNIT_OPTIONS.filter(o => !usedUnits.has(o.value)).map(o => (
                  <option key={o.value} value={o.value}>
                    {o.label}{o.desc ? ` — ${o.desc}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted uppercase block mb-1.5">
                1 {form.saleUnit ? (SALE_UNIT_LABEL[form.saleUnit] ?? form.saleUnit) : "đơn vị mua"} = ? {selected.baseUnit}
                <span className="text-red-500"> *</span>
              </label>
              <input type="number" step="0.001" min="0.001" placeholder="VD: 24"
                value={form.baseQtyPerSaleUnit}
                onChange={e => setForm(f => ({ ...f, baseQtyPerSaleUnit: e.target.value }))}
                className="w-full border border-hairline rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary" />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted uppercase block mb-1.5">Ghi chú</label>
              <input type="text" placeholder="VD: Bia 330ml lon"
                value={form.note}
                onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                className="w-full border border-hairline rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary" />
            </div>

            {/* Preview */}
            {form.saleUnit && Number(form.baseQtyPerSaleUnit) > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl px-3 py-2.5 text-sm text-blue-700">
                <div>
                  1 <strong>{SALE_UNIT_LABEL[form.saleUnit]}</strong>
                  {" = "}
                  <strong>{fmtQty(Number(form.baseQtyPerSaleUnit))} {selected.baseUnit}</strong>
                </div>
                <div className="text-xs mt-0.5 text-blue-500">
                  Nhập 5 {SALE_UNIT_LABEL[form.saleUnit]} → +{fmtQty(5 * Number(form.baseQtyPerSaleUnit))} {selected.baseUnit} vào kho
                </div>
              </div>
            )}

            {formError && <p className="text-red-500 text-xs">{formError}</p>}

            <button type="submit" disabled={formLoading}
              className="w-full py-3 bg-primary text-white text-sm font-bold rounded-xl hover:bg-primary-dark disabled:opacity-60 touch-manipulation"
              style={{ WebkitTapHighlightColor: "transparent" }}>
              {formLoading ? "Đang lưu..." : "Thêm quy đổi"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 md:p-6">
      {/* Toast */}
      {toast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 md:top-4 md:right-4 md:left-auto md:translate-x-0 bg-gray-800 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg z-50 whitespace-nowrap">
          {toast}
        </div>
      )}

      {/* ── MOBILE LAYOUT ── */}
      <div className="block md:hidden">
        {mobileView === "list" ? (
          <>
            <div className="mb-4">
              <h1 className="text-lg font-bold text-ink">Quy đổi đơn vị</h1>
              <p className="text-xs text-muted mt-0.5">
                Cấu hình nhập kho theo đơn vị mua (thùng, bao, hộp...)
              </p>
            </div>

            <div className="bg-white border border-hairline rounded-2xl overflow-hidden" style={{ minHeight: "60vh" }}>
              <IngredientList />
            </div>
          </>
        ) : (
          <>
            {/* Detail header */}
            <div className="flex items-center gap-3 mb-4">
              <button
                onPointerDown={e => { if (e.pointerType === "touch") { e.preventDefault(); backToList(); } }}
                onClick={backToList}
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-surface-card text-muted hover:bg-hairline touch-manipulation"
                style={{ WebkitTapHighlightColor: "transparent" }}>
                ←
              </button>
              <div className="min-w-0">
                <h1 className="text-base font-bold text-ink truncate">{selected?.name}</h1>
                <p className="text-xs text-muted">Đơn vị cơ sở: {selected?.baseUnit}</p>
              </div>
            </div>

            <ConversionDetail isDesktop={false} />
          </>
        )}
      </div>

      {/* ── DESKTOP LAYOUT (2-panel) ── */}
      <div className="hidden md:block">
        <h1 className="text-xl font-bold text-ink mb-1">Quy đổi đơn vị</h1>
        <p className="text-sm text-muted mb-6">
          Cấu hình để nhập kho theo đơn vị mua (thùng, bao, hộp...) thay vì đơn vị cơ sở
        </p>

        <div className="grid grid-cols-5 gap-5">
          {/* Left panel */}
          <div className="col-span-2 bg-canvas border border-hairline rounded-xl overflow-hidden flex flex-col"
            style={{ height: "calc(100vh - 12rem)" }}>
            <IngredientList />
          </div>

          {/* Right panel */}
          <div className="col-span-3 overflow-y-auto" style={{ height: "calc(100vh - 12rem)" }}>
            <ConversionDetail isDesktop={true} />
          </div>
        </div>
      </div>
    </div>
  );
}
