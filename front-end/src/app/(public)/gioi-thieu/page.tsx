import Image from "next/image";
import Link from "next/link";

const values = [
  {
    icon: "🌿",
    title: "Nguyên liệu tươi sạch",
    desc: "Chúng tôi chỉ sử dụng nguyên liệu được tuyển chọn kỹ lưỡng từ các nhà cung cấp uy tín, thu mua hàng ngày để đảm bảo độ tươi ngon.",
  },
  {
    icon: "👨‍🍳",
    title: "Đầu bếp nhiều kinh nghiệm",
    desc: "Đội ngũ đầu bếp với hơn 15 năm kinh nghiệm, am hiểu ẩm thực truyền thống ba miền và không ngừng sáng tạo.",
  },
  {
    icon: "🏡",
    title: "Không gian ấm cúng",
    desc: "Thiết kế kết hợp phong cách hiện đại và nét văn hóa Việt, tạo không gian ấm áp phù hợp cho mọi buổi ăn.",
  },
  {
    icon: "💝",
    title: "Tận tâm phục vụ",
    desc: "Mỗi thực khách là một người thân. Chúng tôi cam kết mang đến trải nghiệm ẩm thực trọn vẹn từ khi đặt bàn đến khi ra về.",
  },
];

const milestones = [
  { year: "2014", title: "Thành lập", desc: "Nhà hàng Thu Hương khai trương tại Quận 1, TP.HCM với thực đơn 20 món đặc trưng." },
  { year: "2016", title: "Mở rộng", desc: "Nâng cấp không gian, tăng sức chứa lên 200 khách và bổ sung thực đơn hải sản tươi sống." },
  { year: "2019", title: "Top nhà hàng", desc: "Được bình chọn Top 10 nhà hàng ẩm thực Việt được yêu thích tại TP.HCM." },
  { year: "2022", title: "Đặt bàn online", desc: "Ra mắt hệ thống đặt bàn trực tuyến, phục vụ hơn 500 lượt đặt bàn mỗi tháng." },
  { year: "2024", title: "Hôm nay", desc: "Hơn 50 món, phục vụ 200+ thực khách mỗi ngày, đánh giá trung bình 4.8★." },
];

const gallery = [
  { seed: "restaurant-interior-1", label: "Khu vực gia đình" },
  { seed: "restaurant-food-1", label: "Phở Bò Đặc Biệt" },
  { seed: "restaurant-interior-2", label: "Không gian VIP" },
  { seed: "restaurant-food-2", label: "Lẩu Thái Hải Sản" },
  { seed: "restaurant-chef", label: "Bếp trưởng" },
  { seed: "restaurant-food-3", label: "Bò Lúc Lắc" },
];

