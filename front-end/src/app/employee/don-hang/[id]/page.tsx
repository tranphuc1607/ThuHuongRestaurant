"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getAuthHeaders } from "@/lib/auth";
import { formatPrice, extractApiError } from "@/lib/utils";
import { QRCodeSVG } from "qrcode.react";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";

const SALE_UNITS: { value: string; label: string }[] = [
  { value: "PORTION", label: "Phần" },
  { value: "CUP",     label: "Ly" },
  { value: "DISH",    label: "Đĩa/Tô" },
  { value: "PIECE",   label: "Cái" },
  { value: "CHAI",    label: "Chai" },
  { value: "KG",      label: "Kg" },
];

const DEFAULT_UNIT: Record<string, string> = {
  DRINK:      "CUP",
  DRINK_FOOD: "PORTION",
  CHICKEN:    "PORTION",
  PORK:       "PORTION",
  BEEF:       "PORTION",
  FISH:       "PORTION",
  VEGETABLE:  "PORTION",
  OTHER:      "PORTION",
};

const CATEGORIES = ["ALL", "CHICKEN", "PORK", "BEEF", "FISH", "VEGETABLE", "DRINK_FOOD", "DRINK", "OTHER"] as const;
const CATEGORY_LABELS: Record<string, string> = {
  ALL:        "Tất cả",
  CHICKEN:    "Gà",
  PORK:       "Heo",
  BEEF:       "Bò",
  FISH:       "Cá",
  VEGETABLE:  "Rau",
  DRINK_FOOD: "Ăn kèm",
  DRINK:      "Đồ uống",
  OTHER:      "Khác",
};
const CATEGORY_ICONS: Record<string, string> = {
  ALL: "🍽️", CHICKEN: "🐔", PORK: "🐷", BEEF: "🥩",
  FISH: "🐟", VEGETABLE: "🥦", DRINK_FOOD: "🍟", DRINK: "🧃", OTHER: "✨",
};

interface OrderItem {
  id: number;
  productId: number;
  productName: string;
  productPrice: number;
  quantity: number;
  saleUnit: string;
  itemTotal: number;
  category?: string;
  fromBooking?: boolean;
  createdAt?: string;
}

interface OrderSurcharge {
  id: number;
  name: string;
  unitPrice: number;
  quantity: number;
  amount: number;
  reason?: string;
}

interface OrderDetail {
  id: number;
  tableId: number;
  tableName?: string;
  tableNumber?: number;
  tableQrToken?: string;
  status: string;
  totalAmount: number;
  prepaidAmount: number;
  createdBy: string;
  note?: string;
  cancelReason?: string;
  items: OrderItem[];
  surcharges?: OrderSurcharge[];
}

interface Product {
  id: number;
  name: string;
  price: number;
  category: string;
  status: string;
  imageUrl?: string;
  saleUnit?: string;
}

interface PaymentInfo {
  id: number; amount: number; paymentMethod: string; status: string; vietQrUrl?: string;
}

