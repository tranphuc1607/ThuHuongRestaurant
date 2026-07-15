"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { extractApiError } from "@/lib/utils";

const KIOSK_API = "/api/proxy";
let MODEL_URL = "/models";

const MATCH_THRESHOLD = 0.45;
const CONFIRM_SECONDS = 2;
const RESULT_MS = 3000;

interface EmpDescriptor {
  employeeId: number;
  name: string;
  descriptor: number[];
}

type Phase =
  | "loading-models"
  | "loading-employees"
  | "idle"
  | "starting-camera"
  | "scanning"
  | "matched"
  | "processing"
  | "success"
  | "fail"
  | "fatal";

export default function AdminKioskPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [phase, setPhase] = useState<Phase>("loading-models");
  const [loadMsg, setLoadMsg] = useState("Đang tải mô hình nhận diện khuôn mặt...");
  const [countdown, setCountdown] = useState(CONFIRM_SECONDS);
  const [matchName, setMatchName] = useState("");
  const [resultMsg, setResultMsg] = useState("");
  const [resultType, setResultType] = useState<"checkin" | "checkout" | "error">("checkin");
  const [fatalMsg, setFatalMsg] = useState("");
  const [clockStr, setClockStr] = useState("");
  const [dateStr, setDateStr] = useState("");

  const faceapiRef = useRef<typeof import("@vladmandic/face-api") | null>(null);
  const matcherRef = useRef<import("@vladmandic/face-api").FaceMatcher | null>(null);
  const empMapRef = useRef<Map<string, string>>(new Map());
  const cooldownRef = useRef(false);
  const phaseRef = useRef<Phase>("loading-models");
  const mountedRef = useRef(true);

  function changePhase(p: Phase) {
    phaseRef.current = p;
    setPhase(p);
  }

  // Đồng hồ thực
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setClockStr(
        now.toLocaleTimeString("vi-VN", {
          hour: "2-digit", minute: "2-digit", second: "2-digit",
          timeZone: "Asia/Ho_Chi_Minh",
        })
      );
      setDateStr(
        now.toLocaleDateString("vi-VN", {
          weekday: "long", day: "2-digit", month: "2-digit", year: "numeric",
          timeZone: "Asia/Ho_Chi_Minh",
        })
      );
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  // Attach stream vào video element sau khi phase "scanning" mount <video>
  useEffect(() => {
    if (!streamRef.current || !videoRef.current) return;
    const video = videoRef.current;
    if (!video.srcObject) {
      video.srcObject = streamRef.current;
      video.play().catch(() => {});
    }
  }, [phase]);

  // Tải models + employees khi mount — sau đó về idle
  useEffect(() => {
    mountedRef.current = true;

    async function initModels() {
      MODEL_URL = `${window.location.origin}/models`;
      let _step = "init";
      try {
        setLoadMsg("Đang tải mô hình nhận diện khuôn mặt...");

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const origWA = (globalThis as any).WebAssembly;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).WebAssembly = undefined;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const origGetCtx = HTMLCanvasElement.prototype.getContext as any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (HTMLCanvasElement.prototype as any).getContext = function (id: string, ...rest: unknown[]) {
          if (id === "webgl" || id === "webgl2" || id === "experimental-webgl") return null;
          return origGetCtx.apply(this, [id, ...rest]);
        };

        _step = "import";
        const faceapi = await import("@vladmandic/face-api");
        faceapiRef.current = faceapi;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).WebAssembly = origWA;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (HTMLCanvasElement.prototype as any).getContext = origGetCtx;

        _step = "setBackend";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (faceapi as any).tf.setBackend("cpu");
        _step = "tf.ready";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (faceapi as any).tf.ready();

        type WSpec = {
          name: string; shape: number[]; dtype: string;
          quantization?: { dtype: string; scale: number; min: number };
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tfObj = (faceapi as any).tf;

        function decodeGroup(buffer: ArrayBuffer, specs: WSpec[], netName: string): Record<string, unknown> {
          const wm: Record<string, unknown> = {};
          let off = 0;
          for (let si = 0; si < specs.length; si++) {
            const s = specs[si];
            _step = `tensor:${netName}:${si}`;
            const n = s.shape.reduce((a: number, b: number) => a * b, 1) || 1;
            if (s.quantization?.dtype === "uint8") {
              const { scale, min } = s.quantization;
              const raw = new Uint8Array(buffer, off, n);
              const f32 = new Float32Array(n);
              for (let i = 0; i < n; i++) f32[i] = raw[i] * scale + min;
              wm[s.name] = tfObj.tensor(f32, s.shape);
              off += n;
            } else {
              const bytes = n * 4;
              const aligned = new ArrayBuffer(bytes);
              new Uint8Array(aligned).set(new Uint8Array(buffer, off, bytes));
              wm[s.name] = tfObj.tensor(new Float32Array(aligned), s.shape);
              off += bytes;
            }
          }
          return wm;
        }

        const MODEL_FILE_LIST = [
          "tiny_face_detector_model-weights_manifest.json",
          "tiny_face_detector_model-shard1",
          "face_landmark_68_tiny_model-weights_manifest.json",
          "face_landmark_68_tiny_model-shard1",
          "face_recognition_model-weights_manifest.json",
          "face_recognition_model-shard1",
          "face_recognition_model-shard2",
        ];
        const abMap = new Map<string, ArrayBuffer>();
        for (const fname of MODEL_FILE_LIST) {
          _step = `fetch:${fname.split("_model")[0]}`;
          abMap.set(fname, await fetch(`${MODEL_URL}/${fname}`).then(r => r.arrayBuffer()));
        }

        async function buildWeightMap(manifestName: string, netName: string): Promise<Record<string, unknown>> {
          _step = `parse:${netName}`;
          const manifest: Array<{ weights: WSpec[]; paths: string[] }> = JSON.parse(
            new TextDecoder().decode(abMap.get(manifestName)!)
          );
          const weightMap: Record<string, unknown> = {};
          for (const group of manifest) {
            const bufs = group.paths.map(p => abMap.get(p)!);
            const total = bufs.reduce((s, b) => s + b.byteLength, 0);
            const flat = new Uint8Array(new ArrayBuffer(total));
            let o = 0;
            for (const b of bufs) { flat.set(new Uint8Array(b), o); o += b.byteLength; }
            Object.assign(weightMap, decodeGroup(flat.buffer, group.weights, netName));
          }
          return weightMap;
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async function loadNetDirect(net: any, manifestName: string, netName: string) {
          const weightMap = await buildWeightMap(manifestName, netName);
          _step = `load:${netName}`;
          net.loadFromWeightMap(weightMap);
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async function loadRecognitionNet(net: any) {
          const wm = await buildWeightMap("face_recognition_model-weights_manifest.json", "recognition");
          function convLayer(prefix: string) {
            return {
              conv: { filters: wm[`${prefix}/conv/filters`], bias: wm[`${prefix}/conv/bias`] },
              scale: { weights: wm[`${prefix}/scale/weights`], biases: wm[`${prefix}/scale/biases`] },
            };
          }
          function residualLayer(prefix: string) {
            return { conv1: convLayer(`${prefix}/conv1`), conv2: convLayer(`${prefix}/conv2`) };
          }
          _step = "params:assign";
          net._params = {
            conv32_down: convLayer("conv32_down"),
            conv32_1: residualLayer("conv32_1"), conv32_2: residualLayer("conv32_2"), conv32_3: residualLayer("conv32_3"),
            conv64_down: residualLayer("conv64_down"),
            conv64_1: residualLayer("conv64_1"), conv64_2: residualLayer("conv64_2"), conv64_3: residualLayer("conv64_3"),
            conv128_down: residualLayer("conv128_down"),
            conv128_1: residualLayer("conv128_1"), conv128_2: residualLayer("conv128_2"),
            conv256_down: residualLayer("conv256_down"),
            conv256_1: residualLayer("conv256_1"), conv256_2: residualLayer("conv256_2"),
            conv256_down_out: residualLayer("conv256_down_out"),
            fc: wm["fc"],
          };
          net._paramMappings = [];
        }

        _step = "load-nets:tiny";
        await loadNetDirect(faceapi.nets.tinyFaceDetector, "tiny_face_detector_model-weights_manifest.json", "tiny");
        _step = "load-nets:landmark";
        await loadNetDirect(faceapi.nets.faceLandmark68TinyNet, "face_landmark_68_tiny_model-weights_manifest.json", "landmark");
        _step = "load-nets:recognition";
        await loadRecognitionNet(faceapi.nets.faceRecognitionNet);

        if (!mountedRef.current) return;

        // Tải danh sách khuôn mặt nhân viên
        changePhase("loading-employees");
        setLoadMsg("Đang tải dữ liệu nhân viên...");
        _step = "fetch:employees";
        const res = await fetch(`${KIOSK_API}/hr/employees/face-descriptors`);
        const json = await res.json();
        if (!mountedRef.current) return;

        if (!Array.isArray(json.data) || json.data.length === 0) {
          throw new Error("Chưa có nhân viên nào đăng ký khuôn mặt. Vui lòng đăng ký trong Admin → Nhân sự.");
        }

        _step = "build:matcher";
        const employees: EmpDescriptor[] = json.data;
        const empMap = new Map<string, string>();
        const labeled = employees.map((e) => {
          empMap.set(String(e.employeeId), e.name);
          return new faceapi.LabeledFaceDescriptors(String(e.employeeId), [new Float32Array(e.descriptor)]);
        });
        empMapRef.current = empMap;
        matcherRef.current = new faceapi.FaceMatcher(labeled, MATCH_THRESHOLD);

        // Sẵn sàng — về màn chờ
        changePhase("idle");
      } catch (err: unknown) {
        if (mountedRef.current) {
          const name = err instanceof Error ? err.name : "Error";
          const msg = err instanceof Error ? err.message : String(err);
          const stack = err instanceof Error && err.stack
            ? err.stack.split("\n").slice(0, 6).join(" | ")
            : "";
          setFatalMsg(`[${_step}] ${name}: ${msg} || STACK: ${stack}`);
          changePhase("fatal");
        }
      }
    }

    initModels();

    return () => {
      mountedRef.current = false;
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopCamera() {
    if (detectTimerRef.current) {
      clearInterval(detectTimerRef.current);
      detectTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }

  async function startSession() {
    if (phaseRef.current !== "idle") return;
    changePhase("starting-camera");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
      });
      if (!mountedRef.current) { stream.getTracks().forEach(t => t.stop()); return; }

      streamRef.current = stream;
      changePhase("scanning");

      detectTimerRef.current = setInterval(async () => {
        if (
          !videoRef.current ||
          !faceapiRef.current ||
          !matcherRef.current ||
          cooldownRef.current ||
          phaseRef.current !== "scanning"
        ) return;

        try {
          const fa = faceapiRef.current;
          const detection = await fa
            .detectSingleFace(videoRef.current, new fa.TinyFaceDetectorOptions({ scoreThreshold: 0.5 }))
            .withFaceLandmarks(true)
            .withFaceDescriptor();

          if (!detection) return;

          const match = matcherRef.current.findBestMatch(detection.descriptor);
          if (match.label !== "unknown") {
            const name = empMapRef.current.get(match.label) ?? "Nhân viên";
            triggerMatch(parseInt(match.label), name);
          }
        } catch {
          // bỏ qua lỗi detection nhất thời
        }
      }, 600);
    } catch {
      setFatalMsg("Không thể truy cập camera. Hãy kiểm tra quyền camera và thử lại.");
      changePhase("fatal");
    }
  }

  const doCheckinRef = useRef(doCheckin);
  doCheckinRef.current = doCheckin;

  const triggerMatch = useCallback(
    (empId: number, name: string) => {
      if (cooldownRef.current) return;
      cooldownRef.current = true;

      setMatchName(name);
      setCountdown(CONFIRM_SECONDS);
      changePhase("matched");

      let remaining = CONFIRM_SECONDS;
      const countTimer = setInterval(() => {
        remaining -= 1;
        setCountdown(remaining);
        if (remaining <= 0) {
          clearInterval(countTimer);
          doCheckinRef.current(empId, name);
        }
      }, 1000);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  async function doCheckin(empId: number, name: string) {
    changePhase("processing");
    try {
      const res = await fetch(`${KIOSK_API}/hr/face-checkin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: empId }),
      });
      const text = await res.text();
      if (!text) throw new Error(`Empty response (HTTP ${res.status})`);
      let json: Record<string, unknown>;
      try { json = JSON.parse(text); }
      catch { throw new Error(`Non-JSON (HTTP ${res.status}): ${text.slice(0, 120)}`); }

      if (json.statusCode === 200) {
        const d = json.data as Record<string, unknown>;
        const action = d?.action as string ?? "";
        const att = d?.attendance as Record<string, unknown> ?? {};
        const shiftName = att?.shiftName as string | null;
        const hours = att?.totalHours as number | null;
        const lateMin = att?.lateMinutes as number ?? 0;

        if (action === "CHECK_IN") {
          let msg = `${name} — Check-in thành công`;
          if (shiftName) msg += ` ca ${shiftName}`;
          if (lateMin > 0) msg += ` (muộn ${lateMin} phút)`;
          setResultMsg(msg);
          setResultType("checkin");
        } else {
          let msg = `${name} — Check-out thành công`;
          if (hours) msg += ` · ${hours} giờ`;
          setResultMsg(msg);
          setResultType("checkout");
        }
        changePhase("success");
      } else {
        setResultMsg(extractApiError(json, "Có lỗi xảy ra khi ghi chấm công"));
        setResultType("error");
        changePhase("fail");
      }
    } catch (e: unknown) {
      setResultMsg(e instanceof Error ? e.message : String(e));
      setResultType("error");
      changePhase("fail");
    }

    // Sau khi hiển thị kết quả → dừng camera → về idle
    setTimeout(() => {
      if (!mountedRef.current) return;
      stopCamera();
      cooldownRef.current = false;
      setMatchName("");
      changePhase("idle");
    }, RESULT_MS);
  }

  /* ─── Render ─── */

  if (phase === "fatal") {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-red-950 text-white px-8 text-center">
        <div className="text-7xl mb-6">⚠️</div>
        <h1 className="text-2xl font-bold mb-3">Không thể khởi động</h1>
        <p className="text-red-200 text-lg mb-8 max-w-md">{fatalMsg}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-8 py-3 bg-white text-red-900 rounded-2xl font-bold text-lg"
        >
          Thử lại
        </button>
      </div>
    );
  }

  const isInitialLoading = phase === "loading-models" || phase === "loading-employees";

  if (isInitialLoading) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-gray-950 text-white">
        <div className="text-6xl mb-6">👁</div>
        <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin mb-6" />
        <p className="text-gray-300 text-lg text-center max-w-xs px-4">{loadMsg}</p>
        <p className="text-gray-600 text-sm mt-3">Lần đầu khởi động có thể mất 10–20 giây</p>
      </div>
    );
  }

  // Màn chờ (idle) hoặc đang bật camera (starting-camera)
  if (phase === "idle" || phase === "starting-camera") {
    return (
      <div className="fixed inset-0 bg-gray-950 flex flex-col items-center justify-center select-none">
        {/* Đồng hồ */}
        <div className="text-white/80 text-5xl font-mono tracking-widest mb-2">{clockStr}</div>
        <div className="text-white/40 text-sm mb-14">{dateStr}</div>

        {phase === "idle" ? (
          <button
            onClick={startSession}
            onPointerDown={(e) => {
              if (e.pointerType === "touch") {
                e.preventDefault();
                startSession();
              }
            }}
            style={{ touchAction: "manipulation", cursor: "pointer" }}
            className="px-10 py-5 bg-blue-600 active:bg-blue-700 text-white text-xl font-bold rounded-3xl shadow-2xl"
          >
            Bắt đầu chấm công
          </button>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin" />
            <p className="text-white/50 text-base">Đang khởi động camera...</p>
          </div>
        )}

        <Link
          href="/employee/ban"
          className="absolute bottom-6 text-white/30 text-sm hover:text-white/60 transition-colors"
        >
          ← Quay về trang nhân viên
        </Link>
      </div>
    );
  }

  /* Border màu theo trạng thái */
  const borderColor =
    phase === "matched"    ? "border-green-400 shadow-green-400/40"
    : phase === "success"  ? "border-green-500 shadow-green-500/40"
    : phase === "fail"     ? "border-red-500 shadow-red-500/40"
    : phase === "processing" ? "border-yellow-400 shadow-yellow-400/40"
    : "border-blue-500/60 shadow-blue-500/20";

  return (
    <div className="fixed inset-0 bg-gray-950 flex flex-col items-center justify-center overflow-hidden select-none">
      {/* Đồng hồ + ngày */}
      <div className="absolute top-5 inset-x-0 text-center pointer-events-none">
        <div className="text-white/80 text-4xl font-mono tracking-widest">{clockStr}</div>
        <div className="text-white/40 text-sm mt-1">{dateStr}</div>
      </div>

      {/* Camera */}
      <div
        className={`relative border-4 rounded-3xl overflow-hidden transition-all duration-300 shadow-2xl ${borderColor}`}
        style={{ width: "min(88vw, 580px)", aspectRatio: "4/3" }}
      >
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="w-full h-full object-cover"
          style={{ transform: "scaleX(-1)" }}
        />

        {phase === "matched" && (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-6">
            <p className="text-white text-2xl font-bold text-center mb-1">
              Xin chào, {matchName}!
            </p>
            <p className="text-green-300 text-center text-base mb-3">
              Đang xác nhận trong {countdown}s...
            </p>
            <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-400 rounded-full transition-all duration-1000"
                style={{ width: `${(countdown / CONFIRM_SECONDS) * 100}%` }}
              />
            </div>
          </div>
        )}

        {phase === "processing" && (
          <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center">
            <div className="w-14 h-14 border-4 border-white border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-white text-xl font-semibold">Đang ghi chấm công...</p>
          </div>
        )}

        {phase === "success" && (
          <div className="absolute inset-0 bg-green-900/85 flex flex-col items-center justify-center p-6 text-center">
            <div className="text-6xl mb-4">{resultType === "checkin" ? "✅" : "👋"}</div>
            <p className="text-white text-xl font-bold leading-snug">{resultMsg}</p>
          </div>
        )}

        {phase === "fail" && (
          <div className="absolute inset-0 bg-red-900/85 flex flex-col items-center justify-center p-6 text-center">
            <div className="text-6xl mb-4">❌</div>
            <p className="text-red-100 text-lg font-semibold leading-snug">{resultMsg}</p>
          </div>
        )}
      </div>

      {/* Hướng dẫn */}
      <div className="absolute bottom-6 inset-x-0 text-center pointer-events-none">
        {phase === "scanning" ? (
          <p className="text-white/50 text-sm">Nhìn thẳng vào camera để chấm công tự động</p>
        ) : phase === "matched" ? (
          <p className="text-green-400/80 text-sm">Đứng yên...</p>
        ) : null}
      </div>
    </div>
  );
}
