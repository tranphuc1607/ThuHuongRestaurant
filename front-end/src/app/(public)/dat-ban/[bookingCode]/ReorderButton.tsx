"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { SavedBooking } from "@/lib/bookingStorage";

type Props = {
  bookingCode: string;
  customerName: string;
  customerPhone: string;
  vnDate: string;
  vnTime: string;
  guestCount: number;
  items: { id: number; name: string; price: number; quantity: number }[];
};

export default function ReorderButton({ bookingCode, customerName, customerPhone, vnDate, vnTime, guestCount, items }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  function handleReorder() {
    setLoading(true);
    const saved: SavedBooking = {
      code: bookingCode,
      name: customerName,
      phone: customerPhone,
      date: "",
      time: "",
      guestCount,
      notes: "",
      items,
    };
    try { sessionStorage.setItem("booking_reorder_now", JSON.stringify(saved)); } catch {}
    router.push("/dat-ban");
  }

  return (
    <button
      onClick={handleReorder}
      disabled={loading}
      className="flex items-center gap-2 bg-primary text-white text-xs font-bold px-4 py-2 hover:bg-primary-dark transition-colors disabled:opacity-60"
    >
      🔄 {loading ? "Đang chuyển..." : "Đặt lại đơn này"}
    </button>
  );
}
