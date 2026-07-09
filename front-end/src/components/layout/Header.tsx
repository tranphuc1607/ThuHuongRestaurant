import Logo from "./Logo";

export default function Header() {
  return (
    <div className="bg-canvas py-3 border-b border-hairline">
      <div className="max-w-[1200px] mx-auto px-4">
        <Logo />
      </div>
    </div>
  );
}
