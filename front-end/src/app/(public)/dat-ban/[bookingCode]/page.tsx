import Link from "next/link";
import Image from "next/image";
import RefreshButton from "./RefreshButton";
import BookingItemsEditor from "./BookingItemsEditor";
import BookingStatusWatcher from "./BookingStatusWatcher";
import CancelBookingButton from "./CancelBookingButton";
import SwitchPaymentButton from "./SwitchPaymentButton";
import ReorderButton from "./ReorderButton";

// Server Component: phải dùng absolute URL — Node.js fetch không nhận relative URL
const BASE_URL = process.env.BACKEND_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api/v1";

type BookingStatus = "PENDING_PAYMENT" | "CONFIRMED" | "CHECKED_IN" | "COMPLETED" | "CANCELLED" | "EXPIRED";

type BookingItem = {
  id: number;
  productId: number;
  productName: string;
  productPrice: number;
  quantity: number;
  saleUnit: string;
  itemTotal: number;
};

type Product = {
  id: number;
  name: string;
  price: number;
  category: string;
  imageUrl?: string;
  status: string;
};

type Booking = {
  id: number;
  bookingCode: string;
  customerName: string;
  customerPhone: string;
  scheduledTime: string;
  guestCount: number;
  status: BookingStatus;
  paymentMethod: "BANK_TRANSFER" | "CASH";
  totalAmount: number;
  note?: string;
  tableName?: string;
  items: BookingItem[];
};

async function fetchBooking(bookingCode: string): Promise<Booking | null> {
  try {
    const res = await fetch(`${BASE_URL}/bookings/${bookingCode}`, { cache: "no-store" });
    if (!res.ok) return null;
    const json = await res.json();
    if (json.statusCode !== 200) return null;
    return json.data as Booking;
  } catch {
    return null;
  }
}

async function fetchProducts(): Promise<Product[]> {
  try {
    const res = await fetch(`${BASE_URL}/products?size=100`, { next: { revalidate: 300 } });
    if (!res.ok) return [];
    const json = await res.json();
    const list = json.data?.content ?? json.data ?? [];
    return (list as Product[]).filter((p) => p.status === "AVAILABLE");
  } catch {
    return [];
  }
}

const STATUS_CONFIG: Record<
  BookingStatus,
  { label: string; color: string; bg: string; border: string; icon: string; desc: string }
> = {
  PENDING_PAYMENT: {
    label: "Chờ thanh toán",
    color: "text-yellow-700",
    bg: "bg-yellow-50",
    border: "border-yellow-300",
    icon: "⏳",
    desc: "Đặt bàn của bạn đang chờ xác nhận thanh toán.",
  },
  CONFIRMED: {
    label: "Đã xác nhận",
    color: "text-green-700",
    bg: "bg-green-50",
    border: "border-green-300",
    icon: "✅",
    desc: "Tuyệt vời! Chúng tôi đã xác nhận đặt bàn của bạn.",
  },
  CHECKED_IN: {
    label: "Đã check-in",
    color: "text-blue-700",
    bg: "bg-blue-50",
    border: "border-blue-300",
    icon: "🏠",
    desc: "Bạn đã check-in. Chúc bạn một bữa ăn ngon miệng!",
  },
  COMPLETED: {
    label: "Hoàn thành",
    color: "text-gray-600",
    bg: "bg-surface-soft",
    border: "border-gray-300",
    icon: "🎉",
    desc: "Cảm ơn bạn đã đến nhà hàng Thu Hương. Hẹn gặp lại!",
  },
  CANCELLED: {
    label: "Đã hủy",
    color: "text-red-600",
    bg: "bg-red-50",
    border: "border-red-300",
    icon: "❌",
    desc: "Đặt bàn đã bị hủy. Bạn có thể đặt bàn mới bất cứ lúc nào.",
  },
  EXPIRED: {
    label: "Hết hạn",
    color: "text-muted",
    bg: "bg-surface-soft",
    border: "border-gray-300",
    icon: "⌛",
    desc: "Đặt bàn đã hết hạn do không hoàn tất thanh toán trong 30 phút.",
  },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  });
}

function formatPrice(n: number) {
  return new Intl.NumberFormat("vi-VN").format(n) + "đ";
}

function buildVietQR(amount: number, content: string): string {
  const params = new URLSearchParams({
    amount: String(amount),
    addInfo: content,
    accountName: "TRAN MINH PHUC",
  });
  return `https://img.vietqr.io/image/TPB-0357527135-compact2.jpg?${params.toString()}`;
}

