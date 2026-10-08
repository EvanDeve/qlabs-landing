"use client";

import { useRef } from "react";
import Form from "next/form";
import styles from "@/styles/qos.module.css";

export type SelectFiltro = {
  name: string;
  value: string | null;
  todos: string;
  opciones: { id: string; label: string }[];
};

/**
 * Desplegables chicos que filtran al elegir, para el encabezado de una
 * tarjeta ("Todos los negocios ▾ · Todos los estados ▾", mockup 1e). Mismo
 * mecanismo que FiltroAdmin: `next/form`, el query queda en la URL.
 */
export default function FiltroSelects({ base, selects }: { base: string; selects: SelectFiltro[] }) {
  const form = useRef<HTMLFormElement>(null);
  return (
    <Form ref={form} action={base} replace scroll={false} className={styles.filtroSelects}>
      {selects.map((s) => (
        <select
          key={s.name}
          name={s.name}
          defaultValue={s.value ?? ""}
          aria-label={s.todos}
          className={styles.selectMini}
          onChange={() => form.current?.requestSubmit()}
        >
          <option value="">{s.todos}</option>
          {s.opciones.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      ))}
    </Form>
  );
}
