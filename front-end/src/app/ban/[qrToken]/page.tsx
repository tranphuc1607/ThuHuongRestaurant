// Server component — no "use client"
import Script from "next/script";
const BACKEND = process.env.BACKEND_API_URL ?? "http://localhost:8080/api/v1";
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");

const IS_NGROK = APP_URL.includes("ngrok");

// Chuyển relative/localhost path → absolute URL + thêm ngrok bypass nếu cần
function resolveImgUrl(url?: string): string | null {
  if (!url) return null;
  let resolved = url;
  if (/^https?:\/\/localhost(:\d+)?/.test(url)) {
    try { resolved = APP_URL + new URL(url).pathname; } catch {}
  } else if (url.startsWith("/")) {
    resolved = APP_URL ? APP_URL + url : url;
  }
  // <img> không gửi được header → dùng query param để bypass ngrok interstitial
  if (IS_NGROK && resolved.startsWith(APP_URL) && !resolved.includes("ngrok-skip-browser-warning")) {
    resolved += "?ngrok-skip-browser-warning=1";
  }
  return resolved;
}

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
interface Product {
  id: number; name: string; price: number; category: string; status: string; imageUrl?: string;
}

const UNIT: Record<string, string> = {
  PORTION: "phần", CUP: "ly", DISH: "đĩa/tô", PIECE: "cái", KG: "kg",
};
const CAT_LABEL: Record<string, string> = {
  CHICKEN: "🍗 Gà", PORK: "🥩 Heo", BEEF: "🐄 Bò", FISH: "🐟 Hải sản",
  VEGETABLE: "🥦 Rau củ", DRINK_FOOD: "🧆 Ăn kèm", DRINK: "🥤 Đồ uống", OTHER: "📦 Khác",
};
const CAT_ORDER = ["CHICKEN","PORK","BEEF","FISH","VEGETABLE","DRINK_FOOD","DRINK","OTHER"];

function fmt(v: number) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(v);
}
const AVATAR_COLORS = ["#ea580c","#16a34a","#2563eb","#7c3aed","#db2777","#d97706","#0891b2","#65a30d","#dc2626","#0369a1"];
function avatarColor(name: string): string {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[h];
}

async function getOrder(qrToken: string) {
  try {
    const res = await fetch(`${BACKEND}/orders/table/${qrToken}`, { cache: "no-store" });
    const json = await res.json();
    if (json.statusCode === 200 && json.data?.items) {
      return { order: json.data as OrderData, tableName: (json.data.tableName as string) || "", error: "" };
    }
    if (json.statusCode === 400 || json.statusCode === 404 || (json.statusCode === 200 && json.data?.message)) {
      const msg: string = json.data?.message ?? json.message ?? "";
      const m = msg.match(/Bàn (.+?) chưa/);
      return { order: null, tableName: m?.[1] ?? "", error: "" };
    }
    return { order: null, tableName: "", error: `Lỗi ${json.statusCode}` };
  } catch {
    return { order: null, tableName: "", error: "Không kết nối được máy chủ" };
  }
}

async function getProducts(): Promise<Product[]> {
  try {
    const res = await fetch(`${BACKEND}/products?status=AVAILABLE&size=200`, { cache: "no-store" });
    const json = await res.json();
    const data = json.data;
    if (!data) return [];
    const list: Product[] = Array.isArray(data) ? data : (Array.isArray(data.content) ? data.content : []);
    return list.filter((p: Product) => p.status === "AVAILABLE");
  } catch {
    return [];
  }
}

