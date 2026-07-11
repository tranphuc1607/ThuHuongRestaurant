"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getAuthHeaders } from "@/lib/auth";
import { formatPrice } from "@/lib/utils";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING_PAYMENT: { label: "Chờ thanh toán", color: "bg-yellow-100 text-yellow-700" },
  CONFIRMED:       { label: "Đã xác nhận",    color: "bg-blue-100 text-blue-700" },
  CHECKED_IN:      { label: "Đã check-in",    color: "bg-indigo-100 text-indigo-700" },
  COMPLETED:       { label: "Hoàn thành",     color: "bg-green-100 text-green-700" },
  CANCELLED:       { label: "Đã hủy",         color: "bg-red-100 text-red-600" },
  EXPIRED:         { label: "Hết hạn",        color: "bg-canvas text-muted" },
};

const METHOD_LABELS: Record<string, string> = {
  BANK_TRANSFER: "Chuyển khoản",
  CASH: "Tiền mặt",
};

interface BookingItem {
  id: number;
  productId: number;
  productName: string;
  productPrice: number;
  quantity: number;
  saleUnit: string;
  itemTotal: number;
}

interface BookingDetail {
  id: number;
  bookingCode: string;
  customerName: string;
  customerPhone: string;
  tableId?: number;
  tableName?: string;
  scheduledTime: string;
  guestCount: number;
  status: string;
  paymentMethod?: string;
  totalAmount: number;
  note?: string;
  cancelReason?: string;
  stockWarning?: string;
  items: BookingItem[];
  createdAt: string;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="w-28 text-muted-soft text-xs flex-shrink-0 pt-0.5">{label}</dt>
      <dd className="flex-1 text-sm text-ink">{value}</dd>
    </div>
  );
}

