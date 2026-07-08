"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { getAuthHeaders } from "@/lib/auth";
import { formatPrice, extractApiError } from "@/lib/utils";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api/v1";

const STATUS_STYLE: Record<string, string> = {
  PENDING:   "bg-amber-100 text-amber-700",
  COMPLETED: "bg-green-100 text-green-700",
};
const METHOD_LABELS: Record<string, { label: string; icon: string }> = {
  CASH:          { label: "Tiền mặt",     icon: "💵" },
  BANK_TRANSFER: { label: "Chuyển khoản", icon: "📱" },
  CARD:          { label: "Thẻ / POS",    icon: "💳" },
};

interface Payment {
  id: number; orderId: number; paymentMethod: string; status: string;
  amount: number; createdAt: string; paidAt?: string; vietQrUrl?: string;
  paidBy?: string; tableName?: string; tableNumber?: number;
  referenceCode?: string; note?: string;
}
interface OrderItem {
  id: number; productName: string; quantity: number; saleUnit: string;
  productPrice: number; itemTotal: number;
}
interface OrderDetail {
  id: number; tableId: number; tableName?: string; tableNumber?: number;
  status: string; totalAmount: number; prepaidAmount: number;
  createdBy: string; note?: string; items: OrderItem[];
}
interface PaymentDetail {
  id: number; orderId: number; paymentMethod: string; status: string;
  amount: number; createdAt: string; paidAt?: string; vietQrUrl?: string;
  paidBy?: string; referenceCode?: string; note?: string;
  tableName?: string; tableNumber?: number;
}

