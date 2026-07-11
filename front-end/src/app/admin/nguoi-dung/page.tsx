"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { getAuthHeaders } from "@/lib/auth";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api/v1";

const ROLE_STYLE: Record<string, string> = {
  ROLE_ADMIN:    "bg-purple-100 text-purple-700",
  ROLE_EMPLOYEE: "bg-blue-100   text-blue-700",
  ROLE_USER:     "bg-canvas     text-gray-600",
};
const ROLE_LABELS: Record<string, string> = {
  ROLE_ADMIN: "Admin", ROLE_EMPLOYEE: "Nhân viên", ROLE_USER: "Người dùng",
};
const ROLE_AVATAR: Record<string, string> = {
  ROLE_ADMIN:    "bg-purple-500",
  ROLE_EMPLOYEE: "bg-blue-500",
  ROLE_USER:     "bg-gray-400",
};

interface User {
  id: number; username: string; fullName?: string; email?: string;
  phone?: string; role: string; enabled: boolean; createdAt?: string;
}

function readNavState(): { page: number; scroll: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem("admin-users-nav");
    if (!raw) return null;
    sessionStorage.removeItem("admin-users-nav");
    return JSON.parse(raw);
  } catch { return null; }
}

export default function AdminUsersPage() {
  const [navRestored]           = useState(() => readNavState());
  const [page,       setPage]   = useState(navRestored?.page ?? 0);
  const pendingScroll            = useRef(navRestored?.scroll ?? 0);

  const [users,         setUsers]         = useState<User[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [totalPages,    setTotalPages]    = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [search,        setSearch]        = useState("");
  const [searchInput,   setSearchInput]   = useState("");
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [toast,         setToast]         = useState<{ msg: string; ok: boolean } | null>(null);
  const savedScroll = useRef(0);

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }

  function saveNavState() {
    try {
      const el = document.getElementById("admin-scroll-content");
      sessionStorage.setItem("admin-users-nav", JSON.stringify({
        page,
        scroll: el ? el.scrollTop : window.scrollY,
      }));
    } catch { /* ignore */ }
  }

  const load = useCallback(async (preserveScroll = false) => {
    if (preserveScroll) {
      const el = document.getElementById("admin-scroll-content");
      savedScroll.current = el ? el.scrollTop : window.scrollY;
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const url = search.trim()
        ? `${BASE}/users/search?keyword=${encodeURIComponent(search)}&page=${page}&size=15`
        : `${BASE}/users?page=${page}&size=15`;
      const res  = await fetch(url, { headers: getAuthHeaders() });
      const json = await res.json();
      if (json.statusCode === 200) {
        setUsers(json.data.content ?? []);
        setTotalPages(json.data.totalPages ?? 0);
        setTotalElements(json.data.totalElements ?? 0);
      }
    } catch { /* ignore */ }
    finally {
      setLoading(false);
      setRefreshing(false);
      if (pendingScroll.current > 0) {
        const scroll = pendingScroll.current;
        pendingScroll.current = 0;
        setTimeout(() => {
          const el = document.getElementById("admin-scroll-content");
          if (el) el.scrollTop = scroll;
          else window.scrollTo(0, scroll);
        }, 50);
      } else if (preserveScroll) {
        setTimeout(() => {
          const el = document.getElementById("admin-scroll-content");
          if (el) el.scrollTop = savedScroll.current;
          else window.scrollTo(0, savedScroll.current);
        }, 30);
      }
    }
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  async function patchUser(id: number, path: string, body: object, msg: string) {
    setActionLoading(id);
    try {
      const res  = await fetch(`${BASE}/users/${id}/${path}`, {
        method: "PATCH", headers: getAuthHeaders(), body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.statusCode === 200) { showToast(msg); load(true); }
      else showToast(json.message ?? "Thất bại", false);
    } finally { setActionLoading(null); }
  }

  function toggleStatus(u: User) {
    patchUser(u.id, "status", { enabled: !u.enabled },
      u.enabled ? "Đã khóa tài khoản" : "Đã kích hoạt tài khoản");
  }


  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(0);
    setSearch(searchInput);
  }

  // Avatar: 1-2 chữ đầu username
  function initials(u: User) {
    const name = u.fullName?.trim() || u.username;
    const parts = name.split(" ");
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }

  return (
    <div className="p-3 md:p-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-16 left-1/2 -translate-x-1/2 md:top-4 md:right-4 md:left-auto md:translate-x-0 z-50 text-sm px-4 py-2.5 rounded-xl shadow-lg text-white font-semibold whitespace-nowrap
          ${toast.ok ? "bg-gray-800" : "bg-red-500"}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-lg md:text-xl font-bold text-ink">Người dùng</h1>
          <p className="text-xs md:text-sm text-muted mt-0.5">
            {!loading && !refreshing && `${totalElements} tài khoản`}
          </p>
        </div>
        <Link href="/admin/nguoi-dung/moi"
          className="px-3 py-1.5 md:px-4 md:py-2 bg-primary text-white text-xs md:text-sm font-bold rounded-xl hover:bg-primary-dark transition-colors whitespace-nowrap touch-manipulation"
          style={{ WebkitTapHighlightColor: "transparent" }}>
          + Thêm
        </Link>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Tìm username, email, SĐT..."
            className="w-full border border-hairline pl-3 pr-8 py-2 text-sm rounded-xl outline-none focus:border-primary bg-white"
          />
          {searchInput && (
            <button type="button"
              onClick={() => { setSearch(""); setSearchInput(""); setPage(0); }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-soft hover:text-ink text-base leading-none">
              ×
            </button>
          )}
        </div>
        <button type="submit"
          className="px-4 py-2 bg-ink text-canvas text-sm font-semibold rounded-xl hover:bg-ink/80 transition-colors touch-manipulation"
          style={{ WebkitTapHighlightColor: "transparent" }}>
          Tìm
        </button>
      </form>

      {/* ── Mobile: Card list ── */}
      <div className="block md:hidden">
        {refreshing && (
          <div className="h-0.5 bg-hairline rounded-full overflow-hidden -mx-3 mb-3">
            <div className="h-full bg-primary rounded-full animate-pulse w-1/2 mx-auto" />
          </div>
        )}

        {loading && !refreshing ? (
          <div className="space-y-2.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-hairline p-4 flex gap-3 animate-pulse">
                <div className="w-11 h-11 rounded-full bg-surface-card flex-shrink-0" />
                <div className="flex-1 space-y-2 pt-1">
                  <div className="h-3.5 bg-surface-card rounded w-1/2" />
                  <div className="h-3 bg-surface-card rounded w-1/3" />
                  <div className="h-3 bg-surface-card rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : users.length === 0 ? (
          <div className="py-16 text-center text-muted-soft text-sm">
            {search ? `Không tìm thấy "${search}"` : "Không có tài khoản nào"}
          </div>
        ) : (
          <div className="space-y-2.5">
            {users.map(u => {
              const busy = actionLoading === u.id;
              return (
                <div key={u.id} className="bg-white rounded-2xl border border-hairline p-4">
                  {/* Row 1: Avatar + tên + role badge */}
                  <div className="flex items-center gap-3 mb-3">
                    {/* Avatar */}
                    <div className={`w-11 h-11 rounded-full flex-shrink-0 flex items-center justify-center text-white text-sm font-bold ${ROLE_AVATAR[u.role] ?? "bg-gray-400"}`}>
                      {initials(u)}
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-ink font-mono truncate">{u.username}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0 ${ROLE_STYLE[u.role] ?? "bg-canvas text-muted"}`}>
                          {ROLE_LABELS[u.role] ?? u.role}
                        </span>
                      </div>
                      {u.fullName && <p className="text-xs text-muted mt-0.5 truncate">{u.fullName}</p>}
                      {(u.phone || u.email) && (
                        <p className="text-xs text-muted-soft mt-0.5 truncate">
                          {u.phone ?? u.email}
                        </p>
                      )}
                    </div>
                    {/* Status badge */}
                    <span className={`flex-shrink-0 w-2 h-2 rounded-full ${u.enabled ? "bg-green-500" : "bg-red-400"}`} />
                  </div>

                  {/* Row 2: Actions */}
                  <div className="flex items-center gap-2 pt-3 border-t border-hairline">
                    <span className={`flex-1 text-xs font-semibold px-2 py-1.5 rounded-xl text-center ${ROLE_STYLE[u.role] ?? "bg-canvas text-muted"}`}>
                      {ROLE_LABELS[u.role] ?? u.role}
                    </span>

                    {/* Toggle status */}
                    <button
                      onClick={() => toggleStatus(u)}
                      disabled={busy}
                      onPointerDown={e => { if (e.pointerType === "touch") { e.preventDefault(); toggleStatus(u); } }}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-xl disabled:opacity-50 transition-colors touch-manipulation flex-shrink-0 ${
                        u.enabled
                          ? "bg-red-50 text-red-500"
                          : "bg-green-50 text-green-600"
                      }`}
                      style={{ WebkitTapHighlightColor: "transparent" }}>
                      {busy ? "..." : u.enabled ? "Khóa" : "Mở"}
                    </button>

                    {/* Chi tiết */}
                    <Link
                      href={`/admin/nguoi-dung/${u.id}`}
                      onClick={saveNavState}
                      className="px-3 py-1.5 text-xs font-semibold bg-surface-card text-ink rounded-xl touch-manipulation flex-shrink-0"
                      style={{ WebkitTapHighlightColor: "transparent" }}>
                      Chi tiết →
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination mobile */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 pt-4 pb-4">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              className="px-5 py-2.5 text-sm border border-hairline rounded-xl disabled:opacity-40 bg-white touch-manipulation"
              style={{ WebkitTapHighlightColor: "transparent" }}>
              ←
            </button>
            <span className="text-sm text-muted">{page + 1} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
              className="px-5 py-2.5 text-sm border border-hairline rounded-xl disabled:opacity-40 bg-white touch-manipulation"
              style={{ WebkitTapHighlightColor: "transparent" }}>
              →
            </button>
          </div>
        )}
      </div>

      {/* ── Desktop: Table ── */}
      <div className={`hidden md:block bg-canvas rounded-xl border border-hairline overflow-hidden transition-opacity ${refreshing ? "opacity-70" : ""}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-soft border-b border-hairline text-xs text-muted uppercase tracking-wide">
                <th className="text-left px-4 py-3 font-semibold">Username</th>
                <th className="text-left px-4 py-3 font-semibold">Họ tên</th>
                <th className="text-left px-4 py-3 font-semibold">Liên hệ</th>
                <th className="text-center px-4 py-3 font-semibold">Role</th>
                <th className="text-center px-4 py-3 font-semibold">Trạng thái</th>
                <th className="text-center px-4 py-3 font-semibold">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {loading && !refreshing ? (
                <tr><td colSpan={6} className="text-center py-10 text-muted-soft animate-pulse">Đang tải...</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-10 text-muted-soft">
                  {search ? `Không tìm thấy "${search}"` : "Không có tài khoản nào"}
                </td></tr>
              ) : users.map(u => (
                <tr key={u.id} className="hover:bg-surface-soft">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${ROLE_AVATAR[u.role] ?? "bg-gray-400"}`}>
                        {initials(u)}
                      </div>
                      <span className="font-mono text-sm font-medium text-ink">{u.username}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-ink">{u.fullName ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-muted">{u.phone ?? u.email ?? "—"}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded ${ROLE_STYLE[u.role] ?? "bg-canvas text-muted"}`}>
                      {ROLE_LABELS[u.role] ?? u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${u.enabled ? "bg-green-100 text-green-700" : "bg-red-100 text-red-500"}`}>
                      {u.enabled ? "Hoạt động" : "Đã khóa"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1.5">
                      <Link href={`/admin/nguoi-dung/${u.id}`} onClick={saveNavState}
                        className="px-3 py-1 bg-canvas text-gray-600 text-xs font-semibold rounded-lg hover:bg-surface-card transition-colors">
                        Chi tiết
                      </Link>
                      <button onClick={() => toggleStatus(u)} disabled={actionLoading === u.id}
                        className={`px-3 py-1 text-xs font-semibold rounded-lg disabled:opacity-50 transition-colors ${
                          u.enabled ? "bg-red-50 text-red-500 hover:bg-red-100" : "bg-green-50 text-green-600 hover:bg-green-100"
                        }`}>
                        {u.enabled ? "Khóa" : "Mở"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 p-4 border-t border-hairline bg-surface-soft">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              className="px-3 py-1.5 text-sm border border-hairline rounded-lg disabled:opacity-40 hover:bg-canvas transition-colors">
              ← Trước
            </button>
            <span className="text-sm text-muted">Trang {page + 1} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
              className="px-3 py-1.5 text-sm border border-hairline rounded-lg disabled:opacity-40 hover:bg-canvas transition-colors">
              Tiếp →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
