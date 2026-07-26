"use client";

import { useActionState } from "react";
import { createCampaignAction, type CampaignActionState } from "@/lib/actions/campaigns";
import { DELIVERABLE_TYPES, FORMAT_LABEL } from "@/lib/ugc/deliverables";
import {
  USAGE_SCOPES,
  USAGE_DURATIONS,
  USAGE_SCOPE_LABEL,
  USAGE_SCOPE_DESC,
  USAGE_DURATION_LABEL,
} from "@/lib/ugc/usage-rights";

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

      {/* Derechos de uso. Deliberadamente sin opción preseleccionada: define qué
          cede el creador, así que conviene que sea una decisión consciente y no
          el default que nadie miró. */}
      <fieldset className="flex flex-col gap-4 rounded-lg border border-black/10 bg-lavender/50 p-4 text-left">
        <legend className="px-1 text-xs font-bold text-ink">Derechos de uso del contenido</legend>

        <div className="flex flex-col gap-2">
          <span className="text-xs font-bold text-ink">¿Dónde puede usarse el contenido?</span>
          {USAGE_SCOPES.map((scope) => (
            <label
              key={scope}
              className="flex cursor-pointer items-start gap-3 rounded-lg border border-black/10 bg-white px-4 py-3 transition hover:border-violet"
            >
              <input
                type="radio"
                name="usage_rights_scope"
                value={scope}
                required
                className="mt-0.5 accent-violet"
              />
              <span>
                <span className="block text-sm font-semibold text-ink">
                  {USAGE_SCOPE_LABEL[scope]}
                </span>
                <span className="mt-0.5 block text-xs text-ink-soft">{USAGE_SCOPE_DESC[scope]}</span>
              </span>
            </label>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-xs font-bold text-ink">
            ¿Por cuánto tiempo? <span className="font-semibold text-ink-soft">(desde que aprobás la entrega)</span>
          </span>
          <div className="grid grid-cols-2 gap-2">
            {USAGE_DURATIONS.map((duration) => (
              <label
                key={duration}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-black/10 bg-white px-4 py-3 transition hover:border-violet"
              >
                <input
                  type="radio"
                  name="usage_rights_duration"
                  value={duration}
                  required
                  className="accent-violet"
                />
                <span className="text-sm font-semibold text-ink">
                  {USAGE_DURATION_LABEL[duration]}
                </span>
              </label>
            ))}
          </div>
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-black/10 bg-white px-4 py-3 transition hover:border-violet">
          <input
            type="checkbox"
            name="usage_rights_editing"
            value="on"
            className="mt-0.5 accent-violet"
          />
          <span>
            <span className="block text-sm font-semibold text-ink">Podés editar el material</span>
            <span className="mt-0.5 block text-xs text-ink-soft">
              Si lo dejás sin marcar, te comprometés a publicar la pieza tal como te la entregan.
            </span>
          </span>
        </label>

        <TextArea
          label="Aclaraciones (opcional)"
          name="usage_rights_notes"
          placeholder="Ej: la pieza no puede usarse en campañas de otra sede."
          rows={2}
        />

        <p className="text-xs text-ink-soft">
          El creador siempre puede publicar la pieza en su propio perfil — es parte de cómo
          funciona el UGC.
        </p>
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
  rows = 4,
}: {
  label: string;
  name: string;
  placeholder?: string;
  required?: boolean;
  rows?: number;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-left">
      <span className="text-xs font-bold text-ink">{label}</span>
      <textarea
        name={name}
        required={required}
        placeholder={placeholder}
        rows={rows}
        className="resize-none rounded-lg border border-black/10 bg-lavender px-4 py-3 text-sm outline-none focus:border-violet"
      />
    </label>
  );
}
