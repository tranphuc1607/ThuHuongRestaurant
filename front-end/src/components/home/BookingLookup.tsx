"use client";
import { useState } from "react";
import Link from "next/link";

type BookingStatus =
  | "PENDING_PAYMENT"
  | "CONFIRMED"
  | "CHECKED_IN"
  | "COMPLETED"
  | "CANCELLED"
  | "EXPIRED";

type BookingResult = {
  bookingCode: string;
  customerName: string;
  scheduledTime: string;
  guestCount: number;
  status: BookingStatus;
  paymentMethod: "BANK_TRANSFER" | "CASH";
  totalAmount: number;
  tableName?: string;
};

const STATUS_LABEL: Record<BookingStatus, string> = {
  PENDING_PAYMENT: "Chờ thanh toán",
  CONFIRMED: "Đã xác nhận",
  CHECKED_IN: "Đã check-in",
  COMPLETED: "Hoàn thành",
  CANCELLED: "Đã hủy",
  EXPIRED: "Hết hạn",
};

const STATUS_COLOR: Record<BookingStatus, string> = {
  PENDING_PAYMENT: "bg-yellow-100 text-yellow-700",
  CONFIRMED: "bg-green-100 text-green-700",
  CHECKED_IN: "bg-blue-100 text-blue-700",
  COMPLETED: "bg-canvas text-gray-600",
  CANCELLED: "bg-red-100 text-red-600",
  EXPIRED: "bg-canvas text-muted",
};

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api/v1";

export default function BookingLookup() {
  const [tab, setTab] = useState<"code" | "phone">("code");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BookingResult | BookingResult[] | null>(null);
  const [error, setError] = useState("");

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    setLoading(true);
    setResult(null);
    setError("");

    try {
      if (tab === "code") {
        const res = await fetch(`${BASE_URL}/bookings/${input.trim()}`);
        const json = await res.json();
        if (!res.ok || json.statusCode !== 200) {
          setError("Không tìm thấy đặt bàn với mã này.");
        } else {
          setResult(json.data as BookingResult);
        }
      } else {
        const res = await fetch(
          `${BASE_URL}/bookings/history?phone=${encodeURIComponent(input.trim())}&page=0&size=5`
        );
        const json = await res.json();
        if (!res.ok || json.statusCode !== 200) {
          setError("Không tìm thấy lịch sử đặt bàn.");
        } else {
          const items = json.data?.content as BookingResult[];
          if (!items || items.length === 0) {
            setError("Không có đặt bàn nào với số điện thoại này.");
          } else {
            setResult(items);
          }
        }
      }
    } catch {
      setError("Không kết nối được với máy chủ. Vui lòng thử lại sau.");
    } finally {
      setLoading(false);
    }
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function formatPrice(n: number) {
    return new Intl.NumberFormat("vi-VN").format(n) + "đ";
  }

  const bookings = Array.isArray(result) ? result : result ? [result] : [];

  return (
    <section className="py-14 bg-cream">
      <div className="max-w-[1200px] mx-auto px-4">
        <div className="text-center mb-8">
          <p className="text-primary text-xs uppercase tracking-[4px] font-semibold mb-2">
            Kiểm tra ngay
          </p>
          <h2
            className="text-2xl md:text-3xl font-bold text-ink"
            style={{ fontFamily: "Georgia, serif" }}
          >
            Tra Cứu Đặt Bàn
          </h2>
          <div className="w-12 h-0.5 bg-primary mx-auto mt-3" />
          <p className="text-sm text-muted mt-3">
            Nhập mã đặt bàn hoặc số điện thoại để xem trạng thái
          </p>
        </div>

        <div className="max-w-xl mx-auto">
          {/* Tabs */}
          <div className="flex border-b border-hairline mb-5">
            {(["code", "phone"] as const).map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setResult(null); setError(""); setInput(""); }}
                className={`flex-1 py-2 text-sm font-semibold transition-colors border-b-2 -mb-px ${
                  tab === t
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-soft hover:text-gray-600"
                }`}
              >
                {t === "code" ? "Mã đặt bàn" : "Số điện thoại"}
              </button>
            ))}
          </div>

          {/* Form */}
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type={tab === "phone" ? "tel" : "text"}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={tab === "code" ? "Nhập mã đặt bàn (VD: TH-20240001)" : "Nhập số điện thoại"}
              className="flex-1 border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-primary"
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-primary text-white px-5 py-2.5 text-sm font-bold hover:bg-primary-dark transition-colors disabled:opacity-60"
            >
              {loading ? "..." : "Tra cứu"}
            </button>
          </form>

          {/* Error */}
          {error && (
            <p className="mt-4 text-sm text-red-500 text-center">{error}</p>
          )}

          {/* Results */}
          {bookings.length > 0 && (
            <div className="mt-5 space-y-3">
              {bookings.map((b) => (
                <div key={b.bookingCode} className="bg-canvas border border-hairline p-4">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <div className="font-bold text-ink text-sm">{b.customerName}</div>
                      <div className="text-xs text-muted-soft mt-0.5">#{b.bookingCode}</div>
                    </div>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${STATUS_COLOR[b.status]}`}>
                      {STATUS_LABEL[b.status]}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600">
                    <div><span className="text-muted-soft">Thời gian:</span> {formatDate(b.scheduledTime)}</div>
                    <div><span className="text-muted-soft">Số người:</span> {b.guestCount}</div>
                    <div><span className="text-muted-soft">Thanh toán:</span> {b.paymentMethod === "BANK_TRANSFER" ? "Chuyển khoản" : "Tiền mặt"}</div>
                    <div><span className="text-muted-soft">Tổng tiền:</span> <span className="font-semibold text-primary">{formatPrice(b.totalAmount)}</span></div>
                    {b.tableName && <div><span className="text-muted-soft">Bàn:</span> {b.tableName}</div>}
                  </div>
                  <div className="mt-3 pt-3 border-t border-hairline">
                    <Link
                      href={`/dat-ban/${b.bookingCode}`}
                      className="text-xs text-primary font-semibold hover:underline"
                    >
                      Xem chi tiết →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}

          <p className="text-center text-xs text-muted-soft mt-6">
            Chưa có đặt bàn?{" "}
            <Link href="/dat-ban" className="text-primary font-semibold hover:underline">
              Đặt bàn ngay
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
