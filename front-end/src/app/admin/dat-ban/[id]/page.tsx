"use client";
import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getAuthHeaders } from "@/lib/auth";
import { formatPrice } from "@/lib/utils";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api/v1";

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  PENDING_PAYMENT: { label: "Chờ thanh toán", color: "text-yellow-700", bg: "bg-yellow-50 border-yellow-200" },
  CONFIRMED:       { label: "Đã xác nhận",    color: "text-blue-700",   bg: "bg-blue-50 border-blue-200" },
  CHECKED_IN:      { label: "Đã check-in",    color: "text-indigo-700", bg: "bg-indigo-50 border-indigo-200" },
  COMPLETED:       { label: "Hoàn thành",     color: "text-green-700",  bg: "bg-green-50 border-green-200" },
  CANCELLED:       { label: "Đã hủy",         color: "text-red-700",    bg: "bg-red-50 border-red-200" },
  EXPIRED:         { label: "Hết hạn",        color: "text-gray-500",   bg: "bg-gray-50 border-gray-200" },
};

const STATUS_PILL: Record<string, string> = {
  PENDING_PAYMENT: "bg-yellow-100 text-yellow-700",
  CONFIRMED:       "bg-blue-100 text-blue-700",
  CHECKED_IN:      "bg-indigo-100 text-indigo-700",
  COMPLETED:       "bg-green-100 text-green-700",
  CANCELLED:       "bg-red-100 text-red-600",
  EXPIRED:         "bg-gray-100 text-gray-500",
};

const METHOD_LABELS: Record<string, string> = {
  BANK_TRANSFER: "Chuyển khoản",
  CASH: "Tiền mặt",
};

interface DiningTable { id: number; tableNumber: number; name: string; status: "AVAILABLE" | "OCCUPIED"; }
interface BookingItem { id: number; productId: number; productName: string; productPrice: number; quantity: number; saleUnit: string; itemTotal: number; }
interface BookingDetail {
  id: number; bookingCode: string; customerName: string; customerPhone: string;
  customerBankAccount?: string; tableId?: number; tableName?: string;
  scheduledTime: string; guestCount: number; status: string; paymentMethod?: string;
  totalAmount: number; paidAmount?: number; note?: string; cancelReason?: string;
  stockWarning?: string; items: BookingItem[]; createdAt: string;
  paymentInfo?: { bankName: string; accountNumber: string; accountHolder: string; amount: number; transferContent: string; vietQrUrl: string; };
  expiresAt?: string;
}

