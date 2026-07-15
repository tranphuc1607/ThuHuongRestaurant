"use client";
import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getAuthHeaders } from "@/lib/auth";
import { formatPrice } from "@/lib/utils";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api/v1";
const SCROLL_KEY = "admin-don-hang-scroll";

const ORDER_STATUS: Record<string, { label: string; color: string }> = {
  OPEN:      { label: "Đang mở", color: "bg-orange-100 text-orange-700" },
  PAID:      { label: "Đã TT",   color: "bg-green-100 text-green-700" },
  CANCELLED: { label: "Đã hủy",  color: "bg-red-100 text-red-600" },
};

type TimeFilter = "" | "today" | "week" | "month" | "custom";

interface Order {
  id: number; tableId: number; tableName?: string; status: string;
  totalAmount: number; prepaidAmount?: number; createdAt: string; createdBy?: string;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

// Lấy ngày hiện tại theo múi giờ VN, format YYYY-MM-DD
function vnToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
}

// Đổi ngày VN (YYYY-MM-DD) sang UTC Instant bắt đầu ngày đó ở VN
function vnDayStart(vnDate: string): Date {
  return new Date(vnDate + "T00:00:00+07:00");
}

// Tính khoảng thời gian theo múi giờ VN (offset: 0=hiện tại, -1=trước 1 kỳ, ...)
function getDateRange(filter: TimeFilter, offset: number, customFrom?: string, customTo?: string): { from?: string; to?: string } {
  if (!filter || (filter === "custom" && !customFrom)) return {};
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
  if (filter === "custom" && customFrom) {
    const start = vnDayStart(customFrom);
    return { from: start.toISOString(), to: new Date(vnDayStart(customTo || customFrom).getTime() + 86400000).toISOString() };
  }
  return {};
}

