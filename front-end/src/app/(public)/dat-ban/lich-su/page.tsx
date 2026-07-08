"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { getAuthHeaders } from "@/lib/auth";
import { syncSwitchPayment, LAST_BOOKING_KEY, SavedBooking } from "@/lib/bookingStorage";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api/v1";

type BookingStatus = "PENDING_PAYMENT" | "CONFIRMED" | "CHECKED_IN" | "COMPLETED" | "CANCELLED" | "EXPIRED";

type Booking = {
  id: number;
  bookingCode: string;
  customerName: string;
  customerPhone?: string;
  scheduledTime: string;
  guestCount: number;
  status: BookingStatus;
  paymentMethod: "BANK_TRANSFER" | "CASH";
  totalAmount: number;
};

const STATUS_MAP: Record<BookingStatus, { label: string; cls: string }> = {
  PENDING_PAYMENT: { label: "Chờ thanh toán", cls: "bg-yellow-100 text-yellow-700" },
  CONFIRMED:       { label: "Đã xác nhận",    cls: "bg-green-100 text-green-700"  },
  CHECKED_IN:      { label: "Đã check-in",     cls: "bg-blue-100 text-blue-700"   },
  COMPLETED:       { label: "Hoàn thành",      cls: "bg-canvas text-gray-600"     },
  CANCELLED:       { label: "Đã hủy",          cls: "bg-red-100 text-red-500"     },
  EXPIRED:         { label: "Hết hạn (QR)",      cls: "bg-gray-100 text-gray-500"   },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("vi-VN", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  });
}

function formatPrice(n: number) {
  return new Intl.NumberFormat("vi-VN").format(n) + "đ";
}

async function fetchByPhone(phone: string): Promise<{ bookings: Booking[]; error: string }> {
  try {
    const res = await fetch(`${BASE_URL}/bookings/history?phone=${encodeURIComponent(phone)}&page=0&size=50`);
    const json = await res.json();
    if (!res.ok || json.statusCode !== 200) return { bookings: [], error: json.message ?? "Lỗi khi tải dữ liệu." };
    const items: Booking[] = json.data?.content ?? [];
    return { bookings: items, error: items.length === 0 ? "Không có đặt bàn nào." : "" };
  } catch {
    return { bookings: [], error: "Không kết nối được máy chủ." };
  }
}

async function fetchByCode(code: string): Promise<Booking | null> {
  try {
    const res = await fetch(`${BASE_URL}/bookings/${code}`);
    const json = await res.json();
    if (res.ok && json.statusCode === 200) return json.data as Booking;
    return null;
  } catch {
    return null;
  }
}

const DISMISSED_KEY = "dismissed-bookings";

function getDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveDismissed(set: Set<string>) {
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...set]));
  } catch {}
}

