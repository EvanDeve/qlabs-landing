"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { signInAction, signUpAction, type AuthActionState } from "@/lib/actions/auth";

type Role = "creator" | "brand";

const ROLE_META: Record<
  Role,
  { label: string; title: string; desc: string; icon: string; chip: string }
> = {
  brand: {
    label: "Negocio",
    title: "Soy negocio",
    desc: "Publicá campañas y trabajá con creadores verificados",
    icon: "fa-store",
    chip: "bg-lavender-deep text-violet-deep",
  },
  creator: {
    label: "Creador",
    title: "Soy creador",
    desc: "Aplicá a promos de marcas y construí tu perfil",
    icon: "fa-clapperboard",
    chip: "bg-[#FCE1D3] text-[#C2410C]",
  },
};

function PasswordInput({
  name,
  placeholder,
  autoComplete,
  minLength,
  value,
  onChange,
}: {
  name: string;
  placeholder: string;
  autoComplete: string;
  minLength?: number;
  value?: string;
  onChange?: (v: string) => void;
}) {
  const [show, setShow] = useState(false);
  const controlled = value !== undefined;
  return (
    <div className="relative">
      <input
        name={name}
        type={show ? "text" : "password"}
        required
        minLength={minLength}
        placeholder={placeholder}
        autoComplete={autoComplete}
        {...(controlled ? { value, onChange: (e) => onChange?.(e.target.value) } : {})}
        className="w-full rounded-xl border border-line bg-lavender px-4 py-3.5 pr-11 text-sm outline-none transition focus:border-violet focus:bg-white"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        tabIndex={-1}
        aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-soft transition hover:text-ink"
      >
        <i className={show ? "fa-solid fa-eye-slash" : "fa-solid fa-eye"} aria-hidden />
      </button>
    </div>
  );
}

