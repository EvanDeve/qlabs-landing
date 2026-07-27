import Link from "next/link";
import SiteNav from "@/components/layout/SiteNav";
import "./legal.css";

// Los dos documentos legales comparten cáscara: el mismo nav público que la
// landing y /ugc (así el visitante no siente que salió del sitio) y un ancho de
// lectura angosto — 68ch aprox — porque son textos largos y corridos.
export default function LegalLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen bg-white">
      <SiteNav
        logoHref="/"
        logoLabel="Labs"
        actions={[{ href: "/ugc", label: "Ir a UGC·CRC", variant: "primary" }]}
      />

      <main className="mx-auto w-full max-w-3xl px-6 py-14 md:py-20">{children}</main>

      <footer className="border-t border-line bg-lavender">
        <div className="mx-auto flex max-w-3xl flex-col gap-3 px-6 py-8 text-sm text-ink-soft sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} Q Labs · Costa Rica</span>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <Link href="/legal/terminos" className="font-bold transition hover:text-ink">
              Términos y condiciones
            </Link>
            <Link href="/legal/privacidad" className="font-bold transition hover:text-ink">
              Política de privacidad
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
