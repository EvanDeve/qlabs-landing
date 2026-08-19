"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { updateBrandProfileAction, type UpdateBrandProfileState } from "@/lib/actions/brand-profile";
import { useToast } from "@/components/ugc/Toaster";
import ImageCropModal from "@/components/ugc/ImageCropModal";
import BrandAvatar from "@/components/ugc/BrandAvatar";
import styles from "@/styles/qos.module.css";

type BrandProfile = {
  brand_name: string;
  industry: string | null;
  website: string | null;
  instagram_handle: string | null;
  description: string | null;
  location: string | null;
  logo_url: string | null;
};

export default function BrandProfileEditForm({ initial }: { initial: BrandProfile }) {
  const [state, formAction, pending] = useActionState<UpdateBrandProfileState, FormData>(
    updateBrandProfileAction,
    null
  );

  const toast = useToast();

  // Guardar y que no pase nada visible era la queja: el perfil se actualizaba
  // pero la pantalla se quedaba igual.
  useEffect(() => {
    if (state && "ok" in state) toast("Perfil guardado.");
  }, [state, toast]);

  // Estado espejado solo para la vista previa en vivo.
  const [logoPreview, setLogoPreview] = useState<string | null>(initial.logo_url);
  const [name, setName] = useState(initial.brand_name);
  const [industry, setIndustry] = useState(initial.industry ?? "");
  const [location, setLocation] = useState(initial.location ?? "");
  const [description, setDescription] = useState(initial.description ?? "");
  const [cropping, setCropping] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const applyCrop = (cropped: File) => {
    const dt = new DataTransfer();
    dt.items.add(cropped);
    if (fileRef.current) fileRef.current.files = dt.files;
    setLogoPreview(URL.createObjectURL(cropped));
    setCropping(null);
  };

  const cancelCrop = () => {
    if (fileRef.current) fileRef.current.value = "";
    setCropping(null);
  };

  return (
    <form action={formAction} className={styles.brandProfileGrid}>
      {cropping && (
        <ImageCropModal
          file={cropping}
          onCancel={cancelCrop}
          onConfirm={applyCrop}
          title="Ajustá tu logo"
          hint="Se muestra cuadrado en el feed de los creadores."
          confirmLabel="Usar este logo"
          shape="square"
        />
      )}

      <div className={`${styles.card} ${styles.cardPad}`}>
        <div className={styles.logoRow}>
          <BrandAvatar name={name} logoUrl={logoPreview} size={72} radius={16} />
          <div>
            <input
              ref={fileRef}
              type="file"
              name="logo"
              accept="image/*"
              className={styles.hiddenFile}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) setCropping(file);
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className={`${styles.btn} ${styles.btnSoft}`}
            >
              {logoPreview ? "Cambiar logo" : "Subir logo"}
            </button>
            <p className={styles.fieldHint}>JPG o PNG, hasta 5 MB. Cuadrado se ve mejor.</p>
          </div>
        </div>

        <div className={styles.field}>
          <label htmlFor="brand_name">Nombre del negocio</label>
          <input
            id="brand_name"
            name="brand_name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className={styles.inp}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="industry">Industria</label>
          <input
            id="industry"
            name="industry"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            placeholder="Restaurante, hotel, soda…"
            className={styles.inp}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="location">Zona</label>
          <input
            id="location"
            name="location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="La Fortuna, San Carlos"
            className={styles.inp}
          />
          <p className={styles.fieldHint}>
            Dónde tenés que grabar. Es lo primero que mira un creador para saber si puede llegar.
          </p>
        </div>
        <div className={styles.field}>
          <label htmlFor="website">Sitio web</label>
          {/* type="text" y no "url" a propósito. Con type="url", un sitio
              guardado sin esquema —"negocio.cr", que es como lo escribe
              cualquiera— dejaba el formulario ENTERO inválido: el navegador
              bloqueaba el envío sin mostrar nada y "Guardar cambios" no hacía
              absolutamente nada, para siempre. El esquema lo pone el servidor
              con normalizarUrl(). */}
          <input
            id="website"
            name="website"
            type="text"
            inputMode="url"
            defaultValue={initial.website ?? ""}
            placeholder="cafeteriaelroble.cr"
            className={styles.inp}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="instagram_handle">Instagram</label>
          <input
            id="instagram_handle"
            name="instagram_handle"
            defaultValue={initial.instagram_handle ?? ""}
            placeholder="@tu_negocio"
            className={styles.inp}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="description">Descripción</label>
          <textarea
            id="description"
            name="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="Contá qué es tu negocio y qué lo hace distinto."
            className={styles.inp}
          />
        </div>

        {state && "error" in state && <div className={styles.formError}>{state.error}</div>}

        <button type="submit" disabled={pending} className={`${styles.btn} ${styles.btnPrimary}`}>
          {pending ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>

      {/* Vista previa: lo que el subtítulo de la página venía prometiendo. */}
      <aside className={styles.brandPreviewCol}>
        <p className={styles.previewLabel}>Vista previa — así te ve un creador</p>
        <div className={styles.card}>
          <div className={styles.brandPreviewHead}>
            <BrandAvatar name={name} logoUrl={logoPreview} size={44} radius={12} />
            <div style={{ minWidth: 0 }}>
              <b className={styles.brandPreviewName}>{name || "Tu negocio"}</b>
              <div className={styles.brandPreviewMeta}>
                {[industry, location].filter(Boolean).join(" · ") || "Industria · Zona"}
              </div>
            </div>
          </div>
          {description && <p className={styles.brandPreviewDesc}>{description}</p>}
        </div>
      </aside>
    </form>
  );
}
