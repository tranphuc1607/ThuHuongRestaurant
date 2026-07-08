import Link from "next/link";

export default function Header() {
  return (
    <div className="bg-canvas py-3 border-b border-hairline">
      <div className="max-w-[1200px] mx-auto px-4">
        <Link href="/">
          <div className="border-2 border-primary px-3 py-1 inline-flex items-baseline gap-0">
            <span className="text-2xl font-black text-ink tracking-tight">THU</span>
            <span className="text-2xl font-black text-primary tracking-tight">HƯƠNG</span>
          </div>
        </Link>
      </div>
    </div>
  );
}
