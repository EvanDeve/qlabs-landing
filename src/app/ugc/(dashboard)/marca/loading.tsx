import EsqueletoPanel from "@/components/ugc/EsqueletoPanel";

/**
 * Cubre todo `marca/*`. El título va a 26 y no a 34 como en creador: las
 * pantallas de la marca todavía no pasaron por el rediseño y abren con un h1
 * de ese tamaño, así que un bloque más alto daría un salto al aparecer el
 * contenido de verdad.
 */
export default function CargandoMarca() {
  return <EsqueletoPanel altoTitulo={26} />;
}
