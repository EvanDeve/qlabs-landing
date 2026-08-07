"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { crearCuponAction, editarCuponAction } from "@/lib/actions/cupones";
import { COUPON_IMAGE_BUCKET, MAX_COUPON_IMAGE_BYTES } from "@/lib/ugc/coupon-images";
import { subirArchivoDirecto, pesoLegible } from "@/lib/ugc/uploads";
import { createClient } from "@/lib/supabase/client";
import { LEYENDA_EVENTO, LABEL_TIPO_CUPON } from "@/lib/ugc/loyalty";
import styles from "@/app/ugc/(dashboard)/admin/qos.module.css";

export type CuponEditable = {
  id: string;
  title: string;
  description: string;
  type: string;
  minLevel: number;
  stockTotal: number;
  claimValidityDays: number | null;
  /** YYYY-MM-DD, listo para un <input type="date">. */
  eventDateInput: string | null;
  eventLocation: string | null;
  conditions: string | null;
  imageUrl: string | null;
};

/**
 * El mismo formulario crea y edita. Mantenerlos separados llevaba a que un
 * campo agregado en uno se olvidara en el otro — que es exactamente cómo
 * terminan los formularios de edición mostrando menos cosas que los de alta.
 *
 * La imagen sube DIRECTO del navegador a Storage y al Server Action solo le
 * llega la URL: un archivo dentro del FormData choca con el tope de ~4.5 MB de
 * Vercel, que no se nota en local y falla en producción.
 */
