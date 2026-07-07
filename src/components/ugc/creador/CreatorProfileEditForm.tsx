"use client";

import { useActionState, useState } from "react";
import {
  updateCreatorProfileDetailsAction,
  type UpdateCreatorProfileDetailsState,
} from "@/lib/actions/creator-profile";
import { SERVICES_CATALOG, ADDONS_CATALOG } from "@/lib/ugc/catalog";

type Skill = { name: string; level: number };
type PastBrand = { category: string; brand_name: string };

export default function CreatorProfileEditForm({
  initialSkills,
  initialServices,
  initialAddons,
  initialPastBrands,
  initialMetrics,
}: {
  initialSkills: Skill[];
  initialServices: string[];
  initialAddons: string[];
  initialPastBrands: PastBrand[];
  initialMetrics: { avg_views: number | null; engagement_rate: number | null; avg_reach: number | null };
}) {
  const [state, formAction, pending] = useActionState<UpdateCreatorProfileDetailsState, FormData>(
    updateCreatorProfileDetailsAction,
    null
  );
  const [skills, setSkills] = useState<Skill[]>(
    initialSkills.length > 0 ? initialSkills : [{ name: "", level: 3 }]
  );
  const [pastBrands, setPastBrands] = useState<PastBrand[]>(
    initialPastBrands.length > 0 ? initialPastBrands : [{ category: "", brand_name: "" }]
  );

  return (
    <form action={formAction} className="flex flex-col gap-10">
      <section>
        <h2 className="mb-3 text-lg font-extrabold text-ink">Alcance & interacción</h2>
        <p className="mb-4 text-sm text-ink-soft">Promedio de tus últimas piezas — actualizalo manualmente.</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm font-semibold text-ink-soft">
            Vistas promedio por pieza
            <input
              type="number"
              name="avg_views"
              min={0}
              defaultValue={initialMetrics.avg_views ?? ""}
              className="rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-violet"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-ink-soft">
            Tasa de interacción (%)
            <input
              type="number"
              step="0.1"
              min={0}
              name="engagement_rate"
              defaultValue={initialMetrics.engagement_rate ?? ""}
              className="rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-violet"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-ink-soft">
            Alcance promedio
            <input
              type="number"
              min={0}
              name="avg_reach"
              defaultValue={initialMetrics.avg_reach ?? ""}
              className="rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-violet"
            />
          </label>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-extrabold text-ink">Habilidades</h2>
        <div className="flex flex-col gap-3">
          {skills.map((skill, i) => (
            <div key={i} className="flex items-center gap-3">
              <input
                type="text"
                name="skill_name"
                placeholder="Ej. Edición de video"
                value={skill.name}
                onChange={(e) =>
                  setSkills((prev) => prev.map((s, idx) => (idx === i ? { ...s, name: e.target.value } : s)))
                }
                className="flex-1 rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-violet"
              />
              <select
                name="skill_level"
                value={skill.level}
                onChange={(e) =>
                  setSkills((prev) =>
                    prev.map((s, idx) => (idx === i ? { ...s, level: Number(e.target.value) } : s))
                  )
                }
                className="rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-violet"
              >
                {[1, 2, 3, 4, 5].map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {lvl} punto{lvl > 1 ? "s" : ""}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setSkills((prev) => prev.filter((_, idx) => idx !== i))}
                className="shrink-0 text-sm font-bold text-coral"
              >
                Quitar
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setSkills((prev) => [...prev, { name: "", level: 3 }])}
            className="self-start rounded-pill border border-line px-4 py-2 text-sm font-bold text-ink-soft transition hover:border-ink"
          >
            + Agregar habilidad
          </button>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-extrabold text-ink">Servicios</h2>
        <div className="flex flex-wrap gap-2">
          {SERVICES_CATALOG.map((service) => (
            <label
              key={service}
              className="flex cursor-pointer items-center gap-2 rounded-pill border border-line px-4 py-2 text-sm font-semibold text-ink-soft has-[:checked]:border-violet has-[:checked]:bg-lavender has-[:checked]:text-violet-deep"
            >
              <input
                type="checkbox"
                name="services"
                value={service}
                defaultChecked={initialServices.includes(service)}
                className="accent-violet"
              />
              {service}
            </label>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-extrabold text-ink">Add-ons</h2>
        <div className="flex flex-wrap gap-2">
          {ADDONS_CATALOG.map((addon) => (
            <label
              key={addon}
              className="flex cursor-pointer items-center gap-2 rounded-pill border border-line px-4 py-2 text-sm font-semibold text-ink-soft has-[:checked]:border-violet has-[:checked]:bg-lavender has-[:checked]:text-violet-deep"
            >
              <input
                type="checkbox"
                name="addons"
                value={addon}
                defaultChecked={initialAddons.includes(addon)}
                className="accent-violet"
              />
              {addon}
            </label>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-extrabold text-ink">Marcas con las que trabajaste</h2>
        <div className="flex flex-col gap-3">
          {pastBrands.map((brand, i) => (
            <div key={i} className="flex items-center gap-3">
              <input
                type="text"
                name="brand_category"
                placeholder="Categoría (ej. Restaurantes)"
                value={brand.category}
                onChange={(e) =>
                  setPastBrands((prev) =>
                    prev.map((b, idx) => (idx === i ? { ...b, category: e.target.value } : b))
                  )
                }
                className="flex-1 rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-violet"
              />
              <input
                type="text"
                name="brand_name"
                placeholder="Marca (ej. Zonna)"
                value={brand.brand_name}
                onChange={(e) =>
                  setPastBrands((prev) =>
                    prev.map((b, idx) => (idx === i ? { ...b, brand_name: e.target.value } : b))
                  )
                }
                className="flex-1 rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-violet"
              />
              <button
                type="button"
                onClick={() => setPastBrands((prev) => prev.filter((_, idx) => idx !== i))}
                className="shrink-0 text-sm font-bold text-coral"
              >
                Quitar
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setPastBrands((prev) => [...prev, { category: "", brand_name: "" }])}
            className="self-start rounded-pill border border-line px-4 py-2 text-sm font-bold text-ink-soft transition hover:border-ink"
          >
            + Agregar marca
          </button>
        </div>
      </section>

      {state?.error && <p className="text-sm text-coral">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-pill bg-violet px-8 py-3 text-sm font-bold text-white transition hover:bg-violet-deep disabled:opacity-60"
      >
        {pending ? "Guardando..." : "Guardar perfil"}
      </button>
    </form>
  );
}
