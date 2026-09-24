import Link from "next/link";
import { leerInvitacion } from "@/lib/cf/invitacion";
import { salirCfAction } from "@/lib/actions/close-friends";
import { CF } from "@/lib/cf/copy";
import {
  BOTON,
  BOTON_SUAVE,
  CuponRegalo,
  Encabezado,
  LogoNegocio,
  Pantalla,
  PantallaMensaje,
} from "@/components/cf/ui";
import UnirmeConSesion from "@/components/cf/UnirmeConSesion";

export const dynamic = "force-dynamic";

const NOMBRE_DE_ROL = { creator: "creador", brand: "negocio", admin: "equipo de Q Labs" } as const;

function Paso({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 rounded-card bg-white p-4 ring-1 ring-line">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-pill bg-lavender-deep text-sm font-extrabold text-violet-deep">
        {n}
      </span>
      <span className="text-[15px] font-semibold text-ink">{children}</span>
    </li>
  );
}

/**
 * Lo que abre el QR de un cupón (o de un negocio). Cuenta el escaneo y, según
 * quién mira:
 *
 *   sin sesión                    → el cupón de regalo y de acá al registro
 *   miembro, ya tiene ese cupón   → "ya está en tu wallet"
 *   miembro, cupón nuevo          → agregarlo con un toque (y unirse, si no era
 *                                   de este negocio)
 *   miembro, QR sin cupón, ya era → "ya sos parte"
 *   creador / marca / admin       → Close Friends es con otro correo
 */
export default async function UnirmePage({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  const { invitacion, sesion } = await leerInvitacion(codigo, { contarEscaneo: true });

  if (!invitacion) {
    return (
      <PantallaMensaje
        titulo="Este código ya no está activo"
        detalle="Puede que el negocio lo haya cambiado o que el QR esté mal impreso. Pedile que te muestre el actual."
      />
    );
  }

  const { negocio, logoUrl, cupon } = invitacion;
  const esMiembro = sesion?.rol === "member";

  if (esMiembro && cupon && sesion.yaTieneCupon) {
    return (
      <PantallaMensaje
        titulo="Ya está en tu wallet"
        detalle={`${cupon.title}, de ${negocio}, ya lo tenés. Mostralo en caja desde tus cupones.`}
        accion={{ href: "/cf/cupones", texto: "Ir a mis cupones" }}
      />
    );
  }

  if (esMiembro && !cupon && sesion.vinculado) {
    return (
      <PantallaMensaje
        titulo={`Ya sos parte de ${negocio}`}
        detalle="Tus cupones de este negocio están en tu wallet."
        accion={{ href: "/cf", texto: "Ir a mi wallet" }}
      />
    );
  }

  if (sesion?.rol && !esMiembro) {
    return (
      <PantallaMensaje
        titulo="Estás con tu cuenta de trabajo"
        detalle={`Tenés la sesión abierta con tu cuenta de ${NOMBRE_DE_ROL[sesion.rol as keyof typeof NOMBRE_DE_ROL]}. ${CF.programa} es para clientes y va con otro correo: cerrá la sesión y registrate con tu correo personal.`}
      >
        <form action={salirCfAction}>
          <input type="hidden" name="codigo" value={invitacion.codigo} />
          <button type="submit" className={BOTON}>
            Cerrar sesión y seguir
          </button>
        </form>
      </PantallaMensaje>
    );
  }

  const conRegalo = cupon?.disponible;

  return (
    <Pantalla>
      <Encabezado />

      <div className="mt-8">
        <LogoNegocio nombre={negocio} logoUrl={logoUrl} />
        {/* Dos renglones a propósito: el nombre del negocio arranca línea
            propia en vez de quedar donde caiga el salto automático. */}
        <h1 className="mt-5 text-[32px] font-extrabold leading-[1.12] tracking-tight">
          <span className="block">{esMiembro ? "Un cupón de" : "Te invitó"}</span>
          <span className="block text-violet-deep">{negocio}</span>
        </h1>
        {!esMiembro && (
          <p className="mt-4 text-base leading-relaxed text-ink-soft">
            Unite a {CF.programa} y guardá los cupones de {negocio} en tu teléfono. Sin apps que descargar.
          </p>
        )}
      </div>

      {cupon && (
        <div className="mt-6">
          <CuponRegalo cupon={cupon} />
        </div>
      )}

      {esMiembro ? (
        <div className="mt-auto pt-8">
          <UnirmeConSesion
            codigo={invitacion.codigo}
            negocio={negocio}
            preguntarCompartir={!sesion.vinculado}
            conCupon={Boolean(conRegalo)}
          />
        </div>
      ) : (
        <>
          <ol className="mt-6 flex flex-col gap-2.5">
            <Paso n={1}>Registrate en un minuto</Paso>
            <Paso n={2}>{conRegalo ? "El cupón queda en tu wallet" : `Reclamá los cupones de ${negocio}`}</Paso>
            <Paso n={3}>Mostrá tu código en caja</Paso>
          </ol>

          <div className="mt-auto flex flex-col gap-2 pt-8">
            <Link href={`/cf/unirme/${invitacion.codigo}/registro`} className={BOTON}>
              {conRegalo ? "Unirme y guardar el cupón" : "Unirme"}
            </Link>
            <Link href={`/cf/entrar?next=/cf/unirme/${invitacion.codigo}`} className={BOTON_SUAVE}>
              Ya soy miembro
            </Link>
          </div>
        </>
      )}
    </Pantalla>
  );
}
