"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export default function AccountDropdown() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  function handleLogout() {
    logout();
    setOpen(false);
    router.push("/");
    router.refresh();
  }

  const isLoggedIn = !loading && !!user;

  const GUEST_ITEMS = [
    {
      href: "/tai-khoan/dang-nhap",
      label: "Đăng nhập",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
            d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
        </svg>
      ),
    },
    {
      href: "/tai-khoan/dang-ky",
      label: "Đăng ký",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
            d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
        </svg>
      ),
    },
  ];

  const AUTH_ITEMS = [
    {
      href: "/tai-khoan",
      label: "Tài khoản của tôi",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
    },
    {
      href: "/dat-ban/lich-su",
      label: "Lịch sử đặt bàn",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      ),
    },
  ];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 hover:underline focus:outline-none"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
        {loading ? "..." : isLoggedIn ? (user?.fullName?.split(" ").pop() ?? user?.username) : "Tài khoản"}
        <span
          className="inline-block transition-transform duration-200"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          ▾
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-canvas text-ink shadow-xl border border-hairline z-[200]">
          {/* Header dropdown */}
          <div className="px-4 py-2.5 border-b border-hairline bg-surface-soft">
            {isLoggedIn ? (
              <div>
                <p className="text-xs font-semibold text-ink truncate">
                  {user?.fullName ?? user?.username}
                </p>
                <p className="text-[10px] text-muted-soft truncate">{user?.username}</p>
              </div>
            ) : (
              <p className="text-[10px] uppercase tracking-widest text-muted-soft font-semibold">
                Tài khoản
              </p>
            )}
          </div>

          <ul className="py-1">
            {(isLoggedIn ? AUTH_ITEMS : GUEST_ITEMS).map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-xs text-gray-600 hover:bg-primary/5 hover:text-primary transition-colors"
                >
                  <span className="text-muted-soft">{item.icon}</span>
                  {item.label}
                </Link>
              </li>
            ))}

            {isLoggedIn && (user?.role === "ROLE_ADMIN" || user?.role === "ROLE_EMPLOYEE") && (
              <>
                <li className="border-t border-hairline my-1" />
                {user?.role === "ROLE_ADMIN" && (
                  <li>
                    <Link href="/admin/dashboard" onClick={() => setOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-xs text-purple-600 hover:bg-purple-50 transition-colors font-semibold">
                      <span>🛠</span> Trang quản trị
                    </Link>
                  </li>
                )}
                {(user?.role === "ROLE_EMPLOYEE" || user?.role === "ROLE_ADMIN") && (
                  <li>
                    <Link href="/employee/ban" onClick={() => setOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-xs text-green-700 hover:bg-green-50 transition-colors font-semibold">
                      <span>🪑</span> Trang nhân viên
                    </Link>
                  </li>
                )}
              </>
            )}

            {isLoggedIn && (
              <>
                <li className="border-t border-hairline my-1" />
                <li>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Đăng xuất
                  </button>
                </li>
              </>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
