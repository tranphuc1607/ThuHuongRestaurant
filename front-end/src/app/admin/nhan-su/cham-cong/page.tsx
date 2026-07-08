"use client";
import { useState, useEffect, useCallback } from "react";
import { getAuthHeaders } from "@/lib/auth";
import { extractApiError } from "@/lib/utils";
import Link from "next/link";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api/v1";

interface AttendanceRecord {
  id: number; employeeId: number; employeeName: string;
  shiftName: string; workDate: string;
  checkInTime?: string; checkOutTime?: string;
  totalHours?: number; lateMinutes?: number;
  punished: boolean; punishmentAmount?: number; punishmentReason?: string;
}
interface Employee { id: number; name: string; }

type Modal = { type: "edit"; record: AttendanceRecord } | { type: "punish"; record: AttendanceRecord } | null;

export default function AttendancePage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [employeeFilter, setEmployeeFilter] = useState("");
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [modal, setModal] = useState<Modal>(null);
  const [toast, setToast] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");

  // Edit form state
  const [editField, setEditField] = useState<"checkInTime" | "checkOutTime">("checkInTime");
  const [editTime, setEditTime] = useState("");
  const [editReason, setEditReason] = useState("");

  // Punish form state
  const [punishAmount, setPunishAmount] = useState("");
  const [punishReason, setPunishReason] = useState("");

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(""), 3000); }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ month: String(month), year: String(year), page: String(page), size: "30" });
      if (employeeFilter) params.set("employeeId", employeeFilter);
      const res = await fetch(`${BASE}/hr/attendance?${params}`, { headers: getAuthHeaders() });
      const text = await res.text();
      if (!text) return;
      const json = JSON.parse(text);
      if (json.statusCode === 200) {
        setRecords(json.data.content ?? []);
        setTotalPages(json.data.totalPages ?? 0);
      }
    } finally { setLoading(false); }
  }, [month, year, page, employeeFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    fetch(`${BASE}/hr/employees?page=0&size=100`, { headers: getAuthHeaders() })
      .then(r => r.json()).then(json => { if (json.statusCode === 200) setEmployees(json.data.content ?? []); });
  }, []);

  function fmtTime(iso?: string) {
    if (!iso) return "—";
    return new Date(iso).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  }

  function openEdit(r: AttendanceRecord) {
    setModal({ type: "edit", record: r });
    setEditField("checkInTime"); setEditTime(""); setEditReason(""); setActionError("");
  }
  function openPunish(r: AttendanceRecord) {
    setModal({ type: "punish", record: r });
    setPunishAmount(""); setPunishReason(""); setActionError("");
  }

  async function submitEdit(e: React.FormEvent) {
    e.preventDefault();
    if (modal?.type !== "edit") return;
    if (!editTime) return setActionError("Vui lòng nhập thời gian mới");
    if (!editReason.trim()) return setActionError("Vui lòng nhập lý do");
    setActionLoading(true);
    try {
      const res = await fetch(`${BASE}/hr/attendance/${modal.record.id}`, {
        method: "PATCH", headers: getAuthHeaders(),
        body: JSON.stringify({ field: editField, newTime: editTime, reason: editReason.trim() }),
      });
      const json = await res.json();
      if (res.ok && json.statusCode === 200) { showToast("Đã cập nhật chấm công"); setModal(null); load(); }
      else setActionError(extractApiError(json, "Cập nhật thất bại"));
    } catch { setActionError("Không kết nối được máy chủ"); }
    finally { setActionLoading(false); }
  }

  async function submitPunish(e: React.FormEvent) {
    e.preventDefault();
    if (modal?.type !== "punish") return;
    if (!punishAmount || Number(punishAmount) <= 0) return setActionError("Số tiền phạt phải lớn hơn 0");
    if (!punishReason.trim()) return setActionError("Vui lòng nhập lý do phạt");
    setActionLoading(true);
    try {
      const res = await fetch(`${BASE}/hr/attendance/${modal.record.id}/punish`, {
        method: "POST", headers: getAuthHeaders(),
        body: JSON.stringify({ amount: Number(punishAmount), reason: punishReason.trim() }),
      });
      const json = await res.json();
      if (res.ok && json.statusCode === 200) { showToast("Đã ghi phạt"); setModal(null); load(); }
      else setActionError(extractApiError(json, "Ghi phạt thất bại"));
    } catch { setActionError("Không kết nối được máy chủ"); }
    finally { setActionLoading(false); }
  }

  async function removePunish(r: AttendanceRecord) {
    if (!confirm(`Xóa khoản phạt của ${r.employeeName} ngày ${r.workDate}?`)) return;
    const res = await fetch(`${BASE}/hr/attendance/${r.id}/punish`, { method: "DELETE", headers: getAuthHeaders() });
    const json = await res.json();
    if (json.statusCode === 200) { showToast("Đã xóa khoản phạt"); load(); }
    else showToast(json.message ?? "Thất bại");
  }

  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const years = [now.getFullYear() - 1, now.getFullYear()];

  return (
    <div className="p-6">
      {toast && <div className="fixed top-4 right-4 bg-gray-800 text-white text-sm px-4 py-2.5 rounded shadow-lg z-50">{toast}</div>}

      <div className="flex items-center gap-3 mb-5">
        <Link href="/admin/nhan-su" className="text-muted-soft hover:text-gray-600 text-sm">← Nhân sự</Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-bold text-ink">Chấm công</h1>
      </div>

      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <select value={month} onChange={(e) => { setMonth(Number(e.target.value)); setPage(0); }}
          className="border border-hairline px-3 py-1.5 text-sm rounded outline-none focus:border-primary bg-white">
          {months.map(m => <option key={m} value={m}>Tháng {m}</option>)}
        </select>
        <select value={year} onChange={(e) => { setYear(Number(e.target.value)); setPage(0); }}
          className="border border-hairline px-3 py-1.5 text-sm rounded outline-none focus:border-primary bg-white">
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={employeeFilter} onChange={(e) => { setEmployeeFilter(e.target.value); setPage(0); }}
          className="border border-hairline px-3 py-1.5 text-sm rounded outline-none focus:border-primary bg-white">
          <option value="">Tất cả nhân viên</option>
          {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
      </div>

      <div className="bg-canvas rounded-lg border border-hairline overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-soft border-b border-hairline text-xs text-muted uppercase">
                <th className="text-left px-4 py-3">Nhân viên</th>
                <th className="text-left px-4 py-3">Ca / Ngày</th>
                <th className="text-center px-4 py-3">Check-in</th>
                <th className="text-center px-4 py-3">Check-out</th>
                <th className="text-center px-4 py-3">Giờ làm</th>
                <th className="text-center px-4 py-3">Đi muộn</th>
                <th className="text-center px-4 py-3">Phạt</th>
                <th className="text-center px-4 py-3">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {loading ? (
                <tr><td colSpan={8} className="text-center py-8 text-muted-soft">Đang tải...</td></tr>
              ) : records.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-8 text-muted-soft">Không có bản ghi chấm công</td></tr>
              ) : records.map((r) => (
                <tr key={r.id} className="hover:bg-surface-soft">
                  <td className="px-4 py-2.5 font-medium text-ink">{r.employeeName}</td>
                  <td className="px-4 py-2.5">
                    <div className="text-xs text-muted">{r.shiftName}</div>
                    <div className="text-xs text-muted-soft">{r.workDate}</div>
                  </td>
                  <td className="px-4 py-2.5 text-center text-green-600 font-mono text-xs">{fmtTime(r.checkInTime)}</td>
                  <td className="px-4 py-2.5 text-center text-blue-600 font-mono text-xs">{fmtTime(r.checkOutTime)}</td>
                  <td className="px-4 py-2.5 text-center font-medium">{r.totalHours != null ? `${r.totalHours}h` : "—"}</td>
                  <td className="px-4 py-2.5 text-center">
                    {r.lateMinutes ? <span className="text-yellow-600 font-semibold">{r.lateMinutes}′</span> : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {r.punished && r.punishmentAmount ? (
                      <div>
                        <div className="text-red-500 font-semibold text-xs">{r.punishmentAmount.toLocaleString("vi-VN")}đ</div>
                        {r.punishmentReason && <div className="text-muted-soft text-[10px] max-w-[80px] truncate">{r.punishmentReason}</div>}
                      </div>
                    ) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-center gap-1 flex-wrap">
                      <button onClick={() => openEdit(r)}
                        className="px-2 py-1 bg-blue-50 text-blue-600 text-xs rounded hover:bg-blue-100">Sửa giờ</button>
                      {r.punished ? (
                        <button onClick={() => removePunish(r)}
                          className="px-2 py-1 bg-canvas text-muted text-xs rounded hover:bg-surface-card">Xóa phạt</button>
                      ) : (
                        <button onClick={() => openPunish(r)}
                          className="px-2 py-1 bg-red-50 text-red-500 text-xs rounded hover:bg-red-100">Ghi phạt</button>
                      )}
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

      {/* Edit attendance modal */}
      {modal?.type === "edit" && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setModal(null)}>
          <div className="bg-canvas rounded-lg border border-hairline-xl p-6 w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
            <h2 className="font-bold text-ink mb-1">Sửa giờ chấm công</h2>
            <p className="text-sm text-muted mb-4">{modal.record.employeeName} — {modal.record.workDate}</p>
            <form onSubmit={submitEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase">Loại giờ</label>
                <select value={editField} onChange={(e) => setEditField(e.target.value as "checkInTime" | "checkOutTime")}
                  className="w-full border border-hairline px-3 py-2 text-sm outline-none focus:border-primary rounded bg-white">
                  <option value="checkInTime">Check-in</option>
                  <option value="checkOutTime">Check-out</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase">Thời gian mới *</label>
                <input type="datetime-local" value={editTime} onChange={(e) => setEditTime(e.target.value)}
                  className="w-full border border-hairline px-3 py-2 text-sm outline-none focus:border-primary rounded" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase">Lý do *</label>
                <input value={editReason} onChange={(e) => setEditReason(e.target.value)}
                  placeholder="VD: Máy chấm công lỗi"
                  className="w-full border border-hairline px-3 py-2 text-sm outline-none focus:border-primary rounded" />
              </div>
              {actionError && <div className="text-red-500 text-sm">{actionError}</div>}
              <div className="flex gap-3">
                <button type="submit" disabled={actionLoading}
                  className="px-5 py-2 bg-primary text-white text-sm font-semibold rounded hover:bg-primary-dark disabled:opacity-60">
                  {actionLoading ? "Đang lưu..." : "Lưu"}
                </button>
                <button type="button" onClick={() => setModal(null)}
                  className="px-5 py-2 bg-canvas text-gray-600 text-sm rounded hover:bg-surface-card">Hủy</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Punish modal */}
      {modal?.type === "punish" && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setModal(null)}>
          <div className="bg-canvas rounded-lg border border-hairline-xl p-6 w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
            <h2 className="font-bold text-ink mb-1">Ghi khoản phạt</h2>
            <p className="text-sm text-muted mb-4">{modal.record.employeeName} — {modal.record.workDate}</p>
            <form onSubmit={submitPunish} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase">Số tiền phạt (VNĐ) *</label>
                <input type="number" min="1000" value={punishAmount} onChange={(e) => setPunishAmount(e.target.value)}
                  placeholder="VD: 50000"
                  className="w-full border border-hairline px-3 py-2 text-sm outline-none focus:border-primary rounded" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase">Lý do phạt *</label>
                <input value={punishReason} onChange={(e) => setPunishReason(e.target.value)}
                  placeholder="VD: Đi muộn 30 phút không xin phép"
                  className="w-full border border-hairline px-3 py-2 text-sm outline-none focus:border-primary rounded" />
              </div>
              {actionError && <div className="text-red-500 text-sm">{actionError}</div>}
              <div className="flex gap-3">
                <button type="submit" disabled={actionLoading}
                  className="px-5 py-2 bg-red-500 text-white text-sm font-semibold rounded hover:bg-red-600 disabled:opacity-60">
                  {actionLoading ? "Đang lưu..." : "Ghi phạt"}
                </button>
                <button type="button" onClick={() => setModal(null)}
                  className="px-5 py-2 bg-canvas text-gray-600 text-sm rounded hover:bg-surface-card">Hủy</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
