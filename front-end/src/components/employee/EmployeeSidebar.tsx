"use client";
import Link from "next/link";
import { LogoMark } from "@/components/layout/Logo";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

const NAV = [
  {
    href: "/employee/ban", label: "Bàn",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
          d="M4 6h16M4 10h16M4 14h16M4 18h16" />
      </svg>
    ),
  },
  {
    href: "/employee/don-hang", label: "Đơn hàng",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
  {
    href: "/employee/dat-ban", label: "Booking",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    href: "/employee/thanh-toan", label: "Thanh toán",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <rect x="1" y="4" width="22" height="16" rx="2" ry="2" strokeWidth="1.8" />
        <line x1="1" y1="10" x2="23" y2="10" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
];

export default function EmployeeSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  const initials = ((user?.fullName ?? user?.username) ?? "NV").slice(0, 2).toUpperCase();

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <aside className="hidden md:flex w-56 min-h-screen bg-surface-dark text-on-dark flex-col flex-shrink-0">
        <div className="px-5 pt-5 pb-4 border-b border-white/10">
          <Link href="/employee/ban" className="flex items-center gap-2.5 mb-4">
            <LogoMark onDark size="sm" />
            <span className="text-[10px] text-on-dark-soft font-semibold uppercase tracking-widest">NV</span>
          </Link>
          <div className="flex items-center gap-3 px-1">
            <div className="w-9 h-9 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center flex-shrink-0">
              <span className="text-primary text-xs font-bold">{initials}</span>
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-on-dark truncate">{user?.fullName ?? user?.username}</div>
              <div className="text-[10px] text-primary font-medium">Nhân viên</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-0.5">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                isActive(item.href)
                  ? "bg-primary/20 text-primary font-semibold"
                  : "text-on-dark-soft hover:bg-white/7 hover:text-on-dark"
              }`}>
              <span className={isActive(item.href) ? "text-primary" : "text-on-dark-soft"}>
                {item.icon}
              </span>
              {item.label}
              {isActive(item.href) && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
            </Link>
          ))}
        </nav>

        <div className="border-t border-white/10 p-3 space-y-0.5">
          <Link href="/"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-on-dark-soft hover:text-on-dark hover:bg-white/7 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Trang chủ
          </Link>
          <button
            onClick={() => { logout(); router.push("/tai-khoan/dang-nhap"); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-400 hover:text-red-300 hover:bg-white/7 transition-colors text-left">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* ── Mobile bottom tab bar ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-surface-dark border-t border-white/10">
        <div className="flex items-stretch h-16">
          {/* Trang chủ */}
          <Link href="/"
            className="flex-1 flex flex-col items-center justify-center gap-0.5 text-on-dark-soft hover:text-on-dark transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span className="text-[9px] font-semibold leading-none">Chủ</span>
          </Link>

          {/* Nav items */}
          {NAV.map((item) => {
            const active = isActive(item.href);
            return (
              <Link key={item.href} href={item.href}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${
                  active ? "text-primary" : "text-on-dark-soft"
                }`}>
                {item.icon}
                <span className="text-[9px] font-semibold leading-none">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
