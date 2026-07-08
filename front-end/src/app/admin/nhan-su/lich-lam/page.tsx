"use client";
import { useState, useEffect } from "react";
import { getAuthHeaders } from "@/lib/auth";
import Link from "next/link";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api/v1";

interface ShiftAssignment {
  id: number; employeeId: number; employeeName: string;
  shiftId: number; shiftName: string;
  dayOfWeek: string; effectiveFrom: string; effectiveTo?: string; active: boolean;
}

const JS_DAY_TO_DOW: Record<number, string> = {
  0: "SUNDAY", 1: "MONDAY", 2: "TUESDAY", 3: "WEDNESDAY",
  4: "THURSDAY", 5: "FRIDAY", 6: "SATURDAY",
};
const DAY_HEADERS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

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

export default function SchedulePage() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [assignments, setAssignments] = useState<ShiftAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const res = await fetch(`${BASE}/hr/shifts/schedule?weekOffset=${weekOffset}`, { headers: getAuthHeaders() });
      const json = await res.json();
      if (json.statusCode === 200) setAssignments(json.data ?? []);
      setLoading(false);
    })();
  }, [weekOffset]);

  const weekDates = getWeekDates(weekOffset);
  const today = localIso(new Date());
  const employees = [...new Set(assignments.map(a => a.employeeName))];

  function getAssignmentsForCell(employee: string, date: string) {
    const dow = JS_DAY_TO_DOW[new Date(date + "T00:00:00").getDay()];
    return assignments.filter(a => {
      if (a.employeeName !== employee || a.dayOfWeek !== dow || !a.active) return false;
      if (date < a.effectiveFrom) return false;
      if (a.effectiveTo && date > a.effectiveTo) return false;
      return true;
    });
  }

  return (
    <div className="p-3 md:p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <Link href="/admin/nhan-su"
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-surface-card text-muted hover:bg-hairline touch-manipulation"
          style={{ WebkitTapHighlightColor: "transparent" }}>←</Link>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-ink">Lịch làm việc</h1>
          <p className="text-xs text-muted">{weekDates[0]} — {weekDates[6]}</p>
        </div>
      </div>

      {/* Week navigation */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto">
        <button
          onPointerDown={e => { if (e.pointerType === "touch") { e.preventDefault(); setWeekOffset(v => v - 1); } }}
          onClick={() => setWeekOffset(v => v - 1)}
          className="px-3 py-2 border border-hairline rounded-xl text-sm hover:bg-surface-soft shrink-0 touch-manipulation"
          style={{ WebkitTapHighlightColor: "transparent" }}>← Trước</button>
        {weekOffset !== 0 && (
          <button
            onPointerDown={e => { if (e.pointerType === "touch") { e.preventDefault(); setWeekOffset(0); } }}
            onClick={() => setWeekOffset(0)}
            className="px-3 py-2 border border-hairline rounded-xl text-sm hover:bg-surface-soft shrink-0 touch-manipulation"
            style={{ WebkitTapHighlightColor: "transparent" }}>Tuần này</button>
        )}
        <button
          onPointerDown={e => { if (e.pointerType === "touch") { e.preventDefault(); setWeekOffset(v => v + 1); } }}
          onClick={() => setWeekOffset(v => v + 1)}
          className="px-3 py-2 border border-hairline rounded-xl text-sm hover:bg-surface-soft shrink-0 touch-manipulation"
          style={{ WebkitTapHighlightColor: "transparent" }}>Sau →</button>
      </div>

      {loading ? (
        <div className="space-y-2 md:hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-hairline p-4 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/3 mb-3" />
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: 7 }).map((_, j) => (
                  <div key={j} className="h-8 bg-gray-100 rounded-lg" />
                ))}
              </div>
            </div>
          ))}
          <div className="hidden md:block text-center py-8 text-muted-soft">Đang tải...</div>
        </div>
      ) : employees.length === 0 ? (
        <div className="bg-white rounded-2xl border border-hairline p-10 text-center text-muted-soft text-sm">
          Chưa có lịch làm trong tuần này
        </div>
      ) : (
        <>
          {/* ── MOBILE CARDS ── */}
          <div className="block md:hidden space-y-2">
            {employees.map(emp => (
              <div key={emp} className="bg-white rounded-2xl border border-hairline p-4">
                <div className="font-semibold text-ink text-sm mb-3">{emp}</div>
                <div className="grid grid-cols-7 gap-1">
                  {weekDates.map((date, i) => {
                    const dayAssignments = getAssignmentsForCell(emp, date);
                    const isToday = date === today;
                    const d = new Date(date + "T00:00:00");
                    return (
                      <div key={date}
                        className={`rounded-xl py-1.5 px-0.5 text-center ${isToday ? "bg-primary/10 ring-1 ring-primary/30" : "bg-surface-card"}`}>
                        <div className={`text-[10px] font-bold mb-1 ${isToday ? "text-primary" : "text-muted"}`}>
                          {DAY_HEADERS[i]}
                        </div>
                        <div className={`text-[9px] ${isToday ? "text-primary" : "text-muted-soft"}`}>
                          {d.getDate()}/{d.getMonth() + 1}
                        </div>
                        {dayAssignments.length > 0 ? (
                          <div className="mt-1 space-y-0.5">
                            {dayAssignments.map(a => (
                              <div key={a.id}
                                className="text-[9px] bg-blue-100 text-blue-700 rounded px-0.5 py-0.5 leading-tight font-semibold truncate">
                                {a.shiftName}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="mt-1 text-[9px] text-muted-soft">—</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* ── DESKTOP TABLE ── */}
          <div className="hidden md:block bg-canvas rounded-lg border border-hairline overflow-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="bg-surface-soft border-b text-xs text-muted">
                  <th className="text-left px-4 py-3 w-36 font-semibold">Nhân viên</th>
                  {weekDates.map((date, i) => (
                    <th key={date} className={`text-center px-2 py-3 font-semibold ${date === today ? "bg-primary/5" : ""}`}>
                      <div className={date === today ? "text-primary font-bold" : ""}>{DAY_HEADERS[i]}</div>
                      <div className={`text-xs font-normal ${date === today ? "text-primary" : "text-muted-soft"}`}>
                        {(() => { const d = new Date(date + "T00:00:00"); return `${d.getDate()}/${d.getMonth() + 1}`; })()}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {employees.map(emp => (
                  <tr key={emp} className="hover:bg-surface-soft">
                    <td className="px-4 py-2 font-medium text-ink whitespace-nowrap">{emp}</td>
                    {weekDates.map(date => {
                      const dayAssignments = getAssignmentsForCell(emp, date);
                      return (
                        <td key={date} className={`px-2 py-2 text-center align-top ${date === today ? "bg-primary/5" : ""}`}>
                          {dayAssignments.map(a => (
                            <div key={a.id}
                              className="text-xs bg-blue-100 text-blue-700 rounded px-1.5 py-0.5 mb-0.5 whitespace-nowrap">
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
        </>
      )}

      {!loading && assignments.length > 0 && (
        <p className="text-xs text-muted-soft mt-3">* Lịch dựa trên ca phân công đang hiệu lực trong tuần</p>
      )}
    </div>
  );
}
