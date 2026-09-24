import Link from "next/link";
import { leerInvitacion } from "@/lib/cf/invitacion";
import { salirCfAction } from "@/lib/actions/close-friends";
import { CF } from "@/lib/cf/copy";
import { BOTON, BOTON_SUAVE, Encabezado, LogoNegocio, Pantalla, PantallaMensaje } from "@/components/cf/ui";
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
 * Lo que abre el QR del negocio. Cuenta el escaneo y, según quién mira:
 *
 *   sin sesión              → la invitación y de acá al registro
 *   miembro, ya vinculado   → "ya sos parte", al panel
 *   miembro de otro negocio → unirse con un toque, sin formulario
 *   creador / marca / admin → Close Friends es con otro correo
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

  const { negocio, logoUrl } = invitacion;

  if (sesion?.rol === "member" && sesion.vinculado) {
    return (
      <PantallaMensaje
        titulo={`Ya sos parte de ${negocio}`}
        detalle="Tus cupones de este negocio están en tu panel."
        accion={{ href: "/cf", texto: "Ir a mis cupones" }}
      />
    );
  }

  if (sesion?.rol && sesion.rol !== "member") {
    return (
      <PantallaMensaje
        titulo="Estás con tu cuenta de trabajo"
        detalle={`Tenés la sesión abierta con tu cuenta de ${NOMBRE_DE_ROL[sesion.rol]}. ${CF.programa} es para clientes y va con otro correo: cerrá la sesión y registrate con tu correo personal.`}
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

  return (
    <Pantalla>
      <Encabezado />

      <div className="mt-10">
        <LogoNegocio nombre={negocio} logoUrl={logoUrl} />
        {/* Dos renglones a propósito: el nombre del negocio arranca línea
            propia en vez de quedar donde caiga el salto automático. */}
        <h1 className="mt-6 text-[32px] font-extrabold leading-[1.12] tracking-tight">
          <span className="block">Te invitó</span>
          <span className="block text-violet-deep">{negocio}</span>
        </h1>
        <p className="mt-4 text-base leading-relaxed text-ink-soft">
          Unite a {CF.programa} y accedé a los cupones que {negocio} guarda para sus clientes. Sin apps que
          descargar.
        </p>
      </div>

      {sesion?.rol === "member" ? (
        <div className="mt-auto pt-10">
          <UnirmeConSesion codigo={invitacion.codigo} negocio={negocio} />
        </div>
      ) : (
        <>
          <ol className="mt-8 flex flex-col gap-2.5">
            <Paso n={1}>Registrate en un minuto</Paso>
            <Paso n={2}>Reclamá los cupones de {negocio}</Paso>
            <Paso n={3}>Mostrá tu código en caja</Paso>
          </ol>

          <div className="mt-auto flex flex-col gap-2 pt-10">
            <Link href={`/cf/unirme/${invitacion.codigo}/registro`} className={BOTON}>
              Unirme
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
