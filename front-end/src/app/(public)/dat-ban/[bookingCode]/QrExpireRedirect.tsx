"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const DURATION_MS = 30 * 60 * 1000; // 30 phút

export default function QrExpireRedirect() {
  const router = useRouter();
  const [msLeft, setMsLeft] = useState(DURATION_MS);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const start = Date.now();

    const tick = setInterval(() => {
      const remaining = DURATION_MS - (Date.now() - start);
      if (remaining <= 0) {
        clearInterval(tick);
        setMsLeft(0);
        setExpired(true);
      } else {
        setMsLeft(remaining);
      }
    }, 1000);

    return () => clearInterval(tick);
  }, []);

  // Auto-redirect sau 4 giây khi modal hiện
  useEffect(() => {
    if (!expired) return;
    const t = setTimeout(() => router.push("/"), 4000);
    return () => clearTimeout(t);
  }, [expired, router]);

  const totalSec = Math.ceil(msLeft / 1000);
  const mm = String(Math.floor(totalSec / 60)).padStart(2, "0");
  const ss = String(totalSec % 60).padStart(2, "0");

  const isWarning = msLeft <= 5 * 60 * 1000; // đỏ khi còn < 5 phút

  // Modal hết hạn
  if (expired) {
    return (
      <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/70">
        <div className="bg-canvas w-[320px] shadow-2xl overflow-hidden">
          <div
            className="py-6 text-center text-white"
            style={{ background: "linear-gradient(135deg, #a9583e 0%, #cc785c 100%)" }}
          >
            <div className="text-4xl mb-2">⏰</div>
            <h2 className="text-lg font-bold">Phiên đặt bàn đã hết hạn</h2>
          </div>
          <div className="px-7 py-6 text-center">
            <p className="text-sm text-ink leading-relaxed mb-2">
              Đã hết 30 phút thanh toán. Đơn đặt bàn của bạn có thể bị hủy tự động.
            </p>
            <p className="text-xs text-muted-soft mb-5">
              Đang chuyển về trang chủ…
            </p>
            <div className="w-full bg-hairline rounded-full h-1 mb-5 overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-[4000ms] ease-linear"
                style={{ width: "0%" }}
              />
            </div>
            <button
              onClick={() => router.push("/")}
              className="w-full bg-primary text-white py-3 text-sm font-bold uppercase tracking-widest hover:bg-primary-dark transition-colors touch-manipulation"
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              Về trang chủ ngay
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Thanh đếm ngược hiển thị trong card QR
  return (
    <div
      className={`flex items-center justify-between px-4 py-2.5 text-xs border-t ${
        isWarning
          ? "bg-red-50 border-red-200 text-red-600"
          : "bg-amber-50 border-amber-200 text-amber-700"
      }`}
    >
      <span className="font-medium">
        {isWarning ? "⚠️ Sắp hết hạn thanh toán" : "⏳ Thời gian còn lại"}
      </span>
      <span className="font-mono font-bold text-base tabular-nums">
        {mm}:{ss}
      </span>
    </div>
  );
}
