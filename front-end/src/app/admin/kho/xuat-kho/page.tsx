"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { getAuthHeaders } from "@/lib/auth";
import { extractApiError, formatDate } from "@/lib/utils";

type TimeFilter = "" | "today" | "week" | "month";
function vnToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
}
function vnDayStart(dateStr: string): Date {
  return new Date(dateStr + "T00:00:00+07:00");
}
function getDateRange(filter: TimeFilter, offset: number): { from?: string; to?: string } {
  if (!filter) return {};
  const vnDate = vnToday();
  if (filter === "today") {
    const [y, m, d] = vnDate.split("-").map(Number);
    const base = new Date(Date.UTC(y, m - 1, d + offset));
    const baseStr = `${base.getUTCFullYear()}-${String(base.getUTCMonth() + 1).padStart(2, "0")}-${String(base.getUTCDate()).padStart(2, "0")}`;
    const start = vnDayStart(baseStr);
    return { from: start.toISOString(), to: new Date(start.getTime() + 86400000).toISOString() };
  }
  if (filter === "week") {
    const [vy, vm, vd] = vnDate.split("-").map(Number);
    const jsDay = new Date(Date.UTC(vy, vm - 1, vd)).getUTCDay();
    const dow = jsDay === 0 ? 6 : jsDay - 1;
    const monday = new Date(vnDayStart(vnDate).getTime() + (offset * 7 - dow) * 86400000);
    return { from: monday.toISOString(), to: new Date(monday.getTime() + 7 * 86400000).toISOString() };
  }
  if (filter === "month") {
    const [y, m] = vnDate.split("-").map(Number);
    let tm = m + offset, ty = y;
    while (tm <= 0) { tm += 12; ty--; }
    while (tm > 12) { tm -= 12; ty++; }
    const nm = tm === 12 ? 1 : tm + 1, ny = tm === 12 ? ty + 1 : ty;
    const start = vnDayStart(`${ty}-${String(tm).padStart(2, "0")}-01`);
    return { from: start.toISOString(), to: vnDayStart(`${ny}-${String(nm).padStart(2, "0")}-01`).toISOString() };
  }
  return {};
}
function getNavLabel(filter: TimeFilter, offset: number): string {
  if (!filter) return "";
  const vnDate = vnToday();
  const fmt = (d: Date) => d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", timeZone: "Asia/Ho_Chi_Minh" });
  if (filter === "today") {
    const [y, m, d] = vnDate.split("-").map(Number);
    const ds = fmt(new Date(Date.UTC(y, m - 1, d + offset)));
    return offset === 0 ? `Hôm nay · ${ds}` : offset === -1 ? `Hôm qua · ${ds}` : ds;
  }
  if (filter === "week") {
    const [vy, vm, vd] = vnDate.split("-").map(Number);
    const jsDay = new Date(Date.UTC(vy, vm - 1, vd)).getUTCDay();
    const dow = jsDay === 0 ? 6 : jsDay - 1;
    const monday = new Date(vnDayStart(vnDate).getTime() + (offset * 7 - dow) * 86400000);
    const sunday = new Date(monday.getTime() + 6 * 86400000);
    const range = `${fmt(monday)} – ${fmt(sunday)}`;
    return offset === 0 ? `Tuần này · ${range}` : offset === -1 ? `Tuần trước · ${range}` : range;
  }
  if (filter === "month") {
    const [y, m] = vnDate.split("-").map(Number);
    let tm = m + offset, ty = y;
    while (tm <= 0) { tm += 12; ty--; }
    while (tm > 12) { tm -= 12; ty++; }
    const ms = `T${tm}/${ty}`;
    return offset === 0 ? `Tháng này · ${ms}` : offset === -1 ? `Tháng trước · ${ms}` : ms;
  }
  return "";
}

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api/v1";

interface Ingredient {
  id: number;
  name: string;
  baseUnit: string;
  currentQty: number;
}

interface DeductionRecord {
  id: number;
  ingredientId: number;
  ingredientName: string;
  qtyDeducted: number;
  reason: string;
  referenceId: string | null;
  deductedBy: string;
  note: string | null;
  createdAt: string;
}

