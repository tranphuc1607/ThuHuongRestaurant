"use client";
import { useState, useEffect } from "react";
import { getAuthHeaders } from "@/lib/auth";
import { formatPrice } from "@/lib/utils";
import Link from "next/link";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api/v1";

interface PayrollRecord {
  employeeId: number; employeeName: string; employeeType: string; salaryType: string;
  baseValue: number; targetDays?: number; month: number; year: number;
  actualWorkDays?: number; totalHours?: number;
  totalPunishment: number; gross: number; net: number;
}

interface AttendanceRecord {
  employeeName: string; shiftName: string; workDate: string;
  checkInTime?: string; checkOutTime?: string;
  totalHours?: number; lateMinutes?: number;
  punished: boolean; punishmentAmount?: number; punishmentReason?: string;
}

const SALARY_TYPE_VI: Record<string, string> = { FIXED: "Tháng cố định", HOURLY: "Theo giờ" };
const EMP_TYPE_VI: Record<string, string> = { FULL_TIME: "Toàn thời gian", PART_TIME: "Bán thời gian" };

export default function PayrollPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [records, setRecords] = useState<PayrollRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<PayrollRecord | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ month: String(month), year: String(year) });
        const res = await fetch(`${BASE}/hr/payroll?${params}`, { headers: getAuthHeaders() });
        const text = await res.text();
        if (!text) return;
        const json = JSON.parse(text);
        if (json.statusCode === 200) setRecords(Array.isArray(json.data) ? json.data : json.data?.content ?? []);
      } finally { setLoading(false); }
    })();
  }, [month, year]);

  async function loadDetail(employeeId: number) {
    setDetailLoading(true);
    try {
      const params = new URLSearchParams({ month: String(month), year: String(year) });
      const res = await fetch(`${BASE}/hr/payroll/${employeeId}?${params}`, { headers: getAuthHeaders() });
      const json = await res.json();
      if (json.statusCode === 200) setSelected(json.data);
    } finally { setDetailLoading(false); }
  }

  function fmtCsvTime(iso?: string) {
    if (!iso) return "";
    return new Date(iso).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  }

  async function exportCsv() {
    setExporting(true);
    try {
      const params = new URLSearchParams({ month: String(month), year: String(year), size: "1000", page: "0" });
      const res = await fetch(`${BASE}/hr/attendance?${params}`, { headers: getAuthHeaders() });
      const text = await res.text();
      if (!text) { alert("Máy chủ không trả về dữ liệu"); return; }
      const json = JSON.parse(text);
      if (json.statusCode !== 200) { alert("Không tải được dữ liệu chấm công"); return; }
      const rows: AttendanceRecord[] = json.data.content ?? json.data ?? [];

      // Lookup payroll info by employee name (already in state)
      const payrollMap = new Map(records.map(r => [r.employeeName, r]));

      // ── PHẦN 1: Chấm công chi tiết ──
      const attHeaders = [
        "STT", "Nhân viên", "Ca làm", "Ngày", "Check-in", "Check-out",
        "Tổng giờ", "Đi muộn (phút)", "Loại lương", "Đơn giá (đ/giờ hoặc đ/ngày)",
        "Tiền ca (đ)", "Phạt", "Số tiền phạt (đ)", "Lý do phạt",
      ];

      const attRows = rows.map((r, i) => {
        const pr = payrollMap.get(r.employeeName);
        const hours = r.totalHours ?? 0;
        let donGia: number | string = "";
        let tienCa: number | string = "";
        if (pr) {
          if (pr.salaryType === "HOURLY") {
            donGia = pr.baseValue;
            tienCa = Math.round(hours * pr.baseValue);
          } else if (pr.salaryType === "FIXED" && pr.targetDays) {
            const dailyRate = Math.round(pr.baseValue / pr.targetDays);
            donGia = dailyRate;
            tienCa = dailyRate; // 1 ca = 1 ngày công
          }
        }
        return [
          i + 1, r.employeeName, r.shiftName, r.workDate,
          fmtCsvTime(r.checkInTime), fmtCsvTime(r.checkOutTime),
          hours, r.lateMinutes ?? 0,
          pr ? (pr.salaryType === "HOURLY" ? "Theo giờ" : "Tháng cố định") : "",
          donGia, tienCa,
          r.punished ? "Có" : "Không", r.punishmentAmount ?? 0, r.punishmentReason ?? "",
        ];
      });

      // ── PHẦN 2: Tổng hợp lương từng nhân viên ──
      const sumHeaders = [
        "Nhân viên", "Loại lương", "Ngày/Giờ thực tế",
        "Lương gộp (đ)", "Khấu trừ phạt (đ)", "Thực lĩnh (đ)",
      ];
      const sumRows = records.map(r => [
        r.employeeName,
        r.salaryType === "HOURLY" ? "Theo giờ" : "Tháng cố định",
        r.salaryType === "HOURLY"
          ? `${r.totalHours ?? 0}h`
          : `${r.actualWorkDays ?? 0}/${r.targetDays ?? "?"} ngày`,
        r.gross, r.totalPunishment, r.net,
      ]);
      const grandTotal = [
        "TỔNG CỘNG", "", "",
        records.reduce((s, r) => s + r.gross, 0),
        records.reduce((s, r) => s + r.totalPunishment, 0),
        records.reduce((s, r) => s + r.net, 0),
      ];

      // ── Build CSV ──
      const BOM = "﻿";
      function toCsvRow(row: (string | number)[]) {
        return row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",");
      }

      const periodStr = `${String(month).padStart(2, "0")}/${year}`;
      const lines = [
        toCsvRow([`=== CHẤM CÔNG CHI TIẾT THÁNG ${periodStr} ===`]),
        toCsvRow(attHeaders),
        ...attRows.map(r => toCsvRow(r as (string | number)[])),
        "",
        toCsvRow([`=== TỔNG HỢP LƯƠNG THÁNG ${periodStr} ===`]),
        toCsvRow(sumHeaders),
        ...sumRows.map(r => toCsvRow(r as (string | number)[])),
        toCsvRow(grandTotal as (string | number)[]),
      ];

      const csv = BOM + lines.join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `luong-cham-cong-thang-${String(month).padStart(2, "0")}-${year}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch { alert("Xuất file thất bại, vui lòng thử lại"); }
    finally { setExporting(false); }
  }

  const totalNet = records.reduce((sum, r) => sum + r.net, 0);
  const totalGross = records.reduce((sum, r) => sum + r.gross, 0);
  const totalPunishment = records.reduce((sum, r) => sum + r.totalPunishment, 0);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const years = [now.getFullYear() - 1, now.getFullYear()];

  const periodEndMonth = month === 12 ? 1 : month + 1;
  const periodEndYear = month === 12 ? year + 1 : year;
  const periodLabel = `10/${String(month).padStart(2, "0")}/${year} – 09/${String(periodEndMonth).padStart(2, "0")}/${periodEndYear}`;

  const skeletonRows = Array.from({ length: 5 });

  return (
    <div className="p-3 md:p-6">
      {/* Detail modal — bottom sheet on mobile */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50" onClick={() => setSelected(null)}>
          <div className="bg-white w-full sm:max-w-md sm:mx-4 sm:rounded-2xl rounded-t-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-center pt-3 pb-1 sm:hidden">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>
            <div className="px-5 pt-3 pb-2 border-b border-hairline flex justify-between items-start">
              <div>
                <h2 className="font-bold text-ink">{selected.employeeName}</h2>
                <p className="text-xs text-muted-soft mt-0.5">Kỳ lương {periodLabel}</p>
              </div>
              <button onClick={() => setSelected(null)}
                className="w-8 h-8 flex items-center justify-center text-muted rounded-full hover:bg-surface-card text-xl touch-manipulation"
                style={{ WebkitTapHighlightColor: "transparent" }}>×</button>
            </div>
            <div className="px-5 py-4 space-y-2.5 overflow-y-auto max-h-[70vh]">
              {[
                ["Loại NV", EMP_TYPE_VI[selected.employeeType] ?? selected.employeeType],
                ["Loại lương", SALARY_TYPE_VI[selected.salaryType] ?? selected.salaryType],
                ["Lương cơ bản", `${formatPrice(selected.baseValue)}/${selected.salaryType === "HOURLY" ? "giờ" : "tháng"}`],
                ...(selected.salaryType === "FIXED" && selected.targetDays ? [["Ngày công chuẩn", `${selected.targetDays} ngày`]] : []),
                ...(selected.actualWorkDays != null ? [["Ngày thực tế", `${selected.actualWorkDays} ngày`]] : []),
                ...(selected.totalHours != null ? [["Tổng giờ làm", `${selected.totalHours}h`]] : []),
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between items-center border-b border-hairline pb-2 text-sm">
                  <span className="text-muted">{label}</span>
                  <span className="font-medium text-ink">{value}</span>
                </div>
              ))}
              <div className="flex justify-between items-center border-b border-hairline pb-2 text-sm">
                <span className="text-muted">Lương gộp</span>
                <span className="font-semibold">{formatPrice(selected.gross)}</span>
              </div>
              {selected.totalPunishment > 0 && (
                <div className="flex justify-between items-center border-b border-hairline pb-2 text-sm">
                  <span className="text-muted">Khấu trừ phạt</span>
                  <span className="text-red-500 font-semibold">-{formatPrice(selected.totalPunishment)}</span>
                </div>
              )}
              {/* Net — prominent */}
              <div className="flex justify-between items-center bg-primary/5 rounded-2xl px-4 py-3 mt-2">
                <span className="font-bold text-ink">Thực lĩnh</span>
                <span className="font-black text-primary text-xl">{formatPrice(selected.net)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <Link href="/admin/nhan-su"
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-surface-card text-muted hover:bg-hairline touch-manipulation"
          style={{ WebkitTapHighlightColor: "transparent" }}>←</Link>
        <div>
          <h1 className="text-lg font-bold text-ink">Bảng lương</h1>
          <p className="text-xs text-muted">Kỳ: {periodLabel}</p>
        </div>
      </div>

      {/* Filters + Export */}
      <div className="flex gap-2 mb-4 flex-wrap items-center">
        <select value={month} onChange={(e) => setMonth(Number(e.target.value))}
          className="border border-hairline px-3 py-2 text-sm rounded-xl outline-none focus:border-primary bg-white">
          {months.map(m => <option key={m} value={m}>Tháng {m}</option>)}
        </select>
        <select value={year} onChange={(e) => setYear(Number(e.target.value))}
          className="border border-hairline px-3 py-2 text-sm rounded-xl outline-none focus:border-primary bg-white">
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <button
          onPointerDown={e => { if (e.pointerType === "touch") { e.preventDefault(); if (!exporting && !loading) exportCsv(); } }}
          onClick={exportCsv}
          disabled={exporting || loading}
          className="ml-auto flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-xl hover:bg-green-700 disabled:opacity-50 touch-manipulation whitespace-nowrap"
          style={{ WebkitTapHighlightColor: "transparent" }}>
          {exporting
            ? <><span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Đang xuất...</>
            : <>📊 Xuất Excel</>}
        </button>
      </div>

      {/* Summary card — mobile only, shows totals at top */}
      {!loading && records.length > 0 && (
        <div className="block md:hidden mb-4">
          <div className="bg-white rounded-2xl border border-hairline p-4">
            <div className="text-xs text-muted font-semibold uppercase mb-3">Tổng quỹ lương</div>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <div className="text-xs text-muted-soft mb-1">Lương gộp</div>
                <div className="text-sm font-bold text-ink">{formatPrice(totalGross)}</div>
              </div>
              <div className="text-center border-x border-hairline">
                <div className="text-xs text-muted-soft mb-1">Phạt</div>
                <div className="text-sm font-bold text-red-500">{totalPunishment > 0 ? `-${formatPrice(totalPunishment)}` : "—"}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-muted-soft mb-1">Thực lĩnh</div>
                <div className="text-sm font-black text-primary">{formatPrice(totalNet)}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MOBILE CARDS ── */}
      <div className="block md:hidden">
        {loading ? (
          <div className="space-y-2">
            {skeletonRows.map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-hairline p-4 animate-pulse">
                <div className="flex gap-3">
                  <div className="h-4 bg-gray-200 rounded w-1/3" />
                  <div className="h-6 bg-gray-200 rounded w-1/3 ml-auto" />
                </div>
                <div className="mt-3 h-3 bg-gray-100 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : records.length === 0 ? (
          <div className="bg-white rounded-2xl border border-hairline p-10 text-center text-muted-soft text-sm">
            Không có dữ liệu lương tháng {month}/{year}
          </div>
        ) : (
          <div className="space-y-2">
            {records.map((r) => (
              <div key={r.employeeId} className="bg-white rounded-2xl border border-hairline p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-ink text-sm">{r.employeeName}</div>
                    <div className="text-xs text-muted mt-0.5">
                      {SALARY_TYPE_VI[r.salaryType] ?? r.salaryType}
                      {r.salaryType === "FIXED" && r.actualWorkDays != null && (
                        <span className="ml-1.5 text-muted-soft">{r.actualWorkDays}/{r.targetDays ?? "?"} ngày</span>
                      )}
                      {r.salaryType === "HOURLY" && r.totalHours != null && (
                        <span className="ml-1.5 text-muted-soft">{r.totalHours}h</span>
                      )}
                    </div>
                  </div>
                  {/* Net salary — prominent */}
                  <div className="text-right shrink-0">
                    <div className="text-base font-black text-primary">{formatPrice(r.net)}</div>
                    {r.totalPunishment > 0 && (
                      <div className="text-xs text-red-500">-{formatPrice(r.totalPunishment)}</div>
                    )}
                  </div>
                </div>

                {/* Gross + detail button */}
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-hairline">
                  <span className="text-xs text-muted">
                    Gộp: <span className="font-medium text-ink">{formatPrice(r.gross)}</span>
                  </span>
                  <button
                    onPointerDown={e => { if (e.pointerType === "touch") { e.preventDefault(); loadDetail(r.employeeId); } }}
                    onClick={() => loadDetail(r.employeeId)}
                    disabled={detailLoading}
                    className="px-3 py-1.5 bg-surface-card text-ink text-xs font-semibold rounded-xl hover:bg-hairline disabled:opacity-50 touch-manipulation"
                    style={{ WebkitTapHighlightColor: "transparent" }}>
                    Chi tiết →
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── DESKTOP TABLE ── */}
      <div className="hidden md:block bg-canvas rounded-lg border border-hairline overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-soft border-b border-hairline text-xs text-muted uppercase">
                <th className="text-left px-4 py-3">Nhân viên</th>
                <th className="text-center px-4 py-3">Loại lương</th>
                <th className="text-center px-4 py-3">Ngày / Giờ</th>
                <th className="text-right px-4 py-3">Lương gộp</th>
                <th className="text-right px-4 py-3">Phạt</th>
                <th className="text-right px-4 py-3">Thực lĩnh</th>
                <th className="text-center px-4 py-3">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {loading ? (
                <tr><td colSpan={7} className="text-center py-8 text-muted-soft">Đang tải...</td></tr>
              ) : records.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-muted-soft">Không có dữ liệu lương tháng {month}/{year}</td></tr>
              ) : records.map((r) => (
                <tr key={r.employeeId} className="hover:bg-surface-soft">
                  <td className="px-4 py-3 font-medium text-ink">{r.employeeName}</td>
                  <td className="px-4 py-3 text-center text-xs text-muted">{SALARY_TYPE_VI[r.salaryType] ?? r.salaryType}</td>
                  <td className="px-4 py-3 text-center text-muted text-xs">
                    {r.salaryType === "FIXED" && r.actualWorkDays != null
                      ? `${r.actualWorkDays}/${r.targetDays ?? "?"} ngày`
                      : r.totalHours != null ? `${r.totalHours}h` : "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">{formatPrice(r.gross)}</td>
                  <td className="px-4 py-3 text-right text-red-500">
                    {r.totalPunishment > 0 ? `-${formatPrice(r.totalPunishment)}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-primary">{formatPrice(r.net)}</td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => loadDetail(r.employeeId)} disabled={detailLoading}
                      className="px-2 py-1 bg-canvas text-gray-600 text-xs rounded hover:bg-surface-card disabled:opacity-50">
                      Xem
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            {records.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-hairline bg-surface-soft">
                  <td colSpan={3} className="px-4 py-3 font-bold text-ink text-right">Tổng:</td>
                  <td className="px-4 py-3 text-right font-bold">{formatPrice(totalGross)}</td>
                  <td className="px-4 py-3 text-right font-bold text-red-500">
                    {totalPunishment > 0 ? `-${formatPrice(totalPunishment)}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-primary">{formatPrice(totalNet)}</td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
