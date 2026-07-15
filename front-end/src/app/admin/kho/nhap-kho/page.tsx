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
  averageCost: number;
}

interface UnitConversion {
  id: number;
  saleUnit: string;
  baseQtyPerSaleUnit: number;
  note?: string;
}

interface ImportRecord {
  id: number;
  ingredientName: string;
  ingredientBaseUnit: string;
  quantityImported: number;   // số lượng theo đơn vị cơ sở (sau quy đổi)
  saleUnit: string | null;
  saleQtyImported: number | null;
  unitCost: number;
  totalCost: number;
  purchaseNote: string | null;
  importedBy: string;
  note: string | null;
  ingredientCurrentQty: number;
  ingredientAverageCost: number;
  createdAt: string;
}

const SALE_UNIT_LABEL: Record<string, string> = {
  CUP: "Ly", CHAI: "Chai", PORTION: "Phần", KG: "Kg",
  PIECE: "Cái / Miếng", DISH: "Dĩa / Bát",
  THUNG: "Thùng", BAO: "Bao", HOP: "Hộp",
  VI: "Vỉ", BINH: "Bình", GOI: "Gói",
};

type Tab = "form" | "history";

function fmt(n: number) { return new Intl.NumberFormat("vi-VN").format(Math.round(n)) + "đ"; }
function fmtQty(n: number) {
  return n % 1 === 0
    ? n.toLocaleString("vi-VN")
    : n.toLocaleString("vi-VN", { maximumFractionDigits: 3 });
}

