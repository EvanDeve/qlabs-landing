import Link from "next/link";
import BrandAvatar from "@/components/ugc/BrandAvatar";
import { CF } from "@/lib/cf/copy";

/**
 * Las piezas de las pantallas de Close Friends. Mismo lenguaje que las
 * pantallas públicas de /ugc (login, pendiente): Plus Jakarta, violeta,
 * botones pill, tarjetas blancas sobre lavanda. Mobile-first: todo toque mide
 * 44 px o más y todo campo usa 16 px de letra —con menos, iOS hace zoom al
 * enfocarlo y la pantalla queda corrida.
 */

export const BOTON =
  "flex min-h-12 w-full items-center justify-center gap-2 rounded-pill bg-violet px-6 text-base font-bold text-white shadow-[0_10px_26px_-10px_rgba(112,92,246,0.7)] transition hover:bg-violet-deep active:scale-[.99] disabled:opacity-60";

export const BOTON_SUAVE =
  "flex min-h-12 w-full items-center justify-center gap-2 rounded-pill border border-line bg-white px-6 text-base font-bold text-ink transition hover:border-violet active:scale-[.99] disabled:opacity-60";

export const CAMPO =
  "min-h-12 w-full rounded-xl border border-line bg-white px-4 text-base text-ink outline-none transition placeholder:text-ink-soft/60 focus:border-violet";

/** La marca del programa arriba de las pantallas sin barra de navegación. */
export function Encabezado() {
  return (
    <div className="flex items-center gap-2 text-sm font-extrabold text-ink">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/favicon-logo.png" alt="" className="h-6 w-6 rounded-md object-cover" />
      {CF.programa}
    </div>
  );
}

/** Columna de una pantalla: angosta, con el margen de 16 px del teléfono. */
export function Pantalla({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <main
      className={`mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pb-[max(env(safe-area-inset-bottom),2rem)] pt-[max(env(safe-area-inset-top),1.5rem)] ${className}`}
    >
      {children}
    </main>
  );
}

/** Logo del negocio, grande, para la pantalla del QR. */
export function LogoNegocio({ nombre, logoUrl }: { nombre: string; logoUrl: string | null }) {
  return <BrandAvatar name={nombre} logoUrl={logoUrl} size={72} radius={20} />;
}

/**
 * Una pantalla de un solo mensaje: código que no existe, QR pausado, ya sos
 * miembro. Siempre con una salida.
 */
export function PantallaMensaje({
  titulo,
  detalle,
  accion,
  children,
}: {
  titulo: string;
  detalle: string;
  accion?: { href: string; texto: string };
  children?: React.ReactNode;
}) {
  return (
    <Pantalla>
      <Encabezado />
      <div className="my-auto py-10">
        <h1 className="text-[28px] font-extrabold leading-tight tracking-tight">{titulo}</h1>
        <p className="mt-3 text-base leading-relaxed text-ink-soft">{detalle}</p>
      </div>
      {children}
      {accion && (
        <Link href={accion.href} className={BOTON}>
          {accion.texto}
        </Link>
      )}
    </Pantalla>
  );
}

/**
 * Casilla con su texto como label: toda la fila es tocable, no solo el
 * cuadradito. El input es nativo (accesible, y el formulario lo manda solo).
 */
export function Casilla({
  name,
  defaultChecked,
  checked,
  onChange,
  required,
  children,
  ayuda,
}: {
  name: string;
  defaultChecked?: boolean;
  checked?: boolean;
  onChange?: (v: boolean) => void;
  required?: boolean;
  children: React.ReactNode;
  ayuda?: React.ReactNode;
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-card bg-white px-4 py-3 ring-1 ring-line transition has-[:checked]:ring-violet/40">
      <input
        type="checkbox"
        name={name}
        required={required}
        {...(checked !== undefined
          ? { checked, onChange: (e) => onChange?.(e.target.checked) }
          : { defaultChecked })}
        className="mt-0.5 h-5 w-5 shrink-0 accent-violet"
      />
      <span className="text-[15px] leading-snug text-ink">
        {children}
        {ayuda && <span className="mt-1 block text-[13px] text-ink-soft">{ayuda}</span>}
      </span>
    </label>
  );
}

/**
 * El campo del código que llega por correo. `one-time-code` hace que iOS y Android
 * ofrezcan pegarlo solo desde el correo; `numeric` abre el teclado de números.
 */
export function CampoCodigo({ error }: { error?: boolean }) {
  return (
    <input
      name="token"
      inputMode="numeric"
      autoComplete="one-time-code"
      // El largo lo define Supabase (6 a 10); no se clava uno acá.
      pattern="[0-9]{6,10}"
      maxLength={10}
      required
      // Pantalla de un solo campo: se abre ya con el teclado (ver nota de
      // autoFocus en los pendientes — se conserva en pantallas así).
      autoFocus
      aria-invalid={error || undefined}
      aria-label="Código"
      placeholder="Código"
      className={`${CAMPO} min-h-16 text-center text-3xl font-extrabold tracking-[0.3em] placeholder:text-xl placeholder:font-semibold placeholder:tracking-normal`}
    />
  );
}

export function MensajeError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="rounded-card bg-coral/10 px-4 py-3 text-[15px] font-semibold text-coral">
      {children}
    </p>
  );
}
