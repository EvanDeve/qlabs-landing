"use client";

import { useEffect, useState, useTransition } from "react";
import type { Database } from "@/lib/database.types";
import { updateContentPieceAction, updateContentPieceColumnAction, deleteContentPieceAction } from "@/lib/actions/content-pieces";
import { nextColumn, type ContentColumn } from "@/lib/ugc/content-columns";
import { QosIcon } from "@/lib/ugc/qos-icons";
import ConfirmDeleteButton from "./ConfirmDeleteButton";
import type { BrandOption, StaffOption } from "./KanbanBoard";
import styles from "@/app/ugc/(dashboard)/admin/qos.module.css";

type ContentPiece = Database["public"]["Tables"]["content_pieces"]["Row"];

export default function ContentPieceDrawer({
  piece,
  columns,
  brands,
  staff,
  onClose,
  onDeleted,
}: {
  piece: ContentPiece;
  columns: ContentColumn[];
  brands: BrandOption[];
  staff: StaffOption[];
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [columnId, setColumnId] = useState(piece.column_id);
  // El Hero vive en estado y no solo en el <select> para que el encabezado del
  // drawer diga la marca elegida apenas se cambia, y no la que tenía al abrir.
  const [brandId, setBrandId] = useState(piece.brand_id);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const brandName = brands.find((b) => b.id === brandId)?.name ?? "";
  const current = columns.find((c) => c.id === columnId);
  const upcoming = nextColumn(columns, columnId);

  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(false), 2000);
    return () => clearTimeout(t);
  }, [saved]);

  /**
   * El form se manda a mano en vez de con <form action={...}>.
   *
   * Con `action`, React 19 hace form.reset() cuando la acción termina, y el
   * reset deja el <select> de Hero en su primera opción —o sea, en una marca
   * que nadie eligió— mientras el drawer sigue mostrando la correcta. Ahí un
   * segundo "Guardar" mandaba la pieza a esa marca sin que se notara.
   */
  function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      await updateContentPieceAction(formData);
      setSaved(true);
    });
  }

  function handleAdvance() {
    if (!upcoming) return;
    startTransition(async () => {
      await updateContentPieceColumnAction(piece.id, upcoming.id);
      setColumnId(upcoming.id);
    });
  }

  async function handleDelete() {
    await deleteContentPieceAction(piece.id);
    onDeleted();
  }

  return (
    <div className={styles.drawerOverlay} onClick={onClose}>
      <aside className={styles.drawer} onClick={(e) => e.stopPropagation()}>
        <div className={styles.drawerHd}>
          <div>
            <span className={styles.sopTag}>{piece.code}</span>
            <h2 style={{ fontSize: "18px", marginTop: "6px" }}>{piece.title}</h2>
            <p style={{ fontSize: "13px", color: "var(--ink-2)" }}>{brandName}</p>
          </div>
          <button type="button" onClick={onClose} className={styles.drawerClose}>
            <QosIcon name="x" size={16} />
          </button>
        </div>

        <div className={styles.drawerBody}>
          <div className={`${styles.card} ${styles.cardPad}`} style={{ marginBottom: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
              <span className={styles.sopTag}>{current?.name ?? "Sin columna"}</span>
              {upcoming && (
                <button
                  type="button"
                  onClick={handleAdvance}
                  disabled={isPending}
                  className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`}
                >
                  Avanzar a {upcoming.name} <QosIcon name="chevR" size={13} />
                </button>
              )}
            </div>
            {current?.sop_code && (
              <p style={{ marginTop: "8px", fontSize: "11.5px", color: "var(--ink-3)" }}>
                {current.sop_code}
                {current.owner_role ? ` · Responsable: ${current.owner_role}` : ""}
              </p>
            )}
          </div>

          <form onSubmit={handleSave}>
            <input type="hidden" name="id" value={piece.id} />

            {/* El Hero se puede corregir después de crear la pieza: antes
                quedaba fijo y una pieza cargada en la marca equivocada solo se
                arreglaba borrándola y volviéndola a crear. */}
            <div className={styles.field}>
              <label>Hero</label>
              <select
                name="brand_id"
                value={brandId}
                onChange={(e) => setBrandId(e.target.value)}
                className={styles.inp}
              >
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.field}>
              <label>Responsable</label>
              <select name="owner_id" defaultValue={piece.owner_id ?? ""} className={styles.inp}>
                <option value="">Sin asignar</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {s.role}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", gap: "12px" }}>
              <div className={styles.field} style={{ flex: 1 }}>
                <label>Prioridad</label>
                <select name="priority" defaultValue={piece.priority} className={styles.inp}>
                  <option value="baja">Baja</option>
                  <option value="media">Media</option>
                  <option value="alta">Alta</option>
                </select>
              </div>
              <div className={styles.field} style={{ flex: 1 }}>
                <label>Plataforma</label>
                <select name="platform" defaultValue={piece.platform} className={styles.inp}>
                  <option value="instagram">Instagram</option>
                  <option value="tiktok">TikTok</option>
                  <option value="reels">Reels</option>
                </select>
              </div>
            </div>

            <div className={styles.field}>
              <label>Aprobación</label>
              <select name="approval" defaultValue={piece.approval} className={styles.inp}>
                <option value="pendiente">Pendiente</option>
                <option value="correccion">Corrección</option>
                <option value="revisado">Revisado</option>
              </select>
            </div>

            {/* Solo publicación: la grabación es un hito mensual del calendario,
                no un dato de cada pieza. Ver el comentario en NewContentPieceModal.

                record_date viaja igual como hidden con el valor que ya tenía. Sin
                esto, guardar cualquier pieza la dejaría en null —el server action
                lee el campo del formulario y lo ausente vale ""— y una pieza vieja
                perdería su fecha en silencio al tocarle cualquier otra cosa. */}
            <input type="hidden" name="record_date" value={piece.record_date?.slice(0, 10) ?? ""} />

            <div className={styles.field}>
              <label>Publicación</label>
              <input type="date" name="publish_date" defaultValue={piece.publish_date?.slice(0, 10) ?? ""} className={styles.inp} />
            </div>

            <LinkField
              label="Link Drive"
              name="drive_url"
              value={piece.drive_url}
              icon="drive"
              placeholder="https://drive.google.com/..."
            />
            <LinkField label="Link guion" name="script_url" value={piece.script_url} icon="doc" />
            <LinkField label="Link video final" name="final_url" value={piece.final_url} icon="play" />

            <div className={styles.field}>
              <label>Apuntes</label>
              <textarea name="notes" rows={3} defaultValue={piece.notes ?? ""} className={styles.inp} />
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              {/* El drawer no se cierra al guardar, así que sin este aviso no
                  había ninguna señal de que el cambio entró. */}
              <button type="submit" disabled={isPending} className={`${styles.btn} ${styles.btnPrimary}`}>
                {isPending ? "Guardando…" : saved ? "Guardado" : "Guardar"}
                {saved && !isPending && <QosIcon name="check" size={15} />}
              </button>
              <ConfirmDeleteButton
                action={handleDelete}
                confirmMessage={`¿Borrar la pieza "${piece.title}"? No se puede deshacer.`}
                className={`${styles.btn} ${styles.btnDanger}`}
              >
                Borrar pieza
              </ConfirmDeleteButton>
            </div>
          </form>
        </div>
      </aside>
    </div>
  );
}

/**
 * Campo de link con dos botones: abrir en otra pestaña y copiar al portapapeles.
 *
 * El valor vive en estado —y no suelto en un input no controlado— para que los
 * botones sirvan sobre lo que se acaba de pegar, sin tener que guardar primero.
 */
function LinkField({
  label,
  name,
  value: initialValue,
  icon,
  placeholder,
}: {
  label: string;
  name: string;
  value: string | null;
  icon: string;
  placeholder?: string;
}) {
  const [value, setValue] = useState(initialValue ?? "");
  const [copied, setCopied] = useState(false);
  const href = hrefDeLink(value);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(t);
  }, [copied]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(href ?? value.trim());
      setCopied(true);
    } catch {
      // Sin permiso de portapapeles (o fuera de HTTPS) queda al menos el texto
      // seleccionado para copiarlo a mano.
      document.getElementById(`link-${name}`)?.focus();
      (document.getElementById(`link-${name}`) as HTMLInputElement | null)?.select();
    }
  }

  return (
    <div className={styles.field}>
      <label htmlFor={`link-${name}`} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <QosIcon name={icon} size={13} />
        {label}
      </label>
      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
        <input
          id={`link-${name}`}
          name={name}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className={styles.inp}
          style={{ flex: 1, minWidth: 0 }}
        />
        <button
          type="button"
          onClick={handleCopy}
          disabled={!value.trim()}
          className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}
          style={{ padding: "8px 10px", opacity: value.trim() ? 1 : 0.4 }}
          title={copied ? "Copiado" : `Copiar ${label.toLowerCase()}`}
          aria-label={`Copiar ${label.toLowerCase()}`}
        >
          <QosIcon name={copied ? "check" : "copy"} size={15} />
        </button>
        {/* Un <a> y no un botón: así se puede abrir con clic del medio o
            Cmd+clic, como cualquier link. Sin URL queda como span apagado —un
            ancla sin href no es clickeable ni recibe foco. */}
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className={`${styles.btn} ${styles.btnSoft} ${styles.btnSm}`}
            style={{ padding: "8px 10px" }}
            title={`Abrir ${label.toLowerCase()} en otra pestaña`}
            aria-label={`Abrir ${label.toLowerCase()} en otra pestaña`}
          >
            <QosIcon name="external" size={15} />
          </a>
        ) : (
          <span
            className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}
            style={{ padding: "8px 10px", opacity: 0.4 }}
            title="Pegá un link para poder abrirlo"
            aria-hidden
          >
            <QosIcon name="external" size={15} />
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * URL para abrir en otra pestaña, o null si no hay nada que abrir.
 *
 * Un link pegado como "drive.google.com/..." sin esquema se leería como ruta
 * relativa y llevaría a /ugc/admin/drive.google.com — de ahí el https:// de
 * relleno. Se descartan esquemas raros (javascript:, data:) para no meter un
 * link ejecutable en el drawer.
 */
function hrefDeLink(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  const conEsquema = /^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(conEsquema);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}