export default function EmployeeOrderDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const backHref = searchParams.get("from") === "orders" ? "/employee/don-hang" : "/employee/ban";
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [qty, setQty] = useState(1);
  const [saleUnit, setSaleUnit] = useState("PORTION");
  const [addLoading, setAddLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("ALL");
  const [removeLoadingId, setRemoveLoadingId] = useState<number | null>(null);
  const [qtyLoadingId, setQtyLoadingId] = useState<number | null>(null);
  const [quickAddLoadingId, setQuickAddLoadingId] = useState<number | null>(null);
  const [beerAddQty, setBeerAddQty] = useState("");
  const [showBeerModal, setShowBeerModal] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const [payments, setPayments] = useState<PaymentInfo[]>([]);
  const [partialAmount, setPartialAmount] = useState("");
  const [payLoading, setPayLoading] = useState(false);
  const [refundLoading, setRefundLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [origin, setOrigin] = useState("");
  // Mobile: "bill" tab = left panel, "products" tab = right panel
  const [activeTab, setActiveTab] = useState<"bill" | "products">("bill");

  // Phụ thu ngoài ý muốn
  const [showSurchargeForm, setShowSurchargeForm] = useState(false);
  const [surName,     setSurName]     = useState("");
  const [surPrice,    setSurPrice]    = useState("");
  const [surQty,      setSurQty]      = useState("1");
  const [surReason,   setSurReason]   = useState("");
  const [surLoading,  setSurLoading]  = useState(false);
  const [removingSurId, setRemovingSurId] = useState<number | null>(null);

  // UI toggles — ẩn/hiện QR và payment panel
  const [showQR, setShowQR] = useState(false);
  const [qrZoom, setQrZoom] = useState(false);
  const [paymentQrZoom, setPaymentQrZoom] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showBeerList, setShowBeerList] = useState(false);

  // Ref để useEffect keydown không bị stale closure
  const beerAddQtyRef = useRef(beerAddQty);
  useEffect(() => { beerAddQtyRef.current = beerAddQty; }, [beerAddQty]);
  const beerProductsRef = useRef<Product[]>([]);
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null);
  const scrollMoved = useRef(false);

  // Lắng nghe phím số + Backspace + Enter + Escape khi modal bia đang mở
  useEffect(() => {
    if (!showBeerModal) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") {
        e.preventDefault();
        setBeerAddQty(prev => prev + e.key);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        setBeerAddQty(prev => prev.slice(0, -1));
      } else if (e.key === "Escape") {
        setShowBeerModal(false);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const qty = parseInt(beerAddQtyRef.current) || 0;
        if (qty > 0 && beerProductsRef.current.length > 0) {
          quickAddBeer(beerProductsRef.current[0], qty);
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [showBeerModal]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = useCallback(async () => {
    const [orderRes, payRes] = await Promise.all([
      fetch(`${BASE}/orders/${id}`, { headers: getAuthHeaders(), cache: "no-store" }),
      fetch(`${BASE}/payments/orders/${id}/all`, { headers: getAuthHeaders(), cache: "no-store" }),
    ]);
    const orderJson = await orderRes.json();
    const payJson = await payRes.json();
    if (orderJson.statusCode === 200) setOrder(orderJson.data);
    if (payJson.statusCode === 200) setPayments(payJson.data ?? []);
    else setPayments([]);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setOrigin(process.env.NEXT_PUBLIC_APP_URL || window.location.origin); }, []);

  // Auto-poll mỗi 4 giây khi có BANK_TRANSFER PENDING — chờ Sepay webhook tự xác nhận
  const pendingBtPaymentId = payments.find(p => p.paymentMethod === "BANK_TRANSFER" && p.status === "PENDING")?.id ?? null;
  useEffect(() => {
    if (!pendingBtPaymentId) return;
    const interval = setInterval(load, 4000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingBtPaymentId]);

  useEffect(() => {
    if (products.length === 0) {
      setProductsLoading(true);
      fetch(`${BASE}/products?page=0&size=200`, { headers: getAuthHeaders() })
        .then(r => r.json())
        .then(json => {
          if (json.statusCode === 200) {
            const list: Product[] = json.data.content ?? json.data ?? [];
            setProducts(list.filter(p => p.status === "AVAILABLE"));
          }
        })
        .finally(() => setProductsLoading(false));
    }
  }, [products.length]);

  // Tự động cập nhật giá payment khi order.totalAmount thay đổi (debounce 700ms)
  // Chỉ auto-sync khi chưa có payment nào đã hoàn thành (tránh xung đột split payment)
  useEffect(() => {
    if (!order || order.status !== "OPEN") return;
    const billing = payments.find(p => p.paymentMethod !== "REFUND" && p.status === "PENDING") ?? null;
    if (!billing) return;
    const hasCompleted = payments.some(p => p.paymentMethod !== "REFUND" && p.status === "COMPLETED");
    if (hasCompleted) return; // Split payment đang diễn ra — không auto-sync
    const prepaid = order.prepaidAmount ?? 0;
    const newAmount = Math.max(0, order.totalAmount - prepaid);
    if (Math.abs(newAmount - billing.amount) <= 0.5) return;
    const timer = setTimeout(() => syncPaymentAmountFn(billing.id, newAmount), 700);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.totalAmount]);

  function formatHM(iso?: string) {
    if (!iso) return "—";
    return new Date(iso).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  }

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }

  function handleSelectProduct(p: Product) {
    if (selectedProduct?.id === p.id) {
      setSelectedProduct(null);
      return;
    }
    // Đơn vị lấy từ product, fallback DEFAULT_UNIT theo category
    const unit = p.saleUnit ?? DEFAULT_UNIT[p.category] ?? "PORTION";
    // Nếu món đã có trong đơn (không phải bia) → tăng số lượng trực tiếp, không mở bottom bar
    const existing = foodItems.find(i => i.productId === p.id && i.saleUnit === unit);
    if (existing) {
      adjustQty(existing, 1);
      showToast(`+1 ${p.name} (đang có ${existing.quantity})`);
      return;
    }
    setSelectedProduct(p);
    setSaleUnit(unit);
    setQty(1);
  }

  async function addItem() {
    if (!selectedProduct || !saleUnit.trim()) return;
    setAddLoading(true);
    try {
      const res = await fetch(`${BASE}/orders/${id}/items`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          productId: selectedProduct.id,
          quantity: qty,
          saleUnit: saleUnit.trim(),
        }),
      });
      const json = await res.json();
      if (json.statusCode === 200) {
        showToast(`Đã thêm ${qty} ${SALE_UNITS.find(u=>u.value===saleUnit)?.label ?? ""} ${selectedProduct.name}`);
        setSelectedProduct(null);
        setQty(1);
        load();
      } else {
        showToast(extractApiError(json, "Thêm thất bại"), false);
      }
    } catch {
      showToast("Không kết nối được máy chủ", false);
    } finally {
      setAddLoading(false);
    }
  }

  async function quickAddBeer(p: Product | undefined, qty: number = 1) {
    if (!p) return;
    const q = Math.max(1, qty);
    setQuickAddLoadingId(p.id);
    try {
      const res = await fetch(`${BASE}/orders/${id}/items`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          productId: p.id,
          quantity: q,
          saleUnit: "CUP",
        }),
      });
      const json = await res.json();
      if (json.statusCode === 200) {
        showToast(`Đã thêm ${q} cốc bia`);
        setBeerAddQty("");
        setShowBeerModal(false);
        load();
      } else {
        showToast(extractApiError(json, "Thêm bia thất bại"), false);
      }
    } catch {
      showToast("Không kết nối được máy chủ", false);
    } finally {
      setQuickAddLoadingId(null);
    }
  }

  async function removeItem(itemId: number, name: string) {
    if (!confirm(`Xóa "${name}" khỏi đơn?`)) return;
    setRemoveLoadingId(itemId);
    try {
      const res = await fetch(`${BASE}/orders/${id}/items/${itemId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      const json = await res.json();
      if (json.statusCode === 200) { showToast("Đã xóa món"); load(); }
      else showToast(extractApiError(json, "Xóa thất bại"), false);
    } finally {
      setRemoveLoadingId(null);
    }
  }

  async function createPayment(method: "CASH" | "BANK_TRANSFER") {
    if (!order) return;
    setPayLoading(true);
    try {
      const rawAmt = partialAmount.replace(/\./g, "").replace(",", ".");
      const partial = rawAmt ? parseFloat(rawAmt) : undefined;
      const res = await fetch(`${BASE}/payments`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          orderId: order.id,
          paymentMethod: method,
          amount: partial && partial > 0 ? partial : undefined,
        }),
      });
      const json = await res.json();
      if (json.statusCode === 200) {
        setPartialAmount("");
        load();
        showToast(method === "CASH" ? "Đã tạo phiếu tiền mặt" : "Đã tạo QR chuyển khoản");
      } else {
        showToast(extractApiError(json, "Không tạo được thanh toán"), false);
      }
    } catch {
      showToast("Không kết nối được máy chủ", false);
    } finally {
      setPayLoading(false);
    }
  }

  async function switchMethod(newMethod: "CASH" | "BANK_TRANSFER") {
    if (!pendingPayment) return;
    setPayLoading(true);
    try {
      const res = await fetch(`${BASE}/payments/${pendingPayment.id}/change-method`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({ newMethod }),
      });
      const json = await res.json();
      if (json.statusCode === 200) {
        load();
        showToast(`Đã đổi sang ${newMethod === "CASH" ? "tiền mặt" : "chuyển khoản"}`);
      } else {
        showToast(extractApiError(json, "Đổi thất bại"), false);
      }
    } catch {
      showToast("Không kết nối được máy chủ", false);
    } finally {
      setPayLoading(false);
    }
  }

  async function syncPaymentAmountFn(paymentId: number, newAmount: number) {
    try {
      const res = await fetch(`${BASE}/payments/${paymentId}/amount`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({ newAmount }),
      });
      const json = await res.json();
      if (json.statusCode === 200) {
        setPayments(prev => prev.map(p => p.id === paymentId ? { ...p, ...json.data } : p));
      }
    } catch {}
  }

  async function confirmCash() {
    if (!pendingPayment) return;
    setPayLoading(true);
    try {
      const res = await fetch(`${BASE}/payments/${pendingPayment.id}/confirm`, {
        method: "PATCH",
        headers: getAuthHeaders(),
      });
      const json = await res.json();
      if (json.statusCode === 200) {
        showToast("Đã xác nhận thanh toán tiền mặt ✓");
        // Kiểm tra nếu đơn đã PAID (đủ tiền) thì chuyển trang, nếu chưa thì reload để thêm phương thức khác
        setTimeout(async () => {
          const r = await fetch(`${BASE}/orders/${id}`, { headers: getAuthHeaders() });
          const j = await r.json();
          if (j.data?.status === "PAID") {
            router.push("/employee/don-hang?status=PAID");
          } else {
            setPayLoading(false); // reset trước load để buttons không bị disabled
            load();
          }
        }, 500);
      } else {
        showToast(extractApiError(json, "Xác nhận thất bại"), false);
        setPayLoading(false);
      }
    } catch {
      showToast("Không kết nối được máy chủ", false);
      setPayLoading(false);
    }
  }

  async function cancelOrder() {
    if (!order) return;
    const hasItems = (order.items?.length ?? 0) > 0;
    const refundNote = netRefund > 0 ? `\nLưu ý: cần hoàn lại ${formatPrice(netRefund)} cho khách.` : "";
    let reason = "";
    if (hasItems) {
      const input = prompt(`Lý do hủy đơn #${order.id}:${refundNote}`);
      if (input === null) return;
      reason = input.trim();
    } else {
      if (!confirm(`Hủy đơn #${order.id} và giải phóng bàn?${refundNote}`)) return;
    }
    setCancelLoading(true);
    try {
      const res = await fetch(`${BASE}/orders/${order.id}/cancel`, {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const json = await res.json();
      if (json.statusCode === 200) {
        showToast("Đã hủy đơn — bàn đã được giải phóng");
        setTimeout(() => router.push(backHref), 1200);
      } else {
        showToast(extractApiError(json, "Hủy đơn thất bại"), false);
      }
    } catch { showToast("Không kết nối được máy chủ", false); }
    finally { setCancelLoading(false); }
  }

  async function processRefund() {
    if (!order) return;
    if (!confirm(`Xác nhận đã hoàn ${formatPrice(netRefund)} cho khách?`)) return;
    setRefundLoading(true);
    try {
      const res = await fetch(`${BASE}/payments/orders/${order.id}/refund`, {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ amount: netRefund }),
      });
      const json = await res.json();
      if (res.ok && json.statusCode === 200) {
        showToast(`Đã ghi nhận hoàn ${formatPrice(netRefund)} cho khách`);
        load();
      } else {
        showToast(extractApiError(json, "Không thể ghi nhận hoàn tiền"), false);
      }
    } catch {
      showToast("Không kết nối được máy chủ", false);
    } finally {
      setRefundLoading(false);
    }
  }

  async function adjustQty(item: OrderItem, delta: number) {
    const newQty = item.quantity + delta;
    if (newQty < 1) return; // không cho giảm xuống dưới 1 — dùng nút ✕ để xóa hẳn
    setQtyLoadingId(item.id);
    try {
      const res = await fetch(`${BASE}/orders/${id}/items/${item.id}`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({ quantity: newQty }),
      });
      const json = await res.json();
      if (json.statusCode === 200) {
        load();
      } else {
        showToast(extractApiError(json, "Không thể cập nhật số lượng"), false);
      }
    } catch {
      showToast("Không kết nối được máy chủ", false);
    } finally {
      setQtyLoadingId(null);
    }
  }

  async function addSurcharge() {
    const price = parseFloat(surPrice.replace(/\./g, "").replace(",", "."));
    const qty   = parseInt(surQty) || 1;
    if (!surName.trim() || isNaN(price) || price < 0) {
      showToast("Nhập đủ tên và số tiền hợp lệ", false);
      return;
    }
    setSurLoading(true);
    try {
      const res = await fetch(`${BASE}/orders/${id}/surcharges`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ name: surName.trim(), unitPrice: price, quantity: qty, reason: surReason.trim() || undefined }),
      });
      const json = await res.json();
      if (json.statusCode === 200) {
        showToast(`Đã thêm phụ thu "${surName.trim()}"`);
        setSurName(""); setSurPrice(""); setSurQty("1"); setSurReason("");
        setShowSurchargeForm(false);
        load();
      } else {
        showToast(extractApiError(json, "Thêm thất bại"), false);
      }
    } catch { showToast("Không kết nối được máy chủ", false); }
    finally  { setSurLoading(false); }
  }

  async function removeSurcharge(surchargeId: number, name: string) {
    if (!confirm(`Xóa phụ thu "${name}"?`)) return;
    setRemovingSurId(surchargeId);
    try {
      const res = await fetch(`${BASE}/orders/${id}/surcharges/${surchargeId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      const json = await res.json();
      if (json.statusCode === 200) { showToast("Đã xóa phụ thu"); load(); }
      else showToast(extractApiError(json, "Xóa thất bại"), false);
    } finally { setRemovingSurId(null); }
  }

  if (loading) return (
    <div className="h-full flex items-center justify-center text-muted text-sm">
      Đang tải đơn hàng...
    </div>
  );
  if (!order) return (
    <div className="h-full flex items-center justify-center text-red-500 text-sm">
      Không tìm thấy đơn hàng #{id}
    </div>
  );

  const isOpen = order.status === "OPEN";
  const hasBookingItems = order.items?.some((i: any) => i.fromBooking) ?? false;
  const canCancel = isOpen && !hasBookingItems;
  const tableName = order.tableName ?? `Bàn ${order.tableNumber ?? order.tableId}`;
  const prepaid = order.prepaidAmount ?? 0;
  const remaining = Math.max(0, order.totalAmount - prepaid);
  const netRefund = Math.round(prepaid - order.totalAmount); // positive = cần hoàn cho khách (round tránh float)
  // Split payment support
  const billingPayments = payments.filter(p => p.paymentMethod !== "REFUND");
  const completedPayments = billingPayments.filter(p => p.status === "COMPLETED");
  const pendingPayment = billingPayments.find(p => p.status === "PENDING") ?? null;
  const sumCompleted = completedPayments.reduce((s, p) => s + p.amount, 0);
  const trueRemaining = Math.max(0, order.totalAmount - prepaid - sumCompleted);
  // Legacy compat for refund logic
  const billingPayment = pendingPayment ?? completedPayments[0] ?? null;
  const refundPayment  = payments.find(p => p.paymentMethod === "REFUND")  ?? null;
  const hasPendingPayment = !!pendingPayment;

  const filteredProducts = products.filter(p => {
    const matchCat = activeCategory === "ALL" || p.category === activeCategory;
    const matchQ = !search.trim() || p.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchQ;
  });

  const isBeer = (name: string) => name.toLowerCase().includes("bia cốc");
  const drinkItems = order.items.filter(i => i.category === "DRINK" && isBeer(i.productName));
  const bookingItems = order.items.filter(i => i.fromBooking && !(i.category === "DRINK" && isBeer(i.productName)));
  const foodItems = order.items.filter(i => !(i.category === "DRINK" && isBeer(i.productName)) && !i.fromBooking);
  const drinkTotal = drinkItems.reduce((sum, i) => sum + i.itemTotal, 0);
  const bookingTotal = bookingItems.reduce((sum, i) => sum + i.itemTotal, 0);
  const drinkProducts = products.filter(p => p.category === "DRINK" && isBeer(p.name));
  beerProductsRef.current = drinkProducts;

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#f7f5f0]">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 text-sm px-4 py-3 rounded-xl shadow-lg text-white max-w-sm
          ${toast.ok ? "bg-gray-800" : "bg-red-500"}`}>
          {toast.ok ? "✓ " : "✕ "}{toast.msg}
        </div>
      )}

      {/* Top bar — compact */}
      <div className="flex items-center gap-2 px-3 md:px-5 py-2 bg-canvas border-b border-hairline flex-shrink-0 min-h-0">
        <Link
          href={backHref}
          className="flex items-center gap-1 text-muted-soft hover:text-gray-600 text-sm font-medium flex-shrink-0 touch-manipulation"
          style={{ WebkitTapHighlightColor: "transparent" }}>
          <span>←</span>
          <span className="hidden sm:inline">{backHref === "/employee/don-hang" ? "Đơn hàng" : "Bàn"}</span>
        </Link>
        <span className="text-gray-200 flex-shrink-0">·</span>
        <span className="font-bold text-ink text-sm truncate">{tableName}</span>
        <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold flex-shrink-0 ${
          isOpen ? "bg-orange-100 text-orange-700"
          : order.status === "CANCELLED" ? "bg-red-100 text-red-600"
          : "bg-green-100 text-green-700"
        }`}>
          {isOpen ? "Mở" : order.status === "CANCELLED" ? "Hủy" : "Xong"}
        </span>
        {order.status === "CANCELLED" && order.cancelReason && (
          <span className="text-[11px] text-red-500 truncate hidden sm:inline">· {order.cancelReason}</span>
        )}
        <span className="ml-auto text-[11px] text-muted-soft flex-shrink-0">#{order.id}</span>
      </div>

      {/* Mobile tab switcher — 1 dòng, compact */}
      <div className="md:hidden flex border-b border-hairline bg-canvas flex-shrink-0">
        <button
          onPointerDown={(e) => { if (e.pointerType === "touch") { e.preventDefault(); setActiveTab("bill"); } }}
          onClick={() => setActiveTab("bill")}
          className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 border-b-2 -mb-[1px] transition-colors touch-manipulation ${
            activeTab === "bill" ? "border-primary text-primary" : "border-transparent text-muted"
          }`}
          style={{ WebkitTapHighlightColor: "transparent" }}>
          <span className="text-sm font-bold">🧾 Đơn ({order.items.length})</span>
          <span className="text-[11px] text-muted opacity-60">·</span>
          <span className="text-xs font-semibold tabular-nums">{formatPrice(order.totalAmount)}</span>
        </button>
        {isOpen && (
          <button
            onPointerDown={(e) => { if (e.pointerType === "touch") { e.preventDefault(); setActiveTab("products"); } }}
            onClick={() => setActiveTab("products")}
            className={`flex-1 py-2.5 text-sm font-bold border-b-2 -mb-[1px] transition-colors touch-manipulation ${
              activeTab === "products" ? "border-primary text-primary" : "border-transparent text-muted"
            }`}
            style={{ WebkitTapHighlightColor: "transparent" }}>
            + Thêm món
          </button>
        )}
      </div>

      {/* Main: 2-column layout (desktop) / tab content (mobile) */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── LEFT PANEL: Bill ─────────────────────────────── */}
        <div className={`${activeTab === "bill" ? "flex" : "hidden"} md:flex w-full md:w-96 flex-shrink-0 flex-col bg-canvas md:border-r border-hairline overflow-hidden`}>
          {/* Header — desktop only (mobile đã có tab bar) */}
          <div className="hidden md:flex px-4 py-2.5 border-b border-hairline items-center">
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-soft">
              Đơn hàng
              <span className="ml-1.5 bg-surface-card text-muted px-1.5 py-0.5 rounded-full text-[10px]">
                {order.items.length} món
              </span>
            </h2>
          </div>

          {/* QR code — ẩn/hiện */}
          {origin && order.tableQrToken && (
            <div className="mx-3 mt-2">
              <button
                onClick={() => setShowQR(v => !v)}
                className="w-full flex items-center justify-between px-3 py-2 bg-white border border-hairline rounded-xl hover:bg-surface-soft transition-colors touch-manipulation"
                style={{ WebkitTapHighlightColor: "transparent" }}>
                <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-soft">
                  <span>📱</span>
                  <span>QR cho khách xem đơn</span>
                </span>
                <span className="text-xs text-muted-soft select-none">{showQR ? "▲" : "▼"}</span>
              </button>
              {showQR && (
                <div className="mt-1 bg-white border border-hairline rounded-xl px-3 py-2.5 flex items-center gap-3">
                  <button
                    className="flex-shrink-0 cursor-pointer hover:opacity-75 transition-opacity touch-manipulation"
                    onClick={() => setQrZoom(true)}
                    style={{ WebkitTapHighlightColor: "transparent" }}>
                    <QRCodeSVG value={`${origin}/ban/${order.tableQrToken}`} size={56} level="M" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-ink leading-tight">Cho khách quét xem đơn</p>
                    <p className="text-[11px] text-muted-soft mt-0.5 leading-tight">Cập nhật theo thời gian thực</p>
                    <button
                      onClick={() => setQrZoom(true)}
                      className="text-[10px] text-primary font-semibold mt-0.5 touch-manipulation"
                      style={{ WebkitTapHighlightColor: "transparent" }}>
                      Bấm để phóng to →
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {order.note && (
            <div className="mx-3 mt-2 bg-yellow-50 border border-yellow-200 text-yellow-700 text-xs px-3 py-2 rounded-lg">
              📝 {order.note}
            </div>
          )}

          {/* Items list — min-h-0 bắt buộc để overflow-y-auto hoạt động trên iOS Safari */}
          <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2 space-y-1 pb-16 md:pb-4" style={{ overscrollBehavior: 'none' }}
            onPointerDown={(e) => { pointerDownPos.current = { x: e.clientX, y: e.clientY }; scrollMoved.current = false; }}
            onPointerMove={(e) => {
              const s = pointerDownPos.current;
              if (s && (Math.abs(e.clientX - s.x) > 8 || Math.abs(e.clientY - s.y) > 8)) scrollMoved.current = true;
            }}
            onClickCapture={(e) => { if (scrollMoved.current) { e.stopPropagation(); e.preventDefault(); } }}>
            {/* Bia Cốc — lưới ô ngang, mỗi đợt gọi là 1 ô */}
            {(drinkProducts.length > 0 || drinkItems.length > 0) && (
              <div className="mb-3 pb-3 border-b border-hairline">
                {/* Header */}
                <div className="flex items-center justify-between mb-2 px-1">
                  <h3 className="text-[11px] font-bold uppercase tracking-wide text-muted-soft">
                    🍺 Bia Cốc{drinkItems.length > 0 ? ` · ${drinkItems.length} đợt` : ""}
                  </h3>
                  {drinkTotal > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-soft">
                        {drinkItems.reduce((s, i) => s + i.quantity, 0)} cốc
                      </span>
                      <span className="text-xs font-bold text-primary">{formatPrice(drinkTotal)}</span>
                    </div>
                  )}
                </div>

                {/* Lưới item bia — chỉ hiện khi expanded */}
                {showBeerList && (
                  <div className="flex flex-wrap gap-3 px-1 mb-2">
                    {drinkItems.map((item) => {
                      const beerAdjusting = qtyLoadingId === item.id;
                      return (
                        <div key={item.id} className="relative bg-canvas border border-hairline rounded-xl">
                          {isOpen && (
                            <>
                              <button
                                onClick={() => removeItem(item.id, item.productName)}
                                disabled={removeLoadingId === item.id}
                                className="absolute -top-2 -right-2 w-5 h-5 flex items-center justify-center rounded-full bg-gray-200 hover:bg-red-400 hover:text-white text-gray-400 disabled:opacity-30 text-[10px] font-bold z-10 touch-manipulation"
                                style={{ WebkitTapHighlightColor: "transparent" }}>
                                ✕
                              </button>
                              <div className="flex items-center px-1.5 py-1.5 gap-0.5">
                                <button
                                  onClick={() => adjustQty(item, -1)}
                                  disabled={beerAdjusting || item.quantity <= 1}
                                  className="w-8 h-8 flex items-center justify-center rounded-lg text-sm font-bold text-gray-500 bg-surface-card disabled:opacity-30 touch-manipulation"
                                  style={{ WebkitTapHighlightColor: "transparent" }}>
                                  −
                                </button>
                                <div className="w-7 text-center text-sm font-bold text-ink tabular-nums">
                                  {beerAdjusting ? "…" : item.quantity}
                                </div>
                                <button
                                  onClick={() => adjustQty(item, +1)}
                                  disabled={beerAdjusting}
                                  className="w-8 h-8 flex items-center justify-center rounded-lg text-sm font-bold text-gray-500 bg-surface-card disabled:opacity-40 touch-manipulation"
                                  style={{ WebkitTapHighlightColor: "transparent" }}>
                                  +
                                </button>
                              </div>
                            </>
                          )}
                          {!isOpen && (
                            <div className="px-3 py-1.5 text-sm font-bold text-ink">{item.quantity}</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Hàng dưới: nút Thêm + mũi tên ẩn/hiện — luôn hiện */}
                <div className="flex items-center gap-2 px-1">
                  {isOpen && drinkProducts.length > 0 && (
                    <button
                      onClick={() => { setBeerAddQty(""); setShowBeerModal(true); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-dashed border-primary/50 bg-orange-50/60 hover:bg-orange-100 transition-colors touch-manipulation"
                      style={{ WebkitTapHighlightColor: "transparent" }}>
                      <span className="text-base font-bold text-primary leading-none">+</span>
                      <span className="text-xs font-semibold text-primary">Thêm</span>
                    </button>
                  )}
                  {drinkItems.length > 0 && (
                    <button
                      onClick={() => setShowBeerList(v => !v)}
                      className="ml-auto flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-muted-soft hover:text-ink hover:bg-surface-soft transition-colors touch-manipulation"
                      style={{ WebkitTapHighlightColor: "transparent" }}>
                      <span>{showBeerList ? "▲ Thu gọn" : `▼ ${drinkItems.length} đợt`}</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Món từ booking — chỉ đọc, không sửa được */}
            {bookingItems.length > 0 && (
              <div className="mb-3 pb-2 border-b border-hairline">
                <div className="flex items-center justify-between mb-1.5 px-1">
                  <h3 className="text-[11px] font-bold uppercase tracking-wide text-blue-500">
                    📋 Từ đặt bàn ({bookingItems.length} món)
                  </h3>
                  <span className="text-xs font-bold text-blue-500">{formatPrice(bookingTotal)}</span>
                </div>
                {bookingItems.map(item => {
                  const unitLabel = SALE_UNITS.find(u => u.value === item.saleUnit)?.label ?? item.saleUnit;
                  return (
                    <div key={item.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-blue-50/60">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-ink truncate">{item.productName}</div>
                        <div className="text-[10px] text-muted-soft">{formatPrice(item.productPrice)} / {unitLabel}</div>
                      </div>
                      <div className="text-xs text-muted-soft">×{item.quantity}</div>
                      <div className="text-xs font-bold text-ink">{formatPrice(item.itemTotal)}</div>
                      <span className="w-5 h-5 flex items-center justify-center text-blue-300 text-xs flex-shrink-0">🔒</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Phụ thu ngoài ý muốn */}
            {((order.surcharges?.length ?? 0) > 0 || isOpen) && (
              <div className="mb-3 pb-3 border-b border-hairline">
                <div className="flex items-center justify-between mb-2 px-1">
                  <h3 className="text-[11px] font-bold uppercase tracking-wide text-muted-soft">
                    ⚠️ Phụ thu{(order.surcharges?.length ?? 0) > 0 ? ` · ${order.surcharges!.length} khoản` : ""}
                  </h3>
                  <div className="flex items-center gap-2">
                    {(order.surcharges?.length ?? 0) > 0 && (
                      <span className="text-xs font-bold text-orange-600">
                        {formatPrice(order.surcharges!.reduce((s, c) => s + c.amount, 0))}
                      </span>
                    )}
                    {isOpen && (
                      <button
                        onClick={() => setShowSurchargeForm(v => !v)}
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 hover:bg-orange-200 transition-colors">
                        {showSurchargeForm ? "✕ Đóng" : "+ Thêm"}
                      </button>
                    )}
                  </div>
                </div>

                {/* Form thêm phụ thu */}
                {isOpen && showSurchargeForm && (
                  <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 mb-2 space-y-2">
                    <input
                      value={surName}
                      onChange={e => setSurName(e.target.value)}
                      placeholder="Tên khoản phụ thu (VD: Vỡ bát, Thêm cơm...)"
                      className="w-full border border-hairline rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-orange-400 bg-white"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        value={surPrice}
                        onChange={e => setSurPrice(e.target.value)}
                        placeholder="Đơn giá (VD: 20000)"
                        type="number"
                        min="0"
                        className="border border-hairline rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-orange-400 bg-white"
                      />
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-muted-soft whitespace-nowrap">SL:</span>
                        <button onClick={() => setSurQty(q => String(Math.max(1, parseInt(q||"1") - 1)))}
                          className="w-6 h-6 rounded bg-white border border-hairline text-sm font-bold text-gray-600 flex items-center justify-center flex-shrink-0">−</button>
                        <input value={surQty} onChange={e => setSurQty(e.target.value)} type="number" min="1"
                          className="w-12 border border-hairline rounded px-1 py-1 text-xs text-center outline-none focus:border-orange-400 bg-white" />
                        <button onClick={() => setSurQty(q => String((parseInt(q||"1") || 1) + 1))}
                          className="w-6 h-6 rounded bg-white border border-hairline text-sm font-bold text-gray-600 flex items-center justify-center flex-shrink-0">+</button>
                      </div>
                    </div>
                    <input
                      value={surReason}
                      onChange={e => setSurReason(e.target.value)}
                      placeholder="Lý do (không bắt buộc)"
                      className="w-full border border-hairline rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-orange-400 bg-white"
                    />
                    {surPrice && surName && (
                      <div className="text-xs text-orange-700 font-semibold text-right">
                        Thành tiền: {formatPrice((parseFloat(surPrice) || 0) * (parseInt(surQty) || 1))}
                      </div>
                    )}
                    <button
                      onClick={addSurcharge}
                      disabled={surLoading || !surName.trim() || !surPrice}
                      className="w-full py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-lg disabled:opacity-50 transition-colors">
                      {surLoading ? "Đang thêm..." : "Xác nhận thêm phụ thu"}
                    </button>
                  </div>
                )}

                {/* Danh sách phụ thu */}
                {(order.surcharges ?? []).map(sc => (
                  <div key={sc.id} className="flex items-start gap-2 py-1.5 px-2 rounded-lg hover:bg-orange-50/60 group">
                    <div className="text-orange-400 text-sm mt-0.5 flex-shrink-0">⚠️</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-ink">{sc.name}</div>
                      <div className="text-[10px] text-muted-soft">
                        {formatPrice(sc.unitPrice)} × {sc.quantity}
                        {sc.reason && ` · ${sc.reason}`}
                      </div>
                    </div>
                    <div className="text-xs font-bold text-orange-700 flex-shrink-0">{formatPrice(sc.amount)}</div>
                    {isOpen && (
                      <button
                        onClick={() => removeSurcharge(sc.id, sc.name)}
                        disabled={removingSurId === sc.id}
                        className="w-9 h-9 flex items-center justify-center text-red-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors disabled:opacity-30 flex-shrink-0 touch-manipulation"
                        style={{ WebkitTapHighlightColor: "transparent" }}>
                        ✕
                      </button>
                    )}
                  </div>
                ))}

                {(order.surcharges?.length ?? 0) === 0 && !showSurchargeForm && (
                  <div className="text-center py-2 text-[10px] text-muted-soft">
                    Không có phụ thu
                  </div>
                )}
              </div>
            )}

            {foodItems.length === 0 && drinkItems.length === 0 && bookingItems.length === 0 ? (
              <div className="text-center py-6 text-muted-soft text-sm">
                <div className="text-4xl mb-3">🍽️</div>
                <div>Chưa có món nào</div>
                <div className="text-xs mt-1">Chọn món ở bên phải hoặc thêm bia nhanh ở trên</div>
              </div>
            ) : (
              <div className="divide-y divide-hairline">
                {foodItems.map(item => {
                  const isAdjusting = qtyLoadingId === item.id;
                  const isRemoving = removeLoadingId === item.id;
                  const unitLabel = SALE_UNITS.find(u => u.value === item.saleUnit)?.label ?? item.saleUnit;
                  const catIcon = item.category ? (CATEGORY_ICONS[item.category] ?? "🍽️") : "🍽️";
                  return (
                    <div key={item.id} className="flex items-center gap-3 py-3 px-1">
                      {/* Category icon */}
                      <div className="w-11 h-11 rounded-xl bg-surface-soft flex items-center justify-center text-xl flex-shrink-0 select-none">
                        {catIcon}
                      </div>

                      {/* Tên + đơn giá */}
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-ink text-sm leading-snug line-clamp-2">
                          {item.productName}
                        </div>
                        <div className="text-xs text-muted-soft mt-0.5">
                          {formatPrice(item.productPrice)}/{unitLabel}
                        </div>
                      </div>

                      {/* Tổng + stepper */}
                      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                        <div className={`text-sm font-bold ${isAdjusting ? "text-muted-soft" : "text-primary"}`}>
                          {formatPrice(item.itemTotal)}
                        </div>
                        {isOpen ? (
                          <div className="flex items-center gap-0.5">
                            <button
                              onClick={() => adjustQty(item, -1)}
                              disabled={isAdjusting || item.quantity <= 1}
                              className="w-9 h-9 rounded-full bg-surface-card border border-hairline text-base font-bold text-gray-600 hover:bg-hairline disabled:opacity-30 flex items-center justify-center leading-none touch-manipulation"
                              style={{ WebkitTapHighlightColor: "transparent" }}>
                              −
                            </button>
                            <span className={`w-7 text-center text-sm font-bold tabular-nums ${isAdjusting ? "opacity-40" : "text-ink"}`}>
                              {isAdjusting ? "…" : item.quantity}
                            </span>
                            <button
                              onClick={() => adjustQty(item, +1)}
                              disabled={isAdjusting}
                              className="w-9 h-9 rounded-full bg-surface-card border border-hairline text-base font-bold text-gray-600 hover:bg-hairline disabled:opacity-40 flex items-center justify-center leading-none touch-manipulation"
                              style={{ WebkitTapHighlightColor: "transparent" }}>
                              +
                            </button>
                            <button
                              onClick={() => removeItem(item.id, item.productName)}
                              disabled={isRemoving || isAdjusting}
                              className="w-9 h-9 flex items-center justify-center text-red-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors disabled:opacity-30 ml-0.5 touch-manipulation"
                              style={{ WebkitTapHighlightColor: "transparent" }}>
                              {isRemoving ? "…" : "🗑"}
                            </button>
                          </div>
                        ) : (
                          <div className="text-xs text-muted-soft">×{item.quantity}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="h-28 md:hidden" aria-hidden />
          </div>

          {/* Toggle + payment — fixed bottom trên mobile (above nav), static trên desktop */}
          <div className="fixed bottom-16 left-0 right-0 z-20 md:static md:flex-shrink-0 bg-canvas shadow-[0_-4px_12px_rgba(0,0,0,0.08)] border-t border-hairline">

          {/* Payment panel toggle bar — luôn hiện */}
          <button
            onClick={() => setShowPayment(v => !v)}
            className="px-4 py-2.5 flex items-center justify-between w-full bg-canvas active:bg-surface-soft transition-colors touch-manipulation"
            style={{ WebkitTapHighlightColor: "transparent" }}>
            <div className="flex items-baseline gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-soft">Thanh toán</span>
              {netRefund > 0 ? (
                <span className="text-sm font-bold text-amber-700">{formatPrice(netRefund)} hoàn khách</span>
              ) : trueRemaining > 0 ? (
                <span className="text-sm font-bold text-primary">
                  {completedPayments.length > 0 ? `Còn ${formatPrice(trueRemaining)}` : `Thu ${formatPrice(trueRemaining)}`}
                </span>
              ) : (
                <span className="text-sm font-bold text-green-600">✓ Đã đủ tiền</span>
              )}
            </div>
            <span className="text-sm text-muted-soft select-none leading-none">{showPayment ? "▼" : "▲"}</span>
          </button>

          {/* Total + payment panel — collapsible, cuộn được trên mobile */}
          {showPayment && <div className="border-t border-hairline p-3 space-y-2.5 max-h-[50vh] overflow-y-auto md:max-h-none md:overflow-visible"
            style={{ overscrollBehavior: 'none' }}
            onPointerDown={(e) => { pointerDownPos.current = { x: e.clientX, y: e.clientY }; scrollMoved.current = false; }}
            onPointerMove={(e) => {
              const s = pointerDownPos.current;
              if (s && (Math.abs(e.clientX - s.x) > 8 || Math.abs(e.clientY - s.y) > 8)) scrollMoved.current = true;
            }}
            onClickCapture={(e) => { if (scrollMoved.current) { e.stopPropagation(); e.preventDefault(); } }}>
            {/* Tổng tiền */}
            <div className="space-y-1">
              <div className="flex justify-between text-sm text-muted">
                <span>Tạm tính</span>
                <span>{formatPrice(order.totalAmount)}</span>
              </div>
              {prepaid > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Đã cọc</span>
                  <span>− {formatPrice(prepaid)}</span>
                </div>
              )}
              {completedPayments.length > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Đã thu</span>
                  <span>− {formatPrice(sumCompleted)}</span>
                </div>
              )}
              {netRefund > 0 ? (
                refundPayment ? (
                  <div className="flex justify-between font-bold text-base border-t border-hairline pt-1.5 text-green-700">
                    <span>Đã hoàn khách</span>
                    <span>{formatPrice(netRefund)}</span>
                  </div>
                ) : (
                  <div className="flex justify-between font-bold text-base border-t border-hairline pt-1.5 text-amber-700">
                    <span>Hoàn lại khách</span>
                    <span>{formatPrice(netRefund)}</span>
                  </div>
                )
              ) : (
                <div className="flex justify-between font-bold text-base border-t border-hairline pt-1.5">
                  <span className="text-ink">{trueRemaining > 0 ? "Còn lại" : "✓ Đủ tiền"}</span>
                  <span className={trueRemaining > 0 ? "text-primary" : "text-green-600"}>
                    {trueRemaining > 0 ? formatPrice(trueRemaining) : formatPrice(order.totalAmount - prepaid)}
                  </span>
                </div>
              )}
            </div>

            {/* Danh sách các lần thanh toán đã hoàn thành (khi split) */}
            {completedPayments.length > 0 && (
              <div className="space-y-1">
                {completedPayments.map(p => (
                  <div key={p.id} className="flex items-center justify-between text-xs bg-green-50 rounded-lg px-2.5 py-1.5">
                    <span className="text-green-700 font-semibold">
                      {p.paymentMethod === "CASH" ? "💵 Tiền mặt" : "📱 Chuyển khoản"}
                    </span>
                    <span className="text-green-700 font-bold tabular-nums">✓ {formatPrice(p.amount)}</span>
                  </div>
                ))}
              </div>
            )}

            {isOpen && (
              <>
                {/* Banner hoàn tiền */}
                {netRefund > 0 && !refundPayment && (
                  <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 space-y-2">
                    <p className="text-xs font-bold text-amber-800">
                      💰 Cần hoàn lại <span className="text-base">{formatPrice(netRefund)}</span> cho khách
                    </p>
                    <button
                      onClick={processRefund}
                      disabled={refundLoading}
                      className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg text-sm disabled:opacity-50 transition-colors">
                      {refundLoading ? "Đang xử lý..." : "✓ Xác nhận đã hoàn tiền cho khách"}
                    </button>
                  </div>
                )}
                {netRefund > 0 && refundPayment && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-2.5 text-center">
                    <p className="text-green-700 font-bold text-sm">✓ Đã hoàn tiền cho khách</p>
                    <p className="text-xs text-green-600 mt-0.5">{formatPrice(refundPayment.amount)} đã hoàn</p>
                  </div>
                )}

                {/* Chưa có payment PENDING — hiện nút thêm phương thức (khi còn tiền) */}
                {!pendingPayment && trueRemaining > 0 && netRefund <= 0 && (
                  <div className={`space-y-1.5 transition-opacity ${order.totalAmount > 0 ? "" : "opacity-40 pointer-events-none"}`}>
                    {completedPayments.length > 0 && (
                      <p className="text-[10px] font-semibold text-center text-muted-soft">
                        + Thêm phương thức thu {formatPrice(trueRemaining)} còn lại
                      </p>
                    )}
                    {/* Nhập số tiền một phần (optional) */}
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        value={partialAmount}
                        onChange={e => setPartialAmount(e.target.value)}
                        placeholder={`Mặc định: ${formatPrice(trueRemaining)}`}
                        className="flex-1 border border-hairline rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-primary bg-white tabular-nums"
                        min="1"
                        step="1000"
                      />
                      {partialAmount && (
                        <button onClick={() => setPartialAmount("")}
                          className="text-muted-soft hover:text-gray-600 text-xs px-1.5">✕</button>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-soft text-center -mt-0.5">
                      Để trống = thu toàn bộ {formatPrice(trueRemaining)} còn lại
                    </p>
                    {!completedPayments.length && (
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-soft text-center">
                        Chọn phương thức thu tiền
                      </p>
                    )}
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        onClick={() => createPayment("CASH")}
                        disabled={payLoading}
                        className="flex flex-col items-center gap-1 py-2.5 rounded-xl border-2 border-hairline bg-canvas hover:border-green-400 hover:bg-green-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold text-ink">
                        <span className="text-lg">💵</span>
                        <span>Tiền mặt</span>
                      </button>
                      <button
                        onClick={() => createPayment("BANK_TRANSFER")}
                        disabled={payLoading}
                        className="flex flex-col items-center gap-1 py-2.5 rounded-xl border-2 border-hairline bg-canvas hover:border-blue-400 hover:bg-blue-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold text-ink">
                        <span className="text-lg">📱</span>
                        <span>Chuyển khoản</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Đã có payment PENDING — hiện UI xác nhận */}
                {pendingPayment && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-1 p-1 bg-surface-soft rounded-xl">
                      <button
                        onClick={() => pendingPayment.paymentMethod !== "CASH" && switchMethod("CASH")}
                        disabled={payLoading}
                        className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${
                          pendingPayment.paymentMethod === "CASH"
                            ? "bg-canvas shadow text-green-700 border border-green-200"
                            : "text-muted hover:text-ink"
                        }`}>
                        💵 Tiền mặt
                      </button>
                      <button
                        onClick={() => pendingPayment.paymentMethod !== "BANK_TRANSFER" && switchMethod("BANK_TRANSFER")}
                        disabled={payLoading}
                        className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${
                          pendingPayment.paymentMethod === "BANK_TRANSFER"
                            ? "bg-canvas shadow text-blue-700 border border-blue-200"
                            : "text-muted hover:text-ink"
                        }`}>
                        📱 Chuyển khoản
                      </button>
                    </div>

                    {pendingPayment.paymentMethod === "BANK_TRANSFER" && pendingPayment.vietQrUrl && (
                      <div className="bg-blue-50 rounded-xl p-2 text-center space-y-1.5">
                        <p className="text-[10px] text-blue-600 font-semibold uppercase tracking-wide">
                          Quét mã chuyển khoản{completedPayments.length > 0 ? ` · ${formatPrice(pendingPayment.amount)}` : ""}
                        </p>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={pendingPayment.vietQrUrl}
                          alt="VietQR"
                          className="w-32 h-32 mx-auto rounded-lg border border-blue-100 cursor-zoom-in active:scale-95 transition-transform touch-manipulation"
                          onClick={() => setPaymentQrZoom(true)}
                          onPointerDown={e => { if (e.pointerType === "touch") { e.preventDefault(); setPaymentQrZoom(true); } }}
                        />
                        <div className="flex items-center justify-center gap-2">
                          <p className="text-[10px] text-blue-400">Đang tự kiểm tra mỗi 4 giây...</p>
                          <button
                            onClick={load}
                            className="text-[10px] text-blue-600 font-semibold underline touch-manipulation">
                            🔄 Kiểm tra ngay
                          </button>
                        </div>
                      </div>
                    )}

                    {pendingPayment.paymentMethod === "CASH" && (
                      <button
                        onClick={confirmCash}
                        disabled={payLoading}
                        className="w-full py-2.5 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl text-sm disabled:opacity-50 transition-colors">
                        {payLoading ? "Đang xử lý..." : `✓ Xác nhận thu ${formatPrice(pendingPayment.amount)}`}
                      </button>
                    )}
                  </div>
                )}

                {/* Đã thanh toán đủ — không còn pending, không còn remaining */}
                {!pendingPayment && trueRemaining <= 0 && netRefund <= 0 && completedPayments.length > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-2.5 text-center">
                    <p className="text-green-700 font-bold text-sm">✓ Đã thanh toán đủ</p>
                    <p className="text-xs text-green-600 mt-0.5">{formatPrice(sumCompleted + prepaid)} tổng thu</p>
                  </div>
                )}
              </>
            )}

            {!isOpen && (
              <div className="text-center text-sm text-muted-soft py-2">Đơn đã kết thúc</div>
            )}

            {canCancel && (
              <button
                onClick={cancelOrder}
                disabled={cancelLoading}
                className="w-full py-1.5 text-xs text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg border border-transparent hover:border-red-200 transition-colors disabled:opacity-40">
                {cancelLoading ? "Đang hủy..." : `🚫 Hủy đơn — giải phóng bàn${netRefund > 0 ? ` (hoàn ${formatPrice(netRefund)})` : ""}`}
              </button>
            )}
            <Link href={backHref}
              className="block text-center text-xs text-muted-soft hover:text-gray-600 py-1">
              ← {backHref === "/employee/don-hang" ? "Quay lại đơn hàng" : "Quay lại sơ đồ bàn"}
            </Link>
          </div>}

          </div>{/* end toggle+payment wrapper */}
        </div>

        {/* ── RIGHT PANEL: Product Picker ──────────────────── */}
        {isOpen ? (
          <div className={`${activeTab === "products" ? "flex" : "hidden"} md:flex flex-1 flex-col overflow-hidden`}>

            {/* Search + Category filter */}
            <div className="px-4 pt-3 pb-2 bg-canvas border-b border-hairline flex-shrink-0">
              <div className="relative mb-2.5">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-soft text-base">🔍</span>
                <input
                  ref={searchRef}
                  value={search}
                  onChange={e => { setSearch(e.target.value); setActiveCategory("ALL"); }}
                  placeholder="Tìm tên món..."
                  className="w-full pl-9 pr-9 py-2.5 border border-hairline rounded-xl text-sm outline-none focus:border-primary bg-white"
                />
                {search && (
                  <button onClick={() => setSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-soft hover:text-gray-600 text-sm">
                    ✕
                  </button>
                )}
              </div>

              {/* Category chips */}
              <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    onClick={() => { setActiveCategory(cat); setSearch(""); }}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors flex-shrink-0 ${
                      activeCategory === cat
                        ? "bg-primary text-white shadow-sm"
                        : "bg-surface-card text-muted hover:bg-hairline"
                    }`}>
                    <span>{CATEGORY_ICONS[cat]}</span>
                    <span>{CATEGORY_LABELS[cat]}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Product cards grid */}
            <div className="flex-1 overflow-y-auto p-3">
              {productsLoading ? (
                <div className="text-center py-16 text-muted-soft text-sm">Đang tải sản phẩm...</div>
              ) : filteredProducts.length === 0 ? (
                <div className="text-center py-16 text-muted-soft text-sm">
                  <div className="text-3xl mb-2">🔍</div>
                  Không tìm thấy món nào
                </div>
              ) : (
                <div className="grid grid-cols-3 xl:grid-cols-4 gap-2">
                  {filteredProducts.map(p => {
                    const isSelected = selectedProduct?.id === p.id;
                    return (
                      <button
                        key={p.id}
                        onClick={() => handleSelectProduct(p)}
                        className={`relative text-left rounded-xl border-2 overflow-hidden transition-all active:scale-95 ${
                          isSelected
                            ? "border-primary bg-orange-50 shadow-md"
                            : "border-transparent bg-canvas hover:border-hairline hover:shadow-sm"
                        }`}>
                        {isSelected && (
                          <div className="absolute top-1.5 right-1.5 z-10 w-5 h-5 bg-primary rounded-full flex items-center justify-center shadow">
                            <span className="text-white text-[10px] font-bold">✓</span>
                          </div>
                        )}
                        {/* Ảnh sản phẩm */}
                        <div className="w-full aspect-[4/3] bg-surface-soft overflow-hidden">
                          {p.imageUrl ? (
                            <img
                              src={p.imageUrl}
                              alt={p.name}
                              className="w-full h-full object-cover"
                              onError={(e) => { e.currentTarget.style.display = "none"; (e.currentTarget.nextElementSibling as HTMLElement | null)?.classList.remove("hidden"); }}
                            />
                          ) : null}
                          <div className={`w-full h-full flex items-center justify-center text-2xl bg-surface-soft ${p.imageUrl ? "hidden" : ""}`}>
                            {CATEGORY_ICONS[p.category]}
                          </div>
                        </div>
                        {/* Info */}
                        <div className="p-2">
                          <div className="text-xs font-semibold text-ink leading-snug line-clamp-2 min-h-[2rem]">
                            {p.name}
                          </div>
                          <div className="text-xs font-bold text-primary mt-1">
                            {formatPrice(p.price)}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Bottom action bar — desktop only */}
            <div className={`hidden md:block border-t-2 transition-all duration-200 flex-shrink-0 ${
              selectedProduct
                ? "border-primary/30 bg-orange-50 opacity-100"
                : "border-transparent bg-transparent opacity-0 pointer-events-none"
            }`}>
              {selectedProduct && (
                <div className="px-4 py-3 flex items-center gap-3 flex-wrap">
                  {/* Thumbnail + Product info */}
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    {selectedProduct.imageUrl ? (
                      <img src={selectedProduct.imageUrl} alt={selectedProduct.name}
                        className="w-12 h-12 object-cover rounded-lg border border-primary/20 flex-shrink-0" />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-surface-soft flex items-center justify-center text-xl flex-shrink-0">
                        {CATEGORY_ICONS[selectedProduct.category]}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="font-bold text-ink text-sm truncate">{selectedProduct.name}</div>
                      <div className="text-primary font-bold text-base">
                        {formatPrice(selectedProduct.price * qty)}
                      </div>
                    </div>
                  </div>

                  {/* Quantity stepper */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setQty(q => Math.max(1, q - 1))}
                      className="w-10 h-10 rounded-full bg-canvas border border-hairline text-xl font-bold text-gray-600 hover:bg-surface-card flex items-center justify-center">
                      −
                    </button>
                    <div className="w-10 text-center text-lg font-bold text-ink">{qty}</div>
                    <button
                      onClick={() => setQty(q => q + 1)}
                      className="w-10 h-10 rounded-full bg-canvas border border-hairline text-xl font-bold text-gray-600 hover:bg-surface-card flex items-center justify-center">
                      +
                    </button>
                  </div>

                  {/* Add button */}
                  <button
                    onClick={addItem}
                    disabled={addLoading}
                    className="px-8 py-2.5 bg-primary hover:bg-primary-dark text-white font-bold rounded-xl text-sm disabled:opacity-50 transition-colors whitespace-nowrap">
                    {addLoading ? "Đang thêm..." : "Thêm vào đơn"}
                  </button>

                  {/* Dismiss */}
                  <button
                    onClick={() => setSelectedProduct(null)}
                    className="w-8 h-8 flex items-center justify-center text-muted-soft hover:text-gray-600 hover:bg-surface-card rounded-full">
                    ✕
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Order closed — read-only right panel */
          <div className={`${activeTab === "products" ? "flex" : "hidden"} md:flex flex-1 items-center justify-center`}>
            <div className="text-center text-muted-soft text-sm">
              <div className="text-3xl mb-2">🔒</div>
              Đơn hàng đã đóng — không thể thêm món
            </div>
          </div>
        )}
      </div>

      {/* Mobile: bottom sheet thêm món — hiện khi có selectedProduct */}
      {selectedProduct && (
        <div className="md:hidden fixed inset-0 z-50 flex items-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setSelectedProduct(null)} />

          {/* Sheet */}
          <div className="relative w-full bg-canvas rounded-t-3xl shadow-2xl z-10 pb-safe">
            {/* Drag handle */}
            <div className="w-12 h-1.5 rounded-full bg-hairline mx-auto mt-3 mb-4" />

            <div className="px-5 pb-6">
              {/* Product info row */}
              <div className="flex items-center gap-3 mb-5">
                <div className="w-16 h-16 rounded-2xl bg-surface-soft overflow-hidden flex-shrink-0">
                  {selectedProduct.imageUrl ? (
                    <img src={selectedProduct.imageUrl} alt={selectedProduct.name}
                      className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-2xl">
                      {CATEGORY_ICONS[selectedProduct.category]}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-ink text-base leading-snug line-clamp-2">
                    {selectedProduct.name}
                  </div>
                  <div className="text-primary font-bold text-base mt-0.5">
                    {formatPrice(selectedProduct.price)} / {SALE_UNITS.find(u => u.value === saleUnit)?.label ?? saleUnit ?? "Phần"}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedProduct(null)}
                  className="w-9 h-9 flex items-center justify-center rounded-full bg-surface-card text-muted-soft text-base flex-shrink-0 touch-manipulation"
                  style={{ WebkitTapHighlightColor: "transparent" }}>
                  ✕
                </button>
              </div>

              {/* Quantity stepper */}
              <div className="mb-6">
                <div className="text-xs font-semibold text-muted uppercase tracking-wide mb-3">Số lượng</div>
                <div className="flex items-center justify-center gap-6">
                  <button
                    onClick={() => setQty(q => Math.max(1, q - 1))}
                    className="w-14 h-14 rounded-full bg-surface-card border-2 border-hairline text-3xl font-light text-gray-700 flex items-center justify-center touch-manipulation"
                    style={{ WebkitTapHighlightColor: "transparent" }}>
                    −
                  </button>
                  <span className="w-16 text-center text-4xl font-bold text-ink tabular-nums">{qty}</span>
                  <button
                    onClick={() => setQty(q => q + 1)}
                    className="w-14 h-14 rounded-full bg-surface-card border-2 border-hairline text-3xl font-light text-gray-700 flex items-center justify-center touch-manipulation"
                    style={{ WebkitTapHighlightColor: "transparent" }}>
                    +
                  </button>
                </div>
              </div>

              {/* Add button */}
              <button
                onClick={addItem}
                disabled={addLoading}
                className="w-full py-4 bg-primary text-white font-bold text-base rounded-2xl disabled:opacity-50 touch-manipulation"
                style={{ WebkitTapHighlightColor: "transparent" }}>
                {addLoading
                  ? "Đang thêm..."
                  : `Thêm vào đơn · ${formatPrice(selectedProduct.price * qty)}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment VietQR Zoom Lightbox */}
      {paymentQrZoom && pendingPayment?.vietQrUrl && (
        <div
          className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-6"
          onClick={() => setPaymentQrZoom(false)}
        >
          <div className="relative" onClick={e => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={pendingPayment.vietQrUrl} alt="VietQR" className="w-72 h-72 rounded-2xl shadow-2xl" />
            <button
              onClick={() => setPaymentQrZoom(false)}
              className="absolute -top-3 -right-3 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center text-gray-700 font-bold text-lg touch-manipulation"
            >×</button>
          </div>
        </div>
      )}

      {/* QR Zoom Modal */}
      {qrZoom && order.tableQrToken && origin && (
        <div
          className="fixed inset-0 z-[100] bg-black/85 flex items-center justify-center px-4"
          onClick={() => setQrZoom(false)}>
          <div
            className="bg-white rounded-3xl shadow-2xl p-6 flex flex-col items-center gap-4 w-full max-w-xs"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between w-full">
              <p className="text-sm font-bold text-gray-800">{tableName}</p>
              <button
                onClick={() => setQrZoom(false)}
                className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 text-base touch-manipulation"
                style={{ WebkitTapHighlightColor: "transparent" }}>
                ✕
              </button>
            </div>
            <div className="p-3 bg-white rounded-2xl border border-gray-100 shadow-inner">
              <QRCodeSVG value={`${origin}/ban/${order.tableQrToken}`} size={240} level="M" />
            </div>
            <p className="text-xs text-gray-400 text-center">Cho khách quét để theo dõi đơn theo thời gian thực</p>
          </div>
        </div>
      )}

      {/* Modal numpad thêm bia */}
      {showBeerModal && drinkProducts.length > 0 && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setShowBeerModal(false)}>
          <div
            className="bg-white rounded-2xl shadow-2xl p-5 w-[260px]"
            onClick={e => e.stopPropagation()}>
            <div className="text-center mb-3">
              <div className="text-base font-bold text-ink">🍺 Thêm đợt bia cốc</div>
              <div className="text-xs text-muted-soft mt-0.5">Nhập số cốc rồi bấm Enter</div>
            </div>

            {/* Màn hiển thị số */}
            <div className="bg-surface-soft rounded-xl px-4 py-3 text-center mb-3">
              <span className="text-4xl font-bold text-ink tracking-widest">
                {beerAddQty || "0"}
              </span>
              <span className="text-lg text-muted-soft ml-2">cốc</span>
            </div>

            {/* Bàn phím số */}
            <div className="grid grid-cols-3 gap-2 mb-2">
              {["1","2","3","4","5","6","7","8","9"].map(n => (
                <button
                  key={n}
                  onClick={() => setBeerAddQty(prev => (prev === "0" ? n : prev + n))}
                  className="h-12 rounded-xl bg-surface-card hover:bg-hairline text-lg font-bold text-ink transition-colors active:scale-95">
                  {n}
                </button>
              ))}
              <button
                onClick={() => setBeerAddQty("")}
                className="h-12 rounded-xl bg-surface-card hover:bg-hairline text-sm font-bold text-muted transition-colors active:scale-95">
                C
              </button>
              <button
                onClick={() => setBeerAddQty(prev => (prev === "0" ? "0" : prev + "0"))}
                className="h-12 rounded-xl bg-surface-card hover:bg-hairline text-lg font-bold text-ink transition-colors active:scale-95">
                0
              </button>
              <button
                onClick={() => setBeerAddQty(prev => prev.slice(0, -1))}
                className="h-12 rounded-xl bg-surface-card hover:bg-hairline text-base font-bold text-muted transition-colors active:scale-95">
                ⌫
              </button>
            </div>

            {/* Nút Enter */}
            <button
              onClick={() => {
                const qty = parseInt(beerAddQty) || 0;
                if (qty > 0) quickAddBeer(drinkProducts[0], qty);
              }}
              disabled={!beerAddQty || parseInt(beerAddQty) < 1 || quickAddLoadingId !== null}
              onKeyDown={e => { if (e.key === "Enter") {
                const qty = parseInt(beerAddQty) || 0;
                if (qty > 0) quickAddBeer(drinkProducts[0], qty);
              }}}
              className="w-full h-12 rounded-xl bg-primary hover:bg-primary-dark text-white font-bold text-base disabled:opacity-40 transition-colors">
              {quickAddLoadingId !== null ? "Đang thêm…" : "✓ Thêm vào đơn"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
