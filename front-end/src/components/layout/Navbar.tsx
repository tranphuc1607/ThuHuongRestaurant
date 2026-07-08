"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import AccountDropdown from "./AccountDropdown";
import { useAuth } from "@/contexts/AuthContext";

const baseNavLinks = [
  { href: "/", label: "Trang chủ" },
  { href: "/gioi-thieu", label: "Giới thiệu" },
  { href: "/san-pham", label: "Thực đơn" },
  { href: "/dat-ban", label: "Đặt bàn" },
  { href: "/lien-he", label: "Liên hệ" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user } = useAuth();

  const navLinks = [
    ...baseNavLinks,
    user
      ? { href: "/dat-ban/lich-su", label: "Lịch sử đặt bàn" }
      : { href: "/dat-ban/lich-su", label: "Tìm đơn hàng" },
  ];

  return (
    <>
    {/* Backdrop — đóng menu khi tap ra ngoài, nằm dưới nav (z-40 < z-50) */}
    {mobileOpen && (
      <div
        className="fixed inset-0 z-40 md:hidden"
        onPointerDown={() => setMobileOpen(false)}
        aria-hidden="true"
      />
    )}
    <nav className="bg-canvas border-b border-hairline sticky top-0 z-50">
      <div className="max-w-[1200px] mx-auto px-4">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <Link href="/" className="flex-shrink-0">
            <div className="border-2 border-primary px-3 py-1.5 inline-flex items-baseline gap-0">
              <span className="text-lg font-black text-ink tracking-tight leading-none">THU</span>
              <span className="text-lg font-black text-primary tracking-tight leading-none">HƯƠNG</span>
            </div>
          </Link>

          {/* Desktop Nav — center */}
          <ul className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive =
                link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      isActive
                        ? "bg-surface-card text-ink"
                        : "text-muted hover:text-ink hover:bg-surface-soft"
                    }`}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* Right: Account + CTA + Mobile toggle */}
          <div className="flex items-center gap-3">
            {/* Account dropdown — hidden on mobile */}
            <div className="hidden md:block text-sm text-muted">
              <AccountDropdown />
            </div>

            {/* Đặt bàn CTA */}
            <Link
              href="/dat-ban"
              className="hidden md:inline-flex items-center gap-1.5 bg-primary text-white text-sm font-semibold px-5 py-2 rounded-lg hover:bg-primary-dark transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Đặt bàn
            </Link>

            {/* Mobile menu toggle */}
            <button
              className="md:hidden text-muted hover:text-ink p-2.5"
              onPointerDown={(e) => {
                e.preventDefault(); // ngăn browser generate click sau pointerdown
                setMobileOpen((v) => !v);
              }}
              onClick={(e) => {
                // e.detail === 0: keyboard activation (Space/Enter) — pointer đã xử lý ở onPointerDown
                if (e.detail === 0) setMobileOpen((v) => !v);
              }}
              aria-label="Menu"
            >
              {mobileOpen ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <line x1="18" y1="6" x2="6" y2="18" strokeWidth="2" strokeLinecap="round" />
                  <line x1="6" y1="6" x2="18" y2="18" strokeWidth="2" strokeLinecap="round" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <line x1="3" y1="6" x2="21" y2="6" strokeWidth="2" strokeLinecap="round" />
                  <line x1="3" y1="12" x2="21" y2="12" strokeWidth="2" strokeLinecap="round" />
                  <line x1="3" y1="18" x2="21" y2="18" strokeWidth="2" strokeLinecap="round" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu — full canvas sheet */}
      {mobileOpen && (
        <div className="md:hidden border-t border-hairline bg-canvas">
          <ul className="py-3 px-4 space-y-1">
            {navLinks.map((link) => {
              const isActive =
                link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className={`block px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-surface-card text-ink"
                        : "text-muted hover:bg-surface-soft hover:text-ink"
                    }`}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="px-4 pt-2 pb-4 border-t border-hairline mt-1 flex flex-col gap-3">
            {/* Admin: cả 2 link */}
            {user?.role === "ROLE_ADMIN" && (
              <>
                <Link
                  href="/admin/dashboard"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center justify-center gap-2 bg-surface-dark text-white text-sm font-semibold px-5 py-3 rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Trang quản trị
                </Link>
                <Link
                  href="/employee/ban"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center justify-center gap-2 bg-surface-dark/80 text-white text-sm font-semibold px-5 py-3 rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                      d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                  Trang nhân viên
                </Link>
              </>
            )}
            {/* Employee: chỉ link nhân viên */}
            {user?.role === "ROLE_EMPLOYEE" && (
              <Link
                href="/employee/ban"
                onClick={() => setMobileOpen(false)}
                className="flex items-center justify-center gap-2 bg-surface-dark text-white text-sm font-semibold px-5 py-3 rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                    d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
                Trang nhân viên
              </Link>
            )}
            <Link
              href="/dat-ban"
              onClick={() => setMobileOpen(false)}
              className="flex items-center justify-center gap-2 bg-primary text-white text-sm font-semibold px-5 py-3 rounded-lg hover:bg-primary-dark transition-colors"
            >
              Đặt bàn ngay
            </Link>
            <div className="text-sm text-muted px-1">
              <AccountDropdown />
            </div>
          </div>
        </div>
      )}
    </nav>
    </>
  );
}