// ── Detail Drawer ─────────────────────────────────────────────────────────────
function DetailDrawer({
  paymentId, onClose, onConfirm, onChangeMethod, actionLoading, changingMethod,
}: {
  paymentId: number; onClose: () => void;
  onConfirm: (id: number) => void;
  onChangeMethod: (id: number, method: string) => void;
  actionLoading: number | null; changingMethod: number | null;
}) {
  const [loading, setLoading] = useState(true);
  const [order,   setOrder]   = useState<OrderDetail | null>(null);
  const [payment, setPayment] = useState<PaymentDetail | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setOrder(null); setPayment(null);
      try {
        const payRes = await fetch(`${BASE}/payments/${paymentId}`, { headers: getAuthHeaders() });
        const pJ = await payRes.json();
        if (pJ.statusCode === 200) {
          const p: PaymentDetail = pJ.data;
          setPayment(p);
          const orderRes = await fetch(`${BASE}/orders/${p.orderId}`, { headers: getAuthHeaders() });
          const oJ = await orderRes.json();
          if (oJ.statusCode === 200) setOrder(oJ.data);
        }
      } catch { /* ignore */ }
      finally { setLoading(false); }
    })();
  }, [paymentId]);

  function fmt(iso?: string) {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("vi-VN", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" });
  }

  const remaining = order ? Math.max(0, order.totalAmount - order.prepaidAmount) : 0;
  const mInfo = payment ? METHOD_LABELS[payment.paymentMethod] : null;

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      {/* Full-width on mobile, 448px panel on desktop */}
      <div className="fixed right-0 top-0 h-full w-full sm:max-w-md bg-white z-50 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-100 bg-white">
          <div>
            <h2 className="font-bold text-gray-900 text-base">Chi tiết #{paymentId}</h2>
            {payment && (
              <p className="text-xs text-gray-400 mt-0.5">
                {payment.tableName ?? (payment.tableNumber ? `Bàn ${payment.tableNumber}` : "—")}
                {" · "}Đơn #{payment.orderId}
              </p>
            )}
          </div>
          <button onClick={onClose}
            className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center text-gray-500 text-xl leading-none touch-manipulation"
            style={{ WebkitTapHighlightColor: "transparent" }}>
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !payment ? (
            <div className="text-center text-gray-400 py-10 text-sm">Không tìm thấy giao dịch</div>
          ) : (
            <>
              {/* Payment info */}
              <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${STATUS_STYLE[payment.status] ?? "bg-gray-100 text-gray-600"}`}>
                    {payment.status === "PENDING" ? "Chờ xác nhận" : "Hoàn thành"}
                  </span>
                  <span className="text-xl font-black text-gray-900">{formatPrice(payment.amount)}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-gray-500">Phương thức</div>
                  <div className="text-right font-medium text-gray-800">{mInfo?.icon} {mInfo?.label ?? payment.paymentMethod}</div>
                  <div className="text-gray-500">Tạo lúc</div>
                  <div className="text-right text-gray-700">{fmt(payment.createdAt)}</div>
                  {payment.paidAt && (
                    <>
                      <div className="text-gray-500">Thanh toán lúc</div>
                      <div className="text-right text-green-600 font-medium">{fmt(payment.paidAt)}</div>
                    </>
                  )}
                  {payment.paidBy && (
                    <>
                      <div className="text-gray-500">Xác nhận bởi</div>
                      <div className="text-right text-gray-700">{payment.paidBy}</div>
                    </>
                  )}
                  {payment.referenceCode && (
                    <>
                      <div className="text-gray-500">Mã tham chiếu</div>
                      <div className="text-right font-mono text-xs text-gray-600 break-all">{payment.referenceCode}</div>
                    </>
                  )}
                  {payment.note && (
                    <>
                      <div className="text-gray-500">Ghi chú</div>
                      <div className="text-right text-gray-600 text-xs">{payment.note}</div>
                    </>
                  )}
                </div>
              </div>

              {/* VietQR */}
              {payment.status === "PENDING" && payment.paymentMethod === "BANK_TRANSFER" && payment.vietQrUrl && (
                <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 text-center">
                  <p className="text-xs text-blue-600 mb-3 font-medium">Mã QR chuyển khoản</p>
                  <img src={payment.vietQrUrl} alt="VietQR"
                    className="w-48 h-48 mx-auto object-contain border-2 border-blue-100 rounded-xl p-1 bg-white" />
                </div>
              )}

              {/* Order items */}
              {order && (
                <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-gray-700">Đơn #{order.id}</h3>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                        order.status === "PAID" ? "bg-green-100 text-green-700"
                        : order.status === "CANCELLED" ? "bg-red-100 text-red-600"
                        : "bg-orange-100 text-orange-600"
                      }`}>
                        {order.status === "PAID" ? "Đã TT" : order.status === "CANCELLED" ? "Đã hủy" : "Đang mở"}
                      </span>
                      <Link href={`/admin/don-hang/${order.id}`}
                        className="text-xs text-primary hover:underline">Mở đơn →</Link>
                    </div>
                  </div>
                  <div className="divide-y divide-gray-50 max-h-52 overflow-y-auto">
                    {order.items.length === 0 ? (
                      <div className="text-center py-6 text-gray-400 text-sm">Không có món</div>
                    ) : order.items.map(item => (
                      <div key={item.id} className="flex items-center gap-3 px-4 py-2.5">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-gray-800 truncate">{item.productName}</div>
                          <div className="text-xs text-gray-400">{formatPrice(item.productPrice)}/{item.saleUnit}</div>
                        </div>
                        <div className="text-xs text-gray-500">×{item.quantity}</div>
                        <div className="text-sm font-semibold text-gray-900 w-24 text-right">{formatPrice(item.itemTotal)}</div>
                      </div>
                    ))}
                  </div>
                  <div className="bg-gray-50 px-4 py-3 space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Tổng cộng</span>
                      <span className="font-bold text-gray-900">{formatPrice(order.totalAmount)}</span>
                    </div>
                    {order.prepaidAmount > 0 && (
                      <>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-400">Đã cọc</span>
                          <span className="text-green-600">− {formatPrice(order.prepaidAmount)}</span>
                        </div>
                        <div className="flex justify-between text-sm pt-1 border-t border-gray-200">
                          <span className="font-semibold text-gray-700">Còn lại</span>
                          <span className="font-bold text-primary">{formatPrice(remaining)}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Actions */}
              {payment.status === "PENDING" && (
                <div className="space-y-2">
                  <button
                    onClick={() => onConfirm(payment.id)}
                    disabled={actionLoading === payment.id || changingMethod === payment.id}
                    className={`w-full py-3.5 text-white font-bold rounded-xl disabled:opacity-60 transition-colors text-sm touch-manipulation ${
                      payment.paymentMethod === "CASH" ? "bg-green-500 hover:bg-green-600" : "bg-blue-500 hover:bg-blue-600"
                    }`}
                    style={{ WebkitTapHighlightColor: "transparent" }}>
                    {actionLoading === payment.id ? "Đang xác nhận..." : payment.paymentMethod === "CASH"
                      ? `✓ Xác nhận thu ${formatPrice(payment.amount)}`
                      : "✓ Xác nhận thủ công đã nhận"}
                  </button>
                  <div className="grid grid-cols-2 gap-2">
                    {["CASH", "BANK_TRANSFER"].filter(m => m !== payment.paymentMethod).map(m => (
                      <button key={m}
                        onClick={() => onChangeMethod(payment.id, m)}
                        disabled={changingMethod === payment.id || actionLoading === payment.id}
                        className="py-2.5 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:border-primary/50 hover:text-primary disabled:opacity-50 transition-colors touch-manipulation"
                        style={{ WebkitTapHighlightColor: "transparent" }}>
                        {changingMethod === payment.id ? "..." : `→ ${METHOD_LABELS[m]?.label ?? m}`}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {payment.status === "COMPLETED" && (
                <div className="flex items-center justify-center gap-2 py-3 bg-green-50 rounded-xl border border-green-100 text-green-700 font-semibold text-sm">
                  <span>✓</span> Giao dịch hoàn thành
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AdminPaymentsPage() {
  const [payments,       setPayments]      = useState<Payment[]>([]);
  const [loading,        setLoading]       = useState(true);
  const [refreshing,     setRefreshing]    = useState(false);
  const [page,           setPage]          = useState(0);
  const [totalPages,     setTotalPages]    = useState(0);
  const [totalElements,  setTotalElements] = useState(0);
  const [statusFilter,   setStatusFilter]  = useState("");
  const [methodFilter,   setMethodFilter]  = useState("");
  const [hideExpiredBT,  setHideExpiredBT] = useState(true);
  const [actionLoading,  setActionLoading] = useState<number | null>(null);
  const [changingMethod, setChangingMethod]= useState<number | null>(null);
  const [toast,          setToast]         = useState<{ msg: string; ok: boolean } | null>(null);
  const [drawerPaymentId, setDrawerPaymentId] = useState<number | null>(null);
  const savedScroll = useRef(0);

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }

  const load = useCallback(async (p = page, preserveScroll = false) => {
    if (preserveScroll) {
      // Lưu scroll position trước khi reload
      const el = document.getElementById("admin-scroll-content");
      savedScroll.current = el ? el.scrollTop : window.scrollY;
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const params = new URLSearchParams({ page: String(p), size: "15" });
      if (statusFilter) params.set("status", statusFilter);
      if (methodFilter) params.set("method", methodFilter);
      const res  = await fetch(`${BASE}/payments?${params}`, { headers: getAuthHeaders() });
      const json = await res.json();
      if (json.statusCode === 200) {
        setPayments(json.data.content ?? []);
        setTotalPages(json.data.totalPages ?? 0);
        setTotalElements(json.data.totalElements ?? 0);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
      if (preserveScroll) {
        // Khôi phục scroll sau khi React render xong
        setTimeout(() => {
          const el = document.getElementById("admin-scroll-content");
          if (el) el.scrollTop = savedScroll.current;
          else window.scrollTo(0, savedScroll.current);
        }, 30);
      }
    }
  }, [page, statusFilter, methodFilter]);

  useEffect(() => { load(); }, [load]);

  async function confirmCash(id: number) {
    setActionLoading(id);
    try {
      const res  = await fetch(`${BASE}/payments/${id}/confirm`, { method: "PATCH", headers: getAuthHeaders() });
      const json = await res.json();
      if (json.statusCode === 200) {
        showToast("Đã xác nhận thanh toán ✓");
        load(page, true);
        if (drawerPaymentId === id) setDrawerPaymentId(null);
      } else {
        showToast(extractApiError(json, "Xác nhận thất bại"), false);
      }
    } finally { setActionLoading(null); }
  }

  async function changeMethod(id: number, newMethod: string) {
    setChangingMethod(id);
    try {
      const res = await fetch(`${BASE}/payments/${id}/change-method`, {
        method: "PATCH", headers: getAuthHeaders(),
        body: JSON.stringify({ newMethod }),
      });
      const json = await res.json();
      if (json.statusCode === 200) {
        showToast(`Đã đổi sang ${METHOD_LABELS[newMethod]?.label ?? newMethod} ✓`);
        load(page, true);
        if (drawerPaymentId === id) { setDrawerPaymentId(null); setTimeout(() => setDrawerPaymentId(id), 50); }
      } else {
        showToast(extractApiError(json, "Đổi phương thức thất bại"), false);
      }
    } finally { setChangingMethod(null); }
  }

  function fmtShort(iso?: string) {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  }
  function fmtFull(iso?: string) {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  const EXPIRE_MS = 30 * 60 * 1000;
  const displayedPayments = hideExpiredBT
    ? payments.filter(p => {
        if (p.status === "PENDING" && p.paymentMethod === "BANK_TRANSFER")
          return Date.now() - new Date(p.createdAt).getTime() < EXPIRE_MS;
        return true;
      })
    : payments;

  const statusOptions = [
    { value: "", label: "Tất cả" },
    { value: "PENDING", label: "Chờ xác nhận" },
    { value: "COMPLETED", label: "Hoàn thành" },
  ];
  const methodOptions = [
    { value: "", label: "Mọi phương thức" },
    { value: "CASH", label: "💵 Tiền mặt" },
    { value: "BANK_TRANSFER", label: "📱 Chuyển khoản" },
  ];

  return (
    <div className="p-3 md:p-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-16 left-1/2 -translate-x-1/2 md:top-4 md:right-4 md:left-auto md:translate-x-0 z-[60] text-sm px-4 py-2.5 rounded-xl shadow-lg text-white font-semibold whitespace-nowrap
          ${toast.ok ? "bg-green-600" : "bg-red-500"}`}>
          {toast.msg}
        </div>
      )}

      {/* Drawer */}
      {drawerPaymentId !== null && (
        <DetailDrawer
          paymentId={drawerPaymentId}
          onClose={() => setDrawerPaymentId(null)}
          onConfirm={confirmCash}
          onChangeMethod={changeMethod}
          actionLoading={actionLoading}
          changingMethod={changingMethod}
        />
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-lg md:text-xl font-bold text-ink">Quản lý Thanh toán</h1>
          <p className="text-xs md:text-sm text-muted mt-0.5">
            {!loading && `${totalElements} giao dịch`}
          </p>
        </div>
        <Link href="/admin/thanh-toan/doanh-thu"
          className="px-3 py-1.5 md:px-4 md:py-2 bg-primary/10 text-primary text-xs md:text-sm font-semibold rounded-xl hover:bg-primary/20 transition-colors whitespace-nowrap">
          Doanh thu →
        </Link>
      </div>

      {/* Filters — horizontal scroll on mobile */}
      <div className="overflow-x-auto -mx-3 px-3 md:mx-0 md:px-0 mb-4 pb-1">
        <div className="flex items-center gap-1.5 min-w-max md:flex-wrap md:min-w-0 md:gap-2">
          {statusOptions.map(({ value, label }) => (
            <button key={value}
              onClick={() => { setPage(0); setStatusFilter(value); }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors whitespace-nowrap touch-manipulation ${
                statusFilter === value
                  ? "bg-primary text-white border-primary"
                  : "bg-canvas text-muted border-hairline"
              }`}
              style={{ WebkitTapHighlightColor: "transparent" }}>
              {label}
            </button>
          ))}

          <div className="w-px h-5 bg-hairline mx-0.5 flex-shrink-0" />

          {methodOptions.map(({ value, label }) => (
            <button key={value}
              onClick={() => { setPage(0); setMethodFilter(value); }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors whitespace-nowrap touch-manipulation ${
                methodFilter === value
                  ? "bg-ink text-canvas border-ink"
                  : "bg-canvas text-muted border-hairline"
              }`}
              style={{ WebkitTapHighlightColor: "transparent" }}>
              {label}
            </button>
          ))}

          {(statusFilter || methodFilter) && (
            <button onClick={() => { setPage(0); setStatusFilter(""); setMethodFilter(""); }}
              className="px-2.5 py-1.5 text-xs text-primary underline whitespace-nowrap touch-manipulation"
              style={{ WebkitTapHighlightColor: "transparent" }}>
              Xóa lọc
            </button>
          )}

          <div className="w-px h-5 bg-hairline mx-0.5 flex-shrink-0" />

          <button onClick={() => setHideExpiredBT(v => !v)}
            className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded-full border transition-colors whitespace-nowrap touch-manipulation ${
              hideExpiredBT
                ? "bg-canvas text-muted border-hairline"
                : "bg-amber-100 text-amber-700 border-amber-200"
            }`}
            style={{ WebkitTapHighlightColor: "transparent" }}>
            {hideExpiredBT ? "Ẩn CK hết hạn" : "Hiện CK hết hạn"}
          </button>
        </div>
      </div>

      {/* ── Mobile: Card List ── */}
      <div className="block md:hidden space-y-2.5">
        {/* Thanh refresh mỏng — chỉ hiện khi reload giữ data cũ */}
        {refreshing && (
          <div className="h-0.5 bg-hairline rounded-full overflow-hidden -mx-3">
            <div className="h-full bg-primary rounded-full animate-pulse w-1/2 mx-auto" />
          </div>
        )}
        {loading && !refreshing ? (
          <div className="py-12 text-center text-muted-soft text-sm animate-pulse">Đang tải...</div>
        ) : displayedPayments.length === 0 ? (
          <div className="py-12 text-center text-muted-soft text-sm">
            {hideExpiredBT && payments.length > 0
              ? "Không có giao dịch cần xử lý"
              : "Không có giao dịch nào"}
          </div>
        ) : displayedPayments.map(p => {
          const mInfo = METHOD_LABELS[p.paymentMethod];
          const isSelected = drawerPaymentId === p.id;
          return (
            <div key={p.id}
              onClick={() => setDrawerPaymentId(p.id)}
              className={`rounded-2xl border p-4 cursor-pointer transition-all touch-manipulation ${
                isSelected ? "bg-primary/5 border-primary/30" : "bg-white border-hairline"
              }`}
              style={{ WebkitTapHighlightColor: "transparent" }}>
              {/* Row 1: method + status badge */}
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-base">{mInfo?.icon}</span>
                  <span className="text-sm font-medium text-muted">{mInfo?.label ?? p.paymentMethod}</span>
                  <span className="text-xs text-muted-soft">· #{p.id}</span>
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${STATUS_STYLE[p.status] ?? "bg-canvas text-muted"}`}>
                  {p.status === "PENDING" ? "Chờ xác nhận" : "Hoàn thành"}
                </span>
              </div>

              {/* Row 2: table/order + amount */}
              <div className="flex items-end justify-between mb-3">
                <div>
                  <div className="text-sm font-semibold text-ink">
                    {p.tableName ?? (p.tableNumber ? `Bàn ${p.tableNumber}` : "—")}
                  </div>
                  <div className="text-xs text-muted-soft">Đơn #{p.orderId}</div>
                </div>
                <div className="text-xl font-black text-ink">{formatPrice(p.amount)}</div>
              </div>

              {/* Row 3: time + action buttons */}
              <div className="flex items-center justify-between pt-2.5 border-t border-hairline" onClick={e => e.stopPropagation()}>
                <span className="text-xs text-muted-soft">{fmtShort(p.createdAt)}</span>
                <div className="flex items-center gap-2">
                  {p.status === "PENDING" && (p.paymentMethod === "CASH" || p.paymentMethod === "BANK_TRANSFER") && (
                    <button
                      onClick={() => confirmCash(p.id)}
                      disabled={actionLoading === p.id}
                      onPointerDown={e => { if (e.pointerType === "touch") { e.preventDefault(); confirmCash(p.id); } }}
                      className={`px-3 py-1.5 text-white text-xs font-bold rounded-xl disabled:opacity-50 transition-colors touch-manipulation ${
                        p.paymentMethod === "CASH" ? "bg-green-500" : "bg-blue-500"
                      }`}
                      style={{ WebkitTapHighlightColor: "transparent" }}>
                      {actionLoading === p.id ? "..." : "✓ Xác nhận"}
                    </button>
                  )}
                  <button
                    onClick={() => setDrawerPaymentId(p.id)}
                    onPointerDown={e => { if (e.pointerType === "touch") { e.preventDefault(); setDrawerPaymentId(p.id); } }}
                    className="px-3 py-1.5 bg-surface-card text-ink text-xs font-semibold rounded-xl touch-manipulation"
                    style={{ WebkitTapHighlightColor: "transparent" }}>
                    Chi tiết →
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {/* Pagination mobile */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 pt-2 pb-4">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              className="px-5 py-2.5 text-sm border border-hairline rounded-xl disabled:opacity-40 bg-white touch-manipulation"
              style={{ WebkitTapHighlightColor: "transparent" }}>
              ←
            </button>
            <span className="text-sm text-muted">{page + 1} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
              className="px-5 py-2.5 text-sm border border-hairline rounded-xl disabled:opacity-40 bg-white touch-manipulation"
              style={{ WebkitTapHighlightColor: "transparent" }}>
              →
            </button>
          </div>
        )}
      </div>

      {/* ── Desktop: Table ── */}
      <div className={`hidden md:block bg-canvas rounded-xl border border-hairline overflow-hidden transition-opacity ${refreshing ? "opacity-70" : ""}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-soft border-b border-hairline text-xs text-muted uppercase tracking-wide">
                <th className="text-left px-4 py-3 font-semibold">ID</th>
                <th className="text-left px-4 py-3 font-semibold">Bàn / Đơn</th>
                <th className="text-left px-4 py-3 font-semibold">Phương thức</th>
                <th className="text-right px-4 py-3 font-semibold">Số tiền</th>
                <th className="text-left px-4 py-3 font-semibold">Thời gian</th>
                <th className="text-center px-4 py-3 font-semibold">Trạng thái</th>
                <th className="text-center px-4 py-3 font-semibold">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {loading && !refreshing ? (
                <tr><td colSpan={7} className="text-center py-10 text-muted-soft animate-pulse">Đang tải...</td></tr>
              ) : displayedPayments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-muted-soft">
                    {hideExpiredBT && payments.length > 0
                      ? "Không có giao dịch cần xử lý — các CK hết hạn đã bị ẩn"
                      : "Không có giao dịch nào"}
                  </td>
                </tr>
              ) : displayedPayments.map(p => {
                const mInfo = METHOD_LABELS[p.paymentMethod];
                const isSelected = drawerPaymentId === p.id;
                return (
                  <tr key={p.id}
                    className={`transition-colors cursor-pointer ${isSelected ? "bg-primary/5" : "hover:bg-surface-soft"}`}
                    onClick={() => setDrawerPaymentId(p.id)}>
                    <td className="px-4 py-3 font-bold text-primary">#{p.id}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-ink">{p.tableName ?? (p.tableNumber ? `Bàn ${p.tableNumber}` : "—")}</div>
                      <span className="text-xs text-muted-soft">Đơn #{p.orderId}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5 text-muted">
                        <span>{mInfo?.icon}</span>
                        <span>{mInfo?.label ?? p.paymentMethod}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-ink">{formatPrice(p.amount)}</td>
                    <td className="px-4 py-3 text-muted-soft text-xs whitespace-nowrap">
                      <div>{fmtFull(p.createdAt)}</div>
                      {p.paidAt && p.status === "COMPLETED" && <div className="text-green-600">✓ {fmtFull(p.paidAt)}</div>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLE[p.status] ?? "bg-canvas text-muted"}`}>
                        {p.status === "PENDING" ? "Chờ xác nhận" : "Hoàn thành"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                      <div className="flex flex-col items-center gap-1.5">
                        {p.status === "PENDING" && (p.paymentMethod === "CASH" || p.paymentMethod === "BANK_TRANSFER") && (
                          <button
                            onClick={() => confirmCash(p.id)}
                            disabled={actionLoading === p.id || changingMethod === p.id}
                            className={`px-3 py-1 text-white text-xs font-semibold rounded-lg disabled:opacity-50 transition-colors whitespace-nowrap ${
                              p.paymentMethod === "CASH" ? "bg-green-500 hover:bg-green-600" : "bg-blue-500 hover:bg-blue-600"
                            }`}>
                            {actionLoading === p.id ? "..." : "✓ Xác nhận"}
                          </button>
                        )}
                        <button
                          onClick={() => setDrawerPaymentId(p.id)}
                          className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                            isSelected ? "bg-primary/10 text-primary" : "bg-gray-100 hover:bg-gray-200 text-gray-600"
                          }`}>
                          {isSelected ? "Đang xem" : "Chi tiết →"}
                        </button>
                        {p.status === "COMPLETED" && p.paidBy && (
                          <span className="text-xs text-muted-soft">bởi {p.paidBy}</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination desktop */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 p-4 border-t border-hairline bg-surface-soft">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              className="px-3 py-1.5 text-sm border border-hairline rounded-lg disabled:opacity-40 hover:bg-canvas transition-colors">
              ← Trước
            </button>
            <span className="text-sm text-muted">Trang {page + 1} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
              className="px-3 py-1.5 text-sm border border-hairline rounded-lg disabled:opacity-40 hover:bg-canvas transition-colors">
              Tiếp →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
