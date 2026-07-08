"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { syncSwitchPayment } from "@/lib/bookingStorage";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api/v1";

export default function SwitchPaymentButton({
  bookingCode,
  currentMethod,
  customerName = "",
  customerPhone = "",
  scheduledDate = "",
  scheduledTime = "",
  guestCount = 2,
}: {
  bookingCode: string;
  currentMethod: "BANK_TRANSFER" | "CASH";
  customerName?: string;
  customerPhone?: string;
  scheduledDate?: string;
  scheduledTime?: string;
  guestCount?: number;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const next = currentMethod === "BANK_TRANSFER" ? "CASH" : "BANK_TRANSFER";
  const label =
    currentMethod === "BANK_TRANSFER"
      ? "💵 Đổi sang thanh toán tiền mặt khi đến"
      : "💳 Đổi sang chuyển khoản";

  async function handleSwitch() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${BASE_URL}/bookings/switch-payment/${bookingCode}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentMethod: next }),
      });
      const json = await res.json();
      if (json.statusCode === 200) {
        syncSwitchPayment(bookingCode, next, {
          name: customerName,
          phone: customerPhone,
          date: scheduledDate,
          time: scheduledTime,
          guestCount,
        });
        router.refresh();
      } else {
        setError(json.message ?? "Không thể đổi phương thức");
      }
    } catch {
      setError("Không kết nối được máy chủ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-3">
      <button
        onClick={handleSwitch}
        disabled={loading}
        className="w-full text-sm border border-hairline text-muted py-2.5 hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
      >
        {loading ? "Đang xử lý..." : label}
      </button>
      {error && <p className="text-xs text-red-500 mt-1.5 text-center">{error}</p>}
    </div>
  );
}
