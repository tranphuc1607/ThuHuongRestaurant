"use client";
import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { getAuthHeaders } from "@/lib/auth";
import { formatPrice, extractApiError } from "@/lib/utils";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";

interface OpenOrder {
  id: number;
  tableId: number;
  tableName?: string;
  tableNumber?: number;
  totalAmount: number;
  prepaidAmount: number;
  createdBy: string;
  note?: string;
}

interface OrderItem {
  id: number;
  productName: string;
  productPrice: number;
  quantity: number;
  saleUnit: string;
  itemTotal: number;
}

interface OrderDetail {
  id: number;
  tableId: number;
  tableName?: string;
  tableNumber?: number;
  status: string;
  totalAmount: number;
  prepaidAmount: number;
  createdBy: string;
  note?: string;
  items: OrderItem[];
}

interface PaymentDetail {
  id: number;
  orderId: number;
  amount: number;
  paymentMethod: string;
  status: string;
  referenceCode?: string;
  paidBy?: string;
  createdAt?: string;
  paidAt?: string;
  vietQrUrl?: string;
  tableName?: string;
  tableNumber?: number;
  note?: string;
}

interface PageData<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
}

type PaymentMethod = "CASH" | "BANK_TRANSFER" | "REFUND";
type ActiveTab = "payment" | "today";

const METHOD_LABELS: Record<PaymentMethod, { label: string; icon: string; desc: string }> = {
  CASH:          { label: "Tiền mặt",     icon: "💵", desc: "Thu tiền trực tiếp từ khách" },
  BANK_TRANSFER: { label: "Chuyển khoản", icon: "📱", desc: "Sinh mã VietQR — hệ thống tự xác nhận" },
  REFUND:        { label: "Hoàn tiền",    icon: "↩️", desc: "Hoàn tiền lại cho khách" },
};

const STATUS_FILTER_OPTIONS = [
  { value: "", label: "Tất cả" },
  { value: "PENDING",   label: "Chờ xác nhận" },
  { value: "COMPLETED", label: "Hoàn thành" },
];

