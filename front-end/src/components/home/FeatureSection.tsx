const features = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
          d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
        />
      </svg>
    ),
    title: "Nguyên Liệu Tươi Sạch",
    desc: "100% nguyên liệu được tuyển chọn kỹ lưỡng từ các nhà cung cấp uy tín, đảm bảo an toàn vệ sinh thực phẩm.",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
          d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
    title: "Ẩm Thực Ba Miền",
    desc: "Thực đơn phong phú với hơn 50 món đặc sắc từ Bắc, Trung, Nam — gìn giữ hương vị truyền thống đích thực.",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
        />
      </svg>
    ),
    title: "Không Gian Sang Trọng",
    desc: "Thiết kế ấm áp, phù hợp cho bữa ăn gia đình, họp mặt bạn bè hay tiệc doanh nghiệp đến 200 khách.",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
    title: "Đặt Bàn Nhanh Chóng",
    desc: "Đặt bàn online 24/7, nhận xác nhận ngay qua điện thoại — phục vụ từ 08:00 đến 22:00 mỗi ngày.",
  },
];

export default function FeatureSection() {
  return (
    <section className="py-24 bg-canvas">
      <div className="max-w-[1200px] mx-auto px-4">

        {/* Section header */}
        <div className="text-center mb-14">
          <p className="text-primary text-xs uppercase tracking-[4px] font-semibold mb-4">
            Cam kết của chúng tôi
          </p>
          <h2 className="font-serif text-4xl md:text-5xl font-normal text-ink mb-4 tracking-tight">
            Tại Sao Chọn Thu Hương?
          </h2>
          <p className="text-muted text-base max-w-lg mx-auto leading-relaxed">
            Hơn 10 năm phục vụ với tâm huyết — mỗi bữa ăn là một trải nghiệm đáng nhớ
          </p>
        </div>

        {/* Feature cards — surface-card style per design system */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {features.map((f) => (
            <div
              key={f.title}
              className="bg-surface-card rounded-xl p-8 group hover:shadow-md transition-all duration-300"
            >
              {/* Icon circle */}
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-6 text-primary group-hover:bg-primary group-hover:text-white transition-colors duration-300">
                {f.icon}
              </div>

              {/* Title */}
              <h3 className="text-base font-semibold text-ink mb-2 leading-snug">
                {f.title}
              </h3>

              {/* Description */}
              <p className="text-sm text-muted leading-relaxed">
                {f.desc}
              </p>
            </div>
          ))}
        </div>

        {/* Stats row */}
        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { num: "50+", label: "Món ăn đặc sắc" },
            { num: "200+", label: "Khách mỗi ngày" },
            { num: "10+", label: "Năm kinh nghiệm" },
            { num: "4.8★", label: "Đánh giá trung bình" },
          ].map((stat) => (
            <div key={stat.label} className="text-center py-6 border border-hairline rounded-xl">
              <div className="text-3xl font-black text-primary mb-1">{stat.num}</div>
              <div className="text-xs text-muted uppercase tracking-wide">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
