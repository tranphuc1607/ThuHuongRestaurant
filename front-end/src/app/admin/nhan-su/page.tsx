"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { getAuthHeaders } from "@/lib/auth";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api/v1";

const EMP_TYPE: Record<string, string> = {
  FULL_TIME: "Toàn thời gian", PART_TIME: "Bán thời gian",
};
const SALARY_TYPE: Record<string, string> = {
  HOURLY: "Theo giờ", FIXED: "Tháng cố định",
};

interface Employee {
  id: number; name: string; phone?: string; type: string; salaryType: string;
  baseValue: number; targetDays?: number; active: boolean; telegramId?: number;
}

function initials(name: string) {
  const parts = name.trim().split(" ");
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function readNavState(): { page: number; scroll: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem("admin-nhansu-nav");
    if (!raw) return null;
    sessionStorage.removeItem("admin-nhansu-nav");
    return JSON.parse(raw);
  } catch { return null; }
}

export default function AdminHRPage() {
  const [navRestored] = useState(() => readNavState());
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const savedScroll = useRef(0);
  const pendingScroll = useRef(navRestored?.scroll ?? 0);
  const [error, setError] = useState("");
  const [page, setPage] = useState(navRestored?.page ?? 0);
  const [totalPages, setTotalPages] = useState(0);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [toast, setToast] = useState("");
  const [confirmEmp, setConfirmEmp] = useState<Employee | null>(null);

  const load = useCallback(async (preserveScroll = false) => {
    if (preserveScroll) {
      const el = document.getElementById("admin-scroll-content");
      savedScroll.current = el ? el.scrollTop : window.scrollY;
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError("");
    try {
      const params = new URLSearchParams({ page: String(page), size: "15" });
      if (search.trim()) params.set("search", search.trim());
      const res = await fetch(`${BASE}/hr/employees?${params}`, { headers: getAuthHeaders() });
      const text = await res.text();
      if (!text) { setError("Máy chủ không trả về dữ liệu."); return; }
      const json = JSON.parse(text);
      if (json.statusCode === 200) {
        setEmployees(json.data.content ?? []);
        setTotalPages(json.data.totalPages ?? 0);
      } else {
        setError(json.message ?? `Lỗi ${res.status}`);
      }
    } catch { setError("Không kết nối được máy chủ HR."); }
    finally {
      setLoading(false);
      setRefreshing(false);
      const scrollTarget = pendingScroll.current || (preserveScroll ? savedScroll.current : 0);
      if (scrollTarget > 0) {
        setTimeout(() => {
          const el = document.getElementById("admin-scroll-content");
          if (el) el.scrollTop = scrollTarget;
          else window.scrollTo(0, scrollTarget);
          pendingScroll.current = 0;
        }, 30);
      }
    }
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(""), 3000); }

  function saveNavState() {
    const el = document.getElementById("admin-scroll-content");
    const scroll = el ? el.scrollTop : window.scrollY;
    sessionStorage.setItem("admin-nhansu-nav", JSON.stringify({ page, scroll }));
  }

  function handleToggle(emp: Employee) {
    if (emp.active) { setConfirmEmp(emp); return; }
    doToggle(emp);
  }

  async function doToggle(emp: Employee) {
    setConfirmEmp(null);
    setActionLoading(emp.id);
    const endpoint = emp.active ? "deactivate" : "activate";
    try {
      const res = await fetch(`${BASE}/hr/employees/${emp.id}/${endpoint}`, { method: "PATCH", headers: getAuthHeaders() });
      const json = await res.json();
      if (json.statusCode === 200) { showToast(emp.active ? "Đã vô hiệu hóa" : "Đã kích hoạt"); load(true); }
      else showToast(json.message ?? "Thất bại");
    } finally { setActionLoading(null); }
  }

  function formatSalary(emp: Employee) {
    return `${emp.baseValue.toLocaleString("vi-VN")}đ/${emp.salaryType === "HOURLY" ? "giờ" : "tháng"}`;
  }

  const skeletonRows = Array.from({ length: 6 });

  const NAV_LINKS = [
    { href: "/admin/nhan-su/moi", label: "+ Thêm NV", className: "bg-primary text-white hover:bg-primary-dark" },
    { href: "/admin/nhan-su/ca-lam", label: "⏰ Ca làm", className: "bg-white border border-hairline text-ink hover:bg-surface-card" },
    { href: "/admin/nhan-su/phan-ca", label: "📅 Xếp lịch", className: "bg-white border border-hairline text-ink hover:bg-surface-card" },
    { href: "/admin/nhan-su/lich-lam", label: "🗓️ Lịch làm", className: "bg-white border border-hairline text-ink hover:bg-surface-card" },
    { href: "/admin/nhan-su/cham-cong", label: "✅ Chấm công", className: "bg-white border border-hairline text-ink hover:bg-surface-card" },
    { href: "/admin/nhan-su/luong", label: "💰 Bảng lương", className: "bg-white border border-hairline text-ink hover:bg-surface-card" },
  ];

  return (
    <div className="p-3 md:p-6">
      {toast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 md:top-4 md:right-4 md:left-auto md:translate-x-0 bg-gray-800 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg z-50 whitespace-nowrap">
          {toast}
        </div>
      )}
      {refreshing && (
        <div className="fixed top-0 left-0 right-0 h-0.5 bg-primary/20 z-40">
          <div className="h-0.5 bg-primary animate-pulse w-2/3" />
        </div>
      )}

      {/* Header */}
      <div className="mb-4">
        <h1 className="text-lg md:text-xl font-bold text-ink">Nhân sự</h1>
        <p className="text-xs md:text-sm text-muted mt-0.5">Quản lý nhân viên nhà hàng</p>
      </div>

      {/* Quick nav — horizontal scroll */}
      <div className="overflow-x-auto -mx-3 px-3 md:mx-0 md:px-0 mb-4">
        <div className="flex gap-2 min-w-max">
          {NAV_LINKS.map(l => (
            <Link key={l.href} href={l.href}
              className={`px-4 py-2 text-sm font-semibold rounded-xl transition-colors touch-manipulation whitespace-nowrap ${l.className}`}
              style={{ WebkitTapHighlightColor: "transparent" }}>
              {l.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Search */}
      <form onSubmit={(e) => { e.preventDefault(); setPage(0); setSearch(searchInput); }} className="flex gap-2 mb-4">
        <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Tìm theo tên, SĐT..."
          className="flex-1 border border-hairline px-3 py-2 text-sm outline-none focus:border-primary rounded-xl" />
        <button type="submit"
          className="px-4 py-2 bg-surface-card text-sm font-semibold rounded-xl hover:bg-hairline border border-hairline touch-manipulation"
          style={{ WebkitTapHighlightColor: "transparent" }}>
          Tìm
        </button>
        {search && (
          <button type="button" onClick={() => { setSearch(""); setSearchInput(""); setPage(0); }}
            className="px-3 py-2 text-xs text-muted-soft hover:text-ink touch-manipulation"
            style={{ WebkitTapHighlightColor: "transparent" }}>✕</button>
        )}
      </form>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl mb-4">{error}</div>
      )}

      {/* ── MOBILE CARD LIST ── */}
      <div className="block md:hidden">
        {loading && !refreshing ? (
          <div className="space-y-2">
            {skeletonRows.map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-hairline p-4 animate-pulse">
                <div className="flex gap-3 items-center">
                  <div className="w-10 h-10 bg-gray-200 rounded-full shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-1/2" />
                    <div className="h-3 bg-gray-100 rounded w-2/3" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : employees.length === 0 && !error ? (
          <div className="bg-white rounded-2xl border border-hairline p-10 text-center text-muted-soft text-sm">
            Không có nhân viên nào
          </div>
        ) : (
          <div className={`space-y-2 ${refreshing ? "opacity-60" : ""} transition-opacity`}>
            {employees.map((emp) => (
              <div key={emp.id} className="bg-white rounded-2xl border border-hairline p-4">
                {/* Row 1: avatar + name + status */}
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 ${emp.active ? "bg-green-500" : "bg-gray-400"}`}>
                    {initials(emp.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-ink text-sm truncate">{emp.name}</span>
                      <span className={`shrink-0 w-2 h-2 rounded-full ${emp.active ? "bg-green-500" : "bg-gray-300"}`} />
                    </div>
                    <div className="text-xs text-muted mt-0.5">
                      {EMP_TYPE[emp.type] ?? emp.type}
                      {emp.phone && <span className="ml-2 text-muted-soft">{emp.phone}</span>}
                    </div>
                  </div>
                  {emp.telegramId && (
                    <span className="shrink-0 text-xs bg-blue-50 text-blue-500 px-2 py-0.5 rounded-full">Telegram ✓</span>
                  )}
                </div>

                {/* Row 2: salary */}
                <div className="mt-3 flex items-center justify-between text-xs">
                  <div className="text-muted">
                    <span className="text-muted-soft">{SALARY_TYPE[emp.salaryType] ?? emp.salaryType}: </span>
                    <span className="font-semibold text-ink">{formatSalary(emp)}</span>
                    {emp.salaryType === "FIXED" && emp.targetDays && (
                      <span className="text-muted-soft ml-1">({emp.targetDays} ngày)</span>
                    )}
                  </div>
                  <span className={`px-2 py-0.5 rounded-full font-semibold ${emp.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"}`}>
                    {emp.active ? "Đang làm" : "Nghỉ"}
                  </span>
                </div>

                {/* Row 3: actions */}
                <div className="flex gap-2 mt-3 pt-3 border-t border-hairline">
                  <Link href={`/admin/nhan-su/${emp.id}?edit=1`}
                    onClick={saveNavState}
                    className="flex-1 py-2 text-center bg-blue-50 text-blue-600 text-xs font-semibold rounded-xl hover:bg-blue-100 touch-manipulation"
                    style={{ WebkitTapHighlightColor: "transparent" }}>
                    ✏️ Sửa
                  </Link>
                  <Link href={`/admin/nhan-su/${emp.id}`}
                    onClick={saveNavState}
                    className="flex-1 py-2 text-center bg-surface-card text-ink text-xs font-semibold rounded-xl hover:bg-hairline touch-manipulation"
                    style={{ WebkitTapHighlightColor: "transparent" }}>
                    Chi tiết →
                  </Link>
                  <button
                    onPointerDown={e => { if (e.pointerType === "touch") { e.preventDefault(); handleToggle(emp); } }}
                    onClick={() => handleToggle(emp)}
                    disabled={actionLoading === emp.id}
                    className={`flex-1 py-2 text-xs font-semibold rounded-xl disabled:opacity-50 touch-manipulation ${emp.active ? "bg-red-50 text-red-500 hover:bg-red-100" : "bg-green-50 text-green-600 hover:bg-green-100"}`}
                    style={{ WebkitTapHighlightColor: "transparent" }}>
                    {actionLoading === emp.id ? "..." : emp.active ? "Vô hiệu" : "Kích hoạt"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Mobile pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 pt-4">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              className="w-10 h-10 flex items-center justify-center rounded-xl border border-hairline disabled:opacity-40 hover:bg-surface-soft touch-manipulation text-sm"
              style={{ WebkitTapHighlightColor: "transparent" }}>←</button>
            <span className="text-sm text-muted">{page + 1} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
              className="w-10 h-10 flex items-center justify-center rounded-xl border border-hairline disabled:opacity-40 hover:bg-surface-soft touch-manipulation text-sm"
              style={{ WebkitTapHighlightColor: "transparent" }}>→</button>
          </div>
        )}
      </div>

      {/* ── CONFIRM DEACTIVATE MODAL ── */}
      {confirmEmp && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50" onClick={() => setConfirmEmp(null)}>
          <div className="bg-white w-full sm:max-w-sm sm:mx-4 sm:rounded-2xl rounded-t-2xl px-5 pb-6 pt-3" onClick={e => e.stopPropagation()}>
            <div className="flex justify-center pb-3 sm:hidden"><div className="w-10 h-1 bg-gray-300 rounded-full" /></div>
            <div className="text-center mb-5">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-2xl mx-auto mb-3">⚠️</div>
              <h2 className="font-bold text-ink text-base">Vô hiệu hóa nhân viên?</h2>
              <p className="text-sm text-muted mt-1.5">
                <span className="font-semibold text-ink">{confirmEmp.name}</span> sẽ không thể đăng nhập và không xuất hiện trong lịch làm.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onPointerDown={e => { if (e.pointerType === "touch") { e.preventDefault(); doToggle(confirmEmp); } }}
                onClick={() => doToggle(confirmEmp)}
                className="flex-1 py-3 bg-red-500 text-white text-sm font-bold rounded-xl hover:bg-red-600 touch-manipulation"
                style={{ WebkitTapHighlightColor: "transparent" }}>
                Vô hiệu hóa
              </button>
              <button onClick={() => setConfirmEmp(null)}
                className="flex-1 py-3 bg-surface-card text-gray-600 text-sm font-semibold rounded-xl hover:bg-hairline touch-manipulation"
                style={{ WebkitTapHighlightColor: "transparent" }}>Hủy</button>
            </div>
          </div>
        </div>
      )}

      {/* ── DESKTOP TABLE ── */}
      <div className={`hidden md:block bg-canvas rounded-lg border border-hairline overflow-hidden ${refreshing ? "opacity-70" : ""}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-soft border-b border-hairline text-xs text-muted uppercase">
                <th className="text-left px-4 py-3">Tên nhân viên</th>
                <th className="text-left px-4 py-3">Điện thoại</th>
                <th className="text-left px-4 py-3">Loại</th>
                <th className="text-right px-4 py-3">Lương cơ bản</th>
                <th className="text-center px-4 py-3">Telegram</th>
                <th className="text-center px-4 py-3">Trạng thái</th>
                <th className="text-center px-4 py-3">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {loading && !refreshing ? (
                <tr><td colSpan={7} className="text-center py-8 text-muted-soft">Đang tải...</td></tr>
              ) : error ? (
                <tr><td colSpan={7} className="text-center py-8 text-red-500 text-sm">{error}</td></tr>
              ) : employees.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-muted-soft">Không có nhân viên nào</td></tr>
              ) : employees.map((emp) => (
                <tr key={emp.id} className="hover:bg-surface-soft">
                  <td className="px-4 py-3 font-medium text-ink">
                    <div className="flex items-center gap-2">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-xs ${emp.active ? "bg-green-500" : "bg-gray-400"}`}>
                        {initials(emp.name)}
                      </div>
                      {emp.name}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted">{emp.phone ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="text-xs text-gray-600">{EMP_TYPE[emp.type] ?? emp.type}</div>
                    <div className="text-xs text-muted-soft">{SALARY_TYPE[emp.salaryType] ?? emp.salaryType}</div>
                  </td>
                  <td className="px-4 py-3 text-right font-medium">{formatSalary(emp)}</td>
                  <td className="px-4 py-3 text-center">
                    {emp.telegramId ? <span className="text-xs text-blue-500">✓ Linked</span> : <span className="text-xs text-muted-soft">—</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${emp.active ? "bg-green-100 text-green-700" : "bg-canvas text-muted"}`}>
                      {emp.active ? "Đang làm" : "Nghỉ"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <Link href={`/admin/nhan-su/${emp.id}?edit=1`} onClick={saveNavState}
                        className="px-2 py-1 bg-blue-50 text-blue-600 text-xs rounded hover:bg-blue-100 font-medium">Sửa</Link>
                      <Link href={`/admin/nhan-su/${emp.id}`} onClick={saveNavState}
                        className="px-2 py-1 bg-canvas text-gray-600 text-xs rounded hover:bg-surface-card">Chi tiết</Link>
                      <button onClick={() => handleToggle(emp)} disabled={actionLoading === emp.id}
                        className={`px-2 py-1 text-xs rounded disabled:opacity-50 ${emp.active ? "bg-red-50 text-red-500 hover:bg-red-100" : "bg-green-50 text-green-600 hover:bg-green-100"}`}>
                        {emp.active ? "Vô hiệu" : "Kích hoạt"}
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
