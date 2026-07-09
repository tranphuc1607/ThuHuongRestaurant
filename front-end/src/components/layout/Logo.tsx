import Link from "next/link";

const LANTERN = (
  <svg width="18" height="26" viewBox="0 0 18 26" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
    <line x1="9" y1="0" x2="9" y2="3" stroke="#ea580c" strokeWidth="1.4" strokeLinecap="round"/>
    <rect x="3" y="3" width="12" height="2" rx="1" fill="#c2410c"/>
    <path d="M3 5 Q0 10 0 13 Q0 16.5 3 21 H15 Q18 16.5 18 13 Q18 10 15 5 Z" fill="#ea580c"/>
    <line x1="9" y1="5" x2="9" y2="21" stroke="white" strokeWidth="0.7" opacity="0.25"/>
    <line x1="5.5" y1="5.5" x2="4.5" y2="20.5" stroke="white" strokeWidth="0.4" opacity="0.15"/>
    <line x1="12.5" y1="5.5" x2="13.5" y2="20.5" stroke="white" strokeWidth="0.4" opacity="0.15"/>
    <rect x="3" y="21" width="12" height="2" rx="1" fill="#c2410c"/>
    <path d="M6 23 L5.5 26 M9 23 L9 26 M12 23 L12.5 26" stroke="#9a3412" strokeWidth="1" strokeLinecap="round"/>
  </svg>
);

const sizes = {
  sm: "text-[14px]",
  md: "text-[17px]",
  lg: "text-[22px]",
};

type Props = {
  href?: string;
  onDark?: boolean;
  size?: "sm" | "md" | "lg";
  showSubtitle?: boolean;
  className?: string;
};

function LogoInner({ onDark = false, size = "md", showSubtitle = false }: Props) {
  const sz = sizes[size];
  const nameColor = onDark ? "text-white" : "text-ink";

  return (
    <span className="flex items-center gap-2.5">
      {LANTERN}
      <span className="flex flex-col leading-none gap-[3px]">
        {showSubtitle && (
          <span
            className="text-[10px] font-medium tracking-[0.22em] text-primary/70 uppercase leading-none"
            style={{ fontFamily: "var(--font-serif)", fontStyle: "italic" }}
          >
            Nhà hàng
          </span>
        )}
        <span className="flex items-baseline gap-1">
          <span className={`${sz} font-black ${nameColor} tracking-[0.06em] leading-none uppercase`}>THU</span>
          <span className={`${sz} font-black text-primary tracking-[0.06em] leading-none uppercase`}>HƯƠNG</span>
        </span>
      </span>
    </span>
  );
}

/** Dùng trong Link có sẵn (sidebar, header tùy chỉnh) */
export function LogoMark({ onDark = false, size = "md", showSubtitle = false }: Omit<Props, "href" | "className">) {
  return <LogoInner onDark={onDark} size={size} showSubtitle={showSubtitle} />;
}

export default function Logo({ href = "/", onDark = false, size = "md", showSubtitle = false, className = "" }: Props) {
  return (
    <Link href={href} className={`flex-shrink-0 inline-flex ${className}`}>
      <LogoInner onDark={onDark} size={size} showSubtitle={showSubtitle} />
    </Link>
  );
}
