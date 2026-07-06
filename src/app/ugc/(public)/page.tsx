import Link from "next/link";

export default function UgcPublicPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-5 px-6 text-center">
      <div className="flex items-center gap-2 text-lg font-extrabold">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet text-sm text-white">
          Q
        </span>
        UGC·CRC
      </div>
      <h1 className="text-4xl font-extrabold tracking-tight text-ink">
        Próximamente
      </h1>
      <p className="max-w-md text-ink-soft">
        El marketplace de UGC·CRC se está construyendo. Muy pronto vas a poder
        explorar campañas activas o aplicar como creador desde acá.
      </p>
      <Link
        href="/"
        className="rounded-pill border border-black/10 px-7 py-3 font-bold text-ink transition hover:border-ink"
      >
        ← Volver a Q Labs
      </Link>
    </div>
  );
}
