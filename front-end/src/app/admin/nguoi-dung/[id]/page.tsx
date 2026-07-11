"use client";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getAuthHeaders } from "@/lib/auth";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api/v1";

const ROLE_STYLE: Record<string, string> = {
  ROLE_ADMIN: "bg-purple-100 text-purple-700", ROLE_EMPLOYEE: "bg-blue-100 text-blue-700", ROLE_USER: "bg-canvas text-gray-600",
};

interface User { id: number; username: string; fullName?: string; email?: string; phone?: string; role: string; enabled: boolean; createdAt?: string; }
interface HrEmployee { id: number; name: string; active: boolean; }

export default function UserDetailPage() {
  const { id } = useParams();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState({ msg: "", ok: true });
  const [hrEmployee, setHrEmployee] = useState<HrEmployee | null | "none">(null);

  async function loadHrEmployee(userId: number, role: string) {
    if (role !== "ROLE_EMPLOYEE" && role !== "ROLE_ADMIN") { setHrEmployee(null); return; }
    try {
      const res = await fetch(`${BASE}/hr/employees/by-user/${userId}`, { headers: getAuthHeaders() });
      const json = await res.json();
      setHrEmployee(json.statusCode === 200 ? json.data : "none");
    } catch { setHrEmployee("none"); }
  }

  async function load() {
    const res = await fetch(`${BASE}/users/${id}`, { headers: getAuthHeaders() });
    const json = await res.json();
    if (json.statusCode === 200) {
      setUser(json.data);
      loadHrEmployee(json.data.id, json.data.role);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  function showToast(msg: string, ok = true) { setToast({ msg, ok }); setTimeout(() => setToast({ msg: "", ok: true }), 3000); }

  async function patchUser(path: string, body: object, msg: string) {
    setActionLoading(true);
    try {
      const res = await fetch(`${BASE}/users/${id}/${path}`, { method: "PATCH", headers: getAuthHeaders(), body: JSON.stringify(body) });
      const json = await res.json();
      if (json.statusCode === 200) { showToast(msg); load(); }
      else showToast(json.message ?? "Thất bại", false);
    } finally { setActionLoading(false); }
  }

  if (loading) return <div className="p-8 text-muted">Đang tải...</div>;
  if (!user) return <div className="p-8 text-red-500">Không tìm thấy người dùng</div>;

  return (
    <div className="p-6 max-w-lg">
      {toast.msg && (
        <div className={`fixed top-4 right-4 text-sm px-4 py-2.5 rounded shadow-lg z-50 ${toast.ok ? "bg-gray-800 text-white" : "bg-red-500 text-white"}`}>
          {toast.msg}
        </div>
      )}

      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/nguoi-dung" className="text-muted-soft hover:text-gray-600 text-sm">← Người dùng</Link>
        <span className="text-gray-300">/</span>
        <span className="font-mono font-semibold">{user.username}</span>
      </div>

      <div className="bg-canvas rounded-lg border border-hairline-sm p-6 space-y-6">
        <div>
          <h2 className="text-xs font-bold text-muted uppercase tracking-wide mb-3">Thông tin tài khoản</h2>
          <dl className="space-y-2.5 text-sm">
            <div className="flex justify-between"><dt className="text-muted">Username</dt><dd className="font-mono font-medium">{user.username}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Họ tên</dt><dd>{user.fullName ?? "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Email</dt><dd>{user.email ?? "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">SĐT</dt><dd>{user.phone ?? "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Ngày tạo</dt>
              <dd>{user.createdAt ? new Date(user.createdAt).toLocaleDateString("vi-VN") : "—"}</dd>
            </div>
          </dl>
        </div>

        <div>
          <h2 className="text-xs font-bold text-muted uppercase tracking-wide mb-2">Phân quyền</h2>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${ROLE_STYLE[user.role] ?? "bg-canvas text-muted"}`}>{user.role}</span>
        </div>

        <div>
          <h2 className="text-xs font-bold text-muted uppercase tracking-wide mb-3">Trạng thái</h2>
          <div className="flex items-center gap-4">
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${user.enabled ? "bg-green-100 text-green-700" : "bg-red-100 text-red-500"}`}>
              {user.enabled ? "Đang hoạt động" : "Đã khóa"}
            </span>
            <button onClick={() => patchUser("status", { enabled: !user.enabled }, user.enabled ? "Đã khóa tài khoản" : "Đã mở khóa tài khoản")}
              disabled={actionLoading}
              className={`px-4 py-2 text-sm font-semibold rounded disabled:opacity-50 ${user.enabled ? "bg-red-50 text-red-500 hover:bg-red-100 border border-red-200" : "bg-green-50 text-green-600 hover:bg-green-100 border border-green-200"}`}>
              {user.enabled ? "Khóa tài khoản" : "Mở khóa"}
            </button>
          </div>
        </div>

        {(user.role === "ROLE_EMPLOYEE" || user.role === "ROLE_ADMIN") && (
          <div>
            <h2 className="text-xs font-bold text-muted uppercase tracking-wide mb-3">Hồ sơ nhân viên HR</h2>
            {hrEmployee === null ? (
              <div className="text-xs text-muted-soft">Đang kiểm tra...</div>
            ) : hrEmployee !== "none" ? (
              <div className="bg-green-50 border border-green-200 rounded p-3 flex items-center justify-between">
                <div className="text-sm text-green-800">
                  Đã có hồ sơ: <span className="font-semibold">{hrEmployee.name}</span>
                  {!hrEmployee.active && <span className="ml-2 text-xs text-muted">(Không hoạt động)</span>}
                </div>
                <Link href={`/admin/nhan-su/${hrEmployee.id}`}
                  className="px-3 py-1 bg-green-600 text-white text-xs font-semibold rounded hover:bg-green-700">
                  Xem HR
                </Link>
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded p-3 flex items-center justify-between gap-4">
                <p className="text-sm text-amber-800">Chưa có hồ sơ nhân viên HR (ca làm, chấm công, lương).</p>
                <Link
                  href={`/admin/nhan-su/moi?name=${encodeURIComponent(user.fullName ?? user.username)}&phone=${encodeURIComponent(user.phone ?? "")}`}
                  className="px-3 py-1.5 bg-amber-600 text-white text-xs font-semibold rounded hover:bg-amber-700 whitespace-nowrap flex-shrink-0"
                >
                  Tạo hồ sơ HR
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}