function formatTime(iso?: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

// ─── Today's Payment List ────────────────────────────────────────────────────
function TodayPayments({ onViewPayment }: { onViewPayment: (id: number) => void }) {
  const [payments,      setPayments]      = useState<PaymentDetail[]>([]);
  const [loading,       setLoading]       = useState(false);
  const [statusFilter,  setStatusFilter]  = useState("");
  const [page,          setPage]          = useState(0);
  const [totalPages,    setTotalPages]    = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [confirming,    setConfirming]    = useState<number | null>(null);
  const [toast,         setToast]         = useState<{ msg: string; ok: boolean } | null>(null);
  const [hideExpiredBT, setHideExpiredBT] = useState(true);

  const EXPIRE_MS = 30 * 60 * 1000;
  function isExpiredBankTransfer(p: PaymentDetail) {
    return p.status === "PENDING"
      && p.paymentMethod === "BANK_TRANSFER"
      && Date.now() - new Date(p.createdAt ?? 0).getTime() >= EXPIRE_MS;
  }

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }

  const load = useCallback(async (p: number, status: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), size: "20" });
      if (status) params.set("status", status);
      const res  = await fetch(`${BASE}/payments/today?${params}`, { headers: getAuthHeaders() });
      const json = await res.json();
      if (json.statusCode === 200) {
        const data: PageData<PaymentDetail> = json.data;
        setPayments(data.content);
        setTotalPages(data.totalPages);
        setTotalElements(data.totalElements);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    setPage(0);
    load(0, statusFilter);
  }, [statusFilter, load]);

  async function confirmCash(p: PaymentDetail) {
    setConfirming(p.id);
    try {
      const res  = await fetch(`${BASE}/payments/${p.id}/confirm`, { method: "PATCH", headers: getAuthHeaders() });
      const json = await res.json();
      if (json.statusCode === 200) {
        showToast("Đã xác nhận thu tiền mặt ✓");
        load(page, statusFilter);
      } else {
        showToast(extractApiError(json, "Xác nhận thất bại"), false);
      }
    } catch { showToast("Không kết nối được máy chủ", false); }
    finally { setConfirming(null); }
  }

  const displayedPayments = hideExpiredBT
    ? payments.filter(p => !isExpiredBankTransfer(p))
    : payments;

  const totalCompleted = payments
    .filter(p => p.status === "COMPLETED")
    .reduce((s, p) => p.paymentMethod === "REFUND" ? s - p.amount : s + p.amount, 0);
  const pendingManual   = displayedPayments.filter(p => p.status === "PENDING");

  return (
    <div className="space-y-4">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 text-sm px-4 py-2.5 rounded-lg shadow-lg text-white
          ${toast.ok ? "bg-green-600" : "bg-red-500"}`}>
          {toast.msg}
        </div>
      )}

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-canvas rounded-xl border border-hairline p-4 text-center">
          <div className="text-xl font-black text-ink">{payments.length > 0 ? totalElements : 0}</div>
          <div className="text-xs text-muted mt-0.5">Giao dịch hôm nay</div>
        </div>
        <div className="bg-canvas rounded-xl border border-hairline p-4 text-center">
          <div className="text-xl font-black text-primary">{formatPrice(totalCompleted)}</div>
          <div className="text-xs text-muted mt-0.5">Đã thu</div>
        </div>
        <div className="bg-canvas rounded-xl border border-hairline p-4 text-center">
          <div className={`text-xl font-black ${pendingManual.length > 0 ? "text-amber-600" : "text-ink"}`}>
            {pendingManual.length}
          </div>
          <div className="text-xs text-muted mt-0.5">Chờ xác nhận</div>
        </div>
      </div>

      {/* Pending alert — CASH và BANK_TRANSFER đều cần xác nhận thủ công */}
      {pendingManual.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">
            Cần xác nhận ({pendingManual.length} giao dịch)
          </p>
          <div className="space-y-2">
            {pendingManual.map(p => (
              <div key={p.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-amber-100">
                <div>
                  <span className="text-sm font-semibold text-ink">{p.tableName ?? `Bàn ${p.tableNumber}`}</span>
                  <span className="text-xs text-muted-soft ml-2">#{p.id} · {formatTime(p.createdAt)}</span>
                  <span className={`ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                    p.paymentMethod === "CASH" ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"
                  }`}>
                    {p.paymentMethod === "CASH" ? "💵 Tiền mặt" : "📱 CK"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-primary">{formatPrice(p.amount)}</span>
                  <button
                    onClick={() => confirmCash(p)}
                    disabled={confirming === p.id}
                    className={`text-xs text-white px-3 py-1.5 rounded-lg disabled:opacity-50 font-semibold transition-colors ${
                      p.paymentMethod === "CASH"
                        ? "bg-green-500 hover:bg-green-600"
                        : "bg-blue-500 hover:bg-blue-600"
                    }`}
                  >
                    {confirming === p.id ? "..." : p.paymentMethod === "CASH" ? "Thu tiền" : "Xác nhận"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter + list */}
      <div className="bg-canvas rounded-xl border border-hairline overflow-hidden">
        <div className="px-5 py-3.5 border-b border-hairline flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-ink uppercase tracking-wide">Giao dịch hôm nay</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setHideExpiredBT(v => !v)}
              className={`text-[10px] px-2.5 py-1 rounded-full border transition-colors whitespace-nowrap ${
                hideExpiredBT
                  ? "bg-canvas text-muted border-hairline"
                  : "bg-amber-100 text-amber-700 border-amber-200"
              }`}
            >
              {hideExpiredBT ? "Ẩn CK hết hạn" : "Hiện CK hết hạn"}
            </button>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="text-xs border border-hairline rounded-lg px-2 py-1.5 text-ink bg-canvas outline-none focus:border-primary"
            >
              {STATUS_FILTER_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <button
              onClick={() => load(page, statusFilter)}
              disabled={loading}
              className="text-xs text-muted-soft hover:text-gray-600 px-2 py-1 rounded hover:bg-surface-soft transition-colors disabled:opacity-40"
            >
              {loading ? "..." : "↻"}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-10 text-muted-soft text-sm animate-pulse">Đang tải...</div>
        ) : displayedPayments.length === 0 ? (
          <div className="text-center py-12 text-muted-soft">
            <div className="text-3xl mb-2">📋</div>
            <p className="text-sm">
              {hideExpiredBT && payments.length > 0
                ? "Không có giao dịch cần xử lý — CK hết hạn đã bị ẩn"
                : "Chưa có giao dịch nào hôm nay"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-hairline">
            {displayedPayments.map(p => (
              <div key={p.id} className="flex items-center gap-3 px-5 py-3">
                {/* Method icon */}
                <div className="w-9 h-9 rounded-full bg-surface-soft flex items-center justify-center flex-shrink-0 text-base">
                  {METHOD_LABELS[p.paymentMethod as PaymentMethod]?.icon ?? "💰"}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-ink">
                      {p.tableName ?? `Bàn ${p.tableNumber}`}
                    </span>
                    <span className="text-xs text-muted-soft">#{p.id}</span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      p.status === "COMPLETED" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                    }`}>
                      {p.status === "COMPLETED" ? "Hoàn thành" : "Chờ xác nhận"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-muted-soft">
                      {METHOD_LABELS[p.paymentMethod as PaymentMethod]?.label ?? p.paymentMethod}
                    </span>
                    <span className="text-xs text-muted-soft">·</span>
                    <span className="text-xs text-muted-soft">{formatTime(p.createdAt)}</span>
                    {p.paidBy && p.status === "COMPLETED" && (
                      <>
                        <span className="text-xs text-muted-soft">·</span>
                        <span className="text-xs text-muted-soft">bởi {p.paidBy}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Amount + action */}
                <div className="text-right flex-shrink-0 flex flex-col items-end gap-1">
                  <span className={`text-sm font-bold ${p.paymentMethod === "REFUND" ? "text-amber-700" : "text-primary"}`}>
                    {p.paymentMethod === "REFUND" ? `− ${formatPrice(p.amount)}` : formatPrice(p.amount)}
                  </span>
                  {p.status === "PENDING" && (
                    <button
                      onClick={() => confirmCash(p)}
                      disabled={confirming === p.id}
                      className={`text-[10px] text-white px-2.5 py-1 rounded-lg disabled:opacity-50 font-semibold transition-colors ${
                        p.paymentMethod === "CASH"
                          ? "bg-green-500 hover:bg-green-600"
                          : "bg-blue-500 hover:bg-blue-600"
                      }`}
                    >
                      {confirming === p.id ? "..." : p.paymentMethod === "CASH" ? "Thu tiền" : "Xác nhận"}
                    </button>
                  )}
                  <button
                    onClick={() => onViewPayment(p.id)}
                    className="text-[10px] text-indigo-600 hover:text-indigo-800 font-semibold px-2 py-0.5 rounded hover:bg-indigo-50 transition-colors"
                  >
                    Chi tiết →
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-hairline bg-surface-soft">
            <button
              onClick={() => { const p = page - 1; setPage(p); load(p, statusFilter); }}
              disabled={page === 0}
              className="text-xs text-muted disabled:opacity-40 hover:text-ink transition-colors"
            >
              ← Trước
            </button>
            <span className="text-xs text-muted">{page + 1} / {totalPages}</span>
            <button
              onClick={() => { const p = page + 1; setPage(p); load(p, statusFilter); }}
              disabled={page >= totalPages - 1}
              className="text-xs text-muted disabled:opacity-40 hover:text-ink transition-colors"
            >
              Tiếp →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Payment Workflow ───────────────────────────────────────────────────
function PaymentContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const paramOrderId   = searchParams.get("orderId")   ?? "";
  const paramPaymentId = searchParams.get("paymentId") ?? "";

  const [activeTab, setActiveTab] = useState<ActiveTab>(
    paramOrderId || paramPaymentId ? "payment" : "payment"
  );

  // Open orders list
  const [openOrders,    setOpenOrders]    = useState<OpenOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // Manual search
  const [searchTab,      setSearchTab]      = useState<"order" | "payment">("order");
  const [orderIdInput,   setOrderIdInput]   = useState(paramOrderId);
  const [paymentIdInput, setPaymentIdInput] = useState(paramPaymentId);
  const [showManualSearch, setShowManualSearch] = useState(false);

  // Selected order + payment
  const [order,   setOrder]   = useState<OrderDetail | null>(null);
  const [payment, setPayment] = useState<PaymentDetail | null>(null);

  // Create-payment form
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [note,   setNote]   = useState("");

  // UI
  const [loading,         setLoading]         = useState(false);
  const [creating,        setCreating]         = useState(false);
  const [confirming,      setConfirming]       = useState(false);
  const [changingMethod,  setChangingMethod]   = useState(false);
  const [error,           setError]            = useState("");
  const [toast,           setToast]            = useState<{ msg: string; ok: boolean } | null>(null);
  const [pollCountdown,   setPollCountdown]    = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }

  const loadOpenOrders = useCallback(async () => {
    setLoadingOrders(true);
    try {
      const res  = await fetch(`${BASE}/orders?status=OPEN&size=50&page=0`, { headers: getAuthHeaders() });
      const json = await res.json();
      if (json.statusCode === 200) {
        setOpenOrders((json.data.content ?? []).filter((o: OpenOrder) => o.totalAmount > 0));
      }
    } catch { /* ignore */ }
    finally  { setLoadingOrders(false); }
  }, []);

  const loadByOrderId = useCallback(async (oid: string) => {
    if (!oid.trim()) return;
    setLoading(true); setError(""); setOrder(null); setPayment(null);
    try {
      const [orderRes, payRes] = await Promise.all([
        fetch(`${BASE}/orders/${oid}`,          { headers: getAuthHeaders() }),
        fetch(`${BASE}/payments/orders/${oid}`, { headers: getAuthHeaders() }),
      ]);
      const orderJson = await orderRes.json();
      const payJson   = await payRes.json();

      if (orderJson.statusCode === 200) setOrder(orderJson.data);
      else { setError(`Không tìm thấy đơn hàng #${oid}`); return; }

      if (payJson.statusCode === 200 && payJson.data) setPayment(payJson.data);
    } catch { setError("Không kết nối được máy chủ"); }
    finally  { setLoading(false); }
  }, []);

  const loadByPaymentId = useCallback(async (pid: string) => {
    if (!pid.trim()) return;
    setLoading(true); setError(""); setOrder(null); setPayment(null);
    try {
      const payRes  = await fetch(`${BASE}/payments/${pid}`, { headers: getAuthHeaders() });
      const payJson = await payRes.json();
      if (payJson.statusCode !== 200) { setError(`Không tìm thấy giao dịch #${pid}`); return; }

      const p: PaymentDetail = payJson.data;
      setPayment(p);

      const orderRes  = await fetch(`${BASE}/orders/${p.orderId}`, { headers: getAuthHeaders() });
      const orderJson = await orderRes.json();
      if (orderJson.statusCode === 200) setOrder(orderJson.data);
    } catch { setError("Không kết nối được máy chủ"); }
    finally  { setLoading(false); }
  }, []);

  const refreshCurrent = useCallback(async (payId: number, ordId: number) => {
    try {
      const [payRes, orderRes] = await Promise.all([
        fetch(`${BASE}/payments/${payId}`, { headers: getAuthHeaders() }),
        fetch(`${BASE}/orders/${ordId}`,   { headers: getAuthHeaders() }),
      ]);
      const payJson   = await payRes.json();
      const orderJson = await orderRes.json();
      if (payJson.statusCode   === 200) setPayment(payJson.data);
      if (orderJson.statusCode === 200) setOrder(orderJson.data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (paramPaymentId)    { loadByPaymentId(paramPaymentId); }
    else if (paramOrderId) { loadByOrderId(paramOrderId); }
    else                   { loadOpenOrders(); }
  }, [paramOrderId, paramPaymentId, loadByOrderId, loadByPaymentId, loadOpenOrders]);

  // Auto-poll BANK_TRANSFER PENDING
  useEffect(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (!payment || payment.status !== "PENDING" || payment.paymentMethod !== "BANK_TRANSFER") {
      setPollCountdown(0);
      return;
    }
    setPollCountdown(5);
    let countdown = 5;
    pollRef.current = setInterval(async () => {
      countdown -= 1;
      setPollCountdown(countdown);
      if (countdown <= 0) {
        countdown = 5; setPollCountdown(5);
        try {
          const res  = await fetch(`${BASE}/payments/${payment.id}`, { headers: getAuthHeaders() });
          const json = await res.json();
          if (json.statusCode === 200 && json.data.status === "COMPLETED") {
            setPayment(json.data);
            showToast("Đã nhận chuyển khoản thành công ✓");
            if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
            setPollCountdown(0);
          }
        } catch { /* ignore */ }
      }
    }, 1000);
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  }, [payment?.id, payment?.status, payment?.paymentMethod]);

  async function createPayment() {
    if (!order) return;
    if (order.totalAmount <= 0 || order.items?.length === 0) {
      setError("Đơn hàng chưa có món — không thể tạo thanh toán");
      return;
    }
    setCreating(true); setError("");
    try {
      const res  = await fetch(`${BASE}/payments`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ orderId: order.id, paymentMethod: method, note: note.trim() || undefined }),
      });
      const json = await res.json();
      if (json.statusCode === 200) {
        showToast(method === "CARD" ? "Thanh toán thẻ hoàn tất ✓" : "Đã tạo giao dịch thanh toán");
        setPayment(json.data);
        const orderRes  = await fetch(`${BASE}/orders/${order.id}`, { headers: getAuthHeaders() });
        const orderJson = await orderRes.json();
        if (orderJson.statusCode === 200) setOrder(orderJson.data);
      } else {
        setError(extractApiError(json, "Tạo thanh toán thất bại"));
      }
    } catch { setError("Không kết nối được máy chủ"); }
    finally  { setCreating(false); }
  }

  async function switchMethod(newMethod: PaymentMethod) {
    if (!payment || !order) return;
    setChangingMethod(true);
    try {
      const res  = await fetch(`${BASE}/payments/${payment.id}/change-method`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({ newMethod }),
      });
      const json = await res.json();
      if (json.statusCode === 200) {
        showToast(`Đã đổi sang ${METHOD_LABELS[newMethod]?.label} ✓`);
        setPayment(json.data);
      } else {
        showToast(extractApiError(json, "Đổi phương thức thất bại"), false);
      }
    } catch { showToast("Không kết nối được máy chủ", false); }
    finally   { setChangingMethod(false); }
  }

  async function confirmCash() {
    if (!payment || !order) return;
    setConfirming(true);
    try {
      const res  = await fetch(`${BASE}/payments/${payment.id}/confirm`, {
        method: "PATCH", headers: getAuthHeaders(),
      });
      const json = await res.json();
      if (json.statusCode === 200) {
        showToast("Đã xác nhận thu tiền mặt thành công ✓");
        await refreshCurrent(payment.id, order.id);
      } else {
        showToast(extractApiError(json, "Xác nhận thất bại"), false);
      }
    } catch { showToast("Không kết nối được máy chủ", false); }
    finally   { setConfirming(false); }
  }

  function backToList() {
    setOrder(null); setPayment(null); setError("");
    setNote(""); setMethod("CASH");
    loadOpenOrders();
  }

  async function viewPayment(pid: number) {
    setLoading(true);
    setActiveTab("payment");
    await loadByPaymentId(String(pid));
  }

  const remaining  = order ? Math.max(0, order.totalAmount - order.prepaidAmount) : 0;
  const netRefund  = order ? Math.round((order.prepaidAmount ?? 0) - order.totalAmount) : 0;
  const hasParam   = !!paramOrderId || !!paramPaymentId;
  const showList   = !hasParam && !order && !loading;

  return (
    <div className="p-6 max-w-2xl">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 text-sm px-4 py-2.5 rounded-lg shadow-lg text-white
          ${toast.ok ? "bg-green-600" : "bg-red-500"}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        {order && !hasParam ? (
          <button onClick={backToList}
            className="p-1.5 text-muted-soft hover:text-gray-600 hover:bg-canvas rounded-lg transition-colors">
            ←
          </button>
        ) : (
          <button onClick={() => router.back()}
            className="p-1.5 text-muted-soft hover:text-gray-600 hover:bg-canvas rounded-lg transition-colors">
            ←
          </button>
        )}
        <div>
          <h1 className="text-xl font-bold text-ink">Thanh toán</h1>
          {order ? (
            <p className="text-sm text-muted-soft mt-0.5">
              {order.tableName ?? `Bàn ${order.tableId}`} · Đơn #{order.id}
              {payment && <span className="ml-1">· Giao dịch #{payment.id}</span>}
            </p>
          ) : (
            <p className="text-sm text-muted-soft mt-0.5">Quản lý thanh toán</p>
          )}
        </div>
      </div>

      {/* Tab bar — chỉ hiện khi không đang xem chi tiết */}
      {!order && !loading && (
        <div className="flex bg-surface-soft rounded-xl p-1 mb-5">
          {([
            { key: "payment" as ActiveTab, label: "Thanh toán mới",   icon: "💳" },
            { key: "today"   as ActiveTab, label: "Lịch sử hôm nay",  icon: "📋" },
          ] as const).map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-semibold rounded-lg transition-all ${
                activeTab === key
                  ? "bg-canvas text-ink shadow-sm"
                  : "text-muted hover:text-ink"
              }`}
            >
              <span>{icon}</span> {label}
            </button>
          ))}
        </div>
      )}

      {/* ══════════════════ TAB: THANH TOÁN MỚI ══════════════════ */}
      {(activeTab === "payment" || order || loading) && (
        <>
          {/* Danh sách đơn đang mở */}
          {showList && (
            <div className="space-y-4">
              <div className="bg-canvas rounded-xl border border-hairline overflow-hidden">
                <div className="px-5 py-3.5 border-b border-hairline flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-ink uppercase tracking-wide">
                      Đơn đang chờ thanh toán
                    </h2>
                    {!loadingOrders && (
                      <p className="text-xs text-muted-soft mt-0.5">
                        {openOrders.length === 0 ? "Không có đơn nào đang mở" : `${openOrders.length} đơn đang mở`}
                      </p>
                    )}
                  </div>
                  <button onClick={loadOpenOrders} disabled={loadingOrders}
                    className="text-xs text-muted-soft hover:text-gray-600 px-2 py-1 rounded hover:bg-canvas transition-colors disabled:opacity-40">
                    {loadingOrders ? "..." : "↻ Làm mới"}
                  </button>
                </div>

                {loadingOrders ? (
                  <div className="text-center py-10 text-muted-soft text-sm animate-pulse">Đang tải...</div>
                ) : openOrders.length === 0 ? (
                  <div className="text-center py-12 text-muted-soft">
                    <div className="text-4xl mb-2">🍽️</div>
                    <p className="text-sm">Không có đơn nào đang mở</p>
                    <button onClick={() => router.push("/employee/ban")}
                      className="text-primary text-xs underline mt-1 inline-block">
                      → Vào sơ đồ bàn để mở bàn mới
                    </button>
                  </div>
                ) : (
                  <div className="divide-y divide-hairline">
                    {openOrders.map(o => {
                      const prepaid = o.prepaidAmount ?? 0;
                      const oRefund = Math.round(prepaid - o.totalAmount);
                      const needsRefund = oRefund > 0;
                      const due = needsRefund ? 0 : Math.max(0, o.totalAmount - prepaid);
                      return (
                        <button key={o.id} onClick={() => loadByOrderId(String(o.id))}
                          className={`w-full flex items-center gap-4 px-5 py-3.5 hover:bg-surface-soft transition-colors text-left ${needsRefund ? "bg-amber-50/40" : ""}`}>
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${needsRefund ? "bg-amber-100" : "bg-orange-100"}`}>
                            <span className={`text-sm font-bold ${needsRefund ? "text-amber-700" : "text-orange-600"}`}>
                              {o.tableNumber ?? o.tableId}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-ink">
                                {o.tableName ?? `Bàn ${o.tableId}`}
                              </span>
                              <span className="text-xs text-muted-soft">· #{o.id}</span>
                              {needsRefund && (
                                <span className="text-[9px] font-bold bg-amber-500 text-white px-1.5 py-0.5 rounded-full">💰 HOÀN</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-muted-soft">bởi {o.createdBy}</span>
                              {prepaid > 0 && (
                                <span className="text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
                                  Cọc {formatPrice(prepaid)}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className={`text-sm font-bold ${needsRefund ? "text-amber-700" : "text-primary"}`}>
                              {needsRefund ? `− ${formatPrice(oRefund)}` : formatPrice(due)}
                            </div>
                            {prepaid > 0 && (
                              <div className="text-xs text-muted-soft">/ {formatPrice(o.totalAmount)}</div>
                            )}
                            <div className={`mt-1 text-xs font-semibold ${needsRefund ? "text-amber-600" : "text-primary"}`}>
                              {needsRefund ? "Hoàn tiền →" : "Thanh toán →"}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Tìm theo ID */}
              <div className="bg-canvas rounded-xl border border-hairline overflow-hidden">
                <button onClick={() => setShowManualSearch(v => !v)}
                  className="w-full px-5 py-3.5 flex items-center justify-between text-sm text-muted hover:bg-surface-soft transition-colors">
                  <span className="font-medium">Tìm theo ID</span>
                  <span className="text-muted-soft">{showManualSearch ? "▲" : "▼"}</span>
                </button>
                {showManualSearch && (
                  <div className="px-5 pb-5 border-t border-hairline">
                    <div className="flex gap-1 my-3 bg-surface-soft p-1 rounded-lg">
                      {([
                        { key: "order",   label: "Theo đơn hàng" },
                        { key: "payment", label: "Theo giao dịch" },
                      ] as const).map(({ key, label }) => (
                        <button key={key}
                          onClick={() => { setSearchTab(key); setError(""); }}
                          className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors
                            ${searchTab === key ? "bg-canvas text-ink shadow-sm" : "text-muted hover:text-ink"}`}>
                          {label}
                        </button>
                      ))}
                    </div>
                    {searchTab === "order" ? (
                      <div className="flex gap-2">
                        <input value={orderIdInput} onChange={e => setOrderIdInput(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") loadByOrderId(orderIdInput); }}
                          placeholder="ID đơn hàng (VD: 12)"
                          className="flex-1 border border-hairline px-3 py-2 text-sm rounded-lg outline-none focus:border-primary transition-colors" />
                        <button onClick={() => loadByOrderId(orderIdInput)}
                          className="px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary-dark transition-colors">
                          Tìm
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <input value={paymentIdInput} onChange={e => setPaymentIdInput(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") loadByPaymentId(paymentIdInput); }}
                          placeholder="ID giao dịch (VD: 5)"
                          className="flex-1 border border-hairline px-3 py-2 text-sm rounded-lg outline-none focus:border-primary transition-colors" />
                        <button onClick={() => loadByPaymentId(paymentIdInput)}
                          className="px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary-dark transition-colors">
                          Tìm
                        </button>
                      </div>
                    )}
                    {error && (
                      <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-2 rounded-lg mt-3">
                        {error}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="text-center py-12 text-muted-soft animate-pulse">
              <p className="text-sm">Đang tải...</p>
            </div>
          )}

          {/* Error (khi đã có param) */}
          {error && !loading && !showList && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl">
              {error}
            </div>
          )}

          {/* Chi tiết đơn + thanh toán */}
          {order && !loading && (
            <div className="space-y-4">
              {!hasParam && (
                <button onClick={backToList}
                  className="flex items-center gap-1.5 text-sm text-muted hover:text-primary transition-colors">
                  ← Chọn đơn khác
                </button>
              )}

              {/* Order summary */}
              <div className="bg-canvas rounded-xl border border-hairline overflow-hidden">
                <div className="px-5 py-3.5 border-b border-hairline flex items-center justify-between">
                  <h2 className="text-sm font-bold text-ink uppercase tracking-wide">Chi tiết đơn hàng</h2>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      order.status === "PAID"      ? "bg-green-100 text-green-700"
                    : order.status === "CANCELLED" ? "bg-red-100 text-red-600"
                    : "bg-orange-100 text-orange-600"
                    }`}>
                      {order.status === "PAID" ? "Đã thanh toán" : order.status === "CANCELLED" ? "Đã hủy" : "Đang mở"}
                    </span>
                    {payment && (
                      <button onClick={() => refreshCurrent(payment.id, order.id)}
                        className="text-xs text-muted-soft hover:text-gray-600 px-2 py-0.5 rounded hover:bg-canvas transition-colors">
                        ↻ Làm mới
                      </button>
                    )}
                  </div>
                </div>

                <div className="divide-y divide-hairline max-h-52 overflow-y-auto">
                  {order.items.length === 0 ? (
                    <p className="text-sm text-muted-soft text-center py-6">Chưa có món nào</p>
                  ) : order.items.map(item => (
                    <div key={item.id} className="flex items-center gap-3 px-5 py-2.5">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-ink truncate">{item.productName}</div>
                        <div className="text-xs text-muted-soft">{formatPrice(item.productPrice)}/{item.saleUnit}</div>
                      </div>
                      <div className="text-xs text-muted-soft">×{item.quantity}</div>
                      <div className="text-sm font-semibold text-ink w-24 text-right">{formatPrice(item.itemTotal)}</div>
                    </div>
                  ))}
                </div>

                <div className="bg-surface-soft px-5 py-3.5 space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted">Tổng cộng</span>
                    <span className="font-bold text-ink">{formatPrice(order.totalAmount)}</span>
                  </div>
                  {order.prepaidAmount > 0 && (
                    <>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-soft">Đã cọc (booking)</span>
                        <span className="text-green-600 font-medium">− {formatPrice(order.prepaidAmount)}</span>
                      </div>
                      <div className="flex justify-between text-sm pt-1 border-t border-hairline">
                        {netRefund > 0 ? (
                          <>
                            <span className="text-amber-700 font-semibold">💰 Hoàn lại khách</span>
                            <span className="font-bold text-amber-700 text-lg">− {formatPrice(netRefund)}</span>
                          </>
                        ) : (
                          <>
                            <span className="text-gray-600 font-semibold">Còn phải thu</span>
                            <span className="font-bold text-primary text-lg">{formatPrice(remaining)}</span>
                          </>
                        )}
                      </div>
                    </>
                  )}
                  {order.prepaidAmount === 0 && (
                    <div className="flex justify-between text-sm pt-0.5 border-t border-hairline">
                      <span className="text-gray-600 font-semibold">Cần thu</span>
                      <span className="font-bold text-primary text-lg">{formatPrice(order.totalAmount)}</span>
                    </div>
                  )}
                </div>

                {order.note && (
                  <div className="bg-yellow-50 px-5 py-2.5 text-xs text-yellow-700 border-t border-yellow-100">
                    <span className="font-semibold">Ghi chú:</span> {order.note}
                  </div>
                )}
              </div>

              {/* Giao dịch đã tồn tại */}
              {payment ? (
                <div className="bg-canvas rounded-xl border border-hairline overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-hairline flex items-center justify-between">
                    <h2 className="text-sm font-bold text-ink uppercase tracking-wide">
                      Giao dịch #{payment.id}
                    </h2>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      payment.status === "COMPLETED" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                    }`}>
                      {payment.status === "COMPLETED" ? "Hoàn thành" : "Chờ xác nhận"}
                    </span>
                  </div>

                  <div className="p-5">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm mb-5">
                      <div className="text-muted">Phương thức</div>
                      <div className="font-semibold text-right">
                        {METHOD_LABELS[payment.paymentMethod as PaymentMethod]?.icon}{" "}
                        {METHOD_LABELS[payment.paymentMethod as PaymentMethod]?.label ?? payment.paymentMethod}
                      </div>
                      <div className="text-muted">Số tiền giao dịch</div>
                      <div className="font-bold text-primary text-right">{formatPrice(payment.amount)}</div>
                      {payment.referenceCode && (
                        <>
                          <div className="text-muted">Mã tham chiếu</div>
                          <div className="font-mono text-xs text-ink text-right break-all">{payment.referenceCode}</div>
                        </>
                      )}
                      {payment.paidBy && (
                        <>
                          <div className="text-muted">Xác nhận bởi</div>
                          <div className="text-right text-ink">{payment.paidBy}</div>
                        </>
                      )}
                      {payment.note && (
                        <>
                          <div className="text-muted">Ghi chú</div>
                          <div className="text-right text-muted-soft text-xs">{payment.note}</div>
                        </>
                      )}
                    </div>

                    {/* QR + poll BANK_TRANSFER */}
                    {payment.status === "PENDING" && payment.paymentMethod === "BANK_TRANSFER" && (
                      <div className="mb-5 space-y-3">
                        {payment.vietQrUrl && (
                          <div className="text-center">
                            <p className="text-xs text-muted mb-2">Khách quét mã để chuyển khoản</p>
                            <img src={payment.vietQrUrl} alt="VietQR"
                              className="w-52 h-52 mx-auto object-contain border-2 border-hairline rounded-xl p-1" />
                          </div>
                        )}
                        <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5">
                          <div className="flex items-center gap-2 text-blue-700 text-sm">
                            <span className="animate-pulse">🔄</span>
                            <span>Đang chờ xác nhận tự động...</span>
                          </div>
                          <span className="text-xs text-blue-400 font-mono">{pollCountdown}s</span>
                        </div>
                        <button onClick={() => refreshCurrent(payment.id, order.id)}
                          className="w-full py-2 text-xs text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors">
                          ↻ Kiểm tra ngay
                        </button>

                        {/* Xác nhận thủ công khi ngân hàng/webhook lỗi */}
                        <div className="border-t border-hairline pt-3 space-y-2">
                          <p className="text-xs text-muted-soft text-center">
                            Ngân hàng không thông báo tự động?
                          </p>
                          <button
                            onClick={confirmCash}
                            disabled={confirming || changingMethod}
                            className="w-full py-2.5 bg-blue-500 text-white font-semibold rounded-xl hover:bg-blue-600 disabled:opacity-60 transition-colors text-sm"
                          >
                            {confirming ? "Đang xác nhận..." : "✓ Xác nhận thủ công đã nhận tiền"}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Xác nhận CASH */}
                    {payment.status === "PENDING" && payment.paymentMethod === "CASH" && (
                      <div className="space-y-2">
                        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 text-sm text-amber-700 flex items-center gap-2">
                          <span>💵</span>
                          <span>Bấm xác nhận sau khi đã thu tiền mặt từ khách</span>
                        </div>
                        <button onClick={confirmCash} disabled={confirming || changingMethod}
                          className="w-full py-3 bg-green-500 text-white font-bold rounded-xl hover:bg-green-600 disabled:opacity-60 transition-colors text-sm">
                          {confirming ? "Đang xác nhận..." : `✓ Xác nhận đã thu ${formatPrice(payment.amount)}`}
                        </button>
                      </div>
                    )}

                    {/* Đổi phương thức (chỉ khi PENDING) */}
                    {payment.status === "PENDING" && (
                      <div className="border-t border-hairline pt-4 mt-2">
                        <p className="text-xs text-muted-soft mb-2 text-center">
                          Khách muốn đổi phương thức?
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          {(["CASH", "BANK_TRANSFER"] as PaymentMethod[])
                            .filter(m => m !== payment.paymentMethod)
                            .map(m => (
                              <button
                                key={m}
                                onClick={() => switchMethod(m)}
                                disabled={changingMethod || confirming}
                                className="flex items-center justify-center gap-1.5 py-2 border border-hairline rounded-lg text-xs font-semibold text-muted hover:border-primary/50 hover:text-primary disabled:opacity-50 transition-colors"
                              >
                                {changingMethod ? "..." : (
                                  <>
                                    <span>{METHOD_LABELS[m].icon}</span>
                                    <span>Đổi sang {METHOD_LABELS[m].label}</span>
                                  </>
                                )}
                              </button>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* Hoàn thành */}
                    {payment.status === "COMPLETED" && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-center gap-2 text-green-600 font-semibold py-3 bg-green-50 rounded-xl border border-green-100">
                          <span className="text-xl">✓</span>
                          <span>Đã thanh toán thành công</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <button onClick={backToList}
                            className="py-2.5 bg-canvas text-gray-600 text-sm font-semibold rounded-xl hover:bg-surface-card transition-colors">
                            ← Đơn tiếp theo
                          </button>
                          <button onClick={() => router.push("/employee/ban")}
                            className="py-2.5 bg-canvas text-gray-600 text-sm font-semibold rounded-xl hover:bg-surface-card transition-colors">
                            Sơ đồ bàn
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

              ) : netRefund > 0 ? (
                /* Cần hoàn tiền cho khách */
                <div className="bg-amber-50 border border-amber-300 rounded-xl p-5">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl shrink-0">💰</span>
                    <div>
                      <p className="font-bold text-amber-800 mb-1">Cần hoàn tiền cho khách</p>
                      <p className="text-sm text-amber-700">
                        Khách đã cọc <span className="font-semibold">{formatPrice(order.prepaidAmount)}</span>, tổng đơn hiện tại <span className="font-semibold">{formatPrice(order.totalAmount)}</span>.
                      </p>
                      <p className="text-sm font-bold text-amber-800 mt-1">
                        Hoàn lại: {formatPrice(netRefund)}
                      </p>
                      <p className="text-xs text-amber-600 mt-2">Vào chi tiết đơn hàng để xác nhận đã hoàn tiền.</p>
                    </div>
                  </div>
                </div>
              ) : (
                /* Tạo giao dịch mới */
                order.status === "OPEN" ? (
                  <div className="bg-canvas rounded-xl border border-hairline overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-hairline">
                      <h2 className="text-sm font-bold text-ink uppercase tracking-wide">Tạo giao dịch thanh toán</h2>
                    </div>
                    <div className="p-5 space-y-5">
                      <div>
                        <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-2.5">
                          Phương thức thanh toán
                        </label>
                        <div className="space-y-2">
                          {(Object.entries(METHOD_LABELS) as [PaymentMethod, typeof METHOD_LABELS[PaymentMethod]][]).map(([m, info]) => (
                            <button key={m} type="button" onClick={() => setMethod(m)}
                              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all ${
                                method === m ? "border-primary bg-primary/5" : "border-hairline hover:border-primary/30"
                              }`}>
                              <span className="text-xl">{info.icon}</span>
                              <div className="flex-1">
                                <div className={`text-sm font-semibold ${method === m ? "text-primary" : "text-ink"}`}>{info.label}</div>
                                <div className="text-xs text-muted-soft">{info.desc}</div>
                              </div>
                              <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${method === m ? "border-primary bg-primary" : "border-gray-300"}`}>
                                {method === m && <div className="w-full h-full rounded-full bg-white scale-50 block" />}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">
                          Ghi chú <span className="font-normal text-muted-soft">(không bắt buộc)</span>
                        </label>
                        <input value={note} onChange={e => setNote(e.target.value)}
                          placeholder="VD: Khách yêu cầu xuất hóa đơn..."
                          maxLength={200}
                          className="w-full border border-hairline px-3 py-2 text-sm rounded-lg outline-none focus:border-primary transition-colors" />
                      </div>

                      {error && (
                        <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-2 rounded-lg">
                          {error}
                        </div>
                      )}

                      <button
                        onClick={createPayment}
                        disabled={creating || order.totalAmount <= 0}
                        className="w-full py-3.5 bg-primary text-white font-bold rounded-xl hover:bg-primary-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                        {creating ? "Đang tạo..." : order.totalAmount <= 0 ? "Đơn chưa có món" : `Thanh toán ${formatPrice(remaining || order.totalAmount)}`}
                      </button>

                      <p className="text-xs text-center text-muted-soft">
                        {method === "CARD" && "Thẻ / POS tự động hoàn tất — không cần xác nhận thêm"}
                        {method === "BANK_TRANSFER" && "Mã QR hiện sau khi tạo — hệ thống tự xác nhận khi nhận chuyển khoản"}
                        {method === "CASH" && "Tạo xong → bấm \"Xác nhận thu tiền\" sau khi đã nhận tiền từ khách"}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-amber-50 border border-amber-200 text-amber-700 text-sm px-4 py-3 rounded-xl">
                    Đơn hàng ở trạng thái <strong>{order.status}</strong> — không thể tạo thanh toán.
                  </div>
                )
              )}
            </div>
          )}
        </>
      )}

      {/* ══════════════════ TAB: LỊCH SỬ HÔM NAY ══════════════════ */}
      {activeTab === "today" && !order && !loading && (
        <TodayPayments onViewPayment={viewPayment} />
      )}

      <div className="h-24 md:hidden" aria-hidden />
    </div>
  );
}

export default function EmployeePaymentPage() {
  return (
    <Suspense fallback={<div className="p-8 text-muted-soft text-sm">Đang tải...</div>}>
      <PaymentContent />
    </Suspense>
  );
}
