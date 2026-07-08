"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api/v1";
const POLL_INTERVAL = 8000;

export default function BookingStatusWatcher({
  bookingCode,
  initialStatus,
  paymentMethod,
}: {
  bookingCode: string;
  initialStatus: string;
  paymentMethod: "BANK_TRANSFER" | "CASH";
}) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const statusRef = useRef(initialStatus);

  useEffect(() => {
    if (initialStatus !== "PENDING_PAYMENT" || paymentMethod !== "BANK_TRANSFER") return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${BASE_URL}/bookings/${bookingCode}`, { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();
        const newStatus = json.data?.status;

        if (newStatus && newStatus !== statusRef.current) {
          statusRef.current = newStatus;
          if (newStatus === "CONFIRMED") {
            clearInterval(interval);
            router.refresh();
            setShowModal(true);
          } else if (newStatus !== "PENDING_PAYMENT") {
            clearInterval(interval);
            router.refresh();
          }
        }
      } catch {
        // bỏ qua lỗi mạng
      }
    }, POLL_INTERVAL);

    return () => clearInterval(interval);
  }, []);

  if (!showModal) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-canvas w-[340px] shadow-2xl">
        {/* Header màu */}
        <div
          className="py-6 text-center text-white"
          style={{ background: "linear-gradient(135deg, #a9583e 0%, #cc785c 100%)" }}
        >
          <div className="text-4xl mb-2">🎉</div>
          <h2 className="text-lg font-bold" style={{ fontFamily: "Georgia, serif" }}>
            Xác nhận thành công!
          </h2>
        </div>

        {/* Nội dung */}
        <div className="px-8 py-7 text-center">
          <p className="text-sm text-ink leading-relaxed mb-2">
            Cảm ơn bạn đã đặt bàn tại{" "}
            <span className="font-bold text-primary">Thu Hương Restaurant</span>.
          </p>
          <p className="text-sm text-muted-soft leading-relaxed mb-6">
            Nhân viên sẽ liên hệ qua số điện thoại để xác nhận lại đặt bàn của bạn.
          </p>

          <div className="bg-surface-soft border border-hairline px-4 py-3 mb-6 text-left text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-soft">Mã đặt bàn</span>
              <span className="font-mono font-bold text-ink">{bookingCode}</span>
            </div>
          </div>

          <button
            onClick={() => router.push("/dat-ban/lich-su")}
            className="w-full bg-primary text-white py-3 text-sm font-bold uppercase tracking-widest hover:bg-primary-dark transition-colors"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
