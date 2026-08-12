"use client";

import { useEffect, useState, useTransition } from "react";
import { comentarVideoAction, aprobarCronogramaAction, marcarVistoAction } from "@/lib/actions/cronograma-publico";

type Video = {
  id: string;
  title: string;
  platform: string;
  fechaLegible: string | null;
  horaLegible: string;
  script_hook: string | null;
  script_idea: string | null;
  script_desarrollo: string | null;
  script_cta: string | null;
  client_comment: string | null;
};

const PLATAFORMA: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  reels: "Reels",
};

/**
 * El cronograma como lo ve el Hero: sin sesión, sin panel y sin jerga interna.
 *
 * Usa los tokens del landing (Plus Jakarta Sans, violeta, pills, lavanda) y no
 * el sistema Q·OS: Q·OS es la herramienta del equipo, y esto es una pantalla
 * para un cliente. Ver la referencia de diseño del proyecto.
 *
 * Lo que puede hacer es comentar y aprobar. No edita nada — lo decidió el
 * equipo, y significa que ni un link filtrado puede cambiar lo prometido.
 */
export default function CronogramaPublico({
  token,
  heroNombre,
  heroLogo,
  mesLegible,
  aprobado,
  aprobadoPorCliente,
  videos,
}: {
  token: string;
  heroNombre: string;
  heroLogo: string | null;
  mesLegible: string;
  aprobado: boolean;
  aprobadoPorCliente: boolean;
  videos: Video[];
}) {
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Deja constancia de que lo abrió. Es lo que después responde la pregunta
  // aburrida y útil: ¿no contesta porque no le importa, o porque nunca lo vio?
  useEffect(() => {
    void marcarVistoAction(token);
  }, [token]);

  function aprobar() {
    setError(null);
    startTransition(async () => {
      const r = await aprobarCronogramaAction(token);
      if (!r.ok) setError(r.error);
      setConfirmando(false);
    });
  }

  return (
    <main className="min-h-screen bg-lavender/40 px-5 py-10 md:py-16">
      <div className="mx-auto w-full max-w-2xl">
        <header className="mb-8 flex items-center gap-4">
          {heroLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={heroLogo} alt="" className="h-12 w-12 rounded-pill object-cover" />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-pill bg-violet text-lg font-extrabold text-white">
              {heroNombre.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-sm text-ink-soft">{heroNombre}</p>
            {/* Sin `capitalize`: la clase de Tailwind capitaliza CADA palabra y
                dejaba "Cronograma De Septiembre". El mes va en minúscula, que
                es como se escribe en español. */}
            <h1 className="text-2xl font-extrabold text-ink md:text-3xl">Cronograma de {mesLegible}</h1>
          </div>
        </header>

        {aprobado ? (
          <div className="mb-7 rounded-card border border-trust/30 bg-trust-bg px-5 py-4">
            <p className="font-bold text-trust">
              {aprobadoPorCliente ? "Ya aprobaste este cronograma" : "Este cronograma está aprobado"}
            </p>
            <p className="mt-1 text-sm text-ink-soft">
              El equipo ya está produciendo estos videos. Si necesitás cambiar algo, escribinos.
            </p>
          </div>
        ) : (
          <div className="mb-7 rounded-card border border-line bg-white px-5 py-4">
            <p className="font-bold text-ink">Esto es lo que preparamos para {mesLegible}</p>
            <p className="mt-1 text-sm text-ink-soft">
              Revisá cada video. Si algo no te cuadra, dejanos un comentario ahí mismo y lo ajustamos. Cuando
              estés conforme, aprobá el mes y arrancamos.
            </p>
          </div>
        )}

        <div className="space-y-3">
          {videos.length === 0 ? (
            <p className="rounded-card border border-line bg-white px-5 py-8 text-center text-ink-soft">
              Este cronograma todavía no tiene videos cargados.
            </p>
          ) : (
            videos.map((v, i) => (
              <VideoCard key={v.id} video={v} numero={i + 1} token={token} bloqueado={aprobado} />
            ))
          )}
        </div>

        {!aprobado && videos.length > 0 && (
          <div className="mt-8 rounded-card border border-line bg-white px-5 py-5">
            {error && <p className="mb-3 text-sm font-semibold text-coral">{error}</p>}

            {/* Confirmación en la propia página y NO con window.confirm(): el
                nativo congela la automatización del navegador y además se ve
                como una alerta del sistema en algo que es una decisión del
                cliente. */}
            {confirmando ? (
              <>
                <p className="font-bold text-ink">¿Aprobás el cronograma de {mesLegible}?</p>
                <p className="mt-1 mb-4 text-sm text-ink-soft">
                  Con esto arrancamos la producción de{" "}
                  {videos.length === 1 ? "un video" : `${videos.length} videos`}. Después de aprobar ya no vas a poder
                  comentar acá.
                </p>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={aprobar}
                    disabled={isPending}
                    className="rounded-pill bg-violet px-6 py-3 font-bold text-white transition hover:bg-violet-deep disabled:opacity-60"
                  >
                    {isPending ? "Aprobando…" : "Sí, aprobar el mes"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmando(false)}
                    disabled={isPending}
                    className="rounded-pill border border-line px-6 py-3 font-bold text-ink-soft transition hover:bg-lavender"
                  >
                    Todavía no
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="mb-4 text-sm text-ink-soft">
                  {/* El artículo también cambia, no solo el sustantivo: "con los
                      1 video" es lo que sale si solo se pluraliza la palabra. */}
                  Cuando estés conforme con {videos.length === 1 ? "el video" : `los ${videos.length} videos`}, aprobá
                  el mes y empezamos a producir.
                </p>
                <button
                  type="button"
                  onClick={() => setConfirmando(true)}
                  className="rounded-pill bg-violet px-6 py-3 font-bold text-white transition hover:bg-violet-deep"
                >
                  Aprobar cronograma
                </button>
              </>
            )}
          </div>
        )}

        <p className="mt-10 text-center text-xs text-ink-soft">
          Cronograma preparado por Q Labs · Este link es privado, no lo compartas.
        </p>
      </div>
    </main>
  );
}

function VideoCard({
  video,
  numero,
  token,
  bloqueado,
}: {
  video: Video;
  numero: number;
  token: string;
  bloqueado: boolean;
}) {
  const [comentando, setComentando] = useState(false);
  const [comentario, setComentario] = useState(video.client_comment ?? "");
  // El guardado se refleja acá y no se relee del servidor: el revalidatePath
  // llega, pero sin esto el textarea se queda mostrando lo tipeado sin ninguna
  // señal de que entró.
  const [guardado, setGuardado] = useState(video.client_comment);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function guardar() {
    setError(null);
    startTransition(async () => {
      const r = await comentarVideoAction(token, video.id, comentario);
      if (r.ok) {
        setGuardado(comentario.trim() || null);
        setComentando(false);
      } else {
        setError(r.error);
      }
    });
  }

  return (
    <article className="rounded-card border border-line bg-white px-5 py-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-ink-soft">{String(numero).padStart(2, "0")}</span>
        {video.fechaLegible ? (
          <span className="rounded-pill bg-lavender-deep px-3 py-1 text-xs font-bold text-violet-deep">
            {video.fechaLegible}
            {video.horaLegible ? ` · ${video.horaLegible}` : ""}
          </span>
        ) : (
          <span className="rounded-pill bg-lavender px-3 py-1 text-xs font-bold text-ink-soft">Fecha por definir</span>
        )}
        <span className="rounded-pill bg-lavender px-3 py-1 text-xs font-bold text-ink-soft">
          {PLATAFORMA[video.platform] ?? video.platform}
        </span>
      </div>

      <h2 className="text-lg font-extrabold text-ink">{video.title || `Video ${numero}`}</h2>

      {video.script_idea && <p className="mt-2 text-ink-soft">{video.script_idea}</p>}

      {/* El hook se muestra pero no se ofrece cambiar: es la línea que se dice
          tal cual. Que el cliente la vea es bueno —le da confianza en el
          video— y que no la pueda editar es la regla del método. */}
      {video.script_hook && (
        <div className="mt-4 rounded-card bg-lavender px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-wide text-violet-deep">Así arranca</p>
          <p className="mt-1 font-bold text-ink">{video.script_hook}</p>
        </div>
      )}

      {video.script_desarrollo && (
        <div className="mt-4">
          <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">Cómo se desarrolla</p>
          <p className="mt-1 whitespace-pre-line text-ink-soft">{video.script_desarrollo}</p>
        </div>
      )}

      {video.script_cta && (
        <div className="mt-4">
          <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">Cierre</p>
          <p className="mt-1 text-ink-soft">{video.script_cta}</p>
        </div>
      )}

      <div className="mt-5 border-t border-line pt-4">
        {guardado && !comentando && (
          <div className="mb-3 rounded-card bg-lavender px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wide text-violet-deep">Tu comentario</p>
            <p className="mt-1 whitespace-pre-line text-ink">{guardado}</p>
          </div>
        )}

        {bloqueado ? null : comentando ? (
          <>
            <textarea
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              rows={3}
              maxLength={2000}
              autoFocus
              placeholder="¿Qué cambiarías de este video?"
              className="w-full rounded-lg border border-line px-4 py-3 focus:border-violet focus:outline-none"
            />
            {error && <p className="mt-2 text-sm font-semibold text-coral">{error}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={guardar}
                disabled={isPending}
                className="rounded-pill bg-violet px-5 py-2 text-sm font-bold text-white transition hover:bg-violet-deep disabled:opacity-60"
              >
                {isPending ? "Guardando…" : "Guardar comentario"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setComentario(guardado ?? "");
                  setComentando(false);
                  setError(null);
                }}
                disabled={isPending}
                className="rounded-pill border border-line px-5 py-2 text-sm font-bold text-ink-soft transition hover:bg-lavender"
              >
                Cancelar
              </button>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setComentando(true)}
            className="text-sm font-bold text-violet transition hover:text-violet-deep"
          >
            {guardado ? "Editar mi comentario" : "Comentar este video"}
          </button>
        )}
      </div>
    </article>
  );
}
