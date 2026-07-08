"use client";
import { useState, useEffect, useCallback } from "react";
import { getAuthHeaders } from "@/lib/auth";
import { extractApiError } from "@/lib/utils";
import Link from "next/link";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api/v1";

interface Employee { id: number; name: string; type: string; active: boolean; }
interface Shift { id: number; name: string; startTime: string; endTime: string; active: boolean; }
interface ShiftAssignment {
  id: number; employeeId?: number; employeeName?: string;
  shiftId: number; shiftName: string;
  dayOfWeek: string; effectiveFrom: string; effectiveTo?: string; active: boolean;
}

const DOW_VI: Record<string, string> = {
  MONDAY: "Thứ 2", TUESDAY: "Thứ 3", WEDNESDAY: "Thứ 4",
  THURSDAY: "Thứ 5", FRIDAY: "Thứ 6", SATURDAY: "Thứ 7", SUNDAY: "Chủ nhật",
};
const DOW_ORDER = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];

// JS getDay() → DayOfWeek
const JS_TO_DOW: Record<number, string> = {
  0: "SUNDAY", 1: "MONDAY", 2: "TUESDAY", 3: "WEDNESDAY",
  4: "THURSDAY", 5: "FRIDAY", 6: "SATURDAY",
};

type MainTab = "assign" | "schedule";

const DAY_LABELS = ["T2","T3","T4","T5","T6","T7","CN"];

