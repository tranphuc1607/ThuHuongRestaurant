"use client";
import { useState, useMemo, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { getAuthHeaders } from "@/lib/auth";
import {
  getDishes,
  updateQuantity,
  removeDish,
  clearDishes,
  restoreDishes,
  getTotalCount,
  CART_EVENT,
  DishItem,
} from "@/lib/dishCart";
import { formatPrice, extractApiError } from "@/lib/utils";
import {
  BT_LAST_KEY,
  CASH_PENDING_KEY,
  LAST_BOOKING_KEY,
  SavedBooking,
  CashItem,
  FINAL_STATUSES,
  getBtBookings,
  saveBtBookings,
  getCashItems,
  saveCashItems,
} from "@/lib/bookingStorage";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api/v1";

const TIME_SLOTS: string[] = (() => {
  const slots: string[] = [];
  for (let min = 8 * 60; min <= 21 * 60 + 30; min += 30) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  }
  return slots;
})();

const MENU_CATEGORIES = [
  { label: "Món Gà",  cat: "CHICKEN" },
  { label: "Hải Sản", cat: "FISH"    },
  { label: "Món Bò",  cat: "BEEF"    },
  { label: "Món Heo", cat: "PORK"    },
  { label: "Đồ Chay", cat: "VEGETABLE" },
  { label: "Đồ Uống", cat: "DRINK"   },
];

function getTodayVN() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });
}
function getNowVNMinutes() {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
  return d.getHours() * 60 + d.getMinutes();
}

type FormState = {
  customerName: string;
  phone: string;
  date: string;
  time: string;
  guestCount: number;
  paymentMethod: "CASH" | "BANK_TRANSFER";
  notes: string;
};

