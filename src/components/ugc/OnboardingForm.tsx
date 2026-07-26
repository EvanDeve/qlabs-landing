"use client";

import { startTransition, useActionState, useState } from "react";
import {
  completeOnboardingAction,
  type OnboardingActionState,
} from "@/lib/actions/onboarding";

type Role = "creator" | "brand";

const CREATOR_STEPS = ["Tu @", "Redes", "Sobre vos", "Alcance"] as const;

const inputCls =
  "w-full rounded-xl border border-line bg-lavender px-4 py-3.5 text-sm text-ink outline-none transition focus:border-violet focus:bg-white";

export default function OnboardingForm({
  lockedRole,
  initialRole,
}: {
  lockedRole: Role | null;
  initialRole: Role;
}) {
  const [role, setRole] = useState<Role | null>(lockedRole);

  if (role === null) {
    return <RolePicker initial={initialRole} onPick={setRole} />;
  }
  if (role === "brand") {
    return <BrandForm />;
  }
  return <CreatorWizard />;
}

/* ---------------- Selector de rol (solo si no viene con rol, ej. OAuth) ---------------- */
function RolePicker({ initial, onPick }: { initial: Role; onPick: (r: Role) => void }) {
  const roles: { r: Role; title: string; desc: string; icon: string; chip: string }[] = [
    {
      r: "creator",
      title: "Soy creador",
      desc: "Aplicá a promos de marcas y construí tu perfil",
      icon: "fa-clapperboard",
      chip: "bg-[#FCE1D3] text-[#C2410C]",
    },
    {
      r: "brand",
      title: "Soy negocio",
      desc: "Publicá campañas y trabajá con creadores",
      icon: "fa-store",
      chip: "bg-lavender-deep text-violet-deep",
    },
  ];
  const ordered = initial === "brand" ? [...roles].reverse() : roles;

  return (
    <div className="w-full max-w-lg">
      <h1 className="text-center text-3xl font-extrabold tracking-tight text-ink">Completá tu perfil</h1>
      <p className="mx-auto mb-8 mt-3 max-w-sm text-center text-ink-soft">Primero, ¿cómo vas a usar UGC·CRC?</p>
      <div className="flex flex-col gap-4">
        {ordered.map((o) => (
          <button
            key={o.r}
            type="button"
            onClick={() => onPick(o.r)}
            className="group flex items-center gap-4 rounded-card border border-line bg-white p-5 text-left transition hover:-translate-y-0.5 hover:border-violet hover:shadow-[0_18px_40px_-24px_rgba(112,92,246,0.5)]"
          >
            <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-lg ${o.chip}`}>
              <i className={`fa-solid ${o.icon}`} aria-hidden />
            </span>
            <span className="flex-1">
              <span className="block font-extrabold text-ink">{o.title}</span>
              <span className="mt-0.5 block text-sm text-ink-soft">{o.desc}</span>
            </span>
            <i className="fa-solid fa-arrow-right text-ink-soft transition group-hover:translate-x-1 group-hover:text-violet" aria-hidden />
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Wizard de creador ---------------- */
function CreatorWizard() {
  const [state, formAction, pending] = useActionState<OnboardingActionState, FormData>(
    completeOnboardingAction,
    null
  );
  const [step, setStep] = useState(0);
  const [handle, setHandle] = useState("");
  const [instagram, setInstagram] = useState("");
  const [tiktok, setTiktok] = useState("");
  const [city, setCity] = useState("");
  const [bio, setBio] = useState("");
  const [nichesStr, setNichesStr] = useState("");
  const [followers, setFollowers] = useState("");

  const niches = nichesStr.split(",").map((n) => n.trim()).filter(Boolean);
  const last = CREATOR_STEPS.length - 1;
  const canContinue = handle.trim().length > 0;

  // Envío 100% manual: se construye el FormData y se dispara la acción solo
  // desde el botón final. El <form> NO tiene `action`, así que ningún submit
  // implícito (Enter, autocompletado del navegador, etc.) puede enviarlo antes.
  const submit = () => {
    if (!canContinue || pending) return;
    const fd = new FormData();
    fd.set("role", "creator");
    fd.set("handle", handle);
    fd.set("instagram_handle", instagram);
    fd.set("tiktok_handle", tiktok);
    fd.set("city", city);
    fd.set("bio", bio);
    fd.set("niches", nichesStr);
    fd.set("followers_count", followers);
    // useActionState exige que el dispatch manual vaya dentro de una transition
    startTransition(() => formAction(fd));
  };

  return (
    <div className="grid w-full max-w-4xl gap-6 lg:grid-cols-[1fr_320px]">
      <form
        onSubmit={(e) => e.preventDefault()}
        onKeyDown={(e) => {
          // Enter = "siguiente" en los pasos intermedios y "terminar" en el
          // último (en textarea se respeta el salto de línea). Nunca envía solo.
          if (e.key !== "Enter" || e.target instanceof HTMLTextAreaElement) return;
          e.preventDefault();
          if (step < last) {
            if (canContinue) setStep((s) => s + 1);
          } else {
            submit();
          }
        }}
        // min-w-0: los items de grid traen min-width:auto y la pista se
        // dimensiona al min-content (un <input> aporta su ancho intrínseco
        // aunque tenga width:100%), lo que desborda en pantallas angostas.
        className="min-w-0 rounded-[22px] border border-line bg-white p-7 shadow-[0_30px_70px_-40px_rgba(11,11,18,0.35)] sm:p-9"
      >
        {/* Progreso */}
        <div className="mb-2 flex items-center gap-1.5">
          {CREATOR_STEPS.map((s, i) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                i <= step ? "bg-violet" : "bg-lavender-deep"
              }`}
            />
          ))}
        </div>
        <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">
          Paso {step + 1} de {CREATOR_STEPS.length}
        </p>

        {/* Paso (animado por key) */}
        <div key={step} className="onb-step-in mt-4 min-h-[210px]">
          {step === 0 && (
            <>
              <h2 className="text-2xl font-extrabold tracking-tight text-ink">Elegí tu @</h2>
              <p className="mt-1.5 text-sm text-ink-soft">
                Es tu identificador y tu URL pública. Lo demás lo podés completar después.
              </p>
              <input
                autoFocus
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder="@tunombre"
                className={`mt-5 ${inputCls}`}
              />
            </>
          )}
          {step === 1 && (
            <>
              <h2 className="text-2xl font-extrabold tracking-tight text-ink">Tus redes</h2>
              <p className="mt-1.5 text-sm text-ink-soft">
                Opcional — sumá tus perfiles para que las marcas te encuentren.
              </p>
              <div className="mt-5 flex flex-col gap-3">
                <div className="relative">
                  <i className="fa-brands fa-instagram absolute left-4 top-1/2 -translate-y-1/2 text-ink-soft" aria-hidden />
                  <input
                    value={instagram}
                    onChange={(e) => setInstagram(e.target.value)}
                    placeholder="Instagram (@usuario)"
                    className={`${inputCls} pl-11`}
                  />
                </div>
                <div className="relative">
                  <i className="fa-brands fa-tiktok absolute left-4 top-1/2 -translate-y-1/2 text-ink-soft" aria-hidden />
                  <input
                    value={tiktok}
                    onChange={(e) => setTiktok(e.target.value)}
                    placeholder="TikTok (@usuario)"
                    className={`${inputCls} pl-11`}
                  />
                </div>
              </div>
            </>
          )}
          {step === 2 && (
            <>
              <h2 className="text-2xl font-extrabold tracking-tight text-ink">Sobre vos</h2>
              <p className="mt-1.5 text-sm text-ink-soft">Opcional — de dónde sos y una bio corta.</p>
              <div className="mt-5 flex flex-col gap-3">
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Ciudad (ej. San José)"
                  className={inputCls}
                />
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={3}
                  placeholder="Contá quién sos y qué contenido hacés…"
                  className={`${inputCls} resize-none`}
                />
              </div>
            </>
          )}
          {step === 3 && (
            <>
              <h2 className="text-2xl font-extrabold tracking-tight text-ink">Tu alcance</h2>
              <p className="mt-1.5 text-sm text-ink-soft">Opcional — tus nichos y cuántos te siguen.</p>
              <div className="mt-5 flex flex-col gap-3">
                <input
                  value={nichesStr}
                  onChange={(e) => setNichesStr(e.target.value)}
                  placeholder="Nichos separados por coma (food, lifestyle…)"
                  className={inputCls}
                />
                <input
                  type="number"
                  min={0}
                  value={followers}
                  onChange={(e) => setFollowers(e.target.value)}
                  placeholder="Seguidores (ej. 12400)"
                  className={inputCls}
                />
              </div>
            </>
          )}
        </div>

        {state?.error && <p className="mt-3 text-sm text-coral">{state.error}</p>}

        {/* Navegación */}
        <div className="mt-6 flex items-center justify-between gap-3">
          {step > 0 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="rounded-pill px-4 py-3 text-sm font-bold text-ink-soft transition hover:text-ink"
            >
              ← Atrás
            </button>
          ) : (
            <span />
          )}

          {step < last ? (
            <button
              type="button"
              disabled={step === 0 && !canContinue}
              onClick={() => setStep((s) => s + 1)}
              className="rounded-xl bg-violet px-7 py-3 text-sm font-bold text-white shadow-[0_10px_26px_-10px_rgba(112,92,246,0.7)] transition hover:bg-violet-deep disabled:opacity-50"
            >
              {step === 0 ? "Continuar" : "Siguiente"}
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={pending || !canContinue}
              className="rounded-xl bg-violet px-7 py-3 text-sm font-bold text-white shadow-[0_10px_26px_-10px_rgba(112,92,246,0.7)] transition hover:bg-violet-deep disabled:opacity-50"
            >
              {pending ? "Creando tu perfil…" : "Entrar a mi panel"}
            </button>
          )}
        </div>

        {step > 0 && step < last && (
          <button
            type="button"
            onClick={() => setStep(last)}
            className="mt-4 block w-full text-center text-xs font-semibold text-ink-soft transition hover:text-ink"
          >
            Saltar al final — lo completo después
          </button>
        )}
      </form>

      {/* Preview en vivo */}
      <aside className="order-first lg:order-last lg:sticky lg:top-6 h-fit min-w-0">
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-soft">Tu perfil</p>
        <ProfilePreview
          handle={handle}
          city={city}
          followers={followers}
          niches={niches}
          instagram={instagram}
          tiktok={tiktok}
          bio={bio}
        />
      </aside>
    </div>
  );
}

