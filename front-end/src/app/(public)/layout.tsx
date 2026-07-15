import TopBar from "@/components/layout/TopBar";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import ContactFloat from "@/components/layout/ContactFloat";
import QrFloat from "@/components/layout/QrFloat";
import TableSessionFloat from "@/components/layout/TableSessionFloat";
import DishCartFloat from "@/components/menu/DishCartFloat";
import CartAddedToast from "@/components/menu/CartAddedToast";
import ScrollToTopButton from "@/components/layout/ScrollToTopButton";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen">
      <TopBar />
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
      <ContactFloat />
      <QrFloat />
      <TableSessionFloat />
      <DishCartFloat />
      <CartAddedToast />
      <ScrollToTopButton />
    </div>
  );
}
