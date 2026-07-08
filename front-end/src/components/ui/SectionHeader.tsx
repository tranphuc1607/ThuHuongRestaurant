type Props = {
  title: string;
  showArrows?: boolean;
};

export default function SectionHeader({ title, showArrows }: Props) {
  return (
    <div className="flex items-center bg-primary-dark text-white px-3 py-2 mb-4">
      <h2 className="text-sm font-bold uppercase tracking-wider flex-1">{title}</h2>
      {showArrows && (
        <div className="flex gap-1">
          <button className="w-6 h-6 bg-white/20 hover:bg-white/40 flex items-center justify-center text-xs font-bold transition-colors">
            ‹
          </button>
          <button className="w-6 h-6 bg-white/20 hover:bg-white/40 flex items-center justify-center text-xs font-bold transition-colors">
            ›
          </button>
        </div>
      )}
    </div>
  );
}