export default function GioiThieuPage() {
  return (
    <>
      {/* Hero */}
      <div className="relative h-[320px] overflow-hidden">
        <Image
          src="https://picsum.photos/seed/about-hero-restaurant/1920/640"
          alt="Nhà hàng Thu Hương"
          fill
          className="object-cover brightness-50"
          priority
          sizes="100vw"
        />
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white text-center px-4">
          <p className="text-xs uppercase tracking-[4px] opacity-70 mb-3">Câu chuyện của chúng tôi</p>
          <h1
            className="text-4xl md:text-5xl font-bold"
            style={{ fontFamily: "Georgia, serif" }}
          >
            Giới Thiệu
          </h1>
          <div className="w-12 h-0.5 bg-primary mx-auto mt-4" />
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="bg-surface-soft border-b border-hairline py-2">
        <div className="max-w-[1200px] mx-auto px-4 text-xs text-muted-soft flex gap-2">
          <Link href="/" className="hover:text-primary">Trang chủ</Link>
          <span>›</span>
          <span className="text-gray-600">Giới thiệu</span>
        </div>
      </div>

      {/* Story section */}
      <section className="max-w-[1200px] mx-auto px-4 py-14">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div className="relative h-[380px] overflow-hidden rounded-sm">
            <Image
              src="https://picsum.photos/seed/restaurant-story/600/500"
              alt="Câu chuyện Thu Hương"
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
            {/* Overlay badge */}
            <div className="absolute bottom-6 left-6 bg-primary text-white px-5 py-3">
              <div className="text-2xl font-black">10+</div>
              <div className="text-xs uppercase tracking-wide">Năm kinh nghiệm</div>
            </div>
          </div>

          <div>
            <p className="text-primary text-xs uppercase tracking-[4px] font-semibold mb-3">
              Câu chuyện của chúng tôi
            </p>
            <h2
              className="text-2xl md:text-3xl font-bold text-ink mb-5 leading-snug"
              style={{ fontFamily: "Georgia, serif" }}
            >
              Hành Trình 10 Năm Gìn Giữ<br />Hương Vị Việt Nam
            </h2>
            <div className="space-y-4 text-sm text-gray-600 leading-relaxed">
              <p>
                Nhà hàng Thu Hương được thành lập năm 2014 với một tâm nguyện giản dị — gìn giữ và lan tỏa những hương vị ẩm thực truyền thống Việt Nam đến với đông đảo thực khách.
              </p>
              <p>
                Tên "Thu Hương" — <em>Hương thơm của mùa Thu</em> — gợi lên sự ấm áp, tinh tế và bền bỉ theo thời gian, đúng như tiêu chí mà chúng tôi luôn theo đuổi trong từng món ăn.
              </p>
              <p>
                Sau hơn 10 năm, chúng tôi tự hào phục vụ hàng trăm lượt thực khách mỗi ngày với thực đơn hơn 50 món đặc sắc từ Bắc, Trung, Nam — mỗi món là một câu chuyện về văn hóa và con người Việt Nam.
              </p>
            </div>
            <Link
              href="/dat-ban"
              className="inline-block mt-7 bg-primary text-white px-7 py-3 text-sm font-bold uppercase tracking-wide hover:bg-primary-dark transition-colors"
            >
              Đặt Bàn Ngay
            </Link>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="bg-cream py-14">
        <div className="max-w-[1200px] mx-auto px-4">
          <div className="text-center mb-10">
            <p className="text-primary text-xs uppercase tracking-[4px] font-semibold mb-2">Cam kết</p>
            <h2
              className="text-2xl md:text-3xl font-bold text-ink"
              style={{ fontFamily: "Georgia, serif" }}
            >
              Giá Trị Cốt Lõi
            </h2>
            <div className="w-12 h-0.5 bg-primary mx-auto mt-3" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {values.map((v) => (
              <div key={v.title} className="bg-canvas p-6 text-center hover:shadow-md transition-shadow">
                <div className="text-4xl mb-4">{v.icon}</div>
                <h3 className="font-bold text-ink text-sm mb-2 leading-snug">{v.title}</h3>
                <p className="text-xs text-muted leading-relaxed">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Milestones */}
      <section className="max-w-[1200px] mx-auto px-4 py-14">
        <div className="text-center mb-10">
          <p className="text-primary text-xs uppercase tracking-[4px] font-semibold mb-2">Lịch sử hình thành</p>
          <h2
            className="text-2xl md:text-3xl font-bold text-ink"
            style={{ fontFamily: "Georgia, serif" }}
          >
            Các Mốc Quan Trọng
          </h2>
          <div className="w-12 h-0.5 bg-primary mx-auto mt-3" />
        </div>

        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-1/2 -translate-x-px top-0 bottom-0 w-0.5 bg-gray-200 hidden md:block" />

          <div className="space-y-8">
            {milestones.map((m, i) => (
              <div
                key={m.year}
                className={`flex flex-col md:flex-row gap-4 items-center md:items-start ${i % 2 === 0 ? "md:flex-row" : "md:flex-row-reverse"}`}
              >
                <div className={`flex-1 ${i % 2 === 0 ? "md:text-right md:pr-10" : "md:text-left md:pl-10"}`}>
                  <div className="bg-canvas border border-hairline p-5 inline-block hover:shadow-md transition-shadow">
                    <div className="text-primary font-black text-lg mb-1">{m.year}</div>
                    <div className="font-bold text-ink text-sm mb-1">{m.title}</div>
                    <p className="text-xs text-muted leading-relaxed">{m.desc}</p>
                  </div>
                </div>
                {/* Center dot */}
                <div className="w-4 h-4 rounded-full bg-primary border-4 border-white shadow hidden md:block flex-shrink-0 mt-5" />
                <div className="flex-1 hidden md:block" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Gallery */}
      <section className="bg-cream py-14">
        <div className="max-w-[1200px] mx-auto px-4">
          <div className="text-center mb-10">
            <p className="text-primary text-xs uppercase tracking-[4px] font-semibold mb-2">Hình ảnh</p>
            <h2
              className="text-2xl md:text-3xl font-bold text-ink"
              style={{ fontFamily: "Georgia, serif" }}
            >
              Không Gian &amp; Món Ăn
            </h2>
            <div className="w-12 h-0.5 bg-primary mx-auto mt-3" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {gallery.map((g) => (
              <div key={g.seed} className="relative h-52 overflow-hidden group">
                <Image
                  src={`https://picsum.photos/seed/${g.seed}/500/350`}
                  alt={g.label}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                  sizes="(max-width: 768px) 50vw, 33vw"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-end p-3">
                  <span className="text-white text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                    {g.label}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-14 text-center px-4"
        style={{ background: "linear-gradient(135deg, #a9583e 0%, #cc785c 100%)" }}
      >
        <p className="text-xs uppercase tracking-[4px] text-white/70 mb-3">Bắt đầu trải nghiệm</p>
        <h2
          className="text-2xl md:text-3xl font-bold text-white mb-4"
          style={{ fontFamily: "Georgia, serif" }}
        >
          Hãy Đến Thưởng Thức Cùng Chúng Tôi
        </h2>
        <p className="text-white/80 text-sm mb-8 max-w-md mx-auto">
          Đặt bàn trước để có chỗ ngồi tốt nhất và được phục vụ chu đáo nhất.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/dat-ban"
            className="inline-block bg-white text-primary-dark font-bold px-8 py-3 hover:bg-cream transition-colors uppercase tracking-wide text-sm"
          >
            Đặt Bàn Ngay
          </Link>
          <Link
            href="/san-pham"
            className="inline-block border border-white text-white font-bold px-8 py-3 hover:bg-white/10 transition-colors uppercase tracking-wide text-sm"
          >
            Xem Thực Đơn
          </Link>
        </div>
      </section>
    </>
  );
}
