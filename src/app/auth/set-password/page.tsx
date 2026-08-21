"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { destinoTrasSetPasswordAction } from "@/lib/actions/auth";

/**
 * Definir contraseña. Dos entradas distintas caen acá:
 *
 * - Invitación al equipo (`inviteStaffAction`) — sin parámetro.
 * - Recuperar contraseña (`requestPasswordResetAction`) — con `?modo=recuperar`.
 *
 * Cambia el texto, no el mecanismo: los dos links traen la sesión en el
 * fragmento de la URL y los dos terminan en `updateUser({ password })`.
 */
function SetPasswordInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const esRecuperacion = searchParams.get("modo") === "recuperar";

  const [checkingSession, setCheckingSession] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    async function establishSession() {
      // el link llega con la sesión en el fragmento de la URL
      // (#access_token=...&refresh_token=...) en flujo implícito — el
      // cliente de @supabase/ssr no la detecta solo (guarda sesión en
      // cookies, no en localStorage), así que hay que setearla a mano.
      const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
      const params = new URLSearchParams(hash);
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");

      if (accessToken && refreshToken) {
        await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        // Se borra el token de la barra de direcciones, pero conservando el
        // search: `pathname` a secas se llevaba puesto el ?modo=recuperar y la
        // pantalla volvía a hablar de invitaciones a alguien que estaba
        // recuperando su clave.
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
      }

      const { data } = await supabase.auth.getSession();
      setHasSession(Boolean(data.session));
      setCheckingSession(false);
    }

    establishSession();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setLoading(false);
      setError(
        esRecuperacion
          ? "No se pudo guardar la contraseña. Pedí un link nuevo desde «Olvidé mi contraseña»."
          : "No se pudo guardar la contraseña. Pedí que te reenvíen la invitación."
      );
      return;
    }

    // A dónde va depende del rol, y eso solo se sabe del lado del servidor.
    // Antes estaba clavado en /admin, que servía cuando lo único que llegaba
    // acá eran invitaciones al equipo.
    router.replace(await destinoTrasSetPasswordAction());
  }

  const titulo = esRecuperacion ? "Creá tu contraseña nueva" : "Definí tu contraseña";
  const bajada = esRecuperacion
    ? "Elegí una contraseña nueva y volvés a entrar."
    : "Último paso para entrar al Centro de Mando.";
  const linkVencido = esRecuperacion
    ? "Este link ya venció o se usó. Pedí uno nuevo desde «Olvidé mi contraseña» en la pantalla de acceso."
    : "Este link de invitación no es válido o ya venció. Pedí que te reenvíen la invitación desde Equipo.";

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-6 px-6 py-16">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex items-center gap-2 text-lg font-extrabold">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/favicon-logo.png" alt="Q Labs" className="h-7 w-7 rounded-lg object-cover" />
          Q Labs
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-ink">{titulo}</h1>
        <p className="text-ink-soft">{bajada}</p>
      </div>

      {checkingSession ? (
        <p className="text-sm text-ink-soft">Validando el link…</p>
      ) : !hasSession ? (
        <p className="text-sm font-bold text-coral">{linkVencido}</p>
      ) : (
        <form onSubmit={handleSubmit} className="flex w-full flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-bold text-ink">Contraseña</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              className="rounded-card border border-line px-4 py-2.5 text-sm"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-bold text-ink">Repetila</span>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              className="rounded-card border border-line px-4 py-2.5 text-sm"
            />
          </label>

          {error && <p className="text-sm font-bold text-coral">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="rounded-pill bg-violet px-6 py-2.5 text-sm font-bold text-white transition hover:bg-violet-deep disabled:opacity-50"
          >
            {loading ? "Guardando…" : "Guardar y entrar"}
          </button>
        </form>
      )}
    </div>
  );
}

export default function SetPasswordPage() {
  // useSearchParams obliga a un limite de Suspense para que la pagina no
  // quede fuera del prerender estatico.
  return (
    <Suspense fallback={<p className="p-16 text-center text-sm text-ink-soft">Validando el link…</p>}>
      <SetPasswordInner />
    </Suspense>
  );
}
