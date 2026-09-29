"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { crearCuponAction, editarCuponAction } from "@/lib/actions/cupones";
import { COUPON_IMAGE_BUCKET, MAX_COUPON_IMAGE_BYTES } from "@/lib/ugc/coupon-images";
import { subirArchivoDirecto, pesoLegible } from "@/lib/ugc/uploads";
import { createClient } from "@/lib/supabase/client";
import { LEYENDA_EVENTO, LABEL_TIPO_CUPON } from "@/lib/ugc/loyalty";
import { QosIcon } from "@/lib/ugc/qos-icons";
import { useToast } from "@/components/ugc/Toaster";
import { CF } from "@/lib/cf/copy";
import type { CouponAudience, CouponMemberScope } from "@/lib/database.types";
import styles from "@/styles/qos.module.css";

const AUDIENCIAS: { valor: CouponAudience; label: string }[] = [
  { valor: "creators", label: "Creadores" },
  { valor: "members", label: "Clientes" },
  { valor: "both", label: "Ambos" },
];

const PARA_QUIEN: Record<CouponAudience, string> = {
  creators: "Creadores",
  members: "Clientes",
  both: "Creadores y clientes",
};

const VIGENCIAS = [7, 14, 30];

export type CuponEditable = {
  id: string;
  title: string;
  description: string;
  type: string;
  minLevel: number;
  stockTotal: number;
  /** Lo ya reclamado: el piso del stock. */
  reclamados: number;
  claimValidityDays: number | null;
  /** YYYY-MM-DD, listo para un <input type="date">. */
  eventDateInput: string | null;
  eventLocation: string | null;
  conditions: string | null;
  imageUrl: string | null;
  audience: CouponAudience;
  memberScope: CouponMemberScope;
};

function ayudaAudiencia(a: CouponAudience) {
  if (a === "creators") return "Lo ven los creadores de UGC·CRC en Recompensas.";
  if (a === "members") return `Al guardar, el cupón genera su QR para ${CF.programa}.`;
  return `Lo ven los creadores en Recompensas y, al guardar, genera su QR para ${CF.programa}.`;
}

