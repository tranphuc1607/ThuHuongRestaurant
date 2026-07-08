"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { getAuthHeaders } from "@/lib/auth";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api/v1";

const ROLE_STYLE: Record<string, string> = {
  ROLE_ADMIN:    "bg-purple-100 text-purple-700",
  ROLE_EMPLOYEE: "bg-blue-100 text-blue-700",
  ROLE_USER:     "bg-canvas text-gray-600",
};
const ROLE_LABELS: Record<string, string> = {
  ROLE_ADMIN: "Admin", ROLE_EMPLOYEE: "Nhân viên", ROLE_USER: "Người dùng",
};

interface User {
  id: number; username: string; fullName?: string; email?: string;
  phone?: string; role: string; enabled: boolean; createdAt?: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [toast, setToast] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let url: string;
      if (search.trim()) {
        url = `${BASE}/users/search?keyword=${encodeURIComponent(search)}&page=${page}&size=15`;
      } else {
        url = `${BASE}/users?page=${page}&size=15`;
      }
      const res = await fetch(url, { headers: getAuthHeaders() });
      const json = await res.json();
      if (json.statusCode === 200) {
        setUsers(json.data.content ?? []);
        setTotalPages(json.data.totalPages ?? 0);
      }
    } finally { setLoading(false); }
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(""), 3000); }

  async function patchUser(id: number, path: string, body: object, msg: string) {
    setActionLoading(id);
    try {
      const res = await fetch(`${BASE}/users/${id}/${path}`, {
        method: "PATCH", headers: getAuthHeaders(), body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.statusCode === 200) { showToast(msg); load(); }
      else showToast(json.message ?? "Thất bại");
    } finally { setActionLoading(null); }
  }

  async function toggleStatus(u: User) {
    await patchUser(u.id, "status", { enabled: !u.enabled },
      u.enabled ? "Đã vô hiệu hóa tài khoản" : "Đã kích hoạt tài khoản");
  }

  async function changeRole(u: User, newRole: string) {
    await patchUser(u.id, "role", { role: newRole }, `Đã đổi role → ${ROLE_LABELS[newRole]}`);
  }

  return (
    <div className="p-6">
      {toast && <div className="fixed top-4 right-4 bg-gray-800 text-white text-sm px-4 py-2.5 rounded shadow-lg z-50">{toast}</div>}

      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-ink">Quản lý Người dùng</h1>
          <p className="text-sm text-muted">Tài khoản hệ thống</p>
        </div>
        <Link href="/admin/nguoi-dung/moi" className="px-4 py-2 bg-primary text-white text-sm font-semibold rounded hover:bg-primary-dark">
          + Thêm tài khoản
        </Link>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); setPage(0); setSearch(searchInput); }} className="flex gap-2 mb-4">
        <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Tìm theo username, email, SĐT..."
          className="border border-hairline px-3 py-1.5 text-sm outline-none focus:border-primary rounded w-64" />
        <button type="submit" className="px-3 py-1.5 bg-canvas text-sm rounded hover:bg-surface-card">Tìm</button>
        {search && (
          <button type="button" onClick={() => { setSearch(""); setSearchInput(""); setPage(0); }}
            className="px-3 py-1.5 text-xs text-muted hover:text-ink">✕</button>
        )}
      </form>

      <div className="bg-canvas rounded-lg border border-hairline overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-soft border-b border-hairline text-xs text-muted uppercase">
                <th className="text-left px-4 py-3">Username</th>
                <th className="text-left px-4 py-3">Họ tên</th>
                <th className="text-left px-4 py-3">Liên hệ</th>
                <th className="text-center px-4 py-3">Role</th>
                <th className="text-center px-4 py-3">Trạng thái</th>
                <th className="text-center px-4 py-3">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {loading ? (
                <tr><td colSpan={6} className="text-center py-8 text-muted-soft">Đang tải...</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-muted-soft">Không có tài khoản nào</td></tr>
              ) : users.map((u) => (
                <tr key={u.id} className="hover:bg-surface-soft">
                  <td className="px-4 py-3 font-mono text-sm font-medium">{u.username}</td>
                  <td className="px-4 py-3 text-ink">{u.fullName ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="text-xs text-muted">{u.phone ?? u.email ?? "—"}</div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <select
                      value={u.role}
                      onChange={(e) => changeRole(u, e.target.value)}
                      disabled={actionLoading === u.id}
                      className={`text-xs font-semibold px-2 py-0.5 rounded border-0 outline-none cursor-pointer ${ROLE_STYLE[u.role] ?? "bg-canvas text-muted"}`}
                    >
                      <option value="ROLE_USER">Người dùng</option>
                      <option value="ROLE_EMPLOYEE">Nhân viên</option>
                      <option value="ROLE_ADMIN">Admin</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${u.enabled ? "bg-green-100 text-green-700" : "bg-red-100 text-red-500"}`}>
                      {u.enabled ? "Hoạt động" : "Đã khóa"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <Link href={`/admin/nguoi-dung/${u.id}`}
                        className="px-2 py-1 bg-canvas text-gray-600 text-xs rounded hover:bg-surface-card">
                        Chi tiết
                      </Link>
                      <button onClick={() => toggleStatus(u)} disabled={actionLoading === u.id}
                        className={`px-2 py-1 text-xs rounded disabled:opacity-50 ${u.enabled ? "bg-red-50 text-red-500 hover:bg-red-100" : "bg-green-50 text-green-600 hover:bg-green-100"}`}>
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
          <div className="flex items-center justify-center gap-2 p-4 border-t border-hairline">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              className="px-3 py-1 text-sm border rounded disabled:opacity-40 hover:bg-surface-soft">← Trước</button>
            <span className="text-sm text-gray-600">Trang {page + 1} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
              className="px-3 py-1 text-sm border rounded disabled:opacity-40 hover:bg-surface-soft">Tiếp →</button>
          </div>
        )}
      </div>
    </div>
  );
}
