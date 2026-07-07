import { createClient } from "@/lib/supabase/server";
import PublicNav from "@/components/ugc/public/PublicNav";
import Hero from "@/components/ugc/public/Hero";
import Stats from "@/components/ugc/public/Stats";
import CampaignsGrid from "@/components/ugc/public/CampaignsGrid";
import SuccessCases from "@/components/ugc/public/SuccessCases";
import Faq from "@/components/ugc/public/Faq";
import FinalCta from "@/components/ugc/public/FinalCta";

export const dynamic = "force-dynamic";

export default async function UgcPublicPage() {
  const supabase = await createClient();

  const [{ data: campaigns }, { data: stats }] = await Promise.all([
    supabase
      .from("campaign_previews")
      .select("*")
      .order("published_at", { ascending: false }),
    supabase.rpc("public_marketplace_stats").single(),
  ]);

  return (
    <>
      <PublicNav />
      <Hero />
      <Stats
        campaignsCount={stats?.published_campaigns_count ?? campaigns?.length ?? 0}
        creatorsCount={stats?.creators_count ?? 0}
        brandsCount={stats?.brands_count ?? 0}
      />
      <CampaignsGrid campaigns={campaigns ?? []} />
      <SuccessCases />
      <Faq />
      <FinalCta />
    </>
  );
}
