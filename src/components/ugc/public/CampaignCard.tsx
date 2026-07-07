import Link from "next/link";
import type { Database } from "@/lib/database.types";
import { FORMAT_LABEL } from "@/lib/ugc/deliverables";

type CampaignPreview = Database["public"]["Views"]["campaign_previews"]["Row"];

export default function CampaignCard({ campaign }: { campaign: CampaignPreview }) {
  const formats = campaign.deliverable_types ?? [];

  return (
    <div className="flex flex-col rounded-card border border-line bg-white p-6">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-bold text-ink-soft">{campaign.brand_name}</span>
        {campaign.industry && (
          <span className="rounded-pill bg-lavender px-3 py-1 text-xs font-bold text-violet-deep">
            {campaign.industry}
          </span>
        )}
      </div>

      <h3 className="mt-3 text-lg font-extrabold leading-snug text-ink">{campaign.title}</h3>

      {formats.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {formats.map((format) => (
            <span
              key={format}
              className="rounded-pill border border-line px-3 py-1 text-xs font-semibold text-ink-soft"
            >
              {FORMAT_LABEL[format] ?? format}
            </span>
          ))}
        </div>
      )}

      <div className="relative mt-5 overflow-hidden rounded-sm">
        <div aria-hidden className="space-y-2 blur-sm select-none">
          <div className="h-3 w-3/4 rounded bg-lavender-deep" />
          <div className="h-3 w-1/2 rounded bg-lavender-deep" />
          <div className="h-8 w-1/3 rounded bg-lavender-deep" />
        </div>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/70 text-center">
          <span className="text-xl">🔒</span>
          <p className="max-w-[220px] text-xs font-semibold text-ink-soft">
            Presupuesto y brief completo visibles para creadores registrados
          </p>
        </div>
      </div>

      <Link
        href="/ugc/login?intent=creador"
        className="mt-5 rounded-pill bg-violet px-5 py-2.5 text-center text-sm font-bold text-white transition hover:bg-violet-deep"
      >
        Iniciá sesión para ver el brief
      </Link>
    </div>
  );
}
