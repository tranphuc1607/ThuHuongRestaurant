"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SearchBar({ defaultValue = "" }: { defaultValue?: string }) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const kw = value.trim();
    if (!kw) {
      router.push("/san-pham");
      return;
    }
    router.push(`/san-pham?keyword=${encodeURIComponent(kw)}`);
  }

  function handleClear() {
    setValue("");
    router.push("/san-pham");
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-0 w-full max-w-sm">
      <div className="relative flex-1">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Tìm món ăn..."
          className="w-full border border-hairline border-r-0 pl-3 pr-8 py-2 text-sm outline-none focus:border-primary transition-colors"
        />
        {value && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-soft hover:text-gray-600 text-lg leading-none"
          >
            ×
          </button>
        )}
      </div>
      <button
        type="submit"
        className="bg-primary text-white px-4 py-2 text-sm hover:bg-primary-dark transition-colors flex-shrink-0"
      >
        🔍
      </button>
    </form>
  );
}
