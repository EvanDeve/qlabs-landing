import NavMarketing from "@/components/layout/NavMarketing";
import ScrollMotion from "@/components/marketing/ScrollMotion";
import "./marketing.css";

export default function MarketingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="qlabs-marketing">
      <ScrollMotion />
      {/* Progreso de lectura. Va antes del nav para que quede por encima. */}
      <div className="scroll-progress" aria-hidden>
        <div className="scroll-progress-bar" />
      </div>
      <NavMarketing />
      {children}
    </div>
  );
}
