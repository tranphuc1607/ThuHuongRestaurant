import Image from "next/image";
import Link from "next/link";
import { productsApi, BackendProduct } from "@/lib/api";

const CATS = [
  { key: "BEEF",       title: "Món Bò",    subtitle: "ĐẬM ĐÀ · ĐẶC SẮC",        href: "/san-pham?category=BEEF",       wide: true  },
  { key: "FISH",       title: "Hải Sản",   subtitle: "TƯƠI SỐNG MỖI NGÀY",        href: "/san-pham?category=FISH",       wide: false },
  { key: "CHICKEN",    title: "Món Gà",    subtitle: "HƯƠNG VỊ ĐỒNG QUÊ",         href: "/san-pham?category=CHICKEN",    wide: false },
  { key: "DRINK_FOOD", title: "Món Nhậu",  subtitle: "TINH HOA ẨM THỰC",          href: "/san-pham?category=DRINK_FOOD", wide: false },
];

const FALLBACKS: Record<string, string> = {
  BEEF:       "https://picsum.photos/seed/beef-dish/600/400",
  FISH:       "https://picsum.photos/seed/seafood-dish/600/400",
  CHICKEN:    "https://picsum.photos/seed/chicken-dish/600/400",
  DRINK_FOOD: "https://picsum.photos/seed/nhau-dish/600/400",
};

function resolveImage(p: BackendProduct | undefined, key: string): string {
  const url = p?.imageUrl;
  if (!url) return FALLBACKS[key];
  try {
    const { hostname } = new URL(url);
    const blocked = ["restaurant.com", "localhost", "example.com", "placehold.co"];
    if (blocked.includes(hostname)) return FALLBACKS[key];
  } catch {
    return FALLBACKS[key];
  }
  return url;
}

export default async function CategoryBanner() {
  const results = await Promise.all(
    CATS.map((c) =>
      productsApi.list({ category: c.key, size: 1 }).catch(() => null)
    )
  );

  const images = CATS.map((c, i) =>
    resolveImage(results[i]?.content?.[0], c.key)
  );

  return (
    <div className="max-w-[1200px] mx-auto px-4 py-4 md:py-6">

      {/* ── Mobile (< md): lưới 2×2 bằng nhau ── */}
      <div className="md:hidden">
        <div className="grid grid-cols-2 gap-2.5" style={{ height: 220 }}>
          {CATS.map((cat, i) => (
            <Link key={cat.key} href={cat.href} className="group relative overflow-hidden rounded-xl">
              <Image
                src={images[i]}
                alt={cat.title}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-500 brightness-[0.55]"
                sizes="200px"
              />
              <div className="absolute inset-0 flex flex-col items-center justify-end pb-3 text-center text-white">
                <h3
                  className="text-sm font-bold leading-tight"
                  style={{ fontFamily: "Georgia, serif", fontStyle: "italic", textShadow: "0 2px 4px rgba(0,0,0,0.8)" }}
                >
                  {cat.title}
                </h3>
                <p className="text-[8px] uppercase tracking-[2px] mt-0.5 opacity-75">{cat.subtitle}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Desktop (≥ md): layout gốc 3-cột ── */}
      <div className="hidden md:block">
        <div className="grid grid-cols-3 grid-rows-2 gap-3" style={{ height: 340 }}>
          {/* Wide card — spans 2 rows */}
          <Link
            href={CATS[0].href}
            className="group relative overflow-hidden row-span-2 col-span-1"
          >
            <Image
              src={images[0]}
              alt={CATS[0].title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-500 brightness-[0.6]"
              sizes="400px"
            />
            <div className="absolute inset-0 flex flex-col items-center justify-end pb-6 text-center text-white">
              <h3
                className="text-2xl font-bold"
                style={{ fontFamily: "Georgia, serif", fontStyle: "italic", textShadow: "0 2px 6px rgba(0,0,0,0.7)" }}
              >
                {CATS[0].title}
              </h3>
              <p className="text-[10px] uppercase tracking-[3px] mt-1 opacity-80">{CATS[0].subtitle}</p>
              <div className="mt-2 w-8 h-0.5 bg-primary" />
            </div>
          </Link>

          {/* 3 smaller cards */}
          {CATS.slice(1).map((cat, i) => (
            <Link key={cat.key} href={cat.href} className="group relative overflow-hidden">
              <Image
                src={images[i + 1]}
                alt={cat.title}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-500 brightness-[0.6]"
                sizes="280px"
              />
              <div className="absolute inset-0 flex flex-col items-center justify-end pb-4 text-center text-white">
                <h3
                  className="text-lg font-bold"
                  style={{ fontFamily: "Georgia, serif", fontStyle: "italic", textShadow: "0 2px 4px rgba(0,0,0,0.7)" }}
                >
                  {cat.title}
                </h3>
                <p className="text-[9px] uppercase tracking-[2px] mt-0.5 opacity-80">{cat.subtitle}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

    </div>
  );
}