// Sin prop `verificada`: al panel de la marca solo entra un negocio verificado,
// así que publicar un cupón siempre está disponible.
export default function CuponForm({
  cupon,
  niveles,
  onListo,
}: {
  cupon?: CuponEditable;
  niveles: { level: number; name: string }[];
  onListo?: () => void;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const editando = Boolean(cupon);
  const [tipo, setTipo] = useState(cupon?.type ?? "producto");
  const [imagen, setImagen] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(cupon?.imageUrl ?? null);
  const [quitarImagen, setQuitarImagen] = useState(false);
  const [estado, setEstado] = useState<"quieto" | "subiendo" | "guardando">("quieto");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const ocupado = estado !== "quieto";

  function elegirImagen(file: File | null) {
    setError(null);
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("El archivo tiene que ser una imagen.");
      return;
    }
    if (file.size > MAX_COUPON_IMAGE_BYTES) {
      setError(`La imagen pesa ${pesoLegible(file.size)} y el máximo es ${pesoLegible(MAX_COUPON_IMAGE_BYTES)}.`);
      return;
    }
    setImagen(file);
    setPreview(URL.createObjectURL(file));
    setQuitarImagen(false);
  }

  async function enviar(e: React.FormEvent<HTMLFormElement>, publicar: boolean) {
    e.preventDefault();
    if (ocupado) return;

    const formData = new FormData(formRef.current!);
    setError(null);
    setOk(null);

    try {
      if (imagen) {
        setEstado("subiendo");
        const ruta = await subirArchivoDirecto({
          bucket: COUPON_IMAGE_BUCKET,
          file: imagen,
          maxBytes: MAX_COUPON_IMAGE_BYTES,
          extFallback: "jpg",
        });
        // Bucket público: la URL se arma una vez y se guarda, igual que el
        // logo de la marca. Nadie necesita firmar nada para verla.
        const { data } = createClient().storage.from(COUPON_IMAGE_BUCKET).getPublicUrl(ruta);
        formData.set("image_url", data.publicUrl);
      }

      if (quitarImagen) formData.set("quitar_imagen", "1");
      if (publicar) formData.set("publicar", "1");

      setEstado("guardando");
      const resultado = editando
        ? await editarCuponAction(null, formData)
        : await crearCuponAction(null, formData);

      if (resultado && "error" in resultado) {
        setError(resultado.error);
        return;
      }

      setOk(resultado && "ok" in resultado ? resultado.ok : "Guardado.");
      if (!editando) {
        formRef.current?.reset();
        setImagen(null);
        setPreview(null);
        setTipo("producto");
        if (fileRef.current) fileRef.current.value = "";
      }
      router.refresh();
      onListo?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar el cupón.");
    } finally {
      setEstado("quieto");
    }
  }

  return (
    <form ref={formRef} onSubmit={(e) => enviar(e, false)}>
      {cupon && <input type="hidden" name="coupon_id" value={cupon.id} />}

      <div className={styles.field}>
        <label htmlFor="title">Título del cupón</label>
        <input
          id="title"
          name="title"
          required
          defaultValue={cupon?.title ?? ""}
          placeholder="Ej: 2x1 en cócteles de autor"
          className={styles.inp}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
        <div className={styles.field}>
          <label htmlFor="type">Tipo</label>
          {editando ? (
            <>
              <input className={styles.inp} value={LABEL_TIPO_CUPON[tipo] ?? tipo} disabled readOnly />
              <p className={styles.fieldHint}>
                El tipo no se cambia después de crear el cupón: cambiaría el plazo de los códigos ya
                emitidos. Si hace falta, pausá este y creá otro.
              </p>
            </>
          ) : (
            <select
              id="type"
              name="type"
              className={styles.selectInp}
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
            >
              <option value="producto">Producto</option>
              <option value="servicio">Servicio</option>
              <option value="evento">Evento</option>
            </select>
          )}
        </div>

        <div className={styles.field}>
          <label htmlFor="min_level">¿Quién puede reclamarlo?</label>
          <select
            id="min_level"
            name="min_level"
            className={styles.selectInp}
            defaultValue={cupon?.minLevel ?? 1}
          >
            {niveles.map((n) => (
              <option key={n.level} value={n.level}>
                {n.level === 1 ? "Todos los creadores" : `Nivel mínimo: ${n.name}`}
              </option>
            ))}
          </select>
          <p className={styles.fieldHint}>
            Los niveles altos reflejan entregas aprobadas y ratings reales.
          </p>
        </div>
      </div>

      <div className={styles.field}>
        <label htmlFor="description">Descripción — qué incluye exactamente</label>
        <textarea
          id="description"
          name="description"
          required
          rows={3}
          defaultValue={cupon?.description ?? ""}
          placeholder="Contale al creador qué recibe al canjear este cupón"
          className={styles.inp}
          style={{ resize: "vertical" }}
        />
      </div>

      {/* ── Imagen ── */}
      <div className={styles.field}>
        <label>Foto del cupón (opcional)</label>
        <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
          {preview && !quitarImagen ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt="Vista previa del cupón"
              style={{
                width: "132px",
                height: "88px",
                objectFit: "cover",
                borderRadius: "10px",
                border: "1px solid var(--line)",
              }}
            />
          ) : (
            <div
              style={{
                width: "132px",
                height: "88px",
                borderRadius: "10px",
                border: "1px dashed var(--line)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "11.5px",
                color: "var(--ink-3)",
                textAlign: "center",
                padding: "8px",
              }}
            >
              Sin foto
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={(e) => elegirImagen(e.target.files?.[0] ?? null)}
              style={{ fontSize: "12.5px" }}
            />
            <span style={{ fontSize: "11.5px", color: "var(--ink-3)" }}>
              JPG o PNG, hasta {pesoLegible(MAX_COUPON_IMAGE_BYTES)}. Se recorta apaisada en la
              tarjeta del creador.
            </span>
            {preview && !quitarImagen && editando && (
              <button
                type="button"
                onClick={() => {
                  setQuitarImagen(true);
                  setImagen(null);
                  if (fileRef.current) fileRef.current.value = "";
                }}
                className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}
                style={{ alignSelf: "flex-start" }}
              >
                Quitar foto
              </button>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
        <div className={styles.field}>
          <label htmlFor="stock_total">Stock (canjes disponibles)</label>
          <input
            id="stock_total"
            name="stock_total"
            type="number"
            min={1}
            required
            defaultValue={cupon?.stockTotal ?? 20}
            className={styles.inp}
          />
          {editando && (
            <p className={styles.fieldHint}>No puede bajar de lo que ya se reclamó.</p>
          )}
        </div>

        {tipo !== "evento" && (
          <div className={styles.field}>
            <label htmlFor="claim_validity_days">Vigencia del reclamo</label>
            <select
              id="claim_validity_days"
              name="claim_validity_days"
              className={styles.selectInp}
              defaultValue={cupon?.claimValidityDays ?? 14}
            >
              <option value={7}>7 días desde el reclamo</option>
              <option value={14}>14 días desde el reclamo</option>
              <option value={30}>30 días desde el reclamo</option>
            </select>
            <p className={styles.fieldHint}>
              Si vence sin usarse, el código expira y el stock se libera.
            </p>
          </div>
        )}
      </div>

      {tipo === "evento" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
            <div className={styles.field}>
              <label htmlFor="event_date">Fecha del evento</label>
              <input
                id="event_date"
                name="event_date"
                type="date"
                required={!editando}
                defaultValue={cupon?.eventDateInput ?? ""}
                className={styles.inp}
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="event_location">Ubicación</label>
              <input
                id="event_location"
                name="event_location"
                defaultValue={cupon?.eventLocation ?? ""}
                placeholder="Ej: Local principal, Escazú"
                className={styles.inp}
              />
            </div>
          </div>
          <div
            style={{
              fontSize: "12px",
              lineHeight: 1.5,
              padding: "10px 12px",
              borderRadius: "10px",
              background: "var(--warn-bg)",
              color: "var(--warn)",
              marginBottom: "14px",
            }}
          >
            🎟️ <b>Leyenda automática en la ficha:</b> &quot;{LEYENDA_EVENTO}&quot; — no es editable.
            El QR vale hasta la fecha del evento, no por días desde el reclamo.
          </div>
        </>
      )}

      <div className={styles.field}>
        <label htmlFor="conditions">Condiciones adicionales (opcional)</label>
        <input
          id="conditions"
          name="conditions"
          defaultValue={cupon?.conditions ?? ""}
          placeholder="Ej: válido solo de lunes a jueves"
          className={styles.inp}
        />
      </div>

      {error && <p style={{ fontSize: "13px", color: "var(--risk)", marginBottom: "12px" }}>{error}</p>}
      {ok && <p style={{ fontSize: "13px", color: "var(--ok)", marginBottom: "12px" }}>{ok}</p>}

      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
        {editando ? (
          <button type="submit" disabled={ocupado} className={`${styles.btn} ${styles.btnPrimary}`}>
            {estado === "subiendo" ? "Subiendo foto…" : estado === "guardando" ? "Guardando…" : "Guardar cambios"}
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={(e) => enviar(e as unknown as React.FormEvent<HTMLFormElement>, true)}
              disabled={ocupado}
              className={`${styles.btn} ${styles.btnPrimary}`}
            >
              {estado === "subiendo" ? "Subiendo foto…" : estado === "guardando" ? "Guardando…" : "Publicar cupón"}
            </button>
            <button type="submit" disabled={ocupado} className={`${styles.btn} ${styles.btnGhost}`}>
              Guardar borrador
            </button>
          </>
        )}
        {onListo && (
          <button type="button" onClick={onListo} className={`${styles.btn} ${styles.btnGhost}`}>
            Cancelar
          </button>
        )}
      </div>

      {!editando && (
        <p style={{ marginTop: "12px", fontSize: "12px", color: "var(--ink-3)" }}>
          Tus cupones se publican al instante. Un canje por creador por cupón.
        </p>
      )}
    </form>
  );
}
