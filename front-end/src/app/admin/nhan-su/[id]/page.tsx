"use client";
import { useState, useEffect, useCallback, Suspense, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getAuthHeaders } from "@/lib/auth";
import { extractApiError } from "@/lib/utils";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api/v1";

interface Employee {
  id: number; name: string; phone?: string; type: string; salaryType: string;
  baseValue: number; targetDays?: number; active: boolean; telegramId?: number;
  hasFace?: boolean;
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
  THURSDAY: "Thứ 5", FRIDAY: "Thứ 6", SATURDAY: "Thứ 7", SUNDAY: "CN",
};
const DAYS_ORDER = ["MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY","SUNDAY"];

type Tab = "info" | "shifts" | "face";

function EmployeeDetailContent() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [assignments, setAssignments] = useState<ShiftAssignment[]>([]);
  const [tab, setTab] = useState<Tab>("info");
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");

  const [editing, setEditing] = useState(searchParams.get("edit") === "1");
  const [editForm, setEditForm] = useState({ name: "", phone: "", type: "FULL_TIME", salaryType: "FIXED", baseValue: "", targetDays: "" });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");

  const [telegramInput, setTelegramInput] = useState("");
  const [telegramLoading, setTelegramLoading] = useState(false);
  const [telegramError, setTelegramError] = useState("");

  const [assignForm, setAssignForm] = useState({ shiftId: "", daysOfWeek: [] as string[], effectiveFrom: "", effectiveTo: "" });
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignError, setAssignError] = useState("");
  const [showAssignForm, setShowAssignForm] = useState(false);

  // --- Face registration ---
  type FacePhase = "idle" | "camera" | "capturing" | "captured" | "saving" | "done";
  const [facePhase, setFacePhase] = useState<FacePhase>("idle");
  const [faceCapCount, setFaceCapCount] = useState(0);
  const [faceCaptured, setFaceCaptured] = useState<number[][]>([]);
  const [faceMsg, setFaceMsg] = useState("");
  const faceVideoRef = useRef<HTMLVideoElement>(null);
  const faceStreamRef = useRef<MediaStream | null>(null);
  const faceapiRef = useRef<typeof import("@vladmandic/face-api") | null>(null);

  async function startFaceCamera() {
    setFaceMsg("");
    setFaceCapCount(0);
    setFaceCaptured([]);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      faceStreamRef.current = stream;
      if (faceVideoRef.current) {
        faceVideoRef.current.srcObject = stream;
        await faceVideoRef.current.play();
      }
      setFacePhase("camera");
    } catch {
      setFaceMsg("Không thể mở camera. Kiểm tra quyền truy cập.");
    }
  }

  function stopFaceCamera() {
    faceStreamRef.current?.getTracks().forEach(t => t.stop());
    faceStreamRef.current = null;
    setFacePhase("idle");
    setFaceMsg("");
  }

  async function startCapture() {
    setFacePhase("capturing");
    setFaceMsg("Nhìn thẳng vào camera...");
    const MODEL_URL = `${window.location.origin}/models`;

    const fa = faceapiRef.current ?? await (async () => {
      const m = await import("@vladmandic/face-api");
      faceapiRef.current = m;
      return m;
    })();

    // Buộc TF.js dùng CPU backend — tránh WebGL/WASM issues trên iOS Safari
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (fa as any).tf.setBackend("cpu");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (fa as any).tf.ready();

    if (!fa.nets.tinyFaceDetector.isLoaded) {
      setFaceMsg("Đang tải model nhận dạng...");
      await Promise.all([
        fa.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        fa.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
        fa.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);
    }

    const descriptors: number[][] = [];
    for (let i = 0; i < 3; i++) {
      setFaceMsg(`Đang chụp mẫu ${i + 1}/3...`);
      await new Promise(r => setTimeout(r, 1200));
      if (!faceVideoRef.current) break;
      const det = await fa
        .detectSingleFace(faceVideoRef.current, new fa.TinyFaceDetectorOptions())
        .withFaceLandmarks(true)
        .withFaceDescriptor();
      if (det) {
        descriptors.push(Array.from(det.descriptor));
        setFaceCapCount(i + 1);
      } else {
        setFaceMsg(`Không phát hiện khuôn mặt lần ${i + 1}. Thử lại.`);
        setFacePhase("camera");
        return;
      }
    }

    if (descriptors.length === 3) {
      setFaceCaptured(descriptors);
      setFacePhase("captured");
      setFaceMsg("Đã chụp xong 3 mẫu. Nhấn Lưu để đăng ký.");
    }
  }

  async function saveFace() {
    if (faceCaptured.length === 0) return;
    setFacePhase("saving");
    setFaceMsg("Đang lưu...");
    // Lấy trung bình 3 descriptors để tăng độ chính xác
    const avg = Array.from({ length: 128 }, (_, i) =>
      faceCaptured.reduce((s, d) => s + d[i], 0) / faceCaptured.length
    );
    try {
      const res = await fetch(`${BASE}/hr/employees/${id}/face-descriptor`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({ descriptor: avg }),
      });
      const json = await res.json();
      if (json.statusCode === 200) {
        setFacePhase("done");
        setFaceMsg("Đã đăng ký khuôn mặt thành công!");
        showToast("Đã đăng ký khuôn mặt");
        stopFaceCamera();
        await loadEmployee();
      } else {
        setFaceMsg(json.message ?? "Lưu thất bại");
        setFacePhase("captured");
      }
    } catch {
      setFaceMsg("Không kết nối được máy chủ");
      setFacePhase("captured");
    }
  }

  // Dọn camera khi rời tab "face"
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (tab !== "face") stopFaceCamera(); }, [tab]);

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
    (async () => { setLoading(true); await loadEmployee(); setLoading(false); })();
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

  if (loading) return (
    <div className="p-6 flex items-center gap-3 text-muted-soft">
      <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      Đang tải...
    </div>
  );
  if (!employee) return <div className="p-6 text-red-500">Không tìm thấy nhân viên</div>;

  return (
    <div className="p-3 md:p-6">
      {toast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 md:top-4 md:right-4 md:left-auto md:translate-x-0 bg-gray-800 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg z-50 whitespace-nowrap">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start gap-3 mb-5">
        <Link href="/admin/nhan-su"
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-surface-card text-muted hover:bg-hairline shrink-0 touch-manipulation mt-0.5"
          style={{ WebkitTapHighlightColor: "transparent" }}>
          ←
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg font-bold text-ink">{employee.name}</h1>
            <span className={`px-2 py-0.5 text-xs rounded-full font-semibold ${employee.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"}`}>
              {employee.active ? "Đang làm" : "Nghỉ"}
            </span>
          </div>
          <p className="text-xs text-muted mt-0.5">{EMP_TYPE[employee.type] ?? employee.type}</p>
        </div>
        {/* Action buttons — mobile: icon buttons */}
        <div className="flex gap-2 shrink-0">
          <button
            onPointerDown={e => { if (e.pointerType === "touch") { e.preventDefault(); setEditing(v => !v); setTab("info"); } }}
            onClick={() => { setEditing(v => !v); setTab("info"); }}
            className="h-9 px-3 bg-blue-50 text-blue-600 text-xs font-semibold rounded-xl hover:bg-blue-100 touch-manipulation"
            style={{ WebkitTapHighlightColor: "transparent" }}>
            {editing ? "Hủy" : "✏️ Sửa"}
          </button>
          <button
            onPointerDown={e => { if (e.pointerType === "touch") { e.preventDefault(); toggleActive(); } }}
            onClick={toggleActive}
            className={`h-9 px-3 text-xs font-semibold rounded-xl touch-manipulation ${employee.active ? "bg-red-50 text-red-500 hover:bg-red-100" : "bg-green-50 text-green-600 hover:bg-green-100"}`}
            style={{ WebkitTapHighlightColor: "transparent" }}>
            {employee.active ? "Vô hiệu" : "Kích hoạt"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b border-hairline">
        {([["info", "👤 Thông tin"], ["shifts", "📅 Phân ca"], ["face", "📷 Khuôn mặt"]] as [Tab, string][]).map(([key, label]) => (
          <button key={key}
            onPointerDown={e => { if (e.pointerType === "touch") { e.preventDefault(); setTab(key); } }}
            onClick={() => setTab(key)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors touch-manipulation ${tab === key ? "border-b-2 border-primary text-primary" : "text-muted hover:text-ink"}`}
            style={{ WebkitTapHighlightColor: "transparent" }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── TAB: THÔNG TIN ── */}
      {tab === "info" && (
        <div className="max-w-lg space-y-4">
          {editing ? (
            <div className="bg-white rounded-2xl border border-hairline p-5">
              <h2 className="text-sm font-bold text-ink mb-4">Chỉnh sửa thông tin</h2>
              <form onSubmit={handleEdit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase">Họ tên *</label>
                  <input value={editForm.name} onChange={(e) => setEditForm(p => ({ ...p, name: e.target.value }))}
                    className="w-full border border-hairline px-3 py-2.5 text-sm outline-none focus:border-primary rounded-xl" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase">Điện thoại</label>
                    <input value={editForm.phone} onChange={(e) => setEditForm(p => ({ ...p, phone: e.target.value }))}
                      className="w-full border border-hairline px-3 py-2.5 text-sm outline-none focus:border-primary rounded-xl" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase">Loại NV</label>
                    <select value={editForm.type} onChange={(e) => setEditForm(p => ({ ...p, type: e.target.value }))}
                      className="w-full border border-hairline px-3 py-2.5 text-sm outline-none focus:border-primary rounded-xl bg-white">
                      <option value="FULL_TIME">Toàn thời gian</option>
                      <option value="PART_TIME">Bán thời gian</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase">Loại lương</label>
                    <select value={editForm.salaryType} onChange={(e) => setEditForm(p => ({ ...p, salaryType: e.target.value }))}
                      className="w-full border border-hairline px-3 py-2.5 text-sm outline-none focus:border-primary rounded-xl bg-white">
                      <option value="FIXED">Tháng cố định</option>
                      <option value="HOURLY">Theo giờ</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase">Lương cơ bản *</label>
                    <input type="number" value={editForm.baseValue} onChange={(e) => setEditForm(p => ({ ...p, baseValue: e.target.value }))}
                      className="w-full border border-hairline px-3 py-2.5 text-sm outline-none focus:border-primary rounded-xl" />
                  </div>
                </div>
                {editForm.salaryType === "FIXED" && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase">Ngày công chuẩn *</label>
                    <input type="number" value={editForm.targetDays} onChange={(e) => setEditForm(p => ({ ...p, targetDays: e.target.value }))}
                      placeholder="VD: 26"
                      className="w-full border border-hairline px-3 py-2.5 text-sm outline-none focus:border-primary rounded-xl" />
                  </div>
                )}
                {editError && <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-2.5 rounded-xl">{editError}</div>}
                <div className="flex gap-3">
                  <button type="submit" disabled={editLoading}
                    className="flex-1 py-3 bg-primary text-white text-sm font-bold rounded-xl hover:bg-primary-dark disabled:opacity-60 touch-manipulation"
                    style={{ WebkitTapHighlightColor: "transparent" }}>
                    {editLoading ? "Đang lưu..." : "Lưu thay đổi"}
                  </button>
                  <button type="button" onClick={() => setEditing(false)}
                    className="flex-1 py-3 bg-surface-card text-gray-600 text-sm font-semibold rounded-xl hover:bg-hairline touch-manipulation"
                    style={{ WebkitTapHighlightColor: "transparent" }}>
                    Hủy
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-hairline p-5">
              <div className="grid grid-cols-2 gap-y-4 gap-x-4 text-sm">
                {[
                  ["Họ tên", employee.name],
                  ["Điện thoại", employee.phone ?? "—"],
                  ["Loại nhân viên", EMP_TYPE[employee.type] ?? employee.type],
                  ["Loại lương", SALARY_TYPE[employee.salaryType] ?? employee.salaryType],
                  ["Lương cơ bản", `${employee.baseValue.toLocaleString("vi-VN")}đ/${employee.salaryType === "HOURLY" ? "giờ" : "tháng"}`],
                  ["Ngày công chuẩn", employee.targetDays ? `${employee.targetDays} ngày` : "—"],
                  ["Telegram ID", employee.telegramId ? String(employee.telegramId) : "Chưa liên kết"],
                  ["Trạng thái", employee.active ? "Đang làm việc" : "Đã nghỉ"],
                ].map(([label, value]) => (
                  <div key={label}>
                    <div className="text-xs text-muted-soft uppercase font-semibold mb-0.5">{label}</div>
                    <div className="text-ink font-medium">{value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Link Telegram */}
          <div className="bg-white rounded-2xl border border-hairline p-5">
            <h2 className="text-sm font-bold text-ink mb-3">🔗 Liên kết Telegram</h2>
            {employee.telegramId && (
              <div className="text-xs text-green-600 bg-green-50 rounded-xl px-3 py-2 mb-3">
                Đang liên kết ID: <strong>{employee.telegramId}</strong>
              </div>
            )}
            <form onSubmit={linkTelegram} className="flex gap-2">
              <input type="number" value={telegramInput} onChange={(e) => setTelegramInput(e.target.value)}
                placeholder="Nhập Telegram User ID"
                className="flex-1 border border-hairline px-3 py-2.5 text-sm outline-none focus:border-primary rounded-xl" />
              <button type="submit" disabled={telegramLoading}
                className="px-4 py-2.5 bg-blue-500 text-white text-sm font-semibold rounded-xl hover:bg-blue-600 disabled:opacity-60 touch-manipulation"
                style={{ WebkitTapHighlightColor: "transparent" }}>
                {telegramLoading ? "..." : "Liên kết"}
              </button>
            </form>
            {telegramError && <p className="text-red-500 text-xs mt-2">{telegramError}</p>}
          </div>
        </div>
      )}

      {/* ── TAB: PHÂN CA ── */}
      {tab === "shifts" && (
        <div className="max-w-2xl space-y-4">
          <div className="flex justify-end">
            <button
              onPointerDown={e => { if (e.pointerType === "touch") { e.preventDefault(); setShowAssignForm(v => !v); } }}
              onClick={() => setShowAssignForm(v => !v)}
              className="px-4 py-2 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary-dark touch-manipulation"
              style={{ WebkitTapHighlightColor: "transparent" }}>
              {showAssignForm ? "Đóng" : "+ Phân ca mới"}
            </button>
          </div>

          {showAssignForm && (
            <div className="bg-white rounded-2xl border border-hairline p-5">
              <h2 className="text-sm font-bold text-ink mb-3">Phân ca làm việc</h2>
              <form onSubmit={handleAssign} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase">Ca làm *</label>
                  <select value={assignForm.shiftId}
                    onChange={(e) => setAssignForm(p => ({ ...p, shiftId: e.target.value }))}
                    className="w-full border border-hairline px-3 py-2.5 text-sm outline-none focus:border-primary rounded-xl bg-white">
                    <option value="">-- Chọn ca --</option>
                    {shifts.filter(s => s.active).map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.startTime}–{s.endTime})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase">Ngày trong tuần *</label>
                  <div className="flex gap-1.5 flex-wrap">
                    {DAYS_ORDER.map(day => (
                      <button key={day} type="button"
                        onPointerDown={e => { if (e.pointerType === "touch") { e.preventDefault(); toggleDay(day); } }}
                        onClick={() => toggleDay(day)}
                        className={`px-2.5 py-1.5 text-xs font-semibold rounded-xl border transition-colors touch-manipulation ${assignForm.daysOfWeek.includes(day) ? "bg-primary text-white border-primary" : "bg-white text-gray-600 border-gray-300 hover:border-primary"}`}
                        style={{ WebkitTapHighlightColor: "transparent" }}>
                        {DOW_VI[day]}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase">Từ ngày *</label>
                    <input type="date" value={assignForm.effectiveFrom}
                      onChange={(e) => setAssignForm(p => ({ ...p, effectiveFrom: e.target.value }))}
                      className="w-full border border-hairline px-3 py-2.5 text-sm outline-none focus:border-primary rounded-xl" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase">Đến ngày (để trống = vô hạn)</label>
                    <input type="date" value={assignForm.effectiveTo}
                      onChange={(e) => setAssignForm(p => ({ ...p, effectiveTo: e.target.value }))}
                      className="w-full border border-hairline px-3 py-2.5 text-sm outline-none focus:border-primary rounded-xl" />
                  </div>
                </div>
                {assignError && <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-2.5 rounded-xl">{assignError}</div>}
                <div className="flex gap-3">
                  <button type="submit" disabled={assignLoading}
                    className="flex-1 py-3 bg-primary text-white text-sm font-bold rounded-xl hover:bg-primary-dark disabled:opacity-60 touch-manipulation"
                    style={{ WebkitTapHighlightColor: "transparent" }}>
                    {assignLoading ? "Đang lưu..." : "Phân ca"}
                  </button>
                  <button type="button" onClick={() => setShowAssignForm(false)}
                    className="flex-1 py-3 bg-surface-card text-gray-600 text-sm font-semibold rounded-xl hover:bg-hairline touch-manipulation"
                    style={{ WebkitTapHighlightColor: "transparent" }}>
                    Hủy
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Assignment list */}
          {assignments.length === 0 ? (
            <div className="bg-white rounded-2xl border border-hairline p-10 text-center text-muted-soft text-sm">
              Chưa được phân ca nào
            </div>
          ) : (
            <>
              {/* Mobile: cards */}
              <div className="block md:hidden space-y-2">
                {assignments.map(a => (
                  <div key={a.id} className="bg-white rounded-2xl border border-hairline p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold text-ink text-sm">{a.shiftName}</div>
                        <div className="text-xs text-muted mt-0.5">{DOW_VI[a.dayOfWeek] ?? a.dayOfWeek}</div>
                      </div>
                      <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold ${a.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"}`}>
                        {a.active ? "Hiệu lực" : "Hết hạn"}
                      </span>
                    </div>
                    <div className="flex gap-4 mt-2 text-xs text-muted">
                      <div><span className="text-muted-soft">Từ: </span>{a.effectiveFrom}</div>
                      <div><span className="text-muted-soft">Đến: </span>{a.effectiveTo ?? "Vô hạn"}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop: table */}
              <div className="hidden md:block bg-white rounded-2xl border border-hairline overflow-hidden">
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
                  <tbody className="divide-y divide-hairline">
                    {assignments.map((a) => (
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
            </>
          )}
        </div>
      )}

      {/* ── TAB: KHUÔN MẶT ── */}
      {tab === "face" && (
        <div className="max-w-md space-y-4">
          {/* Trạng thái hiện tại */}
          <div className={`rounded-2xl border px-5 py-4 flex items-center gap-3 ${employee.hasFace ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"}`}>
            <span className="text-2xl">{employee.hasFace ? "✅" : "⚠️"}</span>
            <div>
              <p className={`text-sm font-bold ${employee.hasFace ? "text-green-700" : "text-amber-700"}`}>
                {employee.hasFace ? "Đã đăng ký khuôn mặt" : "Chưa đăng ký khuôn mặt"}
              </p>
              <p className="text-xs text-muted mt-0.5">
                {employee.hasFace
                  ? "Nhân viên có thể chấm công bằng khuôn mặt tại kiosk."
                  : "Cần đăng ký khuôn mặt để dùng tính năng chấm công kiosk."}
              </p>
            </div>
          </div>

          {/* Card đăng ký */}
          <div className="bg-white rounded-2xl border border-hairline p-5 space-y-4">
            <h2 className="text-sm font-bold text-ink">
              {employee.hasFace ? "Đăng ký lại khuôn mặt" : "Đăng ký khuôn mặt"}
            </h2>

            {/* Camera preview */}
            <div className="relative bg-gray-900 rounded-2xl overflow-hidden" style={{ aspectRatio: "4/3" }}>
              <video
                ref={faceVideoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
                style={{ transform: "scaleX(-1)", display: facePhase === "idle" || facePhase === "done" ? "none" : "block" }}
              />
              {(facePhase === "idle" || facePhase === "done") && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white/50">
                  <span className="text-5xl mb-2">📷</span>
                  <p className="text-sm">Camera chưa mở</p>
                </div>
              )}
              {/* Khung nhận diện */}
              {(facePhase === "camera" || facePhase === "capturing") && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="border-2 border-dashed border-green-400/70 rounded-full"
                    style={{ width: "55%", aspectRatio: "1" }} />
                </div>
              )}
              {/* Tiến độ chụp */}
              {facePhase === "capturing" && (
                <div className="absolute bottom-3 inset-x-3 bg-black/60 rounded-xl px-3 py-2 flex items-center gap-3">
                  <div className="flex gap-1.5">
                    {[0, 1, 2].map(i => (
                      <div key={i} className={`w-3 h-3 rounded-full ${i < faceCapCount ? "bg-green-400" : "bg-white/30"}`} />
                    ))}
                  </div>
                  <p className="text-white text-xs">{faceMsg}</p>
                </div>
              )}
              {/* Kết quả captured */}
              {facePhase === "captured" && (
                <div className="absolute inset-0 bg-green-900/70 flex flex-col items-center justify-center text-white text-center p-4">
                  <span className="text-4xl mb-2">✅</span>
                  <p className="text-sm font-semibold">{faceMsg}</p>
                </div>
              )}
            </div>

            {/* Hướng dẫn */}
            {facePhase === "camera" && (
              <p className="text-xs text-muted text-center">Đặt khuôn mặt vào vòng tròn, đảm bảo đủ ánh sáng</p>
            )}

            {/* Thông báo lỗi/info */}
            {faceMsg && facePhase !== "capturing" && facePhase !== "captured" && (
              <p className={`text-sm text-center ${faceMsg.includes("thành công") ? "text-green-600" : "text-red-500"}`}>
                {faceMsg}
              </p>
            )}

            {/* Action buttons */}
            <div className="flex gap-3">
              {facePhase === "idle" || facePhase === "done" ? (
                <button
                  onClick={startFaceCamera}
                  className="flex-1 py-3 bg-primary text-white text-sm font-bold rounded-xl hover:bg-primary-dark touch-manipulation"
                  style={{ WebkitTapHighlightColor: "transparent" }}>
                  {employee.hasFace ? "Đăng ký lại" : "Bắt đầu đăng ký"}
                </button>
              ) : facePhase === "camera" ? (
                <>
                  <button
                    onClick={startCapture}
                    className="flex-1 py-3 bg-green-600 text-white text-sm font-bold rounded-xl hover:bg-green-700 touch-manipulation"
                    style={{ WebkitTapHighlightColor: "transparent" }}>
                    Chụp mẫu (3 lần tự động)
                  </button>
                  <button
                    onClick={stopFaceCamera}
                    className="px-4 py-3 bg-surface-card text-gray-600 text-sm font-semibold rounded-xl hover:bg-hairline touch-manipulation"
                    style={{ WebkitTapHighlightColor: "transparent" }}>
                    Hủy
                  </button>
                </>
              ) : facePhase === "captured" ? (
                <>
                  <button
                    onClick={saveFace}
                    disabled={faceCaptured.length === 0}
                    className="flex-1 py-3 bg-primary text-white text-sm font-bold rounded-xl hover:bg-primary-dark disabled:opacity-60 touch-manipulation"
                    style={{ WebkitTapHighlightColor: "transparent" }}>
                    Lưu khuôn mặt
                  </button>
                  <button
                    onClick={() => { setFaceCapCount(0); setFaceCaptured([]); setFacePhase("camera"); setFaceMsg(""); }}
                    className="px-4 py-3 bg-surface-card text-gray-600 text-sm font-semibold rounded-xl hover:bg-hairline touch-manipulation"
                    style={{ WebkitTapHighlightColor: "transparent" }}>
                    Chụp lại
                  </button>
                </>
              ) : facePhase === "saving" ? (
                <div className="flex-1 py-3 bg-gray-100 text-gray-500 text-sm text-center rounded-xl">Đang lưu...</div>
              ) : null}
            </div>

            {/* Hướng đến kiosk */}
            {(facePhase === "done" || (employee.hasFace && facePhase === "idle")) && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-700">
                <strong>Kiosk chấm công:</strong> Truy cập <code className="bg-blue-100 px-1 rounded">/cham-cong</code> trên máy tại cửa hàng để nhân viên chấm công bằng khuôn mặt.
              </div>
            )}
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
