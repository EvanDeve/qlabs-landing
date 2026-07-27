import Link from "next/link";

// Footer del marketplace. Existe sobre todo para que los documentos legales
// sean alcanzables navegando: hasta ahora solo se llegaba a ellos desde el
// texto del formulario de registro, y unos términos que solo aparecen en el
// momento de aceptarlos no cumplen con ser "de acceso previo".
export default function PublicFooter() {
  return (
    <footer className="border-t border-line bg-lavender">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-10 text-sm text-ink-soft sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/favicon-logo.png" alt="" className="h-6 w-6 rounded-lg object-cover" />
          <span>© {new Date().getFullYear()} Q Labs · Costa Rica</span>
        </div>

        {/* La landing (/) no lleva footer propio a pedido del usuario, así que
            este es el único puente de vuelta: tiene que decir a dónde va. */}
        <nav className="flex flex-wrap gap-x-5 gap-y-2">
          <Link href="/" className="font-bold transition hover:text-ink">
            ← Ir a Q Labs
          </Link>
          <Link href="/legal/terminos" className="font-bold transition hover:text-ink">
            Términos y condiciones
          </Link>
          <Link href="/legal/privacidad" className="font-bold transition hover:text-ink">
            Política de privacidad
          </Link>
        </nav>
      </div>
    </footer>
  );
}
