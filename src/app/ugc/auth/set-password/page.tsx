"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SetPasswordPage() {
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    async function establishSession() {
      // el link de invitación llega con la sesión en el fragmento de la URL
      // (#access_token=...&refresh_token=...) en flujo implícito — el
      // cliente de @supabase/ssr no la detecta solo (guarda sesión en
      // cookies, no en localStorage), así que hay que setearla a mano.
      const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
      const params = new URLSearchParams(hash);
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");

      if (accessToken && refreshToken) {
        await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        window.history.replaceState(null, "", window.location.pathname);
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

    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError("No se pudo guardar la contraseña. Pedí que te reenvíen la invitación.");
      return;
    }

    router.replace("/ugc/admin");
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-6 px-6 py-16">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex items-center gap-2 text-lg font-extrabold">
          <img src="/favicon-logo.png" alt="Q Labs" className="h-7 w-7 rounded-lg object-cover" />
          Q·OS
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-ink">Definí tu contraseña</h1>
        <p className="text-ink-soft">Último paso para entrar al Centro de Mando.</p>
      </div>

      {checkingSession ? (
        <p className="text-sm text-ink-soft">Validando invitación…</p>
      ) : !hasSession ? (
        <p className="text-sm font-bold text-coral">
          Este link de invitación no es válido o ya venció. Pedí que te reenvíen la invitación desde
          Equipo.
        </p>
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
