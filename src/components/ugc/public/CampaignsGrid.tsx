import type { Database } from "@/lib/database.types";
import CampaignCard from "./CampaignCard";

type CampaignPreview = Database["public"]["Views"]["campaign_previews"]["Row"];

export default function CampaignsGrid({ campaigns }: { campaigns: CampaignPreview[] }) {
  return (
    <section className="border-b border-line bg-lavender/40">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-ink">
            Campañas publicadas ahora
          </h2>
          <p className="mt-3 text-ink-soft">
            Marcas costarricenses buscando creadores como vos. Registrate como
            creador para ver el brief completo y aplicar.
          </p>
        </div>

        {campaigns.length > 0 ? (
          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {campaigns.map((campaign) => (
              <CampaignCard key={campaign.id} campaign={campaign} />
            ))}
          </div>
        ) : (
          <p className="mt-12 text-center text-ink-soft">
            Todavía no hay campañas publicadas. Volvé pronto.
          </p>
        )}
      </div>
    </section>
  );
}
