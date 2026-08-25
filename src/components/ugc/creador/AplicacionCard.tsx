import BrandAvatar from "@/components/ugc/BrandAvatar";
import ConflictActionButton from "@/components/ugc/ConflictActionButton";
import EntregarPieza from "@/components/ugc/creador/EntregarPieza";
import type { ArchivoGuardado } from "@/components/ugc/creador/HojaDeEntrega";
import type { SlotEntrega } from "@/lib/ugc/delivery-slots";
import { APPLICATION_STATUS_LABEL, canCancel, canDispute } from "@/lib/ugc/application-status";
import {
  APLICACION_TONO,
  fechaCorta,
  fechaLimite,
  pasosDeAplicacion,
  type Paso,
} from "@/lib/ugc/application-steps";
import { creatorPayout } from "@/lib/ugc/payout";
import type { ApplicationStatus } from "@/lib/database.types";
import styles from "@/styles/qos.module.css";

export type AplicacionEnCurso = {
  id: string;
  status: ApplicationStatus;
  created_at: string;
  accepted_at: string | null;
  delivered_at: string | null;
  approved_at: string | null;
  conflict_reason: string | null;
  admin_note: string | null;
  titulo: string;
  marca: string | null;
  logo: string | null;
  monto: number | null;
  deadlineDays: number | null;
  /** Solo lo necesita la hoja de entrega, así que viaja solo con las aceptadas. */
  brief: string | null;
  slots: SlotEntrega[];
  guardados: ArchivoGuardado[];
};

const TONO_CLASE = {
  ok: styles.apliPillOk,
  curso: styles.apliPillCurso,
  neutro: styles.apliPillNeutro,
  espera: styles.apliPillEspera,
  problema: styles.apliPillProblema,
  cerrada: styles.apliPillCerrada,
} as const;

/**
 * La fecha del medio de la línea: SOLO la fecha límite de la entrega, y solo
 * mientras la entrega está pendiente.
 *
 * Las otras fechas que existen —cuándo aplicaste, cuándo entregaste— llevarían
 * un verbo adelante para no leerse como un vencimiento ("aplicaste 25 ago"), y
 * esa frase no entra en la línea: la corta el ancho de la tarjeta. Como el
 * riel ya dice en qué punto va cada colaboración, la fecha se reserva para el
 * único caso en que le pide algo al creador.
 */
function fechaDeEntrega(a: AplicacionEnCurso): Date | null {
  if (a.delivered_at || a.approved_at) return null;
  return fechaLimite(a.accepted_at, a.deadlineDays);
}

/** Un plazo de hoy o de ayer no puede verse igual que uno de la otra semana. */
function estaVencida(limite: Date): boolean {
  const hoy = new Date();
  return limite < new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
}

function Pasos({ pasos }: { pasos: Paso[] }) {
  return (
    <div className={styles.apliPasos}>
      <div className={styles.apliRiel} aria-hidden>
        {pasos.map((paso, i) => (
          <div key={paso.label} className={styles.apliRielTramo}>
            {i > 0 && (
              <span
                className={`${styles.apliSeg} ${paso.estado === "hecho" ? styles.apliSegOn : ""}`}
              />
            )}
            <span
              className={`${styles.apliDot} ${
                paso.estado === "hecho"
                  ? styles.apliDotOn
                  : paso.estado === "ahora"
                    ? styles.apliDotAhora
                    : ""
              }`}
            />
          </div>
        ))}
      </div>
      <div className={styles.apliPasosLabels}>
        {pasos.map((paso) => (
          <span
            key={paso.label}
            className={`${styles.apliPasoLabel} ${
              paso.estado === "pendiente" ? "" : styles.apliPasoLabelOn
            }`}
          >
            {paso.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function AplicacionCard({ app }: { app: AplicacionEnCurso }) {
  const limite = fechaDeEntrega(app);
  const vencida = limite ? estaVencida(limite) : false;
  const contexto = [app.marca, limite ? fechaCorta(limite) : null].filter(Boolean).join(" · ");
  const monto = app.monto != null ? `₡${creatorPayout(app.monto).toLocaleString("es-CR")}` : null;

  return (
    <article className={styles.apliCard}>
      <div className={styles.apliHead}>
        <BrandAvatar name={app.marca ?? "Marca"} logoUrl={app.logo} size={40} radius={12} />
        <div className={styles.apliIdent}>
          <h3 className={styles.apliTitulo}>{app.titulo}</h3>
          {/* La línea es una sola frase, pero el monto va en su propio nodo y
              no se encoge: la marca y la fecha juntas pasan del ancho
              disponible con nombres como "Restaurante La Ceiba", y como el
              monto iba al final, el truncado se comía justo la plata. */}
          <p className={`${styles.apliMeta} ${vencida ? styles.apliMetaVencida : ""}`}>
            <span className={styles.apliMetaCorta}>{contexto}</span>
            {monto && <span className={styles.apliMetaMonto}> · {monto}</span>}
          </p>
        </div>
        <span className={`${styles.apliPill} ${TONO_CLASE[APLICACION_TONO[app.status]]}`}>
          {APPLICATION_STATUS_LABEL[app.status]}
        </span>
      </div>

      <Pasos pasos={pasosDeAplicacion(app)} />

      {app.status === "accepted" && (
        <EntregarPieza
          applicationId={app.id}
          titulo={app.titulo}
          marca={app.marca}
          brief={app.brief}
          slots={app.slots}
          guardados={app.guardados}
        />
      )}

      {/* Salidas. Cancelar solo mientras no haya entrega; después es disputa,
          porque ya hay trabajo hecho y plata de por medio. */}
      {canCancel(app.status) && (
        <ConflictActionButton
          applicationId={app.id}
          kind="cancel"
          label="Ya no puedo con esta promo"
          className={styles.apliSalida}
        />
      )}
      {canDispute(app.status) && (
        <ConflictActionButton
          applicationId={app.id}
          kind="dispute"
          label="Reportar un problema"
          className={styles.apliSalida}
        />
      )}

      {/* El riel no sabe dibujar una disputa, y el motivo y la resolución no
          tienen otra pantalla donde leerse. */}
      {app.status === "disputed" && app.conflict_reason && (
        <p className={styles.apliNota}>
          <b>Caso abierto: </b>
          {app.conflict_reason}
        </p>
      )}
      {app.admin_note && (
        <p className={styles.apliNota}>
          <b>Resolución de Q Labs: </b>
          {app.admin_note}
        </p>
      )}
    </article>
  );
}
