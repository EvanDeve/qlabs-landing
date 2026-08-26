import EscanerPantalla from "@/components/ugc/marca/EscanerPantalla";

export const dynamic = "force-dynamic";

/**
 * La cámara para validar un canje.
 *
 * Vive dentro de `(dashboard)/marca` a propósito, igual que `[code]`: así
 * hereda `requireRole` y nadie sin sesión de marca abre una cámara acá.
 */
export default function EscanearPage() {
  return <EscanerPantalla />;
}
