import Link from "next/link";

const navLinks = [
  { href: "/", label: "Trang chủ" },
  { href: "/gioi-thieu", label: "Giới thiệu" },
  { href: "/san-pham", label: "Thực đơn" },
  { href: "/dat-ban", label: "Đặt bàn" },
  { href: "/lien-he", label: "Liên hệ" },
];

const accountLinks = [
  { href: "/tai-khoan/dang-nhap", label: "Đăng nhập" },
  { href: "/tai-khoan/dang-ky", label: "Đăng ký" },
  { href: "/tai-khoan", label: "Tài khoản của tôi" },
  { href: "/dat-ban/lich-su", label: "Lịch sử đặt bàn" },
];

const supportLinks = [
  { href: "/lien-he", label: "Liên hệ hỗ trợ" },
  { href: "/dat-ban", label: "Hướng dẫn đặt bàn" },
  { href: "/gioi-thieu", label: "Về nhà hàng" },
  { href: "/lien-he", label: "Góp ý & phản hồi" },
];

export default function Footer() {
  return (
    <footer className="bg-surface-dark mt-12">
      <div className="max-w-[1200px] mx-auto px-4 pt-10 pb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/">
              <div className="border-2 border-primary px-3 py-1 inline-flex items-baseline mb-4">
                <span className="text-xl font-black text-on-dark tracking-tight">THU</span>
                <span className="text-xl font-black text-primary tracking-tight">HƯƠNG</span>
              </div>
            </Link>
            <p className="text-xs text-on-dark-soft leading-relaxed mb-4">
              Nơi hội tụ tinh hoa ẩm thực Việt Nam với hơn 50 món đặc sắc từ ba miền. Phục vụ từ 08:00 – 22:00 mỗi ngày.
            </p>
            <div className="space-y-1 text-xs text-on-dark-soft">
              <div>📍 123 Đường Ẩm Thực, Quận 1, TP.HCM</div>
              <div>📞 <a href="tel:0123456789" className="hover:text-primary">0123 456 789</a></div>
              <div>✉️ <a href="mailto:thuhuong@gmail.com" className="hover:text-primary">thuhuong@gmail.com</a></div>
            </div>
          </div>

          {/* Navigation */}
          <div>
            <h3 className="text-xs font-semibold text-on-dark mb-4 uppercase tracking-[1.5px]">
              ĐIỀU HƯỚNG
            </h3>
            <ul className="space-y-2">
              {navLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-on-dark-soft hover:text-primary transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Account */}
          <div>
            <h3 className="text-xs font-semibold text-on-dark mb-4 uppercase tracking-[1.5px]">
              TÀI KHOẢN
            </h3>
            <ul className="space-y-2">
              {accountLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-on-dark-soft hover:text-primary transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Support + Social */}
          <div>
            <h3 className="text-xs font-semibold text-on-dark mb-4 uppercase tracking-[1.5px]">
              HỖ TRỢ
            </h3>
            <ul className="space-y-2 mb-5">
              {supportLinks.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="text-sm text-on-dark-soft hover:text-primary transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>

            <h3 className="text-xs font-semibold text-on-dark mb-3 uppercase tracking-[1.5px]">
              THEO DÕI
            </h3>
            <div className="flex gap-2">
              {[
                { label: "f", title: "Facebook" },
                { label: "in", title: "Instagram" },
                { label: "yt", title: "YouTube" },
              ].map((s) => (
                <button
                  key={s.label}
                  title={s.title}
                  className="w-8 h-8 rounded-full bg-surface-dark-elevated text-on-dark-soft text-xs font-bold hover:bg-primary hover:text-white transition-colors flex items-center justify-center"
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-8 pt-6 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-3">
          <p className="text-xs text-on-dark-soft">
            © 2024 Nhà hàng Thu Hương. All rights reserved.
          </p>
          <div className="flex items-center gap-2">
            <span className="text-xs text-on-dark-soft">Thanh toán:</span>
            <span className="bg-blue-700 text-white text-[10px] font-bold px-2 py-0.5 rounded">VISA</span>
            <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded">MC</span>
            <span className="bg-blue-500 text-white text-[10px] font-bold px-2 py-0.5 rounded">QR</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