function ProfilePreview({
  handle,
  city,
  followers,
  niches,
  instagram,
  tiktok,
  bio,
}: {
  handle: string;
  city: string;
  followers: string;
  niches: string[];
  instagram: string;
  tiktok: string;
  bio: string;
}) {
  const cleanHandle = handle.trim();
  const initial = (cleanHandle.replace(/^@/, "").slice(0, 1) || "@").toUpperCase();
  const shownHandle = cleanHandle
    ? cleanHandle.startsWith("@")
      ? cleanHandle
      : `@${cleanHandle}`
    : "@tu-handle";

  const empty =
    !cleanHandle && !city && !bio && niches.length === 0 && !instagram && !tiktok;

  return (
    <div className="overflow-hidden rounded-card border border-line bg-white">
      <div className="h-16 bg-gradient-to-br from-violet via-periwinkle to-violet-deep" />
      <div className="px-5 pb-5">
        <div className="-mt-8 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-periwinkle to-violet-deep text-xl font-extrabold text-white ring-4 ring-white">
          {initial}
        </div>
        <h3 className={`mt-3 text-lg font-extrabold ${cleanHandle ? "text-ink" : "text-ink-soft/50"}`}>
          {shownHandle}
        </h3>
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-ink-soft">
          {city && (
            <span>
              <i className="fa-solid fa-location-dot" aria-hidden /> {city}
            </span>
          )}
          {Number(followers) > 0 && (
            <span>
              <i className="fa-solid fa-users" aria-hidden /> {Number(followers).toLocaleString("es-CR")} seguidores
            </span>
          )}
        </div>
        {bio && <p className="mt-3 text-xs leading-relaxed text-ink-soft">{bio}</p>}
        {niches.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {niches.map((n) => (
              <span key={n} className="rounded-pill bg-lavender px-2.5 py-0.5 text-[11px] font-semibold text-violet-deep">
                {n}
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
        {empty && (
          <p className="mt-3 text-xs text-ink-soft/60">Tu perfil se va llenando mientras completás los pasos ✨</p>
        )}
      </div>
    </div>
  );
}

/* ---------------- Registro de marca (una sola pantalla) ---------------- */
function BrandForm() {
  const [state, formAction, pending] = useActionState<OnboardingActionState, FormData>(
    completeOnboardingAction,
    null
  );

  return (
    <form
      action={formAction}
      className="w-full max-w-md rounded-[22px] border border-line bg-white p-7 shadow-[0_30px_70px_-40px_rgba(11,11,18,0.35)] sm:p-9"
    >
      <input type="hidden" name="role" value="brand" />
      <h2 className="text-2xl font-extrabold tracking-tight text-ink">Datos de tu negocio</h2>
      <p className="mt-1.5 text-sm text-ink-soft">Con esto las campañas que publiques se ven profesionales.</p>

      <div className="mt-6 flex flex-col gap-3">
        <input name="brand_name" required placeholder="Nombre del negocio *" className={inputCls} />
        <input name="industry" placeholder="Industria (ej. Restaurante)" className={inputCls} />
        <input name="website" placeholder="Sitio web (opcional)" className={inputCls} />
        <textarea
          name="description"
          rows={3}
          placeholder="Contanos qué hace tu negocio…"
          className={`${inputCls} resize-none`}
        />
      </div>

      {state && "error" in state && <p className="mt-3 text-sm text-coral">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="mt-6 w-full rounded-xl bg-violet py-3.5 text-sm font-bold text-white shadow-[0_10px_26px_-10px_rgba(112,92,246,0.7)] transition hover:bg-violet-deep disabled:opacity-60"
      >
        {pending ? "Creando tu perfil…" : "Entrar a mi panel"}
      </button>
    </form>
  );
}