export default async function BookingResultPage({
  params,
}: {
  params: Promise<{ bookingCode: string }>;
}) {
  const { bookingCode } = await params;
  const [booking, products] = await Promise.all([fetchBooking(bookingCode), fetchProducts()]);

  if (!booking) {
    return (
      <>
        <div className="max-w-[600px] mx-auto px-4 py-20 text-center">
          <div className="text-5xl mb-4">🔍</div>
          <h1 className="text-2xl font-bold text-ink mb-2">
            Không tìm thấy đặt bàn
          </h1>
          <p className="text-sm text-muted mb-8">
            Mã <strong className="text-ink">{bookingCode}</strong> không tồn tại hoặc đã bị xóa.
          </p>
          <Link
            href="/dat-ban"
            className="inline-block bg-primary text-white px-8 py-3 text-sm font-bold uppercase tracking-wide hover:bg-primary-dark transition-colors"
          >
            Đặt bàn mới
          </Link>
        </div>
      </>
    );
  }

  const isPendingBankTransfer =
    booking.status === "PENDING_PAYMENT" && booking.paymentMethod === "BANK_TRANSFER";
  const isPendingCash =
    booking.status === "PENDING_PAYMENT" && booking.paymentMethod === "CASH";

  // Override label/desc cho CASH pending — không phải "chờ thanh toán"
  const cfg = isPendingCash
    ? {
        ...STATUS_CONFIG.PENDING_PAYMENT,
        label: "Chờ xác nhận",
        icon: "💵",
        desc: "Yêu cầu đặt bàn của bạn đã được ghi nhận. Nhà hàng sẽ liên hệ qua SĐT để xác nhận.",
      }
    : STATUS_CONFIG[booking.status];
  const isActive = booking.status === "CONFIRMED" || booking.status === "PENDING_PAYMENT";
  // Chỉ cho chỉnh sửa món khi chưa thanh toán hoặc đã xác nhận
  const isEditable = booking.status === "PENDING_PAYMENT";

  // Tính VN date/time từ scheduledTime để pass vào SwitchPaymentButton (sync localStorage)
  const vnDate = new Date(booking.scheduledTime).toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });
  const vnTime = new Date(booking.scheduledTime).toLocaleTimeString("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit",
  });
  const switchProps = {
    bookingCode: booking.bookingCode,
    customerName: booking.customerName,
    customerPhone: booking.customerPhone,
    scheduledDate: vnDate,
    scheduledTime: vnTime,
    guestCount: booking.guestCount,
  };

  return (
    <>
      {/* Poll trạng thái — tự hiện toast khi chuyển khoản xác nhận */}
      <BookingStatusWatcher
        bookingCode={booking.bookingCode}
        initialStatus={booking.status}
        paymentMethod={booking.paymentMethod}
      />

      {/* Top bar */}
      <div
        className="py-6 text-center text-white"
        style={{ background: "linear-gradient(135deg, #a9583e 0%, #cc785c 100%)" }}
      >
        <div className="text-3xl mb-1">{cfg.icon}</div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: "Georgia, serif" }}>
          {cfg.label}
        </h1>
        <p className="text-white/70 text-sm mt-1">{cfg.desc}</p>
      </div>

      {/* Breadcrumb + action bar */}
      <div className="bg-surface-soft border-b border-hairline py-2">
        <div className="w-full px-6 flex items-center justify-between gap-4">
          <div className="text-xs text-muted-soft flex gap-2 items-center">
            <Link href="/" className="hover:text-primary">Trang chủ</Link>
            <span>›</span>
            <Link href="/dat-ban/lich-su" className="hover:text-primary">Lịch sử đặt bàn</Link>
            <span>›</span>
            <span className="text-gray-600">{booking.bookingCode}</span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Link
              href="/dat-ban/lich-su"
              className="flex items-center gap-1.5 text-xs text-muted border border-hairline px-3 py-2 hover:border-primary hover:text-primary transition-colors"
            >
              ← Lịch sử
            </Link>
            <ReorderButton
              bookingCode={booking.bookingCode}
              customerName={booking.customerName}
              customerPhone={booking.customerPhone}
              vnDate={vnDate}
              vnTime={vnTime}
              guestCount={booking.guestCount}
              items={booking.items.map((i) => ({
                id: i.productId,
                name: i.productName,
                price: i.productPrice,
                quantity: i.quantity,
              }))}
            />
          </div>
        </div>
      </div>

      <div className="w-full px-6 py-8">
        <div className="grid md:grid-cols-[1fr_360px] gap-6">

          {/* Main info */}
          <div className="space-y-5">
            {/* Status badge */}
            <div className={`border-2 ${cfg.border} ${cfg.bg} px-5 py-4 flex items-center justify-between gap-4`}>
              <div>
                <span className={`text-sm font-bold ${cfg.color}`}>
                  {cfg.icon} {cfg.label}
                </span>
                <p className="text-xs text-muted mt-0.5">
                  Mã đặt bàn: <strong className="text-ink">{booking.bookingCode}</strong>
                </p>
              </div>
              <RefreshButton />
            </div>

            {/* Booking details */}
            <div className="bg-canvas border border-hairline overflow-hidden">
              <div className="bg-surface-soft border-b border-hairline px-5 py-3">
                <h2 className="text-sm font-bold text-ink uppercase tracking-wide">
                  Chi tiết đặt bàn
                </h2>
              </div>
              <div className="divide-y divide-gray-50">
                {[
                  { label: "Khách hàng", value: booking.customerName },
                  { label: "Số điện thoại", value: booking.customerPhone },
                  {
                    label: "Thời gian",
                    value: formatDate(booking.scheduledTime),
                    highlight: true,
                  },
                  { label: "Số người", value: `${booking.guestCount} người` },
                  {
                    label: "Thanh toán",
                    value:
                      booking.paymentMethod === "BANK_TRANSFER"
                        ? "Chuyển khoản ngân hàng"
                        : "Tiền mặt tại quán",
                  },
                  ...(booking.totalAmount > 0
                    ? [{ label: "Số tiền cọc", value: formatPrice(booking.totalAmount), highlight: true }]
                    : []),
                  ...(booking.tableName
                    ? [{ label: "Bàn được xếp", value: booking.tableName }]
                    : []),
                  ...(booking.note
                    ? [{ label: "Ghi chú", value: booking.note }]
                    : []),
                ].map(({ label, value, highlight }) => (
                  <div key={label} className="flex px-5 py-3 text-sm">
                    <span className="w-36 flex-shrink-0 text-xs text-muted-soft uppercase tracking-wide pt-0.5">
                      {label}
                    </span>
                    <span
                      className={
                        highlight ? "font-bold text-primary" : "text-ink"
                      }
                    >
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* PENDING_PAYMENT + CASH */}
            {isPendingCash && (
              <div className="space-y-3">
                <div className="bg-blue-50 border border-blue-200 p-5">
                  <h3 className="font-bold text-blue-800 text-sm mb-2">
                    Hướng dẫn tiếp theo
                  </h3>
                  <ul className="space-y-2 text-xs text-blue-700 leading-relaxed">
                    <li>• Đặt bàn đã được ghi nhận. Nhân viên sẽ liên hệ xác nhận trong 15 phút.</li>
                    <li>• Vui lòng đến <strong>đúng giờ</strong> và báo mã <strong>{booking.bookingCode}</strong> cho nhân viên.</li>
                    <li>• Thanh toán tại quán (tiền mặt hoặc theo yêu cầu của nhân viên).</li>
                  </ul>
                </div>
                <CancelBookingButton
                  bookingCode={booking.bookingCode}
                  customerPhone={booking.customerPhone}
                />
                <SwitchPaymentButton
                  {...switchProps}
                  currentMethod="CASH"
                />
              </div>
            )}

            {/* CONFIRMED */}
            {booking.status === "CONFIRMED" && (
              <div className="bg-green-50 border border-green-200 p-5">
                <h3 className="font-bold text-green-800 text-sm mb-2">✅ Đặt bàn đã được xác nhận</h3>
                <p className="text-xs text-green-700 leading-relaxed">
                  Chúng tôi đang chuẩn bị cho buổi đến thăm của bạn. Vui lòng đến đúng giờ
                  và báo mã <strong>{booking.bookingCode}</strong> cho nhân viên lễ tân.
                </p>
              </div>
            )}

            {/* CANCELLED / EXPIRED */}
            {(booking.status === "CANCELLED" || booking.status === "EXPIRED") && (
              <div className="text-center py-4">
                <Link
                  href="/dat-ban"
                  className="inline-block bg-primary text-white px-8 py-3 text-sm font-bold uppercase tracking-wide hover:bg-primary-dark transition-colors"
                >
                  Đặt bàn mới
                </Link>
              </div>
            )}

            {/* Danh sách món + chỉnh sửa */}
            <BookingItemsEditor
              bookingCode={booking.bookingCode}
              initialItems={booking.items ?? []}
              products={products}
              editable={isEditable}
            />
          </div>

          {/* Right — VietQR hoặc contact */}
          <div className="space-y-5">
            {isPendingBankTransfer && booking.totalAmount > 0 && (
              <div className="border border-hairline bg-canvas overflow-hidden">
                <div className="bg-primary text-white px-4 py-3 text-center">
                  <h3 className="text-sm font-bold uppercase tracking-wide">Thanh toán chuyển khoản</h3>
                  <p className="text-white/70 text-xs mt-0.5">Quét QR để chuyển khoản</p>
                </div>
                <div className="p-4">
                  <div className="relative w-full aspect-square mb-4 bg-surface-soft flex items-center justify-center overflow-hidden">
                    <Image
                      src={buildVietQR(booking.totalAmount, `BOOKING ${booking.bookingCode}`)}
                      alt="VietQR chuyển khoản"
                      fill
                      className="object-contain p-2"
                      sizes="280px"
                      unoptimized
                    />
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-soft">Ngân hàng</span>
                      <span className="font-semibold text-ink">TPBank</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-soft">Số tài khoản</span>
                      <span className="font-semibold text-ink font-mono">0357527135</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-soft">Chủ tài khoản</span>
                      <span className="font-semibold text-ink">TRAN MINH PHUC</span>
                    </div>
                    <div className="border-t border-hairline pt-2 mt-2 flex justify-between">
                      <span className="text-muted-soft">Số tiền</span>
                      <span className="font-bold text-primary">{formatPrice(booking.totalAmount)}</span>
                    </div>
                    <div className="bg-yellow-50 border border-yellow-200 px-3 py-2 mt-2">
                      <div className="text-[10px] text-yellow-600 font-semibold uppercase tracking-wide mb-0.5">
                        Nội dung chuyển khoản
                      </div>
                      <div className="font-mono font-bold text-ink text-sm">
                        BOOKING {booking.bookingCode}
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-soft leading-relaxed pt-1">
                      Đặt bàn sẽ được xác nhận tự động trong vòng vài phút sau khi nhận tiền.
                      Hết hạn sau 30 phút kể từ lúc đặt.
                    </p>
                  </div>
                </div>
                <SwitchPaymentButton
                  {...switchProps}
                  currentMethod="BANK_TRANSFER"
                />
                <CancelBookingButton
                  bookingCode={booking.bookingCode}
                  customerPhone={booking.customerPhone}
                />
              </div>
            )}

            {/* Nếu BANK_TRANSFER nhưng amount = 0 (chưa có deposit) */}
            {isPendingBankTransfer && booking.totalAmount === 0 && (
              <div className="border border-hairline bg-canvas p-5">
                <h3 className="font-bold text-ink text-sm mb-3">Thông tin chuyển khoản</h3>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between"><span className="text-muted-soft">Ngân hàng</span><span className="font-semibold">TPBank</span></div>
                  <div className="flex justify-between"><span className="text-muted-soft">Số TK</span><span className="font-mono font-semibold">0357527135</span></div>
                  <div className="flex justify-between"><span className="text-muted-soft">Chủ TK</span><span className="font-semibold">TRAN MINH PHUC</span></div>
                  <div className="bg-yellow-50 border border-yellow-200 px-3 py-2 mt-2">
                    <div className="text-[10px] text-yellow-600 font-semibold mb-0.5">Nội dung CK</div>
                    <div className="font-mono font-bold">BOOKING {booking.bookingCode}</div>
                  </div>
                </div>
                <p className="text-[10px] text-muted-soft mt-3 leading-relaxed">
                  Nhân viên sẽ thông báo số tiền cọc cụ thể qua điện thoại.
                </p>
                <SwitchPaymentButton
                  {...switchProps}
                  currentMethod="BANK_TRANSFER"
                />
                <CancelBookingButton
                  bookingCode={booking.bookingCode}
                  customerPhone={booking.customerPhone}
                />
              </div>
            )}

            {/* Liên hệ hỗ trợ */}
            <div className="bg-cream p-5">
              <h3 className="font-bold text-ink text-xs uppercase tracking-wide mb-3">
                Cần hỗ trợ?
              </h3>
              <div className="space-y-2">
                <a
                  href="tel:0123456789"
                  className="flex items-center gap-2 text-xs text-gray-600 hover:text-primary transition-colors"
                >
                  <span>📞</span>
                  <span className="font-semibold">0123 456 789</span>
                </a>
                <p className="text-[10px] text-muted-soft">Hotline 08:00 – 22:00 mỗi ngày</p>
              </div>
              <hr className="my-3 border-hairline" />
              <Link
                href="/dat-ban"
                className="text-xs text-primary font-semibold hover:underline"
              >
                ← Đặt thêm bàn khác
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}