export default function NhapKhoPage() {
  const [tab, setTab] = useState<Tab>("form");
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [conversions, setConversions] = useState<UnitConversion[]>([]);
  const [conversionsLoading, setConversionsLoading] = useState(false);

  const [form, setForm] = useState({
    ingredientId: "",
    quantityImported: "",
    saleUnit: "",             // "" = nhập theo đơn vị cơ sở
    unitCost: "",
    purchaseNote: "",
    note: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Lịch sử nhập
  const [records, setRecords] = useState<ImportRecord[]>([]);
  const [histLoading, setHistLoading] = useState(false);
  const [histPage, setHistPage] = useState(0);
  const [histTotalPages, setHistTotalPages] = useState(0);
  const [filterIngredient, setFilterIngredient] = useState("");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("");
  const [navOffset, setNavOffset] = useState(0);
  const [deleteLoading, setDeleteLoading] = useState<number | null>(null);

  // Load danh sách nguyên liệu
  useEffect(() => {
    fetch(`${BASE}/inventory/ingredients?page=0&size=200`, { headers: getAuthHeaders() })
      .then(r => r.json())
      .then(json => { if (json.statusCode === 200) setIngredients(json.data?.content ?? json.data ?? []); })
      .catch(() => {});
  }, []);

  // Khi chọn nguyên liệu → fetch danh sách quy đổi đơn vị đã cấu hình
  async function onIngredientChange(ingredientId: string) {
    setForm(p => ({ ...p, ingredientId, saleUnit: "" }));
    setConversions([]);
    if (!ingredientId) return;
    setConversionsLoading(true);
    try {
      const res = await fetch(`${BASE}/inventory/conversions/ingredient/${ingredientId}`, { headers: getAuthHeaders() });
      const json = await res.json();
      if (json.statusCode === 200) setConversions(json.data ?? []);
    } finally { setConversionsLoading(false); }
  }

  const loadHistory = useCallback(async () => {
    setHistLoading(true);
    try {
      const params = new URLSearchParams({ page: String(histPage), size: "20" });
      if (filterIngredient) params.set("ingredientId", filterIngredient);
      const range = getDateRange(timeFilter, navOffset);
      if (range.from) params.set("from", range.from);
      if (range.to)   params.set("to",   range.to);
      const res = await fetch(`${BASE}/inventory/imports?${params}`, { headers: getAuthHeaders() });
      const json = await res.json();
      if (json.statusCode === 200) {
        setRecords(json.data?.content ?? []);
        setHistTotalPages(json.data?.totalPages ?? 0);
      }
    } finally { setHistLoading(false); }
  }, [histPage, filterIngredient, timeFilter, navOffset]);

  useEffect(() => { if (tab === "history") loadHistory(); }, [tab, loadHistory]);

  async function handleDeleteImport(id: number, name: string) {
    if (!confirm(`Xóa phiếu nhập "${name}"? Tồn kho sẽ được hoàn về tương ứng.`)) return;
    setDeleteLoading(id);
    try {
      const res = await fetch(`${BASE}/inventory/imports/${id}`, {
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

  // Derived
  const selectedIngredient = ingredients.find(i => i.id === Number(form.ingredientId));
  const selectedConversion = conversions.find(c => c.saleUnit === form.saleUnit);

  // Preview quy đổi
  const qty = Number(form.quantityImported) || 0;
  const cost = Number(form.unitCost) || 0;
  const factor = selectedConversion?.baseQtyPerSaleUnit ?? 1;
  const baseQty = qty * factor;
  const costPerBase = cost > 0 && factor > 0 ? cost / factor : 0;
  const totalCost = qty * cost;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setSuccess("");
    if (!form.ingredientId) return setError("Vui lòng chọn nguyên liệu");
    if (qty <= 0) return setError("Số lượng phải lớn hơn 0");
    if (cost <= 0) return setError("Đơn giá phải lớn hơn 0");
    if (form.saleUnit && !selectedConversion) return setError("Đơn vị này chưa có quy đổi, hãy tạo quy đổi trước");

    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        ingredientId: Number(form.ingredientId),
        quantityImported: qty,
        unitCost: cost,
      };
      if (form.saleUnit) body.saleUnit = form.saleUnit;
      if (form.purchaseNote.trim()) body.purchaseNote = form.purchaseNote.trim();
      if (form.note.trim()) body.note = form.note.trim();

      const res = await fetch(`${BASE}/inventory/imports`, {
        method: "POST", headers: getAuthHeaders(), body: JSON.stringify(body),
      });
      const json = await res.json();
      if (res.ok && json.statusCode === 200) {
        const d = json.data as ImportRecord;
        const convInfo = d.saleUnit && d.saleQtyImported
          ? ` (${d.saleQtyImported} ${SALE_UNIT_LABEL[d.saleUnit] ?? d.saleUnit} → ${d.quantityImported} ${d.ingredientBaseUnit})`
          : "";
        setSuccess(`Nhập thành công! +${d.quantityImported} ${d.ingredientBaseUnit} ${d.ingredientName}${convInfo}. Tổng: ${fmt(d.totalCost)}`);
        setForm({ ingredientId: "", quantityImported: "", saleUnit: "", unitCost: "", purchaseNote: "", note: "" });
        setConversions([]);
        fetch(`${BASE}/inventory/ingredients?page=0&size=200`, { headers: getAuthHeaders() })
          .then(r => r.json()).then(j => { if (j.statusCode === 200) setIngredients(j.data?.content ?? []); });
      } else {
        setError(extractApiError(json, "Nhập kho thất bại"));
      }
    } catch { setError("Không kết nối được máy chủ"); }
    finally { setLoading(false); }
  }

  const unitLabel = form.saleUnit
    ? (SALE_UNIT_LABEL[form.saleUnit] ?? form.saleUnit)
    : selectedIngredient?.baseUnit ?? "đơn vị";

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/kho" className="text-muted-soft hover:text-gray-600 text-sm">← Kho</Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-lg font-bold text-ink">Nhập kho nguyên liệu</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-hairline">
        {([["form", "Nhập kho"], ["history", "Lịch sử nhập"]] as [Tab, string][]).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key as Tab)}
            className={`px-5 py-2.5 text-sm font-medium transition-colors ${tab === key
              ? "border-b-2 border-primary text-primary"
              : "text-muted hover:text-ink"}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab: Nhập kho ── */}
      {tab === "form" && (
        <div className="max-w-2xl">
          <div className="bg-canvas rounded-xl border border-hairline p-6">
            <form onSubmit={handleSubmit} className="space-y-5">

              {/* 1. Chọn nguyên liệu */}
              <div>
                <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">
                  Nguyên liệu *
                </label>
                <select value={form.ingredientId} onChange={e => onIngredientChange(e.target.value)}
                  className="w-full border border-hairline px-3 py-2 text-sm outline-none focus:border-primary rounded bg-white">
                  <option value="">-- Chọn nguyên liệu --</option>
                  {ingredients.map(i => (
                    <option key={i.id} value={i.id}>
                      {i.name} — tồn: {i.currentQty} {i.baseUnit}
                    </option>
                  ))}
                </select>
                {selectedIngredient && (
                  <div className="mt-1.5 flex gap-4 text-xs text-muted-soft">
                    <span>Đơn vị cơ sở: <strong className="text-gray-600">{selectedIngredient.baseUnit}</strong></span>
                    <span>Giá vốn TB: <strong className="text-gray-600">{fmt(selectedIngredient.averageCost)}/{selectedIngredient.baseUnit}</strong></span>
                    <span>Tồn kho: <strong className="text-gray-600">{selectedIngredient.currentQty} {selectedIngredient.baseUnit}</strong></span>
                  </div>
                )}
              </div>

              {/* 2. Đơn vị mua */}
              {form.ingredientId && (
                <div>
                  <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">
                    Đơn vị mua hàng
                  </label>

                  {conversionsLoading ? (
                    <div className="text-xs text-muted-soft py-2">Đang tải quy đổi...</div>
                  ) : (
                    <>
                      {/* Nút chọn đơn vị */}
                      <div className="flex flex-wrap gap-2">
                        {/* Luôn có "Theo đơn vị cơ sở" */}
                        <button type="button"
                          onClick={() => setForm(p => ({ ...p, saleUnit: "" }))}
                          className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                            form.saleUnit === ""
                              ? "bg-primary text-white border-primary"
                              : "bg-canvas text-gray-600 border-hairline hover:border-primary hover:text-primary"
                          }`}>
                          {selectedIngredient?.baseUnit ?? "Đơn vị cơ sở"}
                          <span className="text-xs ml-1 opacity-70">(cơ sở)</span>
                        </button>

                        {/* Các đơn vị đã có quy đổi */}
                        {conversions.map(c => (
                          <button key={c.saleUnit} type="button"
                            onClick={() => setForm(p => ({ ...p, saleUnit: c.saleUnit }))}
                            className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                              form.saleUnit === c.saleUnit
                                ? "bg-blue-500 text-white border-blue-500"
                                : "bg-canvas text-gray-600 border-hairline hover:border-blue-400 hover:text-blue-500"
                            }`}>
                            {SALE_UNIT_LABEL[c.saleUnit] ?? c.saleUnit}
                            <span className="text-xs ml-1 opacity-70">
                              = {c.baseQtyPerSaleUnit} {selectedIngredient?.baseUnit}
                            </span>
                          </button>
                        ))}
                      </div>

                      {conversions.length === 0 && (
                        <p className="text-xs text-amber-600 mt-1.5 bg-amber-50 px-3 py-1.5 rounded">
                          Nguyên liệu này chưa có quy đổi đơn vị — chỉ nhập được theo đơn vị cơ sở ({selectedIngredient?.baseUnit}).
                          <Link href="/admin/kho/quy-doi" className="underline ml-1">Cấu hình quy đổi →</Link>
                        </p>
                      )}

                      {selectedConversion?.note && (
                        <p className="text-xs text-muted-soft mt-1">Ghi chú: {selectedConversion.note}</p>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* 3. Số lượng + Đơn giá */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">
                    Số lượng nhập *
                    <span className="ml-1 font-normal text-muted-soft">({unitLabel})</span>
                  </label>
                  <input type="number" step="0.001" min="0.001"
                    value={form.quantityImported}
                    onChange={e => setForm(p => ({ ...p, quantityImported: e.target.value }))}
                    placeholder={form.saleUnit ? "VD: 2" : "VD: 24"}
                    className="w-full border border-hairline px-3 py-2 text-sm outline-none focus:border-primary rounded" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">
                    Đơn giá *
                    <span className="ml-1 font-normal text-muted-soft">(VNĐ/{unitLabel})</span>
                  </label>
                  <input type="number" min="1"
                    value={form.unitCost}
                    onChange={e => setForm(p => ({ ...p, unitCost: e.target.value }))}
                    placeholder="VD: 180000"
                    className="w-full border border-hairline px-3 py-2 text-sm outline-none focus:border-primary rounded" />
                </div>
              </div>

              {/* 4. Preview quy đổi */}
              {qty > 0 && cost > 0 && form.ingredientId && (
                <div className={`rounded-xl px-4 py-3.5 border ${
                  selectedConversion ? "bg-blue-50 border-blue-200" : "bg-surface-soft border-hairline"
                }`}>
                  {selectedConversion ? (
                    <>
                      <div className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-2">
                        Quy đổi & Preview
                      </div>
                      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                        <div>
                          <span className="text-muted text-xs">Số lượng mua:</span>
                          <span className="ml-2 font-bold text-ink">
                            {qty} {SALE_UNIT_LABEL[form.saleUnit] ?? form.saleUnit}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted text-xs">Quy đổi:</span>
                          <span className="ml-2 font-bold text-blue-700">
                            × {factor} → {fmtQty(baseQty)} {selectedIngredient?.baseUnit}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted text-xs">Đơn giá nhập:</span>
                          <span className="ml-2 font-medium text-ink">{fmt(cost)}/{SALE_UNIT_LABEL[form.saleUnit] ?? form.saleUnit}</span>
                        </div>
                        <div>
                          <span className="text-muted text-xs">Giá theo đ.vị cơ sở:</span>
                          <span className="ml-2 font-medium text-ink">{fmt(costPerBase)}/{selectedIngredient?.baseUnit}</span>
                        </div>
                      </div>
                      <div className="mt-2 pt-2 border-t border-blue-200 flex justify-between items-center">
                        <span className="text-xs text-blue-600">Tổng chi phí nhập</span>
                        <span className="text-base font-bold text-blue-700">{fmt(totalCost)}</span>
                      </div>
                      <div className="mt-1 text-xs text-blue-500">
                        Tồn kho sau nhập: {fmtQty((selectedIngredient?.currentQty ?? 0) + baseQty)} {selectedIngredient?.baseUnit}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Preview</div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">+{fmtQty(qty)} {selectedIngredient?.baseUnit} vào kho</span>
                        <span className="font-bold text-ink">{fmt(totalCost)}</span>
                      </div>
                      <div className="text-xs text-muted-soft mt-0.5">
                        Tồn kho sau nhập: {fmtQty((selectedIngredient?.currentQty ?? 0) + qty)} {selectedIngredient?.baseUnit}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* 5. Ghi chú */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">Hoá đơn / Nhà cung cấp</label>
                  <input value={form.purchaseNote}
                    onChange={e => setForm(p => ({ ...p, purchaseNote: e.target.value }))}
                    placeholder="VD: HD-001, Nhà cung cấp ABC"
                    className="w-full border border-hairline px-3 py-2 text-sm outline-none focus:border-primary rounded" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">Ghi chú nội bộ</label>
                  <input value={form.note}
                    onChange={e => setForm(p => ({ ...p, note: e.target.value }))}
                    placeholder="VD: Nhập bổ sung trước sự kiện"
                    className="w-full border border-hairline px-3 py-2 text-sm outline-none focus:border-primary rounded" />
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-2.5 rounded-lg">{error}</div>
              )}
              {success && (
                <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-2.5 rounded-lg">{success}</div>
              )}

              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={loading}
                  className="px-6 py-2.5 bg-blue-500 text-white text-sm font-bold rounded-lg hover:bg-blue-600 disabled:opacity-60 transition-colors">
                  {loading ? "Đang nhập..." : "Xác nhận nhập kho"}
                </button>
                <Link href="/admin/kho"
                  className="px-6 py-2.5 bg-canvas text-gray-600 text-sm font-semibold rounded-lg hover:bg-surface-card">
                  Hủy
                </Link>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Tab: Lịch sử nhập kho ── */}
      {tab === "history" && (
        <div>
          <div className="mb-4 space-y-2">
            <div className="flex gap-3 flex-wrap items-center">
              <select value={filterIngredient}
                onChange={e => { setFilterIngredient(e.target.value); setHistPage(0); }}
                className="border border-hairline px-3 py-1.5 text-sm outline-none focus:border-primary rounded bg-white">
                <option value="">Tất cả nguyên liệu</option>
                {ingredients.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
              <button onClick={() => { setFilterIngredient(""); setTimeFilter(""); setNavOffset(0); setHistPage(0); }}
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

          <div className="bg-canvas rounded-xl border border-hairline overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-soft border-b border-hairline text-xs text-muted uppercase">
                    <th className="text-left px-4 py-3">Nguyên liệu</th>
                    <th className="text-center px-4 py-3">Số lượng mua</th>
                    <th className="text-center px-4 py-3 whitespace-nowrap">Quy đổi (cơ sở)</th>
                    <th className="text-right px-4 py-3">Đơn giá</th>
                    <th className="text-right px-4 py-3">Tổng tiền</th>
                    <th className="text-left px-4 py-3">Hoá đơn / NCC</th>
                    <th className="text-left px-4 py-3">Người nhập</th>
                    <th className="text-left px-4 py-3">Thời gian</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {histLoading ? (
                    <tr><td colSpan={8} className="text-center py-8 text-muted-soft">Đang tải...</td></tr>
                  ) : records.length === 0 ? (
                    <tr><td colSpan={8} className="text-center py-8 text-muted-soft">Không có bản ghi nào</td></tr>
                  ) : records.map((r) => {
                    const hasConversion = r.saleUnit && r.saleQtyImported;
                    return (
                      <tr key={r.id} className="hover:bg-surface-soft">
                        <td className="px-4 py-2.5">
                          <div className="font-medium text-ink">{r.ingredientName}</div>
                          <div className="text-xs text-muted-soft">
                            Tồn sau: <strong>{r.ingredientCurrentQty} {r.ingredientBaseUnit}</strong>
                            {" · "}Giá vốn: {fmt(r.ingredientAverageCost)}/{r.ingredientBaseUnit}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {hasConversion ? (
                            <span className="font-semibold text-blue-700">
                              {r.saleQtyImported} {SALE_UNIT_LABEL[r.saleUnit!] ?? r.saleUnit}
                            </span>
                          ) : (
                            <span className="font-semibold text-green-700">
                              {r.quantityImported} {r.ingredientBaseUnit}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {hasConversion ? (
                            <span className="text-xs text-muted">
                              → <strong className="text-green-700">+{r.quantityImported} {r.ingredientBaseUnit}</strong>
                            </span>
                          ) : <span className="text-xs text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-right text-gray-600">
                          {fmt(r.unitCost)}
                          {hasConversion && (
                            <div className="text-xs text-muted-soft">/{SALE_UNIT_LABEL[r.saleUnit!] ?? r.saleUnit}</div>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold text-ink">{fmt(r.totalCost)}</td>
                        <td className="px-4 py-2.5 text-xs text-muted max-w-[140px] truncate">{r.purchaseNote ?? "—"}</td>
                        <td className="px-4 py-2.5 text-gray-600">{r.importedBy}</td>
                        <td className="px-4 py-2.5 text-xs text-muted-soft whitespace-nowrap">{formatDate(r.createdAt)}</td>
                        <td className="px-4 py-2.5 text-center">
                          <button
                            onClick={() => handleDeleteImport(r.id, r.ingredientName)}
                            disabled={deleteLoading === r.id}
                            className="px-2 py-1 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 rounded border border-red-200 disabled:opacity-40"
                          >
                            {deleteLoading === r.id ? "..." : "Xóa"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
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
