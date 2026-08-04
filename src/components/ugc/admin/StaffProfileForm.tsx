"use client";

import { useActionState, useRef, useState } from "react";
import ImageCropModal from "@/components/ugc/ImageCropModal";
import { updateStaffProfileAction, type StaffProfileState } from "@/lib/actions/staff-profile";
import styles from "@/app/ugc/(dashboard)/admin/qos.module.css";

/**
 * Nombre y foto propios. Es la única pantalla de Q·OS que una persona edita
 * sobre sí misma: el rol, el color y el WhatsApp los maneja un director desde
 * Equipo.
 */
export default function StaffProfileForm({
  displayName,
  avatarUrl,
  color,
  role,
}: {
  displayName: string;
  avatarUrl: string | null;
  /** El color asignado en staff_members: es el fondo cuando no hay foto. */
  color: string;
  role: string;
}) {
  const [state, formAction, pending] = useActionState<StaffProfileState, FormData>(
    updateStaffProfileAction,
    null
  );
  const [preview, setPreview] = useState<string | null>(avatarUrl);
  const [nombre, setNombre] = useState(displayName);
  const fileRef = useRef<HTMLInputElement>(null);
  // Archivo recién elegido, esperando que se ajuste el encuadre.
  const [cropping, setCropping] = useState<File | null>(null);

  const inicial = nombre.trim().charAt(0).toUpperCase() || "?";

  const applyCrop = (cropped: File) => {
    // El <input type="file"> viaja con el form, así que hay que sustituir su
    // FileList por el recorte: guardarlo en el estado no alcanza.
    const dt = new DataTransfer();
    dt.items.add(cropped);
    if (fileRef.current) fileRef.current.files = dt.files;
    setPreview(URL.createObjectURL(cropped));
    setCropping(null);
  };

  const cancelCrop = () => {
    // Se limpia el input o quedaría el original sin recortar listo para subir.
    if (fileRef.current) fileRef.current.value = "";
    setCropping(null);
  };

  return (
    <form action={formAction} className={`${styles.card} ${styles.cardPad}`} style={{ maxWidth: "520px" }}>
      {cropping && <ImageCropModal file={cropping} onCancel={cancelCrop} onConfirm={applyCrop} />}

      <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "22px" }}>
        <span
          style={{
            width: "72px",
            height: "72px",
            borderRadius: "50%",
            background: color,
            display: "grid",
            placeItems: "center",
            overflow: "hidden",
            color: "#fff",
            fontWeight: 800,
            fontSize: "26px",
            flexShrink: 0,
          }}
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            inicial
          )}
        </span>

        <div>
          <input
            ref={fileRef}
            type="file"
            name="avatar"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              // No se sube lo elegido tal cual: primero se ajusta el encuadre y
              // lo que viaja al servidor es el recorte de 512×512.
              if (file) setCropping(file);
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className={`${styles.btn} ${styles.btnGhost}`}
          >
            {preview ? "Cambiar foto" : "Subir foto"}
          </button>
          <p style={{ fontSize: "12px", color: "var(--ink-3)", marginTop: "6px" }}>
            JPG o PNG. Se recorta cuadrada antes de subirse.
          </p>
        </div>
      </div>

      <div className={styles.field}>
        <label htmlFor="display_name">Nombre</label>
        <input
          id="display_name"
          name="display_name"
          required
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          className={styles.inp}
        />
        <p style={{ fontSize: "12px", color: "var(--ink-3)", marginTop: "4px" }}>
          Es el que ve el resto del equipo en el Pipeline y el Calendario.
        </p>
      </div>

      <div className={styles.field}>
        <label>Rol</label>
        {/* Solo informativo: el rol y el color los asigna un director desde
            Equipo, porque definen permisos y no son una preferencia personal. */}
        <p style={{ fontSize: "13px", color: "var(--ink-2)" }}>
          {role} · lo cambia un director desde Equipo.
        </p>
      </div>

      {state && "error" in state && (
        <p style={{ color: "var(--risk)", fontSize: "13px", marginBottom: "12px" }}>{state.error}</p>
      )}
      {state && "ok" in state && (
        <p style={{ color: "var(--ok)", fontSize: "13px", marginBottom: "12px" }}>Listo, se guardó.</p>
      )}

      <button type="submit" disabled={pending} className={`${styles.btn} ${styles.btnPrimary}`}>
        {pending ? "Guardando..." : "Guardar"}
      </button>
    </form>
  );
}
