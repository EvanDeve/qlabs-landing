"use client";

import { useEffect, useRef } from "react";
import Form from "next/form";
import Link from "next/link";
import { QosIcon } from "@/lib/ugc/qos-icons";
import styles from "@/styles/qos.module.css";

/**
 * Buscador + filtro de estado de las pantallas de UGC en Q·OS. Se aplican
 * solos (mockups 1b–1f): el estado al elegirlo, la búsqueda al dejar de
 * escribir. `next/form` navega sin recargar y el query queda en la URL, así
 * que el link se puede pasar y una acción vuelve a la misma vista.
 *
 * Sin JS sigue siendo un GET común: Enter en el buscador lo manda igual.
 */
export default function FiltroAdmin({
  base,
  tab,
  q,
  placeholder,
  estado,
  opciones,
  todos = "Todos los estados",
}: {
  base: string;
  tab: string;
  q: string;
  placeholder: string;
  estado?: string | null;
  /** Sin opciones no hay select: solo buscador. */
  opciones?: { id: string; label: string }[];
  todos?: string;
}) {
  const form = useRef<HTMLFormElement>(null);
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (espera.current) clearTimeout(espera.current);
    },
    [],
  );

  const enviar = () => form.current?.requestSubmit();

  return (
    <Form ref={form} action={base} replace className={styles.filtroAdmin}>
      <input type="hidden" name="tab" value={tab} />
      <label className={styles.pipeSearch}>
        <QosIcon name="search" size={14} />
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder={placeholder}
          aria-label="Buscar"
          onChange={() => {
            if (espera.current) clearTimeout(espera.current);
            espera.current = setTimeout(enviar, 450);
          }}
        />
      </label>
      {opciones && opciones.length > 0 && (
        <select
          name="estado"
          defaultValue={estado ?? ""}
          className={styles.selectInp}
          aria-label="Estado"
          onChange={enviar}
        >
          <option value="">{todos}</option>
          {opciones.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      )}
      {(q || estado) && (
        <Link href={`${base}?tab=${tab}`} className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}>
          Limpiar
        </Link>
      )}
    </Form>
  );
}
