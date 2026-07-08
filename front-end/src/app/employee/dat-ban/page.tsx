"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getAuthHeaders } from "@/lib/auth";
import { formatPrice } from "@/lib/utils";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";

const STATUS_META: Record<string, { label: string; color: string; dot: string }> = {
  PENDING_PAYMENT: { label: "Chờ TT",      color: "bg-yellow-100 text-yellow-700", dot: "bg-yellow-400" },
  CONFIRMED:       { label: "Đã xác nhận", color: "bg-blue-100 text-blue-700",    dot: "bg-blue-400" },
  CHECKED_IN:      { label: "Đã đến",       color: "bg-indigo-100 text-indigo-700", dot: "bg-indigo-400" },
  COMPLETED:       { label: "Hoàn thành",  color: "bg-green-100 text-green-700",  dot: "bg-green-400" },
  CANCELLED:       { label: "Đã hủy",      color: "bg-red-100 text-red-500",      dot: "bg-red-400" },
};

const FILTERS = [
  { v: "CONFIRMED",  l: "Đã xác nhận" },
  { v: "CHECKED_IN", l: "Đã đến" },
  { v: "COMPLETED",  l: "Hoàn thành" },
  { v: "",           l: "Tất cả" },
];

interface Booking {
  id: number;
  bookingCode: string;
  customerName: string;
  customerPhone: string;
  tableName?: string;
  scheduledTime: string;
  status: string;
  totalAmount: number;
  paidAmount?: number;
  paymentMethod?: string;
  note?: string;
}

