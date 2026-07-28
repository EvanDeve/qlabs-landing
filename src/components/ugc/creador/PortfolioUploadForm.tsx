"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { uploadPortfolioItemAction } from "@/lib/actions/portfolio";
import {
  PORTFOLIO_BUCKET,
  PORTFOLIO_CATEGORIES,
  PORTFOLIO_CATEGORY_LABEL,
  MAX_PORTFOLIO_FILE_BYTES,
} from "@/lib/ugc/portfolio";
import { pesoLegible, subirArchivoDirecto } from "@/lib/ugc/uploads";
import styles from "@/app/ugc/(dashboard)/admin/qos.module.css";

/**
 * El archivo sube DIRECTO a Supabase Storage desde el navegador y al server
 * action solo le llega la ruta. Antes viajaba dentro del FormData del action y
 * chocaba con el tope de body de ~4.5 MB de Vercel: andaba en local y fallaba
 * en producción.
 */
export default function PortfolioUploadForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [estado, setEstado] = useState<"quieto" | "subiendo" | "guardando">("quieto");
  const [error, setError] = useState<string | null>(null);

  const ocupado = estado !== "quieto";

  async function subir(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (ocupado) return;

    if (!file) {
      setError("Elegí un archivo para subir.");
      return;
    }

    const mediaType = file.type.startsWith("video/")
      ? "video"
      : file.type.startsWith("image/")
        ? "image"
        : null;

    if (!mediaType) {
      setError("Solo se aceptan imágenes o videos.");
      return;
    }

    const formData = new FormData(e.currentTarget);
    setError(null);

    try {
      setEstado("subiendo");
      // Sin `carpeta`: el helper usa el uuid del creador, que es lo que exige
      // la policy del bucket `portfolio`.
      const storagePath = await subirArchivoDirecto({
        bucket: PORTFOLIO_BUCKET,
        file,
        maxBytes: MAX_PORTFOLIO_FILE_BYTES,
        extFallback: mediaType === "video" ? "mp4" : "jpg",
      });

      formData.set("storage_path", storagePath);
      formData.set("media_type", mediaType);

      setEstado("guardando");
      const result = await uploadPortfolioItemAction(null, formData);

      if (result) {
        setError(result.error);
      } else {
        formRef.current?.reset();
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        // Ver la nota del mismo bloque en DeliverySubmitForm: el action ya no
        // se llama por useActionState, así que el refresh va explícito.
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo subir la pieza.");
    } finally {
      setEstado("quieto");
    }
  }

  return (
    <form ref={formRef} onSubmit={subir} className={`${styles.card} ${styles.cardPad}`}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: "14px" }}>
        <div className={styles.field} style={{ marginBottom: 0 }}>
          <label>Archivo</label>
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
              accept="image/*,video/*"
              style={{ display: "none" }}
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setError(null);
              }}
            />
          </div>
        </div>
        <div className={styles.field} style={{ marginBottom: 0 }}>
          <label>Categoría</label>
          <select name="category" defaultValue={PORTFOLIO_CATEGORIES[0]} className={styles.inp}>
            {PORTFOLIO_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {PORTFOLIO_CATEGORY_LABEL[category]}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.field} style={{ marginBottom: 0, minWidth: "180px" }}>
          <label>Descripción (opcional)</label>
          <input type="text" name="caption" placeholder="Reel · Zonna" className={styles.inp} />
        </div>
        <div className={styles.field} style={{ marginBottom: 0, width: "130px" }}>
          <label>Views (opcional)</label>
          <input type="number" name="views" min={0} placeholder="82000" className={styles.inp} />
        </div>
        <button type="submit" disabled={ocupado} className={`${styles.btn} ${styles.btnPrimary}`}>
          {estado === "subiendo" ? "Subiendo…" : estado === "guardando" ? "Guardando…" : "Subir"}
        </button>
      </div>
      <p style={{ marginTop: "10px", fontSize: "11.5px", color: "var(--ink-3)" }}>
        Hasta {pesoLegible(MAX_PORTFOLIO_FILE_BYTES)} por pieza.
      </p>
      {error && (
        <p style={{ marginTop: "12px", fontSize: "13px", color: "var(--risk)" }}>{error}</p>
      )}
    </form>
  );
}
