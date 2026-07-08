import Link from "next/link";

export default function BookingCTA() {
  return (
    <section className="py-24 px-4 bg-surface-soft">
      <div className="max-w-[1200px] mx-auto">

        {/* Coral callout card — rounded-2xl, not full-bleed */}
        <div className="rounded-2xl overflow-hidden">
          <div
            className="px-10 md:px-16 py-16 text-white"
            style={{ background: "linear-gradient(135deg, #a9583e 0%, #cc785c 100%)" }}
          >
            <div className="max-w-2xl mx-auto text-center">
              <p className="text-xs uppercase tracking-[4px] text-white/60 mb-4 font-semibold">
                Dễ dàng và nhanh chóng
              </p>

              <h2 className="font-serif text-4xl md:text-5xl font-normal text-white mb-5 tracking-tight">
                Đặt Bàn Ngay Hôm Nay
              </h2>

              <p className="text-base text-white/75 mb-10 leading-relaxed max-w-lg mx-auto">
                Chúng tôi phục vụ từ <strong className="text-white">08:00 – 22:00</strong> mỗi ngày.{" "}
                Đặt bàn trước ít nhất 1 tiếng để được phục vụ tốt nhất.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  href="/dat-ban"
                  className="inline-flex items-center gap-2 bg-white text-primary-dark font-semibold px-8 py-3.5 rounded-lg hover:bg-cream transition-colors text-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Đặt Bàn Online
                </Link>
                <a
                  href="tel:0123456789"
                  className="inline-flex items-center gap-2 border border-white/40 text-white font-semibold px-8 py-3.5 rounded-lg hover:bg-white/15 transition-colors text-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeWidth="2" strokeLinecap="round"
                      d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.8a19.79 19.79 0 01-3.07-8.64A2 2 0 012 .95h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 8.92a16 16 0 006.17 6.17l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
                  </svg>
                  Gọi: 0123 456 789
                </a>
              </div>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
