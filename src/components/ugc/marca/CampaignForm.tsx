"use client";

import { useActionState } from "react";
import { createCampaignAction, type CampaignActionState } from "@/lib/actions/campaigns";
import { DELIVERABLE_TYPES, FORMAT_LABEL } from "@/lib/ugc/deliverables";

export default function CampaignForm() {
  const [state, formAction, pending] = useActionState<CampaignActionState, FormData>(
    createCampaignAction,
    null
  );

  return (
    <form action={formAction} className="flex w-full max-w-xl flex-col gap-4">
      <Field label="Título de la campaña" name="title" placeholder="Reel de brunch de domingo" required />
      <TextArea
        label="Brief"
        name="brief"
        placeholder="Contá qué querés que el creador muestre: mood, ángulo, momentos clave."
        required
      />

      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Presupuesto (₡)"
          name="budget_amount"
          type="number"
          placeholder="150000"
          required
        />
        <Field
          label="Deadline (días)"
          name="deadline_days"
          type="number"
          placeholder="15"
        />
      </div>

      <Field
        label="Audiencia objetivo"
        name="target_audience"
        placeholder="Food & lifestyle, GAM, 5K+ seguidores"
      />

      <Field
        label="Compensación adicional (opcional)"
        name="compensation_details"
        placeholder="Ej: Cena para 2 personas incluida"
      />

      <fieldset className="flex flex-col gap-2 text-left">
        <legend className="mb-1 text-xs font-bold text-ink">Entregables</legend>
        <div className="grid grid-cols-2 gap-3">
          {DELIVERABLE_TYPES.map((type) => (
            <label
              key={type}
              className="flex items-center justify-between gap-2 rounded-lg border border-black/10 bg-lavender px-4 py-3"
            >
              <span className="text-sm font-semibold text-ink">{FORMAT_LABEL[type]}</span>
              <input
                name={`qty_${type}`}
                type="number"
                min={0}
                defaultValue={0}
                className="w-14 rounded-md border border-black/10 bg-white px-2 py-1 text-center text-sm outline-none focus:border-violet"
              />
            </label>
          ))}
        </div>
      </fieldset>

      {state && "error" in state && <p className="text-sm text-coral">{state.error}</p>}

      <div className="mt-2 flex gap-3">
        <button
          type="submit"
          name="intent"
          value="draft"
          disabled={pending}
          className="flex-1 rounded-pill border border-black/10 py-3 text-sm font-bold text-ink transition hover:border-ink disabled:opacity-60"
        >
          Guardar borrador
        </button>
        <button
          type="submit"
          name="intent"
          value="publish"
          disabled={pending}
          className="flex-1 rounded-pill bg-violet py-3 text-sm font-bold text-white transition hover:bg-violet-deep disabled:opacity-60"
        >
          {pending ? "Publicando..." : "Publicar campaña"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  placeholder,
  type = "text",
  required,
}: {
  label: string;
  name: string;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-left">
      <span className="text-xs font-bold text-ink">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        className="rounded-lg border border-black/10 bg-lavender px-4 py-3 text-sm outline-none focus:border-violet"
      />
    </label>
  );
}

function TextArea({
  label,
  name,
  placeholder,
  required,
}: {
  label: string;
  name: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-left">
      <span className="text-xs font-bold text-ink">{label}</span>
      <textarea
        name={name}
        required={required}
        placeholder={placeholder}
        rows={4}
        className="resize-none rounded-lg border border-black/10 bg-lavender px-4 py-3 text-sm outline-none focus:border-violet"
      />
    </label>
  );
}
