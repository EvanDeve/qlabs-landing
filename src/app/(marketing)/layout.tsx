import SiteNav from "@/components/layout/SiteNav";
import ScrollMotion from "@/components/marketing/ScrollMotion";
import "./marketing.css";

const CALENDLY_URL = "https://calendly.com/puravidarepublic/aas-pov";

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
      <SiteNav
        logoHref="/"
        logoLabel="Labs"
        actions={[
          { href: CALENDLY_URL, label: "Agendar reunión", variant: "primary", external: true },
        ]}
      />
      {children}
    </div>
  );
}
