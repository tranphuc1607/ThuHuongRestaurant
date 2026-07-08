"use client";
import { useState, useEffect } from "react";

interface Props {
  qrToken: string;
  tableName: string;
  remaining: number;
}

type Step = "idle" | "selecting" | "cash-sent" | "qr-showing" | "completed" | "error";

function fmt(v: number) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(v);
}

export default function PaymentSection({ qrToken, tableName, remaining }: Props) {
  const [step, setStep] = useState<Step>("idle");
  const [paymentId, setPaymentId] = useState<number | null>(null);
  const [vietQrUrl, setVietQrUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Poll trạng thái khi đang hiện QR
  useEffect(() => {
    if (step !== "qr-showing" || !paymentId) return;
    const id = setInterval(async () => {
      try {
        const res = await fetch(`/api/payment-status/${paymentId}`);
        const json = await res.json();
        if (json.data?.status === "COMPLETED") {
          setStep("completed");
        }
      } catch { /* ignore */ }
    }, 3000);
    return () => clearInterval(id);
  }, [step, paymentId]);

  const selectMethod = async (method: "CASH" | "BANK_TRANSFER") => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/payment-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrToken, paymentMethod: method }),
      });
      const json = await res.json();
      if (json.statusCode !== 200 || !json.data) {
        setError(json.message || "Có lỗi xảy ra, vui lòng thử lại");
        setStep("error");
        return;
      }
      const payment = json.data;
      setPaymentId(payment.id);
      if (method === "CASH") {
        setStep("cash-sent");
      } else {
        setVietQrUrl(payment.vietQrUrl ?? "");
        setStep("qr-showing");
      }
    } catch {
      setError("Không kết nối được máy chủ");
      setStep("error");
    } finally {
      setLoading(false);
    }
  };

  if (remaining <= 0) return null;

  const card = (children: React.ReactNode) => (
    <div style={{
      background: "#fff",
      borderRadius: 16,
      border: "1px solid #e5e7eb",
      overflow: "hidden",
      marginTop: 10,
    }}>
      {children}
    </div>
  );

  const header = (
    <div style={{ padding: "10px 14px 8px", background: "#f0fdf4", borderBottom: "1px solid #bbf7d0", display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ fontSize: 16 }}>💳</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: "#15803d" }}>Thanh toán</span>
    </div>
  );

  // ── idle: nút gọi thanh toán
  if (step === "idle") {
    return card(
      <>
        {header}
        <div style={{ padding: "16px 14px", textAlign: "center" }}>
          <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 12px" }}>
            Còn lại: <strong style={{ color: "#c2410c" }}>{fmt(remaining)}</strong>
          </p>
          <button
            onClick={() => setStep("selecting")}
            style={{
              display: "inline-block", padding: "12px 32px",
              background: "#15803d", color: "#fff",
              border: "none", borderRadius: 12,
              fontSize: 15, fontWeight: 700, cursor: "pointer",
            }}
          >
            Gọi thanh toán
          </button>
        </div>
      </>
    );
  }

  // ── selecting: chọn phương thức
  if (step === "selecting") {
    return card(
      <>
        {header}
        <div style={{ padding: "14px" }}>
          <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 12px", textAlign: "center" }}>
            Chọn phương thức thanh toán
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <button
              onClick={() => selectMethod("CASH")}
              disabled={loading}
              style={{
                padding: "16px 8px", background: "#fffbeb",
                border: "2px solid #fcd34d", borderRadius: 12,
                cursor: "pointer", textAlign: "center",
                opacity: loading ? 0.6 : 1,
              }}
            >
              <div style={{ fontSize: 28 }}>💵</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#92400e", marginTop: 4 }}>Tiền mặt</div>
              <div style={{ fontSize: 10, color: "#a16207", marginTop: 2 }}>Nhân viên ra thu</div>
            </button>
            <button
              onClick={() => selectMethod("BANK_TRANSFER")}
              disabled={loading}
              style={{
                padding: "16px 8px", background: "#eff6ff",
                border: "2px solid #93c5fd", borderRadius: 12,
                cursor: "pointer", textAlign: "center",
                opacity: loading ? 0.6 : 1,
              }}
            >
              <div style={{ fontSize: 28 }}>📲</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#1e40af", marginTop: 4 }}>Chuyển khoản</div>
              <div style={{ fontSize: 10, color: "#3b82f6", marginTop: 2 }}>Quét QR VietQR</div>
            </button>
          </div>
          <button
            onClick={() => setStep("idle")}
            style={{ marginTop: 10, width: "100%", padding: "8px", background: "none", border: "none", color: "#9ca3af", fontSize: 12, cursor: "pointer" }}
          >
            Huỷ
          </button>
        </div>
      </>
    );
  }

  // ── cash-sent: đã gửi yêu cầu tiền mặt
  if (step === "cash-sent") {
    return card(
      <>
        {header}
        <div style={{ padding: "24px 14px", textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
          <p style={{ fontSize: 15, fontWeight: 700, color: "#15803d", margin: "0 0 6px" }}>
            Đã gửi yêu cầu!
          </p>
          <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>
            Nhân viên sẽ ra {tableName} thu tiền ngay
          </p>
        </div>
      </>
    );
  }

  // ── qr-showing: hiện QR chuyển khoản
  if (step === "qr-showing") {
    return card(
      <>
        {header}
        <div style={{ padding: "14px", textAlign: "center" }}>
          <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 10px" }}>
            Quét mã để thanh toán <strong style={{ color: "#c2410c" }}>{fmt(remaining)}</strong>
          </p>
          {vietQrUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={vietQrUrl}
              alt="VietQR"
              style={{ width: "100%", maxWidth: 260, borderRadius: 12, border: "1px solid #e5e7eb" }}
            />
          ) : (
            <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af" }}>
              Đang tải QR...
            </div>
          )}
          <div style={{ marginTop: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, color: "#6b7280", fontSize: 12 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#4ade80", display: "inline-block", animation: "pulse 1.5s infinite" }} />
            Đang chờ xác nhận thanh toán...
          </div>
        </div>
      </>
    );
  }

  // ── completed: thanh toán thành công
  if (step === "completed") {
    return card(
      <>
        {header}
        <div style={{ padding: "24px 14px", textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
          <p style={{ fontSize: 15, fontWeight: 700, color: "#15803d", margin: "0 0 6px" }}>
            Thanh toán thành công!
          </p>
          <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>
            Cảm ơn quý khách đã dùng bữa tại Thu Hương
          </p>
        </div>
      </>
    );
  }

  // ── error
  return card(
    <>
      {header}
      <div style={{ padding: "16px 14px", textAlign: "center" }}>
        <p style={{ fontSize: 13, color: "#dc2626", marginBottom: 12 }}>{error}</p>
        <button
          onClick={() => { setStep("idle"); setError(""); }}
          style={{ padding: "8px 20px", background: "#f3f4f6", border: "none", borderRadius: 8, fontSize: 13, cursor: "pointer" }}
        >
          Thử lại
        </button>
      </div>
    </>
  );
}