export default function AuthForm({ initialIntent }: { initialIntent?: Role }) {
  const [step, setStep] = useState<"role" | "auth">(initialIntent ? "auth" : "role");
  const [role, setRole] = useState<Role>(initialIntent ?? "creator");
  const [tab, setTab] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [pwdConfirm, setPwdConfirm] = useState("");
  const pwdMismatch = pwdConfirm.length > 0 && pwd !== pwdConfirm;

  const [signInState, signInFormAction, signInPending] = useActionState<AuthActionState, FormData>(
    signInAction,
    null
  );
  const [signUpState, signUpFormAction, signUpPending] = useActionState<AuthActionState, FormData>(
    signUpAction,
    null
  );

  // ---------------- PASO 1 · ROL ----------------
  if (step === "role") {
    return (
      <div className="w-full max-w-lg">
        <h1 className="text-center text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
          ¿Cómo querés entrar?
        </h1>
        <p className="mx-auto mb-8 mt-3 max-w-sm text-center text-ink-soft">
          Elegí cómo vas a usar UGC·CRC. Podés cambiarlo antes de continuar.
        </p>

        <div className="flex flex-col gap-4">
          {(["brand", "creator"] as Role[]).map((r) => {
            const meta = ROLE_META[r];
            return (
              <button
                key={r}
                type="button"
                onClick={() => {
                  setRole(r);
                  setStep("auth");
                }}
                className="group flex items-center gap-4 rounded-card border border-line bg-white p-5 text-left transition hover:-translate-y-0.5 hover:border-violet hover:shadow-[0_18px_40px_-24px_rgba(112,92,246,0.5)]"
              >
                <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-lg ${meta.chip}`}>
                  <i className={`fa-solid ${meta.icon}`} aria-hidden />
                </span>
                <span className="flex-1">
                  <span className="block font-extrabold text-ink">{meta.title}</span>
                  <span className="mt-0.5 block text-sm text-ink-soft">{meta.desc}</span>
                </span>
                <i className="fa-solid fa-arrow-right text-ink-soft transition group-hover:translate-x-1 group-hover:text-violet" aria-hidden />
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ---------------- PASO 2 · LOGIN / REGISTRO ----------------
  const meta = ROLE_META[role];
  return (
    <div className="w-full max-w-md rounded-[22px] border border-line bg-white p-7 shadow-[0_30px_70px_-40px_rgba(11,11,18,0.35)] sm:p-9">
      <div className="mb-3 flex items-center justify-center gap-2 text-lg font-extrabold text-ink">
        <img src="/favicon-logo.png" alt="Q Labs" className="h-7 w-7 rounded-lg object-cover" />
        UGC·CRC
      </div>

      <div className="mx-auto mb-6 flex w-fit items-center gap-2 rounded-pill border border-violet/20 bg-lavender px-3.5 py-1.5 text-sm text-ink-soft">
        Entrando como <b className="text-ink">{meta.label}</b>
        <button
          type="button"
          onClick={() => setStep("role")}
          className="font-semibold text-violet underline"
        >
          Cambiar
        </button>
      </div>

      <div className="mb-6 flex gap-1 rounded-pill bg-lavender p-1">
        <button
          type="button"
          onClick={() => setTab("login")}
          className={`flex-1 rounded-pill py-2.5 text-sm font-bold transition ${
            tab === "login" ? "bg-ink text-white" : "text-ink-soft"
          }`}
        >
          Iniciar sesión
        </button>
        <button
          type="button"
          onClick={() => setTab("signup")}
          className={`flex-1 rounded-pill py-2.5 text-sm font-bold transition ${
            tab === "signup" ? "bg-ink text-white" : "text-ink-soft"
          }`}
        >
          Registrarme
        </button>
      </div>

      {tab === "login" ? (
        <form key="login" action={signInFormAction} className="flex flex-col gap-3">
          <input
            name="email"
            type="email"
            required
            placeholder="Email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-xl border border-line bg-lavender px-4 py-3.5 text-sm outline-none transition focus:border-violet focus:bg-white"
          />
          <PasswordInput
            name="password"
            placeholder="Contraseña"
            autoComplete="current-password"
          />
          {signInState && "error" in signInState && (
            <p className="text-sm text-coral">{signInState.error}</p>
          )}
          <button
            type="submit"
            disabled={signInPending}
            className="mt-1 rounded-xl bg-violet py-3.5 text-sm font-bold text-white shadow-[0_10px_26px_-10px_rgba(112,92,246,0.7)] transition hover:bg-violet-deep disabled:opacity-60"
          >
            {signInPending ? "Entrando..." : "Entrar"}
          </button>
          <Link
            href="/ugc/recuperar"
            className="mt-1 text-center text-sm font-semibold text-ink-soft transition hover:text-violet"
          >
            Olvidé mi contraseña
          </Link>
        </form>
      ) : (
        <form key="signup" action={signUpFormAction} className="flex flex-col gap-3">
          <input type="hidden" name="role" value={role} />
          <input
            name="email"
            type="email"
            required
            placeholder="Email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-xl border border-line bg-lavender px-4 py-3.5 text-sm outline-none transition focus:border-violet focus:bg-white"
          />
          <PasswordInput
            name="password"
            placeholder="Contraseña (mín. 8 caracteres)"
            autoComplete="new-password"
            minLength={8}
            value={pwd}
            onChange={setPwd}
          />
          <PasswordInput
            name="password_confirm"
            placeholder="Confirmar contraseña"
            autoComplete="new-password"
            minLength={8}
            value={pwdConfirm}
            onChange={setPwdConfirm}
          />
          {pwdMismatch && <p className="text-sm text-coral">Las contraseñas no coinciden.</p>}
          {signUpState && "error" in signUpState && (
            <p className="text-sm text-coral">{signUpState.error}</p>
          )}
          {signUpState && "message" in signUpState && (
            <p className="text-sm text-trust">{signUpState.message}</p>
          )}
          <button
            type="submit"
            disabled={signUpPending || pwd !== pwdConfirm}
            className="mt-1 rounded-xl bg-violet py-3.5 text-sm font-bold text-white shadow-[0_10px_26px_-10px_rgba(112,92,246,0.7)] transition hover:bg-violet-deep disabled:opacity-60"
          >
            {signUpPending ? "Creando cuenta..." : "Crear cuenta"}
          </button>
        </form>
      )}

      {/* Esta frase estuvo mucho tiempo como texto plano, nombrando dos
          documentos que no existían. Ahora son links reales: si se vuelven a
          mover de ruta, hay que actualizarlos acá también. */}
      <p className="mt-5 text-center text-xs text-ink-soft">
        Al continuar aceptás los{" "}
        <Link href="/legal/terminos" className="font-bold text-violet hover:underline">
          Términos y condiciones
        </Link>{" "}
        y la{" "}
        <Link href="/legal/privacidad" className="font-bold text-violet hover:underline">
          Política de privacidad
        </Link>{" "}
        de Q Labs.
      </p>
    </div>
  );
}
