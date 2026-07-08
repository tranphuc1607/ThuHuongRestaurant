"use client";
import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getAuthHeaders } from "@/lib/auth";
import { formatPrice } from "@/lib/utils";

const SCROLL_KEY = "admin-dat-ban-scroll";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api/v1";

const STATUS_CFG: Record<string, { label: string; color: string }> = {
  PENDING_PAYMENT:      { label: "Chờ thanh toán", color: "bg-yellow-100 text-yellow-700" },
  PENDING_PAYMENT_CASH: { label: "Chờ xác nhận",  color: "bg-orange-100 text-orange-700" },
  CONFIRMED:            { label: "Đã xác nhận",   color: "bg-blue-100 text-blue-700" },
  CHECKED_IN:           { label: "Đã đến",         color: "bg-indigo-100 text-indigo-700" },
  COMPLETED:            { label: "Hoàn thành",     color: "bg-green-100 text-green-700" },
  CANCELLED:            { label: "Đã hủy",         color: "bg-red-100 text-red-600" },
  EXPIRED:              { label: "Hết hạn",        color: "bg-gray-100 text-gray-500" },
};

const METHOD_LABELS: Record<string, string> = {
  BANK_TRANSFER: "Chuyển khoản",
  CASH: "Tiền mặt",
};

interface Booking {
  id: number; bookingCode: string; customerName: string; customerPhone: string;
  scheduledTime: string; guestCount: number; status: string; paymentMethod: string;
  totalAmount: number; paidAmount?: number; note?: string; createdAt?: string;
}