export default async function TableQrPage({ params }: { params: Promise<{ qrToken: string }> }) {
  const { qrToken } = await params;
  const [{ order, tableName, error }, products] = await Promise.all([
    getOrder(qrToken),
    getProducts(),
  ]);

  const isCocBia = (it: OrderItem) =>
    it.saleUnit === "CUP" && it.productName.toLowerCase().includes("bia");
  const drinks = order?.items.filter(isCocBia) ?? [];
  const foods  = order?.items.filter(it => !isCocBia(it)) ?? [];
  const prepaid   = order?.prepaidAmount ?? 0;
  const remaining = order ? Math.max(0, order.totalAmount - prepaid) : 0;
  const netRefund = order ? Math.round(prepaid - order.totalAmount) : 0;

  const grouped: Record<string, Product[]> = {};
  for (const p of products) {
    const cat = (p.category ?? "OTHER").toUpperCase();
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(p);
  }
  const sortedCats = [
    ...CAT_ORDER.filter(c => grouped[c]?.length),
    ...Object.keys(grouped).filter(c => !CAT_ORDER.includes(c) && grouped[c]?.length),
  ];

  // Map tên món → product (để lấy ảnh cho order items)
  const productByName: Record<string, Product> = {};
  for (const p of products) productByName[p.name.trim().toLowerCase()] = p;

  const snapStr = String((order?.items?.length ?? -1) + "+" + (order?.totalAmount ?? 0));

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", fontFamily: "system-ui,-apple-system,sans-serif", paddingBottom: 90 }}>

      {/* Meta ẩn để script ghi localStorage cho TableSessionFloat */}
      <span id="qr-table-meta" data-token={qrToken} data-name={tableName ?? ""} style={{ display: "none" }} />

      {/* ── In-app browser redirect ── */}
      <script dangerouslySetInnerHTML={{ __html: `
(function(){
  var ua=navigator.userAgent||'';
  // Zalo, Facebook, Instagram, Line, WeChat, Viber, TikTok in-app browsers
  if(!/FBAN|FBAV|FB_IAB|Instagram|ZaloApp|Zalo\/|Line\/|MicroMessenger|Viber|TikTok/.test(ua))return;
  if(/Android/.test(ua)){
    // Dùng Android intent để mở bằng trình duyệt mặc định (Chrome)
    location.href='intent://'+location.host+location.pathname+location.search
      +'#Intent;scheme='+(location.protocol==='https:'?'https':'http')+';end';
    return;
  }
  // iOS / unknown — hiện overlay hướng dẫn
  function showOverlay(){
    var ov=document.createElement('div');
    ov.id='ib-overlay';
    ov.style.cssText='position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.88);display:flex;align-items:center;justify-content:center;padding:24px;box-sizing:border-box;';
    ov.innerHTML=
      '<div style="background:#fff;border-radius:20px;padding:28px 24px;text-align:center;max-width:300px;width:100%">'
      +'<div style="font-size:44px;margin-bottom:12px">🌐</div>'
      +'<p style="font-size:17px;font-weight:700;color:#1f2937;margin:0 0 8px">Mở bằng trình duyệt</p>'
      +'<p style="font-size:14px;color:#6b7280;margin:0 0 18px;line-height:1.6">Trang này cần mở bằng Safari hoặc Chrome để hoạt động đúng.</p>'
      +'<p style="font-size:13px;background:#f3f4f6;border-radius:10px;padding:10px 14px;color:#374151;margin:0 0 16px;line-height:1.7">'
      +'1. Nhấn biểu tượng <b>⎙</b> hoặc <b>···</b><br>2. Chọn <b>"Mở trong Safari"</b> / <b>"Mở bằng trình duyệt"</b></p>'
      +'<button onclick="document.getElementById(\'ib-overlay\').remove()" '
      +'style="background:#ea580c;color:#fff;border:none;border-radius:10px;padding:12px 0;font-size:15px;font-weight:700;cursor:pointer;width:100%">'
      +'Bỏ qua, mở tại đây</button>'
      +'</div>';
    document.body.appendChild(ov);
  }
  if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',showOverlay);}
  else{showOverlay();}
})();
      `}} />

      {/* ── Polling + scroll restore ── */}
      <script dangerouslySetInnerHTML={{ __html: `
(function(){
  var saved=sessionStorage.getItem('qr_scroll');
  if(saved){window.scrollTo(0,parseInt(saved,10));sessionStorage.removeItem('qr_scroll');}
  var snap=${JSON.stringify(snapStr)};
  function check(){
    fetch('/api/table/${qrToken}',{cache:'no-store',headers:{'ngrok-skip-browser-warning':'1'}})
      .then(function(r){return r.json();})
      .then(function(j){
        if(j.statusCode===200&&j.data){
          var cur=String((j.data.items?j.data.items.length:-1)+'+'+String(j.data.totalAmount||0));
          if(cur!==snap){
            sessionStorage.setItem('qr_scroll',String(window.scrollY));
            var dr=document.getElementById('order-drawer');
            if(dr&&dr.style.transform==='translateX(0%)'){
              sessionStorage.setItem('qr_drawer','1');
              sessionStorage.setItem('qr_drawer_scroll',String(dr.scrollTop));
            }
            location.reload();
          }
        }
      }).catch(function(){});
  }
  setInterval(check,3000);
  // Ẩn ảnh vỡ để chữ cái đầu hiện ra làm fallback
  document.addEventListener('DOMContentLoaded',function(){
    document.querySelectorAll('[data-prod-img="1"]').forEach(function(img){
      img.onerror=function(){this.style.display='none';};
    });
  });
})();
      `}} />

      {/* ── Header ── */}
      <div style={{ background: "#ea580c", color: "#fff", padding: "28px 20px 14px", textAlign: "center", position: "relative" }}>
        {/* Nút thoát về trang chủ — góc trên trái */}
        <a
          href="/"
          style={{
            position: "absolute", top: 12, left: 12,
            display: "flex", alignItems: "center", gap: 5,
            background: "rgba(255,255,255,0.18)", color: "#fff",
            borderRadius: 99, padding: "5px 12px 5px 8px",
            fontSize: 12, fontWeight: 600, textDecoration: "none",
            backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
          Trang chủ
        </a>
        <p style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 2, opacity: 0.7, margin: "0 0 4px" }}>Nhà hàng Thu Hương</p>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 6px" }}>{tableName || "Thu Hương"}</h1>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 11, opacity: 0.75 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: error ? "#fca5a5" : "#86efac", display: "inline-block" }} />
          {error || "Tự cập nhật liên tục"}
        </div>
      </div>

      {/* ── Search bar ── */}
      <div style={{ position: "sticky", top: 0, background: "#fff", borderBottom: "1px solid #f0f0f0", zIndex: 11, padding: "8px 12px" }}>
        <input id="search-input" placeholder="🔍 Tìm món ăn..." style={{ width: "100%", padding: "9px 14px", borderRadius: 99, border: "1.5px solid #e5e7eb", fontSize: 16, outline: "none", boxSizing: "border-box", background: "#f9fafb" }} />
      </div>

      {/* ── Category filter (wrap — hiện hết không scroll) ── */}
      <div style={{ position: "sticky", top: 54, background: "#fff", borderBottom: "1px solid #f0f0f0", zIndex: 10, padding: "8px 12px", display: "flex", flexWrap: "wrap", gap: 6 }}>
        <button data-cat-btn="1" data-cat="ALL" style={{ padding: "6px 13px", fontSize: 12, fontWeight: 700, color: "#fff", background: "#ea580c", border: "none", borderRadius: 99, cursor: "pointer", whiteSpace: "nowrap" }}>
          Tất cả
        </button>
        {sortedCats.map(cat => (
          <button key={cat} data-cat-btn="1" data-cat={cat} style={{ padding: "6px 13px", fontSize: 12, fontWeight: 600, color: "#6b7280", background: "#f3f4f6", border: "none", borderRadius: 99, cursor: "pointer", whiteSpace: "nowrap" }}>
            {CAT_LABEL[cat] ?? cat}
          </button>
        ))}
      </div>

      {/* ── Product list ── */}
      <div style={{ padding: "10px 8px", width: "100%" }}>
        {sortedCats.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 24px", color: "#9ca3af", fontSize: 13 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🍽️</div>
            Không tải được thực đơn
          </div>
        ) : sortedCats.map(cat => (
          <div key={cat} data-prod-group={cat} style={{ marginBottom: 4, scrollMarginTop: 120 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "14px 0 8px" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>{CAT_LABEL[cat] ?? cat}</span>
              <div style={{ flex: 1, height: 1, background: "#e5e7eb" }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {(grouped[cat] ?? []).map(p => {
                const color = avatarColor(p.name);
                const letter = p.name.trim()[0]?.toUpperCase() ?? "?";
                const resolvedUrl = resolveImgUrl(p.imageUrl);
                // Chỉ cần fetch workaround khi đang qua ngrok (không có interstitial bypass header)
                const useFetch = !!(p.imageUrl?.startsWith("/uploads/")) && IS_NGROK;
                return (
                  <div key={p.id} data-prod-id={p.id} data-prod-name={p.name.toLowerCase()} style={{ background: "#fff", borderRadius: 14, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.07)", border: "1px solid #f0f0f0" }}>
                    {/* Ảnh / avatar lớn */}
                    <div style={{ height: 108, background: `linear-gradient(145deg,${color}dd,${color}88)`, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
                      {/* Chữ cái đầu luôn hiện làm nền — ảnh phủ lên khi load được */}
                      <span data-prod-letter="1" style={{ fontSize: 44, fontWeight: 900, color: "rgba(255,255,255,0.92)", textShadow: "0 3px 10px rgba(0,0,0,0.18)", lineHeight: 1 }}>
                        {letter}
                      </span>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {resolvedUrl && (useFetch
                        ? <img data-local-img="1" data-img-src={resolvedUrl} alt={p.name} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: "none" }} />
                        : <img data-prod-img="1" src={resolvedUrl} alt={p.name} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                      )}
                    </div>
                    {/* Tên + giá */}
                    <div style={{ padding: "8px 10px 10px" }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#1f2937", lineHeight: 1.35, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", minHeight: 32 }}>
                        {p.name}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "#ea580c", marginTop: 5 }}>{fmt(p.price)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        <div style={{ marginTop: 24, textAlign: "center" }}>
          <a href={`/ban/${qrToken}`} style={{ fontSize: 11, color: "#d1d5db", textDecoration: "none" }}>↻ Tải lại</a>
        </div>
      </div>

      {/* ── Drawer backdrop ── */}
      <div id="order-overlay" style={{ display: "none", position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 40 }} />

      {/* ── Order drawer (slides from right) ── */}
      <div id="order-drawer" style={{ position: "fixed", top: 0, right: 0, width: "100%", height: "100%", background: "#f9fafb", transform: "translateX(100%)", transition: "transform 0.28s cubic-bezier(0.4,0,0.2,1)", zIndex: 50, overflowY: "auto", overscrollBehavior: "contain" }}>
        {/* Sticky header */}
        <div style={{ position: "sticky", top: 0, background: "#fff", padding: "14px 16px", borderBottom: "1px solid #f0f0f0", display: "flex", alignItems: "center", gap: 10, zIndex: 5 }}>
          <button id="drawer-close" style={{ width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", background: "#f3f4f6", border: "none", borderRadius: 8, fontSize: 18, cursor: "pointer", color: "#374151" }}>←</button>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#1f2937", flex: 1 }}>
            {tableName ? `Đơn — ${tableName}` : "Đơn hàng"}
          </span>
          {order && (
            <span style={{ fontSize: 12, background: "#fef9c3", color: "#a16207", padding: "2px 8px", borderRadius: 99, fontWeight: 600 }}>
              {order.items.length} món
            </span>
          )}
        </div>

        {/* Drawer body */}
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

              {/* Food table */}
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
                      const color = avatarColor(item.productName);
                      const letter = item.productName.trim()[0]?.toUpperCase() ?? "?";
                      const unit = UNIT[item.saleUnit] ?? item.saleUnit;
                      const prod = productByName[item.productName.trim().toLowerCase()];
                      const itemImgUrl = prod ? resolveImgUrl(prod.imageUrl) : null;
                      const itemUseFetch = !!(prod?.imageUrl?.startsWith("/uploads/")) && IS_NGROK;
                      return (
                        <div key={item.id} style={{ display: "grid", gridTemplateColumns: "22px 38px 1fr 48px 72px 78px", gap: "0 6px", padding: "11px 12px", alignItems: "center", borderBottom: i < foods.length - 1 ? "1px solid #f9fafb" : "none" }}>
                          <span style={{ fontSize: 12, color: "#9ca3af", fontWeight: 600 }}>{i + 1}</span>
                          {/* Thumbnail ảnh món — cùng pattern với menu card */}
                          <div style={{ position: "relative", width: 36, height: 36, flexShrink: 0 }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            {itemImgUrl && (itemUseFetch
                              ? <img data-local-img="1" data-img-src={itemImgUrl} alt=""
                                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%", borderRadius: 8, objectFit: "cover", display: "none" }} />
                              : <img data-prod-img="1" src={itemImgUrl} alt=""
                                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%", borderRadius: 8, objectFit: "cover" }} />
                            )}
                            <div data-prod-letter="1" style={{ width: 36, height: 36, borderRadius: 8, background: color, color: "#fff", display: (itemImgUrl && !itemUseFetch) ? "none" : "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 700 }}>
                              {letter}
                            </div>
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 600, color: "#1f2937", lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
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

              {/* Surcharge */}
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


      {/* ── Drawer toggle arrow — vùng bấm trong suốt mở rộng xung quanh mũi tên ── */}
      <button id="drawer-toggle-btn" style={{ position: "fixed", right: 0, top: "50%", transform: "translateY(-50%)", zIndex: 55, border: "none", cursor: "pointer", background: "transparent", padding: "70px 0 70px 52px", WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}>
        <span id="drawer-arrow" style={{ display: "block", background: "#f97316", color: "#fff", borderRadius: "12px 0 0 12px", padding: "44px 7px", fontSize: 20, fontWeight: 700, lineHeight: 1, boxShadow: "-3px 0 10px rgba(0,0,0,0.15)" }}>‹</span>
      </button>

      {/* ── Floating bottom bar ── */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#fff", borderTop: "1.5px solid #f0f0f0", padding: "10px 16px", display: "flex", alignItems: "center", gap: 8, zIndex: 35, boxShadow: "0 -2px 12px rgba(0,0,0,0.07)" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {order ? (
            <>
              {/* Tổng cộng + Đã cọc — cùng cỡ chữ nhỏ */}
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
              {/* Còn phải trả — to nhất */}
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
                <div style={{ fontSize: 17, fontWeight: 900, color: "#1f2937", lineHeight: 1.2, marginTop: 2 }}>{fmt(order.totalAmount)}</div>
              )}
            </>
          ) : error ? (
            <div style={{ fontSize: 12, color: "#f87171" }}>{error}</div>
          ) : (
            <div style={{ fontSize: 13, color: "#9ca3af" }}>Chưa có đơn hàng</div>
          )}
        </div>
      </div>

      {/* ── Interaction script ── */}
      <Script id="qr-interaction" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: `
(function(){
  /* Lưu phiên bàn để TableSessionFloat hiện khi khách ra trang chủ */
  try{
    var _m=document.getElementById('qr-table-meta');
    if(_m){
      var _tk=_m.getAttribute('data-token');
      var _nm=_m.getAttribute('data-name')||'Bàn';
      if(_tk) localStorage.setItem('qr_active_table',JSON.stringify({token:_tk,name:_nm,ts:Date.now()}));
    }
  }catch(e){}
  /* DRAWER */
  var drawerOpen=false;
  function openDrawer(){
    drawerOpen=true;
    var ov=document.getElementById('order-overlay');
    var dr=document.getElementById('order-drawer');
    var ar=document.getElementById('drawer-arrow');
    if(ov) ov.style.display='block';
    if(dr) dr.style.transform='translateX(0%)';
    if(ar) ar.textContent='›';
    document.body.style.overflow='hidden';
  }
  function closeDrawer(){
    drawerOpen=false;
    var ov=document.getElementById('order-overlay');
    var dr=document.getElementById('order-drawer');
    var ar=document.getElementById('drawer-arrow');
    if(ov) ov.style.display='none';
    if(dr) dr.style.transform='translateX(100%)';
    if(ar) ar.textContent='‹';
    document.body.style.overflow='';
  }
  function toggleDrawer(){ drawerOpen?closeDrawer():openDrawer(); }
  // pointerdown + click để cover mọi thiết bị; preventDefault trên touch ngăn double-fire
  function bindBtn(el,fn){
    if(!el)return;
    var touchFired=false;
    el.addEventListener('pointerdown',function(e){
      if(e.pointerType==='touch'){
        touchFired=true;
        e.preventDefault();
        fn();
        setTimeout(function(){touchFired=false;},400);
      }
    });
    el.addEventListener('click',function(){if(!touchFired){fn();}});
  }
  var toggleBtn=document.getElementById('drawer-toggle-btn');
  var closeBtn=document.getElementById('drawer-close');
  var overlay=document.getElementById('order-overlay');
  bindBtn(toggleBtn,toggleDrawer);
  bindBtn(closeBtn,closeDrawer);
  if(overlay){
    overlay.addEventListener('click',closeDrawer);
    overlay.addEventListener('pointerdown',function(e){
      if(e.pointerType==='touch'){e.preventDefault();closeDrawer();}
    });
  }
  // Khôi phục trạng thái drawer + scroll position sau khi reload
  var restoreDrawer=sessionStorage.getItem('qr_drawer');
  if(restoreDrawer){
    sessionStorage.removeItem('qr_drawer');
    openDrawer();
    var ds=sessionStorage.getItem('qr_drawer_scroll');
    if(ds){
      sessionStorage.removeItem('qr_drawer_scroll');
      var drawerEl=document.getElementById('order-drawer');
      if(drawerEl) drawerEl.scrollTop=parseInt(ds,10);
    }
  }

  /* CATEGORY — scroll to section + highlight active pill */
  var catBtns=document.querySelectorAll('[data-cat-btn]');
  function setActivePill(cat){
    catBtns.forEach(function(b){
      var active=b.getAttribute('data-cat')===cat;
      b.style.color=active?'#fff':'#6b7280';
      b.style.background=active?'#ea580c':'#f3f4f6';
      b.style.fontWeight=active?'700':'600';
    });
  }
  catBtns.forEach(function(btn){
    btn.addEventListener('click',function(){
      var cat=this.getAttribute('data-cat');
      var inp=document.getElementById('search-input');
      if(inp&&inp.value){inp.value='';inp.dispatchEvent(new Event('input'));}
      if(cat==='ALL'){
        window.scrollTo({top:0,behavior:'smooth'});
        setActivePill('ALL');
      } else {
        var sec=document.querySelector('[data-prod-group="'+cat+'"]');
        if(sec){sec.scrollIntoView({behavior:'smooth',block:'start'});}
        setActivePill(cat);
      }
    });
  });
  /* IntersectionObserver — tự highlight pill theo section đang xem */
  var io=new IntersectionObserver(function(entries){
    entries.forEach(function(e){
      if(e.isIntersecting) setActivePill(e.target.getAttribute('data-prod-group'));
    });
  },{rootMargin:'-80px 0px -55% 0px',threshold:0});
  document.querySelectorAll('[data-prod-group]').forEach(function(s){io.observe(s);});
  /* LOCAL UPLOADS — dùng fetch() với ngrok bypass header, <img> không gửi được header */
  document.querySelectorAll('[data-local-img]').forEach(function(img){
    var src=img.getAttribute('data-img-src');
    if(!src) return;
    var letter=img.parentNode.querySelector('[data-prod-letter]');
    fetch(src,{headers:{'ngrok-skip-browser-warning':'1'}})
      .then(function(r){return r.ok?r.blob():Promise.reject(r.status);})
      .then(function(blob){
        img.src=URL.createObjectURL(blob);
        img.style.display='block';
        if(letter) letter.style.display='none';
      })
      .catch(function(){
        // span (menu card) → block; div (order item) → flex
        if(letter) letter.style.display=letter.tagName==='SPAN'?'block':'flex';
      });
  });
  /* EXTERNAL IMAGES — onerror fallback */
  document.querySelectorAll('[data-prod-img]').forEach(function(img){
    img.onerror=function(){
      this.style.display='none';
      var letter=this.parentNode.querySelector('[data-prod-letter]');
      if(letter) letter.style.display=letter.tagName==='SPAN'?'block':'flex';
    };
  });

  /* SEARCH */
  var searchInput=document.getElementById('search-input');
  if(searchInput){
    searchInput.addEventListener('input',function(){
      var q=this.value.trim().toLowerCase();
      document.querySelectorAll('[data-prod-id]').forEach(function(card){
        var name=card.getAttribute('data-prod-name')||'';
        card.style.display=(!q||name.includes(q))?'':'none';
      });
      document.querySelectorAll('[data-prod-group]').forEach(function(sec){
        var hasVisible=Array.from(sec.querySelectorAll('[data-prod-id]')).some(function(c){return c.style.display!=='none';});
        sec.style.display=hasVisible?'':'none';
      });
    });
  }

})();
      `}} />
    </div>
  );
}