function EmpWeekCalendar({
  weekDates, weekOffset, setWeekOffset, today, assignments, shifts, loading,
  selectedShiftId, saving, onAddDay, onCancel, onClearWeek, clearingWeek,
}: {
  weekDates: string[]; weekOffset: number; setWeekOffset: React.Dispatch<React.SetStateAction<number>>;
  today: string; assignments: ShiftAssignment[]; shifts: Shift[]; loading: boolean;
  selectedShiftId: string; saving: boolean;
  onAddDay: (dow: string, date: string) => void; onCancel: (id: number) => void;
  onClearWeek: () => void; clearingWeek: boolean;
}) {
  const JS_DOW: Record<number, string> = {
    0:"SUNDAY",1:"MONDAY",2:"TUESDAY",3:"WEDNESDAY",4:"THURSDAY",5:"FRIDAY",6:"SATURDAY",
  };

  function getShiftsForDate(date: string) {
    const dow = JS_DOW[new Date(date + "T00:00:00").getDay()];
    return assignments.filter(a => {
      if (a.dayOfWeek !== dow || !a.active) return false;
      if (String(a.effectiveFrom) > date) return false;
      if (a.effectiveTo && String(a.effectiveTo) < date) return false;
      return true;
    });
  }

  return (
    <div className="bg-canvas rounded-lg border border-hairline overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-hairline bg-surface-soft">
        <button onClick={() => setWeekOffset(v => v - 1)}
          className="px-2.5 py-1 border border-hairline rounded text-xs hover:bg-canvas">← Trước</button>
        {weekOffset !== 0 && (
          <button onClick={() => setWeekOffset(0)}
            className="px-2.5 py-1 border border-hairline rounded text-xs hover:bg-canvas">Tuần này</button>
        )}
        <button onClick={() => setWeekOffset(v => v + 1)}
          className="px-2.5 py-1 border border-hairline rounded text-xs hover:bg-canvas">Sau →</button>
        <span className="ml-auto text-xs text-muted-soft">{weekDates[0]} → {weekDates[6]}</span>
        <button
          onClick={onClearWeek}
          disabled={clearingWeek}
          className="px-2.5 py-1 text-xs text-red-500 border border-red-200 rounded hover:bg-red-50 disabled:opacity-40 transition-colors"
          title="Xóa toàn bộ lịch trong tuần đang xem"
        >
          {clearingWeek ? "Đang xóa..." : "Xóa tuần này"}
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-soft text-sm">Đang tải...</div>
      ) : (
        <div className="grid grid-cols-7 divide-x divide-hairline">
          {weekDates.map((date, i) => {
            const dayShifts = getShiftsForDate(date);
            const isToday = date === today;
            const d = new Date(date + "T00:00:00");
            return (
              <div key={date} className={`min-h-[110px] p-2 ${isToday ? "bg-primary/5" : ""}`}>
                <div className="text-center mb-2">
                  <div className={`text-[11px] font-bold ${isToday ? "text-primary" : "text-muted"}`}>
                    {DAY_LABELS[i]}
                  </div>
                  <div className={`text-xs font-semibold ${isToday ? "text-primary" : "text-ink"}`}>
                    {d.getDate()}/{d.getMonth() + 1}
                  </div>
                </div>
                {(() => {
                  const dow = JS_DOW[new Date(date + "T00:00:00").getDay()];
                  const isPast = date < today;
                  const alreadyHasSelected = dayShifts.some(a => String(a.shiftId) === selectedShiftId);
                  const canAdd = selectedShiftId && !isPast && !alreadyHasSelected;
                  return (
                    <>
                      {dayShifts.length === 0 && (
                        <div className="text-center text-muted-soft text-[10px] mt-1">—</div>
                      )}
                      {dayShifts.map(a => {
                        const s = shifts.find(sh => sh.name === a.shiftName);
                        return (
                          <div key={a.id} className="relative text-[10px] bg-blue-100 text-blue-700 rounded px-1.5 py-1 mb-1 text-center leading-tight">
                            <div className="font-semibold">{a.shiftName}</div>
                            {s && <div className="text-blue-500 font-mono">{s.startTime}–{s.endTime}</div>}
                            <button onClick={() => onCancel(a.id)} title="Hủy ca này"
                              className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 hover:bg-red-600 text-white rounded-full text-[10px] font-bold flex items-center justify-center leading-none">×</button>
                          </div>
                        );
                      })}
                      {canAdd && (
                        <button onClick={() => onAddDay(dow, date)} disabled={saving}
                          className="w-full mt-1 py-0.5 rounded border border-dashed border-primary/40 text-primary text-[11px] font-bold hover:bg-primary/10 transition-colors disabled:opacity-40"
                          title="Thêm ca vào ngày này">+</button>
                      )}
                      {isPast && !dayShifts.length && (
                        <div className="text-center text-[9px] text-muted-soft mt-1">quá khứ</div>
                      )}
                    </>
                  );
                })()}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function PhanCaPage() {
  const [mainTab, setMainTab] = useState<MainTab>("assign");

  // ── Tab Phân ca ─────────────────────────────────────────────────────────────
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [assignments, setAssignments] = useState<ShiftAssignment[]>([]);
  const [loadingAssign, setLoadingAssign] = useState(false);
  const [toast, setToast] = useState("");
  const [cancelingId, setCancelingId] = useState<number | null>(null);
  const [clearingAll, setClearingAll] = useState(false);
  const [clearingWeek, setClearingWeek] = useState(false);

  const [selectedShiftId, setSelectedShiftId] = useState("");
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [effectiveTo, setEffectiveTo] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  // ── Tab Lịch tuần ───────────────────────────────────────────────────────────
  const [weekOffset, setWeekOffset] = useState(0);
  const [schedule, setSchedule] = useState<ShiftAssignment[]>([]);
  const [loadingSchedule, setLoadingSchedule] = useState(false);

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(""), 3000); }

  // Load employees + shifts
  useEffect(() => {
    Promise.all([
      fetch(`${BASE}/hr/employees?page=0&size=100`, { headers: getAuthHeaders() })
        .then(r => r.text()).then(t => t ? JSON.parse(t) : null),
      fetch(`${BASE}/hr/shifts`, { headers: getAuthHeaders() })
        .then(r => r.text()).then(t => t ? JSON.parse(t) : null),
    ]).then(([empJson, shiftJson]) => {
      if (empJson?.statusCode === 200) setEmployees(empJson.data.content ?? []);
      if (shiftJson?.statusCode === 200) setShifts(shiftJson.data ?? []);
    });
  }, []);

  // Load lịch tuần khi đổi weekOffset hoặc chuyển sang tab schedule
  useEffect(() => {
    if (mainTab !== "schedule") return;
    (async () => {
      setLoadingSchedule(true);
      const res = await fetch(`${BASE}/hr/shifts/schedule?weekOffset=${weekOffset}`, { headers: getAuthHeaders() });
      const text = await res.text();
      if (!text) { setLoadingSchedule(false); return; }
      const json = JSON.parse(text);
      if (json.statusCode === 200) setSchedule(json.data ?? []);
      setLoadingSchedule(false);
    })();
  }, [mainTab, weekOffset]);

  const loadAssignments = useCallback(async (empId: number) => {
    setLoadingAssign(true);
    try {
      const res = await fetch(`${BASE}/hr/shifts/assignments?employeeId=${empId}`, { headers: getAuthHeaders() });
      const text = await res.text();
      if (!text) return;
      const json = JSON.parse(text);
      if (json.statusCode === 200) setAssignments(json.data ?? []);
    } finally { setLoadingAssign(false); }
  }, []);

  function selectEmployee(emp: Employee) {
    setSelectedEmployee(emp);
    setAssignments([]);
    setSelectedShiftId("");
    setSelectedDays([]);
    setEffectiveFrom("");
    setEffectiveTo("");
    setFormError("");
    loadAssignments(emp.id);
  }

  function toggleDay(dow: string) {
    setSelectedDays(prev =>
      prev.includes(dow) ? prev.filter(d => d !== dow) : [...prev, dow]
    );
  }

  async function assignBatch() {
    if (!selectedEmployee) return;
    if (!selectedShiftId) { setFormError("Vui lòng chọn ca làm"); return; }
    if (selectedDays.length === 0) { setFormError("Vui lòng chọn ít nhất 1 ngày trong tuần"); return; }
    if (!effectiveFrom) { setFormError("Vui lòng chọn ngày bắt đầu áp dụng"); return; }
    setSaving(true);
    setFormError("");
    try {
      const body: Record<string, unknown> = {
        employeeId: selectedEmployee.id,
        shiftId: Number(selectedShiftId),
        daysOfWeek: selectedDays,
        effectiveFrom,
      };
      if (effectiveTo) body.effectiveTo = effectiveTo;
      const res = await fetch(`${BASE}/hr/shifts/assign`, {
        method: "POST", headers: getAuthHeaders(), body: JSON.stringify(body),
      });
      const text = await res.text();
      const json = text ? JSON.parse(text) : null;
      if (res.ok && json?.statusCode === 200) {
        const dayLabels = selectedDays.map(d => DOW_VI[d]).join(", ");
        showToast(`Đã thêm lịch: ${dayLabels}`);
        setSelectedDays([]);
        await loadAssignments(selectedEmployee.id);
      } else setFormError(extractApiError(json, "Thêm lịch thất bại"));
    } catch { setFormError("Không kết nối được máy chủ"); }
    finally { setSaving(false); }
  }

  // date = ngày ô được click; nếu user đã điền effectiveFrom thì ưu tiên dùng đó
  async function assignDay(dow: string, date: string) {
    if (!selectedEmployee || !selectedShiftId) {
      setFormError("Vui lòng chọn ca làm trước");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const body: Record<string, unknown> = {
        employeeId: selectedEmployee.id,
        shiftId: Number(selectedShiftId),
        daysOfWeek: [dow],
        effectiveFrom: effectiveFrom || date,
      };
      if (effectiveTo) body.effectiveTo = effectiveTo;
      const res = await fetch(`${BASE}/hr/shifts/assign`, {
        method: "POST", headers: getAuthHeaders(), body: JSON.stringify(body),
      });
      const text = await res.text();
      const json = text ? JSON.parse(text) : null;
      if (res.ok && json?.statusCode === 200) {
        showToast(`Đã thêm ${DOW_VI[dow]}`);
        await loadAssignments(selectedEmployee.id);
      } else setFormError(extractApiError(json, "Thêm lịch thất bại"));
    } catch { setFormError("Không kết nối được máy chủ"); }
    finally { setSaving(false); }
  }

  async function clearAllAssignments() {
    if (!selectedEmployee) return;
    const confirmed = window.confirm(
      `Xóa toàn bộ ${assignments.length} ca của ${selectedEmployee.name}?\nHành động này không thể hoàn tác.`
    );
    if (!confirmed) return;
    setClearingAll(true);
    try {
      const res = await fetch(`${BASE}/hr/shifts/assignments/employee/${selectedEmployee.id}`, {
        method: "DELETE", headers: getAuthHeaders(),
      });
      const text = await res.text();
      const json = text ? JSON.parse(text) : null;
      if (json?.statusCode === 200) {
        showToast(`Đã xóa ${json.data?.count ?? ""} ca của ${selectedEmployee.name}`);
        await loadAssignments(selectedEmployee.id);
      } else showToast(extractApiError(json, "Xóa lịch thất bại"));
    } catch { showToast("Không kết nối được máy chủ"); }
    finally { setClearingAll(false); }
  }

  async function clearWeekAssignments() {
    if (!selectedEmployee) return;
    const weekLabel = weekOffset === 0 ? "tuần này" : weekOffset > 0 ? `tuần +${weekOffset}` : `tuần ${weekOffset}`;
    const weekShifts = assignments.filter(a => {
      const from = a.effectiveFrom;
      const to = a.effectiveTo;
      return (!to || to >= weekDates[0]) && from <= weekDates[6];
    });
    if (weekShifts.length === 0) {
      showToast("Không có lịch nào trong tuần này");
      return;
    }
    const confirmed = window.confirm(
      `Xóa ${weekShifts.length} ca của ${selectedEmployee.name} trong ${weekLabel} (${weekDates[0]} → ${weekDates[6]})?\nHành động này không thể hoàn tác.`
    );
    if (!confirmed) return;
    setClearingWeek(true);
    try {
      const res = await fetch(
        `${BASE}/hr/shifts/assignments/employee/${selectedEmployee.id}/week?weekOffset=${weekOffset}`,
        { method: "DELETE", headers: getAuthHeaders() }
      );
      const text = await res.text();
      const json = text ? JSON.parse(text) : null;
      if (json?.statusCode === 200) {
        showToast(`Đã xóa lịch ${weekLabel} của ${selectedEmployee.name}`);
        await loadAssignments(selectedEmployee.id);
      } else showToast(extractApiError(json, "Xóa lịch tuần thất bại"));
    } catch { showToast("Không kết nối được máy chủ"); }
    finally { setClearingWeek(false); }
  }

  async function cancelAssignment(assignmentId: number) {
    setCancelingId(assignmentId);
    try {
      const res = await fetch(`${BASE}/hr/shifts/assignments/${assignmentId}`, {
        method: "DELETE", headers: getAuthHeaders(),
      });
      const text = await res.text();
      if (!text) { showToast("Lỗi: máy chủ không phản hồi"); return; }
      const json = JSON.parse(text);
      if (json.statusCode === 200) {
        showToast("Đã hủy phân ca");
        if (selectedEmployee) await loadAssignments(selectedEmployee.id);
      } else showToast(extractApiError(json, "Hủy thất bại"));
    } catch { showToast("Không kết nối được máy chủ"); }
    finally { setCancelingId(null); }
  }

  // ── Schedule helpers ─────────────────────────────────────────────────────────
  function localIso(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function getWeekDates(offset: number): string[] {
    const d = new Date();
    const day = d.getDay();
    const monday = new Date(d);
    monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1) + offset * 7);
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      return localIso(date);
    });
  }

  const weekDates = getWeekDates(weekOffset);
  const today = localIso(new Date());
  const scheduleEmployees = [...new Set(schedule.map(a => a.employeeName ?? ""))].filter(Boolean);

  function getCellAssignments(employee: string, date: string) {
    const dow = JS_TO_DOW[new Date(date + "T00:00:00").getDay()];
    return schedule.filter(a => {
      if (a.employeeName !== employee || a.dayOfWeek !== dow || !a.active) return false;
      if (date < a.effectiveFrom) return false;
      if (a.effectiveTo && date > a.effectiveTo) return false;
      return true;
    });
  }

  const activeShifts = shifts.filter(s => s.active);
  const byShift = assignments.reduce<Record<string, ShiftAssignment[]>>((acc, a) => {
    if (!acc[a.shiftName]) acc[a.shiftName] = [];
    acc[a.shiftName].push(a);
    return acc;
  }, {});

  return (
    <div className="p-6">
      {toast && <div className="fixed top-4 right-4 bg-gray-800 text-white text-sm px-4 py-2.5 rounded shadow-lg z-50">{toast}</div>}

      <div className="flex items-center gap-3 mb-5">
        <Link href="/admin/nhan-su" className="text-muted-soft hover:text-gray-600 text-sm">← Nhân sự</Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-bold text-ink">Xếp lịch làm</h1>
      </div>

      {/* Main tabs */}
      <div className="flex gap-1 mb-5 border-b border-hairline">
        {([["assign", "Phân ca nhân viên"], ["schedule", "Lịch tuần"]] as [MainTab, string][]).map(([key, label]) => (
          <button key={key} onClick={() => setMainTab(key)}
            className={`px-5 py-2.5 text-sm font-medium transition-colors ${mainTab === key ? "border-b-2 border-primary text-primary" : "text-muted hover:text-ink"}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab: Phân ca nhân viên ── */}
      {mainTab === "assign" && (
        <div className="flex gap-5">
          {/* Left: employee list */}
          <div className="w-56 flex-shrink-0">
            <div className="bg-canvas rounded-lg border border-hairline overflow-hidden">
              <div className="px-3 py-2.5 bg-surface-soft border-b border-hairline text-xs font-bold text-muted uppercase">
                Nhân viên ({employees.filter(e => e.active).length})
              </div>
              <div className="divide-y divide-hairline max-h-[70vh] overflow-y-auto">
                {employees.filter(e => e.active).length === 0 ? (
                  <div className="text-center py-6 text-muted-soft text-sm">Đang tải...</div>
                ) : employees.filter(e => e.active).map(emp => (
                  <button key={emp.id} onClick={() => selectEmployee(emp)}
                    className={`w-full text-left px-3 py-2.5 text-sm transition-colors ${selectedEmployee?.id === emp.id ? "bg-primary/10 text-primary font-semibold" : "text-ink hover:bg-surface-soft"}`}>
                    <div className="font-medium truncate">{emp.name}</div>
                    <div className="text-xs text-muted-soft">{emp.type === "FULL_TIME" ? "Toàn thời gian" : "Bán thời gian"}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right: assignments */}
          <div className="flex-1 min-w-0">
            {!selectedEmployee ? (
              <div className="bg-canvas rounded-lg border border-hairline-sm flex items-center justify-center h-64 text-muted-soft text-sm">
                Chọn nhân viên ở cột bên trái để xem lịch làm
              </div>
            ) : (
              <>
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-bold text-ink text-lg">{selectedEmployee.name}</h2>
                    <p className="text-xs text-muted-soft">{assignments.length} ca đang hiệu lực</p>
                  </div>
                  {assignments.length > 0 && (
                    <button
                      onClick={clearAllAssignments}
                      disabled={clearingAll}
                      className="flex-shrink-0 px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded hover:bg-red-50 disabled:opacity-40 transition-colors"
                    >
                      {clearingAll ? "Đang xóa..." : "Xóa hết lịch"}
                    </button>
                  )}
                </div>

                {/* Control panel */}
                <div className="bg-canvas rounded-lg border border-hairline p-4 mb-4 space-y-4">
                  {/* 1. Chọn ca */}
                  <div>
                    <label className="block text-[10px] font-bold text-muted uppercase tracking-wide mb-1.5">1. Chọn ca làm</label>
                    <div className="flex gap-2 flex-wrap">
                      {activeShifts.length === 0 ? (
                        <p className="text-sm text-yellow-600">Chưa có ca nào. <Link href="/admin/nhan-su/ca-lam" className="underline">Tạo ca làm trước</Link></p>
                      ) : activeShifts.map(s => (
                        <button key={s.id} type="button"
                          onClick={() => { setSelectedShiftId(String(s.id)); setFormError(""); }}
                          className={`px-3 py-1.5 rounded border text-sm transition-colors ${selectedShiftId === String(s.id) ? "border-primary bg-primary/10 text-primary font-semibold" : "border-hairline text-ink hover:border-primary"}`}>
                          <span className="font-medium">{s.name}</span>
                          <span className="text-xs text-muted-soft ml-1.5">{s.startTime}–{s.endTime}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 2. Chọn ngày trong tuần */}
                  <div>
                    <div className="flex items-center gap-3 mb-1.5">
                      <label className="text-[10px] font-bold text-muted uppercase tracking-wide">2. Ngày trong tuần</label>
                      <button type="button" onClick={() => setSelectedDays(selectedDays.length === 7 ? [] : [...DOW_ORDER])}
                        className="text-[10px] text-primary hover:underline">
                        {selectedDays.length === 7 ? "Bỏ chọn tất" : "Chọn tất cả"}
                      </button>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {DOW_ORDER.map((dow, i) => {
                        const checked = selectedDays.includes(dow);
                        return (
                          <button key={dow} type="button" onClick={() => { toggleDay(dow); setFormError(""); }}
                            className={`w-10 h-10 rounded-full text-xs font-bold border transition-colors ${checked ? "bg-primary text-white border-primary" : "border-hairline text-muted hover:border-primary hover:text-primary"}`}>
                            {DAY_LABELS[i]}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 3. Khoảng thời gian */}
                  <div>
                    <label className="block text-[10px] font-bold text-muted uppercase tracking-wide mb-1.5">3. Thời gian áp dụng</label>
                    <div className="flex gap-3 items-end flex-wrap">
                      <div>
                        <label className="block text-[10px] text-muted mb-0.5">Từ ngày <span className="text-red-400">*</span></label>
                        <input type="date" value={effectiveFrom}
                          onChange={e => { setEffectiveFrom(e.target.value); setFormError(""); }}
                          className="border border-hairline px-2 py-1.5 text-sm outline-none focus:border-primary rounded" />
                      </div>
                      <div>
                        <label className="block text-[10px] text-muted mb-0.5">Đến ngày <span className="text-muted-soft">(trống = vô hạn)</span></label>
                        <input type="date" value={effectiveTo}
                          onChange={e => setEffectiveTo(e.target.value)}
                          min={effectiveFrom || undefined}
                          className="border border-hairline px-2 py-1.5 text-sm outline-none focus:border-primary rounded" />
                      </div>
                      {(effectiveFrom || effectiveTo) && (
                        <button type="button" onClick={() => { setEffectiveFrom(""); setEffectiveTo(""); }}
                          className="text-xs text-muted-soft hover:text-red-400 pb-1.5">✕ Xóa ngày</button>
                      )}
                    </div>
                  </div>

                  {/* Submit */}
                  <div className="flex items-center gap-3 pt-1 border-t border-hairline">
                    <button type="button" onClick={assignBatch} disabled={saving}
                      className="px-5 py-2 bg-primary text-white text-sm font-semibold rounded hover:bg-primary-dark disabled:opacity-40 transition-colors">
                      {saving ? "Đang thêm..." : "Thêm lịch"}
                    </button>
                    <p className="text-xs text-muted-soft">
                      Hoặc chọn ca rồi bấm <span className="font-bold text-primary">+</span> trực tiếp vào ô ngày trong lịch bên dưới
                    </p>
                  </div>

                  {formError && <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-2 rounded">{formError}</div>}
                </div>

                {/* Lịch tuần của nhân viên được chọn */}
                <EmpWeekCalendar
                  weekDates={weekDates}
                  weekOffset={weekOffset}
                  setWeekOffset={setWeekOffset}
                  today={today}
                  assignments={assignments}
                  shifts={shifts}
                  loading={loadingAssign}
                  selectedShiftId={selectedShiftId}
                  saving={saving}
                  onAddDay={assignDay}
                  onCancel={cancelAssignment}
                  onClearWeek={clearWeekAssignments}
                  clearingWeek={clearingWeek}
                />
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Tab: Lịch tuần ── */}
      {mainTab === "schedule" && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <button onClick={() => setWeekOffset(v => v - 1)}
              className="px-3 py-1.5 border rounded text-sm hover:bg-surface-soft">← Tuần trước</button>
            {weekOffset !== 0 && (
              <button onClick={() => setWeekOffset(0)}
                className="px-3 py-1.5 bg-canvas text-sm rounded hover:bg-surface-card">Tuần này</button>
            )}
            <button onClick={() => setWeekOffset(v => v + 1)}
              className="px-3 py-1.5 border rounded text-sm hover:bg-surface-soft">Tuần sau →</button>
            <span className="ml-2 text-xs text-muted-soft">{weekDates[0]} → {weekDates[6]}</span>
          </div>

          {loadingSchedule ? (
            <div className="text-center py-8 text-muted-soft">Đang tải...</div>
          ) : (
            <div className="bg-canvas rounded-lg border border-hairline-sm overflow-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead>
                  <tr className="bg-surface-soft border-b text-xs text-muted">
                    <th className="text-left px-4 py-3 w-36 font-semibold">Nhân viên</th>
                    {weekDates.map((date, i) => (
                      <th key={date} className={`text-center px-2 py-3 font-semibold ${date === today ? "bg-primary/5" : ""}`}>
                        <div className={date === today ? "text-primary font-bold" : ""}>
                          {["T2","T3","T4","T5","T6","T7","CN"][i]}
                        </div>
                        <div className={`text-xs font-normal ${date === today ? "text-primary" : "text-muted-soft"}`}>
                          {(() => { const d = new Date(date + "T00:00:00"); return `${d.getDate()}/${d.getMonth()+1}`; })()}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {scheduleEmployees.length === 0 ? (
                    <tr><td colSpan={8} className="text-center py-8 text-muted-soft">Chưa có lịch làm trong tuần này</td></tr>
                  ) : scheduleEmployees.map(emp => (
                    <tr key={emp} className="hover:bg-surface-soft">
                      <td className="px-4 py-2 font-medium text-ink whitespace-nowrap">{emp}</td>
                      {weekDates.map(date => {
                        const dayAssignments = getCellAssignments(emp, date);
                        return (
                          <td key={date} className={`px-2 py-2 text-center align-top ${date === today ? "bg-primary/5" : ""}`}>
                            {dayAssignments.map(a => (
                              <div key={a.id} className="text-xs bg-blue-100 text-blue-700 rounded px-1.5 py-0.5 mb-0.5 whitespace-nowrap">
                                {a.shiftName}
                              </div>
                            ))}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!loadingSchedule && schedule.length > 0 && (
            <p className="text-xs text-muted-soft mt-3">* Lịch hiển thị dựa trên ca phân công đang hiệu lực trong tuần này</p>
          )}
        </div>
      )}
    </div>
  );
}
