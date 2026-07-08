"use client";
import { useState, useEffect, useCallback, Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getAuthHeaders } from "@/lib/auth";
import { extractApiError } from "@/lib/utils";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api/v1";

interface Employee {
  id: number; name: string; phone?: string; type: string; salaryType: string;
  baseValue: number; targetDays?: number; active: boolean; telegramId?: number;
}
interface ShiftAssignment {
  id: number; shiftId: number; shiftName: string; dayOfWeek: string;
  effectiveFrom: string; effectiveTo?: string; active: boolean;
}
interface Shift { id: number; name: string; startTime: string; endTime: string; active: boolean; }

const EMP_TYPE: Record<string, string> = { FULL_TIME: "Toàn thời gian", PART_TIME: "Bán thời gian" };
const SALARY_TYPE: Record<string, string> = { FIXED: "Tháng cố định", HOURLY: "Theo giờ" };
const DOW_VI: Record<string, string> = {
  MONDAY: "Thứ 2", TUESDAY: "Thứ 3", WEDNESDAY: "Thứ 4",
  THURSDAY: "Thứ 5", FRIDAY: "Thứ 6", SATURDAY: "Thứ 7", SUNDAY: "Chủ nhật",
};

type Tab = "info" | "shifts";

function EmployeeDetailContent() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [assignments, setAssignments] = useState<ShiftAssignment[]>([]);
  const [tab, setTab] = useState<Tab>("info");
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");

  // Edit form — auto-open nếu URL có ?edit=1
  const [editing, setEditing] = useState(searchParams.get("edit") === "1");
  const [editForm, setEditForm] = useState({ name: "", phone: "", type: "FULL_TIME", salaryType: "FIXED", baseValue: "", targetDays: "" });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");

  // Telegram link
  const [telegramInput, setTelegramInput] = useState("");
  const [telegramLoading, setTelegramLoading] = useState(false);
  const [telegramError, setTelegramError] = useState("");

  // Assign shift form
  const [assignForm, setAssignForm] = useState({ shiftId: "", daysOfWeek: [] as string[], effectiveFrom: "", effectiveTo: "" });
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignError, setAssignError] = useState("");
  const [showAssignForm, setShowAssignForm] = useState(false);

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(""), 3000); }

  const loadEmployee = useCallback(async () => {
    const res = await fetch(`${BASE}/hr/employees/${id}`, { headers: getAuthHeaders() });
    const json = await res.json();
    if (json.statusCode === 200) {
      setEmployee(json.data);
      const e = json.data as Employee;
      setEditForm({
        name: e.name, phone: e.phone ?? "", type: e.type,
        salaryType: e.salaryType, baseValue: String(e.baseValue), targetDays: String(e.targetDays ?? ""),
      });
    }
  }, [id]);

  const loadAssignments = useCallback(async () => {
    const res = await fetch(`${BASE}/hr/shifts/assignments?employeeId=${id}`, { headers: getAuthHeaders() });
    const json = await res.json();
    if (json.statusCode === 200) setAssignments(json.data ?? []);
  }, [id]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadEmployee();
      setLoading(false);
    })();
  }, [loadEmployee]);

  useEffect(() => {
    if (tab === "shifts") {
      loadAssignments();
      fetch(`${BASE}/hr/shifts`, { headers: getAuthHeaders() })
        .then(r => r.json()).then(j => { if (j.statusCode === 200) setShifts(j.data ?? []); });
    }
  }, [tab, loadAssignments]);

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    setEditError("");
    if (!editForm.name.trim()) return setEditError("Vui lòng nhập họ tên");
    if (!editForm.baseValue || Number(editForm.baseValue) <= 0) return setEditError("Lương cơ bản phải lớn hơn 0");
    if (editForm.salaryType === "FIXED" && (!editForm.targetDays || Number(editForm.targetDays) <= 0))
      return setEditError("Vui lòng nhập số ngày công chuẩn");
    setEditLoading(true);
    try {
      const body: Record<string, unknown> = {
        name: editForm.name.trim(), type: editForm.type,
        salaryType: editForm.salaryType, baseValue: Number(editForm.baseValue),
      };
      if (editForm.phone.trim()) body.phone = editForm.phone.trim();
      if (editForm.salaryType === "FIXED") body.targetDays = Number(editForm.targetDays);
      const res = await fetch(`${BASE}/hr/employees/${id}`, {
        method: "PUT", headers: getAuthHeaders(), body: JSON.stringify(body),
      });
      const json = await res.json();
      if (res.ok && json.statusCode === 200) {
        setEditing(false); showToast("Đã cập nhật thông tin"); await loadEmployee();
      } else setEditError(extractApiError(json, "Cập nhật thất bại"));
    } catch { setEditError("Không kết nối được máy chủ"); }
    finally { setEditLoading(false); }
  }

  async function toggleActive() {
    if (!employee) return;
    const endpoint = employee.active ? "deactivate" : "activate";
    const res = await fetch(`${BASE}/hr/employees/${id}/${endpoint}`, { method: "PATCH", headers: getAuthHeaders() });
    const json = await res.json();
    if (json.statusCode === 200) { showToast(employee.active ? "Đã vô hiệu hóa" : "Đã kích hoạt"); await loadEmployee(); }
    else showToast(json.message ?? "Thất bại");
  }

  async function linkTelegram(e: React.FormEvent) {
    e.preventDefault();
    setTelegramError("");
    if (!telegramInput || isNaN(Number(telegramInput))) return setTelegramError("Telegram ID không hợp lệ");
    setTelegramLoading(true);
    try {
      const res = await fetch(`${BASE}/hr/employees/${id}/link-telegram`, {
        method: "PATCH", headers: getAuthHeaders(),
        body: JSON.stringify({ telegramId: Number(telegramInput) }),
      });
      const json = await res.json();
      if (res.ok && json.statusCode === 200) {
        showToast("Đã liên kết Telegram"); setTelegramInput(""); await loadEmployee();
      } else setTelegramError(extractApiError(json, "Liên kết thất bại"));
    } catch { setTelegramError("Không kết nối được máy chủ"); }
    finally { setTelegramLoading(false); }
  }

  function toggleDay(day: string) {
    setAssignForm(p => ({
      ...p,
      daysOfWeek: p.daysOfWeek.includes(day)
        ? p.daysOfWeek.filter(d => d !== day)
        : [...p.daysOfWeek, day],
    }));
  }

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    setAssignError("");
    if (!assignForm.shiftId) return setAssignError("Vui lòng chọn ca làm");
    if (assignForm.daysOfWeek.length === 0) return setAssignError("Vui lòng chọn ít nhất một ngày");
    if (!assignForm.effectiveFrom) return setAssignError("Vui lòng chọn ngày bắt đầu");
    setAssignLoading(true);
    try {
      const body: Record<string, unknown> = {
        employeeId: Number(id), shiftId: Number(assignForm.shiftId),
        daysOfWeek: assignForm.daysOfWeek, effectiveFrom: assignForm.effectiveFrom,
      };
      if (assignForm.effectiveTo) body.effectiveTo = assignForm.effectiveTo;
      const res = await fetch(`${BASE}/hr/shifts/assign`, {
        method: "POST", headers: getAuthHeaders(), body: JSON.stringify(body),
      });
      const json = await res.json();
      if (res.ok && json.statusCode === 200) {
        showToast("Đã phân ca thành công"); setShowAssignForm(false);
        setAssignForm({ shiftId: "", daysOfWeek: [], effectiveFrom: "", effectiveTo: "" });
        await loadAssignments();
      } else setAssignError(extractApiError(json, "Phân ca thất bại"));
    } catch { setAssignError("Không kết nối được máy chủ"); }
    finally { setAssignLoading(false); }
  }

  if (loading) return <div className="p-6 text-muted-soft">Đang tải...</div>;
  if (!employee) return <div className="p-6 text-red-500">Không tìm thấy nhân viên</div>;

  const DAYS_ORDER = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];

  return (
    <div className="p-6">
      {toast && <div className="fixed top-4 right-4 bg-gray-800 text-white text-sm px-4 py-2.5 rounded shadow-lg z-50">{toast}</div>}

      <div className="flex items-center gap-3 mb-5">
        <Link href="/admin/nhan-su" className="text-muted-soft hover:text-gray-600 text-sm">← Nhân sự</Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-lg font-bold text-ink">{employee.name}</h1>
        <span className={`ml-2 px-2 py-0.5 text-xs rounded-full font-semibold ${employee.active ? "bg-green-100 text-green-700" : "bg-canvas text-muted"}`}>
          {employee.active ? "Đang làm" : "Nghỉ"}
        </span>
        <div className="ml-auto flex gap-2">
          <button onClick={() => { setEditing(v => !v); setTab("info"); }}
            className="px-3 py-1.5 bg-blue-50 text-blue-600 text-sm rounded hover:bg-blue-100">
            {editing ? "Hủy sửa" : "Sửa thông tin"}
          </button>
          <button onClick={toggleActive}
            className={`px-3 py-1.5 text-sm rounded ${employee.active ? "bg-red-50 text-red-500 hover:bg-red-100" : "bg-green-50 text-green-600 hover:bg-green-100"}`}>
            {employee.active ? "Vô hiệu hóa" : "Kích hoạt"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b border-hairline">
        {([["info", "Thông tin"], ["shifts", "Phân ca"]] as [Tab, string][]).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-5 py-2.5 text-sm font-medium transition-colors ${tab === key ? "border-b-2 border-primary text-primary" : "text-muted hover:text-ink"}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Tab: Thông tin */}
      {tab === "info" && (
        <div className="max-w-lg space-y-4">
          {editing ? (
            <div className="bg-canvas rounded-lg border border-hairline-sm p-6">
              <h2 className="text-sm font-bold text-ink mb-4">Chỉnh sửa thông tin</h2>
              <form onSubmit={handleEdit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase">Họ tên *</label>
                  <input value={editForm.name} onChange={(e) => setEditForm(p => ({ ...p, name: e.target.value }))}
                    className="w-full border border-hairline px-3 py-2 text-sm outline-none focus:border-primary rounded" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase">Điện thoại</label>
                    <input value={editForm.phone} onChange={(e) => setEditForm(p => ({ ...p, phone: e.target.value }))}
                      className="w-full border border-hairline px-3 py-2 text-sm outline-none focus:border-primary rounded" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase">Loại NV</label>
                    <select value={editForm.type} onChange={(e) => setEditForm(p => ({ ...p, type: e.target.value }))}
                      className="w-full border border-hairline px-3 py-2 text-sm outline-none focus:border-primary rounded bg-white">
                      <option value="FULL_TIME">Toàn thời gian</option>
                      <option value="PART_TIME">Bán thời gian</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase">Loại lương</label>
                    <select value={editForm.salaryType} onChange={(e) => setEditForm(p => ({ ...p, salaryType: e.target.value }))}
                      className="w-full border border-hairline px-3 py-2 text-sm outline-none focus:border-primary rounded bg-white">
                      <option value="FIXED">Tháng cố định</option>
                      <option value="HOURLY">Theo giờ</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase">Lương cơ bản *</label>
                    <input type="number" value={editForm.baseValue} onChange={(e) => setEditForm(p => ({ ...p, baseValue: e.target.value }))}
                      className="w-full border border-hairline px-3 py-2 text-sm outline-none focus:border-primary rounded" />
                  </div>
                </div>
                {editForm.salaryType === "FIXED" && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase">Ngày công chuẩn *</label>
                    <input type="number" value={editForm.targetDays} onChange={(e) => setEditForm(p => ({ ...p, targetDays: e.target.value }))}
                      placeholder="VD: 26"
                      className="w-full border border-hairline px-3 py-2 text-sm outline-none focus:border-primary rounded" />
                  </div>
                )}
                {editError && <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-2.5 rounded">{editError}</div>}
                <div className="flex gap-3">
                  <button type="submit" disabled={editLoading}
                    className="px-5 py-2 bg-primary text-white text-sm font-semibold rounded hover:bg-primary-dark disabled:opacity-60">
                    {editLoading ? "Đang lưu..." : "Lưu thay đổi"}
                  </button>
                  <button type="button" onClick={() => setEditing(false)}
                    className="px-5 py-2 bg-canvas text-gray-600 text-sm rounded hover:bg-surface-card">Hủy</button>
                </div>
              </form>
            </div>
          ) : (
            <div className="bg-canvas rounded-lg border border-hairline-sm p-6">
              <dl className="grid grid-cols-2 gap-4 text-sm">
                {[
                  ["Họ tên", employee.name],
                  ["Điện thoại", employee.phone ?? "—"],
                  ["Loại nhân viên", EMP_TYPE[employee.type] ?? employee.type],
                  ["Loại lương", SALARY_TYPE[employee.salaryType] ?? employee.salaryType],
                  ["Lương cơ bản", `${employee.baseValue.toLocaleString("vi-VN")}đ/${employee.salaryType === "HOURLY" ? "giờ" : "tháng"}`],
                  ["Ngày công chuẩn", employee.targetDays ? `${employee.targetDays} ngày` : "—"],
                  ["Telegram ID", employee.telegramId ? String(employee.telegramId) : "Chưa liên kết"],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs text-muted-soft uppercase font-semibold mb-0.5">{label}</dt>
                    <dd className="text-ink font-medium">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {/* Link Telegram */}
          <div className="bg-canvas rounded-lg border border-hairline-sm p-5">
            <h2 className="text-sm font-bold text-ink mb-3">Liên kết Telegram</h2>
            {employee.telegramId && (
              <p className="text-xs text-green-600 mb-2">Đang liên kết: <strong>{employee.telegramId}</strong></p>
            )}
            <form onSubmit={linkTelegram} className="flex gap-3">
              <input type="number" value={telegramInput} onChange={(e) => setTelegramInput(e.target.value)}
                placeholder="Nhập Telegram User ID"
                className="flex-1 border border-hairline px-3 py-2 text-sm outline-none focus:border-primary rounded" />
              <button type="submit" disabled={telegramLoading}
                className="px-4 py-2 bg-blue-500 text-white text-sm font-semibold rounded hover:bg-blue-600 disabled:opacity-60">
                {telegramLoading ? "..." : "Liên kết"}
              </button>
            </form>
            {telegramError && <p className="text-red-500 text-xs mt-2">{telegramError}</p>}
          </div>
        </div>
      )}

      {/* Tab: Phân ca */}
      {tab === "shifts" && (
        <div className="max-w-2xl">
          <div className="flex justify-end mb-3">
            <button onClick={() => setShowAssignForm(v => !v)}
              className="px-4 py-2 bg-primary text-white text-sm font-semibold rounded hover:bg-primary-dark">
              {showAssignForm ? "Đóng" : "+ Phân ca mới"}
            </button>
          </div>

          {showAssignForm && (
            <div className="bg-canvas rounded-lg border border-hairline-sm p-5 mb-4">
              <h2 className="text-sm font-bold text-ink mb-3">Phân ca làm việc</h2>
              <form onSubmit={handleAssign} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase">Ca làm *</label>
                  <select value={assignForm.shiftId}
                    onChange={(e) => setAssignForm(p => ({ ...p, shiftId: e.target.value }))}
                    className="w-full border border-hairline px-3 py-2 text-sm outline-none focus:border-primary rounded bg-white">
                    <option value="">-- Chọn ca --</option>
                    {shifts.filter(s => s.active).map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.startTime}–{s.endTime})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase">Ngày trong tuần *</label>
                  <div className="flex gap-2 flex-wrap">
                    {DAYS_ORDER.map(day => (
                      <button key={day} type="button" onClick={() => toggleDay(day)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors ${assignForm.daysOfWeek.includes(day) ? "bg-primary text-white border-primary" : "bg-canvas text-gray-600 border-gray-300 hover:border-primary"}`}>
                        {DOW_VI[day]}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase">Từ ngày *</label>
                    <input type="date" value={assignForm.effectiveFrom}
                      onChange={(e) => setAssignForm(p => ({ ...p, effectiveFrom: e.target.value }))}
                      className="w-full border border-hairline px-3 py-2 text-sm outline-none focus:border-primary rounded" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase">Đến ngày (để trống = vô hạn)</label>
                    <input type="date" value={assignForm.effectiveTo}
                      onChange={(e) => setAssignForm(p => ({ ...p, effectiveTo: e.target.value }))}
                      className="w-full border border-hairline px-3 py-2 text-sm outline-none focus:border-primary rounded" />
                  </div>
                </div>
                {assignError && <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-2.5 rounded">{assignError}</div>}
                <div className="flex gap-3">
                  <button type="submit" disabled={assignLoading}
                    className="px-5 py-2 bg-primary text-white text-sm font-semibold rounded hover:bg-primary-dark disabled:opacity-60">
                    {assignLoading ? "Đang lưu..." : "Phân ca"}
                  </button>
                  <button type="button" onClick={() => setShowAssignForm(false)}
                    className="px-5 py-2 bg-canvas text-gray-600 text-sm rounded hover:bg-surface-card">Hủy</button>
                </div>
              </form>
            </div>
          )}

          <div className="bg-canvas rounded-lg border border-hairline overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-soft border-b border-hairline text-xs text-muted uppercase">
                  <th className="text-left px-4 py-3">Ca làm</th>
                  <th className="text-center px-4 py-3">Ngày</th>
                  <th className="text-left px-4 py-3">Từ ngày</th>
                  <th className="text-left px-4 py-3">Đến ngày</th>
                  <th className="text-center px-4 py-3">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {assignments.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-8 text-muted-soft">Chưa được phân ca</td></tr>
                ) : assignments.map((a) => (
                  <tr key={a.id} className="hover:bg-surface-soft">
                    <td className="px-4 py-2.5 font-medium text-ink">{a.shiftName}</td>
                    <td className="px-4 py-2.5 text-center text-gray-600">{DOW_VI[a.dayOfWeek] ?? a.dayOfWeek}</td>
                    <td className="px-4 py-2.5 text-gray-600">{a.effectiveFrom}</td>
                    <td className="px-4 py-2.5 text-muted">{a.effectiveTo ?? "Vô hạn"}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${a.active ? "bg-green-100 text-green-700" : "bg-canvas text-muted"}`}>
                        {a.active ? "Hiệu lực" : "Hết hạn"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function EmployeeDetailPage() {
  return (
    <Suspense fallback={<div className="p-6 text-muted-soft">Đang tải...</div>}>
      <EmployeeDetailContent />
    </Suspense>
  );
}