"use client";
import { useRef, useState } from "react";

interface Props {
  value: string;
  onChange: (url: string) => void;
}

export default function ImageUploader({ value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (res.ok && json.url) {
        onChange(json.url);
      } else {
        setError(json.error ?? "Upload thất bại");
      }
    } catch {
      setError("Không kết nối được server");
    } finally {
      setUploading(false);
      // reset input so same file can be re-selected
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function handleUrlChange(e: React.ChangeEvent<HTMLInputElement>) {
    setError("");
    onChange(e.target.value);
  }

  const isLocalUpload = value.startsWith("/uploads/");

  return (
    <div className="space-y-3">
      {/* Preview */}
      {value ? (
        <div className="relative w-full h-44 rounded-xl overflow-hidden border border-hairline bg-surface-soft group">
          <img
            src={value}
            alt="preview"
            className="w-full h-full object-cover"
            onError={(e) => { (e.currentTarget as HTMLImageElement).src = ""; e.currentTarget.style.display = "none"; }}
          />
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 text-white flex items-center justify-center text-xs hover:bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity">
            ✕
          </button>
          {isLocalUpload && (
            <span className="absolute bottom-2 left-2 bg-green-600/80 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
              ✓ Đã upload
            </span>
          )}
        </div>
      ) : (
        /* Drop zone */
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="w-full h-44 rounded-xl border-2 border-dashed border-hairline hover:border-primary bg-surface-soft hover:bg-orange-50 transition-all flex flex-col items-center justify-center gap-2 text-muted-soft hover:text-primary disabled:opacity-50 cursor-pointer">
          {uploading ? (
            <>
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-sm font-medium text-primary">Đang upload...</span>
            </>
          ) : (
            <>
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-sm font-semibold">Nhấn để chọn ảnh</span>
              <span className="text-xs">JPG, PNG, WebP, GIF · Tối đa 5MB</span>
            </>
          )}
        </button>
      )}

      {/* Action buttons when image exists */}
      {value && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-2 text-sm text-primary hover:text-primary-dark font-medium disabled:opacity-50">
          {uploading ? (
            <><div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />Đang upload...</>
          ) : (
            <><span className="text-base">📁</span> Thay ảnh khác</>
          )}
        </button>
      )}

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />

      {/* URL fallback */}
      <div className="space-y-1">
        <label className="text-[10px] font-semibold text-muted-soft uppercase tracking-widest">
          Hoặc nhập URL ảnh
        </label>
        <input
          type="text"
          value={isLocalUpload ? "" : value}
          onChange={handleUrlChange}
          placeholder="https://example.com/image.jpg"
          className="w-full border border-hairline px-3 py-2 text-sm outline-none focus:border-primary rounded-lg bg-canvas text-muted placeholder:text-muted-soft"
        />
      </div>

      {error && (
        <p className="text-red-500 text-xs">{error}</p>
      )}
    </div>
  );
}
