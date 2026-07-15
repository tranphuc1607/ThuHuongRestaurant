"use client";
import Link from "next/link";
import { LogoMark } from "@/components/layout/Logo";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect, useRef } from "react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  exact?: boolean;
}

const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: "Tổng quan",
    items: [
      {
        href: "/admin/dashboard", label: "Dashboard",
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <rect x="3" y="3" width="7" height="7" rx="1" strokeWidth="1.8" />
            <rect x="14" y="3" width="7" height="7" rx="1" strokeWidth="1.8" />
            <rect x="3" y="14" width="7" height="7" rx="1" strokeWidth="1.8" />
            <rect x="14" y="14" width="7" height="7" rx="1" strokeWidth="1.8" />
          </svg>
        ),
      },
    ],
  },
  {
    group: "Vận hành",
    items: [
      {
        href: "/admin/dat-ban", label: "Đặt bàn",
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        ),
      },
      {
        href: "/admin/don-hang", label: "Đơn hàng",
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
        ),
      },
      {
        href: "/admin/ban", label: "Quản lý bàn",
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
              d="M3 10h18M3 14h18M10 6v12M14 6v12M5 6h14a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2z" />
          </svg>
        ),
      },
      {
        href: "/admin/thanh-toan", label: "Thanh toán",
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <rect x="1" y="4" width="22" height="16" rx="2" ry="2" strokeWidth="1.8" />
            <line x1="1" y1="10" x2="23" y2="10" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        ),
      },
    ],
  },
  {
    group: "Quản lý",
    items: [
      {
        href: "/admin/san-pham", label: "Sản phẩm",
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
              d="M4 6h16M4 10h16M4 14h16M4 18h16" />
          </svg>
        ),
      },
      {
        href: "/admin/nguoi-dung", label: "Người dùng",
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
              d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zm11 5v-1a3 3 0 00-3-3h-1" />
          </svg>
        ),
      },
    ],
  },
  {
    group: "Kho & Nhân sự",
    items: [
      {
        href: "/admin/kho", label: "Kho nguyên liệu",
        exact: true,
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
              d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
          </svg>
        ),
      },
      {
        href: "/admin/kho/quy-doi", label: "Quy đổi đơn vị",
        exact: true,
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
              d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
        ),
      },
      {
        href: "/admin/kho/cong-thuc", label: "Công thức",
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        ),
      },
      {
        href: "/admin/nhan-su", label: "Nhân sự",
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        ),
      },
      {
        href: "/admin/cham-cong", label: "Chấm công",
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="8" r="3.5" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            <path strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
              d="M4.5 20.5C4.5 17.186 7.686 14.5 12 14.5s7.5 2.686 7.5 6" />
            <path strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
              d="M16 5l1.5 1.5L21 3" />
          </svg>
        ),
      },
    ],
  },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close drawer on route change
  useEffect(() => { setDrawerOpen(false); setUserMenuOpen(false); }, [pathname]);

  // Prevent body scroll when drawer open
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [drawerOpen]);

  // Close user menu when clicking outside
  useEffect(() => {
    if (!userMenuOpen) return;
    function handler(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [userMenuOpen]);

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
  }

  function handleLogout() {
    logout();
    router.push("/tai-khoan/dang-nhap");
  }

  const initials = ((user?.fullName ?? user?.username) ?? "AD").slice(0, 2).toUpperCase();

  const navContent = (
    <>
      {/* Logo + close */}
      <div className="px-4 pt-4 pb-3 border-b border-white/10">
        <div className="flex items-center justify-between mb-3">
          <Link href="/admin/dashboard" className="flex items-center gap-2">
            <LogoMark onDark size="sm" />
            <span className="text-[10px] text-on-dark-soft font-semibold uppercase tracking-widest">Admin</span>
          </Link>
          <button
            className="lg:hidden w-7 h-7 flex items-center justify-center rounded-lg text-on-dark-soft hover:text-on-dark hover:bg-white/10 transition-colors touch-manipulation"
            onClick={() => setDrawerOpen(false)}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div className="flex items-center gap-2 px-1">
          <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center flex-shrink-0">
            <span className="text-primary text-[10px] font-bold">{initials}</span>
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-on-dark truncate">{user?.fullName ?? user?.username}</div>
            <div className="text-[10px] text-primary font-medium">{user?.role?.replace("ROLE_", "")}</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 min-h-0 overflow-y-auto py-3 px-3 space-y-3">
        {NAV.map((section) => (
          <div key={section.group}>
            <div className="px-3 mb-1 text-[10px] font-semibold text-on-dark-soft uppercase tracking-[1.5px]">
              {section.group}
            </div>
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
                    isActive(item.href, item.exact)
                      ? "bg-primary/20 text-primary font-semibold"
                      : "text-on-dark-soft hover:bg-white/7 hover:text-on-dark"
                  }`}
                >
                  <span className={isActive(item.href, item.exact) ? "text-primary" : "text-on-dark-soft"}>
                    {item.icon}
                  </span>
                  {item.label}
                  {isActive(item.href, item.exact) && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />
                  )}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom actions */}
      <div className="border-t border-white/10 p-2 space-y-0.5">
        <Link
          href="/"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-on-dark-soft hover:text-on-dark hover:bg-white/7 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          Trang khách hàng
        </Link>
        <Link
          href="/employee/ban"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-on-dark-soft hover:text-on-dark hover:bg-white/7 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          Trang nhân viên
        </Link>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-red-400 hover:text-red-300 hover:bg-white/7 transition-colors text-left"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Đăng xuất
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* ── Mobile top bar ── */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-surface-dark border-b border-white/10 flex items-center px-4 gap-3">
        {/* Hamburger */}
        <button
          onClick={() => setDrawerOpen(true)}
          className="w-9 h-9 flex items-center justify-center rounded-lg text-on-dark-soft hover:text-on-dark hover:bg-white/10 transition-colors touch-manipulation"
          aria-label="Mở menu"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/>
          </svg>
        </button>

        {/* Logo */}
        <Link href="/admin/dashboard" className="flex items-center gap-2 flex-1 min-w-0">
          <LogoMark onDark size="sm" />
          <span className="text-[10px] text-on-dark-soft font-semibold uppercase tracking-widest truncate">Admin</span>
        </Link>

        {/* Avatar → dropdown (logout + homepage) */}
        <div className="relative flex-shrink-0" ref={userMenuRef}>
          <button
            onClick={() => setUserMenuOpen(v => !v)}
            className="w-8 h-8 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center touch-manipulation"
            aria-label="Menu người dùng"
          >
            <span className="text-primary text-xs font-bold">{initials}</span>
          </button>

          {userMenuOpen && (
            <div className="absolute right-0 top-10 bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 w-48 z-50">
              {/* User info */}
              <div className="px-4 py-2.5 border-b border-gray-100">
                <div className="text-xs font-semibold text-gray-800 truncate">{user?.fullName ?? user?.username}</div>
                <div className="text-[10px] text-primary font-medium mt-0.5">{user?.role?.replace("ROLE_", "")}</div>
              </div>
              {/* Homepage */}
              <Link
                href="/"
                className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                    d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                Trang khách hàng
              </Link>
              {/* Employee portal */}
              <Link
                href="/employee/ban"
                className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Trang nhân viên
              </Link>
              {/* Logout */}
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-4 py-3 text-sm text-red-500 hover:bg-red-50 w-full text-left transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Đăng xuất
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Mobile backdrop ── */}
      {drawerOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/60"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* ── Sidebar (desktop: static / mobile: slide-in drawer) ── */}
      <aside
        className={[
          "fixed lg:static inset-y-0 left-0 z-50",
          "w-60 min-h-screen bg-surface-dark text-on-dark flex flex-col flex-shrink-0",
          "transition-transform duration-300 ease-in-out lg:transition-none",
          drawerOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        ].join(" ")}
      >
        {navContent}
      </aside>
    </>
  );
}