export default function EmployeeBookingDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState({ msg: "", ok: true });
  const [showTableModal, setShowTableModal] = useState(false);
  const [tables, setTables] = useState<{ id: number; name: string; tableNumber: number; status: string }[]>([]);
  const [tablesLoading, setTablesLoading] = useState(false);
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null);

  const pointerDownPos = useRef<{ x: number; y: number } | null>(null);
  const scrollMoved = useRef(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/bookings/${id}`, { headers: getAuthHeaders() });
      const json = await res.json();
      if (json.statusCode === 200) setBooking(json.data);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast({ msg: "", ok: true }), 3500);
  }

  async function completeBooking() {
    setActionLoading(true);
    try {
      const res = await fetch(`${BASE}/bookings/${booking!.id}/complete`, {
        method: "PATCH", headers: getAuthHeaders(),
      });
      const json = await res.json();
      if (res.ok && json.statusCode === 200) { showToast("Đã hoàn thành booking"); load(); }
      else showToast(json.message ?? "Thất bại", false);
    } finally { setActionLoading(false); }
  }

  async function openTableModal() {
    setShowTableModal(true);
    setSelectedTableId(null);
    setTablesLoading(true);
    try {
      const res = await fetch(`${BASE}/orders/tables`, { headers: getAuthHeaders() });
      const json = await res.json();
      if (json.statusCode === 200) setTables(json.data ?? []);
    } finally { setTablesLoading(false); }
  }

  async function checkoutToOrder() {
    if (!selectedTableId) { showToast("Vui lòng chọn bàn", false); return; }
    const t = tables.find(x => x.id === selectedTableId);
    if (t?.status === "OCCUPIED") { showToast("Bàn này đang được mở rồi, vui lòng chọn bàn khác", false); return; }
    setActionLoading(true);
    try {
      const res = await fetch(`${BASE}/bookings/${booking!.id}/checkout-to-order`, {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ tableId: selectedTableId }),
      });
      const json = await res.json();
      if (res.ok && json.statusCode === 200) {
        setShowTableModal(false);
        const orderId = json.data?.id;
        if (orderId) router.push(`/employee/don-hang/${orderId}?from=ban`);
        else { showToast("Đã chuyển sang đơn hàng"); load(); }
      } else showToast(json.message ?? "Thất bại", false);
    } finally { setActionLoading(false); }
  }

  function formatTime(iso?: string) {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("vi-VN", {
      weekday: "long", day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  }

  const st = booking ? STATUS_LABELS[booking.status] : null;
  const isConfirmed = booking?.status === "CONFIRMED";
  const isCheckedIn = booking?.status === "CHECKED_IN";
  const isCancelled = booking?.status === "CANCELLED";
  const hasActions = isConfirmed || isCheckedIn; // CONFIRMED: chỉ "Mở đơn"; CHECKED_IN: chỉ "Hoàn thành"

  return (
    <div className="h-full flex flex-col overflow-hidden bg-surface-soft">
      {/* Toast */}
      {toast.msg && (
        <div className={`fixed top-4 right-4 text-sm px-4 py-2.5 rounded-lg shadow-lg z-50 ${toast.ok ? "bg-gray-800 text-white" : "bg-red-500 text-white"}`}>
          {toast.msg}
        </div>
      )}

      {/* Fixed header */}
      <div className="flex-shrink-0 bg-canvas border-b border-hairline px-3 py-2.5 flex items-center gap-2">
        <Link
          href="/employee/dat-ban"
          className="p-1.5 -ml-1 text-muted-soft hover:text-ink rounded-lg touch-manipulation"
          style={{ WebkitTapHighlightColor: "transparent" }}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>

        <span className="font-mono text-sm font-bold text-primary flex-1 truncate">
          {loading ? "Đang tải..." : booking?.bookingCode ?? "—"}
        </span>

        {st && (
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold flex-shrink-0 ${st.color}`}>
            {st.label}
          </span>
        )}

        <button
          onPointerDown={(e) => { if (e.pointerType === "touch") { e.preventDefault(); load(); } }}
          onClick={load}
          className="p-2 text-muted hover:text-ink rounded-lg touch-manipulation"
          style={{ WebkitTapHighlightColor: "transparent" }}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {/* Scrollable content */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !booking ? (
        <div className="flex-1 flex items-center justify-center text-red-500 text-sm">Không tìm thấy booking</div>
      ) : (
        <div
          className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-3"
          style={{ overscrollBehavior: "contain" }}
          onPointerDown={(e) => { pointerDownPos.current = { x: e.clientX, y: e.clientY }; scrollMoved.current = false; }}
          onPointerMove={(e) => {
            const s = pointerDownPos.current;
            if (s && (Math.abs(e.clientX - s.x) > 8 || Math.abs(e.clientY - s.y) > 8)) scrollMoved.current = true;
          }}
          onClickCapture={(e) => { if (scrollMoved.current) { e.stopPropagation(); e.preventDefault(); } }}>

          {/* Thông tin khách + đặt bàn */}
          <div className="bg-canvas rounded-xl border border-hairline p-4 space-y-2.5">
            <h2 className="text-xs font-bold text-muted-soft uppercase tracking-wide">Thông tin khách</h2>
            <dl className="space-y-2">
              <Row label="Họ tên" value={<span className="font-semibold">{booking.customerName}</span>} />
              <Row label="Điện thoại" value={
                <a href={`tel:${booking.customerPhone}`}
                  className="text-primary font-semibold touch-manipulation"
                  style={{ WebkitTapHighlightColor: "transparent" }}>
                  {booking.customerPhone}
                </a>
              } />
            </dl>
          </div>

          <div className="bg-canvas rounded-xl border border-hairline p-4 space-y-2.5">
            <h2 className="text-xs font-bold text-muted-soft uppercase tracking-wide">Chi tiết đặt bàn</h2>
            <dl className="space-y-2">
              <Row label="Mã đặt bàn" value={<span className="font-mono text-primary font-semibold">{booking.bookingCode}</span>} />
              <Row label="Đặt lúc" value={formatTime(booking.createdAt)} />
              <Row label="Đến lúc" value={<span className="font-bold text-ink">{formatTime(booking.scheduledTime)}</span>} />
              <Row label="Số khách" value={`${booking.guestCount} người`} />
              <Row label="Bàn" value={booking.tableName ?? <span className="text-muted-soft italic">Chưa xếp bàn</span>} />
              <Row label="Thanh toán" value={METHOD_LABELS[booking.paymentMethod ?? ""] ?? (booking.paymentMethod ?? "—")} />
              <Row label="Tổng cọc" value={<span className="font-bold text-primary">{formatPrice(booking.totalAmount)}</span>} />
            </dl>
          </div>

          {/* Danh sách món */}
          {(booking.items?.length ?? 0) > 0 && (
            <div className="bg-canvas rounded-xl border border-hairline p-4">
              <h2 className="text-xs font-bold text-muted-soft uppercase tracking-wide mb-3">
                Món đặt trước ({booking.items.length})
              </h2>
              <div className="space-y-2">
                {booking.items.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 py-1">
                    <img
                      src={"/images/no-image.svg"}
                      alt={item.productName}
                      className="w-10 h-10 object-cover rounded-lg flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-ink truncate">{item.productName}</div>
                      <div className="text-xs text-muted-soft">{formatPrice(item.productPrice)} × {item.quantity}</div>
                    </div>
                    <div className="text-sm font-bold text-ink flex-shrink-0">{formatPrice(item.itemTotal)}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-hairline flex justify-between items-center">
                <span className="text-sm font-bold text-ink">Tổng cộng</span>
                <span className="text-sm font-bold text-primary">{formatPrice(booking.totalAmount)}</span>
              </div>
            </div>
          )}

          {/* Ghi chú */}
          {booking.note && (
            <div className="bg-canvas rounded-xl border border-hairline p-4">
              <h2 className="text-xs font-bold text-muted-soft uppercase tracking-wide mb-2">Ghi chú của khách</h2>
              <p className="text-sm text-gray-700 whitespace-pre-line">{booking.note}</p>
            </div>
          )}

          {/* Lý do hủy */}
          {isCancelled && booking.cancelReason && (
            <div className="bg-red-50 rounded-xl border border-red-200 p-4">
              <h2 className="text-xs font-bold text-red-700 uppercase tracking-wide mb-2">Lý do hủy</h2>
              <p className="text-sm text-red-700">{booking.cancelReason}</p>
            </div>
          )}

          {/* Cảnh báo kho */}
          {booking.stockWarning && (
            <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
              <h2 className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-2">⚠ Cảnh báo kho</h2>
              <p className="text-sm text-amber-800">{booking.stockWarning}</p>
            </div>
          )}

          {/* Spacer cho bottom bar / mobile nav */}
          <div className="h-24 md:hidden" aria-hidden />
        </div>
      )}

      {/* Fixed bottom action bar */}
      {!loading && hasActions && (
        <div className="flex-shrink-0 bg-canvas border-t border-hairline px-3 py-3 flex gap-2">
          {isConfirmed && (
            <button
              onPointerDown={(e) => { if (e.pointerType === "touch") { e.preventDefault(); openTableModal(); } }}
              onClick={openTableModal}
              disabled={actionLoading}
              className="flex-1 py-3 bg-primary text-white text-sm font-bold rounded-xl hover:bg-primary-dark disabled:opacity-50 touch-manipulation"
              style={{ WebkitTapHighlightColor: "transparent" }}>
              🧾 Chuyển sang đơn
            </button>
          )}
          {isCheckedIn && (
            <button
              onPointerDown={(e) => { if (e.pointerType === "touch") { e.preventDefault(); completeBooking(); } }}
              onClick={completeBooking}
              disabled={actionLoading}
              className="flex-1 py-3 bg-green-500 text-white text-sm font-bold rounded-xl hover:bg-green-600 disabled:opacity-50 touch-manipulation"
              style={{ WebkitTapHighlightColor: "transparent" }}>
              {actionLoading ? "Đang xử lý..." : "✅ Hoàn thành"}
            </button>
          )}
        </div>
      )}

      {/* Modal chọn bàn */}
      {showTableModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full sm:max-w-lg max-h-[85dvh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-hairline flex-shrink-0">
              <h2 className="font-bold text-ink">Chọn bàn cho khách</h2>
              <button
                onPointerDown={(e) => { if (e.pointerType === "touch") { e.preventDefault(); setShowTableModal(false); } }}
                onClick={() => setShowTableModal(false)}
                className="w-8 h-8 flex items-center justify-center text-muted-soft hover:text-ink rounded-full touch-manipulation"
                style={{ WebkitTapHighlightColor: "transparent" }}>
                ✕
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-5">
              {tablesLoading ? (
                <p className="text-center text-muted py-8 text-sm">Đang tải danh sách bàn...</p>
              ) : tables.length === 0 ? (
                <p className="text-center text-muted py-8 text-sm">Không có bàn nào</p>
              ) : (
                <>
                  <div className="flex gap-3 text-xs text-muted mb-3">
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-sm bg-green-100 border border-green-300 inline-block" />Trống
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-sm bg-red-100 border border-red-300 inline-block" />Đang có khách
                    </span>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {tables.map(t => {
                      const occupied = t.status === "OCCUPIED";
                      const selected = selectedTableId === t.id;
                      return (
                        <button
                          key={t.id}
                          onPointerDown={(e) => { if (e.pointerType === "touch") { e.preventDefault(); setSelectedTableId(t.id); } }}
                          onClick={() => setSelectedTableId(t.id)}
                          className={`relative rounded-xl border-2 p-3 text-center transition-all touch-manipulation ${
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
                            <span className="absolute top-1 right-1 text-primary text-xs font-bold">✓</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {selectedTableId && tables.find(t => t.id === selectedTableId)?.status === "OCCUPIED" && (
                <div className="mt-3 flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 text-sm text-red-600">
                  <span>⚠️</span>
                  <span>Bàn này đang được mở rồi, vui lòng chọn bàn khác</span>
                </div>
              )}
            </div>

            <div className="flex gap-2 px-5 py-4 border-t border-hairline flex-shrink-0">
              <button
                onPointerDown={(e) => { if (e.pointerType === "touch") { e.preventDefault(); setShowTableModal(false); } }}
                onClick={() => setShowTableModal(false)}
                className="flex-1 py-3 text-sm border border-hairline rounded-xl hover:bg-surface-soft touch-manipulation"
                style={{ WebkitTapHighlightColor: "transparent" }}>
                Hủy
              </button>
              <button
                onPointerDown={(e) => {
                  if (e.pointerType === "touch") {
                    e.preventDefault();
                    if (!actionLoading && selectedTableId && tables.find(t => t.id === selectedTableId)?.status !== "OCCUPIED") {
                      checkoutToOrder();
                    }
                  }
                }}
                onClick={checkoutToOrder}
                disabled={actionLoading || !selectedTableId || tables.find(t => t.id === selectedTableId)?.status === "OCCUPIED"}
                className="flex-1 py-3 text-sm bg-primary text-white font-bold rounded-xl hover:bg-primary-dark disabled:opacity-40 touch-manipulation"
                style={{ WebkitTapHighlightColor: "transparent" }}>
                {actionLoading ? "Đang xử lý..." : "Xác nhận"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
