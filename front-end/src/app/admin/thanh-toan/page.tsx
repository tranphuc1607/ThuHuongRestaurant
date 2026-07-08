"use client";
import { useState, useEffect, useCallback } from "react";
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
  paymentId, onClose,
  onConfirm, onChangeMethod,
  actionLoading, changingMethod,
}: {
  paymentId: number;
  onClose: () => void;
  onConfirm: (id: number) => void;
  onChangeMethod: (id: number, method: string) => void;
  actionLoading: number | null;
  changingMethod: number | null;
}) {
  const [loading, setLoading]   = useState(true);
  const [order,   setOrder]     = useState<OrderDetail | null>(null);
  const [payment, setPayment]   = useState<PaymentDetail | null>(null);

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
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/30 z-40 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white z-50 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-gray-900">Chi tiết giao dịch #{paymentId}</h2>
            {payment && (
              <p className="text-xs text-gray-400 mt-0.5">
                {payment.tableName ?? (payment.tableNumber ? `Bàn ${payment.tableNumber}` : "—")}
                {" · "}Đơn #{payment.orderId}
              </p>
            )}
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-500 transition-colors text-lg">
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"/>
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
                  <div className="text-right font-medium text-gray-800">
                    {mInfo?.icon} {mInfo?.label ?? payment.paymentMethod}
                  </div>
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
                    <h3 className="text-sm font-bold text-gray-700">Chi tiết đơn hàng #{order.id}</h3>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                        order.status === "PAID"      ? "bg-green-100 text-green-700"
                      : order.status === "CANCELLED" ? "bg-red-100 text-red-600"
                      : "bg-orange-100 text-orange-600"
                      }`}>
                        {order.status === "PAID" ? "Đã TT" : order.status === "CANCELLED" ? "Đã hủy" : "Đang mở"}
                      </span>
                      <Link href={`/admin/don-hang/${order.id}`}
                        className="text-xs text-indigo-600 hover:underline">
                        Mở đơn →
                      </Link>
                    </div>
                  </div>
                  <div className="divide-y divide-gray-50 max-h-48 overflow-y-auto">
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
                          <span className="font-bold text-indigo-600">{formatPrice(remaining)}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Action buttons for PENDING */}
              {payment.status === "PENDING" && (
                <div className="space-y-2">
                  {/* Confirm */}
                  <button
                    onClick={() => onConfirm(payment.id)}
                    disabled={actionLoading === payment.id || changingMethod === payment.id}
                    className={`w-full py-3 text-white font-bold rounded-xl disabled:opacity-60 transition-colors text-sm ${
                      payment.paymentMethod === "CASH" ? "bg-green-500 hover:bg-green-600" : "bg-blue-500 hover:bg-blue-600"
                    }`}>
                    {actionLoading === payment.id ? "Đang xác nhận..." : payment.paymentMethod === "CASH"
                      ? `✓ Xác nhận thu ${formatPrice(payment.amount)}`
                      : "✓ Xác nhận thủ công đã nhận"}
                  </button>

                  {/* Change method */}
                  <div className="grid grid-cols-2 gap-2">
                    {["CASH", "BANK_TRANSFER"].filter(m => m !== payment.paymentMethod).map(m => (
                      <button key={m}
                        onClick={() => onChangeMethod(payment.id, m)}
                        disabled={changingMethod === payment.id || actionLoading === payment.id}
                        className="py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-50 transition-colors">
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
  const [payments,      setPayments]      = useState<Payment[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [page,          setPage]          = useState(0);
  const [totalPages,    setTotalPages]    = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [statusFilter,  setStatusFilter]  = useState("");
  const [methodFilter,  setMethodFilter]  = useState("");
  const [hideExpiredBT, setHideExpiredBT] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [changingMethod, setChangingMethod] = useState<number | null>(null);
  const [toast,         setToast]         = useState<{ msg: string; ok: boolean } | null>(null);
  const [drawerPaymentId, setDrawerPaymentId] = useState<number | null>(null);

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }

  const load = useCallback(async (p = page) => {
    setLoading(true);
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
    } finally { setLoading(false); }
  }, [page, statusFilter, methodFilter]);

  useEffect(() => { load(); }, [load]);

  async function confirmCash(id: number) {
    setActionLoading(id);
    try {
      const res  = await fetch(`${BASE}/payments/${id}/confirm`, { method: "PATCH", headers: getAuthHeaders() });
      const json = await res.json();
      if (json.statusCode === 200) {
        showToast("Đã xác nhận thanh toán ✓");
        load();
        if (drawerPaymentId === id) setDrawerPaymentId(null);
      } else {
        showToast(extractApiError(json, "Xác nhận thất bại"), false);
      }
    } finally { setActionLoading(null); }
  }

  async function changeMethod(id: number, newMethod: string) {
    setChangingMethod(id);
    try {
      const res  = await fetch(`${BASE}/payments/${id}/change-method`, {
        method: "PATCH", headers: getAuthHeaders(),
        body: JSON.stringify({ newMethod }),
      });
      const json = await res.json();
      if (json.statusCode === 200) {
        showToast(`Đã đổi sang ${METHOD_LABELS[newMethod]?.label ?? newMethod} ✓`);
        load();
        // Refresh drawer
        if (drawerPaymentId === id) { setDrawerPaymentId(null); setTimeout(() => setDrawerPaymentId(id), 50); }
      } else {
        showToast(extractApiError(json, "Đổi phương thức thất bại"), false);
      }
    } finally { setChangingMethod(null); }
  }

  function fmt(iso?: string) {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  }

  function resetFilters() { setPage(0); setStatusFilter(""); setMethodFilter(""); }

  const EXPIRE_MS = 30 * 60 * 1000;
  const displayedPayments = hideExpiredBT
    ? payments.filter(p => {
        if (p.status === "PENDING" && p.paymentMethod === "BANK_TRANSFER")
          return Date.now() - new Date(p.createdAt).getTime() < EXPIRE_MS;
        return true;
      })
    : payments;

  return (
    <div className="p-6">
      {toast && (
        <div className={`fixed top-4 right-4 z-30 text-sm px-4 py-2.5 rounded-lg shadow-lg text-white
          ${toast.ok ? "bg-green-600" : "bg-red-500"}`}>
          {toast.msg}
        </div>
      )}

      {/* Drawer */}
      {drawerPaymentId !== null && (
        <DetailDrawer
          paymentId={drawerPaymentId}
          onClose={() => setDrawerPaymentId(null)}
          onConfirm={(id) => confirmCash(id)}
          onChangeMethod={(id, m) => changeMethod(id, m)}
          actionLoading={actionLoading}
          changingMethod={changingMethod}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-ink">Quản lý Thanh toán</h1>
          <p className="text-sm text-muted mt-0.5">
            {!loading && `${totalElements} giao dịch`}
          </p>
        </div>
        <Link href="/admin/thanh-toan/doanh-thu"
          className="px-4 py-2 bg-primary/10 text-primary text-sm font-semibold rounded-lg hover:bg-primary/20 transition-colors">
          Báo cáo doanh thu →
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="flex gap-1.5">
          {[
            { value: "",          label: "Tất cả" },
            { value: "PENDING",   label: "Chờ xác nhận" },
            { value: "COMPLETED", label: "Hoàn thành" },
          ].map(({ value, label }) => (
            <button key={value}
              onClick={() => { setPage(0); setStatusFilter(value); }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors ${
                statusFilter === value
                  ? "bg-primary text-white border-primary"
                  : "bg-canvas text-muted border-hairline hover:border-primary/50"
              }`}>
              {label}
            </button>
          ))}
        </div>

        <div className="w-px bg-hairline self-stretch" />

        <div className="flex gap-1.5">
          {[
            { value: "",              label: "Mọi phương thức" },
            { value: "CASH",          label: "💵 Tiền mặt" },
            { value: "BANK_TRANSFER", label: "📱 Chuyển khoản" },
          ].map(({ value, label }) => (
            <button key={value}
              onClick={() => { setPage(0); setMethodFilter(value); }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors ${
                methodFilter === value
                  ? "bg-ink text-canvas border-ink"
                  : "bg-canvas text-muted border-hairline hover:border-ink/30"
              }`}>
              {label}
            </button>
          ))}
        </div>

        {(statusFilter || methodFilter) && (
          <button onClick={resetFilters}
            className="text-xs text-muted-soft hover:text-primary transition-colors underline">
            Xóa bộ lọc
          </button>
        )}

        <button onClick={() => setHideExpiredBT(v => !v)}
          className={`ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full border transition-colors ${
            hideExpiredBT
              ? "bg-canvas text-muted border-hairline"
              : "bg-amber-100 text-amber-700 border-amber-200"
          }`}>
          {hideExpiredBT ? "👁 Ẩn CK hết hạn" : "👁 Đang hiện CK hết hạn"}
        </button>
      </div>

      {/* Table */}
      <div className="bg-canvas rounded-xl border border-hairline overflow-hidden">
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
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-muted-soft animate-pulse">Đang tải...</td>
                </tr>
              ) : displayedPayments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-muted-soft">
                    {hideExpiredBT && payments.length > 0
                      ? "Không có giao dịch cần xử lý — các CK hết hạn đã bị ẩn"
                      : "Không có giao dịch nào"}
                  </td>
                </tr>
              ) : displayedPayments.map((p) => {
                const methodInfo = METHOD_LABELS[p.paymentMethod];
                const isSelected = drawerPaymentId === p.id;
                return (
                  <tr key={p.id}
                    className={`transition-colors cursor-pointer ${isSelected ? "bg-indigo-50" : "hover:bg-surface-soft"}`}
                    onClick={() => setDrawerPaymentId(p.id)}>
                    {/* ID */}
                    <td className="px-4 py-3 font-bold text-primary">#{p.id}</td>

                    {/* Bàn / Đơn */}
                    <td className="px-4 py-3">
                      <div className="font-medium text-ink">
                        {p.tableName ?? (p.tableNumber ? `Bàn ${p.tableNumber}` : "—")}
                      </div>
                      <span className="text-xs text-muted-soft">Đơn #{p.orderId}</span>
                    </td>

                    {/* Phương thức */}
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5 text-muted">
                        <span>{methodInfo?.icon}</span>
                        <span>{methodInfo?.label ?? p.paymentMethod}</span>
                      </span>
                    </td>

                    {/* Số tiền */}
                    <td className="px-4 py-3 text-right font-bold text-ink">
                      {formatPrice(p.amount)}
                    </td>

                    {/* Thời gian */}
                    <td className="px-4 py-3 text-muted-soft text-xs whitespace-nowrap">
                      <div>{fmt(p.createdAt)}</div>
                      {p.paidAt && p.status === "COMPLETED" && (
                        <div className="text-green-600">✓ {fmt(p.paidAt)}</div>
                      )}
                    </td>

                    {/* Trạng thái */}
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLE[p.status] ?? "bg-canvas text-muted"}`}>
                        {p.status === "PENDING" ? "Chờ xác nhận" : "Hoàn thành"}
                      </span>
                    </td>

                    {/* Thao tác */}
                    <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                      <div className="flex flex-col items-center gap-1.5">
                        {/* Quick confirm for PENDING */}
                        {p.status === "PENDING" && (
                          <>
                            {(p.paymentMethod === "CASH" || p.paymentMethod === "BANK_TRANSFER") && (
                              <button
                                onClick={() => confirmCash(p.id)}
                                disabled={actionLoading === p.id || changingMethod === p.id}
                                className={`px-3 py-1 text-white text-xs font-semibold rounded-lg disabled:opacity-50 transition-colors whitespace-nowrap ${
                                  p.paymentMethod === "CASH" ? "bg-green-500 hover:bg-green-600" : "bg-blue-500 hover:bg-blue-600"
                                }`}>
                                {actionLoading === p.id ? "..." : "✓ Xác nhận"}
                              </button>
                            )}
                          </>
                        )}
                        {/* Chi tiết button for all */}
                        <button
                          onClick={() => setDrawerPaymentId(p.id)}
                          className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                            isSelected
                              ? "bg-indigo-100 text-indigo-700"
                              : "bg-gray-100 hover:bg-gray-200 text-gray-600"
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

        {/* Pagination */}
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
