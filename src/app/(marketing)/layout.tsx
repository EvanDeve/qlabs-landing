import NavMarketing from "@/components/layout/NavMarketing";
import FadeUpMotion from "@/components/marketing/FadeUpMotion";
import "./marketing.css";

export default function MarketingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="qlabs-marketing">
      <FadeUpMotion />
      <NavMarketing />
      {children}
    </div>
  );
}
