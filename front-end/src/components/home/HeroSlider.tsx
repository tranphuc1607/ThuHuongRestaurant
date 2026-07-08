"use client";
import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";

const slides = [
  {
    id: 1,
    eyebrow: "Tinh hoa ẩm thực Việt Nam",
    title: "Nhà Hàng\nThu Hương",
    subtitle: "Hơn 50 món đặc sắc từ ba miền — trải nghiệm hương vị đích thực trong không gian ấm cúng",
    image: "https://picsum.photos/seed/restaurant-hero/1920/700",
    cta: { label: "Xem Thực Đơn", href: "/san-pham" },
    ctaSecondary: { label: "Đặt Bàn Ngay", href: "/dat-ban" },
  },
  {
    id: 2,
    eyebrow: "Hơn 50 món đặc sắc",
    title: "Thực Đơn\nPhong Phú",
    subtitle: "Nguyên liệu tươi sạch mỗi ngày, chế biến bởi đầu bếp giàu kinh nghiệm với công thức gia truyền",
    image: "https://picsum.photos/seed/food-hero-2/1920/700",
    cta: { label: "Khám Phá Ngay", href: "/san-pham" },
    ctaSecondary: { label: "Giới Thiệu", href: "/gioi-thieu" },
  },
  {
    id: 3,
    eyebrow: "Không gian sang trọng",
    title: "Bữa Ăn\nĐáng Nhớ",
    subtitle: "Phòng riêng và khu vực lớn phục vụ từ tiệc gia đình đến sự kiện doanh nghiệp lên đến 200 khách",
    image: "https://picsum.photos/seed/interior-hero/1920/700",
    cta: { label: "Đặt Bàn Ngay", href: "/dat-ban" },
    ctaSecondary: { label: "Liên Hệ", href: "/lien-he" },
  },
];

export default function HeroSlider() {
  const [current, setCurrent] = useState(0);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setAnimating(true);
      setTimeout(() => {
        setCurrent((prev) => (prev + 1) % slides.length);
        setAnimating(false);
      }, 300);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  function goTo(index: number) {
    if (index === current) return;
    setAnimating(true);
    setTimeout(() => {
      setCurrent(index);
      setAnimating(false);
    }, 300);
  }

  const prev = () => goTo((current - 1 + slides.length) % slides.length);
  const next = () => goTo((current + 1) % slides.length);

  // onPointerDown fires immediately on touch (no 300ms delay, no iOS sticky issues)
  const touchHandler = (fn: () => void) => (e: React.PointerEvent) => {
    if (e.pointerType === "touch") { e.preventDefault(); fn(); }
  };

  const slide = slides[current];

  return (
    <div className="relative w-full h-[420px] sm:h-[500px] md:h-[620px] overflow-hidden select-none bg-surface-dark">
      {/* Background images */}
      {slides.map((s, i) => (
        <div
          key={s.id}
          className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
            i === current ? "opacity-100" : "opacity-0"
          }`}
        >
          <Image
            src={s.image}
            alt={s.title}
            fill
            className="object-cover brightness-[0.38]"
            priority={i === 0}
            sizes="100vw"
          />
        </div>
      ))}

      {/* Gradient overlay — bottom fade for readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent z-10" />

      {/* Content */}
      <div
        className={`absolute inset-0 z-20 flex items-center justify-center transition-all duration-300 ${
          animating ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"
        }`}
      >
        <div className="max-w-3xl mx-auto px-6 text-center text-white">
          {/* Eyebrow */}
          <p className="text-xs uppercase tracking-[4px] text-primary font-semibold mb-5 opacity-90">
            {slide.eyebrow}
          </p>

          {/* Headline — Lora serif, large */}
          <h1
            className="font-serif text-3xl sm:text-5xl md:text-6xl font-normal leading-[1.08] tracking-tight mb-4 md:mb-6 text-white"
            style={{ textShadow: "0 2px 16px rgba(0,0,0,0.5)", whiteSpace: "pre-line" }}
          >
            {slide.title}
          </h1>

          {/* Subtitle */}
          <p className="text-sm md:text-lg text-white/75 mb-6 md:mb-10 max-w-xl mx-auto leading-relaxed hidden sm:block">
            {slide.subtitle}
          </p>

          {/* CTA buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href={slide.cta.href}
              className="inline-flex items-center gap-2 bg-primary text-white font-semibold px-8 py-3.5 rounded-lg hover:bg-primary-dark transition-colors text-sm"
            >
              {slide.cta.label}
            </Link>
            <Link
              href={slide.ctaSecondary.href}
              className="inline-flex items-center gap-2 border border-white/40 text-white font-semibold px-8 py-3.5 rounded-lg hover:bg-white/10 transition-colors text-sm"
            >
              {slide.ctaSecondary.label}
            </Link>
          </div>
        </div>
      </div>

      {/* Arrow controls */}
      <button
        onPointerDown={touchHandler(prev)}
        onClick={prev}
        className="absolute left-4 top-1/2 -translate-y-1/2 z-30 w-11 h-11 rounded-full bg-white/15 hover:bg-white/30 text-white flex items-center justify-center transition-colors backdrop-blur-sm"
        aria-label="Trước"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <polyline points="15 18 9 12 15 6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <button
        onPointerDown={touchHandler(next)}
        onClick={next}
        className="absolute right-4 top-1/2 -translate-y-1/2 z-30 w-11 h-11 rounded-full bg-white/15 hover:bg-white/30 text-white flex items-center justify-center transition-colors backdrop-blur-sm"
        aria-label="Sau"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <polyline points="9 18 15 12 9 6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Dot indicators */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2">
        {slides.map((_, i) => (
          <button
            key={i}
            onPointerDown={touchHandler(() => goTo(i))}
            onClick={() => goTo(i)}
            aria-label={`Slide ${i + 1}`}
            className={`transition-all duration-300 rounded-full ${
              i === current
                ? "w-7 h-2 bg-primary"
                : "w-2 h-2 bg-white/40 hover:bg-white/70"
            }`}
          />
        ))}
      </div>

      {/* Slide counter */}
      <div className="absolute bottom-6 right-6 z-30 text-white/50 text-xs font-medium">
        {String(current + 1).padStart(2, "0")} / {String(slides.length).padStart(2, "0")}
      </div>
    </div>
  );
}