export default function EmployeeBookingsPage() {
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [statusFilter, setStatusFilter] = useState(() =>
    typeof window !== "undefined" ? (sessionStorage.getItem("booking-filter") ?? "CONFIRMED") : "CONFIRMED"
  );
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [toast, setToast] = useState("");

  // Table selection modal
  const [showTableModal, setShowTableModal] = useState(false);
  const [checkoutBookingId, setCheckoutBookingId] = useState<number | null>(null);
  const [tables, setTables] = useState<{ id: number; name: string; tableNumber: number; status: string }[]>([]);
  const [tablesLoading, setTablesLoading] = useState(false);
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null);
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const didRestoreScroll = useRef(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), size: "15" });
      if (statusFilter) params.set("status", statusFilter);
      else params.set("excludePending", "true");
      const res = await fetch(`${BASE}/bookings?${params}`, { headers: getAuthHeaders() });
      const json = await res.json();
      if (json.statusCode === 200) {
        setBookings(json.data.content ?? []);
        setTotalPages(json.data.totalPages ?? 0);
      }
    } finally { if (!silent) setLoading(false); }
  }, [page, statusFilter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const id = setInterval(() => load(true), 10000);
    return () => clearInterval(id);
  }, [load]);

  // Restore scroll position sau reload (chỉ 1 lần sau lần load đầu tiên)
  useEffect(() => {
    if (!loading && !didRestoreScroll.current && scrollRef.current) {
      didRestoreScroll.current = true;
      const saved = sessionStorage.getItem("booking-scroll");
      if (saved) scrollRef.current.scrollTop = parseInt(saved);
    }
  }, [loading]);

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(""), 3000); }

  async function completeBooking(id: number) {
    setActionLoading(id);
    try {
      const res = await fetch(`${BASE}/bookings/${id}/complete`, { method: "PATCH", headers: getAuthHeaders() });
      const json = await res.json();
      if (json.statusCode === 200) { showToast("Đã hoàn thành booking"); load(); }
      else showToast(json.message ?? "Thất bại");
    } finally { setActionLoading(null); }
  }

  async function openTableModal(bookingId: number) {
    setCheckoutBookingId(bookingId);
    setSelectedTableId(null);
    setShowTableModal(true);
    setTablesLoading(true);
    try {
      const res = await fetch(`${BASE}/orders/tables`, { headers: getAuthHeaders() });
      const json = await res.json();
      if (json.statusCode === 200) setTables(json.data ?? []);
    } finally { setTablesLoading(false); }
  }

  async function checkoutToOrder() {
    if (!checkoutBookingId || !selectedTableId) return;
    const t = tables.find(x => x.id === selectedTableId);
    if (t?.status === "OCCUPIED") { showToast("Bàn này đang được mở, vui lòng chọn bàn khác"); return; }
    setActionLoading(checkoutBookingId);
    try {
      const res = await fetch(`${BASE}/bookings/${checkoutBookingId}/checkout-to-order`, {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ tableId: selectedTableId }),
      });
      const json = await res.json();
      if (json.statusCode === 200) {
        setShowTableModal(false);
        const orderId = json.data?.id;
        if (orderId) router.push(`/employee/don-hang/${orderId}?from=ban`);
        else { showToast("Đã chuyển sang đơn hàng"); load(); }
      } else showToast(json.message ?? "Thất bại");
    } finally { setActionLoading(null); }
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleString("vi-VN", {
      day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
    });
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg z-50 whitespace-nowrap">
          {toast}
        </div>
      )}

      {/* Sticky top bar */}
      <div className="sticky top-0 z-10 bg-canvas border-b border-hairline">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <h1 className="text-lg font-bold text-ink leading-tight">Booking</h1>
            <p className="text-xs text-muted">Xem và xử lý đặt bàn của khách</p>
          </div>
          <button onClick={() => load()}
            className="p-2.5 text-muted hover:text-ink rounded-lg touch-manipulation"
            style={{ WebkitTapHighlightColor: "transparent" }}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>

        {/* Filter pills */}
        <div className="flex gap-2 px-4 pb-3 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {FILTERS.map(({ v, l }) => (
            <button key={v}
              onPointerDown={(e) => { if (e.pointerType === "touch") { e.preventDefault(); setPage(0); setStatusFilter(v); sessionStorage.setItem("booking-filter", v); } }}
              onClick={() => { setPage(0); setStatusFilter(v); sessionStorage.setItem("booking-filter", v); }}
              className={`flex-shrink-0 px-4 py-2 text-sm font-semibold rounded-full border transition-colors touch-manipulation ${
                statusFilter === v
                  ? "bg-primary text-white border-primary"
                  : "bg-canvas text-gray-600 border-hairline"
              }`}
              style={{ WebkitTapHighlightColor: "transparent" }}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div ref={scrollRef} className="flex-1 overflow-auto"
        onScroll={() => { if (scrollRef.current) sessionStorage.setItem("booking-scroll", String(scrollRef.current.scrollTop)); }}>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-muted">Đang tải...</p>
          </div>
        ) : bookings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-6">
            <div className="text-5xl mb-3">📅</div>
            <p className="text-base font-medium text-ink mb-1">Không có booking nào</p>
            <p className="text-sm text-muted">Thử chọn bộ lọc khác</p>
          </div>
        ) : (
          <div className="divide-y divide-hairline">
            {bookings.map((b) => {
              const st = STATUS_META[b.status];
              const paid = b.paidAmount ?? 0;
              const refundAmt = Math.round(paid - b.totalAmount);
              const needsRefund = b.status === "CONFIRMED" && b.paymentMethod === "BANK_TRANSFER" && refundAmt > 0;
              return (
                <div key={b.id} className={`px-4 py-4 ${needsRefund ? "bg-amber-50/50" : ""}`}>

                  {/* Top: code + status */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-primary">{b.bookingCode}</span>
                        {needsRefund && (
                          <span className="text-[10px] font-bold bg-amber-500 text-white px-2 py-0.5 rounded-full">
                            💰 CẦN HOÀN
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted mt-0.5">
                        {b.tableName ?? "Chưa có bàn"} · {formatTime(b.scheduledTime)}
                      </div>
                    </div>
                    <span className={`flex-shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${
                      needsRefund ? "bg-amber-100 text-amber-700" : (st?.color ?? "bg-gray-100 text-gray-500")
                    }`}>
                      {needsRefund ? "Hoàn tiền" : (st?.label ?? b.status)}
                    </span>
                  </div>

                  {/* Customer + amount */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <div className="text-sm font-semibold text-ink">{b.customerName}</div>
                      <a href={`tel:${b.customerPhone}`}
                        className="text-sm text-primary underline mt-0.5 inline-block touch-manipulation"
                        onClick={e => e.stopPropagation()}
                        style={{ WebkitTapHighlightColor: "transparent" }}>
                        {b.customerPhone}
                      </a>
                      {b.note && (
                        <div className="text-xs text-muted-soft mt-1 line-clamp-2">📝 {b.note}</div>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-base font-bold text-ink">{formatPrice(b.totalAmount)}</div>
                      {needsRefund ? (
                        <div className="text-xs font-bold text-amber-700 mt-0.5">Hoàn {formatPrice(refundAmt)}</div>
                      ) : paid > 0 ? (
                        <div className="text-xs text-green-600 mt-0.5">Cọc {formatPrice(paid)}</div>
                      ) : null}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Link href={`/employee/dat-ban/${b.bookingCode}`}
                      className="flex items-center justify-center px-3 py-2.5 bg-surface-soft text-ink text-sm font-medium rounded-xl border border-hairline touch-manipulation"
                      style={{ WebkitTapHighlightColor: "transparent" }}>
                      Chi tiết
                    </Link>
                    {b.status === "CONFIRMED" && (
                      <button
                        onPointerDown={(e) => { pointerDownPos.current = { x: e.clientX, y: e.clientY }; }}
                        onClick={(e) => {
                          const s = pointerDownPos.current;
                          if (s && (Math.abs(e.clientX - s.x) > 8 || Math.abs(e.clientY - s.y) > 8)) return;
                          openTableModal(b.id);
                        }}
                        disabled={actionLoading === b.id}
                        className="flex-1 flex items-center justify-center py-2.5 bg-primary text-white text-sm font-semibold rounded-xl disabled:opacity-50 touch-manipulation"
                        style={{ WebkitTapHighlightColor: "transparent" }}>
                        → Mở đơn
                      </button>
                    )}
                    {b.status === "CHECKED_IN" && (
                      <button
                        onPointerDown={(e) => { pointerDownPos.current = { x: e.clientX, y: e.clientY }; }}
                        onClick={(e) => {
                          const s = pointerDownPos.current;
                          if (s && (Math.abs(e.clientX - s.x) > 8 || Math.abs(e.clientY - s.y) > 8)) return;
                          completeBooking(b.id);
                        }}
                        disabled={actionLoading === b.id}
                        className="flex-1 flex items-center justify-center py-2.5 bg-green-500 text-white text-sm font-semibold rounded-xl disabled:opacity-50 touch-manipulation"
                        style={{ WebkitTapHighlightColor: "transparent" }}>
                        {actionLoading === b.id ? "..." : "✓ Hoàn thành"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 p-4 border-t border-hairline">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              className="px-5 py-2.5 text-sm font-medium border border-hairline rounded-xl disabled:opacity-40 touch-manipulation">
              ← Trước
            </button>
            <span className="text-sm text-muted font-medium">{page + 1} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
              className="px-5 py-2.5 text-sm font-medium border border-hairline rounded-xl disabled:opacity-40 touch-manipulation">
              Tiếp →
            </button>
          </div>
        )}

        <div className="h-24 md:hidden" aria-hidden />
      </div>

      {/* Modal chọn bàn */}
      {showTableModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50"
          onClick={() => setShowTableModal(false)}>
          <div className="w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[85vh] flex flex-col"
            onClick={e => e.stopPropagation()}>
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-hairline">
              <h2 className="text-base font-bold text-ink">Chọn bàn cho khách</h2>
              <button
                onPointerDown={(e) => { if (e.pointerType === "touch") { e.preventDefault(); setShowTableModal(false); } }}
                onClick={() => setShowTableModal(false)}
                className="p-1.5 text-muted hover:text-ink rounded-lg touch-manipulation"
                style={{ WebkitTapHighlightColor: "transparent" }}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeWidth="2" strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Table grid */}
            <div className="flex-1 overflow-y-auto p-5">
              {tablesLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : tables.length === 0 ? (
                <p className="text-center text-muted py-8 text-sm">Không có bàn nào</p>
              ) : (
                <>
                  <div className="flex gap-4 text-xs text-muted mb-4">
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded bg-green-100 border border-green-300 inline-block" />Trống
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded bg-red-100 border border-red-300 inline-block" />Đang có khách
                    </span>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                    {tables.map(t => {
                      const occupied = t.status === "OCCUPIED";
                      const selected = selectedTableId === t.id;
                      return (
                        <button key={t.id}
                          onPointerDown={(e) => { if (e.pointerType === "touch") { e.preventDefault(); setSelectedTableId(t.id); } }}
                          onClick={() => setSelectedTableId(t.id)}
                          className={`relative rounded-xl border-2 p-3 text-center transition-all min-h-[64px] touch-manipulation ${
                            selected
                              ? "border-primary bg-primary/10"
                              : occupied
                              ? "border-red-200 bg-red-50"
                              : "border-green-200 bg-green-50"
                          }`}
                          style={{ WebkitTapHighlightColor: "transparent" }}>
                          <div className="font-bold text-sm text-ink">{t.name ?? `Bàn ${t.tableNumber}`}</div>
                          <div className={`text-xs mt-0.5 ${occupied ? "text-red-500" : "text-green-600"}`}>
                            {occupied ? "Đang mở" : "Trống"}
                          </div>
                          {selected && (
                            <span className="absolute top-1.5 right-1.5 text-primary font-bold text-xs">✓</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  {selectedTableId && tables.find(t => t.id === selectedTableId)?.status === "OCCUPIED" && (
                    <div className="mt-4 flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-3 text-sm text-red-600">
                      <span className="flex-shrink-0">⚠️</span>
                      <span>Bàn này đang được mở. Vui lòng chọn bàn khác</span>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Modal footer */}
            <div className="flex gap-3 px-5 py-4 border-t border-hairline">
              <button onClick={() => setShowTableModal(false)}
                className="flex-1 py-3 text-sm font-medium border border-hairline rounded-xl touch-manipulation"
                style={{ WebkitTapHighlightColor: "transparent" }}>
                Hủy
              </button>
              <button
                onPointerDown={(e) => { if (e.pointerType === "touch") { e.preventDefault(); checkoutToOrder(); } }}
                onClick={checkoutToOrder}
                disabled={!selectedTableId || tables.find(t => t.id === selectedTableId)?.status === "OCCUPIED" || actionLoading !== null}
                className="flex-1 py-3 text-sm font-semibold bg-primary text-white rounded-xl disabled:opacity-40 touch-manipulation"
                style={{ WebkitTapHighlightColor: "transparent" }}>
                {actionLoading !== null ? "Đang xử lý..." : "Xác nhận"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
