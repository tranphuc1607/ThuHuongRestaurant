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

  function normalizeTime(val: string): string {
    const d = val.replace(/\D/g, "");
    if (!d) return "";
    if (d.length === 1) return "0" + d + ":00";
    if (d.length === 2) return d + ":00";
    if (d.length === 3) return "0" + d[0] + ":" + d.slice(1);
    return d.slice(0, 2) + ":" + d.slice(2, 4);
  }

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
      if (json.statusCode === 200) { showToast("Đã cập nhật ca làm"); setEditingId(null); load(); }
      else setEditError(extractApiError(json, "Cập nhật thất bại"));
    } finally { setEditSaving(false); }
  }

  async function deleteShift(id: number) {
    if (!confirm("Xóa ca làm này? Phân ca liên quan sẽ bị xóa.")) return;
    const res = await fetch(`${BASE}/hr/shifts/${id}`, { method: "DELETE", headers: getAuthHeaders() });
    const json = await res.json();
    if (json.statusCode === 200) { showToast("Đã xóa ca làm"); load(); }
    else showToast(json.message ?? "Thất bại");
  }

  const skeletonRows = Array.from({ length: 4 });

  return (
    <div className="p-3 md:p-6 max-w-2xl">
      {toast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 md:top-4 md:right-4 md:left-auto md:translate-x-0 bg-gray-800 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg z-50 whitespace-nowrap">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <Link href="/admin/nhan-su"
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-surface-card text-muted hover:bg-hairline touch-manipulation"
          style={{ WebkitTapHighlightColor: "transparent" }}>←</Link>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-ink">Ca làm việc</h1>
          <p className="text-xs text-muted">Quản lý các ca theo giờ</p>
        </div>
        <button
          onPointerDown={e => { if (e.pointerType === "touch") { e.preventDefault(); setShowForm(v => !v); setEditingId(null); } }}
          onClick={() => { setShowForm(v => !v); setEditingId(null); }}
          className="px-4 py-2 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary-dark touch-manipulation"
          style={{ WebkitTapHighlightColor: "transparent" }}>
          {showForm ? "Đóng" : "+ Thêm ca"}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-hairline p-5 mb-4">
          <h2 className="text-sm font-bold text-ink mb-3">Tạo ca mới</h2>
          <form onSubmit={createShift} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase">Tên ca *</label>
              <input value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="VD: Ca sáng"
                className="w-full border border-hairline px-3 py-2.5 text-sm outline-none focus:border-primary rounded-xl" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 mb-1 uppercase">Bắt đầu *</label>
                <input type="text" inputMode="numeric" placeholder="08:00" value={form.startTime}
                  onChange={(e) => setForm(p => ({ ...p, startTime: e.target.value }))}
                  onBlur={(e) => setForm(p => ({ ...p, startTime: normalizeTime(e.target.value) }))}
                  className="w-full border border-hairline px-2 py-2 text-sm text-center outline-none focus:border-primary rounded-lg" />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 mb-1 uppercase">Kết thúc *</label>
                <input type="text" inputMode="numeric" placeholder="17:00" value={form.endTime}
                  onChange={(e) => setForm(p => ({ ...p, endTime: e.target.value }))}
                  onBlur={(e) => setForm(p => ({ ...p, endTime: normalizeTime(e.target.value) }))}
                  className="w-full border border-hairline px-2 py-2 text-sm text-center outline-none focus:border-primary rounded-lg" />
              </div>
            </div>
            {formError && <div className="text-red-500 text-sm">{formError}</div>}
            <div className="flex gap-3">
              <button type="submit" disabled={saving}
                className="flex-1 py-3 bg-primary text-white text-sm font-bold rounded-xl hover:bg-primary-dark disabled:opacity-60 touch-manipulation"
                style={{ WebkitTapHighlightColor: "transparent" }}>
                {saving ? "Đang lưu..." : "Tạo ca"}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="flex-1 py-3 bg-surface-card text-gray-600 text-sm font-semibold rounded-xl hover:bg-hairline touch-manipulation"
                style={{ WebkitTapHighlightColor: "transparent" }}>Hủy</button>
            </div>
          </form>
        </div>
      )}

      {/* Shifts list */}
      {loading ? (
        <div className="space-y-2">
          {skeletonRows.map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-hairline p-4 animate-pulse">
              <div className="flex gap-3">
                <div className="h-4 bg-gray-200 rounded w-1/3" />
                <div className="h-4 bg-gray-100 rounded w-16 ml-auto" />
              </div>
            </div>
          ))}
        </div>
      ) : shifts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-hairline p-10 text-center text-muted-soft text-sm">
          Chưa có ca làm nào
        </div>
      ) : (
        <div className="space-y-2">
          {shifts.map((s) => (
            <div key={s.id} className="bg-white rounded-2xl border border-hairline overflow-hidden">
              {editingId === s.id ? (
                /* Edit mode */
                <div className="p-4 bg-blue-50 border-b border-blue-100">
                  <form onSubmit={saveEdit} className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Tên ca</label>
                      <input value={editForm.name} onChange={(e) => setEditForm(p => ({ ...p, name: e.target.value }))}
                        className="w-full border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary rounded-xl bg-white" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-semibold text-gray-500 mb-1 uppercase">Bắt đầu</label>
                        <input type="text" inputMode="numeric" placeholder="08:00" value={editForm.startTime}
                          onChange={(e) => setEditForm(p => ({ ...p, startTime: e.target.value }))}
                          onBlur={(e) => setEditForm(p => ({ ...p, startTime: normalizeTime(e.target.value) }))}
                          className="w-full border border-gray-200 px-2 py-2 text-sm text-center outline-none focus:border-primary rounded-lg bg-white" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-gray-500 mb-1 uppercase">Kết thúc</label>
                        <input type="text" inputMode="numeric" placeholder="17:00" value={editForm.endTime}
                          onChange={(e) => setEditForm(p => ({ ...p, endTime: e.target.value }))}
                          onBlur={(e) => setEditForm(p => ({ ...p, endTime: normalizeTime(e.target.value) }))}
                          className="w-full border border-gray-200 px-2 py-2 text-sm text-center outline-none focus:border-primary rounded-lg bg-white" />
                      </div>
                    </div>
                    {editError && <p className="text-red-500 text-xs">{editError}</p>}
                    <div className="flex gap-2">
                      <button type="submit" disabled={editSaving}
                        className="flex-1 py-2.5 bg-primary text-white text-sm font-bold rounded-xl hover:bg-primary-dark disabled:opacity-60 touch-manipulation"
                        style={{ WebkitTapHighlightColor: "transparent" }}>
                        {editSaving ? "..." : "Lưu"}
                      </button>
                      <button type="button" onClick={() => setEditingId(null)}
                        className="flex-1 py-2.5 bg-white text-gray-600 text-sm font-semibold rounded-xl border border-gray-200 hover:bg-surface-card touch-manipulation"
                        style={{ WebkitTapHighlightColor: "transparent" }}>Hủy</button>
                    </div>
                  </form>
                </div>
              ) : (
                /* View mode */
                <div className="p-4">
                  <div className="flex items-center gap-3">
                    {/* Time badge */}
                    <div className="shrink-0 text-center bg-surface-card rounded-xl px-3 py-2 min-w-[80px]">
                      <div className="text-xs font-bold text-green-600">{s.startTime}</div>
                      <div className="text-xs text-muted-soft my-0.5">→</div>
                      <div className="text-xs font-bold text-blue-600">{s.endTime}</div>
                    </div>
                    {/* Name + meta */}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-ink">{s.name}</div>
                      <div className="text-xs text-muted mt-0.5">
                        {s.durationHours != null && <span>{s.durationHours}h · </span>}
                        <span className={s.active ? "text-green-600" : "text-gray-400"}>
                          {s.active ? "Đang dùng" : "Đã hủy"}
                        </span>
                      </div>
                    </div>
                    {/* Actions */}
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        onPointerDown={e => { if (e.pointerType === "touch") { e.preventDefault(); editingId === s.id ? setEditingId(null) : startEdit(s); } }}
                        onClick={() => editingId === s.id ? setEditingId(null) : startEdit(s)}
                        className="w-9 h-9 flex items-center justify-center bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 touch-manipulation"
                        style={{ WebkitTapHighlightColor: "transparent" }}>
                        ✏️
                      </button>
                      {s.active && (
                        <button
                          onPointerDown={e => { if (e.pointerType === "touch") { e.preventDefault(); deleteShift(s.id); } }}
                          onClick={() => deleteShift(s.id)}
                          className="w-9 h-9 flex items-center justify-center bg-red-50 text-red-500 rounded-xl hover:bg-red-100 touch-manipulation"
                          style={{ WebkitTapHighlightColor: "transparent" }}>
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