function stKey(status: string, method: string) {
  return status === "PENDING_PAYMENT" && method === "CASH" ? "PENDING_PAYMENT_CASH" : status;
}
function isNew(createdAt?: string) {
  return !!createdAt && Date.now() - new Date(createdAt).getTime() < 3_600_000;
}
function fmtShort(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}
function fmtFull(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const FILTERS = [
  { value: "", label: "Tất cả" },
  { value: "PENDING_PAYMENT", label: "Chờ TT" },
  { value: "CONFIRMED",       label: "Xác nhận" },
  { value: "CHECKED_IN",      label: "Đã đến" },
  { value: "COMPLETED",       label: "Hoàn thành" },
  { value: "CANCELLED",       label: "Đã hủy" },
];

function AdminBookingsPageInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  const [bookings, setBookings]       = useState<Booking[]>([]);
  const [loading, setLoading]         = useState(true);
  const [page, setPage]               = useState(() => Number(searchParams.get("page") ?? "0"));
  const [totalPages, setTotalPages]   = useState(0);
  const [filter, setFilter]           = useState(() => searchParams.get("status") ?? "");
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [toast, setToast]             = useState("");
  const scrollRestored                = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ page: String(page), size: "20" });
      if (filter) p.set("status", filter);
      const res  = await fetch(`${BASE}/bookings?${p}`, { headers: getAuthHeaders() });
      const json = await res.json();
      if (json.statusCode === 200) {
        setBookings(json.data.content ?? []);
        setTotalPages(json.data.totalPages ?? 0);
      }
    } finally { setLoading(false); }
  }, [page, filter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { const id = setInterval(load, 30_000); return () => clearInterval(id); }, [load]);

  // Sync filter + page vào URL để browser back tự restore
  useEffect(() => {
    const params = new URLSearchParams();
    if (filter) params.set("status", filter);
    if (page > 0) params.set("page", String(page));
    const qs = params.toString();
    router.replace(`/admin/dat-ban${qs ? "?" + qs : ""}`, { scroll: false });
  }, [filter, page, router]);

  // Restore scroll sau khi load xong lần đầu
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

  async function doAction(id: number, endpoint: string, msg: string) {
    setActionLoading(id);
    try {
      const res  = await fetch(`${BASE}/bookings/${id}/${endpoint}`, { method: "PATCH", headers: getAuthHeaders() });
      const json = await res.json();
      if (res.ok && json.statusCode === 200) { showToast(msg); load(); }
      else showToast(json.message ?? "Thao tác thất bại");
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
        <h1 className="text-base font-bold text-ink">Đặt bàn</h1>
        <button onClick={load} className="text-xs text-primary border border-primary px-2.5 py-1 rounded-lg hover:bg-primary/5 touch-manipulation">
          ↻ Làm mới
        </button>
      </div>

      {/* Filters — scroll on mobile */}
      <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1 -mx-3 px-3 md:mx-0 md:px-0 md:flex-wrap scrollbar-hide">
        {FILTERS.map(({ value, label }) => (
          <button key={value} onClick={() => { setPage(0); setFilter(value); }}
            className={`px-2.5 py-1 text-xs font-semibold rounded-full border flex-shrink-0 transition-colors touch-manipulation ${
              filter === value ? "bg-primary text-white border-primary" : "bg-white text-gray-600 border-gray-200"
            }`}>
            {label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex justify-center py-10">
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"/>
        </div>
      )}
      {!loading && bookings.length === 0 && (
        <div className="text-center py-10 text-sm text-gray-400">Không có booking nào</div>
      )}

      {!loading && bookings.length > 0 && (
        <>
          {/* ── Mobile compact cards ── */}
          <div className="md:hidden space-y-2">
            {bookings.map((b) => {
              const key   = stKey(b.status, b.paymentMethod);
              const cfg   = STATUS_CFG[key] ?? STATUS_CFG[b.status];
              const badge = isNew(b.createdAt);
              const paid  = b.paidAmount ?? 0;
              const refund = Math.round(paid - b.totalAmount);
              const needsRefund = b.status === "CONFIRMED" && b.paymentMethod === "BANK_TRANSFER" && refund > 0;
              const busy  = actionLoading === b.id;
              const canConfirmBank = b.status === "PENDING_PAYMENT" && b.paymentMethod === "BANK_TRANSFER";
              const canConfirmCash = b.status === "PENDING_PAYMENT" && b.paymentMethod === "CASH";
              const canComplete    = b.status === "CONFIRMED";
              const canCancel      = b.status === "PENDING_PAYMENT" || b.status === "CONFIRMED";

              return (
                <div key={b.id} className={[
                  "bg-white rounded-xl border px-3 py-2.5",
                  needsRefund ? "border-amber-300 bg-amber-50/30"
                    : badge    ? "border-orange-200 bg-orange-50/20"
                    : "border-gray-100",
                ].join(" ")}>

                  {/* Row 1: code + badges | status */}
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1 min-w-0">
                      {badge && <span className="text-[9px] bg-red-500 text-white px-1 py-0.5 rounded-full font-bold flex-shrink-0">MỚI</span>}
                      {needsRefund && <span className="text-[9px] bg-amber-500 text-white px-1 py-0.5 rounded-full font-bold flex-shrink-0">💰</span>}
                      <Link href={`/admin/dat-ban/${b.bookingCode}`} onClick={saveScroll}
                        className="font-mono text-sm font-bold text-primary truncate">
                        {b.bookingCode}
                      </Link>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ml-2 ${
                      needsRefund ? "bg-amber-100 text-amber-700" : (cfg?.color ?? "bg-gray-100 text-gray-500")
                    }`}>
                      {needsRefund ? "Cần hoàn" : cfg?.label}
                    </span>
                  </div>

                  {/* 2-col info grid */}
                  <div className="grid grid-cols-2 gap-x-3 mb-2 text-xs">
                    <span className="font-semibold text-gray-800 truncate">{b.customerName}</span>
                    <span className="text-right text-gray-500">{fmtShort(b.scheduledTime)}</span>
                    <span className="text-gray-400 truncate">{b.customerPhone} · {b.guestCount}k</span>
                    <span className="text-right font-bold text-gray-900">{formatPrice(b.totalAmount)}</span>
                  </div>

                  {/* Payment info */}
                  <div className="text-[10px] text-gray-400 mb-2 flex items-center gap-1.5">
                    <span>{METHOD_LABELS[b.paymentMethod]}</span>
                    {needsRefund && <span className="text-amber-600 font-semibold">· Hoàn {formatPrice(refund)}</span>}
                    {!needsRefund && paid > 0 && <span className="text-green-600">· Cọc {formatPrice(paid)}</span>}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1.5 pt-2 border-t border-gray-100">
                    {canConfirmBank && (
                      <button onClick={() => doAction(b.id, "confirm", "Đã xác nhận")}
                        disabled={busy} className="flex-1 py-1.5 bg-blue-500 text-white text-xs font-semibold rounded-lg disabled:opacity-50 touch-manipulation">
                        Xác nhận
                      </button>
                    )}
                    {canConfirmCash && (
                      <button onClick={() => doAction(b.id, "confirm-cash", "Đã xác nhận cash")}
                        disabled={busy} className="flex-1 py-1.5 bg-green-500 text-white text-xs font-semibold rounded-lg disabled:opacity-50 touch-manipulation">
                        Xác nhận cash
                      </button>
                    )}
                    {canComplete && (
                      <button onClick={() => doAction(b.id, "complete", "Hoàn thành")}
                        disabled={busy} className="flex-1 py-1.5 bg-indigo-500 text-white text-xs font-semibold rounded-lg disabled:opacity-50 touch-manipulation">
                        Hoàn thành
                      </button>
                    )}
                    {canCancel && (
                      <button
                        onClick={() => { if (confirm(`Hủy ${b.bookingCode}?`)) doAction(b.id, "cancel", "Đã hủy"); }}
                        disabled={busy}
                        className="py-1.5 px-3 bg-red-50 text-red-500 text-xs font-semibold rounded-lg disabled:opacity-50 touch-manipulation">
                        Hủy
                      </button>
                    )}
                    <Link href={`/admin/dat-ban/${b.bookingCode}`} onClick={saveScroll}
                      className="py-1.5 px-3 bg-gray-100 text-gray-600 text-xs font-semibold rounded-lg touch-manipulation">
                      ↗
                    </Link>
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
                    <th className="text-left px-4 py-3 font-semibold">Mã</th>
                    <th className="text-left px-4 py-3 font-semibold">Khách hàng</th>
                    <th className="text-left px-4 py-3 font-semibold">Đặt lúc</th>
                    <th className="text-left px-4 py-3 font-semibold">Đến lúc</th>
                    <th className="text-center px-4 py-3 font-semibold">Khách</th>
                    <th className="text-left px-4 py-3 font-semibold">Thanh toán</th>
                    <th className="text-center px-4 py-3 font-semibold">Trạng thái</th>
                    <th className="text-center px-4 py-3 font-semibold">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {bookings.map((b) => {
                    const key  = stKey(b.status, b.paymentMethod);
                    const cfg  = STATUS_CFG[key] ?? STATUS_CFG[b.status];
                    const badge = isNew(b.createdAt);
                    const paid = b.paidAmount ?? 0;
                    const refund = Math.round(paid - b.totalAmount);
                    const needsRefund = b.status === "CONFIRMED" && b.paymentMethod === "BANK_TRANSFER" && refund > 0;
                    return (
                      <tr key={b.id} className={`hover:bg-gray-50 ${needsRefund ? "bg-amber-50/40" : badge ? "bg-orange-50/30" : ""}`}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {badge && <span className="text-[9px] bg-red-500 text-white px-1.5 py-0.5 rounded-full font-bold">MỚI</span>}
                            {needsRefund && <span className="text-[9px] bg-amber-500 text-white px-1.5 py-0.5 rounded-full font-bold">💰</span>}
                            <Link href={`/admin/dat-ban/${b.bookingCode}`} className="font-mono text-primary text-xs hover:underline">{b.bookingCode}</Link>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{b.customerName}</div>
                          <div className="text-xs text-gray-400">{b.customerPhone}</div>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{b.createdAt ? fmtFull(b.createdAt) : "—"}</td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap text-xs">{fmtFull(b.scheduledTime)}</td>
                        <td className="px-4 py-3 text-center text-gray-600">{b.guestCount}</td>
                        <td className="px-4 py-3">
                          <div className="text-xs text-gray-600">{METHOD_LABELS[b.paymentMethod]}</div>
                          {needsRefund ? <div className="text-xs text-amber-700 font-bold">💰 Hoàn {formatPrice(refund)}</div>
                            : paid > 0 ? <div className="text-xs text-green-600">Cọc {formatPrice(paid)}</div> : null}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${needsRefund ? "bg-amber-100 text-amber-700" : (cfg?.color ?? "bg-gray-100 text-gray-500")}`}>
                            {needsRefund ? "Cần hoàn" : cfg?.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1 flex-wrap">
                            {b.status === "PENDING_PAYMENT" && b.paymentMethod === "BANK_TRANSFER" && (
                              <button onClick={() => doAction(b.id, "confirm", "Đã xác nhận")} disabled={actionLoading === b.id}
                                className="px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 disabled:opacity-50">Xác nhận</button>
                            )}
                            {b.status === "PENDING_PAYMENT" && b.paymentMethod === "CASH" && (
                              <button onClick={() => doAction(b.id, "confirm-cash", "Đã xác nhận cash")} disabled={actionLoading === b.id}
                                className="px-2 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600 disabled:opacity-50">Confirm cash</button>
                            )}
                            {b.status === "CONFIRMED" && (
                              <button onClick={() => doAction(b.id, "complete", "Hoàn thành")} disabled={actionLoading === b.id}
                                className="px-2 py-1 bg-indigo-500 text-white text-xs rounded hover:bg-indigo-600 disabled:opacity-50">Complete</button>
                            )}
                            {(b.status === "PENDING_PAYMENT" || b.status === "CONFIRMED") && (
                              <button onClick={() => { if (confirm(`Hủy ${b.bookingCode}?`)) doAction(b.id, "cancel", "Đã hủy"); }}
                                disabled={actionLoading === b.id}
                                className="px-2 py-1 bg-red-50 text-red-500 text-xs rounded hover:bg-red-100 disabled:opacity-50">Hủy</button>
                            )}
                            <Link href={`/admin/dat-ban/${b.bookingCode}`} onClick={saveScroll} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded hover:bg-gray-200">Chi tiết</Link>
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

export default function AdminBookingsPage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center items-center py-20">
        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"/>
      </div>
    }>
      <AdminBookingsPageInner />
    </Suspense>
  );
}
