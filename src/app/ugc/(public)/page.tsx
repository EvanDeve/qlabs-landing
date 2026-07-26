import PublicNav from "@/components/ugc/public/PublicNav";
import Hero from "@/components/ugc/public/Hero";
import HowItWorks from "@/components/ugc/public/HowItWorks";
import EarlyAccess from "@/components/ugc/public/EarlyAccess";
import Faq from "@/components/ugc/public/Faq";
import FinalCta from "@/components/ugc/public/FinalCta";

// Las secciones de stats y de campañas publicadas están desmontadas a propósito:
// hasta que entren marcas y creadores reales, lo único que mostraban eran las
// cuentas de prueba. Los componentes siguen en src/components/ugc/public/
// (Stats.tsx, CampaignsGrid.tsx, CampaignCard.tsx) y ya manejan su estado vacío
// —Stats se oculta solo si todo da 0—, así que para reactivarlos basta con
// volver a traer el fetch de `campaign_previews` + `public_marketplace_stats`
// (ver historial de git de este archivo) y montarlos entre <Hero /> y <HowItWorks />.
//
// Mientras tanto, el orden responde a lo que se pregunta un visitante en ese
// orden: qué es esto (Hero) → cómo funciona → por qué no veo campañas todavía
// (EarlyAccess, que lo nombra en vez de dejar que se note) → dudas → registro.
export default function UgcPublicPage() {
  return (
    <>
      <PublicNav />
      <Hero />
      <HowItWorks />
      <EarlyAccess />
      <Faq />
      <FinalCta />
    </>
  );
}
