"use client";

import { useActionState } from "react";
import { applyToCampaignAction, type ApplyActionState } from "@/lib/actions/applications";

export default function ApplyForm({ campaignId }: { campaignId: string }) {
  const [state, formAction, pending] = useActionState<ApplyActionState, FormData>(
    applyToCampaignAction,
    null
  );

  return (
    <form action={formAction} className="mt-4 flex flex-col gap-2">
      <input type="hidden" name="campaign_id" value={campaignId} />
      <textarea
        name="pitch_message"
        placeholder="Mensaje opcional para la marca (por qué encajás con esta campaña)"
        rows={2}
        className="resize-none rounded-lg border border-black/10 bg-lavender px-4 py-3 text-sm outline-none focus:border-violet"
      />
      {state?.error && <p className="text-sm text-coral">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-pill bg-violet px-6 py-2.5 text-sm font-bold text-white transition hover:bg-violet-deep disabled:opacity-60"
      >
        {pending ? "Enviando..." : "Aplicar"}
      </button>
    </form>
  );
}