const REASON_LABEL: Record<string, string> = {
  MANUAL: "Xuất thủ công",
  WASTE: "Hao hụt / hỏng",
  ADJUSTMENT: "Điều chỉnh",
  ORDER: "Theo đơn hàng",
  BOOKING_RESTORE: "Hoàn kho booking",
};

const REASON_COLOR: Record<string, string> = {
  MANUAL: "bg-blue-100 text-blue-700",
  WASTE: "bg-red-100 text-red-600",
  ADJUSTMENT: "bg-purple-100 text-purple-700",
  ORDER: "bg-canvas text-gray-600",
  BOOKING_RESTORE: "bg-green-100 text-green-700",
};

type Tab = "manual" | "adjust" | "history";

export default function XuatKhoPage() {
  const [tab, setTab] = useState<Tab>("manual");
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);

  // Manual deduction form
  const [manual, setManual] = useState({ ingredientId: "", qtyDeducted: "", reason: "MANUAL", note: "" });
  const [manualLoading, setManualLoading] = useState(false);
  const [manualError, setManualError] = useState("");
  const [manualSuccess, setManualSuccess] = useState("");

  // Adjustment form
  const [adj, setAdj] = useState({ ingredientId: "", adjustmentQty: "", note: "" });
  const [adjLoading, setAdjLoading] = useState(false);
  const [adjError, setAdjError] = useState("");
  const [adjSuccess, setAdjSuccess] = useState("");

  // History
  const [history, setHistory] = useState<DeductionRecord[]>([]);
  const [histLoading, setHistLoading] = useState(false);
  const [histPage, setHistPage] = useState(0);
  const [histTotalPages, setHistTotalPages] = useState(0);
  const [filterIngredient, setFilterIngredient] = useState("");
  const [filterReason, setFilterReason] = useState("");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("");
  const [navOffset, setNavOffset] = useState(0);
  const [deleteLoading, setDeleteLoading] = useState<number | null>(null);

  useEffect(() => {
    fetch(`${BASE}/inventory/ingredients?page=0&size=100`, { headers: getAuthHeaders() })
      .then(r => r.json())
      .then(json => {
        if (json.statusCode === 200) setIngredients(json.data?.content ?? json.data ?? []);
      })
      .catch(() => {});
  }, []);

  const loadHistory = useCallback(async () => {
    setHistLoading(true);
    try {
      const params = new URLSearchParams({ page: String(histPage), size: "20" });
      if (filterIngredient) params.set("ingredientId", filterIngredient);
      if (filterReason) params.set("reason", filterReason);
      const range = getDateRange(timeFilter, navOffset);
      if (range.from) params.set("from", range.from);
      if (range.to)   params.set("to",   range.to);
      const res = await fetch(`${BASE}/inventory/deductions?${params}`, { headers: getAuthHeaders() });
      const json = await res.json();
      if (json.statusCode === 200) {
        setHistory(json.data?.content ?? []);
        setHistTotalPages(json.data?.totalPages ?? 0);
      }
    } finally { setHistLoading(false); }
  }, [histPage, filterIngredient, filterReason, timeFilter, navOffset]);

  useEffect(() => {
    if (tab === "history") loadHistory();
  }, [tab, loadHistory]);

  async function handleDeleteDeduction(id: number, name: string) {
    if (!confirm(`Xóa phiếu xuất "${name}"? Tồn kho sẽ được hoàn về tương ứng.`)) return;
    setDeleteLoading(id);
    try {
      const res = await fetch(`${BASE}/inventory/deductions/${id}`, {
        method: "DELETE", headers: getAuthHeaders(),
      });
      if (res.ok || res.status === 204) {
        loadHistory();
      } else {
        const json = await res.json().catch(() => ({}));
        alert(json.message ?? "Xóa thất bại");
      }
    } finally { setDeleteLoading(null); }
  }

  async function submitManual(e: React.FormEvent) {
    e.preventDefault();
    setManualError(""); setManualSuccess("");
    if (!manual.ingredientId) return setManualError("Vui lòng chọn nguyên liệu");
    if (!manual.qtyDeducted || Number(manual.qtyDeducted) <= 0) return setManualError("Số lượng phải lớn hơn 0");
    setManualLoading(true);
    try {
      const body = {
        ingredientId: Number(manual.ingredientId),
        qtyDeducted: Number(manual.qtyDeducted),
        reason: manual.reason,
        ...(manual.note.trim() ? { note: manual.note.trim() } : {}),
      };
      const res = await fetch(`${BASE}/inventory/deductions/manual`, {
        method: "POST", headers: getAuthHeaders(), body: JSON.stringify(body),
      });
      const json = await res.json();
      if (res.ok && json.statusCode === 200) {
        setManualSuccess(`Đã xuất ${manual.qtyDeducted} ${ingredients.find(i => i.id === Number(manual.ingredientId))?.baseUnit ?? ""} thành công`);
        setManual({ ingredientId: "", qtyDeducted: "", reason: "MANUAL", note: "" });
        // reload ingredients để cập nhật tồn kho
        fetch(`${BASE}/inventory/ingredients?page=0&size=100`, { headers: getAuthHeaders() })
          .then(r => r.json()).then(j => { if (j.statusCode === 200) setIngredients(j.data?.content ?? []); });
      } else {
        setManualError(extractApiError(json, "Xuất kho thất bại"));
      }
    } catch { setManualError("Không kết nối được máy chủ"); }
    finally { setManualLoading(false); }
  }

  async function submitAdjust(e: React.FormEvent) {
    e.preventDefault();
    setAdjError(""); setAdjSuccess("");
    if (!adj.ingredientId) return setAdjError("Vui lòng chọn nguyên liệu");
    if (!adj.adjustmentQty || Number(adj.adjustmentQty) === 0) return setAdjError("Số lượng điều chỉnh không được bằng 0");
    setAdjLoading(true);
    try {
      const body = {
        ingredientId: Number(adj.ingredientId),
        adjustmentQty: Number(adj.adjustmentQty),
        ...(adj.note.trim() ? { note: adj.note.trim() } : {}),
      };
      const res = await fetch(`${BASE}/inventory/deductions/adjust`, {
        method: "POST", headers: getAuthHeaders(), body: JSON.stringify(body),
      });
      const json = await res.json();
      if (res.ok && json.statusCode === 200) {
        const qty = Number(adj.adjustmentQty);
        setAdjSuccess(`Đã ${qty > 0 ? "tăng" : "giảm"} ${Math.abs(qty)} ${ingredients.find(i => i.id === Number(adj.ingredientId))?.baseUnit ?? ""} thành công`);
        setAdj({ ingredientId: "", adjustmentQty: "", note: "" });
        fetch(`${BASE}/inventory/ingredients?page=0&size=100`, { headers: getAuthHeaders() })
          .then(r => r.json()).then(j => { if (j.statusCode === 200) setIngredients(j.data?.content ?? []); });
      } else {
        setAdjError(extractApiError(json, "Điều chỉnh thất bại"));
      }
    } catch { setAdjError("Không kết nối được máy chủ"); }
    finally { setAdjLoading(false); }
  }

  const selectedManualIngredient = ingredients.find(i => i.id === Number(manual.ingredientId));
  const selectedAdjIngredient = ingredients.find(i => i.id === Number(adj.ingredientId));

  const TABS: { key: Tab; label: string }[] = [
    { key: "manual", label: "Xuất kho thủ công" },
    { key: "adjust", label: "Điều chỉnh tồn kho" },
    { key: "history", label: "Lịch sử" },
  ];

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/kho" className="text-muted-soft hover:text-gray-600 text-sm">← Quay lại Kho</Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-lg font-bold text-ink">Xuất kho / Điều chỉnh</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-hairline">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-5 py-2.5 text-sm font-medium transition-colors ${tab === t.key
              ? "border-b-2 border-primary text-primary"
              : "text-muted hover:text-ink"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Xuất kho thủ công */}
      {tab === "manual" && (
        <div className="max-w-md">
          <div className="bg-canvas rounded-lg border border-hairline-sm p-6">
            <p className="text-xs text-muted mb-4">Dùng khi xuất nguyên liệu phục vụ hoặc ghi nhận hao hụt mà không qua đơn hàng.</p>
            <form onSubmit={submitManual} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase">Nguyên liệu *</label>
                <select value={manual.ingredientId}
                  onChange={(e) => setManual(p => ({ ...p, ingredientId: e.target.value }))}
                  className="w-full border border-hairline px-3 py-2 text-sm outline-none focus:border-primary rounded bg-white">
                  <option value="">-- Chọn nguyên liệu --</option>
                  {ingredients.map(i => (
                    <option key={i.id} value={i.id}>{i.name} (tồn: {i.currentQty} {i.baseUnit})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase">
                    Số lượng {selectedManualIngredient ? `(${selectedManualIngredient.baseUnit})` : ""} *
                  </label>
                  <input type="number" step="0.001" min="0.001"
                    value={manual.qtyDeducted}
                    onChange={(e) => setManual(p => ({ ...p, qtyDeducted: e.target.value }))}
                    placeholder="VD: 2.5"
                    className="w-full border border-hairline px-3 py-2 text-sm outline-none focus:border-primary rounded" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase">Lý do *</label>
                  <select value={manual.reason}
                    onChange={(e) => setManual(p => ({ ...p, reason: e.target.value }))}
                    className="w-full border border-hairline px-3 py-2 text-sm outline-none focus:border-primary rounded bg-white">
                    <option value="MANUAL">Xuất thủ công</option>
                    <option value="WASTE">Hao hụt / hỏng</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase">Ghi chú</label>
                <input value={manual.note}
                  onChange={(e) => setManual(p => ({ ...p, note: e.target.value }))}
                  placeholder="VD: Dùng cho tiệc chiều..."
                  className="w-full border border-hairline px-3 py-2 text-sm outline-none focus:border-primary rounded" />
              </div>

              {manualError && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-2.5 rounded">{manualError}</div>
              )}
              {manualSuccess && (
                <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-2.5 rounded">{manualSuccess}</div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={manualLoading}
                  className="px-6 py-2 bg-primary text-white text-sm font-semibold rounded hover:bg-primary-dark disabled:opacity-60">
                  {manualLoading ? "Đang xử lý..." : "Xuất kho"}
                </button>
                <button type="button" onClick={() => setManual({ ingredientId: "", qtyDeducted: "", reason: "MANUAL", note: "" })}
                  className="px-6 py-2 bg-canvas text-gray-600 text-sm font-semibold rounded hover:bg-surface-card">
                  Xóa form
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tab: Điều chỉnh tồn kho */}
      {tab === "adjust" && (
        <div className="max-w-md">
          <div className="bg-canvas rounded-lg border border-hairline-sm p-6">
            <p className="text-xs text-muted mb-4">
              Điều chỉnh số lượng tồn kho thực tế. Nhập <strong>số dương</strong> để tăng, <strong>số âm</strong> để giảm.
            </p>
            <form onSubmit={submitAdjust} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase">Nguyên liệu *</label>
                <select value={adj.ingredientId}
                  onChange={(e) => setAdj(p => ({ ...p, ingredientId: e.target.value }))}
                  className="w-full border border-hairline px-3 py-2 text-sm outline-none focus:border-primary rounded bg-white">
                  <option value="">-- Chọn nguyên liệu --</option>
                  {ingredients.map(i => (
                    <option key={i.id} value={i.id}>{i.name} (tồn: {i.currentQty} {i.baseUnit})</option>
                  ))}
                </select>
                {selectedAdjIngredient && (
                  <p className="text-xs text-muted-soft mt-1">Tồn kho hiện tại: <strong>{selectedAdjIngredient.currentQty} {selectedAdjIngredient.baseUnit}</strong></p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase">
                  Số lượng điều chỉnh {selectedAdjIngredient ? `(${selectedAdjIngredient.baseUnit})` : ""} *
                </label>
                <input type="number" step="0.001"
                  value={adj.adjustmentQty}
                  onChange={(e) => setAdj(p => ({ ...p, adjustmentQty: e.target.value }))}
                  placeholder="VD: -5 để giảm, +10 để tăng"
                  className="w-full border border-hairline px-3 py-2 text-sm outline-none focus:border-primary rounded" />
                {adj.adjustmentQty && selectedAdjIngredient && Number(adj.adjustmentQty) !== 0 && (
                  <p className="text-xs mt-1">
                    Tồn kho sau điều chỉnh:{" "}
                    <strong className={selectedAdjIngredient.currentQty + Number(adj.adjustmentQty) < 0 ? "text-red-600" : "text-green-700"}>
                      {(selectedAdjIngredient.currentQty + Number(adj.adjustmentQty)).toFixed(3)} {selectedAdjIngredient.baseUnit}
                    </strong>
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase">Ghi chú *</label>
                <input value={adj.note}
                  onChange={(e) => setAdj(p => ({ ...p, note: e.target.value }))}
                  placeholder="VD: Kiểm kho tháng 6, điều chỉnh sau kiểm đếm thực tế..."
                  className="w-full border border-hairline px-3 py-2 text-sm outline-none focus:border-primary rounded" />
              </div>

              {adjError && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-2.5 rounded">{adjError}</div>
              )}
              {adjSuccess && (
                <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-2.5 rounded">{adjSuccess}</div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={adjLoading}
                  className="px-6 py-2 bg-purple-600 text-white text-sm font-semibold rounded hover:bg-purple-700 disabled:opacity-60">
                  {adjLoading ? "Đang xử lý..." : "Điều chỉnh"}
                </button>
                <button type="button" onClick={() => setAdj({ ingredientId: "", adjustmentQty: "", note: "" })}
                  className="px-6 py-2 bg-canvas text-gray-600 text-sm font-semibold rounded hover:bg-surface-card">
                  Xóa form
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tab: Lịch sử */}
      {tab === "history" && (
        <div>
          <div className="mb-4 space-y-2">
            <div className="flex gap-3 flex-wrap items-center">
              <select value={filterIngredient}
                onChange={(e) => { setFilterIngredient(e.target.value); setHistPage(0); }}
                className="border border-hairline px-3 py-1.5 text-sm outline-none focus:border-primary rounded bg-white">
                <option value="">Tất cả nguyên liệu</option>
                {ingredients.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
              <select value={filterReason}
                onChange={(e) => { setFilterReason(e.target.value); setHistPage(0); }}
                className="border border-hairline px-3 py-1.5 text-sm outline-none focus:border-primary rounded bg-white">
                <option value="">Tất cả lý do</option>
                {Object.entries(REASON_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <button onClick={() => { setFilterIngredient(""); setFilterReason(""); setTimeFilter(""); setNavOffset(0); setHistPage(0); }}
                className="px-3 py-1.5 text-xs text-muted hover:text-ink border border-hairline rounded">
                Xóa lọc
              </button>
              <button onClick={loadHistory} className="px-3 py-1.5 bg-canvas text-sm rounded hover:bg-surface-card">↻ Làm mới</button>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {(["", "today", "week", "month"] as TimeFilter[]).map((f) => {
                const labels = { "": "Tất cả ngày", today: "Hôm nay", week: "Tuần này", month: "Tháng này" };
                return (
                  <button key={f} onClick={() => { setTimeFilter(f); setNavOffset(0); setHistPage(0); }}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-full border transition-colors touch-manipulation ${
                      timeFilter === f ? "bg-primary text-white border-primary" : "bg-canvas text-gray-600 border-hairline hover:border-primary"
                    }`}>
                    {labels[f]}
                  </button>
                );
              })}
            </div>
            {timeFilter && (
              <div className="flex items-center justify-center gap-1.5">
                <button onClick={() => { setNavOffset(o => o - 1); setHistPage(0); }}
                  className="w-9 h-9 flex items-center justify-center rounded-full border border-hairline bg-canvas text-gray-600 hover:bg-surface-soft text-2xl leading-none touch-manipulation">
                  ‹
                </button>
                <span className="text-xs font-medium text-gray-700 text-center min-w-[150px]">
                  {getNavLabel(timeFilter, navOffset)}
                </span>
                <button onClick={() => { setNavOffset(o => Math.min(0, o + 1)); setHistPage(0); }}
                  disabled={navOffset >= 0}
                  className="w-9 h-9 flex items-center justify-center rounded-full border border-hairline bg-canvas text-gray-600 hover:bg-surface-soft disabled:opacity-30 text-2xl leading-none touch-manipulation">
                  ›
                </button>
                {navOffset < 0 && (
                  <button onClick={() => { setNavOffset(0); setHistPage(0); }}
                    className="text-[11px] text-primary border border-primary/30 px-2 py-0.5 rounded-full hover:bg-primary/5 touch-manipulation flex-shrink-0">
                    Về {timeFilter === "today" ? "hôm nay" : timeFilter === "week" ? "tuần này" : "tháng này"}
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="bg-canvas rounded-lg border border-hairline overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-soft border-b border-hairline text-xs text-muted uppercase">
                    <th className="text-left px-4 py-3">Nguyên liệu</th>
                    <th className="text-right px-4 py-3">Số lượng</th>
                    <th className="text-center px-4 py-3">Lý do</th>
                    <th className="text-left px-4 py-3">Tham chiếu</th>
                    <th className="text-left px-4 py-3">Người thực hiện</th>
                    <th className="text-left px-4 py-3">Ghi chú</th>
                    <th className="text-left px-4 py-3">Thời gian</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {histLoading ? (
                    <tr><td colSpan={7} className="text-center py-8 text-muted-soft">Đang tải...</td></tr>
                  ) : history.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-8 text-muted-soft">Không có bản ghi nào</td></tr>
                  ) : history.map((r) => (
                    <tr key={r.id} className="hover:bg-surface-soft">
                      <td className="px-4 py-2.5 font-medium text-ink">{r.ingredientName}</td>
                      <td className="px-4 py-2.5 text-right">
                        <span className={r.reason === "BOOKING_RESTORE" ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>
                          {r.reason === "BOOKING_RESTORE" ? "+" : "-"}{r.qtyDeducted}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${REASON_COLOR[r.reason] ?? "bg-canvas text-muted"}`}>
                          {REASON_LABEL[r.reason] ?? r.reason}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted">{r.referenceId ?? "—"}</td>
                      <td className="px-4 py-2.5 text-gray-600">{r.deductedBy}</td>
                      <td className="px-4 py-2.5 text-xs text-muted max-w-[150px] truncate">{r.note ?? "—"}</td>
                      <td className="px-4 py-2.5 text-xs text-muted-soft">{formatDate(r.createdAt)}</td>
                      <td className="px-4 py-2.5 text-center">
                        <button
                          onClick={() => handleDeleteDeduction(r.id, r.ingredientName)}
                          disabled={deleteLoading === r.id}
                          className="px-2 py-1 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 rounded border border-red-200 disabled:opacity-40"
                        >
                          {deleteLoading === r.id ? "..." : "Xóa"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {histTotalPages > 1 && (
              <div className="flex items-center justify-center gap-2 p-4 border-t border-hairline">
                <button onClick={() => setHistPage(p => Math.max(0, p - 1))} disabled={histPage === 0}
                  className="px-3 py-1 text-sm border rounded disabled:opacity-40 hover:bg-surface-soft">← Trước</button>
                <span className="text-sm text-gray-600">Trang {histPage + 1} / {histTotalPages}</span>
                <button onClick={() => setHistPage(p => Math.min(histTotalPages - 1, p + 1))} disabled={histPage >= histTotalPages - 1}
                  className="px-3 py-1 text-sm border rounded disabled:opacity-40 hover:bg-surface-soft">Tiếp →</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
