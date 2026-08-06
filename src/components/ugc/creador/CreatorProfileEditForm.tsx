"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  updateCreatorProfileDetailsAction,
  type UpdateCreatorProfileDetailsState,
} from "@/lib/actions/creator-profile";
import { LANGUAGE_OPTIONS, languageLabel } from "@/lib/ugc/languages";
import { displayHandle, handleSlug } from "@/lib/ugc/handles";
import ImageCropModal from "@/components/ugc/ImageCropModal";
import { useToast } from "@/components/ugc/Toaster";
import styles from "@/app/ugc/(dashboard)/admin/qos.module.css";
// Los botones de esta pantalla eran los únicos del panel hechos con clases
// sueltas de Tailwind (`rounded-pill`): convivían dos lenguajes de botón en el
// mismo producto. Van al mismo sistema `.btn` que usa el resto (radio 11px).

type Skill = { name: string; level: number };
type PastBrand = { category: string; brand_name: string };

export type CreatorProfileInitial = {
  handle: string;
  verified: boolean;
  bio: string;
  city: string;
  followers_count: number;
  niches: string[];
  languages: string[];
  instagram_handle: string;
  tiktok_handle: string;
  avatar_url: string | null;
};

export default function CreatorProfileEditForm({
  initialProfile,
  initialSkills,
  initialPastBrands,
}: {
  initialProfile: CreatorProfileInitial;
  initialSkills: Skill[];
  initialPastBrands: PastBrand[];
}) {
  const [state, formAction, pending] = useActionState<UpdateCreatorProfileDetailsState, FormData>(
    updateCreatorProfileDetailsAction,
    null
  );

  const toast = useToast();

  // Mismo motivo que en el perfil de la marca: guardar no daba ninguna señal.
  useEffect(() => {
    if (state && "ok" in state) toast("Perfil guardado.");
  }, [state, toast]);

  // Campos que alimentan el preview en vivo
  const [avatarPreview, setAvatarPreview] = useState<string | null>(initialProfile.avatar_url);
  const [bio, setBio] = useState(initialProfile.bio);
  const [city, setCity] = useState(initialProfile.city);
  const [followers, setFollowers] = useState(String(initialProfile.followers_count || ""));
  const [instagram, setInstagram] = useState(initialProfile.instagram_handle);
  const [tiktok, setTiktok] = useState(initialProfile.tiktok_handle);
  const [nichesStr, setNichesStr] = useState(initialProfile.niches.join(", "));
  const [languages, setLanguages] = useState<string[]>(
    initialProfile.languages.length > 0 ? initialProfile.languages : ["es"]
  );
  const fileRef = useRef<HTMLInputElement>(null);
  // Archivo recién elegido, a la espera de que se ajuste en el modal.
  const [cropping, setCropping] = useState<File | null>(null);

  const toggleLanguage = (code: string) =>
    setLanguages((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );

  const [skills, setSkills] = useState<Skill[]>(
    initialSkills.length > 0 ? initialSkills : [{ name: "", level: 3 }]
  );
  const [pastBrands, setPastBrands] = useState<PastBrand[]>(
    initialPastBrands.length > 0 ? initialPastBrands : [{ category: "", brand_name: "" }]
  );

  const niches = nichesStr.split(",").map((n) => n.trim()).filter(Boolean);
  const initial = (handleSlug(initialProfile.handle).slice(0, 1) || "@").toUpperCase();

  const applyCrop = (cropped: File) => {
    // El <input type="file"> se envía con el form, así que hay que sustituir su
    // FileList por el recorte — no alcanza con guardarlo en el estado.
    const dt = new DataTransfer();
    dt.items.add(cropped);
    if (fileRef.current) fileRef.current.files = dt.files;
    setAvatarPreview(URL.createObjectURL(cropped));
    setCropping(null);
  };

  const cancelCrop = () => {
    // Se limpia el input: si no, quedaría el archivo original sin recortar.
    if (fileRef.current) fileRef.current.value = "";
    setCropping(null);
  };

  return (
    <form action={formAction} className="grid gap-8 lg:grid-cols-[1fr_360px]">
      {cropping && (
        <ImageCropModal file={cropping} onCancel={cancelCrop} onConfirm={applyCrop} />
      )}
      {/* ---------------- IZQUIERDA: campos ----------------
          min-w-0: los items de grid traen min-width:auto, así que la pista se
          dimensiona al min-content del contenido (un <input> aporta ~174px por
          su ancho intrínseco aunque tenga width:100%) y la página entera
          desborda en horizontal en pantallas angostas. */}
      <div className="flex min-w-0 flex-col gap-6">
        {/* Identidad */}
        <section className="rounded-card border border-line bg-white p-6">
          <h2 className="mb-4 text-lg font-extrabold text-ink">Identidad</h2>

          <div className="mb-5 flex items-center gap-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-periwinkle to-violet-deep text-2xl font-extrabold text-white">
              {avatarPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarPreview} alt="Foto de perfil" className="h-full w-full object-cover" />
              ) : (
                initial
              )}
            </div>
            <div>
              <input
                ref={fileRef}
                type="file"
                name="avatar"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  // No se sube lo elegido tal cual: primero se ajusta el
                  // encuadre, y lo que viaja al servidor es el recorte.
                  if (file) setCropping(file);
                }}
              />
              {/* `btnSoft` y no `btnGhost` para que sea el mismo botón que
                  "Cambiar logo" en el perfil de la marca: es la misma acción en
                  la pantalla gemela. */}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className={`${styles.btn} ${styles.btnSoft}`}
              >
                {avatarPreview ? "Cambiar foto" : "Subir foto"}
              </button>
              <p className={styles.fieldHint}>JPG o PNG, hasta 5 MB.</p>
            </div>
          </div>

          <div className="mb-4">
            <span className="text-xs font-bold text-ink">Handle</span>
            <div className="mt-1 flex items-center gap-2 rounded-lg border border-line bg-lavender/60 px-3 py-2 text-sm text-ink-soft">
              <span className="font-semibold text-ink">{displayHandle(initialProfile.handle)}</span>
              <span className="text-xs">· tu URL: /creadores/{handleSlug(initialProfile.handle)}</span>
            </div>
          </div>

          <Field label="Bio" hint="Contá quién sos y qué contenido hacés.">
            <textarea
              name="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              placeholder="Content creator de food & lifestyle en el GAM…"
              className="w-full resize-none rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-violet"
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Ciudad">
              <input
                name="city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="San José"
                className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-violet"
              />
            </Field>
            <Field label="Seguidores">
              <input
                type="number"
                name="followers_count"
                min={0}
                value={followers}
                onChange={(e) => setFollowers(e.target.value)}
                placeholder="12400"
                className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-violet"
              />
            </Field>
            <Field label="Instagram">
              <input
                name="instagram_handle"
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                placeholder="@vale.creates"
                className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-violet"
              />
            </Field>
            <Field label="TikTok">
              <input
                name="tiktok_handle"
                value={tiktok}
                onChange={(e) => setTiktok(e.target.value)}
                placeholder="@vale.creates"
                className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-violet"
              />
            </Field>
          </div>

          <div className="mt-4">
            <Field label="Nichos" hint="Separados por coma — ej. food, lifestyle, reseñas.">
              <input
                name="niches"
                value={nichesStr}
                onChange={(e) => setNichesStr(e.target.value)}
                placeholder="food, lifestyle, reseñas"
                className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-violet"
              />
            </Field>
          </div>

          <div className="mt-4 flex flex-col gap-1.5">
            <span className="text-xs font-bold text-ink">Idiomas</span>
            {/* Mismo componente que los filtros del feed de promos y de
                recompensas, en vez de un pill propio de esta pantalla. */}
            <div className="flex flex-wrap gap-2">
              {LANGUAGE_OPTIONS.map((lang) => {
                const on = languages.includes(lang.code);
                return (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => toggleLanguage(lang.code)}
                    aria-pressed={on}
                    className={`${styles.subtab} ${on ? styles.subtabOn : ""}`}
                  >
                    {lang.label}
                  </button>
                );
              })}
            </div>
            {languages.map((code) => (
              <input key={code} type="hidden" name="languages" value={code} />
            ))}
            <span className="text-xs text-ink-soft">
              Marcá inglés solo si podés grabar contenido en ese idioma — los hoteles lo buscan.
            </span>
          </div>
        </section>

        {/* Habilidades */}
        <section className="rounded-card border border-line bg-white p-6">
          <h2 className="mb-4 text-lg font-extrabold text-ink">Habilidades</h2>
          <div className="flex flex-col gap-3">
            {skills.map((skill, i) => (
              <div key={i} className="flex items-center gap-3">
                {/* min-w-0: sin esto el min-width:auto del item flex impide que el
                    input encoja por debajo de su ancho intrínseco y la fila
                    desborda en pantallas angostas. */}
                <input
                  type="text"
                  name="skill_name"
                  placeholder="Ej. Edición de video"
                  value={skill.name}
                  onChange={(e) =>
                    setSkills((prev) => prev.map((s, idx) => (idx === i ? { ...s, name: e.target.value } : s)))
                  }
                  className="min-w-0 flex-1 rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-violet"
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
                  className={`shrink-0 ${styles.btn} ${styles.btnGhostDanger} ${styles.btnSm}`}
                >
                  Quitar
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setSkills((prev) => [...prev, { name: "", level: 3 }])}
              className={`self-start ${styles.btn} ${styles.btnGhost}`}
            >
              + Agregar habilidad
            </button>
          </div>
        </section>

        {/* Marcas */}
        <section className="rounded-card border border-line bg-white p-6">
          <h2 className="mb-4 text-lg font-extrabold text-ink">Marcas con las que trabajaste</h2>
          <div className="flex flex-col gap-3">
            {pastBrands.map((brand, i) => (
              // Dos campos de texto lado a lado no entran de forma usable en un
              // teléfono, así que en pantallas angostas la fila se apila y se
              // encuadra para que se vea qué campos son de la misma marca.
              <div
                key={i}
                className="flex flex-col gap-3 rounded-lg border border-line p-3 sm:flex-row sm:items-center sm:border-0 sm:p-0"
              >
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
                  className="min-w-0 flex-1 rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-violet"
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
                  className="min-w-0 flex-1 rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-violet"
                />
                <button
                  type="button"
                  onClick={() => setPastBrands((prev) => prev.filter((_, idx) => idx !== i))}
                  className={`shrink-0 self-end sm:self-auto ${styles.btn} ${styles.btnGhostDanger} ${styles.btnSm}`}
                >
                  Quitar
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setPastBrands((prev) => [...prev, { category: "", brand_name: "" }])}
              className={`self-start ${styles.btn} ${styles.btnGhost}`}
            >
              + Agregar marca
            </button>
          </div>
        </section>

        {state && "error" in state && <div className={styles.formError}>{state.error}</div>}

        <button
          type="submit"
          disabled={pending}
          className={`self-start disabled:opacity-60 ${styles.btn} ${styles.btnPrimary}`}
        >
          {pending ? "Guardando..." : "Guardar perfil"}
        </button>
      </div>

      {/* ---------------- DERECHA: preview en vivo ---------------- */}
      <aside className="lg:sticky lg:top-6 h-fit min-w-0">
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-soft">
          Vista previa — así te ve la marca
        </p>
        <div className="overflow-hidden rounded-card border border-line bg-white">
          <div className="h-16 bg-gradient-to-br from-violet via-periwinkle to-violet-deep" />
          <div className="px-5 pb-5">
            <div className="-mt-8 flex h-16 w-16 items-center justify-center overflow-hidden rounded-full text-xl font-extrabold text-white ring-4 ring-white">
              {avatarPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarPreview} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-periwinkle to-violet-deep">
                  {initial}
                </span>
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-extrabold text-ink">{displayHandle(initialProfile.handle)}</h3>
              {initialProfile.verified && (
                <span className="inline-flex items-center gap-1 rounded-pill bg-trust-bg px-2.5 py-0.5 text-[11px] font-bold text-trust">
                  <i className="fa-solid fa-circle-check" aria-hidden /> Verificado
                </span>
              )}
            </div>

            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-ink-soft">
              {city && (
                <span>
                  <i className="fa-solid fa-location-dot" aria-hidden /> {city}
                </span>
              )}
              <span>
                <i className="fa-solid fa-users" aria-hidden />{" "}
                {(Number(followers) || 0).toLocaleString("es-CR")} seguidores
              </span>
            </div>

            {bio && <p className="mt-3 text-xs leading-relaxed text-ink-soft">{bio}</p>}

            {(niches.length > 0 || languages.length > 0) && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {niches.map((n) => (
                  <span
                    key={n}
                    className="rounded-pill bg-lavender px-2.5 py-0.5 text-[11px] font-semibold text-violet-deep"
                  >
                    {n}
                  </span>
                ))}
                {languages.map((code) => (
                  <span
                    key={code}
                    className="rounded-pill bg-trust-bg px-2.5 py-0.5 text-[11px] font-semibold text-trust"
                  >
                    {languageLabel(code)}
                  </span>
                ))}
              </div>
            )}

            {(instagram || tiktok) && (
              <div className="mt-4 flex flex-wrap gap-2">
                {instagram && (
                  <span className="inline-flex items-center gap-1.5 rounded-pill border border-line px-3 py-1 text-xs font-bold text-ink">
                    <i className="fa-brands fa-instagram" aria-hidden /> {instagram}
                  </span>
                )}
                {tiktok && (
                  <span className="inline-flex items-center gap-1.5 rounded-pill border border-line px-3 py-1 text-xs font-bold text-ink">
                    <i className="fa-brands fa-tiktok" aria-hidden /> {tiktok}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <a
          href={`/ugc/creadores/${handleSlug(initialProfile.handle)}`}
          target="_blank"
          rel="noopener noreferrer"
          className={`mt-3 w-full justify-center ${styles.btn} ${styles.btnGhost}`}
        >
          Ver / compartir mi perfil completo →
        </a>
      </aside>
    </form>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="mb-4 flex flex-col gap-1.5 last:mb-0">
      <span className="text-xs font-bold text-ink">{label}</span>
      {children}
      {hint && <span className="text-xs text-ink-soft">{hint}</span>}
    </label>
  );
}
