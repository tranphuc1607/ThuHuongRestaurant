"use client";
import AccountDropdown from "./AccountDropdown";

export default function TopBar() {
  return (
    <div className="bg-surface-dark text-on-dark-soft text-xs py-2 z-[100]">
      <div className="max-w-[1200px] mx-auto px-4 flex items-center justify-between">
        {/* Left: hours + address */}
        <div className="flex items-center gap-5">
          <span className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-primary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" strokeWidth="2" />
              <polyline points="12 6 12 12 16 14" strokeWidth="2" strokeLinecap="round" />
            </svg>
            Mở cửa 08:00 – 22:00 mỗi ngày
          </span>
          <span className="hidden md:flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-primary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            123 Đường Ẩm Thực, Quận 1, TP.HCM
          </span>
        </div>

        {/* Right: phone + account */}
        <div className="flex items-center gap-4">
          <a href="tel:0123456789" className="hidden sm:flex items-center gap-1.5 hover:text-on-dark transition-colors">
            <svg className="w-3.5 h-3.5 text-primary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeWidth="2" strokeLinecap="round"
                d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.8a19.79 19.79 0 01-3.07-8.64A2 2 0 012 .95h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 8.92a16 16 0 006.17 6.17l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
            </svg>
            0123 456 789
          </a>
          <span className="opacity-30">|</span>
          <AccountDropdown />
        </div>
      </div>
    </div>
  );
}
