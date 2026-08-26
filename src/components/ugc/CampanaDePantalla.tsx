"use client";

import { createContext, useContext } from "react";
import NotificationsBell from "@/components/ugc/NotificationsBell";
import type { Database } from "@/lib/database.types";

type Notification = Database["public"]["Tables"]["notifications"]["Row"];

/**
 * Las notificaciones que ya trae `QosShell`, puestas a disposición de la
 * pantalla.
 *
 * Existe porque en móvil la campana dejó de flotar arriba a la derecha y pasó a
 * ser un elemento más de la fila del título, al lado del botón de la pantalla.
 * Esa fila la arma cada página, no el shell, y en App Router un layout no puede
 * pasarle props a la página que envuelve: el contexto es el único puente.
 *
 * Mientras flotaba había que adivinar a qué altura caía el título de cada
 * pantalla —eran seis constantes distintas y ninguna daba en el centro—. Dentro
 * de la fila la centra el navegador y no hay nada que mantener.
 */
export const NotificacionesCtx = createContext<Notification[]>([]);

export default function CampanaDePantalla() {
  return <NotificationsBell notifications={useContext(NotificacionesCtx)} />;
}
