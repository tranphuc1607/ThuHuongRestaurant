"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

function QrIcon() {
  return (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3"  y="3"  width="7" height="7" rx="1" />
      <rect x="14" y="3"  width="7" height="7" rx="1" />
      <rect x="3"  y="14" width="7" height="7" rx="1" />
      <rect x="5"  y="5"  width="3" height="3" fill="currentColor" stroke="none" />
      <rect x="16" y="5"  width="3" height="3" fill="currentColor" stroke="none" />
      <rect x="5"  y="16" width="3" height="3" fill="currentColor" stroke="none" />
      <rect x="14" y="14" width="3" height="3" fill="currentColor" stroke="none" />
      <rect x="18" y="14" width="3" height="3" />
      <rect x="14" y="18" width="3" height="3" />
      <rect x="18" y="18" width="3" height="3" fill="currentColor" stroke="none" />
    </svg>
  );
}

export default function QrFloat() {
  const [mounted, setMounted]   = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError]       = useState("");

  const videoRef    = useRef<HTMLVideoElement>(null);
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const streamRef   = useRef<MediaStream | null>(null);
  const rafRef      = useRef<number>(0);
  const router      = useRouter();

  useEffect(() => {
    setMounted(true);
    return () => {
      cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const stopScan = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanning(false);
  }, []);

  const goToTable = useCallback((raw: string) => {
    stopScan();
    try {
      const path = raw.startsWith("http") ? new URL(raw).pathname : raw;
      const m    = path.match(/\/ban\/([^/?#]+)/);
      if (m) { router.push(`/ban/${m[1]}`); return; }
    } catch { /* */ }
    setError("Mã QR không hợp lệ. Hãy quét đúng mã QR trên bàn.");
  }, [router, stopScan]);

  // Khi scanning=true → video element render → bind stream + chạy decode loop
  useEffect(() => {
    if (!scanning || !videoRef.current || !streamRef.current) return;
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    video.srcObject = streamRef.current;
    video.play().catch(() => {});

    let active = true;

    const decode = async () => {
      if (!active || !streamRef.current || video.readyState < 2) {
        rafRef.current = requestAnimationFrame(decode);
        return;
      }

      const w = video.videoWidth;
      const h = video.videoHeight;
      if (!w || !h) { rafRef.current = requestAnimationFrame(decode); return; }

      // Ưu tiên BarcodeDetector (Chrome/Edge/Android) — nhanh hơn, native
      if ("BarcodeDetector" in window) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const codes: any[] = await new (window as any).BarcodeDetector({ formats: ["qr_code"] }).detect(video);
          if (codes.length > 0) { goToTable(codes[0].rawValue); return; }
        } catch { /* */ }
      } else if (canvas) {
        // Fallback: jsQR — dùng canvas để lấy pixel data
        canvas.width  = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(video, 0, 0, w, h);
          const imageData = ctx.getImageData(0, 0, w, h);
          // Dynamic import jsQR để không bloat SSR bundle
          const { default: jsQR } = await import("jsqr");
          const code = jsQR(imageData.data, w, h, { inversionAttempts: "dontInvert" });
          if (code?.data) { goToTable(code.data); return; }
        }
      }

      if (active) rafRef.current = requestAnimationFrame(decode);
    };

    rafRef.current = requestAnimationFrame(decode);
    return () => { active = false; };
  }, [scanning, goToTable]);

  const handleClick = useCallback(async () => {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Trình duyệt không hỗ trợ camera. Hãy dùng Chrome hoặc Safari mới nhất.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      setScanning(true);
    } catch (e: unknown) {
      const msg = e instanceof DOMException && e.name === "NotAllowedError"
        ? "Bạn chưa cấp quyền camera. Vào cài đặt trình duyệt → cho phép truy cập camera."
        : "Không mở được camera. Kiểm tra lại thiết bị.";
      setError(msg);
    }
  }, []);

  if (!mounted) return null;

  return (
    <>
      {scanning && (
        <div className="fixed inset-0 z-[240] bg-black/20" onClick={stopScan} />
      )}

      {/* Nút QR — thẳng hàng dọc phía trên nút Liên hệ */}
      <div className="fixed bottom-[88px] left-6 z-[250]">
        <div className="relative">
          <span className="absolute inset-0 rounded-full bg-orange-400/40 animate-ping" />
          <span className="absolute inset-[-4px] rounded-full bg-orange-400/20" />
          <button
            onClick={handleClick}
            aria-label="Quét mã QR bàn"
            className="relative w-14 h-14 rounded-full flex items-center justify-center bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-2xl shadow-orange-500/50 hover:scale-110 active:scale-95 transition-all duration-300 touch-manipulation focus:outline-none"
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            <QrIcon />
          </button>
          <span className="hidden sm:block absolute left-16 top-1/2 -translate-y-1/2 whitespace-nowrap bg-gray-900/90 text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow-lg pointer-events-none">
            Quét QR bàn
            <span className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900/90" />
          </span>
        </div>
      </div>

      {/* Error toast */}
      {error && !scanning && (
        <div className="fixed bottom-[160px] left-6 z-[260] max-w-[260px] bg-red-600 text-white text-xs px-4 py-3 rounded-xl shadow-lg flex items-start gap-2">
          <span className="flex-1">{error}</span>
          <button onClick={() => setError("")} className="opacity-70 hover:opacity-100 flex-shrink-0">✕</button>
        </div>
      )}

      {/* Camera modal — hoàn toàn trong web, không mở app ngoài */}
      {scanning && (
        <div className="fixed inset-0 z-[300] bg-black/95 flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-[340px]">
            <div className="flex items-center justify-between mb-4">
              <span className="text-white font-semibold text-sm">Quét mã QR tại bàn</span>
              <button
                onClick={stopScan}
                className="w-9 h-9 flex items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 transition-colors"
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                ✕
              </button>
            </div>

            <div className="relative rounded-2xl overflow-hidden bg-black" style={{ aspectRatio: "4/3" }}>
              <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
              {/* Canvas ẩn — dùng bởi jsQR để lấy pixel data */}
              <canvas ref={canvasRef} className="hidden" />

              {/* Khung ngắm */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="relative w-52 h-52">
                  <div className="absolute inset-0 border border-white/20" />
                  {(["top-0 left-0 border-t-[3px] border-l-[3px]",
                     "top-0 right-0 border-t-[3px] border-r-[3px]",
                     "bottom-0 left-0 border-b-[3px] border-l-[3px]",
                     "bottom-0 right-0 border-b-[3px] border-r-[3px]"] as const).map((cls, i) => (
                    <div key={i} className={`absolute ${cls} border-orange-400 w-8 h-8`} />
                  ))}
                  <div
                    className="absolute left-0 right-0 h-0.5 bg-orange-400"
                    style={{ animation: "qrLine 2s ease-in-out infinite", boxShadow: "0 0 8px rgba(251,146,60,0.9)" }}
                  />
                </div>
              </div>
            </div>

            <p className="text-white/50 text-xs text-center mt-3">
              Hướng camera vào mã QR — tự động nhận diện
            </p>
          </div>
        </div>
      )}

      <style>{`@keyframes qrLine{0%,100%{top:0}50%{top:calc(100% - 2px)}}`}</style>
    </>
  );
}
