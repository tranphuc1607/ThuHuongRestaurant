import Image from "next/image";
import Link from "next/link";

const contactItems = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
          d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    label: "Địa chỉ",
    value: "123 Đường Ẩm Thực, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh",
    href: "https://maps.google.com",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
          d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
      </svg>
    ),
    label: "Hotline",
    value: "0123 456 789",
    href: "tel:0123456789",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
          d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    label: "Email",
    value: "thuhuong@gmail.com",
    href: "mailto:thuhuong@gmail.com",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    label: "Giờ mở cửa",
    value: "08:00 – 22:00 (Thứ 2 – Chủ Nhật)",
    href: null,
  },
];

export default function LienHePage() {
  return (
    <>
      {/* Hero */}
      <div className="relative h-[260px] overflow-hidden">
        <Image
          src="https://picsum.photos/seed/contact-hero/1920/520"
          alt="Liên hệ"
          fill
          className="object-cover brightness-50"
          priority
          sizes="100vw"
        />
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white text-center px-4">
          <p className="text-xs uppercase tracking-[4px] opacity-70 mb-3">Chúng tôi luôn lắng nghe</p>
          <h1 className="text-4xl font-bold" style={{ fontFamily: "Georgia, serif" }}>
            Liên Hệ
          </h1>
          <div className="w-12 h-0.5 bg-primary mx-auto mt-4" />
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="bg-surface-soft border-b border-hairline py-2">
        <div className="max-w-[1200px] mx-auto px-4 text-xs text-muted-soft flex gap-2">
          <Link href="/" className="hover:text-primary">Trang chủ</Link>
          <span>›</span>
          <span className="text-gray-600">Liên hệ</span>
        </div>
      </div>

      {/* Main content */}
      <section className="max-w-[1200px] mx-auto px-4 py-14">
        <div className="grid md:grid-cols-2 gap-12">

          {/* Contact info */}
          <div>
            <p className="text-primary text-xs uppercase tracking-[4px] font-semibold mb-2">
              Thông tin liên hệ
            </p>
            <h2
              className="text-2xl font-bold text-ink mb-6"
              style={{ fontFamily: "Georgia, serif" }}
            >
              Hãy Đến Thăm Chúng Tôi
            </h2>
            <p className="text-sm text-muted leading-relaxed mb-8">
              Chúng tôi luôn sẵn lòng đón tiếp bạn. Dù là đặt bàn, góp ý hay chỉ đơn giản muốn hỏi thăm — đừng ngần ngại liên hệ nhé!
            </p>

            <div className="space-y-5">
              {contactItems.map((item) => (
                <div key={item.label} className="flex gap-4 items-start">
                  <div className="w-12 h-12 rounded-full bg-cream flex items-center justify-center text-primary flex-shrink-0">
                    {item.icon}
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-muted-soft mb-0.5">{item.label}</div>
                    {item.href ? (
                      <a href={item.href} className="text-sm font-semibold text-ink hover:text-primary transition-colors">
                        {item.value}
                      </a>
                    ) : (
                      <div className="text-sm font-semibold text-ink">{item.value}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Social */}
            <div className="mt-8 pt-6 border-t border-hairline">
              <div className="text-[10px] uppercase tracking-widest text-muted-soft mb-3">Theo dõi chúng tôi</div>
              <div className="flex gap-3">
                {[
                  { label: "Facebook", short: "f" },
                  { label: "Instagram", short: "in" },
                  { label: "YouTube", short: "yt" },
                ].map((s) => (
                  <button
                    key={s.label}
                    title={s.label}
                    className="w-9 h-9 rounded-full bg-primary-dark text-white text-xs font-bold hover:bg-primary transition-colors flex items-center justify-center"
                  >
                    {s.short}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Image grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="relative col-span-2 h-52 overflow-hidden">
              <Image
                src="https://picsum.photos/seed/contact-restaurant-main/800/400"
                alt="Không gian nhà hàng"
                fill
                className="object-cover hover:scale-105 transition-transform duration-500"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4">
                <span className="text-white text-sm font-semibold">Không gian nhà hàng</span>
              </div>
            </div>

            <div className="relative h-44 overflow-hidden">
              <Image
                src="https://picsum.photos/seed/contact-food-1/400/350"
                alt="Món ăn đặc sắc"
                fill
                className="object-cover hover:scale-105 transition-transform duration-500"
                sizes="25vw"
              />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                <span className="text-white text-xs font-semibold">Món ăn đặc sắc</span>
              </div>
            </div>

            <div className="relative h-44 overflow-hidden">
              <Image
                src="https://picsum.photos/seed/contact-interior/400/350"
                alt="Khu vực VIP"
                fill
                className="object-cover hover:scale-105 transition-transform duration-500"
                sizes="25vw"
              />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                <span className="text-white text-xs font-semibold">Khu vực VIP</span>
              </div>
            </div>

            <div className="relative h-44 overflow-hidden">
              <Image
                src="https://picsum.photos/seed/contact-food-2/400/350"
                alt="Hải sản tươi sống"
                fill
                className="object-cover hover:scale-105 transition-transform duration-500"
                sizes="25vw"
              />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                <span className="text-white text-xs font-semibold">Hải sản tươi sống</span>
              </div>
            </div>

            <div className="relative h-44 overflow-hidden">
              <Image
                src="https://picsum.photos/seed/contact-chef/400/350"
                alt="Đội ngũ bếp"
                fill
                className="object-cover hover:scale-105 transition-transform duration-500"
                sizes="25vw"
              />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                <span className="text-white text-xs font-semibold">Đội ngũ bếp</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Map placeholder */}
      <div className="relative h-[320px] bg-canvas overflow-hidden">
        <Image
          src="https://picsum.photos/seed/map-placeholder/1920/400"
          alt="Bản đồ"
          fill
          className="object-cover opacity-60"
          sizes="100vw"
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="bg-canvas px-6 py-4 text-center shadow-lg">
            <div className="text-primary text-2xl mb-1">📍</div>
            <div className="font-bold text-ink text-sm">Nhà hàng Thu Hương</div>
            <div className="text-xs text-muted mt-1">123 Đường Ẩm Thực, Quận 1, TP.HCM</div>
            <a
              href="https://maps.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-3 bg-primary text-white text-xs px-4 py-1.5 hover:bg-primary-dark transition-colors"
            >
              Xem trên Google Maps
            </a>
          </div>
        </div>
      </div>

      {/* Bottom CTA */}
      <section className="bg-cream py-10 text-center px-4">
        <p className="text-sm text-gray-600 mb-4">
          Muốn đặt bàn ngay? Chúng tôi có thể xác nhận trong vài phút.
        </p>
        <Link
          href="/dat-ban"
          className="inline-block bg-primary text-white px-8 py-3 text-sm font-bold uppercase tracking-wide hover:bg-primary-dark transition-colors"
        >
          Đặt Bàn Trực Tuyến
        </Link>
      </section>
    </>
  );
}
