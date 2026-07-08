const reviews = [
  {
    name: "Nguyễn Thị Lan",
    role: "Khách hàng thân thiết",
    avatar: "https://picsum.photos/seed/avatar-1/80/80",
    rating: 5,
    text: "Món Phở Bò ở đây ngon tuyệt, nước dùng đậm đà, thịt bò mềm. Không gian sạch sẽ, phục vụ nhanh nhẹn. Sẽ quay lại nhiều lần nữa!",
  },
  {
    name: "Trần Minh Đức",
    role: "Food Blogger",
    avatar: "https://picsum.photos/seed/avatar-2/80/80",
    rating: 5,
    text: "Đã thử nhiều nhà hàng Việt nhưng Thu Hương thực sự nổi bật. Bún Bò Huế cay vừa phải, Cơm Tấm thơm ngon. Đặc biệt thích không gian ấm cúng.",
  },
  {
    name: "Phạm Thu Hà",
    role: "Nhân viên văn phòng",
    avatar: "https://picsum.photos/seed/avatar-3/80/80",
    rating: 5,
    text: "Đặt bàn online cực kỳ tiện lợi, nhận xác nhận ngay. Đến nơi đã có bàn sẵn. Lẩu Thái hải sản rất tươi, giá cả hợp lý so với chất lượng.",
  },
];

function Stars({ count }: { count: number }) {
  return (
    <div className="flex gap-0.5 mb-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= count ? "text-yellow-400" : "text-gray-300"}>
          ★
        </span>
      ))}
    </div>
  );
}

export default function TestimonialSection() {
  return (
    <section className="py-14 bg-canvas">
      <div className="max-w-[1200px] mx-auto px-4">
        <div className="text-center mb-10">
          <p className="text-primary text-xs uppercase tracking-[4px] font-semibold mb-2">
            Khách hàng nói gì
          </p>
          <h2
            className="text-2xl md:text-3xl font-bold text-ink"
            style={{ fontFamily: "Georgia, serif" }}
          >
            Đánh Giá Từ Thực Khách
          </h2>
          <div className="w-12 h-0.5 bg-primary mx-auto mt-3" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {reviews.map((r) => (
            <div
              key={r.name}
              className="bg-cream p-6 relative"
            >
              {/* Quote mark */}
              <div className="absolute top-4 right-5 text-5xl text-primary/20 font-serif leading-none select-none">
                "
              </div>

              <Stars count={r.rating} />
              <p className="text-sm text-gray-600 leading-relaxed mb-5 italic">"{r.text}"</p>

              <div className="flex items-center gap-3 pt-4 border-t border-hairline">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={r.avatar}
                  alt={r.name}
                  className="w-10 h-10 rounded-full object-cover"
                />
                <div>
                  <div className="font-semibold text-sm text-ink">{r.name}</div>
                  <div className="text-xs text-muted-soft">{r.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
