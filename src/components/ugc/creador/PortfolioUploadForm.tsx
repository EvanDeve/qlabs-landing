"use client";

import { useActionState, useRef } from "react";
import {
  uploadPortfolioItemAction,
  type UploadPortfolioItemState,
} from "@/lib/actions/portfolio";
import { PORTFOLIO_CATEGORIES, PORTFOLIO_CATEGORY_LABEL } from "@/lib/ugc/portfolio";

export default function PortfolioUploadForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<UploadPortfolioItemState, FormData>(
    async (_prevState, formData) => {
      const result = await uploadPortfolioItemAction(_prevState, formData);
      if (!result) {
        formRef.current?.reset();
      }
      return result;
    },
    null
  );

  return (
    <form ref={formRef} action={formAction} className="rounded-card border border-dashed border-line p-5">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm font-semibold text-ink-soft">
          Archivo
          <input
            type="file"
            name="file"
            accept="image/*,video/*"
            required
            className="text-sm text-ink-soft file:mr-3 file:rounded-pill file:border-0 file:bg-lavender file:px-4 file:py-2 file:text-sm file:font-bold file:text-violet-deep"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold text-ink-soft">
          Categoría
          <select
            name="category"
            defaultValue={PORTFOLIO_CATEGORIES[0]}
            className="rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-violet"
          >
            {PORTFOLIO_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {PORTFOLIO_CATEGORY_LABEL[category]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-1 min-w-[180px] flex-col gap-1 text-sm font-semibold text-ink-soft">
          Descripción (opcional)
          <input
            type="text"
            name="caption"
            placeholder="Reel · Zonna"
            className="rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-violet"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-pill bg-violet px-6 py-2.5 text-sm font-bold text-white transition hover:bg-violet-deep disabled:opacity-60"
        >
          {pending ? "Subiendo..." : "Subir"}
        </button>
      </div>
      {state?.error && <p className="mt-3 text-sm text-coral">{state.error}</p>}
    </form>
  );
}
