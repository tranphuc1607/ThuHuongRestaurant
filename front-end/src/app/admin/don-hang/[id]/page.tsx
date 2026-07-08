"use client";
import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { getAuthHeaders } from "@/lib/auth";
import { formatPrice, extractApiError } from "@/lib/utils";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api/v1";

interface OrderItem {
  id: number; productId: number; productName: string; quantity: number;
  productPrice: number; itemTotal: number; saleUnit?: string;
}
interface OrderSurcharge {
  id: number; name: string; unitPrice: number; quantity: number; amount: number; reason?: string;
}
interface OrderDetail {
  id: number; tableId?: number; tableName?: string; tableNumber?: number;
  status: string; totalAmount: number; prepaidAmount?: number;
  createdAt: string; createdBy?: string; confirmedBy?: string; paidBy?: string;
  note?: string; guestCount?: number;
  items: OrderItem[];
  surcharges?: OrderSurcharge[];
}
interface PaymentInfo {
  id: number; amount: number; paymentMethod: string; status: string; vietQrUrl?: string; paidBy?: string;
}

const STATUS_LABEL: Record<string, string> = {
  OPEN: "Đang mở", PAID: "Đã TT", CANCELLED: "Đã hủy",
};
const STATUS_PILL: Record<string, string> = {
  OPEN:      "bg-orange-100 text-orange-700",
  PAID:      "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-600",
};