function getNavLabel(filter: TimeFilter, offset: number): string {
  if (!filter || filter === "custom") return "";
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

const STATUS_FILTERS = [
  { value: "", label: "Tất cả" },
  { value: "OPEN",      label: "Đang mở" },
  { value: "PAID",      label: "Đã TT" },
  { value: "CANCELLED", label: "Đã hủy" },
];

const TIME_OPTIONS: { value: TimeFilter; label: string }[] = [
  { value: "today", label: "Hôm nay" },
  { value: "week",  label: "Tuần này" },
  { value: "month", label: "Tháng này" },
  { value: "custom", label: "Tùy chọn" },
];

function AdminOrdersPageInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  const [orders, setOrders]             = useState<Order[]>([]);
  const [loading, setLoading]           = useState(true);
  const [page, setPage]                 = useState(() => Number(searchParams.get("page") ?? "0"));
  const [totalPages, setTotalPages]     = useState(0);
  const [filter, setFilter]             = useState(() => searchParams.get("status") ?? "");
  const [timeFilter, setTimeFilter]     = useState<TimeFilter>("");
  const [navOffset, setNavOffset]       = useState(0);
  const [customFrom, setCustomFrom]     = useState("");
  const [customTo, setCustomTo]         = useState("");
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [toast, setToast]               = useState("");
  const scrollRestored                  = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ page: String(page), size: "20" });
      if (filter) p.set("status", filter);
      const range = getDateRange(timeFilter, navOffset, customFrom, customTo);
      if (range.from) p.set("from", range.from);
      if (range.to)   p.set("to",   range.to);
      const res  = await fetch(`${BASE}/orders?${p}`, { headers: getAuthHeaders() });
      const json = await res.json();
      if (json.statusCode === 200) {
        setOrders(json.data.content ?? []);
        setTotalPages(json.data.totalPages ?? 0);
      }
    } finally { setLoading(false); }
  }, [page, filter, timeFilter, navOffset, customFrom, customTo]);

  useEffect(() => { load(); }, [load]);

  // Sync filter + page vào URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (filter) params.set("status", filter);
    if (page > 0) params.set("page", String(page));
    const qs = params.toString();
    router.replace(`/admin/don-hang${qs ? "?" + qs : ""}`, { scroll: false });
  }, [filter, page, router]);

  // Restore scroll
  useEffect(() => {
    if (!loading && !scrollRestored.current) {
      scrollRestored.current = true;
      const saved = sessionStorage.getItem(SCROLL_KEY);
      if (saved) {
        sessionStorage.removeItem(SCROLL_KEY);
        setTimeout(() => window.scrollTo({ top: Number(saved), behavior: "instant" }), 80);
      }
    }
  }, [loading]);

  function saveScroll() { sessionStorage.setItem(SCROLL_KEY, String(window.scrollY)); }
  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(""), 3000); }

  const hasActiveFilter = !!(filter || timeFilter);

  function clearAllFilters() {
    setPage(0);
    setFilter("");
    setTimeFilter("");
    setNavOffset(0);
    setCustomFrom("");
    setCustomTo("");
  }

  async function cancelOrder(id: number) {
    if (!confirm("Hủy đơn hàng này?")) return;
    setActionLoading(id);
    try {
      const res  = await fetch(`${BASE}/orders/${id}/cancel`, { method: "POST", headers: getAuthHeaders() });
      const json = await res.json();
      if (json.statusCode === 200) { showToast("Đã hủy đơn hàng"); load(); }
      else showToast(json.message ?? "Thất bại");
    } finally { setActionLoading(null); }
  }

  return (
    <div className="p-3 md:p-6">
      {toast && (
        <div className="fixed top-16 md:top-4 right-3 bg-gray-900 text-white text-xs px-3 py-2 rounded-lg shadow-lg z-50 max-w-[calc(100vw-1.5rem)]">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-base font-bold text-ink">Đơn hàng</h1>
        <button onClick={load} className="text-xs text-primary border border-primary px-2.5 py-1 rounded-lg hover:bg-primary/5 touch-manipulation">
          ↻ Làm mới
        </button>
      </div>

      {/* ── Filters ── */}
      <div className="space-y-2 mb-3">
        {/* Row 1: status filter */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-3 px-3 md:mx-0 md:px-0 scrollbar-hide">
          {STATUS_FILTERS.map(({ value, label }) => (
            <button key={value} onClick={() => { setPage(0); setFilter(value); }}
              className={`px-2.5 py-1 text-xs font-semibold rounded-full border flex-shrink-0 transition-colors touch-manipulation ${
                filter === value ? "bg-primary text-white border-primary" : "bg-white text-gray-600 border-gray-200"
              }`}>
              {label}
            </button>
          ))}

          {hasActiveFilter && (
            <button onClick={clearAllFilters}
              className="px-2.5 py-1 text-xs text-primary underline flex-shrink-0 touch-manipulation">
              Xóa lọc
            </button>
          )}
        </div>

        {/* Row 2: time filter */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-3 px-3 md:mx-0 md:px-0 scrollbar-hide items-center">
          <span className="text-xs text-gray-400 font-medium flex-shrink-0">Thời gian:</span>
          {TIME_OPTIONS.map(({ value, label }) => (
            <button key={value}
              onClick={() => { setPage(0); setNavOffset(0); setTimeFilter(timeFilter === value ? "" : value); }}
              className={`px-2.5 py-1 text-xs font-semibold rounded-full border flex-shrink-0 transition-colors touch-manipulation ${
                timeFilter === value
                  ? "bg-blue-500 text-white border-blue-500"
                  : "bg-white text-gray-600 border-gray-200"
              }`}>
              {label}
            </button>
          ))}
        </div>

        {/* Navigation lùi / tiến kỳ */}
        {timeFilter && timeFilter !== "custom" && (
          <div className="flex items-center justify-center gap-1.5">
            <button
              onClick={() => { setNavOffset(o => o - 1); setPage(0); }}
              className="w-9 h-9 flex items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 text-2xl leading-none touch-manipulation">
              ‹
            </button>
            <span className="text-xs font-medium text-gray-700 text-center min-w-[150px]">
              {getNavLabel(timeFilter, navOffset)}
            </span>
            <button
              onClick={() => { setNavOffset(o => Math.min(0, o + 1)); setPage(0); }}
              disabled={navOffset >= 0}
              className="w-9 h-9 flex items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-30 text-2xl leading-none touch-manipulation">
              ›
            </button>
            {navOffset < 0 && (
              <button
                onClick={() => { setNavOffset(0); setPage(0); }}
                className="text-[11px] text-blue-500 border border-blue-300 px-2 py-0.5 rounded-full hover:bg-blue-50 touch-manipulation flex-shrink-0">
                Về {timeFilter === "today" ? "hôm nay" : timeFilter === "week" ? "tuần này" : "tháng này"}
              </button>
            )}
          </div>
        )}

        {/* Custom date picker */}
        {timeFilter === "custom" && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-400">Từ</span>
            <input type="date" value={customFrom}
              onChange={e => { setCustomFrom(e.target.value); setPage(0); }}
              className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 focus:outline-none focus:border-primary"
            />
            <span className="text-xs text-gray-400">đến</span>
            <input type="date" value={customTo} min={customFrom}
              onChange={e => { setCustomTo(e.target.value); setPage(0); }}
              className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 focus:outline-none focus:border-primary"
            />
          </div>
        )}
      </div>

      {loading && (
        <div className="flex justify-center py-10">
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"/>
        </div>
      )}
      {!loading && orders.length === 0 && (
        <div className="text-center py-10 text-sm text-gray-400">Không có đơn hàng nào</div>
      )}

      {!loading && orders.length > 0 && (
        <>
          {/* ── Mobile compact cards ── */}
          <div className="md:hidden space-y-2">
            {orders.map((o) => {
              const prepaid = o.prepaidAmount ?? 0;
              const refund  = Math.round(prepaid - o.totalAmount);
              const needsRefund = refund > 0 && o.status === "OPEN";
              const stCfg = ORDER_STATUS[o.status];
              const busy  = actionLoading === o.id;

              return (
                <div key={o.id} className={[
                  "bg-white rounded-xl border px-3 py-2.5",
                  needsRefund ? "border-amber-300 bg-amber-50/30" : "border-gray-100",
                ].join(" ")}>

                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      {needsRefund && <span className="text-[9px] bg-amber-500 text-white px-1 py-0.5 rounded-full font-bold">💰</span>}
                      <Link href={`/admin/don-hang/${o.id}`} onClick={saveScroll}
                        className="text-primary font-bold text-sm">#{o.id}</Link>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                      needsRefund ? "bg-amber-100 text-amber-700" : (stCfg?.color ?? "bg-gray-100 text-gray-500")
                    }`}>
                      {needsRefund ? "Cần hoàn" : (stCfg?.label ?? o.status)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-x-3 mb-1.5 text-xs">
                    <span className="font-semibold text-gray-800 truncate">{o.tableName ?? `Bàn ${o.tableId}`}</span>
                    <span className="text-right font-bold text-gray-900">{formatPrice(o.totalAmount)}</span>
                    <span className="text-gray-400 truncate">{fmtTime(o.createdAt)}{o.createdBy ? ` · ${o.createdBy}` : ""}</span>
                    {needsRefund
                      ? <span className="text-right text-amber-600 font-semibold">💰 Hoàn {formatPrice(refund)}</span>
                      : prepaid > 0
                      ? <span className="text-right text-green-600">Cọc {formatPrice(prepaid)}</span>
                      : <span/>}
                  </div>

                  <div className="flex gap-1.5 pt-2 border-t border-gray-100">
                    <Link href={`/admin/don-hang/${o.id}`} onClick={saveScroll}
                      className="flex-1 py-1.5 text-center bg-gray-100 text-gray-600 text-xs font-semibold rounded-lg touch-manipulation">
                      Chi tiết
                    </Link>
                    {o.status === "OPEN" && (
                      <button onClick={() => cancelOrder(o.id)} disabled={busy}
                        className="py-1.5 px-3 bg-red-50 text-red-500 text-xs font-semibold rounded-lg disabled:opacity-50 touch-manipulation">
                        Hủy
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Desktop table ── */}
          <div className="hidden md:block bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 text-xs text-gray-500 uppercase">
                    <th className="text-left px-4 py-3 font-semibold">ID</th>
                    <th className="text-left px-4 py-3 font-semibold">Bàn</th>
                    <th className="text-right px-4 py-3 font-semibold">Tổng tiền</th>
                    <th className="text-left px-4 py-3 font-semibold">Thời gian</th>
                    <th className="text-left px-4 py-3 font-semibold">Tạo bởi</th>
                    <th className="text-center px-4 py-3 font-semibold">Trạng thái</th>
                    <th className="text-center px-4 py-3 font-semibold">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {orders.map((o) => {
                    const prepaid = o.prepaidAmount ?? 0;
                    const refund  = Math.round(prepaid - o.totalAmount);
                    const needsRefund = refund > 0 && o.status === "OPEN";
                    return (
                      <tr key={o.id} className={`hover:bg-gray-50 ${needsRefund ? "bg-amber-50/40" : ""}`}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            {needsRefund && <span className="text-[9px] bg-amber-500 text-white px-1.5 py-0.5 rounded-full font-bold">💰</span>}
                            <Link href={`/admin/don-hang/${o.id}`} onClick={saveScroll}
                              className="text-primary font-semibold hover:underline">#{o.id}</Link>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-800">{o.tableName ?? `Bàn ${o.tableId}`}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="font-semibold">{formatPrice(o.totalAmount)}</div>
                          {needsRefund && <div className="text-xs text-amber-700 font-bold">Hoàn {formatPrice(refund)}</div>}
                          {!needsRefund && prepaid > 0 && <div className="text-xs text-green-600">Cọc {formatPrice(prepaid)}</div>}
                        </td>
                        <td className="px-4 py-3 text-gray-400 whitespace-nowrap text-xs">{fmtTime(o.createdAt)}</td>
                        <td className="px-4 py-3 text-gray-400 text-sm">{o.createdBy ?? "—"}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${needsRefund ? "bg-amber-100 text-amber-700" : (ORDER_STATUS[o.status]?.color ?? "bg-gray-100 text-gray-500")}`}>
                            {needsRefund ? "Cần hoàn" : (ORDER_STATUS[o.status]?.label ?? o.status)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            <Link href={`/admin/don-hang/${o.id}`} onClick={saveScroll}
                              className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded hover:bg-gray-200">Chi tiết</Link>
                            {o.status === "OPEN" && (
                              <button onClick={() => cancelOrder(o.id)} disabled={actionLoading === o.id}
                                className="px-2 py-1 bg-red-50 text-red-500 text-xs rounded hover:bg-red-100 disabled:opacity-50">Hủy</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-3">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                className="px-4 py-1.5 text-sm border border-gray-200 rounded-lg bg-white disabled:opacity-40 touch-manipulation">← Trước</button>
              <span className="text-sm text-gray-500">{page + 1} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                className="px-4 py-1.5 text-sm border border-gray-200 rounded-lg bg-white disabled:opacity-40 touch-manipulation">Tiếp →</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function AdminOrdersPage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center items-center py-20">
        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"/>
      </div>
    }>
      <AdminOrdersPageInner />
    </Suspense>
  );
}
