"use client";
import { useState, useEffect, useCallback } from "react";
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

export default function AdminHRPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [toast, setToast] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(page), size: "15" });
      if (search.trim()) params.set("search", search.trim());
      const res = await fetch(`${BASE}/hr/employees?${params}`, { headers: getAuthHeaders() });
      const text = await res.text();
      if (!text) {
        setError("Máy chủ không trả về dữ liệu. Kiểm tra hr-service đang chạy và gateway đã có route /api/v1/hr/**.");
        return;
      }
      const json = JSON.parse(text);
      if (json.statusCode === 200) {
        setEmployees(json.data.content ?? []);
        setTotalPages(json.data.totalPages ?? 0);
      } else {
        setError(json.message ?? `Lỗi ${res.status}`);
      }
    } catch {
      setError("Không kết nối được máy chủ HR.");
    } finally { setLoading(false); }
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(""), 3000); }

  async function toggleActive(emp: Employee) {
    setActionLoading(emp.id);
    const endpoint = emp.active ? "deactivate" : "activate";
    try {
      const res = await fetch(`${BASE}/hr/employees/${emp.id}/${endpoint}`, { method: "PATCH", headers: getAuthHeaders() });
      const json = await res.json();
      if (json.statusCode === 200) { showToast(emp.active ? "Đã vô hiệu hóa" : "Đã kích hoạt"); load(); }
      else showToast(json.message ?? "Thất bại");
    } finally { setActionLoading(null); }
  }

  function formatSalary(emp: Employee) {
    return `${emp.baseValue.toLocaleString("vi-VN")}đ/${emp.salaryType === "HOURLY" ? "giờ" : "tháng"}${emp.salaryType === "FIXED" && emp.targetDays ? ` (${emp.targetDays} ngày)` : ""}`;
  }

  return (
    <div className="p-6">
      {toast && <div className="fixed top-4 right-4 bg-gray-800 text-white text-sm px-4 py-2.5 rounded shadow-lg z-50">{toast}</div>}

      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-ink">Nhân sự</h1>
          <p className="text-sm text-muted">Quản lý nhân viên nhà hàng</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/nhan-su/ca-lam" className="px-3 py-2 bg-canvas text-gray-600 text-sm rounded hover:bg-surface-card">Ca làm việc</Link>
          <Link href="/admin/nhan-su/phan-ca" className="px-3 py-2 bg-canvas text-gray-600 text-sm rounded hover:bg-surface-card">Xếp lịch</Link>
          <Link href="/admin/nhan-su/lich-lam" className="px-3 py-2 bg-canvas text-gray-600 text-sm rounded hover:bg-surface-card">Lịch làm</Link>
          <Link href="/admin/nhan-su/cham-cong" className="px-3 py-2 bg-canvas text-gray-600 text-sm rounded hover:bg-surface-card">Chấm công</Link>
          <Link href="/admin/nhan-su/luong" className="px-3 py-2 bg-canvas text-gray-600 text-sm rounded hover:bg-surface-card">Lương</Link>
          <Link href="/admin/nhan-su/moi" className="px-4 py-2 bg-primary text-white text-sm font-semibold rounded hover:bg-primary-dark">
            + Thêm NV
          </Link>
        </div>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); setPage(0); setSearch(searchInput); }} className="flex gap-2 mb-4">
        <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Tìm theo tên, SĐT..."
          className="border border-hairline px-3 py-1.5 text-sm outline-none focus:border-primary rounded w-60" />
        <button type="submit" className="px-3 py-1.5 bg-canvas text-sm rounded hover:bg-surface-card">Tìm</button>
        {search && <button type="button" onClick={() => { setSearch(""); setSearchInput(""); setPage(0); }}
          className="px-3 py-1.5 text-xs text-muted">✕</button>}
      </form>

      <div className="bg-canvas rounded-lg border border-hairline overflow-hidden">
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
              {loading ? (
                <tr><td colSpan={7} className="text-center py-8 text-muted-soft">Đang tải...</td></tr>
              ) : error ? (
                <tr><td colSpan={7} className="text-center py-8 text-red-500 text-sm">{error}</td></tr>
              ) : employees.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-muted-soft">Không có nhân viên nào</td></tr>
              ) : employees.map((emp) => (
                <tr key={emp.id} className="hover:bg-surface-soft">
                  <td className="px-4 py-3 font-medium text-ink">{emp.name}</td>
                  <td className="px-4 py-3 text-muted">{emp.phone ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="text-xs text-gray-600">{EMP_TYPE[emp.type] ?? emp.type}</div>
                    <div className="text-xs text-muted-soft">{SALARY_TYPE[emp.salaryType] ?? emp.salaryType}</div>
                  </td>
                  <td className="px-4 py-3 text-right font-medium">{formatSalary(emp)}</td>
                  <td className="px-4 py-3 text-center">
                    {emp.telegramId ? (
                      <span className="text-xs text-blue-500">✓ Linked</span>
                    ) : (
                      <span className="text-xs text-muted-soft">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${emp.active ? "bg-green-100 text-green-700" : "bg-canvas text-muted"}`}>
                      {emp.active ? "Đang làm" : "Nghỉ"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <Link href={`/admin/nhan-su/${emp.id}?edit=1`}
                        className="px-2 py-1 bg-blue-50 text-blue-600 text-xs rounded hover:bg-blue-100 font-medium">
                        Sửa
                      </Link>
                      <Link href={`/admin/nhan-su/${emp.id}`}
                        className="px-2 py-1 bg-canvas text-gray-600 text-xs rounded hover:bg-surface-card">
                        Chi tiết
                      </Link>
                      <button onClick={() => toggleActive(emp)} disabled={actionLoading === emp.id}
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
