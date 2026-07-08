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

// Java DayOfWeek → JS getDay() index (0=Sunday, 1=Monday...)
const JS_DAY_TO_DOW: Record<number, string> = {
  0: "SUNDAY", 1: "MONDAY", 2: "TUESDAY", 3: "WEDNESDAY",
  4: "THURSDAY", 5: "FRIDAY", 6: "SATURDAY",
};
const DAYS_VI = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

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

  const weekDates = getWeekDates(weekOffset); // Mon → Sun
  const employees = [...new Set(assignments.map(a => a.employeeName))];

  function getAssignmentsForCell(employee: string, date: string) {
    const jsDay = new Date(date + "T00:00:00").getDay();
    const dow = JS_DAY_TO_DOW[jsDay];
    return assignments.filter(a => {
      if (a.employeeName !== employee || a.dayOfWeek !== dow || !a.active) return false;
      if (date < a.effectiveFrom) return false;
      if (a.effectiveTo && date > a.effectiveTo) return false;
      return true;
    });
  }

  function formatDateLabel(iso: string) {
    const d = new Date(iso + "T00:00:00");
    return `${d.getDate()}/${d.getMonth() + 1}`;
  }

  // weekDates starts on Monday (index 0 = Mon), so DAYS_VI index: T2=1,T3=2,...,CN=0→put CN last
  const dayHeaders = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

  const today = localIso(new Date());

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-5">
        <Link href="/admin/nhan-su" className="text-muted-soft hover:text-gray-600 text-sm">← Nhân sự</Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-bold text-ink">Lịch làm việc</h1>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => setWeekOffset(v => v - 1)}
            className="px-3 py-1.5 border rounded text-sm hover:bg-surface-soft">← Tuần trước</button>
          {weekOffset !== 0 && (
            <button onClick={() => setWeekOffset(0)}
              className="px-3 py-1.5 bg-canvas text-sm rounded hover:bg-surface-card">Tuần này</button>
          )}
          <button onClick={() => setWeekOffset(v => v + 1)}
            className="px-3 py-1.5 border rounded text-sm hover:bg-surface-soft">Tuần sau →</button>
        </div>
      </div>

      <div className="text-xs text-muted-soft mb-3">
        {weekDates[0]} → {weekDates[6]}
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-soft">Đang tải...</div>
      ) : (
        <div className="bg-canvas rounded-lg border border-hairline-sm overflow-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="bg-surface-soft border-b text-xs text-muted">
                <th className="text-left px-4 py-3 w-36 font-semibold">Nhân viên</th>
                {weekDates.map((date, i) => (
                  <th key={date} className={`text-center px-2 py-3 font-semibold ${date === today ? "bg-primary/5" : ""}`}>
                    <div className={date === today ? "text-primary font-bold" : ""}>{dayHeaders[i]}</div>
                    <div className={`text-xs font-normal ${date === today ? "text-primary" : "text-muted-soft"}`}>
                      {formatDateLabel(date)}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {employees.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-8 text-muted-soft">Chưa có lịch làm trong tuần này</td></tr>
              ) : employees.map((emp) => (
                <tr key={emp} className="hover:bg-surface-soft">
                  <td className="px-4 py-2 font-medium text-ink whitespace-nowrap">{emp}</td>
                  {weekDates.map((date) => {
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
      )}

      {!loading && assignments.length > 0 && (
        <p className="text-xs text-muted-soft mt-3">
          * Lịch hiển thị dựa trên ca phân công đang hiệu lực trong tuần này
        </p>
      )}
    </div>
  );
}
