"use client";
import { useState, useEffect, type CSSProperties } from "react";

interface OrderItem {
  id: number; productName: string; productPrice: number;
  quantity: number; itemTotal: number; saleUnit: string; fromBooking?: boolean;
}
interface OrderSurcharge {
  id: number; name: string; unitPrice: number; quantity: number; amount: number;
}
interface OrderData {
  id: number; tableName?: string; totalAmount: number; prepaidAmount: number;
  items: OrderItem[]; surcharges?: OrderSurcharge[];
}

interface Props {
  qrToken: string;
  tableName: string;
  initialOrder: OrderData | null;
  /** name.toLowerCase() → raw imageUrl từ product-service */
  productImages: Record<string, string>;
  isNgrok: boolean;
}

const UNIT: Record<string, string> = {
  PORTION: "phần", CUP: "ly", DISH: "đĩa/tô", PIECE: "cái", KG: "kg",
};

function fmt(v: number) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(v);
}

const AVATAR_COLORS = ["#ea580c","#16a34a","#2563eb","#7c3aed","#db2777","#d97706","#0891b2","#65a30d","#dc2626","#0369a1"];
function avatarColor(name: string): string {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[h];
}

export default function OrderDrawer({ qrToken, tableName, initialOrder, productImages, isNgrok }: Props) {
  const [order, setOrder] = useState<OrderData | null>(initialOrder);
  const [open, setOpen] = useState(false);

  // Poll mỗi 3s — chỉ cập nhật state, KHÔNG reload trang
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(`/api/table/${qrToken}`, {
          cache: "no-store",
          headers: isNgrok ? { "ngrok-skip-browser-warning": "1" } : {},
        });
        const json = await res.json();
        if (json.statusCode === 200 && json.data?.items) {
          setOrder(json.data as OrderData);
        } else if (json.statusCode === 400 || json.statusCode === 404) {
          setOrder(null);
        }
      } catch { /* bỏ qua lỗi mạng */ }
    };
    const id = setInterval(poll, 3000);
    return () => clearInterval(id);
  }, [qrToken, isNgrok]);

  // Khoá scroll body khi drawer mở
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const toggle = () => setOpen(v => !v);
  const close  = () => setOpen(false);

  function resolveImgSrc(rawUrl?: string): string | null {
    if (!rawUrl) return null;
    if (rawUrl.startsWith("/"))
      return rawUrl + (isNgrok ? "?ngrok-skip-browser-warning=1" : "");
    return rawUrl;
  }

  const isCocBia = (it: OrderItem) =>
    it.saleUnit === "CUP" && it.productName.toLowerCase().includes("bia");
  const drinks   = order?.items.filter(isCocBia) ?? [];
  const foods    = order?.items.filter(it => !isCocBia(it)) ?? [];
  const prepaid  = order?.prepaidAmount ?? 0;
  const remaining = order ? Math.max(0, order.totalAmount - prepaid) : 0;
  const netRefund = order ? Math.round(prepaid - order.totalAmount) : 0;

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 40 }}
          onClick={close}
          onPointerDown={(e) => { if (e.pointerType === "touch") { e.preventDefault(); close(); } }}
        />
      )}

      {/* ── Order drawer ── */}
      <div
        style={{
          position: "fixed", top: 0, right: 0, width: "100%", height: "100%",
          background: "#f9fafb",
          transform: open ? "translateX(0%)" : "translateX(100%)",
          transition: "transform 0.28s cubic-bezier(0.4,0,0.2,1)",
          zIndex: 50, overflowY: "auto", overscrollBehavior: "contain",
        }}
      >
        {/* Sticky header */}
        <div style={{ position: "sticky", top: 0, background: "#fff", padding: "14px 16px", borderBottom: "1px solid #f0f0f0", display: "flex", alignItems: "center", gap: 10, zIndex: 5 }}>
          <button
            onClick={close}
            onPointerDown={(e) => { if (e.pointerType === "touch") { e.preventDefault(); close(); } }}
            style={{ width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", background: "#f3f4f6", border: "none", borderRadius: 8, fontSize: 18, cursor: "pointer", color: "#374151", touchAction: "manipulation", WebkitTapHighlightColor: "transparent" } as CSSProperties}
          >←</button>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#1f2937", flex: 1 }}>
            {tableName ? `Đơn — ${tableName}` : "Đơn hàng"}
          </span>
          {order && (
            <span style={{ fontSize: 12, background: "#fef9c3", color: "#a16207", padding: "2px 8px", borderRadius: 99, fontWeight: 600 }}>
              {order.items.length} món
            </span>
          )}
        </div>

        {/* Body */}
        <div style={{ padding: "12px 16px 120px", maxWidth: 500, margin: "0 auto" }}>
          {!order ? (
            <div style={{ marginTop: 60, textAlign: "center" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🍽️</div>
              <p style={{ fontWeight: 600, color: "#374151", fontSize: 15, margin: "0 0 6px" }}>Bàn chưa có đơn hàng</p>
              <p style={{ fontSize: 13, color: "#9ca3af", margin: 0 }}>Nhân viên sẽ mở đơn khi bạn sẵn sàng gọi món</p>
            </div>
          ) : (
            <>
              {/* Drinks */}
              {drinks.length > 0 && (
                <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #bfdbfe", marginTop: 8, overflow: "hidden" }}>
                  <div style={{ padding: "10px 14px 8px", background: "#eff6ff", borderBottom: "1px solid #bfdbfe", display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 16 }}>🍺</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#1d4ed8" }}>Đồ uống</span>
                    <span style={{ fontSize: 11, color: "#93c5fd", marginLeft: "auto" }}>{drinks.length} loại</span>
                  </div>
                  <div style={{ padding: "8px 8px 0", display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {drinks.map(item => {
                      const color = avatarColor(item.productName);
                      return (
                        <div key={item.id} style={{ width: "calc(10% - 4px)", minWidth: 28, background: color + "15", border: `1.5px solid ${color}60`, borderRadius: 6, padding: "3px 1px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
                          <span style={{ fontSize: 16, fontWeight: 900, color, lineHeight: 1.1 }}>{item.quantity}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ padding: "6px 10px 8px", borderTop: "1px solid #bfdbfe", marginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 10, color: "#3b82f6", fontWeight: 600 }}>Tổng cốc bia</span>
                    <span style={{ fontSize: 14, fontWeight: 900, color: "#1d4ed8" }}>
                      {drinks.reduce((s, it) => s + it.quantity, 0)} cốc
                      <span style={{ fontSize: 11, color: "#6b7280", fontWeight: 500, margin: "0 6px" }}>·</span>
                      {fmt(drinks.reduce((s, it) => s + it.itemTotal, 0))}
                    </span>
                  </div>
                </div>
              )}

              {/* Foods */}
              {foods.length > 0 && (
                <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #f3f4f6", overflow: "hidden", marginTop: 10 }}>
                  <div style={{ padding: "10px 14px 8px", background: "#fafafa", borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 16 }}>🍽️</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>Đồ ăn</span>
                    <span style={{ fontSize: 11, color: "#d1d5db", marginLeft: "auto" }}>{foods.length} món</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "22px 38px 1fr 48px 72px 78px", gap: "0 6px", padding: "7px 12px", background: "#f9fafb", borderBottom: "1px solid #f3f4f6" }}>
                    {["#", "", "Tên", "Phần", "Đơn giá", "T.Tiền"].map((h, idx) => (
                      <span key={idx} style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textAlign: idx >= 3 ? "right" : "left", textTransform: "uppercase", letterSpacing: 0.5 }}>{h}</span>
                    ))}
                  </div>
                  <div style={foods.length > 10 ? { maxHeight: 480, overflowY: "auto" } : undefined}>
                    {foods.map((item, i) => {
                      const color  = avatarColor(item.productName);
                      const letter = item.productName.trim()[0]?.toUpperCase() ?? "?";
                      const unit   = UNIT[item.saleUnit] ?? item.saleUnit;
                      const src    = resolveImgSrc(productImages[item.productName.trim().toLowerCase()]);
                      return (
                        <div key={item.id} style={{ display: "grid", gridTemplateColumns: "22px 38px 1fr 48px 72px 78px", gap: "0 6px", padding: "11px 12px", alignItems: "center", borderBottom: i < foods.length - 1 ? "1px solid #f9fafb" : "none" }}>
                          <span style={{ fontSize: 12, color: "#9ca3af", fontWeight: 600 }}>{i + 1}</span>
                          {/* Thumbnail */}
                          <div style={{ position: "relative", width: 36, height: 36, flexShrink: 0 }}>
                            {/* Letter avatar — luôn hiện làm fallback */}
                            <div style={{ width: 36, height: 36, borderRadius: 8, background: color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 700 }}>
                              {letter}
                            </div>
                            {src && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={src}
                                alt=""
                                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", borderRadius: 8, objectFit: "cover" }}
                                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                              />
                            )}
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 600, color: "#1f2937", lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" } as CSSProperties}>
                            {item.productName}
                            {item.fromBooking && <span style={{ marginLeft: 4, fontSize: 9, background: "#eff6ff", color: "#3b82f6", padding: "1px 4px", borderRadius: 99 }}>BK</span>}
                          </span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "#374151", textAlign: "right" }}>
                            {item.quantity}<span style={{ fontSize: 10, color: "#9ca3af", marginLeft: 2 }}>{unit}</span>
                          </span>
                          <span style={{ fontSize: 11, color: "#6b7280", textAlign: "right", whiteSpace: "nowrap" }}>{fmt(item.productPrice)}</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "#1f2937", textAlign: "right", whiteSpace: "nowrap" }}>{fmt(item.itemTotal)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Surcharges */}
              <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #fed7aa", overflow: "hidden", marginTop: 10 }}>
                <div style={{ padding: "10px 14px 8px", background: "#fff7ed", borderBottom: "1px solid #fed7aa", display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 15 }}>⚠️</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#c2410c" }}>Phụ thu</span>
                  <span style={{ fontSize: 11, color: "#fb923c", marginLeft: "auto" }}>
                    {fmt((order.surcharges ?? []).reduce((s, c) => s + c.amount, 0))}
                  </span>
                </div>
                {(order.surcharges ?? []).length > 0 && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 48px 72px 78px", gap: "0 6px", padding: "6px 12px", background: "#fffbf7", borderBottom: "1px solid #fed7aa" }}>
                    {["Tên", "SL", "Đơn giá", "T.Tiền"].map((h, i) => (
                      <span key={i} style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textAlign: i >= 1 ? "right" : "left", textTransform: "uppercase" }}>{h}</span>
                    ))}
                  </div>
                )}
                {(order.surcharges ?? []).map((sc, i, arr) => (
                  <div key={sc.id} style={{ display: "grid", gridTemplateColumns: "1fr 48px 72px 78px", gap: "0 6px", padding: "10px 12px", alignItems: "center", borderBottom: i < arr.length - 1 ? "1px solid #fff7ed" : "none" }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#c2410c", margin: 0 }}>{sc.name}</p>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#374151", textAlign: "right" }}>{sc.quantity}</span>
                    <span style={{ fontSize: 11, color: "#6b7280", textAlign: "right", whiteSpace: "nowrap" }}>{fmt(sc.unitPrice)}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#c2410c", textAlign: "right", whiteSpace: "nowrap" }}>{fmt(sc.amount)}</span>
                  </div>
                ))}
              </div>

              {/* Total */}
              <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #f3f4f6", padding: "14px 16px", marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15 }}>
                  <span style={{ color: "#6b7280", fontWeight: 600 }}>Tổng cộng</span>
                  <span style={{ fontWeight: 800, color: "#1f2937" }}>{fmt(order.totalAmount)}</span>
                </div>
                {prepaid > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#16a34a" }}>
                    <span>Đã cọc trước</span><span>− {fmt(prepaid)}</span>
                  </div>
                )}
                {netRefund > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 700, color: "#d97706", borderTop: "1px solid #e5e7eb", paddingTop: 8 }}>
                    <span>Hoàn lại khách</span><span>− {fmt(netRefund)}</span>
                  </div>
                )}
                {remaining > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 800, color: "#c2410c", borderTop: "1px solid #e5e7eb", paddingTop: 8 }}>
                    <span>Còn phải trả</span><span>{fmt(remaining)}</span>
                  </div>
                )}
                {remaining === 0 && netRefund === 0 && prepaid > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 700, color: "#16a34a", borderTop: "1px solid #e5e7eb", paddingTop: 8 }}>
                    <span>Đã thanh toán đủ</span><span>✓</span>
                  </div>
                )}
              </div>

              <div style={{ marginTop: 10, background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 16, padding: "14px 20px", textAlign: "center" }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: "#c2410c", margin: "0 0 3px" }}>📢 Muốn gọi thêm món?</p>
                <p style={{ fontSize: 12, color: "#ea580c", margin: 0 }}>Vui lòng gọi nhân viên để được phục vụ</p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Toggle arrow — vùng bấm mở rộng ── */}
      <button
        onClick={toggle}
        onPointerDown={(e) => { if (e.pointerType === "touch") { e.preventDefault(); toggle(); } }}
        style={{ position: "fixed", right: 0, top: "50%", transform: "translateY(-50%)", zIndex: 55, border: "none", cursor: "pointer", background: "transparent", padding: "70px 0 70px 52px", WebkitTapHighlightColor: "transparent", touchAction: "manipulation" } as CSSProperties}
      >
        <span style={{ display: "block", background: "#f97316", color: "#fff", borderRadius: "12px 0 0 12px", padding: "44px 7px", fontSize: 20, fontWeight: 700, lineHeight: 1, boxShadow: "-3px 0 10px rgba(0,0,0,0.15)" }}>
          {open ? "›" : "‹"}
        </span>
      </button>

      {/* ── Floating bottom bar ── */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#fff", borderTop: "1.5px solid #f0f0f0", padding: "10px 16px", display: "flex", alignItems: "center", gap: 8, zIndex: 35, boxShadow: "0 -2px 12px rgba(0,0,0,0.07)" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {order ? (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: "#6b7280", fontWeight: 600, lineHeight: 1.4 }}>
                <span>Tổng cộng</span>
                <span>{fmt(order.totalAmount)}</span>
              </div>
              {prepaid > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: "#16a34a", fontWeight: 600, lineHeight: 1.4 }}>
                  <span>Đã cọc</span>
                  <span>− {fmt(prepaid)}</span>
                </div>
              )}
              {remaining > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 17, fontWeight: 900, color: "#c2410c", lineHeight: 1.2, marginTop: 2 }}>
                  <span>Còn phải trả</span>
                  <span>{fmt(remaining)}</span>
                </div>
              )}
              {remaining === 0 && prepaid > 0 && (
                <div style={{ fontSize: 13, color: "#16a34a", fontWeight: 700, marginTop: 2 }}>✓ Đã thanh toán đủ</div>
              )}
              {remaining === 0 && prepaid === 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 17, fontWeight: 900, color: "#1f2937", lineHeight: 1.2, marginTop: 2 }}>
                  <span>Tổng tiền</span>
                  <span>{fmt(order.totalAmount)}</span>
                </div>
              )}
            </>
          ) : (
            <div style={{ fontSize: 13, color: "#9ca3af" }}>Chưa có đơn hàng</div>
          )}
        </div>
      </div>
    </>
  );
}
