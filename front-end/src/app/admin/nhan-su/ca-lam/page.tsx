"use client";
import { useState, useEffect } from "react";
import { getAuthHeaders } from "@/lib/auth";
import { extractApiError } from "@/lib/utils";
import Link from "next/link";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api/v1";

interface Shift { id: number; name: string; startTime: string; endTime: string; durationHours?: number; active: boolean; }

export default function ShiftsPage() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", startTime: "", endTime: "" });
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ name: "", startTime: "", endTime: "" });
  const [editError, setEditError] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [toast, setToast] = useState("");

  async function load() {
    setLoading(true);
    const res = await fetch(`${BASE}/hr/shifts`, { headers: getAuthHeaders() });
    const json = await res.json();
    if (json.statusCode === 200) setShifts(json.data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(""), 3000); }

  async function createShift(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.startTime || !form.endTime) return setFormError("Vui lòng điền đủ thông tin");
    setSaving(true);
    try {
      const res = await fetch(`${BASE}/hr/shifts`, {
        method: "POST", headers: getAuthHeaders(),
        body: JSON.stringify({ name: form.name.trim(), startTime: form.startTime, endTime: form.endTime }),
      });
      const json = await res.json();
      if (json.statusCode === 200) {
        showToast("Đã tạo ca làm"); setShowForm(false);
        setForm({ name: "", startTime: "", endTime: "" }); load();
      } else setFormError(extractApiError(json, "Tạo thất bại"));
    } finally { setSaving(false); }
  }

  function startEdit(s: Shift) {
    setEditingId(s.id);
    setEditForm({ name: s.name, startTime: s.startTime, endTime: s.endTime });
    setEditError("");
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editForm.name.trim() || !editForm.startTime || !editForm.endTime) return setEditError("Vui lòng điền đủ thông tin");
    setEditSaving(true);
    try {
      const res = await fetch(`${BASE}/hr/shifts/${editingId}`, {
        method: "PUT", headers: getAuthHeaders(),
        body: JSON.stringify({ name: editForm.name.trim(), startTime: editForm.startTime, endTime: editForm.endTime }),
      });
      const json = await res.json();
      if (json.statusCode === 200) {
        showToast("Đã cập nhật ca làm"); setEditingId(null); load();
      } else setEditError(extractApiError(json, "Cập nhật thất bại"));
    } finally { setEditSaving(false); }
  }

  async function deleteShift(id: number) {
    if (!confirm("Xóa ca làm này? Phân ca liên quan sẽ bị xóa.")) return;
    const res = await fetch(`${BASE}/hr/shifts/${id}`, { method: "DELETE", headers: getAuthHeaders() });
    const json = await res.json();
    if (json.statusCode === 200) { showToast("Đã xóa ca làm"); load(); }
    else showToast(json.message ?? "Thất bại");
  }

  return (
    <div className="p-6 max-w-2xl">
      {toast && <div className="fixed top-4 right-4 bg-gray-800 text-white text-sm px-4 py-2.5 rounded shadow-lg z-50">{toast}</div>}

      <div className="flex items-center gap-3 mb-5">
        <Link href="/admin/nhan-su" className="text-muted-soft hover:text-gray-600 text-sm">← Nhân sự</Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-bold text-ink">Ca làm việc</h1>
        <button onClick={() => { setShowForm(v => !v); setEditingId(null); }}
          className="ml-auto px-4 py-2 bg-primary text-white text-sm font-semibold rounded hover:bg-primary-dark">
          {showForm ? "Đóng" : "+ Thêm ca"}
        </button>
      </div>

      {showForm && (
        <div className="bg-canvas rounded-lg border border-hairline-sm p-5 mb-5">
          <h2 className="text-sm font-bold text-ink mb-3">Tạo ca mới</h2>
          <form onSubmit={createShift} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase">Tên ca *</label>
              <input value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="VD: Ca sáng"
                className="w-full border border-hairline px-3 py-2 text-sm outline-none focus:border-primary rounded" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase">Giờ bắt đầu *</label>
                <input type="time" value={form.startTime} onChange={(e) => setForm(p => ({ ...p, startTime: e.target.value }))}
                  className="w-full border border-hairline px-3 py-2 text-sm outline-none focus:border-primary rounded" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase">Giờ kết thúc *</label>
                <input type="time" value={form.endTime} onChange={(e) => setForm(p => ({ ...p, endTime: e.target.value }))}
                  className="w-full border border-hairline px-3 py-2 text-sm outline-none focus:border-primary rounded" />
              </div>
            </div>
            {formError && <div className="text-red-500 text-sm">{formError}</div>}
            <div className="flex gap-3">
              <button type="submit" disabled={saving}
                className="px-5 py-2 bg-primary text-white text-sm font-semibold rounded hover:bg-primary-dark disabled:opacity-60">
                {saving ? "Đang lưu..." : "Tạo ca"}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="px-5 py-2 bg-canvas text-gray-600 text-sm rounded hover:bg-surface-card">Hủy</button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-canvas rounded-lg border border-hairline overflow-hidden">
        {loading ? (
          <div className="text-center py-8 text-muted-soft">Đang tải...</div>
        ) : shifts.length === 0 ? (
          <div className="text-center py-8 text-muted-soft">Chưa có ca làm nào</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-soft border-b border-hairline text-xs text-muted uppercase">
                <th className="text-left px-4 py-3">Tên ca</th>
                <th className="text-center px-4 py-3">Bắt đầu</th>
                <th className="text-center px-4 py-3">Kết thúc</th>
                <th className="text-center px-4 py-3">Thời lượng</th>
                <th className="text-center px-4 py-3">Trạng thái</th>
                <th className="text-center px-4 py-3">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {shifts.map((s) => (
                <>
                  <tr key={s.id} className="hover:bg-surface-soft">
                    <td className="px-4 py-3 font-medium text-ink">{s.name}</td>
                    <td className="px-4 py-3 text-center font-mono text-green-600">{s.startTime}</td>
                    <td className="px-4 py-3 text-center font-mono text-blue-600">{s.endTime}</td>
                    <td className="px-4 py-3 text-center text-muted">
                      {s.durationHours != null ? `${s.durationHours}h` : "—"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${s.active ? "bg-green-100 text-green-700" : "bg-canvas text-muted"}`}>
                        {s.active ? "Đang dùng" : "Đã hủy"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center gap-1">
                        <button onClick={() => editingId === s.id ? setEditingId(null) : startEdit(s)}
                          className="px-2 py-1 bg-blue-50 text-blue-600 text-xs rounded hover:bg-blue-100">
                          {editingId === s.id ? "Đóng" : "Sửa"}
                        </button>
                        {s.active && (
                          <button onClick={() => deleteShift(s.id)}
                            className="px-2 py-1 bg-red-50 text-red-500 text-xs rounded hover:bg-red-100">Xóa</button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {editingId === s.id && (
                    <tr key={`edit-${s.id}`}>
                      <td colSpan={6} className="px-4 py-4 bg-blue-50 border-b border-blue-100">
                        <form onSubmit={saveEdit} className="flex flex-wrap gap-3 items-end">
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase">Tên ca</label>
                            <input value={editForm.name} onChange={(e) => setEditForm(p => ({ ...p, name: e.target.value }))}
                              className="border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-primary rounded w-44" />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase">Bắt đầu</label>
                            <input type="time" value={editForm.startTime} onChange={(e) => setEditForm(p => ({ ...p, startTime: e.target.value }))}
                              className="border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-primary rounded" />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase">Kết thúc</label>
                            <input type="time" value={editForm.endTime} onChange={(e) => setEditForm(p => ({ ...p, endTime: e.target.value }))}
                              className="border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-primary rounded" />
                          </div>
                          <div className="flex gap-2">
                            <button type="submit" disabled={editSaving}
                              className="px-4 py-1.5 bg-primary text-white text-sm font-semibold rounded hover:bg-primary-dark disabled:opacity-60">
                              {editSaving ? "..." : "Lưu"}
                            </button>
                            <button type="button" onClick={() => setEditingId(null)}
                              className="px-4 py-1.5 bg-gray-200 text-gray-600 text-sm rounded hover:bg-gray-300">Hủy</button>
                          </div>
                          {editError && <span className="text-red-500 text-xs">{editError}</span>}
                        </form>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
