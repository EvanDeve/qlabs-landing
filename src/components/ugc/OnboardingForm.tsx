"use client";

import { useActionState, useState } from "react";
import {
  completeOnboardingAction,
  type OnboardingActionState,
} from "@/lib/actions/onboarding";

type Role = "creator" | "brand";

export default function OnboardingForm({
  lockedRole,
  initialRole,
}: {
  lockedRole: Role | null;
  initialRole: Role;
}) {
  const [role, setRole] = useState<Role>(lockedRole ?? initialRole);
  const [state, formAction, pending] = useActionState<OnboardingActionState, FormData>(
    completeOnboardingAction,
    null
  );

  return (
    <form action={formAction} className="flex w-full max-w-md flex-col gap-4">
      <input type="hidden" name="role" value={role} />

      {!lockedRole && (
        <div className="mb-2 flex gap-2">
          {(["creator", "brand"] as Role[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm font-bold transition ${
                role === r
                  ? "border-violet bg-lavender text-violet-deep"
                  : "border-black/10 text-ink-soft hover:border-black/20"
              }`}
            >
              {r === "creator" ? "Soy creador" : "Soy marca"}
            </button>
          ))}
        </div>
      )}

      {role === "creator" ? (
        <>
          <Field label="Handle" name="handle" placeholder="@vale.creates" required />
          <Field label="Ciudad" name="city" placeholder="San José" />
          <Field
            label="Nichos"
            name="niches"
            placeholder="food, lifestyle (separados por coma)"
          />
          <Field
            label="Seguidores"
            name="followers_count"
            type="number"
            placeholder="12400"
          />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Instagram" name="instagram_handle" placeholder="@vale.creates" />
            <Field label="TikTok" name="tiktok_handle" placeholder="@vale.creates" />
          </div>
          <TextArea label="Bio" name="bio" placeholder="Contá quién sos y qué contenido hacés" />
        </>
      ) : (
        <>
          <Field label="Nombre de la marca" name="brand_name" placeholder="Zonna" required />
          <Field label="Industria" name="industry" placeholder="Restaurante" />
          <Field label="Sitio web" name="website" placeholder="zonna.cr" />
          <TextArea
            label="Descripción"
            name="description"
            placeholder="Gastrobar en Escazú con propuesta de brunch..."
          />
        </>
      )}

      {state && "error" in state && <p className="text-sm text-coral">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-pill bg-violet py-3 text-sm font-bold text-white transition hover:bg-violet-deep disabled:opacity-60"
      >
        {pending ? "Guardando..." : "Terminar registro"}
      </button>
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
}: {
  label: string;
  name: string;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-left">
      <span className="text-xs font-bold text-ink">{label}</span>
      <textarea
        name={name}
        placeholder={placeholder}
        rows={3}
        className="resize-none rounded-lg border border-black/10 bg-lavender px-4 py-3 text-sm outline-none focus:border-violet"
      />
    </label>
  );
}
