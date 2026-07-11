"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

export default function QrScannerSection() {
  const [scanning, setScanning]   = useState(false);
  const [error, setError]         = useState("");
  const [canLive, setCanLive]     = useState<boolean | null>(null); // null = hydrating
  const videoRef  = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef    = useRef<number>(0);
  const fileRef   = useRef<HTMLInputElement>(null);
  const router    = useRouter();

  // Detect support after hydration (avoid SSR mismatch)
  useEffect(() => {
    setCanLive("BarcodeDetector" in window && !!navigator.mediaDevices?.getUserMedia);
    return () => {
      cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanning(false);
  }, []);

  const goToTable = useCallback(
    (raw: string) => {
      stop();
      try {
        const path = raw.startsWith("http") ? new URL(raw).pathname : raw;
        const m    = path.match(/\/ban\/([^/?#]+)/);
        if (m) { router.push(`/ban/${m[1]}`); return; }
      } catch { /* fall through */ }
      setError("Mã QR này không phải mã bàn nhà hàng. Vui lòng quét đúng mã trên bàn.");
    },
    [router, stop]
  );

  // When modal opens, bind stream + start BarcodeDetector loop
  useEffect(() => {
    if (!scanning || !videoRef.current || !streamRef.current) return;
    const video = videoRef.current;
    video.srcObject = streamRef.current;
    video.play().catch(() => {});
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bd   = new (window as any).BarcodeDetector({ formats: ["qr_code"] });
    let active = true;
    const loop = async () => {
      if (!active || !streamRef.current) return;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const codes: any[] = await bd.detect(video);
        if (codes.length > 0) { goToTable(codes[0].rawValue); return; }
      } catch { /* frame not ready */ }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { active = false; };
  }, [scanning, goToTable]);

  // Primary action — single button handler
  const handleScan = useCallback(async () => {
    setError("");
    if (canLive) {
      // Android Chrome / Desktop Chrome/Edge → live camera scan
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        streamRef.current = stream;
        setScanning(true);
      } catch {
        // Camera denied → fall back to file picker
        fileRef.current?.click();
      }
    } else {
      // iOS Safari / Firefox → open file picker (opens camera on mobile)
      fileRef.current?.click();
    }
  }, [canLive]);

  // File fallback — decodes QR from captured photo
  const handleFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setError("");
      if (!("BarcodeDetector" in window)) {
        // iOS Safari: can't decode in-browser → instruct native camera
        setError(
          "Trình duyệt này chưa hỗ trợ đọc QR. " +
          "Hãy đóng app, mở Camera rồi quét mã QR trực tiếp tại bàn."
        );
        e.target.value = "";
        return;
      }
      try {
        const bmp   = await createImageBitmap(file);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const codes: any[] = await new (window as any).BarcodeDetector({
          formats: ["qr_code"],
        }).detect(bmp);
        if (codes.length > 0) { goToTable(codes[0].rawValue); }
        else { setError("Không tìm thấy mã QR trong ảnh. Chụp gần và rõ hơn, rồi thử lại."); }
      } catch { setError("Không đọc được ảnh. Thử lại với ảnh chụp rõ hơn."); }
      e.target.value = "";
    },
    [goToTable]
  );

  return (
    <section className="relative bg-gradient-to-br from-[#fff7ed] to-[#fefce8] border-y border-orange-100 py-14 px-4 overflow-hidden">
      {/* Decorative circles */}
      <div className="absolute -top-14 -right-14 w-56 h-56 rounded-full bg-orange-100/40 pointer-events-none" />
      <div className="absolute -bottom-12 -left-12 w-44 h-44 rounded-full bg-amber-100/40 pointer-events-none" />

      <div className="relative max-w-[520px] mx-auto text-center">
        {/* QR icon */}
        <div
          className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-5"
          style={{ background: "rgba(204,120,92,0.12)" }}
        >
          <svg viewBox="0 0 24 24" className="w-9 h-9 text-primary" fill="none" stroke="currentColor" strokeWidth="1.5">
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
        </div>

        <p className="text-primary text-xs uppercase tracking-[4px] font-semibold mb-2">
          Theo dõi đơn hàng
        </p>
        <h2
          className="text-2xl font-bold text-ink mb-3"
          style={{ fontFamily: "Georgia, serif" }}
        >
          Quét Mã QR Tại Bàn
        </h2>
        <p className="text-sm text-muted leading-relaxed mb-8">
          Nhấn nút bên dưới — ứng dụng tự chọn cách quét phù hợp với thiết bị của bạn.
        </p>

        {/* Single action button */}
        <button
          onClick={handleScan}
          disabled={canLive === null}
          className="inline-flex items-center justify-center gap-3 bg-primary text-white px-10 py-4 text-base font-bold hover:bg-primary-dark transition-colors disabled:opacity-40"
          style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
          </svg>
          Quét mã QR
        </button>

        {/* Hidden file input — triggered programmatically as fallback */}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFile}
        />

        {/* Device hint — shown after hydration */}
        {canLive !== null && (
          <p className="mt-3 text-xs text-muted-soft">
            {canLive
              ? "📷 Mở camera trực tiếp · tự nhận mã QR"
              : "📱 Mở camera để chụp mã QR"}
          </p>
        )}

        {error && (
          <div className="mt-5 text-xs text-red-600 bg-red-50 border border-red-200 px-4 py-3 rounded-lg text-left">
            {error}
          </div>
        )}
      </div>

      {/* Live camera modal */}
      {scanning && (
        <div className="fixed inset-0 z-[300] bg-black/95 flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-[340px]">
            <div className="flex items-center justify-between mb-4">
              <span className="text-white font-semibold text-sm">Quét mã QR tại bàn</span>
              <button
                onClick={stop}
                className="w-9 h-9 flex items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 transition-colors"
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                ✕
              </button>
            </div>

            <div className="relative rounded-2xl overflow-hidden bg-black" style={{ aspectRatio: "4/3" }}>
              <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />

              {/* Scan overlay */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="relative w-52 h-52">
                  {/* Dimmed border */}
                  <div className="absolute inset-0 border border-white/20" />
                  {/* Corner brackets */}
                  {[
                    "top-0 left-0 border-t-[3px] border-l-[3px]",
                    "top-0 right-0 border-t-[3px] border-r-[3px]",
                    "bottom-0 left-0 border-b-[3px] border-l-[3px]",
                    "bottom-0 right-0 border-b-[3px] border-r-[3px]",
                  ].map((cls, i) => (
                    <div key={i} className={`absolute ${cls} border-primary w-8 h-8`} />
                  ))}
                  {/* Animated scan line */}
                  <div
                    className="absolute left-0 right-0 h-0.5 bg-primary"
                    style={{
                      animation: "qrLine 2s ease-in-out infinite",
                      boxShadow: "0 0 8px rgba(204,120,92,0.9)",
                    }}
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
    </section>
  );
}