// ─── Nội dung form (cần useSearchParams → phải nằm trong Suspense) ──────────
function BookingFormContent() {
  const router = useRouter();
  const { user } = useAuth();
  useSearchParams(); // giữ trong Suspense boundary

  const todayVN = useMemo(() => getTodayVN(), []);

  // Dish cart từ localStorage
  const [dishes, setDishes] = useState<DishItem[]>([]);
  useEffect(() => {
    const sync = () => setDishes(getDishes());
    sync();
    window.addEventListener(CART_EVENT, sync);
    return () => window.removeEventListener(CART_EVENT, sync);
  }, []);

  const FORM_KEY = "booking_form_draft";

  const [form, setForm] = useState<FormState>(() => {
    try {
      const saved = sessionStorage.getItem(FORM_KEY);
      if (saved) return { ...JSON.parse(saved), notes: "" };
    } catch {}
    return {
      customerName: "",
      phone: "",
      date: "",
      time: "12:00",
      guestCount: 2,
      paymentMethod: "BANK_TRANSFER",
      notes: "",
    };
  });
  const [loading, setLoading] = useState(false);
  const [lastBookingExpanded, setLastBookingExpanded] = useState(true);
  const [error, setError] = useState("");
  const [cashToast, setCashToast] = useState<string | null>(null);

  type CashItemWithStatus = CashItem & { fetchedStatus: string };
  const [cashPendings, setCashPendings] = useState<CashItemWithStatus[]>([]);

  // Load + validate từng đơn CASH khi mount (giữ theo dõi đến khi COMPLETED/CANCELLED/EXPIRED)
  useEffect(() => {
    const saved = getCashItems();
    if (!saved.length) return;
    Promise.all(
      saved.map(item =>
        fetch(`${BASE_URL}/bookings/${item.code}`)
          .then(r => r.json())
          .then(j => ({ item, status: (j.data?.status ?? "PENDING_PAYMENT") as string }))
          .catch(() => ({ item, status: "PENDING_PAYMENT" }))
      )
    ).then(results => {
      const stillTracking = results
        .filter(r => !FINAL_STATUSES.includes(r.status))
        .map(r => ({ ...r.item, fetchedStatus: r.status }));
      setCashPendings(stillTracking);
      saveCashItems(stillTracking.map(({ fetchedStatus: _, ...rest }) => rest));
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function dismissCashPending(code: string) {
    setCashPendings(prev => {
      const next = prev.filter(p => p.code !== code);
      saveCashItems(next.map(({ fetchedStatus: _, ...rest }) => rest));
      return next;
    });
  }

  // Booking BANK_TRANSFER — mảng, check EXPIRED để hiện gợi ý đặt lại
  const [expiredBts, setExpiredBts] = useState<SavedBooking[]>([]);
  const [lastBooking, setLastBooking] = useState<SavedBooking | null>(null);

  useEffect(() => {
    const btArr = getBtBookings();
    if (btArr.length) {
      Promise.all(
        btArr.map(saved =>
          fetch(`${BASE_URL}/bookings/${saved.code}`)
            .then(r => r.json())
            .then(j => ({ saved, status: (j.data?.status ?? "") as string }))
            .catch(() => ({ saved, status: "" }))
        )
      ).then(results => {
        const expired = results.filter(r => r.status === "EXPIRED").map(r => r.saved);
        const keepInArray = results
          .filter(r => !FINAL_STATUSES.includes(r.status) && r.status !== "")
          .map(r => r.saved);
        setExpiredBts(expired);
        // Xóa đơn đã COMPLETED/CANCELLED/EXPIRED khỏi array (chỉ giữ PENDING_PAYMENT)
        saveBtBookings(keepInArray);
      });
    }

    // Load đặt lại cuối — bỏ qua nếu đã hủy hoặc hết hạn
    try {
      const raw = localStorage.getItem(LAST_BOOKING_KEY);
      if (raw) {
        const saved: SavedBooking = JSON.parse(raw);
        fetch(`${BASE_URL}/bookings/${saved.code}`)
          .then(r => r.json())
          .then(j => {
            const status: string = j.data?.status ?? "";
            if (status === "CANCELLED" || status === "EXPIRED") {
              localStorage.removeItem(LAST_BOOKING_KEY);
            } else {
              setLastBooking(saved);
            }
          })
          .catch(() => setLastBooking(saved));
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-apply khi đến từ "Đặt lại ngay" — chỉ restore món ăn, không fill form
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("booking_reorder_now");
      if (!raw) return;
      sessionStorage.removeItem("booking_reorder_now");
      const saved: SavedBooking = JSON.parse(raw);
      if (saved.items?.length) restoreDishes(saved.items);
      setLastBooking(null);
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Lưu form vào sessionStorage mỗi khi thay đổi
  useEffect(() => {
    try { sessionStorage.setItem(FORM_KEY, JSON.stringify(form)); } catch {}
  }, [form]);


  const availableSlots = useMemo(() => {
    if (form.date !== todayVN) return TIME_SLOTS;
    const min = getNowVNMinutes() + 60;
    return TIME_SLOTS.filter((s) => {
      const [h, m] = s.split(":").map(Number);
      return h * 60 + m >= min;
    });
  }, [form.date, todayVN]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((p) => ({ ...p, [key]: value }));
    if (error) setError("");
  }

  function validate(): string | null {
    if (!form.customerName.trim()) return "Vui lòng nhập họ tên";
    if (!/^[0-9]{9,11}$/.test(form.phone.replace(/\s/g, "")))
      return "Số điện thoại không hợp lệ (9–11 chữ số)";
    if (!form.date) return "Vui lòng chọn ngày đặt bàn";
    if (!form.time) return "Vui lòng chọn giờ đặt bàn";
    if (form.guestCount < 1 || form.guestCount > 50) return "Số người phải từ 1 đến 50";
    const scheduled = new Date(`${form.date}T${form.time}:00+07:00`);
    if (scheduled.getTime() - Date.now() < 60 * 60 * 1000)
      return "Vui lòng đặt bàn trước giờ đến dự kiến ít nhất 1 giờ";
    const [h, m] = form.time.split(":").map(Number);
    if (h * 60 + m < 8 * 60 || h * 60 + m >= 22 * 60)
      return "Quán chỉ phục vụ từ 08:00 đến 22:00";
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const err = validate();
    if (err) { setError(err); return; }
    setLoading(true);
    setError("");
    try {
      const scheduledTime = new Date(`${form.date}T${form.time}:00+07:00`).toISOString();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (user) Object.assign(headers, getAuthHeaders());
      const res = await fetch(`${BASE_URL}/bookings`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          customerName: form.customerName.trim(),
          customerPhone: form.phone.replace(/\s/g, ""),
          scheduledTime,
          guestCount: form.guestCount,
          paymentMethod: form.paymentMethod,
          note: form.notes.trim() || undefined,
          items: dishes.map(d => ({
            productId: d.id,
            quantity: d.quantity,
            saleUnit: "PORTION",
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok || (json.statusCode !== 200 && json.statusCode !== 201)) {
        setError(extractApiError(json, "Đặt bàn thất bại. Vui lòng thử lại."));
        return;
      }
      const code: string = json.data?.bookingCode ?? String(json.data?.id);
      const savedItems = [...dishes]; // snapshot trước khi clear
      clearDishes();
      try { sessionStorage.removeItem(FORM_KEY); } catch {}

      // Luôn lưu booking cuối để hiện "Đặt lại" lần sau
      const bookingSnapshot: SavedBooking = {
        code,
        name: form.customerName.trim(),
        phone: form.phone.replace(/\s/g, ""),
        date: form.date,
        time: form.time,
        guestCount: form.guestCount,
        notes: form.notes.trim(),
        items: savedItems,
      };
      try { localStorage.setItem(LAST_BOOKING_KEY, JSON.stringify(bookingSnapshot)); } catch {}

      if (form.paymentMethod === "CASH") {
        const newItem: CashItem = {
          code,
          name: form.customerName.trim(),
          phone: form.phone.replace(/\s/g, ""),
          date: form.date,
          time: form.time,
        };
        setCashPendings(prev => {
          const next = [...prev, { ...newItem, fetchedStatus: "PENDING_PAYMENT" }];
          saveCashItems(next.map(({ fetchedStatus: _, ...rest }) => rest));
          return next;
        });
        setCashToast(code);
      } else {
        // Push vào BT array (không replace — có thể có nhiều đơn BT cùng lúc)
        const updated = [...getBtBookings().filter(b => b.code !== code), bookingSnapshot];
        saveBtBookings(updated);
        router.push(`/dat-ban/${code}`);
      }
    } catch {
      setError("Không kết nối được máy chủ. Vui lòng thử lại sau.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="max-w-[1200px] mx-auto px-4 py-12">

      {/* Toast xác nhận yêu cầu tiền mặt — hình vuông giữa màn hình */}
      {cashToast && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setCashToast(null)}>
          <div className="bg-white w-80 p-8 flex flex-col items-center gap-4 shadow-2xl"
            onClick={e => e.stopPropagation()}>
            <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center text-3xl">
              💵
            </div>
            <h3 className="text-lg font-bold text-ink text-center">Yêu cầu đã được ghi nhận!</h3>
            <p className="text-xs font-mono bg-orange-50 border border-orange-200 px-3 py-1.5 text-orange-700 tracking-widest">
              {cashToast}
            </p>
            <p className="text-sm text-muted text-center leading-relaxed">
              Lưu lại mã trên để tra cứu đặt bàn của bạn.
              Nhà hàng sẽ liên hệ qua SĐT để xác nhận.
            </p>
            <a href="tel:0123456789"
              className="w-full bg-orange-500 text-white text-center py-3 font-bold text-sm hover:bg-orange-600 transition-colors">
              📞 Gọi ngay: 0123 456 789
            </a>
            <a href="/dat-ban/lich-su"
              className="w-full text-center border border-orange-300 text-orange-600 py-2.5 text-xs font-semibold hover:bg-orange-50 transition-colors">
              Xem lịch sử đặt bàn →
            </a>
            <button onClick={() => setCashToast(null)}
              className="text-xs text-muted-soft hover:text-muted transition-colors">
              Đóng
            </button>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-[1fr_340px] gap-10">

        {/* ── FORM ─────────────────────────────────────────────────────── */}
        <div className="bg-canvas border border-hairline p-8">

          {/* Danh sách đơn tiền mặt — theo dõi đến khi hoàn thành */}
          {cashPendings.length > 0 && (
            <div className="mb-6 border border-orange-300 bg-orange-50 p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-orange-700">
                  💵 Đơn đặt bàn tiền mặt của bạn ({cashPendings.length})
                </p>
                <a href="/dat-ban/lich-su" className="text-xs text-orange-500 hover:underline">
                  Xem lịch sử →
                </a>
              </div>
              <div className="flex flex-col gap-2">
                {cashPendings.map(item => {
                  const s = item.fetchedStatus;
                  const badge =
                    s === "CONFIRMED" ? { label: "Đã xác nhận", cls: "text-green-700 bg-green-100" } :
                    s === "CHECKED_IN" ? { label: "Đã check-in", cls: "text-blue-700 bg-blue-100" } :
                    { label: "Chờ xác nhận", cls: "text-orange-700 bg-orange-100" };
                  return (
                    <div key={item.code} className="flex items-center justify-between gap-2 bg-white border border-orange-200 px-3 py-2">
                      <div className="min-w-0 flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold text-orange-700 tracking-wider">{item.code}</span>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${badge.cls}`}>{badge.label}</span>
                        <span className="text-xs text-orange-500">{item.name} · {item.date} {item.time}</span>
                      </div>
                      <a href={`/dat-ban/${item.code}`}
                        className="text-xs text-orange-600 font-semibold hover:underline whitespace-nowrap shrink-0">
                        Xem →
                      </a>
                    </div>
                  );
                })}
              </div>
              <p className="text-[11px] text-orange-400">
                Nhà hàng sẽ liên hệ qua SĐT để xác nhận. Đơn hoàn thành hoặc đã hủy sẽ tự biến mất.
              </p>
            </div>
          )}

          {/* Banner booking BANK_TRANSFER hết hạn — gợi ý đặt lại (tất cả đơn hết hạn) */}
          {expiredBts.map(expiredBt => (
            <div key={expiredBt.code} className="mb-4 border border-red-200 bg-red-50 p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-red-700">⏰ Đơn chuyển khoản đã hết hạn</p>
                  <p className="text-xs text-red-500 mt-0.5">
                    Mã: <span className="font-mono font-bold tracking-wider">{expiredBt.code}</span>
                    {" "}· {expiredBt.name} · {expiredBt.date} {expiredBt.time}
                  </p>
                  <p className="text-xs text-red-400 mt-1">Bạn muốn đặt lại với phương thức thanh toán khác?</p>
                </div>
                <button
                  onClick={() => {
                    setExpiredBts(prev => {
                      const next = prev.filter(b => b.code !== expiredBt.code);
                      saveBtBookings(next);
                      return next;
                    });
                  }}
                  className="text-red-300 hover:text-red-500 text-lg leading-none shrink-0"
                  title="Đóng"
                >×</button>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    if (expiredBt.items?.length) restoreDishes(expiredBt.items);
                    setForm(p => ({ ...p, customerName: expiredBt.name, phone: expiredBt.phone, date: expiredBt.date, time: expiredBt.time, guestCount: expiredBt.guestCount, notes: expiredBt.notes, paymentMethod: "CASH" }));
                    setExpiredBts(prev => {
                      const next = prev.filter(b => b.code !== expiredBt.code);
                      saveBtBookings(next);
                      return next;
                    });
                  }}
                  className="flex-1 text-xs font-semibold bg-orange-500 text-white py-2.5 hover:bg-orange-600 transition-colors">
                  💵 Đặt lại — Tiền mặt khi đến
                </button>
                <button
                  onClick={() => {
                    if (expiredBt.items?.length) restoreDishes(expiredBt.items);
                    setForm(p => ({ ...p, customerName: expiredBt.name, phone: expiredBt.phone, date: expiredBt.date, time: expiredBt.time, guestCount: expiredBt.guestCount, notes: expiredBt.notes, paymentMethod: "BANK_TRANSFER" }));
                    setExpiredBts(prev => {
                      const next = prev.filter(b => b.code !== expiredBt.code);
                      saveBtBookings(next);
                      return next;
                    });
                  }}
                  className="flex-1 text-xs font-semibold border border-red-300 text-red-600 py-2.5 hover:bg-red-100 transition-colors">
                  💳 Đặt lại — Chuyển khoản mới
                </button>
              </div>
            </div>
          ))}

          {/* Banner đặt lại đơn gần nhất */}
          {lastBooking && expiredBts.length === 0 && (() => {
            const totalMon = lastBooking.items?.length ? getTotalCount(lastBooking.items) : 0;
            function applyLastBooking(method: "CASH" | "BANK_TRANSFER") {
              if (lastBooking!.items?.length) restoreDishes(lastBooking!.items);
              setForm(p => ({ ...p, customerName: lastBooking!.name, phone: lastBooking!.phone, date: lastBooking!.date, time: lastBooking!.time, guestCount: lastBooking!.guestCount, paymentMethod: method }));
              try { localStorage.removeItem(LAST_BOOKING_KEY); } catch {}
              setLastBooking(null);
            }
            return (
              <div className="mb-6 border border-primary/25 overflow-hidden bg-canvas shadow-sm">

                {/* ── Tiêu đề + toggle ──────────────────────────────── */}
                <div className="flex items-center justify-between px-4 py-3 bg-primary/6 border-b border-primary/15">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[2px] text-primary mb-0.5">
                      Lần trước bạn đã đặt
                    </p>
                    <p className="text-sm font-semibold text-ink">
                      {lastBooking.name}
                      <span className="text-muted font-normal ml-1.5 text-xs">
                        · {lastBooking.guestCount} người · {lastBooking.date} {lastBooking.time}
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {totalMon > 0 && (
                      <span className="text-[11px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                        {totalMon} món
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setLastBookingExpanded(p => !p)}
                      className="text-muted-soft hover:text-ink text-xs border border-hairline px-2 py-1 transition-colors"
                      title={lastBookingExpanded ? "Thu gọn" : "Xem món"}
                    >
                      {lastBookingExpanded ? "Thu gọn ▲" : "Xem món ▼"}
                    </button>
                    <button
                      type="button"
                      onClick={() => { try { localStorage.removeItem(LAST_BOOKING_KEY); } catch {} setLastBooking(null); }}
                      className="text-muted-soft hover:text-red-400 text-base leading-none transition-colors"
                      title="Bỏ qua"
                    >×</button>
                  </div>
                </div>

                {/* ── Danh sách món — horizontal scroll ─────────────── */}
                {lastBookingExpanded && lastBooking.items?.length > 0 && (
                  <div className="border-b border-hairline">
                    <p className="px-4 pt-2.5 pb-1 text-[10px] text-muted-soft uppercase tracking-widest">
                      Món yêu cầu — cuộn ngang để xem tất cả
                    </p>
                    <div className="flex gap-3 overflow-x-auto px-4 pb-3 pt-1 scrollbar-hide">
                      {lastBooking.items.map(item => (
                        <div key={item.id} className="shrink-0 w-24 flex flex-col items-center text-center">
                          {/* Ảnh + badge số lượng */}
                          <div className="relative w-24 h-24 mb-1.5">
                            {item.imageUrl ? (
                              <img
                                src={item.imageUrl}
                                alt={item.name}
                                className="w-24 h-24 object-cover border border-hairline"
                              />
                            ) : (
                              <div className="w-24 h-24 bg-surface-soft border border-hairline flex items-center justify-center text-3xl">
                                🍲
                              </div>
                            )}
                            {/* Badge số lượng góc trên phải */}
                            <span className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-primary text-white text-[11px] font-black flex items-center justify-center shadow">
                              {item.quantity}
                            </span>
                          </div>
                          <p className="text-[11px] font-medium text-ink leading-tight line-clamp-2">{item.name}</p>
                          <p className="text-[10px] text-muted-soft mt-0.5">{formatPrice(item.price)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {lastBookingExpanded && !lastBooking.items?.length && (
                  <p className="px-4 py-3 text-xs text-muted-soft italic border-b border-hairline">
                    Không có món yêu cầu — bạn có thể chọn món mới bên dưới.
                  </p>
                )}

                {/* ── CTA chính ────────────────────────────────────── */}
                <div className="px-4 py-3 space-y-2">
                  <p className="text-[11px] text-muted-soft text-center">
                    Chọn cách thanh toán để điền lại toàn bộ thông tin{totalMon > 0 ? ` + ${totalMon} món` : ""}
                  </p>
                  <button
                    onClick={() => applyLastBooking("CASH")}
                    className="w-full py-2.5 bg-primary text-white text-sm font-bold hover:bg-primary-dark transition-colors flex items-center justify-center gap-2"
                  >
                    💵 Đặt lại — Thanh toán tiền mặt khi đến
                  </button>
                  <button
                    onClick={() => applyLastBooking("BANK_TRANSFER")}
                    className="w-full py-2.5 border-2 border-primary text-primary text-sm font-bold hover:bg-primary/8 transition-colors flex items-center justify-center gap-2"
                  >
                    💳 Đặt lại — Chuyển khoản (QR code)
                  </button>
                </div>
              </div>
            );
          })()}

          {/* Bảng món đã chọn từ thực đơn */}
          {dishes.length > 0 && (
            <div className="border border-primary/20 bg-primary/5 mb-6 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 bg-primary/10 border-b border-primary/20">
                <div className="flex items-center gap-2">
                  <span>🍽️</span>
                  <span className="text-xs font-bold uppercase tracking-wide text-primary">
                    Món yêu cầu đặt trước
                  </span>
                  <span className="bg-primary text-white text-[10px] font-black px-1.5 py-0.5">
                    {getTotalCount(dishes)}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Link href="/san-pham" className="text-xs text-primary hover:underline">
                    + Thêm món
                  </Link>
                  <button
                    type="button"
                    onClick={clearDishes}
                    className="text-xs text-red-400 hover:text-red-600 transition-colors"
                  >
                    Xóa tất cả
                  </button>
                </div>
              </div>
              <div className="divide-y divide-primary/10">
                {dishes.map((d) => (
                  <div key={d.id} className="flex items-center gap-3 px-3 py-2">
                    {/* thumbnail */}
                    <img
                      src={d.imageUrl || `/images/no-image.svg`}
                      alt={d.name}
                      className="w-11 h-11 object-cover flex-shrink-0 rounded"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).src = `/images/no-image.svg`; }}
                    />
                    <span className="flex-1 text-sm text-ink font-medium leading-tight">{d.name}</span>
                    <span className="text-xs text-primary font-bold">{formatPrice(d.price)}</span>
                    {/* qty control */}
                    <div className="flex items-center border border-primary/30 bg-canvas">
                      <button
                        type="button"
                        onClick={() => updateQuantity(d.id, d.quantity - 1)}
                        className="w-7 h-7 flex items-center justify-center text-primary hover:bg-primary/10 text-sm font-bold"
                      >
                        −
                      </button>
                      <span className="w-7 text-center text-sm font-bold text-primary">
                        {d.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(d.id, d.quantity + 1)}
                        className="w-7 h-7 flex items-center justify-center text-primary hover:bg-primary/10 text-sm font-bold"
                      >
                        +
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeDish(d.id)}
                      className="text-gray-300 hover:text-red-400 transition-colors text-base w-5 h-5 flex items-center justify-center"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <div className="px-4 py-2 bg-primary/5 border-t border-primary/10 flex justify-between items-center">
                <span className="text-[10px] text-muted">* Danh sách món tham khảo, giá tính tại quán</span>
                <span className="text-xs font-bold text-primary">
                  Tổng: {formatPrice(dishes.reduce((s, d) => s + d.price * d.quantity, 0))}
                </span>
              </div>
            </div>
          )}

          {dishes.length === 0 && (
            <div className="border border-dashed border-hairline p-4 mb-6 flex items-center justify-between">
              <span className="text-xs text-muted-soft">Chưa chọn món nào từ thực đơn</span>
              <Link href="/san-pham" className="text-xs text-primary font-semibold hover:underline">
                Xem thực đơn →
              </Link>
            </div>
          )}

          <h2 className="text-xl font-bold text-ink mb-1" style={{ fontFamily: "Georgia, serif" }}>
            Thông tin đặt bàn
          </h2>
          <p className="text-xs text-muted-soft mb-7">
            Chúng tôi sẽ xác nhận qua Telegram trong vòng 15 phút.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Họ tên + SĐT */}
            <div className="grid sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                  Họ và tên <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={form.customerName}
                  onChange={(e) => setField("customerName", e.target.value)}
                  placeholder="Nguyễn Văn A"
                  className="w-full border border-hairline px-4 py-2.5 text-sm outline-none focus:border-primary transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                  Số điện thoại <span className="text-red-400">*</span>
                </label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setField("phone", e.target.value)}
                  placeholder="0901 234 567"
                  className="w-full border border-hairline px-4 py-2.5 text-sm outline-none focus:border-primary transition-colors"
                />
              </div>
            </div>

            {/* Ngày + Giờ */}
            <div className="grid sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                  Ngày đặt bàn <span className="text-red-400">*</span>
                </label>

                {/* Quick-pick date pills */}
                {(() => {
                  const nowMin = getNowVNMinutes();
                  const todayHasSlots = nowMin + 60 <= 21 * 60 + 30;
                  const pills: { label: string; date: string }[] = [];
                  if (todayHasSlots) {
                    pills.push({ label: "Hôm nay", date: todayVN });
                  }
                  for (let n = 1; n <= 3; n++) {
                    const d = new Date();
                    d.setDate(d.getDate() + n);
                    pills.push({
                      label: n === 1 ? "Ngày mai" : `${n} ngày nữa`,
                      date: d.toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }),
                    });
                  }
                  function pickDate(date: string) {
                    const isToday = date === todayVN;
                    let time = "12:00";
                    if (isToday) {
                      const minRequired = getNowVNMinutes() + 60;
                      time = TIME_SLOTS.find(s => {
                        const [h, m] = s.split(":").map(Number);
                        return h * 60 + m >= minRequired;
                      }) ?? "12:00";
                    }
                    setForm(p => ({ ...p, date, time }));
                    if (error) setError("");
                  }
                  return (
                    <div className="flex gap-2 mb-2 flex-wrap">
                      {pills.map(p => (
                        <button
                          key={p.date}
                          type="button"
                          onClick={() => pickDate(p.date)}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors touch-manipulation ${
                            form.date === p.date
                              ? "bg-primary text-white border-primary"
                              : "bg-canvas text-gray-600 border-hairline hover:border-primary hover:text-primary"
                          }`}
                          style={{ WebkitTapHighlightColor: "transparent" }}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  );
                })()}

                <input
                  type="date"
                  value={form.date}
                  min={todayVN}
                  onChange={(e) => { setField("date", e.target.value); setField("time", "12:00"); }}
                  className="w-full border border-hairline px-4 py-2.5 text-sm outline-none focus:border-primary transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                  Giờ đến <span className="text-red-400">*</span>
                </label>
                <select
                  value={form.time}
                  onChange={(e) => setField("time", e.target.value)}
                  disabled={!form.date}
                  className="w-full border border-hairline px-4 py-2.5 text-sm outline-none focus:border-primary transition-colors bg-white disabled:opacity-50"
                >
                  {!form.date && <option value="">Chọn ngày trước</option>}
                  {availableSlots.length === 0 && (
                    <option value="">Hôm nay hết giờ đặt — chọn ngày khác</option>
                  )}
                  {availableSlots.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <p className="text-[10px] text-muted-soft mt-1">Phục vụ 08:00 – 22:00</p>
              </div>
            </div>

            {/* Số người */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                Số người <span className="text-red-400">*</span>
              </label>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setField("guestCount", Math.max(1, form.guestCount - 1))}
                  className="w-10 h-10 border border-hairline hover:border-primary hover:text-primary text-xl font-light transition-colors flex items-center justify-center">
                  −
                </button>
                <input type="number" value={form.guestCount} min={1} max={50}
                  onChange={(e) => setField("guestCount", Number(e.target.value))}
                  className="w-20 border border-hairline text-center py-2 text-sm outline-none focus:border-primary transition-colors" />
                <button type="button" onClick={() => setField("guestCount", Math.min(50, form.guestCount + 1))}
                  className="w-10 h-10 border border-hairline hover:border-primary hover:text-primary text-xl font-light transition-colors flex items-center justify-center">
                  +
                </button>
                <span className="text-sm text-muted">người</span>
              </div>
            </div>

            {/* Phương thức thanh toán */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-2.5 uppercase tracking-wide">
                Hình thức đặt cọc <span className="text-red-400">*</span>
              </label>
              <div className="grid sm:grid-cols-2 gap-3">
                {/* Chuyển khoản */}
                <button
                  type="button"
                  onClick={() => setField("paymentMethod", "BANK_TRANSFER")}
                  className={`border-2 p-4 text-left transition-all ${
                    form.paymentMethod === "BANK_TRANSFER"
                      ? "border-primary bg-primary/5"
                      : "border-hairline hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">🏦</span>
                    <span className={`text-sm font-bold ${form.paymentMethod === "BANK_TRANSFER" ? "text-primary" : "text-ink"}`}>
                      Chuyển khoản
                    </span>
                    <span className="ml-auto text-[10px] font-bold bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">
                      Tự xác nhận
                    </span>
                  </div>
                  <p className="text-xs text-muted-soft leading-relaxed mb-2.5">
                    Nhận mã QR chuyển khoản. Đặt bàn xác nhận ngay khi chúng tôi nhận được tiền.
                  </p>
                  <div className="flex items-center gap-1.5 border-t border-gray-100 pt-2">
                    <span className="text-sm">📞</span>
                    <span className="text-[11px] text-gray-500">
                      Hỗ trợ:{" "}
                      <a
                        href="tel:0123456789"
                        onClick={e => e.stopPropagation()}
                        className="font-bold text-primary hover:underline"
                      >
                        0123 456 789
                      </a>
                    </span>
                  </div>
                </button>

                {/* Tiền mặt */}
                <button
                  type="button"
                  onClick={() => setField("paymentMethod", "CASH")}
                  className={`border-2 p-4 text-left transition-all ${
                    form.paymentMethod === "CASH"
                      ? "border-orange-400 bg-orange-50"
                      : "border-hairline hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">💵</span>
                    <span className={`text-sm font-bold ${form.paymentMethod === "CASH" ? "text-orange-600" : "text-ink"}`}>
                      Tiền mặt khi đến
                    </span>
                  </div>
                  <p className="text-xs text-muted-soft leading-relaxed">
                    Vui lòng gọi điện để đặt bàn trực tiếp với nhân viên.
                  </p>
                </button>
              </div>

              {/* Hướng dẫn khi chọn tiền mặt */}
              {form.paymentMethod === "CASH" && (
                <div className="mt-3 flex items-start gap-2.5 bg-orange-50 border border-orange-200 px-4 py-3">
                  <span className="text-base mt-0.5 flex-shrink-0">ℹ️</span>
                  <div className="text-xs text-orange-700 leading-relaxed">
                    <span className="font-bold">Thanh toán tiền mặt khi đến nhà hàng.</span>
                    {" "}Sau khi gửi yêu cầu, nhà hàng sẽ gọi lại xác nhận qua số điện thoại của bạn trong vòng <span className="font-semibold">15–30 phút</span>.
                  </div>
                </div>
              )}
            </div>

            {/* Ghi chú */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                Ghi chú (tuỳ chọn)
              </label>
              <textarea
                value={form.notes}
                onChange={(e) => setField("notes", e.target.value)}
                placeholder="Dịp kỷ niệm, cần bánh kem, yêu cầu bàn riêng..."
                rows={3}
                className="w-full border border-hairline px-4 py-2.5 text-sm outline-none focus:border-primary transition-colors resize-none"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            {form.paymentMethod === "BANK_TRANSFER" ? (
              <button type="submit" disabled={loading}
                className="w-full bg-primary text-white py-3.5 text-sm font-bold uppercase tracking-wide hover:bg-primary-dark transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
                {loading ? "Đang xử lý..." : "Xác Nhận Đặt Bàn"}
              </button>
            ) : (
              <div className="space-y-3">
                <div className="w-full border-2 border-orange-300 bg-orange-50 py-3.5 px-4 text-sm text-orange-700 text-center font-semibold cursor-default select-none">
                  💵 Vui lòng liên hệ nhà hàng để đặt bàn bằng tiền mặt
                </div>
                <div className="flex items-center gap-3">
                  <a href="tel:0123456789"
                    className="flex-1 block text-center border-2 border-orange-400 text-orange-600 py-3 text-sm font-bold hover:bg-orange-50 transition-colors">
                    📞 Gọi: 0123 456 789
                  </a>
                  <button type="submit" disabled={loading}
                    className="flex-1 bg-orange-500 text-white py-3 text-sm font-bold hover:bg-orange-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
                    {loading ? "Đang gửi..." : "Gửi Yêu Cầu Đặt Bàn →"}
                  </button>
                </div>
                <p className="text-[11px] text-muted-soft text-center">
                  Nhà hàng sẽ liên hệ xác nhận qua số điện thoại của bạn trong vòng 15 phút.
                </p>
              </div>
            )}

            <p className="text-[11px] text-muted-soft text-center leading-relaxed">
              Bằng cách đặt bàn, bạn đồng ý với các điều khoản của nhà hàng.
              Đặt bàn sẽ hết hạn sau 30 phút nếu chưa thanh toán (áp dụng với chuyển khoản).
            </p>
          </form>
        </div>

        {/* ── CỘT PHẢI ─────────────────────────────────────────────────── */}
        <div className="space-y-5">
          {/* Thực đơn preview */}
          <div className="border border-hairline bg-canvas overflow-hidden">
            <div className="bg-primary-dark text-white px-4 py-3 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wide">Khám phá thực đơn</h3>
              <Link href="/san-pham" className="text-white/70 text-[10px] hover:text-white transition-colors">
                Xem tất cả →
              </Link>
            </div>
            <div className="p-4">
              <p className="text-xs text-muted mb-3 leading-relaxed">
                Chưa biết muốn thưởng thức gì? Xem thực đơn và chọn món yêu thích trước khi đặt bàn.
              </p>
              <div className="grid grid-cols-2 gap-2 mb-3">
                {MENU_CATEGORIES.map((c) => (
                  <Link
                    key={c.cat}
                    href={`/san-pham?category=${c.cat}`}
                    className="text-xs text-gray-600 py-2 px-3 border border-hairline text-center hover:border-primary hover:text-primary hover:bg-primary/5 transition-colors"
                  >
                    {c.label}
                  </Link>
                ))}
              </div>
              <Link
                href="/san-pham"
                className="block w-full text-center border border-primary text-primary text-xs font-bold py-2 hover:bg-primary hover:text-white transition-colors"
              >
                Xem toàn bộ thực đơn
              </Link>
            </div>
          </div>

          {/* Hướng dẫn */}
          <div className="bg-cream p-6">
            <h3 className="font-bold text-ink text-sm mb-4 uppercase tracking-wide">
              Hướng dẫn đặt bàn
            </h3>
            <ol className="space-y-3">
              {[
                "Điền thông tin và chọn phương thức thanh toán",
                "Nhận mã đặt bàn qua trang kết quả",
                "Chuyển khoản (nếu chọn) để xác nhận",
                "Nhà hàng sẽ liên hệ nếu cần thêm thông tin",
                "Đến đúng giờ và báo mã cho nhân viên",
              ].map((step, i) => (
                <li key={i} className="flex gap-3 text-xs text-gray-600">
                  <span className="w-5 h-5 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>

          {/* Thông tin nhà hàng */}
          <div className="border border-hairline p-6">
            <h3 className="font-bold text-ink text-sm mb-4 uppercase tracking-wide">
              Thông tin nhà hàng
            </h3>
            <div className="space-y-3 text-xs text-gray-600">
              <div className="flex gap-2">
                <span className="text-base">📍</span>
                <span>123 Đường Ẩm Thực, Phường Bến Nghé, Quận 1, TP.HCM</span>
              </div>
              <div className="flex gap-2">
                <span className="text-base">📞</span>
                <a href="tel:0123456789" className="hover:text-primary font-semibold">0123 456 789</a>
              </div>
              <div className="flex gap-2">
                <span className="text-base">🕐</span>
                <span>Mở cửa 08:00 – 22:00 (Thứ 2 – Chủ Nhật)</span>
              </div>
            </div>
          </div>

          {/* Lưu ý */}
          <div className="bg-yellow-50 border border-yellow-200 p-5">
            <div className="flex gap-2 mb-2">
              <span>⚠️</span>
              <span className="text-xs font-bold text-yellow-800 uppercase tracking-wide">Lưu ý</span>
            </div>
            <ul className="space-y-1.5 text-xs text-yellow-800 leading-relaxed">
              <li>• Đặt bàn cần trước ít nhất <strong>1 tiếng</strong></li>
              <li>• Nhà hàng phục vụ từ <strong>08:00 đến 22:00</strong></li>
              <li>• Nếu đến muộn hơn 30 phút, bàn có thể bị hủy</li>
              <li>• Liên hệ hotline để hủy hoặc đổi lịch</li>
            </ul>
          </div>

          <div className="text-center py-2">
            <p className="text-xs text-muted-soft mb-2">Đã có mã đặt bàn?</p>
            <Link href="/dat-ban/lich-su" className="text-xs text-primary font-semibold hover:underline">
              Tra cứu trạng thái đặt bàn →
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Page wrapper (Suspense cho useSearchParams) ─────────────────────────────
export default function DatBanPage() {
  return (
    <>
      {/* Hero */}
      <div
        className="h-[200px] flex flex-col items-center justify-center text-white text-center px-4"
        style={{ background: "linear-gradient(135deg, #a9583e 0%, #cc785c 100%)" }}
      >
        <p className="text-xs uppercase tracking-[4px] opacity-70 mb-3">Nhà hàng Thu Hương</p>
        <h1 className="text-4xl font-bold tracking-tight">
          Đặt Bàn Trực Tuyến
        </h1>
        <div className="w-12 h-0.5 bg-white/60 mx-auto mt-4" />
      </div>

      {/* Breadcrumb */}
      <div className="bg-surface-soft border-b border-hairline py-2">
        <div className="max-w-[1200px] mx-auto px-4 text-xs text-muted-soft flex gap-2">
          <Link href="/" className="hover:text-primary">Trang chủ</Link>
          <span>›</span>
          <span className="text-gray-600">Đặt bàn</span>
        </div>
      </div>

      <Suspense fallback={
        <div className="max-w-[1200px] mx-auto px-4 py-20 text-center text-sm text-muted-soft">
          Đang tải...
        </div>
      }>
        <BookingFormContent />
      </Suspense>
    </>
  );
}
