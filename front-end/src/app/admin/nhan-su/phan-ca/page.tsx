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
  MONDAY: "T2", TUESDAY: "T3", WEDNESDAY: "T4",
  THURSDAY: "T5", FRIDAY: "T6", SATURDAY: "T7", SUNDAY: "CN",
};
const DOW_VI_FULL: Record<string, string> = {
  MONDAY: "Thứ 2", TUESDAY: "Thứ 3", WEDNESDAY: "Thứ 4",
  THURSDAY: "Thứ 5", FRIDAY: "Thứ 6", SATURDAY: "Thứ 7", SUNDAY: "Chủ nhật",
};
const DOW_ORDER = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
const JS_TO_DOW: Record<number, string> = {
  0: "SUNDAY", 1: "MONDAY", 2: "TUESDAY", 3: "WEDNESDAY",
  4: "THURSDAY", 5: "FRIDAY", 6: "SATURDAY",
};

function localIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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

function initials(name: string) {
  const p = name.trim().split(" ");
  return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
}

type MobileView = "list" | "detail";

export default function PhanCaPage() {
  const [mobileView, setMobileView] = useState<MobileView>("list");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [assignments, setAssignments] = useState<ShiftAssignment[]>([]);
  const [loadingAssign, setLoadingAssign] = useState(false);
  const [toast, setToast] = useState("");
  const [cancelingId, setCancelingId] = useState<number | null>(null);
  const [clearingAll, setClearingAll] = useState(false);
  const [clearingWeek, setClearingWeek] = useState(false);

  // Multi-select shifts
  const [selectedShiftIds, setSelectedShiftIds] = useState<number[]>([]);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [effectiveTo, setEffectiveTo] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);

  // Schedule tab
  const [scheduleWeekOffset, setScheduleWeekOffset] = useState(0);
  const [schedule, setSchedule] = useState<ShiftAssignment[]>([]);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [activeTab, setActiveTab] = useState<"assign" | "schedule">("assign");

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(""), 3000); }

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

  useEffect(() => {
    if (activeTab !== "schedule") return;
    (async () => {
      setLoadingSchedule(true);
      const res = await fetch(`${BASE}/hr/shifts/schedule?weekOffset=${scheduleWeekOffset}`, { headers: getAuthHeaders() });
      const text = await res.text();
      if (!text) { setLoadingSchedule(false); return; }
      const json = JSON.parse(text);
      if (json.statusCode === 200) setSchedule(json.data ?? []);
      setLoadingSchedule(false);
    })();
  }, [activeTab, scheduleWeekOffset]);

  const loadAssignments = useCallback(async (empId: number) => {
    setLoadingAssign(true);
    try {
      const res = await fetch(`${BASE}/hr/shifts/assignments?employeeId=${empId}`, { headers: getAuthHeaders() });
      const text = await res.text();
      const json = text ? JSON.parse(text) : null;
      if (json?.statusCode === 200) setAssignments(json.data ?? []);
    } finally { setLoadingAssign(false); }
  }, []);

  function selectEmployee(emp: Employee) {
    setSelectedEmployee(emp);
    setAssignments([]);
    setSelectedShiftIds([]); setSelectedDays([]);
    setEffectiveFrom(""); setEffectiveTo(""); setFormError("");
    loadAssignments(emp.id);
    setMobileView("detail");
  }

  function toggleShift(id: number) {
    setSelectedShiftIds(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
    setFormError("");
  }

  function toggleDay(dow: string) {
    setSelectedDays(prev => prev.includes(dow) ? prev.filter(d => d !== dow) : [...prev, dow]);
  }

  async function assignBatch() {
    if (!selectedEmployee) return;
    if (selectedShiftIds.length === 0) { setFormError("Vui lòng chọn ít nhất 1 ca làm"); return; }
    if (selectedDays.length === 0) { setFormError("Vui lòng chọn ít nhất 1 ngày"); return; }
    if (!effectiveFrom) { setFormError("Vui lòng chọn ngày bắt đầu áp dụng"); return; }
    setSaving(true); setFormError("");
    try {
      const results = await Promise.all(
        selectedShiftIds.map(shiftId => {
          const body: Record<string, unknown> = {
            employeeId: selectedEmployee.id, shiftId,
            daysOfWeek: selectedDays, effectiveFrom,
          };
          if (effectiveTo) body.effectiveTo = effectiveTo;
          return fetch(`${BASE}/hr/shifts/assign`, {
            method: "POST", headers: getAuthHeaders(), body: JSON.stringify(body),
          }).then(r => r.text()).then(t => t ? JSON.parse(t) : null);
        })
      );
      const failed = results.find(r => !r || r.statusCode !== 200);
      if (!failed) {
        const names = selectedShiftIds
          .map(id => shifts.find(s => s.id === id)?.name ?? "Ca")
          .join(" + ");
        showToast(`Đã thêm: ${names} — ${selectedDays.map(d => DOW_VI[d]).join(", ")}`);
        setSelectedShiftIds([]);
        await loadAssignments(selectedEmployee.id);
      } else {
        setFormError(extractApiError(failed, "Thêm lịch thất bại"));
      }
    } catch { setFormError("Không kết nối được máy chủ"); }
    finally { setSaving(false); }
  }

  async function cancelAssignment(id: number) {
    setCancelingId(id);
    try {
      const res = await fetch(`${BASE}/hr/shifts/assignments/${id}`, { method: "DELETE", headers: getAuthHeaders() });
      const json = JSON.parse(await res.text() || "null");
      if (json?.statusCode === 200) {
        showToast("Đã hủy ca"); if (selectedEmployee) await loadAssignments(selectedEmployee.id);
      } else showToast(extractApiError(json, "Hủy thất bại"));
    } catch { showToast("Không kết nối được máy chủ"); }
    finally { setCancelingId(null); }
  }

  async function clearAllAssignments() {
    if (!selectedEmployee) return;
    if (!window.confirm(`Xóa toàn bộ ${assignments.length} ca của ${selectedEmployee.name}?`)) return;
    setClearingAll(true);
    try {
      const res = await fetch(`${BASE}/hr/shifts/assignments/employee/${selectedEmployee.id}`, {
        method: "DELETE", headers: getAuthHeaders(),
      });
      const json = JSON.parse(await res.text() || "null");
      if (json?.statusCode === 200) {
        showToast(`Đã xóa lịch của ${selectedEmployee.name}`);
        await loadAssignments(selectedEmployee.id);
      } else showToast(extractApiError(json, "Xóa thất bại"));
    } catch { showToast("Không kết nối được máy chủ"); }
    finally { setClearingAll(false); }
  }

  async function clearWeekAssignments() {
    if (!selectedEmployee) return;
    const wDates = getWeekDates(weekOffset);
    const weekShifts = assignments.filter(a => (!a.effectiveTo || a.effectiveTo >= wDates[0]) && a.effectiveFrom <= wDates[6]);
    if (!weekShifts.length) { showToast("Không có lịch trong tuần này"); return; }
    if (!window.confirm(`Xóa ${weekShifts.length} ca của ${selectedEmployee.name} tuần này?`)) return;
    setClearingWeek(true);
    try {
      const res = await fetch(
        `${BASE}/hr/shifts/assignments/employee/${selectedEmployee.id}/week?weekOffset=${weekOffset}`,
        { method: "DELETE", headers: getAuthHeaders() }
      );
      const json = JSON.parse(await res.text() || "null");
      if (json?.statusCode === 200) {
        showToast("Đã xóa lịch tuần"); await loadAssignments(selectedEmployee.id);
      } else showToast(extractApiError(json, "Xóa tuần thất bại"));
    } catch { showToast("Không kết nối được máy chủ"); }
    finally { setClearingWeek(false); }
  }

  const weekDates = getWeekDates(weekOffset);
  const today = localIso(new Date());
  const activeShifts = shifts.filter(s => s.active);
  const activeEmployees = employees.filter(e => e.active);

  // For schedule tab
  const scheduleWeekDates = getWeekDates(scheduleWeekOffset);
  const scheduleEmployees = [...new Set(schedule.map(a => a.employeeName ?? ""))].filter(Boolean);
  function getScheduleCell(emp: string, date: string) {
    const dow = JS_TO_DOW[new Date(date + "T00:00:00").getDay()];
    return schedule.filter(a => a.employeeName === emp && a.dayOfWeek === dow && a.active
      && date >= a.effectiveFrom && (!a.effectiveTo || date <= a.effectiveTo));
  }

  // Assignments grouped by shift for view
  function getAssignmentsForDate(date: string) {
    const dow = JS_TO_DOW[new Date(date + "T00:00:00").getDay()];
    return assignments.filter(a => a.dayOfWeek === dow && a.active
      && date >= a.effectiveFrom && (!a.effectiveTo || date <= a.effectiveTo));
  }

  async function quickAddToDay(dow: string, date: string) {
    if (!selectedEmployee || selectedShiftIds.length === 0) return;
    const dayShiftsForDow = getAssignmentsForDate(date);
    const toAdd = selectedShiftIds.filter(id => !dayShiftsForDow.some(a => a.shiftId === id));
    if (toAdd.length === 0) return;
    setSaving(true);
    try {
      const results = await Promise.all(toAdd.map(shiftId => {
        const body: Record<string, unknown> = {
          employeeId: selectedEmployee.id, shiftId, daysOfWeek: [dow],
          effectiveFrom: effectiveFrom || date,
        };
        if (effectiveTo) body.effectiveTo = effectiveTo;
        return fetch(`${BASE}/hr/shifts/assign`, { method: "POST", headers: getAuthHeaders(), body: JSON.stringify(body) })
          .then(r => r.text()).then(t => t ? JSON.parse(t) : null);
      }));
      const failed = results.find(r => !r || r.statusCode !== 200);
      if (!failed) showToast(`Đã thêm ${DOW_VI_FULL[dow]}`);
      else showToast(extractApiError(failed, "Thất bại"));
      loadAssignments(selectedEmployee.id);
    } catch { showToast("Lỗi kết nối"); }
    finally { setSaving(false); }
  }

  return (
    <div className="p-3 md:p-6">
      {toast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 md:top-4 md:right-4 md:left-auto md:translate-x-0 bg-gray-800 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg z-50 whitespace-nowrap">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        {mobileView === "detail" ? (
          <button
            onPointerDown={e => { if (e.pointerType === "touch") { e.preventDefault(); setMobileView("list"); } }}
            onClick={() => setMobileView("list")}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-surface-card text-muted hover:bg-hairline touch-manipulation"
            style={{ WebkitTapHighlightColor: "transparent" }}>←</button>
        ) : (
          <Link href="/admin/nhan-su"
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-surface-card text-muted hover:bg-hairline touch-manipulation"
            style={{ WebkitTapHighlightColor: "transparent" }}>←</Link>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-ink truncate">
            {mobileView === "detail" && selectedEmployee ? selectedEmployee.name : "Xếp lịch làm"}
          </h1>
          <p className="text-xs text-muted">
            {mobileView === "detail" && selectedEmployee
              ? `${assignments.filter(a => a.active).length} ca đang áp dụng`
              : "Phân ca theo nhân viên"}
          </p>
        </div>
        {/* Desktop back */}
        <Link href="/admin/nhan-su" className="hidden md:flex items-center gap-1 text-sm text-muted hover:text-ink">
          ← Nhân sự
        </Link>
      </div>

      {/* ═══ TABS (both mobile detail + desktop) ═══ */}
      <div className={`${mobileView === "list" ? "hidden md:flex" : "flex"} gap-1 mb-4 border-b border-hairline`}>
        {(["assign", "schedule"] as const).map((tab, i) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === tab ? "border-b-2 border-primary text-primary" : "text-muted hover:text-ink"}`}>
            {i === 0 ? "Phân ca NV" : "Lịch tuần"}
          </button>
        ))}
      </div>

      {/* ═══ MOBILE: EMPLOYEE LIST (mobileView === "list", activeTab === "assign") ═══ */}
      {mobileView === "list" && activeTab === "assign" && (
        <div className="block md:hidden">
          <p className="text-xs text-muted mb-3">Chọn nhân viên để xem và xếp lịch</p>
          {activeEmployees.length === 0 ? (
            <div className="bg-white rounded-2xl border border-hairline p-8 text-center text-muted-soft text-sm">Đang tải...</div>
          ) : (
            <div className="space-y-2">
              {activeEmployees.map(emp => (
                <button key={emp.id}
                  onPointerDown={e => { if (e.pointerType === "touch") { e.preventDefault(); selectEmployee(emp); } }}
                  onClick={() => selectEmployee(emp)}
                  className="w-full bg-white rounded-2xl border border-hairline p-4 flex items-center gap-3 hover:border-primary/30 touch-manipulation text-left"
                  style={{ WebkitTapHighlightColor: "transparent" }}>
                  <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                    {initials(emp.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-ink text-sm">{emp.name}</div>
                    <div className="text-xs text-muted mt-0.5">{emp.type === "FULL_TIME" ? "Toàn thời gian" : "Bán thời gian"}</div>
                  </div>
                  <span className="text-muted text-sm shrink-0">→</span>
                </button>
              ))}
            </div>
          )}
          {/* Mobile schedule tab button */}
          <div className="mt-4 pt-4 border-t border-hairline">
            <button onClick={() => { setActiveTab("schedule"); setMobileView("detail"); }}
              className="w-full py-3 bg-surface-card text-ink text-sm font-semibold rounded-xl hover:bg-hairline touch-manipulation"
              style={{ WebkitTapHighlightColor: "transparent" }}>
              🗓️ Xem lịch tuần toàn bộ →
            </button>
          </div>
        </div>
      )}

      {/* ═══ MOBILE: SCHEDULE TAB ═══ */}
      {mobileView === "detail" && activeTab === "schedule" && (
        <div className="block md:hidden">
          {/* Week nav */}
          <div className="flex items-center gap-2 mb-3 overflow-x-auto">
            <button onClick={() => setScheduleWeekOffset(v => v - 1)}
              className="px-3 py-1.5 border border-hairline rounded-xl text-sm hover:bg-surface-soft shrink-0 touch-manipulation"
              style={{ WebkitTapHighlightColor: "transparent" }}>← Trước</button>
            {scheduleWeekOffset !== 0 && (
              <button onClick={() => setScheduleWeekOffset(0)}
                className="px-3 py-1.5 border border-hairline rounded-xl text-sm hover:bg-surface-soft shrink-0 touch-manipulation"
                style={{ WebkitTapHighlightColor: "transparent" }}>Tuần này</button>
            )}
            <button onClick={() => setScheduleWeekOffset(v => v + 1)}
              className="px-3 py-1.5 border border-hairline rounded-xl text-sm hover:bg-surface-soft shrink-0 touch-manipulation"
              style={{ WebkitTapHighlightColor: "transparent" }}>Sau →</button>
            <span className="text-xs text-muted-soft shrink-0 ml-auto">{scheduleWeekDates[0]} → {scheduleWeekDates[6]}</span>
          </div>
          {loadingSchedule ? (
            <div className="text-center py-8 text-muted-soft text-sm">Đang tải...</div>
          ) : scheduleEmployees.length === 0 ? (
            <div className="bg-white rounded-2xl border border-hairline p-8 text-center text-muted-soft text-sm">Chưa có lịch tuần này</div>
          ) : (
            <div className="space-y-2">
              {scheduleEmployees.map(emp => (
                <div key={emp} className="bg-white rounded-2xl border border-hairline p-4">
                  <div className="font-semibold text-ink text-sm mb-3">{emp}</div>
                  <div className="grid grid-cols-7 gap-1">
                    {scheduleWeekDates.map((date, i) => {
                      const day = getScheduleCell(emp, date);
                      const isToday = date === today;
                      return (
                        <div key={date} className={`text-center rounded-lg py-1.5 ${isToday ? "bg-primary/10" : "bg-surface-card"}`}>
                          <div className={`text-[10px] font-bold ${isToday ? "text-primary" : "text-muted"}`}>
                            {["T2","T3","T4","T5","T6","T7","CN"][i]}
                          </div>
                          {day.map(a => (
                            <div key={a.id} className="text-[9px] bg-blue-100 text-blue-700 rounded px-0.5 py-0.5 mt-0.5 leading-tight font-medium">
                              {a.shiftName}
                            </div>
                          ))}
                          {!day.length && <div className="text-[10px] text-muted-soft mt-1">—</div>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ MOBILE: ASSIGN DETAIL (mobileView === "detail", activeTab === "assign") ═══ */}
      {mobileView === "detail" && activeTab === "assign" && selectedEmployee && (
        <div className="block md:hidden">
          {/* Employee actions */}
          {assignments.filter(a => a.active).length > 0 && (
            <div className="flex gap-2 mb-4">
              <button onClick={clearAllAssignments} disabled={clearingAll}
                className="px-3 py-2 text-xs font-semibold text-red-600 border border-red-200 rounded-xl hover:bg-red-50 disabled:opacity-40 touch-manipulation"
                style={{ WebkitTapHighlightColor: "transparent" }}>
                {clearingAll ? "Đang xóa..." : "Xóa hết lịch"}
              </button>
            </div>
          )}

          {/* 1. Chọn ca — multi-select */}
          <div className="bg-white rounded-2xl border border-hairline p-4 mb-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-bold text-muted uppercase">1. Chọn ca làm</div>
              {selectedShiftIds.length > 0 && (
                <span className="text-[10px] text-primary font-semibold bg-primary/10 px-2 py-0.5 rounded-full">
                  {selectedShiftIds.length} ca đã chọn
                </span>
              )}
            </div>
            {activeShifts.length === 0 ? (
              <p className="text-sm text-yellow-600">Chưa có ca nào. <Link href="/admin/nhan-su/ca-lam" className="underline">Tạo ca làm trước</Link></p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {activeShifts.map(s => {
                  const checked = selectedShiftIds.includes(s.id);
                  return (
                    <button key={s.id}
                      onPointerDown={e => { if (e.pointerType === "touch") { e.preventDefault(); toggleShift(s.id); } }}
                      onClick={() => toggleShift(s.id)}
                      className={`px-3 py-2 rounded-xl border text-xs transition-colors touch-manipulation ${checked ? "border-primary bg-primary/10 text-primary font-bold ring-1 ring-primary/30" : "border-hairline text-ink hover:border-primary"}`}
                      style={{ WebkitTapHighlightColor: "transparent" }}>
                      <div className="flex items-center gap-1.5">
                        <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${checked ? "bg-primary border-primary" : "border-gray-300"}`}>
                          {checked && <span className="text-white text-[8px] font-bold leading-none">✓</span>}
                        </span>
                        <span className="font-semibold">{s.name}</span>
                      </div>
                      <div className="text-muted-soft mt-0.5 pl-5">{s.startTime}–{s.endTime}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 2. Chọn ngày trong tuần */}
          <div className="bg-white rounded-2xl border border-hairline p-4 mb-3">
            <div className="flex items-center gap-3 mb-2">
              <div className="text-xs font-bold text-muted uppercase">2. Ngày trong tuần</div>
              <button onClick={() => setSelectedDays(selectedDays.length === 7 ? [] : [...DOW_ORDER])}
                className="text-xs text-primary hover:underline touch-manipulation"
                style={{ WebkitTapHighlightColor: "transparent" }}>
                {selectedDays.length === 7 ? "Bỏ tất" : "Chọn tất"}
              </button>
            </div>
            <div className="flex gap-2">
              {DOW_ORDER.map((dow) => {
                const checked = selectedDays.includes(dow);
                return (
                  <button key={dow}
                    onPointerDown={e => { if (e.pointerType === "touch") { e.preventDefault(); toggleDay(dow); setFormError(""); } }}
                    onClick={() => { toggleDay(dow); setFormError(""); }}
                    className={`flex-1 aspect-square rounded-full text-xs font-bold border transition-colors touch-manipulation ${checked ? "bg-primary text-white border-primary" : "border-hairline text-muted hover:border-primary"}`}
                    style={{ WebkitTapHighlightColor: "transparent" }}>
                    {DOW_VI[dow]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Thời gian áp dụng */}
          <div className="bg-white rounded-2xl border border-hairline p-4 mb-3">
            <div className="text-xs font-bold text-muted uppercase mb-2">3. Thời gian áp dụng</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-muted mb-1">Từ ngày <span className="text-red-400">*</span></label>
                <input type="date" value={effectiveFrom}
                  onChange={e => { setEffectiveFrom(e.target.value); setFormError(""); }}
                  className="w-full border border-hairline px-3 py-2 text-sm outline-none focus:border-primary rounded-xl" />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">Đến ngày <span className="text-muted-soft text-[10px]">(bỏ trống = vô hạn)</span></label>
                <input type="date" value={effectiveTo}
                  onChange={e => setEffectiveTo(e.target.value)}
                  min={effectiveFrom || undefined}
                  className="w-full border border-hairline px-3 py-2 text-sm outline-none focus:border-primary rounded-xl" />
              </div>
            </div>
          </div>

          {formError && <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-2.5 rounded-xl mb-3">{formError}</div>}

          <button onClick={assignBatch} disabled={saving}
            onPointerDown={e => { if (e.pointerType === "touch") { e.preventDefault(); if (!saving) assignBatch(); } }}
            className="w-full py-3 bg-primary text-white text-sm font-bold rounded-xl hover:bg-primary-dark disabled:opacity-50 mb-4 touch-manipulation"
            style={{ WebkitTapHighlightColor: "transparent" }}>
            {saving ? "Đang thêm..." : selectedShiftIds.length > 1 ? `Thêm ${selectedShiftIds.length} ca vào lịch` : "Thêm lịch"}
          </button>

          {/* Week calendar — horizontal scroll */}
          <div className="bg-white rounded-2xl border border-hairline overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-hairline bg-surface-soft">
              <button onClick={() => setWeekOffset(v => v - 1)}
                className="px-2.5 py-1.5 border border-hairline rounded-xl text-xs hover:bg-canvas touch-manipulation"
                style={{ WebkitTapHighlightColor: "transparent" }}>← Trước</button>
              {weekOffset !== 0 && (
                <button onClick={() => setWeekOffset(0)}
                  className="px-2.5 py-1.5 border border-hairline rounded-xl text-xs hover:bg-canvas touch-manipulation"
                  style={{ WebkitTapHighlightColor: "transparent" }}>Tuần này</button>
              )}
              <button onClick={() => setWeekOffset(v => v + 1)}
                className="px-2.5 py-1.5 border border-hairline rounded-xl text-xs hover:bg-canvas touch-manipulation"
                style={{ WebkitTapHighlightColor: "transparent" }}>Sau →</button>
              <button onClick={clearWeekAssignments} disabled={clearingWeek}
                className="ml-auto px-2.5 py-1.5 text-xs text-red-500 border border-red-200 rounded-xl hover:bg-red-50 disabled:opacity-40 touch-manipulation"
                style={{ WebkitTapHighlightColor: "transparent" }}>
                {clearingWeek ? "..." : "Xóa tuần"}
              </button>
            </div>
            {loadingAssign ? (
              <div className="text-center py-8 text-muted-soft text-sm">Đang tải...</div>
            ) : (
              <div className="overflow-x-auto">
                <div className="grid grid-cols-7 divide-x divide-hairline min-w-[320px]">
                  {weekDates.map((date, i) => {
                    const dayShifts = getAssignmentsForDate(date);
                    const isToday = date === today;
                    const d = new Date(date + "T00:00:00");
                    const dow = JS_TO_DOW[d.getDay()];
                    const isPast = date < today;
                    const shiftsToAdd = selectedShiftIds.filter(id => !dayShifts.some(a => a.shiftId === id));
                    const canAdd = shiftsToAdd.length > 0 && !isPast;
                    return (
                      <div key={date} className={`min-h-[90px] p-1.5 ${isToday ? "bg-primary/5" : ""}`}>
                        <div className="text-center mb-1.5">
                          <div className={`text-[10px] font-bold ${isToday ? "text-primary" : "text-muted"}`}>
                            {["T2","T3","T4","T5","T6","T7","CN"][i]}
                          </div>
                          <div className={`text-[10px] font-semibold ${isToday ? "text-primary" : "text-ink"}`}>
                            {d.getDate()}/{d.getMonth() + 1}
                          </div>
                        </div>
                        {dayShifts.length === 0 && <div className="text-center text-muted-soft text-[9px]">—</div>}
                        {dayShifts.map(a => (
                          <div key={a.id} className="relative text-[9px] bg-blue-100 text-blue-700 rounded px-1 py-0.5 mb-1 text-center leading-tight">
                            <div className="font-semibold truncate">{a.shiftName}</div>
                            <button onClick={() => cancelAssignment(a.id)} disabled={cancelingId === a.id}
                              className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 text-white rounded-full text-[8px] font-bold flex items-center justify-center leading-none touch-manipulation"
                              style={{ WebkitTapHighlightColor: "transparent" }}>×</button>
                          </div>
                        ))}
                        {canAdd && (
                          <button
                            onPointerDown={e => { if (e.pointerType === "touch") { e.preventDefault(); if (!saving) quickAddToDay(dow, date); } }}
                            onClick={() => quickAddToDay(dow, date)} disabled={saving}
                            className="w-full mt-0.5 py-0.5 rounded border border-dashed border-primary/40 text-primary text-[10px] font-bold hover:bg-primary/10 touch-manipulation"
                            style={{ WebkitTapHighlightColor: "transparent" }}>
                            +{shiftsToAdd.length > 1 ? shiftsToAdd.length : ""}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ DESKTOP LAYOUT ═══ */}
      <div className="hidden md:block">
        {activeTab === "assign" ? (
          <div className="flex gap-5">
            {/* Left: employee list */}
            <div className="w-56 flex-shrink-0">
              <div className="bg-canvas rounded-lg border border-hairline overflow-hidden">
                <div className="px-3 py-2.5 bg-surface-soft border-b border-hairline text-xs font-bold text-muted uppercase">
                  Nhân viên ({activeEmployees.length})
                </div>
                <div className="divide-y divide-hairline max-h-[70vh] overflow-y-auto">
                  {activeEmployees.length === 0 ? (
                    <div className="text-center py-6 text-muted-soft text-sm">Đang tải...</div>
                  ) : activeEmployees.map(emp => (
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
                <div className="bg-canvas rounded-lg border border-hairline flex items-center justify-center h-64 text-muted-soft text-sm">
                  Chọn nhân viên bên trái để xem lịch làm
                </div>
              ) : (
                <>
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-bold text-ink text-lg">{selectedEmployee.name}</h2>
                      <p className="text-xs text-muted-soft">{assignments.filter(a => a.active).length} ca đang hiệu lực</p>
                    </div>
                    {assignments.filter(a => a.active).length > 0 && (
                      <button onClick={clearAllAssignments} disabled={clearingAll}
                        className="flex-shrink-0 px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded hover:bg-red-50 disabled:opacity-40">
                        {clearingAll ? "Đang xóa..." : "Xóa hết lịch"}
                      </button>
                    )}
                  </div>

                  {/* Control panel */}
                  <div className="bg-canvas rounded-lg border border-hairline p-4 mb-4 space-y-4">
                    {/* Step 1: multi-select shifts */}
                    <div>
                      <div className="flex items-center gap-3 mb-1.5">
                        <label className="block text-[10px] font-bold text-muted uppercase tracking-wide">1. Chọn ca làm</label>
                        {selectedShiftIds.length > 0 && (
                          <span className="text-[10px] text-primary font-semibold bg-primary/10 px-2 py-0.5 rounded-full">
                            {selectedShiftIds.length} ca đã chọn
                          </span>
                        )}
                        {selectedShiftIds.length > 0 && (
                          <button type="button" onClick={() => { setSelectedShiftIds([]); setFormError(""); }}
                            className="text-[10px] text-muted-soft hover:text-red-400">✕ Bỏ chọn</button>
                        )}
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {activeShifts.length === 0 ? (
                          <p className="text-sm text-yellow-600">Chưa có ca nào. <Link href="/admin/nhan-su/ca-lam" className="underline">Tạo ca làm trước</Link></p>
                        ) : activeShifts.map(s => {
                          const checked = selectedShiftIds.includes(s.id);
                          return (
                            <button key={s.id} onClick={() => toggleShift(s.id)}
                              className={`px-3 py-1.5 rounded border text-sm transition-colors flex items-center gap-2 ${checked ? "border-primary bg-primary/10 text-primary font-semibold ring-1 ring-primary/20" : "border-hairline text-ink hover:border-primary"}`}>
                              <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${checked ? "bg-primary border-primary" : "border-gray-300"}`}>
                                {checked && <span className="text-white text-[9px] font-bold leading-none">✓</span>}
                              </span>
                              <span className="font-medium">{s.name}</span>
                              <span className="text-xs text-muted-soft">{s.startTime}–{s.endTime}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Step 2: days */}
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
                              {["T2","T3","T4","T5","T6","T7","CN"][i]}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Step 3: date range */}
                    <div>
                      <label className="block text-[10px] font-bold text-muted uppercase tracking-wide mb-1.5">3. Thời gian áp dụng</label>
                      <div className="flex gap-3 items-end flex-wrap">
                        <div>
                          <label className="block text-[10px] text-muted mb-0.5">Từ ngày <span className="text-red-400">*</span></label>
                          <input type="date" value={effectiveFrom} onChange={e => { setEffectiveFrom(e.target.value); setFormError(""); }}
                            className="border border-hairline px-2 py-1.5 text-sm outline-none focus:border-primary rounded" />
                        </div>
                        <div>
                          <label className="block text-[10px] text-muted mb-0.5">Đến ngày <span className="text-muted-soft">(trống = vô hạn)</span></label>
                          <input type="date" value={effectiveTo} onChange={e => setEffectiveTo(e.target.value)}
                            min={effectiveFrom || undefined}
                            className="border border-hairline px-2 py-1.5 text-sm outline-none focus:border-primary rounded" />
                        </div>
                        {(effectiveFrom || effectiveTo) && (
                          <button type="button" onClick={() => { setEffectiveFrom(""); setEffectiveTo(""); }}
                            className="text-xs text-muted-soft hover:text-red-400 pb-1.5">✕ Xóa ngày</button>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 pt-1 border-t border-hairline">
                      <button type="button" onClick={assignBatch} disabled={saving}
                        className="px-5 py-2 bg-primary text-white text-sm font-semibold rounded hover:bg-primary-dark disabled:opacity-40">
                        {saving ? "Đang thêm..." : selectedShiftIds.length > 1 ? `Thêm ${selectedShiftIds.length} ca vào lịch` : "Thêm lịch"}
                      </button>
                      <p className="text-xs text-muted-soft">
                        Hoặc chọn ca rồi bấm <span className="font-bold text-primary">+</span> trực tiếp vào ô ngày
                      </p>
                    </div>
                    {formError && <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-2 rounded">{formError}</div>}
                  </div>

                  {/* Week calendar — desktop */}
                  <div className="bg-canvas rounded-lg border border-hairline overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-2.5 border-b border-hairline bg-surface-soft">
                      <button onClick={() => setWeekOffset(v => v - 1)} className="px-2.5 py-1 border border-hairline rounded text-xs hover:bg-canvas">← Trước</button>
                      {weekOffset !== 0 && <button onClick={() => setWeekOffset(0)} className="px-2.5 py-1 border border-hairline rounded text-xs hover:bg-canvas">Tuần này</button>}
                      <button onClick={() => setWeekOffset(v => v + 1)} className="px-2.5 py-1 border border-hairline rounded text-xs hover:bg-canvas">Sau →</button>
                      <span className="ml-auto text-xs text-muted-soft">{weekDates[0]} → {weekDates[6]}</span>
                      <button onClick={clearWeekAssignments} disabled={clearingWeek}
                        className="px-2.5 py-1 text-xs text-red-500 border border-red-200 rounded hover:bg-red-50 disabled:opacity-40">
                        {clearingWeek ? "Đang xóa..." : "Xóa tuần này"}
                      </button>
                    </div>
                    {loadingAssign ? (
                      <div className="text-center py-8 text-muted-soft text-sm">Đang tải...</div>
                    ) : (
                      <div className="grid grid-cols-7 divide-x divide-hairline">
                        {weekDates.map((date, i) => {
                          const dayShifts = getAssignmentsForDate(date);
                          const isToday = date === today;
                          const d = new Date(date + "T00:00:00");
                          const dow = JS_TO_DOW[d.getDay()];
                          const isPast = date < today;
                          const shiftsToAdd = selectedShiftIds.filter(id => !dayShifts.some(a => a.shiftId === id));
                          const canAdd = shiftsToAdd.length > 0 && !isPast;
                          return (
                            <div key={date} className={`min-h-[110px] p-2 ${isToday ? "bg-primary/5" : ""}`}>
                              <div className="text-center mb-2">
                                <div className={`text-[11px] font-bold ${isToday ? "text-primary" : "text-muted"}`}>
                                  {["T2","T3","T4","T5","T6","T7","CN"][i]}
                                </div>
                                <div className={`text-xs font-semibold ${isToday ? "text-primary" : "text-ink"}`}>
                                  {d.getDate()}/{d.getMonth() + 1}
                                </div>
                              </div>
                              {dayShifts.length === 0 && <div className="text-center text-muted-soft text-[10px] mt-1">—</div>}
                              {dayShifts.map(a => {
                                const s = shifts.find(sh => sh.name === a.shiftName);
                                return (
                                  <div key={a.id} className="relative text-[10px] bg-blue-100 text-blue-700 rounded px-1.5 py-1 mb-1 text-center leading-tight">
                                    <div className="font-semibold">{a.shiftName}</div>
                                    {s && <div className="text-blue-500 font-mono">{s.startTime}–{s.endTime}</div>}
                                    <button onClick={() => cancelAssignment(a.id)}
                                      className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 hover:bg-red-600 text-white rounded-full text-[10px] font-bold flex items-center justify-center">×</button>
                                  </div>
                                );
                              })}
                              {canAdd && (
                                <button onClick={() => quickAddToDay(dow, date)} disabled={saving}
                                  className="w-full mt-1 py-0.5 rounded border border-dashed border-primary/40 text-primary text-[11px] font-bold hover:bg-primary/10 disabled:opacity-40">
                                  +{shiftsToAdd.length > 1 ? shiftsToAdd.length : ""}
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          /* Desktop schedule tab */
          <div>
            <div className="flex items-center gap-2 mb-4">
              <button onClick={() => setScheduleWeekOffset(v => v - 1)} className="px-3 py-1.5 border rounded text-sm hover:bg-surface-soft">← Tuần trước</button>
              {scheduleWeekOffset !== 0 && <button onClick={() => setScheduleWeekOffset(0)} className="px-3 py-1.5 bg-canvas text-sm rounded hover:bg-surface-card">Tuần này</button>}
              <button onClick={() => setScheduleWeekOffset(v => v + 1)} className="px-3 py-1.5 border rounded text-sm hover:bg-surface-soft">Tuần sau →</button>
              <span className="ml-2 text-xs text-muted-soft">{scheduleWeekDates[0]} → {scheduleWeekDates[6]}</span>
            </div>
            {loadingSchedule ? (
              <div className="text-center py-8 text-muted-soft">Đang tải...</div>
            ) : (
              <div className="bg-canvas rounded-lg border border-hairline overflow-auto">
                <table className="w-full text-sm min-w-[700px]">
                  <thead>
                    <tr className="bg-surface-soft border-b text-xs text-muted">
                      <th className="text-left px-4 py-3 w-36 font-semibold">Nhân viên</th>
                      {scheduleWeekDates.map((date, i) => (
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
                      <tr><td colSpan={8} className="text-center py-8 text-muted-soft">Chưa có lịch trong tuần này</td></tr>
                    ) : scheduleEmployees.map(emp => (
                      <tr key={emp} className="hover:bg-surface-soft">
                        <td className="px-4 py-2 font-medium text-ink whitespace-nowrap">{emp}</td>
                        {scheduleWeekDates.map(date => {
                          const dayA = getScheduleCell(emp, date);
                          return (
                            <td key={date} className={`px-2 py-2 text-center align-top ${date === today ? "bg-primary/5" : ""}`}>
                              {dayA.map(a => (
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
          </div>
        )}
      </div>
    </div>
  );
}