function fmt(iso: string) {
  return new Date(iso).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function fmtShort(iso: string) {
  return new Date(iso).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function OrderDetailPage() {
  const { id } = useParams();
  const router  = useRouter();
  const [order, setOrder]       = useState<OrderDetail | null>(null);
  const [payments, setPayments] = useState<PaymentInfo[]>([]);
  const [loading, setLoading]   = useState(true);
  const [actionLoading, setActionLoading]   = useState(false);
  const [payLoading, setPayLoading]         = useState(false);
  const [refundLoading, setRefundLoading]   = useState(false);
  const [toast, setToast]       = useState({ msg: "", ok: true });
  const [removingItemId, setRemovingItemId] = useState<number | null>(null);
  const [updatingItemId, setUpdatingItemId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const [orderRes, payRes] = await Promise.all([
        fetch(`${BASE}/orders/${id}`, { headers: getAuthHeaders(), cache: "no-store" }),
        fetch(`${BASE}/payments/orders/${id}/all`, { headers: getAuthHeaders(), cache: "no-store" }),
      ]);
      const oj = await orderRes.json();
      const pj = await payRes.json();
      if (oj.statusCode === 200) setOrder(oj.data);
      setPayments(pj.statusCode === 200 ? (pj.data ?? []) : []);
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok }); setTimeout(() => setToast({ msg: "", ok: true }), 3500);
  }

  const refundPayment  = payments.find(p => p.paymentMethod === "REFUND");
  const billingPayment = payments.find(p => p.paymentMethod !== "REFUND");

  const prepaid        = order?.prepaidAmount ?? 0;
  const itemsTotal     = (order?.items ?? []).reduce((s, i) => s + i.itemTotal, 0);
  const surchargesTotal = (order?.surcharges ?? []).reduce((s, sc) => s + sc.amount, 0);
  const refundFromItems = prepaid - itemsTotal;
  const netRefund      = Math.round(prepaid - (order?.totalAmount ?? 0));
  const remaining      = Math.max(0, -netRefund);
  const showRefundBanner = netRefund > 0 && !refundPayment;
  const surchargeOffsetNote = refundFromItems > 0 && surchargesTotal > 0 && netRefund <= 0;
  const isOpen  = order?.status === "OPEN";
  const canEdit = isOpen && !billingPayment;

  async function doAction(endpoint: string, method: string, successMsg: string) {
    setActionLoading(true);
    try {
      const res  = await fetch(`${BASE}/orders/${id}/${endpoint}`, { method, headers: getAuthHeaders() });
      const json = await res.json();
      if (res.ok && json.statusCode === 200) { showToast(successMsg); load(); }
      else showToast(extractApiError(json, "Thất bại"), false);
    } finally { setActionLoading(false); }
  }

  async function updateItemQty(item: OrderItem, newQty: number) {
    if (newQty < 1 || newQty === item.quantity) return;
    const delta = newQty - item.quantity;
    const newTotal = (order?.totalAmount ?? 0) + delta * item.productPrice;
    const newNetRefund = prepaid - newTotal;
    let msg = `Đổi "${item.productName}" từ ${item.quantity} → ${newQty}?`;
    if (prepaid > 0) msg += newNetRefund > 0 ? `\nSau thay đổi: hoàn ${formatPrice(newNetRefund)}` : newNetRefund < 0 ? `\nSau thay đổi: thu thêm ${formatPrice(-newNetRefund)}` : `\nSau thay đổi: hòa`;
    if (!confirm(msg)) return;
    setUpdatingItemId(item.id);
    try {
      const res  = await fetch(`${BASE}/orders/${order!.id}/items/${item.id}`, {
        method: "PATCH", headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ quantity: newQty }),
      });
      const json = await res.json();
      if (res.ok && json.statusCode === 200) { showToast(`Đã cập nhật "${item.productName}"`); load(); }
      else showToast(extractApiError(json, "Không thể cập nhật"), false);
    } finally { setUpdatingItemId(null); }
  }

  async function removeItem(item: OrderItem) {
    const newTotal = (order?.totalAmount ?? 0) - item.itemTotal;
    const newNetRefund = prepaid - newTotal;
    let msg = `Xóa "${item.productName}" (${item.quantity} ${item.saleUnit ?? ""}) khỏi đơn?`;
    if (prepaid > 0) msg += newNetRefund > 0 ? `\nSau xóa: hoàn ${formatPrice(newNetRefund)}` : newNetRefund < 0 ? `\nSau xóa: thu thêm ${formatPrice(-newNetRefund)}` : `\nSau xóa: hòa`;
    if (!confirm(msg)) return;
    setRemovingItemId(item.id);
    try {
      const res  = await fetch(`${BASE}/orders/${order!.id}/items/${item.id}`, { method: "DELETE", headers: getAuthHeaders() });
      const json = await res.json();
      if (res.ok && json.statusCode === 200) { showToast(`Đã xóa "${item.productName}"`); load(); }
      else showToast(extractApiError(json, "Không thể xóa"), false);
    } finally { setRemovingItemId(null); }
  }

  async function processRefund() {
    if (!order) return;
    if (!confirm(`Xác nhận đã hoàn ${formatPrice(netRefund)} cho khách?`)) return;
    setRefundLoading(true);
    try {
      const res  = await fetch(`${BASE}/payments/orders/${order.id}/refund`, {
        method: "POST", headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ amount: netRefund }),
      });
      const json = await res.json();
      if (res.ok && json.statusCode === 200) { showToast(`Đã ghi nhận hoàn ${formatPrice(netRefund)}`); load(); }
      else showToast(extractApiError(json, "Không thể ghi nhận hoàn tiền"), false);
    } finally { setRefundLoading(false); }
  }

  async function createPayment(method: "CASH" | "BANK_TRANSFER") {
    if (!order) return;
    setPayLoading(true);
    try {
      const res  = await fetch(`${BASE}/payments`, {
        method: "POST", headers: getAuthHeaders(),
        body: JSON.stringify({ orderId: order.id, paymentMethod: method }),
      });
      const json = await res.json();
      if (json.statusCode === 200) { load(); showToast(method === "CASH" ? "Đã tạo phiếu tiền mặt" : "Đã tạo QR chuyển khoản"); }
      else showToast(extractApiError(json, "Không tạo được thanh toán"), false);
    } catch { showToast("Không kết nối được máy chủ", false); }
    finally { setPayLoading(false); }
  }

  async function switchMethod(newMethod: "CASH" | "BANK_TRANSFER") {
    if (!billingPayment) return;
    setPayLoading(true);
    try {
      const res  = await fetch(`${BASE}/payments/${billingPayment.id}/change-method`, {
        method: "PATCH", headers: getAuthHeaders(), body: JSON.stringify({ newMethod }),
      });
      const json = await res.json();
      if (json.statusCode === 200) { load(); showToast(`Đã đổi sang ${newMethod === "CASH" ? "tiền mặt" : "chuyển khoản"}`); }
      else showToast(extractApiError(json, "Đổi thất bại"), false);
    } catch { showToast("Không kết nối được máy chủ", false); }
    finally { setPayLoading(false); }
  }

  async function confirmCash() {
    if (!billingPayment) return;
    setPayLoading(true);
    try {
      const res  = await fetch(`${BASE}/payments/${billingPayment.id}/confirm`, { method: "PATCH", headers: getAuthHeaders() });
      const json = await res.json();
      if (json.statusCode === 200) { load(); showToast("Đã xác nhận thanh toán tiền mặt"); }
      else showToast(extractApiError(json, "Xác nhận thất bại"), false);
    } catch { showToast("Không kết nối được máy chủ", false); }
    finally { setPayLoading(false); }
  }

  if (loading) return (
    <div className="flex justify-center items-center min-h-[60vh]">
      <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin"/>
    </div>
  );
  if (!order) return <div className="p-6 text-red-500 text-sm">Không tìm thấy đơn hàng</div>;

  const hasMobileAction = isOpen;

  return (
    <div className={`p-3 md:p-6 max-w-3xl ${hasMobileAction ? "pb-24 md:pb-6" : ""}`}>

      {/* Toast */}
      {toast.msg && (
        <div className={`fixed top-16 md:top-4 right-3 text-xs px-3 py-2 rounded-lg shadow-lg z-50 max-w-[calc(100vw-1.5rem)] ${toast.ok ? "bg-gray-900 text-white" : "bg-red-500 text-white"}`}>
          {toast.msg}
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => router.back()} className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 text-gray-600 text-sm font-bold flex-shrink-0 touch-manipulation">←</button>
        <span className="font-bold text-gray-900 text-sm">Đơn #{order.id}</span>
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold flex-shrink-0 ${STATUS_PILL[order.status] ?? "bg-gray-100 text-gray-500"}`}>
          {STATUS_LABEL[order.status] ?? order.status}
        </span>
        {showRefundBanner && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold flex-shrink-0">💰 Hoàn tiền</span>}
      </div>

      {/* ── MOBILE LAYOUT ── */}
      <div className="md:hidden space-y-3">

        {/* Refund banner */}
        {showRefundBanner && (
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="font-bold text-amber-800 text-sm">💰 Cần hoàn khách: {formatPrice(netRefund)}</p>
            </div>
            <div className="text-xs text-amber-700 space-y-0.5 mb-3">
              <div className="flex justify-between"><span>Tiền cọc ban đầu</span><span className="font-semibold">{formatPrice(prepaid)}</span></div>
              {surchargesTotal > 0 && refundFromItems > 0 && (
                <>
                  <div className="flex justify-between"><span>Hoàn từ hủy/giảm món</span><span className="text-green-700 font-semibold">+{formatPrice(refundFromItems)}</span></div>
                  <div className="flex justify-between"><span>Trừ phụ thu</span><span className="text-red-600 font-semibold">−{formatPrice(surchargesTotal)}</span></div>
                </>
              )}
            </div>
            <button onClick={processRefund} disabled={refundLoading}
              className="w-full py-2.5 bg-amber-600 text-white text-sm font-bold rounded-xl disabled:opacity-50 touch-manipulation">
              {refundLoading ? "Đang xử lý..." : "✓ Xác nhận đã hoàn tiền"}
            </button>
          </div>
        )}

        {/* Đã hoàn banner */}
        {refundPayment && (
          <div className="bg-green-50 border border-green-300 rounded-xl px-4 py-3 flex items-center gap-2">
            <span className="text-green-600 font-bold">✓</span>
            <div>
              <p className="text-sm font-bold text-green-700">Đã hoàn {formatPrice(refundPayment.amount)} cho khách</p>
              {remaining > 0 && <p className="text-xs text-orange-600 font-semibold mt-0.5">Còn thu thêm: {formatPrice(remaining)}</p>}
            </div>
          </div>
        )}

        {/* Quick info card */}
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="bg-gray-50 rounded-lg px-3 py-2">
              <div className="text-[10px] text-gray-400 mb-0.5">Bàn</div>
              <div className="text-xs font-bold text-gray-800">
                {order.tableName ?? (order.tableNumber ? `Bàn ${order.tableNumber}` : "Chưa xếp")}
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg px-3 py-2">
              <div className="text-[10px] text-gray-400 mb-0.5">Số khách</div>
              <div className="text-xs font-bold text-gray-800">{order.guestCount ? `${order.guestCount} người` : "—"}</div>
            </div>
            <div className="bg-gray-50 rounded-lg px-3 py-2">
              <div className="text-[10px] text-gray-400 mb-0.5">Tạo lúc</div>
              <div className="text-xs font-bold text-gray-800">{fmtShort(order.createdAt)}</div>
            </div>
            <div className="bg-gray-50 rounded-lg px-3 py-2">
              <div className="text-[10px] text-gray-400 mb-0.5">Tạo bởi</div>
              <div className="text-xs font-bold text-gray-800 truncate">{order.createdBy ?? "—"}</div>
            </div>
          </div>
          <div className="border-t border-gray-100 pt-2.5 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">Tổng đơn</span>
              <span className="text-sm font-bold text-gray-900">{formatPrice(order.totalAmount)}</span>
            </div>
            {prepaid > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-green-600">Đã cọc</span>
                <span className="text-sm font-semibold text-green-600">− {formatPrice(prepaid)}</span>
              </div>
            )}
            {netRefund > 0 && !refundPayment ? (
              <div className="flex items-center justify-between border-t border-amber-200 pt-1">
                <span className="text-xs font-bold text-amber-700">Hoàn lại khách</span>
                <span className="text-base font-bold text-amber-700">{formatPrice(netRefund)}</span>
              </div>
            ) : (
              <div className="flex items-center justify-between border-t border-gray-100 pt-1">
                <span className="text-xs font-bold text-gray-700">Cần thu</span>
                <span className="text-base font-bold text-primary">{formatPrice(remaining)}</span>
              </div>
            )}
          </div>
          {order.note && <p className="text-xs text-gray-500 mt-2.5 border-t border-gray-100 pt-2.5 italic">"{order.note}"</p>}
        </div>

        {/* Items mobile list */}
        {(order.items ?? []).length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">Danh sách món</span>
              {canEdit && <span className="text-[10px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">Có thể chỉnh sửa</span>}
            </div>
            <div className="divide-y divide-gray-100">
              {(order.items ?? []).map((item) => (
                <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                  <img src={`https://picsum.photos/seed/product-${item.productId}/80/80`}
                    alt={item.productName} className="w-10 h-10 rounded-lg object-cover flex-shrink-0"/>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-800 truncate">{item.productName}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{formatPrice(item.productPrice)} / {item.saleUnit ?? "—"}</div>
                    <div className="flex items-center justify-between mt-1.5">
                      {canEdit ? (
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => updateItemQty(item, item.quantity - 1)}
                            disabled={updatingItemId === item.id || item.quantity <= 1}
                            className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center text-sm font-bold text-gray-600 disabled:opacity-30 touch-manipulation">−</button>
                          <span className="w-5 text-center text-sm font-bold text-gray-900">
                            {updatingItemId === item.id ? <span className="text-gray-300 animate-pulse">…</span> : item.quantity}
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
                        {canEdit && (
                          <button onClick={() => removeItem(item)}
                            disabled={removingItemId === item.id || updatingItemId === item.id}
                            className="w-7 h-7 rounded-full bg-red-50 text-red-400 flex items-center justify-center text-xs font-bold disabled:opacity-30 touch-manipulation">
                            {removingItemId === item.id ? "…" : "✕"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Surcharges mobile */}
            {(order.surcharges ?? []).length > 0 && (
              <div className="border-t border-orange-200 bg-orange-50/50">
                <div className="px-4 py-2 text-xs font-bold text-orange-600 uppercase tracking-wide">⚠️ Phụ thu</div>
                {order.surcharges!.map(sc => (
                  <div key={sc.id} className="px-4 py-2.5 border-t border-orange-100 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-medium text-orange-800">{sc.name}</div>
                      {sc.reason && <div className="text-[10px] text-orange-500">{sc.reason}</div>}
                    </div>
                    <span className="text-sm font-bold text-orange-700">{formatPrice(sc.amount)}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 flex justify-between items-center">
              <span className="text-xs text-gray-500">Tổng hiện tại</span>
              <span className="text-sm font-bold text-gray-900">{formatPrice(order.totalAmount)}</span>
            </div>
          </div>
        )}

        {/* Payment section mobile */}
        {isOpen && (order.items ?? []).length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-3">Thanh toán</div>

            {surchargeOffsetNote && (
              <div className="text-xs bg-blue-50 border border-blue-200 text-blue-700 rounded-lg px-3 py-2 mb-3">
                Phụ thu <b>{formatPrice(surchargesTotal)}</b> bù <b>{formatPrice(refundFromItems)}</b> hoàn từ hủy món →{" "}
                {remaining > 0 ? <>Thu thêm <b>{formatPrice(remaining)}</b></> : "Hòa"}
              </div>
            )}

            {!billingPayment && !refundPayment && netRefund <= 0 && (
              remaining > 0 ? (
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => createPayment("CASH")} disabled={payLoading}
                    className="flex flex-col items-center gap-1 py-3 rounded-xl border-2 border-gray-200 hover:border-green-400 hover:bg-green-50 touch-manipulation">
                    <span className="text-xl">💵</span><span className="text-xs font-semibold">Tiền mặt</span>
                  </button>
                  <button onClick={() => createPayment("BANK_TRANSFER")} disabled={payLoading}
                    className="flex flex-col items-center gap-1 py-3 rounded-xl border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50 touch-manipulation">
                    <span className="text-xl">📱</span><span className="text-xs font-semibold">Chuyển khoản</span>
                  </button>
                </div>
              ) : (
                <p className="text-xs text-green-600 text-center bg-green-50 border border-green-200 rounded-lg px-3 py-2">Tiền cọc đã đủ — không cần thu thêm</p>
              )
            )}

            {!billingPayment && refundPayment && remaining > 0 && (
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => createPayment("CASH")} disabled={payLoading}
                  className="flex flex-col items-center gap-1 py-3 rounded-xl border-2 border-gray-200 touch-manipulation">
                  <span className="text-xl">💵</span><span className="text-xs font-semibold">Tiền mặt</span>
                </button>
                <button onClick={() => createPayment("BANK_TRANSFER")} disabled={payLoading}
                  className="flex flex-col items-center gap-1 py-3 rounded-xl border-2 border-gray-200 touch-manipulation">
                  <span className="text-xl">📱</span><span className="text-xs font-semibold">Chuyển khoản</span>
                </button>
              </div>
            )}

            {billingPayment && billingPayment.status === "PENDING" && (
              <div className="space-y-3">
                <p className="text-xs text-gray-500 text-center">Đang xử lý · {formatPrice(billingPayment.amount)}</p>
                <div className="grid grid-cols-2 gap-1 p-1 bg-gray-100 rounded-xl">
                  <button onClick={() => billingPayment.paymentMethod !== "CASH" && switchMethod("CASH")} disabled={payLoading}
                    className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-bold transition-all touch-manipulation ${billingPayment.paymentMethod === "CASH" ? "bg-white shadow text-green-700 border border-green-200" : "text-gray-500"}`}>
                    💵 Tiền mặt
                  </button>
                  <button onClick={() => billingPayment.paymentMethod !== "BANK_TRANSFER" && switchMethod("BANK_TRANSFER")} disabled={payLoading}
                    className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-bold transition-all touch-manipulation ${billingPayment.paymentMethod === "BANK_TRANSFER" ? "bg-white shadow text-blue-700 border border-blue-200" : "text-gray-500"}`}>
                    📱 Chuyển khoản
                  </button>
                </div>
                {billingPayment.paymentMethod === "BANK_TRANSFER" && billingPayment.vietQrUrl && (
                  <div className="bg-blue-50 rounded-xl p-3 text-center space-y-2">
                    <p className="text-[10px] text-blue-600 font-bold uppercase tracking-widest">Quét mã chuyển khoản</p>
                    <img src={billingPayment.vietQrUrl} alt="VietQR" className="w-36 h-36 mx-auto rounded-lg border border-blue-100" />
                    <p className="text-xs text-blue-500">Tự động xác nhận sau khi nhận tiền</p>
                  </div>
                )}
                {billingPayment.paymentMethod === "CASH" && (
                  <button onClick={confirmCash} disabled={payLoading}
                    className="w-full py-3 bg-green-500 text-white font-bold rounded-xl text-sm disabled:opacity-50 touch-manipulation">
                    {payLoading ? "Đang xử lý..." : `✓ Xác nhận thu ${formatPrice(billingPayment.amount)}`}
                  </button>
                )}
              </div>
            )}

            {billingPayment && billingPayment.status === "COMPLETED" && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                <p className="text-green-700 font-bold">✓ Đã thanh toán</p>
                <p className="text-sm text-green-600 mt-1">
                  {formatPrice(billingPayment.amount)} · {billingPayment.paymentMethod === "CASH" ? "Tiền mặt" : "Chuyển khoản"}
                </p>
              </div>
            )}
          </div>
        )}

        {!isOpen && order.status === "PAID" && (
          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-center">
            <p className="text-sm font-bold text-green-700">{refundPayment ? "✓ Đã hoàn tiền và đóng đơn" : "✓ Đã thanh toán"}</p>
          </div>
        )}
        {order.status === "CANCELLED" && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-center">
            <p className="text-sm font-bold text-red-600">Đơn đã hủy</p>
          </div>
        )}
      </div>

      {/* ── DESKTOP LAYOUT ── */}
      <div className="hidden md:block">
        {showRefundBanner && (
          <div className="mb-5 bg-amber-50 border border-amber-300 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">💰</span>
              <div className="flex-1">
                <p className="font-bold text-amber-800">Cần hoàn tiền cọc cho khách</p>
                <div className="mt-2 space-y-1 text-sm text-amber-700">
                  <div className="flex justify-between"><span>Tiền cọc ban đầu</span><span className="font-semibold">{formatPrice(prepaid)}</span></div>
                  {surchargesTotal > 0 && refundFromItems > 0 && (
                    <>
                      <div className="flex justify-between"><span>Hoàn từ hủy/giảm món</span><span className="text-green-700 font-semibold">+{formatPrice(refundFromItems)}</span></div>
                      <div className="flex justify-between"><span>Trừ phụ thu</span><span className="text-red-600 font-semibold">−{formatPrice(surchargesTotal)}</span></div>
                    </>
                  )}
                </div>
                <div className="mt-2 pt-2 border-t border-amber-300 flex items-center justify-between">
                  <span className="font-bold text-amber-800 text-base">→ Hoàn lại: {formatPrice(netRefund)}</span>
                  <button onClick={processRefund} disabled={refundLoading}
                    className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold rounded-lg disabled:opacity-50">
                    {refundLoading ? "Đang xử lý..." : "✓ Xác nhận đã hoàn"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        {refundPayment && (
          <div className="mb-5 bg-green-50 border border-green-300 rounded-xl p-4 flex items-center gap-3">
            <span className="text-xl">✓</span>
            <div>
              <p className="font-bold text-green-700">Đã hoàn tiền cho khách</p>
              <p className="text-sm text-green-600 mt-0.5">{formatPrice(refundPayment.amount)} · Xác nhận bởi {refundPayment.paidBy ?? "nhân viên"}</p>
              {remaining > 0 && <p className="text-sm text-orange-600 font-semibold mt-1">Khách vẫn cần thanh toán thêm: {formatPrice(remaining)}</p>}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-5">
          {/* Info */}
          <div className="bg-canvas rounded-xl border border-hairline p-5">
            <h2 className="text-xs font-bold text-muted-soft uppercase tracking-widest mb-4">Thông tin</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-muted">Bàn</dt>
                <dd className="font-medium">{order.tableName ?? (order.tableNumber ? `Bàn ${order.tableNumber}` : <span className="text-muted-soft italic">Chưa xếp bàn</span>)}</dd></div>
              {order.guestCount && <div className="flex justify-between"><dt className="text-muted">Số khách</dt><dd>{order.guestCount} người</dd></div>}
              <div className="flex justify-between"><dt className="text-muted">Tạo lúc</dt><dd>{fmt(order.createdAt)}</dd></div>
              {order.createdBy && <div className="flex justify-between"><dt className="text-muted">Tạo bởi</dt><dd>{order.createdBy}</dd></div>}
              {order.note && <div className="flex justify-between gap-4"><dt className="text-muted shrink-0">Ghi chú</dt><dd className="text-right">{order.note}</dd></div>}
              <div className="border-t border-hairline pt-2 space-y-1.5">
                <div className="flex justify-between text-sm"><dt className="text-muted">Tổng đơn</dt><dd className="font-semibold">{formatPrice(order.totalAmount)}</dd></div>
                {prepaid > 0 && <div className="flex justify-between text-sm"><dt className="text-green-600">Đã cọc</dt><dd className="text-green-600 font-semibold">− {formatPrice(prepaid)}</dd></div>}
                {refundPayment && <div className="flex justify-between text-sm"><dt className="text-amber-600">Đã hoàn</dt><dd className="text-amber-600 font-semibold">− {formatPrice(refundPayment.amount)}</dd></div>}
                {netRefund > 0 && !refundPayment ? (
                  <div className="flex justify-between border-t border-amber-200 pt-1.5 font-bold">
                    <dt className="text-amber-700">Hoàn lại khách</dt><dd className="text-amber-700 text-base">{formatPrice(netRefund)}</dd>
                  </div>
                ) : (
                  <div className="flex justify-between border-t border-hairline pt-1.5 font-bold">
                    <dt className="text-ink">Cần thu</dt><dd className="text-primary text-base">{formatPrice(remaining)}</dd>
                  </div>
                )}
              </div>
            </dl>
          </div>

          {/* Payment desktop */}
          <div className="bg-canvas rounded-xl border border-hairline p-5">
            <h2 className="text-xs font-bold text-muted-soft uppercase tracking-widest mb-4">Thanh toán</h2>
            {isOpen && (order.items ?? []).length > 0 ? (
              <div className="space-y-3">
                {surchargeOffsetNote && (
                  <div className="text-xs bg-blue-50 border border-blue-200 text-blue-700 rounded-lg px-3 py-2">
                    Phụ thu <b>{formatPrice(surchargesTotal)}</b> bù <b>{formatPrice(refundFromItems)}</b> hoàn từ hủy món → {remaining > 0 ? <>Thu thêm <b>{formatPrice(remaining)}</b></> : "Hòa"}
                  </div>
                )}
                {!billingPayment && !refundPayment && netRefund <= 0 && (
                  <div className="space-y-2">
                    {remaining > 0 ? <p className="text-xs text-muted text-center">Chọn phương thức thanh toán</p>
                      : <p className="text-xs text-green-600 text-center bg-green-50 border border-green-200 rounded-lg px-3 py-2">Tiền cọc đã đủ — không cần thu thêm</p>}
                    {remaining > 0 && (
                      <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => createPayment("CASH")} disabled={payLoading}
                          className="flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 border-hairline hover:border-green-400 hover:bg-green-50 transition-all disabled:opacity-50">
                          <span className="text-xl">💵</span><span className="text-sm font-semibold">Tiền mặt</span>
                        </button>
                        <button onClick={() => createPayment("BANK_TRANSFER")} disabled={payLoading}
                          className="flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 border-hairline hover:border-blue-400 hover:bg-blue-50 transition-all disabled:opacity-50">
                          <span className="text-xl">📱</span><span className="text-sm font-semibold">Chuyển khoản</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
                {!billingPayment && refundPayment && remaining > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => createPayment("CASH")} disabled={payLoading}
                      className="flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 border-hairline hover:border-green-400 hover:bg-green-50 transition-all disabled:opacity-50">
                      <span className="text-xl">💵</span><span className="text-sm font-semibold">Tiền mặt</span>
                    </button>
                    <button onClick={() => createPayment("BANK_TRANSFER")} disabled={payLoading}
                      className="flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 border-hairline hover:border-blue-400 hover:bg-blue-50 transition-all disabled:opacity-50">
                      <span className="text-xl">📱</span><span className="text-sm font-semibold">Chuyển khoản</span>
                    </button>
                  </div>
                )}
                {billingPayment && billingPayment.status === "PENDING" && (
                  <div className="space-y-3">
                    <p className="text-xs text-muted">Đang xử lý · {formatPrice(billingPayment.amount)}</p>
                    <div className="grid grid-cols-2 gap-1 p-1 bg-surface-soft rounded-xl">
                      <button onClick={() => billingPayment.paymentMethod !== "CASH" && switchMethod("CASH")} disabled={payLoading}
                        className={`flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-all ${billingPayment.paymentMethod === "CASH" ? "bg-canvas shadow text-green-700 border border-green-200" : "text-muted hover:text-ink"}`}>
                        💵 Tiền mặt
                      </button>
                      <button onClick={() => billingPayment.paymentMethod !== "BANK_TRANSFER" && switchMethod("BANK_TRANSFER")} disabled={payLoading}
                        className={`flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-all ${billingPayment.paymentMethod === "BANK_TRANSFER" ? "bg-canvas shadow text-blue-700 border border-blue-200" : "text-muted hover:text-ink"}`}>
                        📱 Chuyển khoản
                      </button>
                    </div>
                    {billingPayment.paymentMethod === "BANK_TRANSFER" && billingPayment.vietQrUrl && (
                      <div className="bg-blue-50 rounded-xl p-3 text-center space-y-2">
                        <p className="text-[10px] text-blue-600 font-bold uppercase tracking-widest">Quét mã chuyển khoản</p>
                        <img src={billingPayment.vietQrUrl} alt="VietQR" className="w-36 h-36 mx-auto rounded-lg border border-blue-100" />
                        <p className="text-xs text-blue-500">Tự động xác nhận sau khi nhận tiền</p>
                      </div>
                    )}
                    {billingPayment.paymentMethod === "CASH" && (
                      <button onClick={confirmCash} disabled={payLoading}
                        className="w-full py-2.5 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl text-sm disabled:opacity-50">
                        {payLoading ? "Đang xử lý..." : `✓ Xác nhận thu ${formatPrice(billingPayment.amount)}`}
                      </button>
                    )}
                  </div>
                )}
                {billingPayment && billingPayment.status === "COMPLETED" && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                    <p className="text-green-700 font-bold">✓ Đã thanh toán</p>
                    <p className="text-sm text-green-600 mt-1">
                      {formatPrice(billingPayment.amount)} · {billingPayment.paymentMethod === "CASH" ? "Tiền mặt" : "Chuyển khoản"}
                    </p>
                  </div>
                )}
              </div>
            ) : isOpen ? (
              <p className="text-sm text-muted-soft text-center py-4">Chưa có món nào trong đơn</p>
            ) : (
              <div className="text-center py-4 space-y-1">
                <p className="text-sm font-semibold text-green-700">
                  {order.status === "PAID" ? (refundPayment ? "✓ Đã hoàn tiền và đóng đơn" : "✓ Đã thanh toán") : "Đơn đã hủy"}
                </p>
                {refundPayment && <p className="text-xs text-green-500">Đã hoàn {formatPrice(refundPayment.amount)} cho khách</p>}
              </div>
            )}
            {isOpen && (
              <div className="mt-4 pt-3 border-t border-hairline">
                <button onClick={() => { if (confirm("Hủy đơn hàng này?")) doAction("cancel", "POST", "Đã hủy đơn"); }}
                  disabled={actionLoading}
                  className="w-full py-2 text-sm text-red-500 font-medium border border-red-200 rounded-xl hover:bg-red-50 disabled:opacity-50">
                  Hủy đơn hàng
                </button>
              </div>
            )}
          </div>

          {/* Items desktop table */}
          <div className="bg-canvas rounded-xl border border-hairline p-5 col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-bold text-muted-soft uppercase tracking-widest">Danh sách món</h2>
              {canEdit && <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded border border-blue-200">Có thể điều chỉnh khi chưa tạo thanh toán</span>}
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-soft uppercase border-b border-hairline">
                  <th className="text-left pb-2">Món</th>
                  <th className="text-center pb-2">ĐV</th>
                  <th className="text-center pb-2 w-28">Số lượng</th>
                  <th className="text-right pb-2">Đơn giá</th>
                  <th className="text-right pb-2">Thành tiền</th>
                  {canEdit && <th className="pb-2 w-8"/>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {(order.items ?? []).map((item) => (
                  <tr key={item.id}>
                    <td className="py-2 text-ink">
                      <div className="flex items-center gap-2.5">
                        <img src={`https://picsum.photos/seed/product-${item.productId}/80/80`} alt={item.productName} className="w-9 h-9 object-cover rounded flex-shrink-0"/>
                        {item.productName}
                      </div>
                    </td>
                    <td className="py-2.5 text-center text-muted text-xs">{item.saleUnit ?? "—"}</td>
                    <td className="py-2.5 text-center">
                      {canEdit ? (
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => updateItemQty(item, item.quantity - 1)} disabled={updatingItemId === item.id || item.quantity <= 1}
                            className="w-6 h-6 flex items-center justify-center rounded border border-hairline text-muted hover:bg-surface-soft disabled:opacity-30 text-sm font-bold">−</button>
                          <span className="w-7 text-center font-semibold text-sm">
                            {updatingItemId === item.id ? <span className="text-muted animate-pulse">…</span> : item.quantity}
                          </span>
                          <button onClick={() => updateItemQty(item, item.quantity + 1)} disabled={updatingItemId === item.id}
                            className="w-6 h-6 flex items-center justify-center rounded border border-hairline text-muted hover:bg-surface-soft disabled:opacity-30 text-sm font-bold">+</button>
                        </div>
                      ) : <span className="text-muted">{item.quantity}</span>}
                    </td>
                    <td className="py-2.5 text-right text-muted">{formatPrice(item.productPrice)}</td>
                    <td className="py-2.5 text-right font-medium">{formatPrice(item.itemTotal)}</td>
                    {canEdit && (
                      <td className="py-2.5 text-center">
                        <button onClick={() => removeItem(item)} disabled={removingItemId === item.id || updatingItemId === item.id}
                          className="w-6 h-6 flex items-center justify-center rounded text-red-400 hover:bg-red-50 disabled:opacity-40">
                          {removingItemId === item.id ? <span className="text-xs animate-pulse">...</span> : <span className="text-sm font-bold">✕</span>}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              {(order.surcharges ?? []).length > 0 && (
                <tbody>
                  <tr><td colSpan={canEdit ? 6 : 5} className="pt-4 pb-1">
                    <span className="text-xs font-bold text-orange-600 uppercase tracking-widest">⚠️ Phụ thu ngoài ý muốn</span>
                  </td></tr>
                  {order.surcharges!.map(sc => (
                    <tr key={sc.id} className="bg-orange-50/40">
                      <td className="py-2 text-ink"><div className="font-medium text-orange-800">{sc.name}</div>{sc.reason && <div className="text-xs text-orange-500">{sc.reason}</div>}</td>
                      <td className="py-2 text-center text-muted-soft text-xs">—</td>
                      <td className="py-2 text-center text-muted">{sc.quantity}</td>
                      <td className="py-2 text-right text-muted">{formatPrice(sc.unitPrice)}</td>
                      <td className="py-2 text-right font-medium text-orange-700">{formatPrice(sc.amount)}</td>
                      {canEdit && <td/>}
                    </tr>
                  ))}
                </tbody>
              )}
              <tfoot>
                {prepaid > 0 && (
                  <>
                    <tr><td colSpan={canEdit ? 5 : 4} className="pt-3 text-right text-muted">Tổng cộng:</td><td className="pt-3 text-right font-semibold">{formatPrice(order.totalAmount)}</td></tr>
                    <tr><td colSpan={canEdit ? 5 : 4} className="text-right text-green-600 text-sm">Đã cọc:</td><td className="text-right text-green-600 font-semibold">− {formatPrice(prepaid)}</td></tr>
                  </>
                )}
                {refundPayment && (
                  <tr><td colSpan={canEdit ? 5 : 4} className="text-right text-amber-600 text-sm">Đã hoàn:</td><td className="text-right text-amber-600 font-semibold">− {formatPrice(refundPayment.amount)}</td></tr>
                )}
                {netRefund > 0 && !refundPayment ? (
                  <tr className="border-t-2 border-amber-300">
                    <td colSpan={canEdit ? 5 : 4} className="py-3 text-right font-bold text-amber-700">Hoàn lại khách:</td>
                    <td className="py-3 text-right font-bold text-amber-700 text-base">{formatPrice(netRefund)}</td>
                  </tr>
                ) : (
                  <tr className="border-t-2 border-hairline">
                    <td colSpan={canEdit ? 5 : 4} className="py-3 text-right font-bold text-ink">Cần thu:</td>
                    <td className="py-3 text-right font-bold text-primary text-base">{formatPrice(remaining)}</td>
                  </tr>
                )}
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      {/* ── Mobile sticky action bar ── */}
      {isOpen && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-100 px-3 py-3 flex gap-2">
          {!billingPayment && remaining > 0 && (
            <>
              <button onClick={() => createPayment("CASH")} disabled={payLoading}
                className="flex-1 py-3 bg-green-500 text-white text-sm font-bold rounded-xl disabled:opacity-50 touch-manipulation">
                💵 Tiền mặt
              </button>
              <button onClick={() => createPayment("BANK_TRANSFER")} disabled={payLoading}
                className="flex-1 py-3 bg-blue-500 text-white text-sm font-bold rounded-xl disabled:opacity-50 touch-manipulation">
                📱 CK
              </button>
            </>
          )}
          {billingPayment && billingPayment.status === "PENDING" && billingPayment.paymentMethod === "CASH" && (
            <button onClick={confirmCash} disabled={payLoading}
              className="flex-1 py-3 bg-green-500 text-white text-sm font-bold rounded-xl disabled:opacity-50 touch-manipulation">
              {payLoading ? "Đang xử lý..." : `✓ Thu ${formatPrice(billingPayment.amount)}`}
            </button>
          )}
          <button onClick={() => { if (confirm("Hủy đơn hàng này?")) doAction("cancel", "POST", "Đã hủy đơn"); }}
            disabled={actionLoading}
            className="py-3 px-4 bg-red-50 text-red-500 text-sm font-bold rounded-xl border border-red-200 disabled:opacity-50 touch-manipulation">
            Hủy
          </button>
        </div>
      )}
    </div>
  );
}