function fmtDateTime(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function fmtDateTimeShort(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function BookingDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [booking, setBooking]       = useState<BookingDetail | null>(null);
  const [loading, setLoading]       = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast]           = useState({ msg: "", ok: true });
  const [removingItemId, setRemovingItemId]   = useState<number | null>(null);
  const [updatingItemId, setUpdatingItemId]   = useState<number | null>(null);
  const [showTableModal, setShowTableModal]   = useState(false);
  const [tables, setTables]         = useState<DiningTable[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null);
  const [tablesLoading, setTablesLoading]     = useState(false);

  const load = useCallback(async () => {
    try {
      const res  = await fetch(`${BASE}/bookings/${id}`, { headers: getAuthHeaders(), cache: "no-store" });
      const json = await res.json();
      if (json.statusCode === 200) setBooking(json.data);
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast({ msg: "", ok: true }), 3500);
  }

  async function doAction(endpoint: string, method = "PATCH", successMsg: string) {
    setActionLoading(true);
    try {
      const res  = await fetch(`${BASE}/bookings/${booking!.id}/${endpoint}`, { method, headers: getAuthHeaders() });
      const json = await res.json();
      if (res.ok && json.statusCode === 200) { showToast(successMsg); load(); }
      else showToast(json.message ?? "Thao tác thất bại", false);
    } finally { setActionLoading(false); }
  }

  async function updateItemQty(item: BookingItem, newQty: number) {
    if (newQty < 1 || newQty === item.quantity) return;
    const delta    = newQty - item.quantity;
    const newTotal = booking!.totalAmount + delta * item.productPrice;
    const newRefund = Math.round(paidAmount - newTotal);
    const confirmed = window.confirm(
      `Đổi SL "${item.productName}" từ ${item.quantity} → ${newQty}?` +
      (booking?.status === "CONFIRMED" ? `\nKho sẽ ${delta > 0 ? "bị trừ thêm" : "được hoàn"} ${Math.abs(delta)} ${item.saleUnit}.` : "") +
      (booking!.paymentMethod === "BANK_TRANSFER" && newRefund > 0 ? `\n💰 Cần hoàn khách: ${formatPrice(newRefund)}` : "")
    );
    if (!confirmed) return;
    setUpdatingItemId(item.id);
    try {
      const res  = await fetch(`${BASE}/bookings/${booking!.id}/items/${item.id}`, {
        method: "PATCH",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ quantity: newQty }),
      });
      const json = await res.json();
      if (res.ok && json.statusCode === 200) { showToast(`Đã cập nhật SL "${item.productName}"`); load(); }
      else showToast(json.message ?? "Không thể cập nhật", false);
    } finally { setUpdatingItemId(null); }
  }

  async function removeItem(item: BookingItem) {
    const newTotal  = booking!.totalAmount - item.itemTotal;
    const newRefund = Math.round(paidAmount - newTotal);
    const confirmed = confirm(
      `Hủy món "${item.productName}" (x${item.quantity} ${item.saleUnit})?` +
      (isConfirmed ? "\nKho sẽ được hoàn tự động." : "") +
      (booking!.paymentMethod === "BANK_TRANSFER" && isConfirmed && newRefund > 0 ? `\n💰 Cần hoàn khách: ${formatPrice(newRefund)}` : "")
    );
    if (!confirmed) return;
    setRemovingItemId(item.id);
    try {
      const res  = await fetch(`${BASE}/bookings/${booking!.id}/items/${item.id}`, { method: "DELETE", headers: getAuthHeaders() });
      const json = await res.json();
      if (res.ok && json.statusCode === 200) { showToast(`Đã hủy "${item.productName}"`); load(); }
      else showToast(json.message ?? "Không thể hủy món", false);
    } finally { setRemovingItemId(null); }
  }

  async function openTableModal() {
    setTablesLoading(true);
    setShowTableModal(true);
    setSelectedTableId(booking?.tableId ?? null);
    try {
      const res  = await fetch(`${BASE}/orders/tables?size=100`, { headers: getAuthHeaders() });
      const json = await res.json();
      if (json.statusCode === 200) setTables(json.data?.content ?? json.data ?? []);
    } finally { setTablesLoading(false); }
  }

  async function checkoutToOrder() {
    setShowTableModal(false);
    setActionLoading(true);
    try {
      const body: Record<string, unknown> = {};
      if (selectedTableId) body.tableId = selectedTableId;
      const res  = await fetch(`${BASE}/bookings/${booking!.id}/checkout-to-order`, {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (res.ok && json.statusCode === 200) {
        const orderId = json.data?.id;
        if (orderId) router.push(`/admin/don-hang/${orderId}`); else load();
      } else showToast(json.message ?? "Thất bại", false);
    } finally { setActionLoading(false); }
  }

  if (loading) return (
    <div className="flex justify-center items-center min-h-[60vh]">
      <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin"/>
    </div>
  );
  if (!booking) return <div className="p-6 text-red-500 text-sm">Không tìm thấy booking</div>;

  const stCfg      = STATUS_CFG[booking.status] ?? STATUS_CFG["EXPIRED"];
  const stPill     = STATUS_PILL[booking.status] ?? "bg-gray-100 text-gray-500";
  const isPending  = booking.status === "PENDING_PAYMENT";
  const isConfirmed = booking.status === "CONFIRMED";
  const isCancelled = booking.status === "CANCELLED";
  const canEditItems = isPending || isConfirmed;
  const hasActions = isPending || isConfirmed;
  const paidAmount = booking.paidAmount ?? 0;
  const bookingRefund = Math.round(paidAmount - booking.totalAmount);
  const needsRefund = isConfirmed && booking.paymentMethod === "BANK_TRANSFER" && bookingRefund > 0;

  return (
    <div className={`p-3 md:p-6 max-w-4xl ${hasActions ? "pb-24 md:pb-6" : ""}`}>

      {/* Toast */}
      {toast.msg && (
        <div className={`fixed top-16 md:top-4 right-3 text-xs px-3 py-2 rounded-lg shadow-lg z-50 max-w-[calc(100vw-1.5rem)] ${toast.ok ? "bg-gray-900 text-white" : "bg-red-500 text-white"}`}>
          {toast.msg}
        </div>
      )}

      {/* ── Table modal ── */}
      {showTableModal && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowTableModal(false)} />
          <div className="relative bg-white rounded-t-2xl md:rounded-xl shadow-2xl w-full md:max-w-lg max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">Chọn bàn cho order</h3>
              <button onClick={() => setShowTableModal(false)} className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-bold touch-manipulation">✕</button>
            </div>
            <div className="overflow-y-auto p-4 flex-1">
              {tablesLoading ? (
                <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"/></div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  <button onClick={() => setSelectedTableId(null)}
                    className={`p-3 rounded-xl border-2 text-center text-sm transition-colors touch-manipulation ${selectedTableId === null ? "border-primary bg-primary/5 text-primary font-semibold" : "border-gray-200 text-gray-500"}`}>
                    <div className="text-lg mb-0.5">—</div>
                    <div className="text-xs">Chưa xếp</div>
                  </button>
                  {tables.map((t) => {
                    const selected  = selectedTableId === t.id;
                    const occupied  = t.status === "OCCUPIED";
                    return (
                      <button key={t.id} onClick={() => setSelectedTableId(t.id)}
                        className={`p-3 rounded-xl border-2 text-center text-sm transition-colors touch-manipulation ${selected ? "border-primary bg-primary/5 text-primary font-semibold" : occupied ? "border-red-200 bg-red-50 text-red-600" : "border-gray-200 hover:border-green-300 hover:bg-green-50"}`}>
                        <div className="font-bold text-base">#{t.tableNumber}</div>
                        <div className="text-xs mt-0.5 truncate">{t.name}</div>
                        <div className={`text-xs mt-1 font-medium ${occupied ? "text-red-500" : "text-green-600"}`}>
                          {occupied ? "Có khách" : "Trống"}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="flex gap-2 px-4 py-3 border-t border-gray-100">
              <button onClick={() => setShowTableModal(false)}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 font-semibold touch-manipulation">Hủy</button>
              <button onClick={checkoutToOrder} disabled={tablesLoading}
                className="flex-1 py-2.5 bg-primary text-white text-sm font-semibold rounded-xl disabled:opacity-50 touch-manipulation">
                {selectedTableId ? `Bàn #${tables.find(t => t.id === selectedTableId)?.tableNumber}` : "Chưa xếp bàn"} ✓
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => router.back()} className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 text-gray-600 text-sm font-bold flex-shrink-0 touch-manipulation">←</button>
        <span className="font-mono text-sm font-bold text-primary truncate">{booking.bookingCode}</span>
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold flex-shrink-0 ${stPill}`}>{stCfg.label}</span>
        {needsRefund && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold flex-shrink-0">💰 Hoàn tiền</span>}
      </div>

      {/* ── MOBILE LAYOUT ── */}
      <div className="md:hidden space-y-3">

        {/* Status banner (non-active states) */}
        {(isCancelled || booking.status === "COMPLETED" || booking.status === "CHECKED_IN" || booking.status === "EXPIRED") && (
          <div className={`rounded-xl border px-4 py-3 ${stCfg.bg}`}>
            <p className={`text-sm font-semibold ${stCfg.color}`}>{stCfg.label}</p>
            {isCancelled && booking.cancelReason && (
              <p className="text-xs text-red-600 mt-1">{booking.cancelReason}</p>
            )}
          </div>
        )}

        {/* Refund banner */}
        {needsRefund && (
          <div className="bg-amber-50 border border-amber-300 rounded-xl px-4 py-3">
            <p className="text-sm font-bold text-amber-800">💰 Cần hoàn khách: {formatPrice(bookingRefund)}</p>
            <p className="text-xs text-amber-600 mt-0.5">Cọc {formatPrice(paidAmount)} — Hiện tại {formatPrice(booking.totalAmount)}</p>
          </div>
        )}

        {/* Customer + booking info (combined compact card) */}
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          {/* Customer row */}
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="font-bold text-gray-900">{booking.customerName}</div>
              <div className="text-sm text-gray-400 mt-0.5">{booking.customerPhone}</div>
            </div>
            <a href={`tel:${booking.customerPhone}`}
              className="w-9 h-9 bg-green-50 text-green-600 rounded-full flex items-center justify-center flex-shrink-0 touch-manipulation" aria-label="Gọi điện">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
              </svg>
            </a>
          </div>

          {/* Info grid 2x2 */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="bg-gray-50 rounded-lg px-3 py-2">
              <div className="text-[10px] text-gray-400 mb-0.5">Đến lúc</div>
              <div className="text-xs font-bold text-gray-800">{fmtDateTimeShort(booking.scheduledTime)}</div>
            </div>
            <div className="bg-gray-50 rounded-lg px-3 py-2">
              <div className="text-[10px] text-gray-400 mb-0.5">Số khách</div>
              <div className="text-xs font-bold text-gray-800">{booking.guestCount} người</div>
            </div>
            <div className="bg-gray-50 rounded-lg px-3 py-2">
              <div className="text-[10px] text-gray-400 mb-0.5">Bàn</div>
              <div className="text-xs font-bold text-gray-800">{booking.tableName ?? "Chưa xếp"}</div>
            </div>
            <div className="bg-gray-50 rounded-lg px-3 py-2">
              <div className="text-[10px] text-gray-400 mb-0.5">Thanh toán</div>
              <div className="text-xs font-bold text-gray-800">{METHOD_LABELS[booking.paymentMethod ?? ""] ?? "—"}</div>
            </div>
          </div>

          {/* Amount */}
          <div className="flex items-center justify-between pt-2.5 border-t border-gray-100">
            <span className="text-xs text-gray-400">Tổng cọc</span>
            <span className="text-base font-bold text-primary">{formatPrice(booking.totalAmount)}</span>
          </div>
          {paidAmount > 0 && (
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-gray-400">Đã nhận (CK)</span>
              <span className="text-sm font-semibold text-green-600">{formatPrice(paidAmount)}</span>
            </div>
          )}
        </div>

        {/* Stock warning */}
        {booking.stockWarning && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <p className="text-xs font-bold text-amber-700 mb-0.5">⚠ Cảnh báo kho</p>
            <p className="text-xs text-amber-700">{booking.stockWarning}</p>
          </div>
        )}

        {/* Items */}
        {booking.items && booking.items.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">Món đặt trước</span>
              <span className="text-xs text-gray-400">{booking.items.length} món</span>
            </div>
            <div className="divide-y divide-gray-100">
              {booking.items.map((item) => (
                <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                  <img src={"/images/no-image.svg"}
                    alt={item.productName} className="w-10 h-10 rounded-lg object-cover flex-shrink-0"/>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-800 truncate">{item.productName}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{formatPrice(item.productPrice)} / {item.saleUnit}</div>
                    <div className="flex items-center justify-between mt-1.5">
                      {canEditItems ? (
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => updateItemQty(item, item.quantity - 1)}
                            disabled={updatingItemId === item.id || item.quantity <= 1}
                            className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center text-sm font-bold text-gray-600 disabled:opacity-30 touch-manipulation">−</button>
                          <span className="w-5 text-center text-sm font-bold text-gray-900">
                            {updatingItemId === item.id ? <span className="text-gray-300">…</span> : item.quantity}
                          </span>
                          <button onClick={() => updateItemQty(item, item.quantity + 1)}
                            disabled={updatingItemId === item.id}
                            className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center text-sm font-bold text-gray-600 disabled:opacity-30 touch-manipulation">+</button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-500">x{item.quantity}</span>
                      )}
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-gray-900">{formatPrice(item.itemTotal)}</span>
                        {canEditItems && (
                          <button onClick={() => removeItem(item)}
                            disabled={removingItemId === item.id || updatingItemId === item.id}
                            className="w-7 h-7 rounded-full bg-red-50 text-red-400 flex items-center justify-center text-xs font-bold hover:bg-red-100 disabled:opacity-30 touch-manipulation">
                            {removingItemId === item.id ? "…" : "✕"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 flex justify-between items-center">
              <span className="text-xs text-gray-500">Tổng hiện tại</span>
              <span className="text-sm font-bold text-gray-900">{formatPrice(booking.totalAmount)}</span>
            </div>
          </div>
        )}

        {/* Note */}
        {booking.note && (
          <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Ghi chú khách</p>
            <p className="text-sm text-gray-700 whitespace-pre-line">{booking.note}</p>
          </div>
        )}

        {/* QR */}
        {isPending && booking.paymentMethod === "BANK_TRANSFER" && booking.paymentInfo && (
          <div className="bg-white rounded-xl border border-gray-100 p-4 flex flex-col items-center">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">QR Chuyển khoản</p>
            <img src={booking.paymentInfo.vietQrUrl} alt="VietQR" className="w-44 h-44 object-contain mb-3"/>
            <div className="w-full space-y-1 text-xs text-center">
              <div><span className="text-gray-400">Ngân hàng: </span><span className="font-medium">{booking.paymentInfo.bankName}</span></div>
              <div><span className="text-gray-400">STK: </span><span className="font-mono font-bold">{booking.paymentInfo.accountNumber}</span></div>
              <div><span className="text-gray-400">Nội dung: </span><span className="font-mono font-bold text-primary">{booking.paymentInfo.transferContent}</span></div>
              <div><span className="text-gray-400">Số tiền: </span><span className="font-bold text-primary">{formatPrice(booking.paymentInfo.amount)}</span></div>
            </div>
          </div>
        )}

        {/* Created at */}
        <p className="text-xs text-gray-400 text-center pb-1">Đặt lúc: {fmtDateTime(booking.createdAt)}</p>
      </div>

      {/* ── DESKTOP LAYOUT (md+) ── */}
      <div className="hidden md:grid grid-cols-2 gap-5">

        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-4">Thông tin khách</h2>
          <dl className="space-y-2.5 text-sm">
            <RowItem label="Họ tên" value={booking.customerName}/>
            <RowItem label="Điện thoại" value={booking.customerPhone}/>
            {booking.customerBankAccount && <RowItem label="Số tài khoản" value={booking.customerBankAccount}/>}
          </dl>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-4">Thông tin đặt bàn</h2>
          <dl className="space-y-2.5 text-sm">
            <RowItem label="Mã" value={<span className="font-mono text-primary font-bold">{booking.bookingCode}</span>}/>
            <RowItem label="Đặt lúc" value={fmtDateTime(booking.createdAt)}/>
            <RowItem label="Đến lúc" value={<span className="font-semibold">{fmtDateTime(booking.scheduledTime)}</span>}/>
            <RowItem label="Số khách" value={`${booking.guestCount} người`}/>
            <RowItem label="Bàn" value={booking.tableName ?? <span className="text-gray-400 italic">Chưa xếp bàn</span>}/>
            <RowItem label="Thanh toán" value={METHOD_LABELS[booking.paymentMethod ?? ""] ?? "—"}/>
            <RowItem label="Tổng cọc" value={<span className="font-bold text-primary">{formatPrice(booking.totalAmount)}</span>}/>
            {paidAmount > 0 && <RowItem label="Đã nhận" value={<span className="text-green-600 font-semibold">{formatPrice(paidAmount)}</span>}/>}
          </dl>
        </div>

        {booking.items && booking.items.length > 0 && (
          <div className="col-span-2 bg-white rounded-xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide">Món đặt trước ({booking.items.length} món)</h2>
              {canEditItems && <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-200">Admin có thể hủy từng món</span>}
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase">
                  <th className="pb-2 text-left font-semibold">Món</th>
                  <th className="pb-2 text-center font-semibold">Đơn vị</th>
                  <th className="pb-2 text-center font-semibold w-28">Số lượng</th>
                  <th className="pb-2 text-right font-semibold">Đơn giá</th>
                  <th className="pb-2 text-right font-semibold">Thành tiền</th>
                  {canEditItems && <th className="pb-2 w-10"/>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {booking.items.map((item) => (
                  <tr key={item.id}>
                    <td className="py-2.5 font-medium text-gray-800">
                      <div className="flex items-center gap-2.5">
                        <img src={"/images/no-image.svg"}
                          alt={item.productName} className="w-9 h-9 rounded-lg object-cover flex-shrink-0"/>
                        {item.productName}
                      </div>
                    </td>
                    <td className="py-2.5 text-center text-gray-400 text-xs">{item.saleUnit}</td>
                    <td className="py-2.5 text-center">
                      {canEditItems ? (
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => updateItemQty(item, item.quantity-1)} disabled={updatingItemId===item.id||item.quantity<=1}
                            className="w-6 h-6 flex items-center justify-center rounded border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 text-sm font-bold">−</button>
                          <span className="w-7 text-center font-bold text-sm">
                            {updatingItemId===item.id ? <span className="text-gray-300 animate-pulse">…</span> : item.quantity}
                          </span>
                          <button onClick={() => updateItemQty(item, item.quantity+1)} disabled={updatingItemId===item.id}
                            className="w-6 h-6 flex items-center justify-center rounded border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 text-sm font-bold">+</button>
                        </div>
                      ) : <span>{item.quantity}</span>}
                    </td>
                    <td className="py-2.5 text-right text-gray-400">{formatPrice(item.productPrice)}</td>
                    <td className="py-2.5 text-right font-semibold text-gray-900">{formatPrice(item.itemTotal)}</td>
                    {canEditItems && (
                      <td className="py-2.5 text-center">
                        <button onClick={() => removeItem(item)} disabled={removingItemId===item.id||updatingItemId===item.id}
                          className="w-6 h-6 flex items-center justify-center rounded text-red-400 hover:bg-red-50 disabled:opacity-30">
                          {removingItemId===item.id ? <span className="text-xs animate-pulse">…</span> : <span className="text-sm font-bold">✕</span>}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-gray-100">
                <tr>
                  <td colSpan={canEditItems ? 4 : 3} className="pt-3 text-right text-sm text-gray-400">Tổng hiện tại:</td>
                  <td colSpan={2} className="pt-3 text-right font-bold text-gray-900">{formatPrice(booking.totalAmount)}</td>
                  {canEditItems && <td/>}
                </tr>
                {paidAmount > 0 && (
                  <tr>
                    <td colSpan={canEditItems ? 4 : 3} className="pt-1 text-right text-sm text-green-600">Đã nhận (CK):</td>
                    <td colSpan={2} className="pt-1 text-right font-semibold text-green-700">{formatPrice(paidAmount)}</td>
                    {canEditItems && <td/>}
                  </tr>
                )}
                {needsRefund && (
                  <tr>
                    <td colSpan={canEditItems ? 4 : 3} className="pt-1 text-right text-sm font-bold text-amber-700">💰 Cần hoàn khách:</td>
                    <td colSpan={2} className="pt-1 text-right font-bold text-amber-700 text-base">{formatPrice(bookingRefund)}</td>
                    {canEditItems && <td/>}
                  </tr>
                )}
              </tfoot>
            </table>
            {needsRefund && (
              <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex gap-3">
                <span className="text-xl shrink-0">💰</span>
                <div className="text-sm text-amber-800">
                  <p className="font-bold">Cần hoàn tiền — {formatPrice(bookingRefund)}</p>
                  <p className="text-xs mt-0.5">Cọc {formatPrice(paidAmount)} · Sau điều chỉnh còn {formatPrice(booking.totalAmount)}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {booking.note && (
          <div className="col-span-2 bg-white rounded-xl border border-gray-100 p-5">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Ghi chú khách</h2>
            <p className="text-sm text-gray-700 whitespace-pre-line">{booking.note}</p>
          </div>
        )}
        {isCancelled && booking.cancelReason && (
          <div className="col-span-2 bg-red-50 rounded-xl border border-red-200 p-5">
            <h2 className="text-xs font-bold text-red-700 uppercase tracking-wide mb-2">Lý do hủy</h2>
            <p className="text-sm text-red-700">{booking.cancelReason}</p>
          </div>
        )}
        {booking.stockWarning && (
          <div className="col-span-2 bg-amber-50 rounded-xl border border-amber-200 p-5">
            <h2 className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-2">⚠ Cảnh báo kho</h2>
            <p className="text-sm text-amber-800">{booking.stockWarning}</p>
          </div>
        )}
        {isPending && booking.paymentMethod === "BANK_TRANSFER" && booking.paymentInfo && (
          <div className="col-span-2 bg-white rounded-xl border border-gray-100 p-5 flex flex-col items-center">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-4">QR Chuyển khoản</h2>
            <img src={booking.paymentInfo.vietQrUrl} alt="VietQR" className="w-52 h-52 object-contain mb-4"/>
            <dl className="space-y-1.5 text-sm text-center">
              <div><span className="text-gray-400">Ngân hàng: </span><span className="font-medium">{booking.paymentInfo.bankName}</span></div>
              <div><span className="text-gray-400">STK: </span><span className="font-mono font-bold">{booking.paymentInfo.accountNumber}</span></div>
              <div><span className="text-gray-400">Nội dung: </span><span className="font-mono font-bold text-primary">{booking.paymentInfo.transferContent}</span></div>
              <div><span className="text-gray-400">Số tiền: </span><span className="font-bold text-primary">{formatPrice(booking.paymentInfo.amount)}</span></div>
            </dl>
          </div>
        )}

        {/* Desktop actions */}
        <div className="col-span-2 bg-white rounded-xl border border-gray-100 p-5">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-4">Thao tác</h2>
          <div className="flex flex-wrap gap-2">
            {isPending && booking.paymentMethod === "BANK_TRANSFER" && (
              <button onClick={() => doAction("confirm", "PATCH", "Đã xác nhận")} disabled={actionLoading}
                className="px-4 py-2 bg-blue-500 text-white text-sm font-semibold rounded-xl hover:bg-blue-600 disabled:opacity-50">
                ✅ Xác nhận (Chuyển khoản)
              </button>
            )}
            {isPending && booking.paymentMethod === "CASH" && (
              <button onClick={() => doAction("confirm-cash", "PATCH", "Đã xác nhận")} disabled={actionLoading}
                className="px-4 py-2 bg-green-500 text-white text-sm font-semibold rounded-xl hover:bg-green-600 disabled:opacity-50">
                💵 Xác nhận — Thu tiền mặt khi đến
              </button>
            )}
            {isConfirmed && (
              <>
                <button onClick={() => doAction("complete", "PATCH", "Hoàn thành")} disabled={actionLoading}
                  className="px-4 py-2 bg-indigo-500 text-white text-sm font-semibold rounded-xl hover:bg-indigo-600 disabled:opacity-50">
                  Hoàn thành
                </button>
                <button onClick={openTableModal} disabled={actionLoading}
                  className="px-4 py-2 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary-dark disabled:opacity-50">
                  Chuyển sang Order
                </button>
              </>
            )}
            {(isPending || isConfirmed) && (
              <button onClick={() => { if (confirm("Hủy booking này?")) doAction("cancel", "PATCH", "Đã hủy"); }}
                disabled={actionLoading}
                className="px-4 py-2 bg-red-50 text-red-500 text-sm font-semibold rounded-xl border border-red-200 disabled:opacity-50">
                Hủy booking
              </button>
            )}
            <button onClick={() => router.back()} className="px-4 py-2 bg-gray-100 text-gray-600 text-sm font-semibold rounded-xl">← Đóng</button>
          </div>
          {actionLoading && <p className="text-xs text-gray-400 mt-2 animate-pulse">Đang xử lý...</p>}
        </div>
      </div>

      {/* ── Mobile sticky action bar ── */}
      {hasActions && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-100 px-3 py-3 flex gap-2">
          {isPending && booking.paymentMethod === "BANK_TRANSFER" && (
            <button onClick={() => doAction("confirm", "PATCH", "Đã xác nhận")} disabled={actionLoading}
              className="flex-1 py-3 bg-blue-500 text-white text-sm font-bold rounded-xl disabled:opacity-50 touch-manipulation">
              ✅ Xác nhận CK
            </button>
          )}
          {isPending && booking.paymentMethod === "CASH" && (
            <button onClick={() => doAction("confirm-cash", "PATCH", "Đã xác nhận")} disabled={actionLoading}
              className="flex-1 py-3 bg-green-500 text-white text-sm font-bold rounded-xl disabled:opacity-50 touch-manipulation">
              💵 Xác nhận Cash
            </button>
          )}
          {isConfirmed && (
            <>
              <button onClick={() => doAction("complete", "PATCH", "Hoàn thành")} disabled={actionLoading}
                className="flex-1 py-3 bg-indigo-500 text-white text-sm font-bold rounded-xl disabled:opacity-50 touch-manipulation">
                Hoàn thành
              </button>
              <button onClick={openTableModal} disabled={actionLoading}
                className="flex-1 py-3 bg-primary text-white text-sm font-bold rounded-xl disabled:opacity-50 touch-manipulation">
                → Order
              </button>
            </>
          )}
          {(isPending || isConfirmed) && (
            <button onClick={() => { if (confirm("Hủy booking này?")) doAction("cancel", "PATCH", "Đã hủy"); }}
              disabled={actionLoading}
              className="py-3 px-4 bg-red-50 text-red-500 text-sm font-bold rounded-xl border border-red-200 disabled:opacity-50 touch-manipulation">
              Hủy
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function RowItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-start gap-4">
      <dt className="text-gray-400 shrink-0 text-sm">{label}</dt>
      <dd className="text-right text-sm">{value}</dd>
    </div>
  );
}