async function switchPaymentMethod(bookingCode: string, next: "CASH" | "BANK_TRANSFER"): Promise<string> {
  try {
    const res = await fetch(`${BASE_URL}/bookings/switch-payment/${bookingCode}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentMethod: next }),
    });
    const json = await res.json();
    return json.statusCode === 200 ? "" : (json.message ?? "Không thể đổi phương thức");
  } catch {
    return "Không kết nối được máy chủ";
  }
}

function BookingList({
  bookings,
  title,
  dismissed,
  onDismiss,
  onRestoreAll,
  onUpdate,
}: {
  bookings: Booking[];
  title?: string;
  dismissed: Set<string>;
  onDismiss: (code: string) => void;
  onRestoreAll: (codes: string[]) => void;
  onUpdate: (code: string, next: "CASH" | "BANK_TRANSFER") => void;
}) {
  const router = useRouter();
  const [switching, setSwitching] = useState<Record<string, boolean>>({});
  const [switchError, setSwitchError] = useState<Record<string, string>>({});
  const [reordering, setReordering] = useState<string | null>(null);

  async function handleReorder(b: Booking) {
    setReordering(b.bookingCode);
    const vnDate = new Date(b.scheduledTime).toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });
    const vnTime = new Date(b.scheduledTime).toLocaleTimeString("en-GB", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit" });
    let items: SavedBooking["items"] = [];
    try {
      const res = await fetch(`${BASE_URL}/bookings/${b.bookingCode}`);
      const json = await res.json();
      items = ((json.data?.items ?? []) as { productId: number; productName: string; productPrice: number; quantity: number }[]).map(i => ({
        id: i.productId, name: i.productName, price: i.productPrice, quantity: i.quantity,
      }));
    } catch {}
    const payload: SavedBooking = {
      code: b.bookingCode, name: b.customerName, phone: b.customerPhone ?? "",
      date: vnDate, time: vnTime, guestCount: b.guestCount, notes: "", items,
    };
    // Dùng sessionStorage để dat-ban page tự apply ngay — không hiện banner hỏi
    try { sessionStorage.setItem("booking_reorder_now", JSON.stringify(payload)); } catch {}
    router.push("/dat-ban");
  }

  async function handleSwitch(b: Booking) {
    const next = b.paymentMethod === "BANK_TRANSFER" ? "CASH" : "BANK_TRANSFER";
    setSwitching((p) => ({ ...p, [b.bookingCode]: true }));
    setSwitchError((p) => ({ ...p, [b.bookingCode]: "" }));
    const err = await switchPaymentMethod(b.bookingCode, next);
    setSwitching((p) => ({ ...p, [b.bookingCode]: false }));
    if (err) {
      setSwitchError((p) => ({ ...p, [b.bookingCode]: err }));
    } else {
      onUpdate(b.bookingCode, next);
    }
  }

  const visible = bookings.filter((b) => {
    if (b.status === "EXPIRED") return false;
    if (b.status === "CANCELLED" && dismissed.has(b.bookingCode)) return false;
    return true;
  });
  const hiddenCount = bookings.filter(
    (b) => b.status === "CANCELLED" && dismissed.has(b.bookingCode)
  ).length;

  if (visible.length === 0 && bookings.length > 0) {
    return (
      <p className="text-xs text-muted-soft text-center py-4">
        Đã ẩn {hiddenCount} đặt bàn.{" "}
        <button
          onClick={() => onRestoreAll(bookings.map((b) => b.bookingCode))}
          className="text-primary underline"
        >
          Hiện lại
        </button>
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {title && (
        <p className="text-xs text-muted-soft">
          {title}: <strong className="text-ink">{visible.length} đặt bàn</strong>
          {hiddenCount > 0 && <span className="ml-2 text-muted-soft">(đã ẩn {hiddenCount})</span>}
        </p>
      )}
      {visible.map((b) => {
        const s = { ...STATUS_MAP[b.status] };
        // CASH + PENDING_PAYMENT → "Chờ xác nhận" (không phải "Chờ thanh toán")
        if (b.status === "PENDING_PAYMENT" && b.paymentMethod === "CASH") {
          s.label = "Chờ xác nhận";
        }
        return (
          <div key={b.bookingCode} className="bg-canvas border border-hairline">
            <div className="flex items-start justify-between gap-4 p-4 pb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-sm text-ink">{b.customerName}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${s.cls}`}>{s.label}</span>
                </div>
                <span className="text-xs text-muted-soft font-mono">#{b.bookingCode}</span>
              </div>
              <div className="flex flex-col items-end gap-2 flex-shrink-0">
                <Link href={`/dat-ban/${b.bookingCode}`}
                  className="text-xs text-primary font-semibold hover:underline">
                  Xem chi tiết →
                </Link>
                <button
                  onClick={() => handleReorder(b)}
                  disabled={reordering === b.bookingCode}
                  className="text-[11px] font-bold bg-primary text-white px-3 py-1.5 hover:bg-primary-dark active:scale-95 transition-all disabled:opacity-50 whitespace-nowrap shadow-sm"
                >
                  {reordering === b.bookingCode ? "⏳ Đang tải..." : "🔄 Đặt lại ngay"}
                </button>
                {b.status === "CANCELLED" && (
                  <button
                    onClick={() => onDismiss(b.bookingCode)}
                    className="text-[11px] text-muted-soft border border-hairline px-2 py-0.5 hover:border-red-300 hover:text-red-400 transition-colors"
                  >
                    Ẩn
                  </button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 px-4 pb-4 text-xs">
              <div>
                <span className="text-muted-soft block mb-0.5">Thời gian</span>
                <span className="text-ink font-medium">{formatDate(b.scheduledTime)}</span>
              </div>
              <div>
                <span className="text-muted-soft block mb-0.5">Số người</span>
                <span className="text-ink font-medium">{b.guestCount ?? "—"} người</span>
              </div>
              <div>
                <span className="text-muted-soft block mb-0.5">Thanh toán</span>
                <span className="text-ink font-medium">
                  {b.paymentMethod === "BANK_TRANSFER" ? "Chuyển khoản" : "Tiền mặt"}
                </span>
              </div>
              {b.totalAmount > 0 && (
                <div>
                  <span className="text-muted-soft block mb-0.5">Số tiền</span>
                  <span className="text-primary font-bold">{formatPrice(b.totalAmount)}</span>
                </div>
              )}
            </div>
            {b.status === "PENDING_PAYMENT" && (
              <div className="px-4 pb-4">
                <button
                  onClick={() => handleSwitch(b)}
                  disabled={switching[b.bookingCode]}
                  className="text-xs border border-hairline text-muted px-3 py-1.5 hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
                >
                  {switching[b.bookingCode]
                    ? "Đang xử lý..."
                    : b.paymentMethod === "BANK_TRANSFER"
                      ? "💵 Đổi sang tiền mặt"
                      : "💳 Đổi sang chuyển khoản"}
                </button>
                {switchError[b.bookingCode] && (
                  <p className="text-xs text-red-500 mt-1">{switchError[b.bookingCode]}</p>
                )}
              </div>
            )}
          </div>
        );
      })}

      {hiddenCount > 0 && (
        <div className="text-center pt-1">
          <button
            onClick={() => onRestoreAll(bookings.map((b) => b.bookingCode))}
            className="text-xs text-muted-soft border border-hairline px-4 py-1.5 hover:border-primary hover:text-primary transition-colors"
          >
            Hiện lại {hiddenCount} đặt bàn đã ẩn
          </button>
        </div>
      )}
    </div>
  );
}

