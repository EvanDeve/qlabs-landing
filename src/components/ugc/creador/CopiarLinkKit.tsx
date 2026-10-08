"use client";

import { useEffect, useState } from "react";
import { urlDelKit } from "@/lib/ugc/handles";
import styles from "@/styles/qos.module.css";

/**
 * Copia el link del kit (spec 002, RF-18). La URL se arma con el origen del
 * navegador por la misma razón que en `CompartirPerfil`: es el único dato que
 * no puede estar mal.
 */
export default function CopiarLinkKit({ handle }: { handle: string }) {
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (!copiado) return;
    const id = setTimeout(() => setCopiado(false), 2200);
    return () => clearTimeout(id);
  }, [copiado]);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(urlDelKit(window.location.origin, handle));
      setCopiado(true);
    } catch {
      // Sin permiso de portapapeles (algunos navegadores in-app): se abre el
      // kit para que lo copie de la barra.
      window.open(urlDelKit(window.location.origin, handle), "_blank");
    }
  }

  return (
    <button type="button" onClick={copiar} className={styles.btnAplicar}>
      {copiado ? "¡Link copiado!" : "Copiar el link de mi kit"}
    </button>
  );
}
