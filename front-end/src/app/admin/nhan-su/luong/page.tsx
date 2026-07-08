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

  const totalNet = records.reduce((sum, r) => sum + r.net, 0);
  const totalGross = records.reduce((sum, r) => sum + r.gross, 0);
  const totalPunishment = records.reduce((sum, r) => sum + r.totalPunishment, 0);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const years = [now.getFullYear() - 1, now.getFullYear()];

  // Kỳ lương: 10/month → 9/month+1
  const periodEndMonth = month === 12 ? 1 : month + 1;
  const periodEndYear = month === 12 ? year + 1 : year;
  const periodLabel = `10/${String(month).padStart(2, "0")}/${year} – 09/${String(periodEndMonth).padStart(2, "0")}/${periodEndYear}`;

  return (
    <div className="p-6">
      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setSelected(null)}>
          <div className="bg-canvas rounded-lg border border-hairline-xl p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="font-bold text-ink">{selected.employeeName}</h2>
                <p className="text-xs text-muted-soft">Kỳ lương {periodLabel}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-muted-soft hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            <dl className="space-y-2 text-sm">
              {[
                ["Loại NV", EMP_TYPE_VI[selected.employeeType] ?? selected.employeeType],
                ["Loại lương", SALARY_TYPE_VI[selected.salaryType] ?? selected.salaryType],
                ["Lương cơ bản", `${formatPrice(selected.baseValue)}/${selected.salaryType === "HOURLY" ? "giờ" : "tháng"}`],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between border-b border-hairline pb-2">
                  <dt className="text-muted">{label}</dt><dd>{value}</dd>
                </div>
              ))}
              {selected.salaryType === "FIXED" && selected.targetDays && (
                <div className="flex justify-between border-b border-hairline pb-2">
                  <dt className="text-muted">Ngày công chuẩn</dt><dd>{selected.targetDays} ngày</dd>
                </div>
              )}
              {selected.actualWorkDays != null && (
                <div className="flex justify-between border-b border-hairline pb-2">
                  <dt className="text-muted">Ngày thực tế</dt><dd className="font-medium">{selected.actualWorkDays} ngày</dd>
                </div>
              )}
              {selected.totalHours != null && (
                <div className="flex justify-between border-b border-hairline pb-2">
                  <dt className="text-muted">Tổng giờ làm</dt><dd className="font-medium">{selected.totalHours}h</dd>
                </div>
              )}
              <div className="flex justify-between border-b border-hairline pb-2">
                <dt className="text-muted">Lương gộp</dt><dd className="font-semibold">{formatPrice(selected.gross)}</dd>
              </div>
              {selected.totalPunishment > 0 && (
                <div className="flex justify-between border-b border-hairline pb-2">
                  <dt className="text-muted">Khấu trừ phạt</dt><dd className="text-red-500 font-semibold">-{formatPrice(selected.totalPunishment)}</dd>
                </div>
              )}
              <div className="flex justify-between pt-1">
                <dt className="font-bold text-ink">Thực lĩnh</dt>
                <dd className="font-bold text-primary text-lg">{formatPrice(selected.net)}</dd>
              </div>
            </dl>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 mb-5">
        <Link href="/admin/nhan-su" className="text-muted-soft hover:text-gray-600 text-sm">← Nhân sự</Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-bold text-ink">Bảng lương</h1>
      </div>

      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <select value={month} onChange={(e) => setMonth(Number(e.target.value))}
          className="border border-hairline px-3 py-1.5 text-sm rounded outline-none focus:border-primary bg-white">
          {months.map(m => <option key={m} value={m}>Tháng {m}</option>)}
        </select>
        <select value={year} onChange={(e) => setYear(Number(e.target.value))}
          className="border border-hairline px-3 py-1.5 text-sm rounded outline-none focus:border-primary bg-white">
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <span className="text-xs text-muted-soft bg-canvas px-2.5 py-1 rounded-full">
          Kỳ lương: {periodLabel}
        </span>
        {records.length > 0 && (
          <div className="ml-auto text-sm text-gray-600">
            Quỹ lương thực lĩnh: <span className="font-bold text-primary">{formatPrice(totalNet)}</span>
          </div>
        )}
      </div>

      <div className="bg-canvas rounded-lg border border-hairline overflow-hidden">
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
                  <td className="px-4 py-3 text-center text-xs text-muted">
                    {SALARY_TYPE_VI[r.salaryType] ?? r.salaryType}
                  </td>
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