export default function LichSuDatBanPage() {
  const { user, loading: authLoading } = useAuth();

  // Dismissed bookings (localStorage — chỉ ẩn ở UI, không xóa DB)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  useEffect(() => { setDismissed(getDismissed()); }, []);

  function handleDismiss(code: string) {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(code);
      saveDismissed(next);
      return next;
    });
  }

  function handleUpdateMethod(code: string, next: "CASH" | "BANK_TRANSFER") {
    setMyBookings((prev) =>
      prev.map((b) => (b.bookingCode === code ? { ...b, paymentMethod: next } : b))
    );
    setSearchBookings((prev) =>
      prev.map((b) => (b.bookingCode === code ? { ...b, paymentMethod: next } : b))
    );
    // Đồng bộ localStorage để trang đặt bàn phản ánh phương thức mới nhất
    const booking =
      myBookings.find((b) => b.bookingCode === code) ??
      searchBookings.find((b) => b.bookingCode === code);
    if (booking) {
      const vnDate = new Date(booking.scheduledTime).toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });
      const vnTime = new Date(booking.scheduledTime).toLocaleTimeString("en-GB", {
        timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit",
      });
      syncSwitchPayment(code, next, {
        name: booking.customerName,
        phone: booking.customerPhone ?? "",
        date: vnDate,
        time: vnTime,
        guestCount: booking.guestCount,
      });
    }
  }

  function handleRestoreAll(codes: string[]) {
    setDismissed((prev) => {
      const next = new Set(prev);
      codes.forEach((c) => next.delete(c));
      saveDismissed(next);
      return next;
    });
  }

  // State dành cho tìm kiếm thủ công (khi chưa đăng nhập)
  const [searchTab, setSearchTab] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [bookingCodeInput, setBookingCodeInput] = useState("");
  const [searchBookings, setSearchBookings] = useState<Booking[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [searched, setSearched] = useState("");

  // State dành cho đăng nhập
  const [myBookings, setMyBookings] = useState<Booking[]>([]);
  const [myLoading, setMyLoading] = useState(false);
  const [myError, setMyError] = useState("");

  // Tự động tải khi đã đăng nhập:
  // 1) Fetch theo user.phone nếu có
  // 2) Fetch thêm từng booking code lưu trong localStorage
  // 3) Merge + dedup theo bookingCode
  useEffect(() => {
    if (authLoading || !user) return;
    setMyLoading(true);

    fetch(`${BASE_URL}/bookings/my?page=0&size=50`, { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((j) => {
        const bookings: Booking[] = j.statusCode === 200 ? (j.data?.content ?? []) : [];
        setMyBookings(bookings);
        setMyError(bookings.length === 0 ? "Không có đặt bàn nào." : "");
      })
      .catch(() => setMyError("Không kết nối được máy chủ."))
      .finally(() => setMyLoading(false));
  }, [authLoading, user]);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const clean = phone.replace(/\s/g, "");
    if (!/^[0-9]{9,11}$/.test(clean)) {
      setSearchError("Số điện thoại không hợp lệ (9–11 chữ số)");
      return;
    }
    setSearchLoading(true);
    setSearchError("");
    setSearchBookings([]);
    const { bookings, error } = await fetchByPhone(clean);
    setSearchBookings(bookings);
    setSearchError(error);
    setSearched(clean);
    setSearchLoading(false);
  }

  async function handleSearchByCode(e: React.FormEvent) {
    e.preventDefault();
    const code = bookingCodeInput.trim().toUpperCase();
    if (!code) { setSearchError("Vui lòng nhập mã đặt bàn."); return; }
    setSearchLoading(true);
    setSearchError("");
    setSearchBookings([]);
    const booking = await fetchByCode(code);
    if (booking) {
      setSearchBookings([booking]);
      setSearched(code);
      setSearchError("");
    } else {
      setSearchBookings([]);
      setSearchError("Không tìm thấy đặt bàn với mã này.");
    }
    setSearchLoading(false);
  }

  return (
    <>
      {/* Header */}
      <div className="py-8 text-center text-white"
        style={{ background: "linear-gradient(135deg, #a9583e 0%, #cc785c 100%)" }}>
        <p className="text-xs uppercase tracking-[4px] opacity-70 mb-2">Tài khoản</p>
        <h1 className="text-2xl font-bold" style={{ fontFamily: "Georgia, serif" }}>Lịch Sử Đặt Bàn</h1>
      </div>

      {/* Breadcrumb */}
      <div className="bg-surface-soft border-b border-hairline py-2">
        <div className="max-w-[800px] mx-auto px-4 text-xs text-muted-soft flex gap-2">
          <Link href="/" className="hover:text-primary">Trang chủ</Link>
          <span>›</span>
          <Link href="/tai-khoan" className="hover:text-primary">Tài khoản</Link>
          <span>›</span>
          <span className="text-gray-600">Lịch sử đặt bàn</span>
        </div>
      </div>

      <div className="max-w-[800px] mx-auto px-4 py-10 space-y-8">

        {/* === ĐÃ ĐĂNG NHẬP === */}
        {/* === ĐÃ ĐĂNG NHẬP === */}
        {!authLoading && user && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-ink uppercase tracking-wide">Đặt bàn của bạn</h2>
              <span className="text-xs text-muted-soft">
                Xin chào, <strong className="text-ink">{user.fullName ?? user.username}</strong>
              </span>
            </div>
            {myLoading && (
              <div className="text-center py-10 text-sm text-muted-soft animate-pulse">Đang tải...</div>
            )}
            {!myLoading && myError && (
              <div className="bg-surface-soft border border-hairline px-5 py-4 text-sm text-muted-soft text-center">
                {myError}
              </div>
            )}
            {!myLoading && !myError && myBookings.length > 0 && (
              <BookingList
                bookings={myBookings}
                dismissed={dismissed}
                onDismiss={handleDismiss}
                onRestoreAll={handleRestoreAll}
                onUpdate={handleUpdateMethod}
              />
            )}
          </div>
        )}

        {/* === TÌM KIẾM THỦ CÔNG (luôn hiện) === */}
        {!authLoading && (
        <div className="bg-canvas border border-hairline">
          {/* Tabs */}
          <div className="flex border-b border-hairline">
            <button
              onClick={() => { setSearchTab("phone"); setSearchError(""); setSearchBookings([]); }}
              className={`flex-1 py-3 text-xs font-semibold uppercase tracking-wide transition-colors ${
                searchTab === "phone"
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted hover:text-ink"
              }`}
            >
              Tra cứu theo SĐT
            </button>
            <button
              onClick={() => { setSearchTab("code"); setSearchError(""); setSearchBookings([]); }}
              className={`flex-1 py-3 text-xs font-semibold uppercase tracking-wide transition-colors ${
                searchTab === "code"
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted hover:text-ink"
              }`}
            >
              Tra cứu theo mã đặt bàn
            </button>
          </div>

          <div className="p-6">
            {searchTab === "phone" ? (
              <>
                <p className="text-xs text-muted-soft mb-4">Nhập số điện thoại đã dùng khi đặt bàn.</p>
                <form onSubmit={handleSearch} className="flex gap-2">
                  <input type="tel" value={phone}
                    onChange={(e) => { setPhone(e.target.value); setSearchError(""); }}
                    placeholder="Vd: 0901234567"
                    className="flex-1 border border-hairline px-4 py-2.5 text-sm outline-none focus:border-primary transition-colors" />
                  <button type="submit" disabled={searchLoading}
                    className="bg-primary text-white px-6 py-2.5 text-sm font-bold hover:bg-primary-dark transition-colors disabled:opacity-60 whitespace-nowrap">
                    {searchLoading ? "..." : "Tra cứu"}
                  </button>
                </form>
              </>
            ) : (
              <>
                <p className="text-xs text-muted-soft mb-4">
                  Nhập mã đặt bàn đã nhận sau khi đặt (dạng <span className="font-mono font-bold text-ink">BK-YYYYMMDD-XXX</span>).
                </p>
                <form onSubmit={handleSearchByCode} className="flex gap-2">
                  <input type="text" value={bookingCodeInput}
                    onChange={(e) => { setBookingCodeInput(e.target.value); setSearchError(""); }}
                    placeholder="Vd: BK-20260630-001"
                    className="flex-1 border border-hairline px-4 py-2.5 text-sm font-mono uppercase outline-none focus:border-primary transition-colors" />
                  <button type="submit" disabled={searchLoading}
                    className="bg-primary text-white px-6 py-2.5 text-sm font-bold hover:bg-primary-dark transition-colors disabled:opacity-60 whitespace-nowrap">
                    {searchLoading ? "..." : "Tìm"}
                  </button>
                </form>
              </>
            )}

            {searchError && <p className="mt-3 text-sm text-red-500">{searchError}</p>}

            {searchBookings.length > 0 && (
              <div className="mt-5">
                <BookingList
                  bookings={searchBookings}
                  title={`Kết quả cho ${searched}`}
                  dismissed={dismissed}
                  onDismiss={handleDismiss}
                  onRestoreAll={handleRestoreAll}
                  onUpdate={handleUpdateMethod}
                />
              </div>
            )}
          </div>
        </div>
        )}

        {/* CTA */}
        <div className="text-center">
          <p className="text-xs text-muted-soft mb-3">Muốn đặt thêm bàn?</p>
          <Link href="/dat-ban"
            className="inline-block bg-primary text-white px-8 py-3 text-sm font-bold uppercase tracking-wide hover:bg-primary-dark transition-colors">
            Đặt Bàn Mới
          </Link>
        </div>

      </div>
    </>
  );
}