/**
 * El mismo formulario crea y edita. Mantenerlos separados llevaba a que un
 * campo agregado en uno se olvidara en el otro — que es exactamente cómo
 * terminan los formularios de edición mostrando menos cosas que los de alta.
 *
 * Lo que cambia es el envoltorio (mockups 4b–4d de 2026-09-29): el alta es una
 * pantalla con la foto primero y el botón fijo abajo; editar es una hoja con
 * Guardar arriba, y lo que ya no se puede tocar se ve bloqueado en vez de
 * desaparecer.
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
  onCerrar,
}: {
  cupon?: CuponEditable;
  niveles: { level: number; name: string }[];
  /** Solo en la edición: cierra la hoja. */
  onCerrar?: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const editando = Boolean(cupon);
  const pisoStock = Math.max(1, cupon?.reclamados ?? 0);
  const [tipo, setTipo] = useState(cupon?.type ?? "producto");
  const [audiencia, setAudiencia] = useState<CouponAudience>(cupon?.audience ?? "creators");
  const [stock, setStock] = useState(String(cupon?.stockTotal ?? 20));
  const [imagen, setImagen] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(cupon?.imageUrl ?? null);
  const [quitarImagen, setQuitarImagen] = useState(false);
  const [estado, setEstado] = useState<"quieto" | "subiendo" | "guardando">("quieto");
  const [error, setError] = useState<string | null>(null);

  const ocupado = estado !== "quieto";
  const stockNum = Number(stock) || 0;
  const conFoto = Boolean(preview) && !quitarImagen;

  // Una vigencia que no es 7, 14 ni 30 (un cupón viejo, o puesto desde admin)
  // entra como opción propia: con un <select> que no la tuviera, abrir la
  // edición y guardar sin tocar nada la cambiaría a 7 sin que nadie lo pidiera.
  const vigencias =
    cupon?.claimValidityDays && !VIGENCIAS.includes(cupon.claimValidityDays)
      ? [...VIGENCIAS, cupon.claimValidityDays].sort((a, b) => a - b)
      : VIGENCIAS;

  // La hoja de edición: Escape cierra y la página de atrás no scrollea. Es lo
  // mismo que hace `Hoja` del creador, que acá no sirve tal cual porque su
  // encabezado es una X y el del mockup es Cancelar · título · Guardar.
  useEffect(() => {
    if (!editando || !onCerrar) return;
    const cerrar = onCerrar;
    function alTeclado(e: KeyboardEvent) {
      if (e.key === "Escape") cerrar();
    }
    document.addEventListener("keydown", alTeclado);
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", alTeclado);
      document.body.style.overflow = overflowPrevio;
    };
  }, [editando, onCerrar]);

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

  function quitarFoto() {
    setImagen(null);
    setPreview(null);
    if (editando) setQuitarImagen(true);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function enviar(publicar: boolean) {
    if (ocupado) return;
    const form = formRef.current!;
    // `requestSubmit` no pasa por acá cuando el botón es type=button, así que
    // los `required` se chequean a mano: si no, "Publicar" mandaba un cupón
    // sin título y el error llegaba del servidor.
    if (!form.reportValidity()) return;

    const formData = new FormData(form);
    setError(null);

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
      const resultado = editando ? await editarCuponAction(null, formData) : await crearCuponAction(null, formData);

      if (resultado && "error" in resultado) {
        setError(resultado.error);
        return;
      }

      // El aviso sobrevive a la navegación: el Toaster vive en el layout.
      toast(resultado && "ok" in resultado ? resultado.ok : "Guardado.");
      if (editando) {
        router.refresh();
        onCerrar?.();
      } else {
        router.push("/ugc/marca/loyalty");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar el cupón.");
    } finally {
      setEstado("quieto");
    }
  }

  const inputFoto = (
    <input
      ref={fileRef}
      type="file"
      accept="image/*"
      hidden
      onChange={(e) => elegirImagen(e.target.files?.[0] ?? null)}
    />
  );

  const campos = (
    <>
      {cupon && <input type="hidden" name="coupon_id" value={cupon.id} />}
      {/* `member_scope` quedó sin uso (20260924180000): un cliente consigue el
          cupón solo escaneando su QR. Va igual porque la columna es NOT NULL. */}
      <input type="hidden" name="member_scope" value={cupon?.memberScope ?? "brand_members"} />
      <input type="hidden" name="audience" value={audiencia} />
      {inputFoto}

      {/* ── La foto ── En el alta va primero y grande; en la edición es la
          miniatura de la tarjeta de arriba. */}
      {editando ? (
        <div className={styles.lmResumen}>
          {conFoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview!} alt="" className={styles.lmThumb} />
          ) : (
            <span className={styles.lmThumb}>
              <QosIcon name="image" size={22} />
            </span>
          )}
          <div className={styles.lmCuponTxt}>
            <div className={styles.lmCuponTit}>{cupon!.title}</div>
            <div className={styles.lmCuponMeta}>
              {PARA_QUIEN[cupon!.audience]} · {cupon!.reclamados}{" "}
              {cupon!.reclamados === 1 ? "reclamado" : "reclamados"}
            </div>
          </div>
          <div className={styles.lmResumenAcc}>
            <button type="button" className={styles.lmLinkBtn} onClick={() => fileRef.current?.click()}>
              {conFoto ? "Cambiar foto" : "Agregar foto"}
            </button>
            {conFoto && (
              <button type="button" className={`${styles.lmLinkBtn} ${styles.lmLinkQuieto}`} onClick={quitarFoto}>
                Quitar
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          {conFoto ? (
            <div className={styles.lmFotoPrev}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview!} alt="Vista previa del cupón" />
              <div className={styles.lmFotoAcciones}>
                <button type="button" className={styles.lmFotoCambiar} onClick={quitarFoto}>
                  Quitar
                </button>
                <button type="button" className={styles.lmFotoCambiar} onClick={() => fileRef.current?.click()}>
                  Cambiar
                </button>
              </div>
            </div>
          ) : (
            <div className={styles.lmFoto}>
              <span className={styles.lmFotoIc}>
                <QosIcon name="camera" size={22} />
              </span>
              <button type="button" className={styles.lmFotoBtn} onClick={() => fileRef.current?.click()}>
                Agregar foto
              </button>
            </div>
          )}
          <p className={styles.lmAyuda}>
            Opcional · JPG o PNG hasta {pesoLegible(MAX_COUPON_IMAGE_BYTES)}. Se muestra apaisada en la tarjeta.
          </p>
        </>
      )}

      <p className={styles.mcFormSec} style={{ marginTop: 22 }}>
        Qué es
      </p>
      <div className={styles.mcInset}>
        <div className={styles.mcCampo}>
          <label className={styles.mcCampoLabel} htmlFor="title">
            Título
          </label>
          <input
            id="title"
            name="title"
            required
            defaultValue={cupon?.title ?? ""}
            placeholder="Ej: 2×1 en cócteles de autor"
            className={styles.mcCampoInput}
          />
        </div>
        <div className={styles.mcCampo}>
          <label className={styles.mcCampoLabel} htmlFor="description">
            Qué incluye exactamente
          </label>
          <textarea
            id="description"
            name="description"
            required
            defaultValue={cupon?.description ?? ""}
            placeholder="Contá qué recibe quien lo canjea"
            className={styles.mcCampoArea}
          />
        </div>
      </div>

      {/* ── Para quién ── Los clientes son los miembros de Close Friends: un
          cupón para ellos trae su propio QR, que se muestra en el local. */}
      <p className={styles.mcFormSec}>Para quién es</p>
      <div className={styles.lmSeg} role="radiogroup" aria-label="Para quién es el cupón">
        {AUDIENCIAS.map((a) => (
          <button
            key={a.valor}
            type="button"
            role="radio"
            aria-checked={audiencia === a.valor}
            className={`${styles.lmSegItem} ${audiencia === a.valor ? styles.lmSegOn : ""}`}
            onClick={() => setAudiencia(a.valor)}
          >
            {a.label}
          </button>
        ))}
      </div>
      <p className={styles.lmAyuda}>{ayudaAudiencia(audiencia)}</p>

      <p className={styles.mcFormSec}>Reglas</p>
      <div className={styles.mcInset}>
        {editando ? (
          <div className={`${styles.mcFilaCampo} ${styles.lmFilaBloqueada}`}>
            <span className={styles.mcFilaCampoLabel}>Tipo</span>
            <span className={styles.lmFilaValor}>
              {LABEL_TIPO_CUPON[tipo] ?? tipo}
              <QosIcon name="lock" size={14} />
            </span>
          </div>
        ) : (
          <label className={styles.mcFilaCampo}>
            <span className={styles.mcFilaCampoLabel}>Tipo</span>
            <select name="type" className={styles.lmSelect} value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option value="producto">Producto</option>
              <option value="servicio">Servicio</option>
              <option value="evento">Evento</option>
            </select>
            <QosIcon name="chevR" size={15} className={styles.lmChev} />
          </label>
        )}

        {/* Los clientes no tienen niveles: el selector es solo de creadores. */}
        {audiencia !== "members" && (
          <label className={styles.mcFilaCampo}>
            <span className={styles.mcFilaCampoLabel}>Qué creadores</span>
            <select name="min_level" className={styles.lmSelect} defaultValue={cupon?.minLevel ?? 1}>
              {niveles.map((n) => (
                <option key={n.level} value={n.level}>
                  {n.level === 1 ? "Todos" : `${n.name} o más`}
                </option>
              ))}
            </select>
            <QosIcon name="chevR" size={15} className={styles.lmChev} />
          </label>
        )}

        <div className={styles.mcFilaCampo}>
          <label className={styles.mcFilaCampoLabel} htmlFor="stock_total" style={{ flex: 1 }}>
            Stock
          </label>
          {/* El número se puede escribir: de 20 a 150 son 130 toques de +. */}
          <span className={styles.mcStepper}>
            <button
              type="button"
              className={styles.mcStepBtn}
              disabled={stockNum <= pisoStock}
              aria-label="Menos stock"
              onClick={() => setStock(String(Math.max(pisoStock, stockNum - 1)))}
            >
              −
            </button>
            <input
              id="stock_total"
              name="stock_total"
              type="number"
              inputMode="numeric"
              min={pisoStock}
              required
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              className={styles.lmStepInput}
            />
            <button
              type="button"
              className={styles.mcStepBtn}
              aria-label="Más stock"
              onClick={() => setStock(String(Math.max(pisoStock, stockNum + 1)))}
            >
              +
            </button>
          </span>
        </div>

        {tipo === "evento" ? (
          <>
            <label className={styles.mcFilaCampo}>
              <span className={styles.mcFilaCampoLabel}>Fecha</span>
              <input
                name="event_date"
                type="date"
                required={!editando}
                defaultValue={cupon?.eventDateInput ?? ""}
                className={styles.lmFilaInput}
              />
            </label>
            <label className={styles.mcFilaCampo}>
              <span className={styles.mcFilaCampoLabel}>Lugar</span>
              <input
                name="event_location"
                defaultValue={cupon?.eventLocation ?? ""}
                placeholder="Ej: local de Escazú"
                className={styles.lmFilaInput}
              />
            </label>
          </>
        ) : (
          <label className={styles.mcFilaCampo}>
            <span className={styles.mcFilaCampoLabel}>Vigencia</span>
            <select
              name="claim_validity_days"
              className={styles.lmSelect}
              defaultValue={cupon?.claimValidityDays ?? 14}
            >
              {vigencias.map((d) => (
                <option key={d} value={d}>
                  {d} días
                </option>
              ))}
            </select>
            <QosIcon name="chevR" size={15} className={styles.lmChev} />
          </label>
        )}

        {editando && (
          <label className={styles.mcFilaCampo}>
            <span className={styles.mcFilaCampoLabel}>Condiciones</span>
            <input
              name="conditions"
              defaultValue={cupon?.conditions ?? ""}
              placeholder="Ninguna"
              className={styles.lmFilaInput}
            />
          </label>
        )}
      </div>

      <p className={styles.lmAyuda}>
        {editando
          ? `El tipo queda fijo porque cambiaría el plazo de los códigos ya emitidos.${
              cupon!.reclamados > 0
                ? ` El stock no puede bajar de ${cupon!.reclamados}, lo ya reclamado.`
                : ""
            }`
          : tipo === "evento"
            ? `🎟️ ${LEYENDA_EVENTO} El código vale hasta la fecha del evento.`
            : "Vigencia se cuenta desde el reclamo. Si vence sin usarse, el código expira y el stock se libera."}
      </p>

      {!editando && (
        <>
          <p className={styles.mcFormSec}>Condiciones · opcional</p>
          <div className={styles.mcInset}>
            <div className={styles.mcCampo}>
              <input
                name="conditions"
                aria-label="Condiciones"
                placeholder="Ej: válido solo de lunes a jueves"
                className={styles.mcCampoInput}
              />
            </div>
          </div>
          <p className={styles.lmAyuda}>Un canje por persona por cupón. Se publica al instante.</p>
        </>
      )}

      {error && (
        <p className={styles.formError} style={{ marginTop: 14 }} role="alert">
          {error}
        </p>
      )}
    </>
  );

  if (editando) {
    return (
      <div className={styles.hojaFondo} onClick={() => !ocupado && onCerrar?.()} role="presentation">
        <form
          ref={formRef}
          className={`${styles.hoja} ${styles.lmHoja}`}
          role="dialog"
          aria-modal="true"
          aria-label="Editar cupón"
          onClick={(e) => e.stopPropagation()}
          onSubmit={(e) => {
            e.preventDefault();
            enviar(false);
          }}
        >
          <div className={styles.hojaAgarre} aria-hidden />
          <div className={styles.lmHojaBar}>
            <button type="button" className={styles.mcCancelar} onClick={onCerrar} disabled={ocupado}>
              Cancelar
            </button>
            <span className={styles.mcFormTitulo}>Editar cupón</span>
            <button type="submit" className={styles.lmGuardar} disabled={ocupado}>
              {estado === "subiendo" ? "Subiendo…" : estado === "guardando" ? "Guardando…" : "Guardar"}
            </button>
          </div>
          <div className={styles.hojaScroll}>{campos}</div>
        </form>
      </div>
    );
  }

  return (
    // Enter en un campo guarda BORRADOR, no publica: publicar es el gesto que
    // se hace a propósito, con el botón grande.
    <form
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault();
        enviar(false);
      }}
    >
      {campos}

      <div className={styles.lmPieAire} />
      <div className={`${styles.trPie} ${styles.lmPieCol}`}>
        <button type="button" onClick={() => enviar(true)} disabled={ocupado} className={styles.trPiePill}>
          {estado === "subiendo" ? "Subiendo foto…" : estado === "guardando" ? "Guardando…" : "Publicar cupón"}
        </button>
        <button type="submit" disabled={ocupado} className={styles.lmPieLink}>
          Guardar borrador
        </button>
      </div>
    </form>
  );
}
