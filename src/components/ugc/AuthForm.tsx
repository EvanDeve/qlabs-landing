"use client";

import { useActionState, useState } from "react";
import {
  signInAction,
  signUpAction,
  signInWithGoogleAction,
  type AuthActionState,
} from "@/lib/actions/auth";

type Role = "creator" | "brand";

const ROLE_LABEL: Record<Role, string> = {
  creator: "Soy creador",
  brand: "Soy marca",
};

export default function AuthForm({ initialIntent }: { initialIntent?: Role }) {
  const [tab, setTab] = useState<"login" | "signup">("login");
  const [role, setRole] = useState<Role>(initialIntent ?? "creator");

  const [signInState, signInFormAction, signInPending] = useActionState<
    AuthActionState,
    FormData
  >(signInAction, null);
  const [signUpState, signUpFormAction, signUpPending] = useActionState<
    AuthActionState,
    FormData
  >(signUpAction, null);

  const googleAction = signInWithGoogleAction.bind(null, role);

  return (
    <div className="w-full max-w-sm">
      <div className="mb-6 flex gap-1 rounded-pill bg-lavender p-1">
        <button
          type="button"
          onClick={() => setTab("login")}
          className={`flex-1 rounded-pill py-2 text-sm font-bold transition ${
            tab === "login" ? "bg-ink text-white" : "text-ink-soft"
          }`}
        >
          Iniciar sesión
        </button>
        <button
          type="button"
          onClick={() => setTab("signup")}
          className={`flex-1 rounded-pill py-2 text-sm font-bold transition ${
            tab === "signup" ? "bg-ink text-white" : "text-ink-soft"
          }`}
        >
          Registrarme
        </button>
      </div>

      {tab === "signup" && (
        <div className="mb-5 flex gap-2">
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
              {ROLE_LABEL[r]}
            </button>
          ))}
        </div>
      )}

      <form action={googleAction} className="mb-4">
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-2 rounded-pill border border-black/10 py-3 text-sm font-bold text-ink transition hover:border-ink"
        >
          <i className="fa-brands fa-google" />
          Continuar con Google
        </button>
      </form>

      <div className="mb-4 flex items-center gap-3 text-xs text-ink-soft">
        <div className="h-px flex-1 bg-black/10" />o<div className="h-px flex-1 bg-black/10" />
      </div>

      {tab === "login" ? (
        <form action={signInFormAction} className="flex flex-col gap-3">
          <input
            name="email"
            type="email"
            required
            placeholder="Email"
            className="rounded-lg border border-black/10 bg-lavender px-4 py-3 text-sm outline-none focus:border-violet"
          />
          <input
            name="password"
            type="password"
            required
            placeholder="Contraseña"
            className="rounded-lg border border-black/10 bg-lavender px-4 py-3 text-sm outline-none focus:border-violet"
          />
          {signInState && "error" in signInState && (
            <p className="text-sm text-coral">{signInState.error}</p>
          )}
          <button
            type="submit"
            disabled={signInPending}
            className="rounded-pill bg-violet py-3 text-sm font-bold text-white transition hover:bg-violet-deep disabled:opacity-60"
          >
            {signInPending ? "Entrando..." : "Entrar"}
          </button>
        </form>
      ) : (
        <form action={signUpFormAction} className="flex flex-col gap-3">
          <input type="hidden" name="role" value={role} />
          <input
            name="email"
            type="email"
            required
            placeholder="Email"
            className="rounded-lg border border-black/10 bg-lavender px-4 py-3 text-sm outline-none focus:border-violet"
          />
          <input
            name="password"
            type="password"
            required
            minLength={8}
            placeholder="Contraseña (mín. 8 caracteres)"
            className="rounded-lg border border-black/10 bg-lavender px-4 py-3 text-sm outline-none focus:border-violet"
          />
          {signUpState && "error" in signUpState && (
            <p className="text-sm text-coral">{signUpState.error}</p>
          )}
          {signUpState && "message" in signUpState && (
            <p className="text-sm text-trust">{signUpState.message}</p>
          )}
          <button
            type="submit"
            disabled={signUpPending}
            className="rounded-pill bg-violet py-3 text-sm font-bold text-white transition hover:bg-violet-deep disabled:opacity-60"
          >
            {signUpPending ? "Creando cuenta..." : "Crear cuenta"}
          </button>
        </form>
      )}
    </div>
  );
}
