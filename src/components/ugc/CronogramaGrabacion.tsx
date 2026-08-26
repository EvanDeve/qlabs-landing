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
  apuntes: string | null;
};

const PLATAFORMA: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  reels: "Reels",
};

/**
 * El cronograma como lo ve quien graba: el guion entero y, sobre todo, los
 * apuntes de cada video.
 *
 * No es un componente de cliente y no necesita serlo: acá no se aprueba ni se
 * comenta nada, así que no hay estado que llevar. Es la diferencia práctica más
 * grande con `CronogramaPublico`, que sí lo es porque el Hero escribe.
 *
 * Usa los tokens del landing igual que la pantalla del Hero: es una pantalla
 * sin sesión y fuera del panel, no una herramienta de Q·OS.
 *
 * Los apuntes van ARRIBA del guion y con el color más fuerte de la tarjeta. El
 * orden es la decisión de diseño: quien abre esto ya sabe de qué se trata el
 * video —lo hablaron— y lo que viene a buscar es si le toca grabarlo o si va
 * con material que ya existe. Si eso quedara al pie, después del desarrollo y
 * el CTA, habría que leer la tarjeta entera para contestar la única pregunta
 * que trajo.
 */
export default function CronogramaGrabacion({
  heroNombre,
  heroLogo,
  mesLegible,
  aprobado,
  videos,
}: {
  heroNombre: string;
  heroLogo: string | null;
  mesLegible: string;
  aprobado: boolean;
  videos: Video[];
}) {
  const conApuntes = videos.filter((v) => v.apuntes).length;

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
                dejaría "Grabación De Septiembre". */}
            <h1 className="text-2xl font-extrabold text-ink md:text-3xl">Grabación de {mesLegible}</h1>
          </div>
        </header>

        {/* El aviso de que el mes todavía no está aprobado es lo primero que se
            lee, y va en coral. Un cronograma pendiente puede cambiar entero
            después de que el cliente lo mire: salir a grabar contra esta lista
            sin saberlo es perder un día de rodaje. */}
        {aprobado ? (
          <div className="mb-7 rounded-card border border-trust/30 bg-trust-bg px-5 py-4">
            <p className="font-bold text-trust">Mes aprobado por el cliente</p>
            <p className="mt-1 text-sm text-ink-soft">
              Esto es lo que se produce. Si algo cambia, el cambio aparece acá.
            </p>
          </div>
        ) : (
          <div className="mb-7 rounded-card border border-coral/40 bg-coral/10 px-5 py-4">
            <p className="font-bold text-coral">Pendiente de aprobación del cliente</p>
            <p className="mt-1 text-sm text-ink-soft">
              El cliente todavía no aprobó {mesLegible}, así que estos videos pueden cambiar. Confirmá con el equipo
              antes de salir a grabar.
            </p>
          </div>
        )}

        <div className="space-y-3">
          {videos.length === 0 ? (
            <p className="rounded-card border border-line bg-white px-5 py-8 text-center text-ink-soft">
              Este cronograma todavía no tiene videos cargados.
            </p>
          ) : (
            videos.map((v, i) => <VideoCard key={v.id} video={v} numero={i + 1} />)
          )}
        </div>

        {/* Solo cuando falta alguno. Decirlo evita el peor final posible: que
            alguien lea "sin apuntes" como "no hay que grabarlo". */}
        {videos.length > 0 && conApuntes < videos.length && (
          <p className="mt-6 rounded-card border border-line bg-white px-5 py-4 text-sm text-ink-soft">
            {videos.length - conApuntes === 1
              ? "Un video todavía no tiene apuntes."
              : `${videos.length - conApuntes} videos todavía no tienen apuntes.`}{" "}
            Preguntá antes de darlo por grabado o por descartado.
          </p>
        )}

        <p className="mt-10 text-center text-xs text-ink-soft">
          Cronograma de Q Labs · Este link es privado, no lo compartas.
        </p>
      </div>
    </main>
  );
}

function VideoCard({ video, numero }: { video: Video; numero: number }) {
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

      {/* `whitespace-pre-line` porque un apunte de varias líneas se escribe con
          saltos y sin esto sale todo pegado en un párrafo. */}
      {video.apuntes ? (
        <div className="mt-3 rounded-card border border-violet/30 bg-lavender-deep px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-wide text-violet-deep">Apuntes</p>
          <p className="mt-1 whitespace-pre-line font-bold text-ink">{video.apuntes}</p>
        </div>
      ) : (
        <div className="mt-3 rounded-card border border-line px-4 py-3">
          <p className="text-sm text-ink-soft">Sin apuntes todavía. Consultá antes de grabar.</p>
        </div>
      )}

      {video.script_idea && <p className="mt-4 text-ink-soft">{video.script_idea}</p>}

      {/* El hook se lee tal cual: es la línea que se dice sin cambiarle nada
          (SOP-002), y quien graba es justamente quien tiene que saberlo. */}
      {video.script_hook && (
        <div className="mt-4 rounded-card bg-lavender px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-wide text-violet-deep">Así arranca — se dice tal cual</p>
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
    </article>
  );
}
