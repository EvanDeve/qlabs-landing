"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import styles from "@/styles/qos.module.css";

type Tono = "ok" | "error";
type Toast = { id: number; texto: string; tono: Tono };

const DURACION_MS = 4000;

const ToastContext = createContext<(texto: string, tono?: Tono) => void>(() => {});

/**
 * Aviso de que la acción entró.
 *
 * Hasta ahora guardar, publicar o aceptar a alguien no decía nada: el cambio
 * había que deducirlo de que un badge cambiara de color en otra parte de la
 * pantalla, o directamente no se notaba.
 */
export function useToast() {
  return useContext(ToastContext);
}

export default function Toaster({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  // Contador propio en vez de Date.now(): dos avisos disparados en el mismo
  // milisegundo compartirían key y React reusaría el nodo del anterior.
  const proximoId = useRef(0);

  const toast = useCallback((texto: string, tono: Tono = "ok") => {
    const id = proximoId.current++;
    setToasts((prev) => [...prev, { id, texto, tono }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), DURACION_MS);
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className={styles.toastWrap} role="status" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`${styles.toast} ${t.tono === "error" ? styles.toastErr : styles.toastOk}`}
          >
            {t.texto}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/*
 * No hace falta pasar el aviso por la URL para que sobreviva a un cambio de
 * pantalla: el proveedor vive en el layout del panel, que NO se desmonta al
 * navegar entre rutas del panel. Un toast disparado antes de router.push()
 * sigue visible del otro lado.
 */
