import EsqueletoPanel from "@/components/ugc/EsqueletoPanel";

/**
 * Cubre todo `marca/*`. Desde que los dos paneles comparten `PantallaHeader`,
 * el título mide lo mismo en los dos y el alto por defecto ya es el correcto:
 * el 26 de antes existía porque marca abría con un h1 más chico que creador.
 */
export default function CargandoMarca() {
  return <EsqueletoPanel />;
}
