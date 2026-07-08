import Image from "next/image";
import Link from "next/link";

type Props = {
  title: string;
  subtitle: string;
  discount: string;
  image: string;
  ctaLink: string;
};

export default function PromoBanner({ title, subtitle, discount, image, ctaLink }: Props) {
  return (
    <div className="relative h-[140px] overflow-hidden my-8 rounded-sm">
      <Image
        src={image}
        alt={title}
        fill
        className="object-cover brightness-50"
        sizes="100vw"
      />
      <div className="absolute inset-0 flex items-center px-8 gap-6">
        <div className="flex-1 text-white">
          <h3 className="text-xl font-bold uppercase tracking-wide">{title}</h3>
          <p className="text-sm opacity-80 mt-1">{subtitle}</p>
          <Link
            href={ctaLink}
            className="mt-3 inline-block border border-white text-white text-xs px-4 py-1.5 hover:bg-white hover:text-primary-dark transition-colors"
          >
            Xem thêm
          </Link>
        </div>
        <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center flex-shrink-0 border-2 border-white/30">
          <span className="text-white text-lg font-black leading-tight text-center">{discount}</span>
        </div>
      </div>
    </div>
  );
}
