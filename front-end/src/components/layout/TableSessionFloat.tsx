"use client";
import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

const SESSION_TTL = 6 * 60 * 60 * 1000;

export default function TableSessionFloat() {
  const [session, setSession] = useState<{ token: string; name: string } | null>(null);
  const router   = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    function readSession() {
      try {
        const raw = localStorage.getItem("qr_active_table");
        if (!raw) { setSession(null); return; }
        const s = JSON.parse(raw) as { token: string; name: string; ts: number };
        if (Date.now() - s.ts > SESSION_TTL) {
          localStorage.removeItem("qr_active_table");
          setSession(null);
          return;
        }
        setSession(s);
      } catch { setSession(null); }
    }
    readSession();
    window.addEventListener("storage", readSession);
    return () => window.removeEventListener("storage", readSession);
  }, [pathname]);

  if (!session || pathname.startsWith("/ban/")) return null;

  const handleOpen = () => router.push(`/ban/${session.token}`);

  const label = session.name || "Bàn";

  return (
    /* Inline style bottom để tránh Tailwind không generate arbitrary class */
    <div style={{ position: "fixed", bottom: 152, left: 24, zIndex: 250 }}>
      <div style={{ position: "relative" }}>
        {/* Ping giống QrFloat */}
        <span
          className="animate-ping"
          style={{
            position: "absolute", inset: 0, borderRadius: 9999,
            background: "rgba(249,115,22,0.4)",
          }}
        />
        <span style={{
          position: "absolute", inset: -4, borderRadius: 9999,
          background: "rgba(249,115,22,0.15)",
        }} />

        {/* Pill button — cùng màu cam với QrFloat */}
        <button
          onClick={handleOpen}
          aria-label={`Quay lại ${label}`}
          style={{
            position: "relative",
            display: "flex", alignItems: "center", gap: 6,
            height: 56, paddingLeft: 8, paddingRight: 14,
            borderRadius: 9999,
            background: "linear-gradient(135deg, #f97316, #ea580c)",
            color: "#fff",
            boxShadow: "0 10px 30px rgba(249,115,22,0.55)",
            border: "none", cursor: "pointer",
            WebkitTapHighlightColor: "transparent",
            transition: "transform 0.2s",
            touchAction: "manipulation",
          }}
          onPointerDown={(e) => { if (e.pointerType === "touch") { e.preventDefault(); handleOpen(); } }}
        >
          {/* Icon bàn — cùng kích thước với icon trong QrFloat */}
          <span style={{
            width: 40, height: 40, borderRadius: 9999,
            background: "rgba(255,255,255,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.8"
              strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 8h18M9 8v9m6-9v9M4 4h16" />
            </svg>
          </span>

          {/* Tên bàn */}
          <span style={{
            fontSize: 12, fontWeight: 700, lineHeight: 1.2,
            maxWidth: 72, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {label}
          </span>
        </button>

      </div>
    </div>
  );
}
