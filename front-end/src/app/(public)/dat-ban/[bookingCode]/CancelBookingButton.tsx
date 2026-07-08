"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api/v1";

export default function CancelBookingButton({
  bookingCode,
  customerPhone,
}: {
  bookingCode: string;
  customerPhone: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleCancel() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${BASE_URL}/bookings/cancel/${bookingCode}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerPhone,
          cancelReason: reason.trim() || "Khách tự hủy",
        }),
      });
      const json = await res.json();
      if (res.ok && json.statusCode === 200) {
        setOpen(false);
        router.refresh();
      } else {
        setError(json.message ?? "Hủy thất bại. Vui lòng thử lại.");
      }
    } catch {
      setError("Không kết nối được máy chủ.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full border border-red-300 text-red-500 py-3 text-sm font-semibold hover:bg-red-50 transition-colors"
      >
        Hủy đặt bàn
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => { if (!loading) setOpen(false); }}>
          <div className="bg-white w-80 p-6 flex flex-col gap-4 shadow-2xl"
            onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold text-ink">Xác nhận hủy đặt bàn</h3>
            <p className="text-sm text-muted leading-relaxed">
              Bạn có chắc muốn hủy đặt bàn <span className="font-mono font-bold text-ink">{bookingCode}</span>?
              Hành động này không thể hoàn tác.
            </p>
            <div>
              <label className="text-xs text-muted-soft block mb-1">Lý do hủy (tùy chọn)</label>
              <input
                type="text"
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Vd: Thay đổi kế hoạch..."
                className="w-full border border-hairline px-3 py-2 text-sm outline-none focus:border-red-400 transition-colors"
                disabled={loading}
              />
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
            <div className="flex gap-2">
              <button
                onClick={() => setOpen(false)}
                disabled={loading}
                className="flex-1 border border-hairline text-muted py-2.5 text-sm hover:bg-surface-soft transition-colors disabled:opacity-50"
              >
                Quay lại
              </button>
              <button
                onClick={handleCancel}
                disabled={loading}
                className="flex-1 bg-red-500 text-white py-2.5 text-sm font-semibold hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {loading ? "Đang hủy..." : "Xác nhận hủy"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
