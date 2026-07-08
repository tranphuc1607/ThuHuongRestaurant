"use client";
import { useState, useEffect } from "react";

const PHONE    = "0123456789";
const ZALO_URL = `https://zalo.me/${PHONE}`;

function PhoneIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.8a19.79 19.79 0 01-3.07-8.64A2 2 0 012 .95h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 8.92a16 16 0 006.17 6.17l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
    </svg>
  );
}

function ZaloIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="10" fill="white" fillOpacity="0.15" />
      <text x="5" y="34" fontSize="26" fontWeight="900" fill="white" fontFamily="Arial, sans-serif">Z</text>
    </svg>
  );
}

function HeadsetIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
        d="M3 18v-6a9 9 0 0118 0v6" />
      <path strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
        d="M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3zM3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeWidth="2" strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

const ACTIONS = [
  {
    key:    "call",
    label:  "Gọi ngay",
    sub:    PHONE,
    href:   `tel:${PHONE}`,
    target: "_self",
    from:   "from-emerald-500 to-emerald-600",
    shadow: "shadow-emerald-500/40",
    icon:   <PhoneIcon />,
  },
  {
    key:    "zalo",
    label:  "Chat Zalo",
    sub:    PHONE,
    href:   ZALO_URL,
    target: "_blank",
    from:   "from-[#0068FF] to-[#0052CC]",
    shadow: "shadow-blue-500/40",
    icon:   <ZaloIcon />,
  },
];

export default function ContactFloat() {
  const [open, setOpen]       = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  return (
    <>
      {open && (
        <div onClick={() => setOpen(false)} className="fixed inset-0 z-[240] bg-black/20" />
      )}

      {/* Container cố định góc phải dưới (mobile) / trái dưới (desktop) */}
      <div className="fixed bottom-6 left-6 z-[250]">

        {/* Sub-actions: absolute phía trên nút toggle, xuất hiện từ dưới lên */}
        <div
          className="absolute bottom-[calc(100%+10px)] left-0
                     flex flex-col gap-2.5 pointer-events-none"
        >
          {/* Zalo ở dưới cùng (gần nút), Call ở trên — render ngược để Zalo gần toggle */}
          {[...ACTIONS].reverse().map((action, i) => {
            const origIndex = ACTIONS.length - 1 - i;
            return (
              <a
                key={action.key}
                href={action.href}
                target={action.target}
                rel={action.target === "_blank" ? "noreferrer" : undefined}
                onClick={() => setOpen(false)}
                style={{
                  transitionDelay: open
                    ? `${i * 55}ms`
                    : `${(ACTIONS.length - 1 - i) * 40}ms`,
                }}
                className={[
                  "flex items-center gap-3 pl-3.5 pr-5 py-3 rounded-2xl",
                  `bg-gradient-to-br ${action.from}`,
                  `shadow-lg ${action.shadow}`,
                  "text-white select-none whitespace-nowrap",
                  "hover:scale-[1.04] active:scale-[0.97]",
                  "transition-all duration-300 ease-out",
                  open
                    ? "opacity-100 translate-y-0 scale-100 pointer-events-auto"
                    : "opacity-0 translate-y-5 scale-90 pointer-events-none",
                ].join(" ")}
              >
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                  {action.icon}
                </div>
                <div>
                  <div className="text-sm font-bold leading-none">{action.label}</div>
                  <div className="text-[11px] text-white/70 mt-0.5">{action.sub}</div>
                </div>
              </a>
            );
          })}
        </div>

        {/* Nút toggle chính — luôn ở góc dưới */}
        <div className="relative pointer-events-auto">
          <span
            className={`absolute inset-0 rounded-full bg-primary/40 transition-all duration-500 ${
              open ? "scale-100 opacity-0" : "animate-ping"
            }`}
          />
          <span className="absolute inset-[-4px] rounded-full bg-primary/20" />

          <button
            onClick={() => setOpen(v => !v)}
            aria-label={open ? "Đóng liên hệ" : "Liên hệ"}
            className={[
              "relative w-14 h-14 rounded-full flex items-center justify-center",
              "bg-gradient-to-br from-primary to-primary-dark text-white",
              "shadow-2xl shadow-primary/50",
              "transition-all duration-300 ease-out",
              "hover:scale-110 active:scale-95 focus:outline-none touch-manipulation",
              open ? "rotate-[360deg]" : "rotate-0",
            ].join(" ")}
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            <span className={`absolute transition-all duration-300 ${open ? "opacity-100 scale-100 rotate-0" : "opacity-0 scale-50 rotate-90"}`}>
              <CloseIcon />
            </span>
            <span className={`absolute transition-all duration-300 ${open ? "opacity-0 scale-50 -rotate-90" : "opacity-100 scale-100 rotate-0"}`}>
              <HeadsetIcon />
            </span>
          </button>

          {/* Tooltip — desktop only */}
          <span
            className={`hidden sm:block absolute left-16 top-1/2 -translate-y-1/2 whitespace-nowrap bg-gray-900/90 text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow-lg transition-all duration-300 pointer-events-none ${
              open ? "opacity-0 translate-x-2" : "opacity-100 translate-x-0"
            }`}
          >
            Liên hệ ngay
            <span className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900/90" />
          </span>
        </div>
      </div>
    </>
  );
}
