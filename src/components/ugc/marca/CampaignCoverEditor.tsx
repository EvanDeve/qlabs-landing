"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import BrandAvatar, { brandGradient } from "@/components/ugc/BrandAvatar";
import { createClient } from "@/lib/supabase/client";
import { updateCampaignCoverAction } from "@/lib/actions/campaigns";
import { CAMPAIGN_COVER_BUCKET, MAX_CAMPAIGN_COVER_BYTES } from "@/lib/ugc/campaign-covers";
import { subirArchivoDirecto, pesoLegible } from "@/lib/ugc/uploads";
import styles from "@/styles/qos.module.css";

/**
 * Cambiar la portada de una campaña ya creada.
 *
 * Vive acá y no en el formulario porque las campañas no tienen pantalla de
 * edición: sin esto, la portada sería un privilegio de las campañas nuevas y
 * las que ya están publicadas —que son las que el creador está viendo hoy—
 * quedarían para siempre con el degradado.
 *
 * Muestra la portada con la misma proporción que la tarjeta del feed (5:2):
 * así se ve acá mismo si la foto se recorta mal, sin tener que entrar como
 * creador a mirar.
 */
export default function CampaignCoverEditor({
  campaignId,
  coverUrl,
  brandName,
  brandLogoUrl,
}: {
  campaignId: string;
  coverUrl: string | null;
  brandName: string;
  brandLogoUrl: string | null;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(coverUrl);
  const [error, setError] = useState<string | null>(null);
  const [estado, setEstado] = useState<"quieto" | "subiendo" | "guardando">("quieto");
  const [, startTransition] = useTransition();

  const ocupado = estado !== "quieto";

  function elegir(file: File | null) {
    setError(null);
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("La portada tiene que ser una imagen.");
      return;
    }
    if (file.size > MAX_CAMPAIGN_COVER_BYTES) {
      setError(`La portada pesa ${pesoLegible(file.size)} y el máximo es ${pesoLegible(MAX_CAMPAIGN_COVER_BYTES)}.`);
      return;
    }

    // Se ve al instante y se sube en el mismo gesto: un botón "Guardar" aparte
    // para un solo campo es un paso de más.
    const local = URL.createObjectURL(file);
    setPreview(local);

    startTransition(async () => {
      try {
        setEstado("subiendo");
        const ruta = await subirArchivoDirecto({
          bucket: CAMPAIGN_COVER_BUCKET,
          file,
          maxBytes: MAX_CAMPAIGN_COVER_BYTES,
          extFallback: "jpg",
        });
        const { data } = createClient().storage.from(CAMPAIGN_COVER_BUCKET).getPublicUrl(ruta);

        setEstado("guardando");
        const formData = new FormData();
        formData.set("campaign_id", campaignId);
        formData.set("cover_url", data.publicUrl);
        const resultado = await updateCampaignCoverAction(formData);
        if (resultado && "error" in resultado) {
          setError(resultado.error);
          setPreview(coverUrl);
          return;
        }
        setPreview(data.publicUrl);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo subir la portada.");
        setPreview(coverUrl);
      } finally {
        setEstado("quieto");
        if (fileRef.current) fileRef.current.value = "";
      }
    });
  }

  function quitar() {
    setError(null);
    startTransition(async () => {
      setEstado("guardando");
      const formData = new FormData();
      formData.set("campaign_id", campaignId);
      formData.set("quitar_portada", "1");
      const resultado = await updateCampaignCoverAction(formData);
      setEstado("quieto");
      if (resultado && "error" in resultado) {
        setError(resultado.error);
        return;
      }
      setPreview(null);
      router.refresh();
    });
  }

  return (
    <div style={{ marginTop: "18px", paddingTop: "16px", borderTop: "1px solid var(--line)" }}>
      <div style={{ fontSize: "13px", fontWeight: 700, marginBottom: "10px" }}>Portada en el feed</div>

      <div style={{ display: "flex", gap: "14px", flexWrap: "wrap", alignItems: "flex-start" }}>
        <div
          style={{
            position: "relative",
            width: "220px",
            aspectRatio: "5 / 2",
            borderRadius: "14px",
            overflow: "hidden",
            flexShrink: 0,
            background: preview ? "var(--surface-3)" : brandGradient(brandName),
            display: "grid",
            placeItems: "center",
            opacity: ocupado ? 0.6 : 1,
            transition: "opacity 140ms",
          }}
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt=""
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <BrandAvatar
              name={brandName}
              logoUrl={brandLogoUrl}
              size={44}
              radius={12}
              color={brandLogoUrl ? null : "rgba(255,255,255,0.24)"}
            />
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px", minWidth: "220px", flex: 1 }}>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            disabled={ocupado}
            onChange={(e) => elegir(e.target.files?.[0] ?? null)}
            style={{ fontSize: "12.5px" }}
          />
          <span style={{ fontSize: "11.5px", color: "var(--ink-3)" }}>
            {estado === "subiendo"
              ? "Subiendo…"
              : estado === "guardando"
                ? "Guardando…"
                : `JPG o PNG, hasta ${pesoLegible(MAX_CAMPAIGN_COVER_BYTES)}. Es lo primero que ve el creador en el feed; se recorta apaisada. Sin portada, la tarjeta usa tu logo.`}
          </span>
          {preview && !ocupado && (
            <button
              type="button"
              onClick={quitar}
              className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}
              style={{ alignSelf: "flex-start" }}
            >
              Quitar portada
            </button>
          )}
          {error && <p className={styles.formError}>{error}</p>}
        </div>
      </div>
    </div>
  );
}
