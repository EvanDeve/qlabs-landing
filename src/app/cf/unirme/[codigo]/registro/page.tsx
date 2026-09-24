import { redirect } from "next/navigation";
import { leerInvitacion } from "@/lib/cf/invitacion";
import { CuponRegalo, Encabezado, LogoNegocio, Pantalla, PantallaMensaje } from "@/components/cf/ui";
import FormularioRegistro from "@/components/cf/FormularioRegistro";

export const dynamic = "force-dynamic";

export default async function RegistroPage({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  // El escaneo ya se contó en la página anterior.
  const { invitacion, sesion } = await leerInvitacion(codigo, { contarEscaneo: false });

  if (!invitacion) {
    return (
      <PantallaMensaje
        titulo="Este código ya no está activo"
        detalle="Puede que el negocio lo haya cambiado. Pedile que te muestre el actual."
      />
    );
  }

  // Quien ya tiene rol no llena el formulario: la página del QR sabe qué
  // hacer con cada caso (unirse con un toque, o avisar de la cuenta de trabajo).
  if (sesion?.rol) redirect(`/cf/unirme/${invitacion.codigo}`);

  return (
    <Pantalla>
      <Encabezado />
      <div className="mb-8 mt-8 flex items-center gap-4">
        <LogoNegocio nombre={invitacion.negocio} logoUrl={invitacion.logoUrl} />
        <div>
          <p className="text-[15px] text-ink-soft">Te unís con</p>
          <p className="text-xl font-extrabold leading-tight">{invitacion.negocio}</p>
        </div>
      </div>
      {/* Se recuerda qué se lleva: es el motivo por el que está llenando esto. */}
      {invitacion.cupon?.disponible && (
        <div className="mb-8">
          <CuponRegalo cupon={invitacion.cupon} />
        </div>
      )}
      <FormularioRegistro codigo={invitacion.codigo} />
    </Pantalla>
  );
}
