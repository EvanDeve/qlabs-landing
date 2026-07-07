"use client";

import { useActionState, useRef } from "react";
import { submitDeliveryAction, type SubmitDeliveryState } from "@/lib/actions/deliveries";

export default function DeliverySubmitForm({ applicationId }: { applicationId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<SubmitDeliveryState, FormData>(
    async (_prevState, formData) => {
      const result = await submitDeliveryAction(_prevState, formData);
      if (!result) {
        formRef.current?.reset();
      }
      return result;
    },
    null
  );

  return (
    <form ref={formRef} action={formAction} className="mt-4 flex flex-col gap-3 rounded-card bg-lavender p-4">
      <div className="flex flex-col gap-1 text-sm font-semibold text-ink-soft">
        <label>
          Archivo
          <input
            type="file"
            name="file"
            className="mt-1 block w-full text-sm text-ink-soft file:mr-3 file:rounded-pill file:border-0 file:bg-white file:px-4 file:py-2 file:text-sm file:font-bold file:text-violet-deep"
          />
        </label>
      </div>
      <div className="text-center text-xs font-bold text-ink-soft">o</div>
      <label className="flex flex-col gap-1 text-sm font-semibold text-ink-soft">
        Link (Drive, WeTransfer, etc.)
        <input
          type="url"
          name="external_url"
          placeholder="https://..."
          className="rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-violet"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold text-ink-soft">
        Nota (opcional)
        <input
          type="text"
          name="note"
          placeholder="Reel final, versión con subtítulos"
          className="rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-violet"
        />
      </label>
      <input type="hidden" name="application_id" value={applicationId} />
      {state?.error && <p className="text-sm text-coral">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-pill bg-violet px-6 py-2.5 text-sm font-bold text-white transition hover:bg-violet-deep disabled:opacity-60"
      >
        {pending ? "Entregando..." : "Entregar pieza"}
      </button>
    </form>
  );
}
