"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { submitDeliveryAction } from "@/lib/actions/deliveries";
import { DELIVERIES_BUCKET, MAX_DELIVERY_FILE_BYTES } from "@/lib/ugc/deliveries";
import { pesoLegible, subirArchivoDirecto } from "@/lib/ugc/uploads";
import styles from "@/styles/qos.module.css";

/**
 * El archivo sube DIRECTO a Supabase Storage desde el navegador y al server
 * action solo le llega la ruta. Antes viajaba dentro del FormData del action y
 * chocaba con el tope de body de ~4.5 MB de Vercel: andaba en local y fallaba
 * en producción. Por eso esto ya no puede ser un `<form action={...}>` con
 * `useActionState` — la subida tiene que pasar antes de llamar al action.
 */
export default function DeliverySubmitForm({
  applicationId,
  onListo,
}: {
  applicationId: string;
  /** Se llama solo cuando la entrega salió bien: la hoja que lo contiene cierra. */
  onListo?: () => void;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [estado, setEstado] = useState<"quieto" | "subiendo" | "guardando">("quieto");
  const [error, setError] = useState<string | null>(null);

  const ocupado = estado !== "quieto";

  async function entregar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (ocupado) return;

    const formData = new FormData(e.currentTarget);
    const externalUrl = String(formData.get("external_url") ?? "").trim();

    if (!file && !externalUrl) {
      setError("Subí un archivo, pegá un link, o ambos.");
      return;
    }

    setError(null);

    try {
      if (file) {
        setEstado("subiendo");
        // La carpeta es el id de la aplicación: es lo que mira la policy de
        // storage, que además exige que la aplicación sea del creador y esté
        // en accepted/delivered.
        const storagePath = await subirArchivoDirecto({
          bucket: DELIVERIES_BUCKET,
          carpeta: applicationId,
          file,
          maxBytes: MAX_DELIVERY_FILE_BYTES,
          extFallback: "mp4",
        });
        formData.set("storage_path", storagePath);
      }

      setEstado("guardando");
      const result = await submitDeliveryAction(null, formData);

      if (result) {
        setError(result.error);
      } else {
        formRef.current?.reset();
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        // El action revalida la ruta, pero acá se lo llama a mano (no por
        // useActionState): el refresh explícito asegura que la pieza recién
        // entregada aparezca en la lista. Que no aparezca haría que el creador
        // la suba de nuevo creyendo que falló.
        router.refresh();
        onListo?.();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo entregar la pieza.");
    } finally {
      setEstado("quieto");
    }
  }

  return (
    <form
      ref={formRef}
      onSubmit={entregar}
      // Sin caja propia: desde el rediseño esto vive dentro de una hoja, que
      // ya pone su fondo y su padding. La caja gris de antes existía porque el
      // formulario colgaba abierto dentro de la tarjeta de la aplicación.
      style={{ display: "flex", flexDirection: "column", gap: "12px" }}
    >
      <p style={{ fontSize: "12.5px", color: "var(--ink-3)" }}>
        Subí el video final y pegá el link del post ya publicado en redes — podés mandar los dos juntos.
      </p>
      <div className={styles.field} style={{ marginBottom: 0 }}>
        <label>Archivo (video final)</label>
        <div className={styles.fileRow}>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnSoft}`}
            onClick={() => fileInputRef.current?.click()}
            disabled={ocupado}
          >
            Elegir archivo
          </button>
          <span className={styles.fileName}>
            {file ? `${file.name} · ${pesoLegible(file.size)}` : "Sin archivo seleccionado"}
          </span>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*,image/*"
            style={{ display: "none" }}
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setError(null);
            }}
          />
        </div>
        <p style={{ fontSize: "11.5px", color: "var(--ink-3)", marginTop: "6px", lineHeight: 1.5 }}>
          Hasta {pesoLegible(MAX_DELIVERY_FILE_BYTES)}. Si el video pesa más, subilo a Drive o
          WeTransfer y pegá el link acá abajo.
        </p>
      </div>
      <div className={styles.field} style={{ marginBottom: 0 }}>
        <label>Link del post publicado (Instagram, TikTok, etc.)</label>
        <input type="url" name="external_url" placeholder="https://..." className={styles.inp} />
      </div>
      <div className={styles.field} style={{ marginBottom: 0 }}>
        <label>Nota (opcional)</label>
        <input type="text" name="note" placeholder="Reel final, versión con subtítulos" className={styles.inp} />
      </div>
      <input type="hidden" name="application_id" value={applicationId} />
      {error && <p style={{ fontSize: "12.5px", color: "var(--risk)" }}>{error}</p>}
      <button
        type="submit"
        disabled={ocupado}
        className={`${styles.btn} ${styles.btnPrimary}`}
        style={{ alignSelf: "flex-start" }}
      >
        {estado === "subiendo" ? "Subiendo…" : estado === "guardando" ? "Entregando…" : "Entregar pieza"}
      </button>
    </form>
  );
}
