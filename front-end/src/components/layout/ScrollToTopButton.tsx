"use client";
import { useState, useEffect } from "react";

export default function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 300);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollUp = () => window.scrollTo({ top: 0, behavior: "smooth" });

  return (
    <button
      aria-label="Lên đầu trang"
      onClick={scrollUp}
      onPointerDown={(e) => { if (e.pointerType === "touch") { e.preventDefault(); scrollUp(); } }}
      style={{
        position: "fixed",
        bottom: 84,
        right: 24,
        width: 44,
        height: 44,
        borderRadius: "50%",
        background: "#ea580c",
        color: "#fff",
        border: "none",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 4px 12px rgba(234,88,12,0.35)",
        zIndex: 200,
        opacity: visible ? 1 : 0,
        visibility: visible ? "visible" : "hidden",
        transform: visible ? "translateY(0)" : "translateY(8px)",
        transition: "opacity 0.22s, transform 0.22s, visibility 0.22s",
        touchAction: "manipulation",
        WebkitTapHighlightColor: "transparent",
      } as React.CSSProperties}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 15l-6-6-6 6" />
      </svg>
    </button>
  );
}
