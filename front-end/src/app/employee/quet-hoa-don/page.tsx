"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { getAuthHeaders } from "@/lib/auth";
import { formatPrice, extractApiError } from "@/lib/utils";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";

interface Product { id: number; name: string; price: number; category: string; status: string; }
interface TableItem { id: number; name: string; tableNumber: number; status: string; }
interface ScannedItem {
  key: string;
  rawText: string;
  productId: number | null;
  productName: string;
  quantity: number;
  saleUnit: string;
  confidence: "high" | "low" | "none";
}
interface SurchargeInput {
  key: string; name: string; unitPrice: string; quantity: string; reason: string;
}

type Step = "capture" | "analyzing" | "review";
interface PaymentInfo { id: number; amount: number; paymentMethod: string; status: string; vietQrUrl?: string; }

export default function QuetHoaDonPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [step, setStep] = useState<Step>("capture");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string>("");
  const [imageMime, setImageMime] = useState<string>("image/jpeg");
  const [analyzeError, setAnalyzeError] = useState("");

  const [items, setItems] = useState<ScannedItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [tables, setTables] = useState<TableItem[]>([]);
  const [tableId, setTableId] = useState<number | "">("");

  // Trạng thái chọn thủ công cho item "chưa đúng"
  const [manualSelectKey, setManualSelectKey] = useState<string | null>(null);
  const [showBeerList, setShowBeerList] = useState(false);
  const [showAddBeer, setShowAddBeer] = useState(false);
  const [pendingBeerProduct, setPendingBeerProduct] = useState<Product | null>(null);
  const [pendingBeerQty, setPendingBeerQty] = useState("1");

  const [surcharges, setSurcharges] = useState<SurchargeInput[]>([]);
  const [showSurForm, setShowSurForm] = useState(false);
  const [surName, setSurName] = useState("");
  const [surPrice, setSurPrice] = useState("");
  const [surQty, setSurQty] = useState("1");
  const [surReason, setSurReason] = useState("");

  const [showTableSelect, setShowTableSelect] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [createdOrderId, setCreatedOrderId] = useState<number | null>(null);
  const [createdPayment, setCreatedPayment] = useState<PaymentInfo | null>(null);
  const [allPayments, setAllPayments] = useState<PaymentInfo[]>([]);
  const [partialAmount, setPartialAmount] = useState("");
  const [payLoading, setPayLoading] = useState(false);
  const [showPaymentPanel, setShowPaymentPanel] = useState(false);
  const [showQrZoom, setShowQrZoom] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  // Add-item bottom sheet
  const [showAddSheet, setShowAddSheet]     = useState(false);
  const [addSheetSearch, setAddSheetSearch] = useState("");
  const [addSheetCat, setAddSheetCat]       = useState<"ALL" | "FOOD" | "DRINK">("ALL");
  const [addSheetProduct, setAddSheetProduct] = useState<Product | null>(null);
  const [addSheetQty, setAddSheetQty]       = useState(1);
  const [addSheetUnit, setAddSheetUnit]     = useState("PORTION");
  const [addSheetTargetKey, setAddSheetTargetKey] = useState<string | null>(null);

  const SESSION_KEY = "quet-hoa-don-state";

  // Khôi phục toàn bộ state review khi reload trang
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SESSION_KEY);
      if (saved) {
        const s = JSON.parse(saved);
        if (s.items?.length > 0) {
          setItems(s.items);
          setStep("review");
          if (s.surcharges) setSurcharges(s.surcharges);
          if (s.tableId !== undefined) setTableId(s.tableId);
          if (s.createdOrderId) setCreatedOrderId(s.createdOrderId);
          if (s.createdPayment) setCreatedPayment(s.createdPayment);
          if (s.allPayments) setAllPayments(s.allPayments);
          if (s.showPaymentPanel !== undefined) setShowPaymentPanel(s.showPaymentPanel);
        }
      }
    } catch {}
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Lưu toàn bộ state review vào localStorage mỗi khi thay đổi
  useEffect(() => {
    if (step === "review") {
      try {
        localStorage.setItem(SESSION_KEY, JSON.stringify({
          items, surcharges, tableId,
          createdOrderId, createdPayment, allPayments, showPaymentPanel,
        }));
      } catch {}
    }
  }, [items, step, surcharges, tableId, createdOrderId, createdPayment, showPaymentPanel]);

  useEffect(() => {
    fetch(`${BASE}/products?status=AVAILABLE&size=200`, { headers: getAuthHeaders() })
      .then(r => r.json()).then(json => {
        const list: Product[] = json.data?.content ?? json.data ?? [];
        setProducts(list.filter(p => p.status === "AVAILABLE"));
      });
    fetch(`${BASE}/orders/tables`, { headers: getAuthHeaders() })
      .then(r => r.json()).then(json => {
        const list: TableItem[] = json.data?.content ?? json.data ?? [];
        setTables(list.filter(t => t.status === "AVAILABLE"));
      });
  }, []);

  // Scroll về đầu khi chuyển step
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [step]);

  // Nếu bị stuck ở "analyzing" (tab switch / back button), reset về capture
  const stepRef = useRef(step);
  useEffect(() => { stepRef.current = step; }, [step]);
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && stepRef.current === "analyzing") {
        setStep("capture");
        setAnalyzeError("Phân tích bị gián đoạn, vui lòng thử lại.");
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  // Auto-poll mỗi 4 giây khi đang chờ BANK_TRANSFER Sepay webhook
  const pendingBtId = allPayments.find(p => p.status === "PENDING" && p.paymentMethod === "BANK_TRANSFER")?.id
    ?? (createdPayment?.status === "PENDING" && createdPayment.paymentMethod === "BANK_TRANSFER" ? createdPayment.id : null);
  useEffect(() => {
    if (!pendingBtId || !createdOrderId) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${BASE}/payments/orders/${createdOrderId}/all`, { headers: getAuthHeaders() });
        const json = await res.json();
        if (json.statusCode === 200 && Array.isArray(json.data)) {
          const list: PaymentInfo[] = json.data;
          setAllPayments(list);
          const pending = list.find((p: PaymentInfo) => p.status === "PENDING") ?? null;
          setCreatedPayment(pending ?? list[list.length - 1] ?? null);
        }
      } catch {}
    }, 4000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingBtId, createdOrderId]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageMime(file.type || "image/jpeg");
    const reader = new FileReader();
    reader.onload = ev => {
      const dataUrl = ev.target?.result as string;
      setImagePreview(dataUrl);
      setImageBase64(dataUrl.split(",")[1] ?? "");
    };
    reader.readAsDataURL(file);
  }

  async function analyzeImage() {
    if (!imageBase64) return;
    setStep("analyzing");
    setAnalyzeError("");
    try {
      const res = await fetch("/api/scan-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64, mimeType: imageMime }),
      });
      const json = await res.json();
      if (!res.ok || json.error) { setAnalyzeError(json.error ?? "Phân tích thất bại"); setStep("capture"); return; }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mapped: ScannedItem[] = (json.items ?? []).map((it: any, i: number) => ({
        key: `item-${i}-${Date.now()}`,
        rawText: it.rawText ?? "",
        productId: it.productId ?? null,
        productName: it.productName ?? "",
        quantity: Math.max(1, it.quantity ?? 1),
        saleUnit: it.saleUnit ?? "PORTION",
        confidence: it.productId ? (it.confidence === "low" ? "low" : "high") : "none",
      }));
      setItems(mapped);
      setStep("review");
    } catch { setAnalyzeError("Không kết nối được máy chủ"); setStep("capture"); }
  }

  function updateQty(key: string, delta: number) {
    setItems(prev => prev.map(it => it.key === key ? { ...it, quantity: Math.max(1, it.quantity + delta) } : it));
  }
  function confirmItem(key: string) {
    setItems(prev => prev.map(it => it.key === key ? { ...it, confidence: "high" } : it));
  }
  function rejectItem(key: string) {
    setItems(prev => prev.map(it => it.key === key ? { ...it, productId: null, confidence: "none" } : it));
  }
  function removeItem(key: string) {
    setItems(prev => prev.filter(it => it.key !== key));
    if (manualSelectKey === key) setManualSelectKey(null);
  }
  function selectProduct(key: string, productId: number | null) {
    const p = products.find(p => p.id === productId);
    setItems(prev => prev.map(it => it.key === key
      ? { ...it, productId, productName: p?.name ?? it.productName, confidence: productId ? "high" : "none" }
      : it));
    setManualSelectKey(null);
  }
  function addManualItem() {
    const key = `manual-${Date.now()}`;
    setItems(prev => [...prev, { key, rawText: "", productId: null, productName: "", quantity: 1, saleUnit: "PORTION", confidence: "none" }]);
    setManualSelectKey(key);
  }

  function getSuggestions(rawText: string, excludeId: number | null = null): Product[] {
    if (!rawText.trim() || products.length === 0) return [];
    const normalize = (s: string) => s.toLowerCase()
      .replace(/[àáạảãâầấậẩẫăằắặẳẵ]/g, "a").replace(/[èéẹẻẽêềếệểễ]/g, "e")
      .replace(/[ìíịỉĩ]/g, "i").replace(/[òóọỏõôồốộổỗơờớợởỡ]/g, "o")
      .replace(/[ùúụủũưừứựửữ]/g, "u").replace(/[ỳýỵỷỹ]/g, "y").replace(/đ/g, "d");
    const norm = normalize(rawText);
    const words = norm.split(/\s+/).filter(w => w.length >= 2);
    return products
      .filter(p => p.id !== excludeId)
      .map(p => {
        const n = normalize(p.name);
        let score = 0;
        if (n === norm) score += 20;
        else if (n.includes(norm) || norm.includes(n)) score += 10;
        for (const w of words) if (n.includes(w)) score += 3;
        return { p, score };
      })
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map(s => s.p);
  }

  function addSurcharge() {
    if (!surName.trim() || !surPrice) return;
    setSurcharges(prev => [...prev, { key: `sur-${Date.now()}`, name: surName.trim(), unitPrice: surPrice, quantity: surQty || "1", reason: surReason.trim() }]);
    setSurName(""); setSurPrice(""); setSurQty("1"); setSurReason(""); setShowSurForm(false);
  }

  function openAddSheet(targetKey: string | null = null) {
    setAddSheetTargetKey(targetKey);
    setAddSheetSearch("");
    setAddSheetCat("ALL");
    setAddSheetProduct(null);
    setAddSheetQty(1);
    setAddSheetUnit("PORTION");
    setShowAddSheet(true);
  }

  function confirmAddSheet() {
    if (!addSheetProduct) return;
    if (addSheetTargetKey) {
      selectProduct(addSheetTargetKey, addSheetProduct.id);
    } else {
      const key = `manual-${Date.now()}`;
      setItems(prev => [...prev, {
        key, rawText: "", productId: addSheetProduct.id,
        productName: addSheetProduct.name, quantity: addSheetQty,
        saleUnit: addSheetUnit, confidence: "high",
      }]);
    }
    setAddSheetProduct(null);
    setAddSheetSearch("");
    if (addSheetTargetKey) { setShowAddSheet(false); setAddSheetTargetKey(null); }
  }

  function reset() {
    try { localStorage.removeItem(SESSION_KEY); } catch {}
    setStep("capture"); setImagePreview(null); setImageBase64(""); setItems([]);
    setAnalyzeError(""); setSubmitError(""); setSurcharges([]); setShowSurForm(false);
    setManualSelectKey(null); setShowBeerList(false); setShowAddBeer(false); setPendingBeerProduct(null); setPendingBeerQty("1");
    setCreatedOrderId(null); setCreatedPayment(null); setAllPayments([]); setPartialAmount(""); setShowPaymentPanel(false);
    setShowAddSheet(false); setAddSheetTargetKey(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  // Phân loại items
  const getCategory = (item: ScannedItem) => products.find(p => p.id === item.productId)?.category ?? "";
  const isBeerCup = (item: ScannedItem) => {
    const p = products.find(p => p.id === item.productId);
    return (p?.name ?? item.productName).toLowerCase().includes("bia cốc");
  };
  const beerCupItems    = items.filter(it => it.confidence === "high" && isBeerCup(it));
  const otherDrinkItems = items.filter(it => it.confidence === "high" && getCategory(it) === "DRINK" && !isBeerCup(it));
  const confirmedFood   = items.filter(it => it.confidence === "high" && getCategory(it) !== "DRINK");
  const suggestedItems  = items.filter(it => it.confidence === "low");
  const unmatchedItems  = items.filter(it => it.confidence === "none");

  // Sản phẩm bia cốc trong DB (để nhân viên thêm thủ công)
  const beerCupProducts = products.filter(p => p.name.toLowerCase().includes("bia cốc"));

  function confirmAddBeer() {
    if (!pendingBeerProduct) return;
    const qty = Math.max(1, parseInt(pendingBeerQty) || 1);
    const key = `beer-${pendingBeerProduct.id}-${Date.now()}`;
    setItems(prev => [...prev, { key, rawText: "", productId: pendingBeerProduct!.id, productName: pendingBeerProduct!.name, quantity: qty, saleUnit: "CUP", confidence: "high" }]);
    setPendingBeerProduct(null);
    setPendingBeerQty("1");
  }

  const validItems = [...beerCupItems, ...otherDrinkItems, ...confirmedFood];
  const itemsTotal = validItems.reduce((s, it) => s + (products.find(p => p.id === it.productId)?.price ?? 0) * it.quantity, 0);
  const surTotal   = surcharges.reduce((s, sur) => s + (parseFloat(sur.unitPrice) || 0) * (parseInt(sur.quantity) || 1), 0);
  const grandTotal = itemsTotal + surTotal;
  // Split payment derived values
  const completedPaymentsScan = allPayments.filter(p => p.status === "COMPLETED");
  const sumCompletedScan = completedPaymentsScan.reduce((s, p) => s + p.amount, 0);
  const trueRemainingScan = Math.max(0, grandTotal - sumCompletedScan);
  // Chỉ fallback sang createdPayment nếu nó đang PENDING (tránh completed payment che mất "add more" section)
  const pendingPaymentScan = allPayments.find(p => p.status === "PENDING") ??
    (allPayments.length === 0 && createdPayment?.status === "PENDING" ? createdPayment : null);

  // Tự động đồng bộ giá payment khi tổng tiền thay đổi (debounce 700ms)
  // Chỉ auto-sync khi chưa có payment nào đã hoàn thành (tránh xung đột split payment)
  useEffect(() => {
    if (!createdPayment || createdPayment.status !== "PENDING" || grandTotal <= 0) return;
    if (completedPaymentsScan.length > 0) return; // Split payment đang diễn ra — không auto-sync
    if (Math.abs(grandTotal - createdPayment.amount) <= 0.5) return;
    const timer = setTimeout(() => { syncPaymentAmount(); }, 700);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grandTotal]);

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }

  function buildVietQrUrl(amount: number) {
    const encoded = encodeURIComponent("QuetHD");
    const name    = encodeURIComponent("TRAN MINH PHUC");
    return `https://img.vietqr.io/image/TPB-0357527135-compact2.png?amount=${Math.round(amount)}&addInfo=${encoded}&accountName=${name}`;
  }

  async function submitOrder() {
    if (validItems.length === 0) { setSubmitError("Không có món nào hợp lệ"); return; }
    try { localStorage.removeItem(SESSION_KEY); } catch {}

    // Luôn tạo order thật — tableId có thể null (đơn quầy, không gắn bàn)
    setSubmitting(true); setSubmitError("");
    try {
      const body: Record<string, unknown> = { note: "Quét hóa đơn viết tay" };
      if (tableId) body.tableId = Number(tableId);

      const orderRes = await fetch(`${BASE}/orders`, { method: "POST", headers: getAuthHeaders(), body: JSON.stringify(body) });
      const orderJson = await orderRes.json();
      if (orderJson.statusCode !== 200) { setSubmitError(extractApiError(orderJson, "Tạo đơn thất bại")); showToast(extractApiError(orderJson, "Tạo đơn thất bại"), false); return; }
      const newOrderId = orderJson.data.id as number;

      const failedItems: string[] = [];
      for (const item of validItems) {
        const itemRes  = await fetch(`${BASE}/orders/${newOrderId}/items`, { method: "POST", headers: getAuthHeaders(), body: JSON.stringify({ productId: item.productId, quantity: item.quantity, saleUnit: item.saleUnit, skipInventoryDeduction: true }) });
        const itemJson = await itemRes.json();
        if (itemJson.statusCode !== 200) {
          failedItems.push(item.productName || `#${item.productId}`);
        }
      }

      if (failedItems.length === validItems.length) {
        setSubmitError(`Không thể thêm món vào đơn (tồn kho không đủ): ${failedItems.join(", ")}`);
        showToast("Tất cả món đều không thêm được — kiểm tra tồn kho", false);
        return;
      }
      if (failedItems.length > 0) {
        showToast(`⚠️ Bỏ qua ${failedItems.length} món do tồn kho không đủ: ${failedItems.join(", ")}`, false);
        setSubmitError(`⚠️ ${failedItems.length} món bị bỏ qua (tồn kho không đủ): ${failedItems.join(", ")}`);
      }

      for (const sur of surcharges) {
        await fetch(`${BASE}/orders/${newOrderId}/surcharges`, { method: "POST", headers: getAuthHeaders(), body: JSON.stringify({ name: sur.name, unitPrice: parseFloat(sur.unitPrice), quantity: parseInt(sur.quantity) || 1, reason: sur.reason || undefined }) });
      }
      setCreatedOrderId(newOrderId);
      setShowPaymentPanel(true);
    } catch { setSubmitError("Không kết nối được máy chủ"); showToast("Không kết nối được máy chủ", false); }
    finally { setSubmitting(false); }
  }

  async function createPaymentFn(method: "CASH" | "BANK_TRANSFER") {
    if (!createdOrderId) return;
    setPayLoading(true); setSubmitError("");
    try {
      const rawAmt = partialAmount.replace(/\./g, "").replace(",", ".");
      const partial = rawAmt ? parseFloat(rawAmt) : undefined;
      const res = await fetch(`${BASE}/payments`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          orderId: createdOrderId,
          paymentMethod: method,
          amount: partial && partial > 0 ? partial : undefined,
        }),
      });
      const json = await res.json();
      if (json.statusCode === 200) {
        setCreatedPayment(json.data);
        setAllPayments(prev => [...prev, json.data]);
        setPartialAmount("");
        showToast(method === "CASH" ? "Đã tạo phiếu tiền mặt" : "Đã tạo QR chuyển khoản");
      } else {
        setSubmitError(extractApiError(json, "Tạo thanh toán thất bại"));
        showToast(extractApiError(json, "Tạo thanh toán thất bại"), false);
      }
    } catch {
      setSubmitError("Lỗi kết nối");
      showToast("Không kết nối được máy chủ", false);
    }
    finally { setPayLoading(false); }
  }

  async function syncPaymentAmount() {
    if (!createdPayment || createdPayment.status !== "PENDING" || grandTotal <= 0) return;
    setPayLoading(true);
    try {
      const res = await fetch(`${BASE}/payments/${createdPayment.id}/amount`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({ newAmount: grandTotal }),
      });
      const json = await res.json();
      if (json.statusCode === 200) {
        setCreatedPayment(json.data);
      } else {
        showToast(extractApiError(json, "Cập nhật thất bại"), false);
      }
    } catch { showToast("Không kết nối được máy chủ", false); }
    finally { setPayLoading(false); }
  }

  async function switchPaymentMethod(newMethod: "CASH" | "BANK_TRANSFER") {
    if (!createdPayment || createdPayment.paymentMethod === newMethod) return;
    setPayLoading(true);
    try {
      const res = await fetch(`${BASE}/payments/${createdPayment.id}/change-method`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({ newMethod }),
      });
      const json = await res.json();
      if (json.statusCode === 200) {
        setCreatedPayment(json.data);
        setAllPayments(prev => prev.map(p => p.id === json.data.id ? json.data : p));
        showToast(`Đã đổi sang ${newMethod === "CASH" ? "tiền mặt" : "chuyển khoản"}`);
      } else {
        showToast(extractApiError(json, "Đổi phương thức thất bại"), false);
      }
    } catch {
      showToast("Không kết nối được máy chủ", false);
    } finally {
      setPayLoading(false);
    }
  }

  async function refreshPayments() {
    if (!createdOrderId) return;
    try {
      const res = await fetch(`${BASE}/payments/orders/${createdOrderId}/all`, { headers: getAuthHeaders() });
      const json = await res.json();
      if (json.statusCode === 200 && Array.isArray(json.data)) {
        const list: PaymentInfo[] = json.data;
        setAllPayments(list);
        const pending = list.find((p: PaymentInfo) => p.status === "PENDING") ?? null;
        setCreatedPayment(pending ?? list[list.length - 1] ?? null);
      }
    } catch {}
  }

  async function confirmCash() {
    if (!createdPayment) return;
    setPayLoading(true); setSubmitError("");
    try {
      const res = await fetch(`${BASE}/payments/${createdPayment.id}/confirm`, { method: "PATCH", headers: getAuthHeaders() });
      const json = await res.json();
      if (json.statusCode === 200) {
        const confirmed = json.data as PaymentInfo;
        setCreatedPayment(confirmed);
        setAllPayments(prev => prev.map(p => p.id === confirmed.id ? confirmed : p));
        showToast("Đã xác nhận thanh toán tiền mặt ✓");
        // Nếu order đã PAID thì không cho thêm payment nữa
        // trueRemaining sẽ tự cập nhật qua allPayments
      } else {
        setSubmitError(extractApiError(json, "Xác nhận thất bại"));
        showToast(extractApiError(json, "Xác nhận thất bại"), false);
      }
    } catch {
      setSubmitError("Lỗi kết nối");
      showToast("Không kết nối được máy chủ", false);
    }
    finally { setPayLoading(false); }
  }

  // Danh sách sản phẩm đã lọc trong sheet
  const sheetFilteredProducts = products.filter(p => {
    const matchCat = addSheetCat === "ALL" || (addSheetCat === "DRINK" ? p.category === "DRINK" : p.category !== "DRINK");
    if (!addSheetSearch.trim()) return matchCat;
    const norm = (s: string) => s.toLowerCase()
      .replace(/[àáạảãâầấậẩẫăằắặẳẵ]/g, "a").replace(/[èéẹẻẽêềếệểễ]/g, "e")
      .replace(/[ìíịỉĩ]/g, "i").replace(/[òóọỏõôồốộổỗơờớợởỡ]/g, "o")
      .replace(/[ùúụủũưừứựửữ]/g, "u").replace(/[ỳýỵỷỹ]/g, "y").replace(/đ/g, "d");
    return matchCat && norm(p.name).includes(norm(addSheetSearch));
  });

  return (
    <div className="h-full flex flex-col bg-canvas">

      {/* ── Add-Item Bottom Sheet ── */}
      {showAddSheet && (
        <div className="fixed inset-0 z-[60] flex flex-col">
          {/* Backdrop */}
          <div className="flex-1 bg-black/50" onClick={() => { setShowAddSheet(false); setAddSheetProduct(null); setAddSheetTargetKey(null); }} />

          {/* Sheet */}
          <div className="bg-canvas rounded-t-2xl shadow-2xl flex flex-col" style={{ maxHeight: "80vh" }}>

            {/* Handle bar */}
            <div className="flex justify-center pt-2.5 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-300" />
            </div>

            {addSheetProduct === null ? (
              /* ── Bước 1: Chọn sản phẩm ── */
              <>
                <div className="px-4 pb-3 border-b border-hairline space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-ink text-base">
                      {addSheetTargetKey ? "Chọn món thay thế" : "Thêm món"}
                    </span>
                    <button onClick={() => { setShowAddSheet(false); setAddSheetProduct(null); setAddSheetTargetKey(null); }}
                      className="w-8 h-8 rounded-full bg-surface-soft flex items-center justify-center text-muted font-bold text-lg touch-manipulation">×</button>
                  </div>
                  {/* Search */}
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-soft text-sm">🔍</span>
                    <input
                      value={addSheetSearch}
                      onChange={e => setAddSheetSearch(e.target.value)}
                      placeholder="Tìm tên món..."
                      className="w-full pl-9 pr-3 py-2.5 border border-hairline rounded-xl text-sm bg-surface-soft focus:outline-none focus:border-primary"
                    />
                    {addSheetSearch && (
                      <button onClick={() => setAddSheetSearch("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-soft text-lg font-bold touch-manipulation">×</button>
                    )}
                  </div>
                  {/* Category tabs */}
                  <div className="flex gap-2">
                    {(["ALL", "FOOD", "DRINK"] as const).map(cat => (
                      <button key={cat} onClick={() => setAddSheetCat(cat)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors touch-manipulation
                          ${addSheetCat === cat ? "bg-primary text-white border-primary" : "bg-canvas border-hairline text-muted"}`}>
                        {cat === "ALL" ? "Tất cả" : cat === "FOOD" ? "🍽️ Đồ ăn" : "🧃 Đồ uống"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Product list */}
                <div className="flex-1 overflow-y-auto divide-y divide-hairline">
                  {sheetFilteredProducts.length === 0 && (
                    <div className="py-10 text-center text-sm text-muted-soft">Không tìm thấy món nào</div>
                  )}
                  {sheetFilteredProducts.map(p => (
                    <button key={p.id}
                      onClick={() => {
                        if (addSheetTargetKey) {
                          selectProduct(addSheetTargetKey, p.id);
                          setShowAddSheet(false); setAddSheetTargetKey(null);
                        } else {
                          setAddSheetProduct(p);
                          setAddSheetQty(1);
                          setAddSheetUnit(p.category === "DRINK" ? "CUP" : "PORTION");
                        }
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3.5 active:bg-surface-soft text-left touch-manipulation">
                      <span className="text-2xl shrink-0">{p.category === "DRINK" ? "🧃" : "🍽️"}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-ink">{p.name}</div>
                        <div className="text-xs text-primary font-bold mt-0.5">{formatPrice(p.price)}</div>
                      </div>
                      <span className="w-8 h-8 flex items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-lg shrink-0">+</span>
                    </button>
                  ))}
                  <div className="h-4" aria-hidden />
                </div>
              </>
            ) : (
              /* ── Bước 2: Chọn số lượng & đơn vị ── */
              <div className="p-4 space-y-5">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{addSheetProduct.category === "DRINK" ? "🧃" : "🍽️"}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-ink text-base">{addSheetProduct.name}</div>
                    <div className="text-sm text-primary font-bold">{formatPrice(addSheetProduct.price)}</div>
                  </div>
                  <button onClick={() => setAddSheetProduct(null)}
                    className="text-xs text-primary font-semibold border border-primary/30 rounded-lg px-2.5 py-1.5 touch-manipulation">
                    ← Chọn lại
                  </button>
                </div>

                {/* Số lượng */}
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wide text-muted-soft mb-3">Số lượng</div>
                  <div className="flex items-center justify-center gap-6">
                    <button onClick={() => setAddSheetQty(q => Math.max(1, q - 1))}
                      className="w-12 h-12 rounded-full bg-surface-soft border border-hairline font-bold text-ink text-2xl flex items-center justify-center touch-manipulation active:bg-surface-card">−</button>
                    <span className="w-12 text-center text-3xl font-bold text-ink tabular-nums">{addSheetQty}</span>
                    <button onClick={() => setAddSheetQty(q => q + 1)}
                      className="w-12 h-12 rounded-full bg-primary text-white font-bold text-2xl flex items-center justify-center touch-manipulation active:opacity-80">+</button>
                  </div>
                </div>

                {/* Đơn vị */}
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wide text-muted-soft mb-2">Đơn vị</div>
                  <div className="grid grid-cols-4 gap-2">
                    {[["PORTION","Phần"], ["CUP","Ly / Cốc"], ["PIECE","Cái"], ["KG","Kg"]].map(([val, label]) => (
                      <button key={val} onClick={() => setAddSheetUnit(val)}
                        className={`py-2.5 rounded-xl text-xs font-bold border transition-colors touch-manipulation
                          ${addSheetUnit === val ? "bg-primary text-white border-primary" : "bg-canvas border-hairline text-ink"}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tổng tiền preview */}
                <div className="flex items-center justify-between bg-surface-soft rounded-xl px-4 py-3">
                  <span className="text-sm text-muted-soft">Thành tiền</span>
                  <span className="font-bold text-primary text-lg tabular-nums">{formatPrice(addSheetProduct.price * addSheetQty)}</span>
                </div>

                {/* Nút xác nhận */}
                <button onClick={confirmAddSheet}
                  className="w-full py-4 bg-primary text-white font-bold rounded-xl text-sm touch-manipulation active:opacity-80">
                  Thêm {addSheetQty} × {addSheetProduct.name}
                </button>
                <button onClick={() => { setShowAddSheet(false); setAddSheetProduct(null); }}
                  className="w-full py-2 text-sm text-muted-soft touch-manipulation text-center">
                  Xong, đóng
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* QR Zoom Lightbox */}
      {showQrZoom && pendingPaymentScan?.vietQrUrl && (
        <div
          className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-6"
          onClick={() => setShowQrZoom(false)}
        >
          <div className="relative" onClick={e => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={pendingPaymentScan.vietQrUrl} alt="VietQR" className="w-72 h-72 rounded-2xl shadow-2xl" />
            <button
              onClick={() => setShowQrZoom(false)}
              className="absolute -top-3 -right-3 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center text-gray-700 font-bold text-lg touch-manipulation"
            >×</button>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 text-sm px-4 py-3 rounded-xl shadow-lg text-white max-w-sm
          ${toast.ok ? "bg-gray-800" : "bg-red-500"}`}>
          {toast.ok ? "✓ " : "✕ "}{toast.msg}
        </div>
      )}
      <div className="flex-shrink-0 px-4 py-3 border-b border-hairline bg-canvas">
        <div className="font-bold text-ink text-base">Quét Hóa Đơn Viết Tay</div>
        <div className="text-xs text-muted-soft mt-0.5">Chụp ảnh → AI đọc → xác nhận → tạo đơn</div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto">

        {/* ── Bước 1: Chụp ── */}
        {(step === "capture" || step === "analyzing") && (
          <div className="p-4 space-y-4">
            {analyzeError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm font-semibold text-red-700">{analyzeError}</div>
            )}
            {imagePreview ? (
              <div className="relative rounded-xl overflow-hidden border border-hairline">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imagePreview} alt="Hóa đơn" className="w-full object-contain max-h-64" />
                <button onClick={reset} className="absolute top-2 right-2 bg-black/50 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm touch-manipulation">×</button>
              </div>
            ) : (
              <div onClick={() => fileRef.current?.click()} className="border-2 border-dashed border-hairline rounded-xl p-10 flex flex-col items-center gap-3 cursor-pointer hover:border-primary transition-colors touch-manipulation">
                <div className="text-4xl">📷</div>
                <div className="text-sm font-semibold text-ink">Chụp hoặc chọn ảnh hóa đơn</div>
                <div className="text-xs text-muted-soft text-center">Chụp rõ nét, đủ sáng, AI đọc tự động</div>
              </div>
            )}
            <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />
            {!imagePreview ? (
              <button onClick={() => fileRef.current?.click()} className="w-full py-3 bg-primary text-white font-bold rounded-xl text-sm touch-manipulation">📷 Chụp ảnh hóa đơn</button>
            ) : step === "analyzing" ? (
              <div className="w-full py-3 bg-primary/60 text-white font-bold rounded-xl text-sm text-center animate-pulse">Đang phân tích hóa đơn...</div>
            ) : (
              <button onClick={analyzeImage} className="w-full py-3 bg-primary text-white font-bold rounded-xl text-sm touch-manipulation">🔍 Phân tích hóa đơn</button>
            )}
          </div>
        )}

        {/* ── Bước 2: Review ── */}
        {step === "review" && (
          <div className="p-4 space-y-3">

            <div className="flex items-center gap-2">
              <button onClick={reset} className="text-xs text-primary font-semibold touch-manipulation">← Chụp lại</button>
              <div className="flex-1 text-xs text-muted-soft text-right">{items.length} dòng nhận dạng</div>
            </div>

            {/* ── 1. Bia Cốc — chip grid ── */}
            {(beerCupItems.length > 0 || beerCupProducts.length > 0) && (
              <div className="border border-hairline rounded-xl overflow-hidden">
                {/* Header — luôn hiển thị */}
                <div className="flex items-center justify-between px-3 py-2 bg-surface-soft">
                  <h3 className="text-[11px] font-bold uppercase tracking-wide text-muted-soft">
                    🍺 Bia Cốc{beerCupItems.length > 0 ? ` · ${beerCupItems.reduce((s, i) => s + i.quantity, 0)} cốc` : ""}
                  </h3>
                  <div className="flex items-center gap-3">
                    {beerCupItems.length > 0 && (
                      <span className="text-xs font-bold text-primary">
                        {formatPrice(beerCupItems.reduce((s, it) => s + (products.find(p => p.id === it.productId)?.price ?? 0) * it.quantity, 0))}
                      </span>
                    )}
                    {/* Toggle mở/đóng */}
                    {beerCupItems.length > 0 && (
                      <button onClick={() => { setShowBeerList(v => !v); if (showBeerList) { setShowAddBeer(false); setPendingBeerProduct(null); } }}
                        className="flex items-center gap-1 text-[11px] font-semibold text-muted-soft touch-manipulation">
                        <span>{showBeerList ? "▲ Thu gọn" : `▼ ${beerCupItems.length} đợt`}</span>
                      </button>
                    )}
                    {/* Nút thêm — chỉ hiện khi expanded hoặc chưa có bia */}
                    {(showBeerList || beerCupItems.length === 0) && (
                      <button onClick={() => { setShowAddBeer(v => !v); setPendingBeerProduct(null); setPendingBeerQty("1"); }}
                        className="text-xs text-primary font-semibold touch-manipulation">
                        {showAddBeer ? "Xong" : "+ Thêm"}
                      </button>
                    )}
                  </div>
                </div>

                {/* Chip grid bia — chỉ hiện khi expanded */}
                {showBeerList && beerCupItems.length > 0 && (
                  <div className="px-3 py-3 flex flex-wrap gap-2 border-t border-hairline">
                    {beerCupItems.map(item => (
                      <div key={item.key} className="relative bg-canvas border border-hairline rounded-xl">
                        <button onClick={() => removeItem(item.key)} className="absolute -top-2 -right-2 w-5 h-5 flex items-center justify-center rounded-full bg-gray-200 hover:bg-red-400 hover:text-white text-gray-400 text-[10px] font-bold z-10 touch-manipulation">✕</button>
                        <div className="px-2 pt-1.5 text-center text-[10px] text-muted-soft font-medium max-w-[88px] truncate">{item.productName}</div>
                        <div className="flex items-center px-1.5 py-1.5 gap-0.5">
                          <button onClick={() => updateQty(item.key, -1)} className="w-8 h-8 flex items-center justify-center rounded-lg text-sm font-bold text-gray-500 bg-surface-card touch-manipulation">−</button>
                          <div className="w-7 text-center text-sm font-bold text-ink">{item.quantity}</div>
                          <button onClick={() => updateQty(item.key, +1)} className="w-8 h-8 flex items-center justify-center rounded-lg text-sm font-bold text-gray-500 bg-surface-card touch-manipulation">+</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Panel thêm bia — hiện khi showAddBeer */}
                {showAddBeer && beerCupProducts.length > 0 && (
                  <div className="border-t border-hairline bg-surface-soft">
                    {!pendingBeerProduct ? (
                      <div className="px-3 py-2 flex flex-wrap gap-2">
                        {beerCupProducts.map(p => (
                          <button key={p.id}
                            onClick={() => { setPendingBeerProduct(p); setPendingBeerQty("1"); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-canvas border border-primary/30 rounded-full text-sm font-semibold text-primary touch-manipulation">
                            + {p.name}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="px-3 py-3 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-ink">🍺 {pendingBeerProduct.name}</span>
                          <button onClick={() => { setPendingBeerProduct(null); setPendingBeerQty("1"); }}
                            className="text-xs text-muted-soft touch-manipulation">← Chọn lại</button>
                        </div>
                        <div className="bg-canvas rounded-xl px-4 py-3 text-center border border-hairline">
                          <span className="text-4xl font-bold text-ink tracking-widest tabular-nums">{pendingBeerQty || "0"}</span>
                          <span className="text-lg text-muted-soft ml-2">cốc</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {["1","2","3","4","5","6","7","8","9","⌫","0","✓"].map(k => (
                            <button key={k}
                              onClick={() => {
                                if (k === "⌫") setPendingBeerQty(prev => prev.length > 1 ? prev.slice(0, -1) : "");
                                else if (k === "✓") { confirmAddBeer(); setShowBeerList(true); }
                                else setPendingBeerQty(prev => (prev === "0" || prev === "") ? k : (prev.length < 3 ? prev + k : prev));
                              }}
                              className={`h-12 rounded-xl font-bold text-lg touch-manipulation
                                ${k === "✓" ? "bg-primary text-white" :
                                  k === "⌫" ? "bg-red-100 text-red-500" :
                                  "bg-canvas border border-hairline text-ink"}`}>
                              {k}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {beerCupItems.length === 0 && !showAddBeer && (
                  <div className="px-3 py-2 border-t border-hairline text-xs text-muted-soft italic">Chưa có bia cốc — nhấn + Thêm để gọi</div>
                )}
              </div>
            )}

            {/* ── 2. Đồ ăn + Đồ uống khác đã xác nhận ── */}
            {(confirmedFood.length > 0 || otherDrinkItems.length > 0) && (
              <div className="border border-hairline rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 bg-surface-soft border-b border-hairline">
                  <h3 className="text-[11px] font-bold uppercase tracking-wide text-muted-soft">🍽️ Món ăn & Đồ uống</h3>
                  <span className="text-xs font-bold text-primary">
                    {formatPrice([...confirmedFood, ...otherDrinkItems].reduce((s, it) => s + (products.find(p => p.id === it.productId)?.price ?? 0) * it.quantity, 0))}
                  </span>
                </div>
                <div className="divide-y divide-hairline">
                  {[...otherDrinkItems, ...confirmedFood].map(item => (
                    <div key={item.key} className="flex items-center gap-2 px-3 py-2.5">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm">{getCategory(item) === "DRINK" ? "🧃" : "🍽️"}</span>
                          <span className="text-sm font-semibold text-ink truncate">{item.productName}</span>
                        </div>
                        {item.rawText && <div className="text-[10px] text-muted-soft italic truncate ml-5">"{item.rawText}"</div>}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button onClick={() => updateQty(item.key, -1)} className="w-7 h-7 rounded-full bg-surface-soft border border-hairline font-bold text-ink flex items-center justify-center touch-manipulation text-sm">−</button>
                        <span className="w-7 text-center text-sm font-bold text-ink">{item.quantity}</span>
                        <button onClick={() => updateQty(item.key, +1)} className="w-7 h-7 rounded-full bg-primary text-white font-bold flex items-center justify-center touch-manipulation text-sm">+</button>
                      </div>
                      <div className="text-xs font-bold text-primary w-16 text-right whitespace-nowrap">
                        {formatPrice((products.find(p => p.id === item.productId)?.price ?? 0) * item.quantity)}
                      </div>
                      <button onClick={() => removeItem(item.key)} className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 hover:bg-red-100 text-gray-400 hover:text-red-500 text-base font-bold touch-manipulation">×</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── 3. Gần đúng — cần xác nhận ── */}
            {suggestedItems.length > 0 && (
              <div className="border border-amber-200 rounded-xl overflow-hidden">
                <div className="px-3 py-2 bg-amber-50 border-b border-amber-200">
                  <h3 className="text-[11px] font-bold uppercase tracking-wide text-amber-700">
                    🔍 Cần xác nhận · {suggestedItems.length} món
                  </h3>
                </div>
                <div className="divide-y divide-amber-100">
                  {suggestedItems.map(item => {
                    const suggs = getSuggestions(item.rawText || item.productName, item.productId);
                    return (
                    <div key={item.key} className="px-3 py-2.5 bg-amber-50">
                      <div className="text-[10px] text-muted-soft italic mb-1">"{item.rawText}"</div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-ink truncate">→ {item.productName}</div>
                          <div className="text-[10px] text-muted-soft">
                            {formatPrice(products.find(p => p.id === item.productId)?.price ?? 0)} / {item.saleUnit}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button onClick={() => updateQty(item.key, -1)} className="w-6 h-6 rounded-full bg-white border border-amber-200 font-bold text-ink flex items-center justify-center touch-manipulation text-xs">−</button>
                          <span className="w-6 text-center text-sm font-bold text-ink">{item.quantity}</span>
                          <button onClick={() => updateQty(item.key, +1)} className="w-6 h-6 rounded-full bg-amber-400 text-white font-bold flex items-center justify-center touch-manipulation text-xs">+</button>
                        </div>
                        {/* Xác nhận / Từ chối */}
                        <button onClick={() => confirmItem(item.key)} className="w-8 h-8 flex items-center justify-center rounded-full bg-green-100 text-green-600 font-bold text-base touch-manipulation" title="Đúng rồi">✓</button>
                        <button onClick={() => rejectItem(item.key)} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 font-bold text-base touch-manipulation" title="Sai, chọn lại">✗</button>
                      </div>
                      {suggs.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                          <span className="text-[10px] font-semibold text-amber-600 shrink-0">Gợi ý:</span>
                          {suggs.map(p => (
                            <button key={p.id} onClick={() => selectProduct(item.key, p.id)}
                              className="text-[11px] px-2.5 py-0.5 rounded-full bg-white border border-amber-300 text-amber-700 font-medium touch-manipulation active:bg-amber-100">
                              {p.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── 4. Chưa đúng — xóa hoặc chọn lại ── */}
            {unmatchedItems.length > 0 && (
              <div className="border border-red-200 rounded-xl overflow-hidden">
                <div className="px-3 py-2 bg-red-50 border-b border-red-200">
                  <h3 className="text-[11px] font-bold uppercase tracking-wide text-red-600">
                    ❓ Không nhận dạng được · {unmatchedItems.length} dòng
                  </h3>
                </div>
                <div className="divide-y divide-red-100">
                  {unmatchedItems.map(item => {
                    const suggs = getSuggestions(item.rawText || item.productName);
                    return (
                    <div key={item.key} className="px-3 py-2.5 bg-red-50">
                      {item.rawText && <div className="text-[10px] text-muted-soft italic mb-2">"{item.rawText}"</div>}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 text-sm text-muted font-medium">{item.productName || "Chưa xác định"}</div>
                          <button onClick={() => openAddSheet(item.key)}
                            className="flex items-center gap-1 text-xs text-primary font-semibold border border-primary/30 rounded-lg px-2.5 py-1 touch-manipulation active:bg-primary/5">
                            🔍 Chọn món
                          </button>
                          <button onClick={() => removeItem(item.key)} className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 text-base font-bold touch-manipulation">×</button>
                        </div>
                        {suggs.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[10px] font-semibold text-red-500 shrink-0">Gợi ý:</span>
                            {suggs.map(p => (
                              <button key={p.id} onClick={() => selectProduct(item.key, p.id)}
                                className="text-[11px] px-2.5 py-0.5 rounded-full bg-white border border-red-200 text-red-600 font-medium touch-manipulation active:bg-red-50">
                                {p.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* + Thêm món */}
            <button onClick={() => openAddSheet(null)}
              className="w-full py-3 border-2 border-dashed border-primary/30 rounded-xl text-sm text-primary font-bold touch-manipulation flex items-center justify-center gap-2 active:bg-primary/5">
              <span className="text-lg leading-none">+</span> Thêm món
            </button>

            {/* ── Phụ thu ── */}
            <div className="border border-hairline rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 bg-surface-soft border-b border-hairline">
                <h3 className="text-[11px] font-bold uppercase tracking-wide text-muted-soft">
                  ⚠️ Phụ thu{surcharges.length > 0 ? ` · ${surcharges.length} khoản` : ""}
                </h3>
                <div className="flex items-center gap-2">
                  {surcharges.length > 0 && <span className="text-xs font-bold text-orange-600">{formatPrice(surTotal)}</span>}
                  <button onClick={() => setShowSurForm(v => !v)} className="text-xs text-primary font-semibold touch-manipulation">{showSurForm ? "Hủy" : "+ Thêm"}</button>
                </div>
              </div>
              {surcharges.length > 0 && (
                <div className="divide-y divide-hairline">
                  {surcharges.map(sur => (
                    <div key={sur.key} className="flex items-center gap-2 px-3 py-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-ink">{sur.name}</div>
                        {sur.reason && <div className="text-xs text-muted-soft">{sur.reason}</div>}
                      </div>
                      <div className="text-xs font-bold text-orange-600 whitespace-nowrap">{sur.quantity}× {formatPrice(parseFloat(sur.unitPrice) || 0)}</div>
                      <button onClick={() => setSurcharges(prev => prev.filter(s => s.key !== sur.key))} className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 text-base touch-manipulation">×</button>
                    </div>
                  ))}
                </div>
              )}
              {showSurForm && (
                <div className="p-3 space-y-2 border-t border-hairline bg-surface-soft">
                  <input value={surName} onChange={e => setSurName(e.target.value)} placeholder="Tên phụ thu (VD: Phí giữ xe...)" className="w-full border border-hairline rounded-lg px-3 py-2 text-sm text-ink bg-canvas focus:outline-none focus:border-primary" />
                  <div className="flex gap-2">
                    <input value={surPrice} onChange={e => setSurPrice(e.target.value)} type="number" placeholder="Đơn giá (VNĐ)" className="flex-1 border border-hairline rounded-lg px-3 py-2 text-sm text-ink bg-canvas focus:outline-none focus:border-primary" />
                    <input value={surQty} onChange={e => setSurQty(e.target.value)} type="number" min="1" placeholder="SL" className="w-16 border border-hairline rounded-lg px-2 py-2 text-sm text-ink bg-canvas focus:outline-none text-center" />
                  </div>
                  <input value={surReason} onChange={e => setSurReason(e.target.value)} placeholder="Ghi chú (không bắt buộc)" className="w-full border border-hairline rounded-lg px-3 py-2 text-sm text-ink bg-canvas focus:outline-none" />
                  <button onClick={addSurcharge} disabled={!surName.trim() || !surPrice} className="w-full py-2 bg-orange-500 text-white font-bold rounded-lg text-sm disabled:opacity-40 touch-manipulation">Thêm phụ thu</button>
                </div>
              )}
            </div>

            {/* ── Chọn bàn (ẩn/hiện) ── */}
            <div className="border border-hairline rounded-xl overflow-hidden">
              <button onClick={() => setShowTableSelect(v => !v)}
                className="w-full flex items-center justify-between px-3 py-2.5 bg-surface-soft touch-manipulation">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-muted-soft">🪑 Bàn</span>
                  {tableId
                    ? <span className="text-xs font-bold text-primary">{tables.find(t => t.id === tableId)?.name}</span>
                    : <span className="text-xs text-muted-soft italic">Chưa chọn</span>}
                </div>
                <span className="text-muted-soft text-xs">{showTableSelect ? "▲" : "▼"}</span>
              </button>
              {showTableSelect && (
                <div className="p-3 border-t border-hairline">
                  <select value={tableId} onChange={e => setTableId(e.target.value ? Number(e.target.value) : "")}
                    className="w-full border border-hairline rounded-xl px-3 py-2.5 text-sm bg-canvas text-ink focus:outline-none focus:border-primary">
                    <option value="">-- Chọn bàn --</option>
                    {tables.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              )}
            </div>

            <div className="h-28 md:hidden" aria-hidden />

          </div>
        )}

      </div>

      {/* Fixed bottom payment — review step, giống hệt employee page */}
      {step === "review" && (
        <div className="fixed bottom-16 left-0 right-0 z-20 bg-canvas shadow-[0_-4px_12px_rgba(0,0,0,0.08)] border-t border-hairline">

          {/* Toggle bar — luôn hiện */}
          <button
            onClick={() => {
              if (createdOrderId !== null) {
                setShowPaymentPanel(v => !v);
              } else {
                submitOrder();
              }
            }}
            disabled={submitting || validItems.length === 0}
            className="px-4 py-2.5 flex items-center justify-between w-full bg-canvas active:bg-surface-soft transition-colors touch-manipulation"
            style={{ WebkitTapHighlightColor: "transparent" }}>
            <div className="flex items-baseline gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-soft">Thanh toán</span>
              {submitting
                ? <span className="text-sm text-muted-soft animate-pulse">Đang xử lý...</span>
                : trueRemainingScan <= 0 && completedPaymentsScan.length > 0
                ? <span className="text-sm font-bold text-green-600">✓ Đã đủ tiền</span>
                : validItems.length === 0
                ? <span className="text-sm text-muted-soft">Chưa có món</span>
                : completedPaymentsScan.length > 0
                ? <span className="text-sm font-bold text-primary">Còn {formatPrice(trueRemainingScan)}</span>
                : <span className="text-sm font-bold text-primary">Thu {formatPrice(grandTotal)}</span>
              }
            </div>
            <span className="text-sm text-muted-soft select-none leading-none">{showPaymentPanel ? "▼" : "▲"}</span>
          </button>

          {/* Collapsible panel */}
          {showPaymentPanel && (
            <div className="border-t border-hairline p-3 space-y-2.5 max-h-[50vh] overflow-y-auto" style={{ overscrollBehavior: "none" }}>

              {/* Tổng tiền */}
              <div className="space-y-1">
                <div className="flex justify-between text-sm text-muted">
                  <span>Tạm tính ({validItems.length} món)</span>
                  <span>{formatPrice(itemsTotal)}</span>
                </div>
                {surcharges.length > 0 && (
                  <div className="flex justify-between text-sm text-orange-600">
                    <span>Phụ thu</span>
                    <span>{formatPrice(surTotal)}</span>
                  </div>
                )}
                {completedPaymentsScan.length > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Đã thu</span>
                    <span>− {formatPrice(sumCompletedScan)}</span>
                  </div>
                )}
                <div className="flex justify-between font-black text-base border-t border-hairline pt-1.5">
                  <span className={trueRemainingScan > 0 ? "text-primary" : "text-green-600"}>
                    {trueRemainingScan > 0 ? "Còn lại" : "✓ Đủ tiền"}
                  </span>
                  <span className={trueRemainingScan > 0 ? "text-primary" : "text-green-600"}>
                    {formatPrice(trueRemainingScan > 0 ? trueRemainingScan : grandTotal)}
                  </span>
                </div>
              </div>

              {/* Danh sách lần thanh toán đã xong */}
              {completedPaymentsScan.length > 0 && (
                <div className="space-y-1">
                  {completedPaymentsScan.map(p => (
                    <div key={p.id} className="flex items-center justify-between text-xs bg-green-50 rounded-lg px-2.5 py-1.5">
                      <span className="text-green-700 font-semibold">
                        {p.paymentMethod === "CASH" ? "💵 Tiền mặt" : "📱 Chuyển khoản"}
                      </span>
                      <span className="text-green-700 font-bold tabular-nums">✓ {formatPrice(p.amount)}</span>
                    </div>
                  ))}
                </div>
              )}

              {submitError && <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{submitError}</div>}

              {/* Đã đủ tiền — hiện nút xem đơn / quét mới */}
              {createdOrderId && trueRemainingScan <= 0 && completedPaymentsScan.length > 0 && !pendingPaymentScan && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-2.5 text-center">
                  <p className="text-green-700 font-bold text-sm">✓ Đã thanh toán đủ</p>
                  <p className="text-xs text-green-600 mt-0.5">{formatPrice(sumCompletedScan)} tổng thu</p>
                  <div className="flex gap-2 mt-2">
                    <button onClick={reset} className="flex-1 py-2 rounded-xl border border-primary text-primary font-bold text-sm touch-manipulation">Quét đơn mới</button>
                    <button onClick={() => router.push(`/employee/don-hang/${createdOrderId}`)} className="flex-1 py-2 rounded-xl bg-primary text-white font-bold text-sm touch-manipulation">Xem đơn</button>
                  </div>
                </div>
              )}

              {/* Chưa có payment PENDING — hiện nút chọn phương thức (khi còn tiền) */}
              {createdOrderId && !pendingPaymentScan && trueRemainingScan > 0 && (
                <div className={`space-y-1.5 ${grandTotal > 0 ? "" : "opacity-40 pointer-events-none"}`}>
                  {completedPaymentsScan.length > 0 && (
                    <p className="text-[10px] font-semibold text-center text-muted-soft">
                      + Thu {formatPrice(trueRemainingScan)} còn lại
                    </p>
                  )}
                  {/* Số tiền một phần (optional) */}
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      value={partialAmount}
                      onChange={e => setPartialAmount(e.target.value)}
                      placeholder={`Mặc định: ${formatPrice(trueRemainingScan)}`}
                      className="flex-1 border border-hairline rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-primary bg-white tabular-nums"
                      min="1"
                      step="1000"
                    />
                    {partialAmount && (
                      <button onClick={() => setPartialAmount("")}
                        className="text-muted-soft hover:text-gray-600 text-xs px-1.5">✕</button>
                    )}
                  </div>
                  {!completedPaymentsScan.length && (
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-soft text-center">Chọn phương thức thu tiền</p>
                  )}
                  <div className="grid grid-cols-2 gap-1.5">
                    <button onClick={() => createPaymentFn("CASH")} disabled={payLoading}
                      className="flex flex-col items-center gap-1 py-2.5 rounded-xl border-2 border-hairline bg-canvas hover:border-green-400 hover:bg-green-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold text-ink touch-manipulation">
                      <span className="text-lg">💵</span><span>Tiền mặt</span>
                    </button>
                    <button onClick={() => createPaymentFn("BANK_TRANSFER")} disabled={payLoading}
                      className="flex flex-col items-center gap-1 py-2.5 rounded-xl border-2 border-hairline bg-canvas hover:border-blue-400 hover:bg-blue-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold text-ink touch-manipulation">
                      <span className="text-lg">📱</span><span>Chuyển khoản</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Đã có payment PENDING — hiện UI xác nhận */}
              {createdOrderId && pendingPaymentScan && pendingPaymentScan.status === "PENDING" && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-1 p-1 bg-surface-soft rounded-xl">
                    <button
                      onClick={() => switchPaymentMethod("CASH")}
                      disabled={payLoading}
                      className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${pendingPaymentScan.paymentMethod === "CASH" ? "bg-canvas shadow text-green-700 border border-green-200" : "text-muted hover:text-ink"}`}>
                      💵 Tiền mặt
                    </button>
                    <button
                      onClick={() => switchPaymentMethod("BANK_TRANSFER")}
                      disabled={payLoading}
                      className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${pendingPaymentScan.paymentMethod === "BANK_TRANSFER" ? "bg-canvas shadow text-blue-700 border border-blue-200" : "text-muted hover:text-ink"}`}>
                      📱 Chuyển khoản
                    </button>
                  </div>
                  {pendingPaymentScan.paymentMethod === "BANK_TRANSFER" && pendingPaymentScan.vietQrUrl && (
                    <div className="bg-blue-50 rounded-xl p-2 text-center space-y-1.5">
                      <p className="text-[10px] text-blue-600 font-semibold uppercase tracking-wide">
                        Quét mã chuyển khoản{completedPaymentsScan.length > 0 ? ` · ${formatPrice(pendingPaymentScan.amount)}` : ""}
                      </p>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={pendingPaymentScan.vietQrUrl}
                        alt="VietQR"
                        className="w-32 h-32 mx-auto rounded-lg border border-blue-100 cursor-zoom-in active:scale-95 transition-transform touch-manipulation"
                        onClick={() => setShowQrZoom(true)}
                        onPointerDown={e => { if (e.pointerType === "touch") { e.preventDefault(); setShowQrZoom(true); } }}
                      />
                      <div className="flex items-center justify-center gap-2">
                        <p className="text-[10px] text-blue-400">Đang tự kiểm tra mỗi 4 giây...</p>
                        <button
                          onClick={refreshPayments}
                          className="text-[10px] text-blue-600 font-semibold underline touch-manipulation">
                          🔄 Kiểm tra ngay
                        </button>
                      </div>
                    </div>
                  )}
                  {pendingPaymentScan.paymentMethod === "CASH" && (
                    <button onClick={confirmCash} disabled={payLoading}
                      className="w-full py-2.5 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl text-sm disabled:opacity-50 transition-colors touch-manipulation">
                      {payLoading ? "Đang xử lý..." : `✓ Xác nhận thu ${formatPrice(pendingPaymentScan.amount)}`}
                    </button>
                  )}
                </div>
              )}


            </div>
          )}
        </div>
      )}

    </div>
  );
}
