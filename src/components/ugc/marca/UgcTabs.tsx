"use client";

import { useState } from "react";
import Link from "next/link";
import { pasosDeCampana } from "@/lib/ugc/application-steps";
import { entregablesEnLinea } from "@/lib/ugc/deliverables";
import { CAMPAIGN_STATUS_LABEL } from "@/lib/ugc/campaign-status";
import { APPLICATION_STATUS_LABEL } from "@/lib/ugc/application-status";
import { displayHandle } from "@/lib/ugc/handles";
import { languageLabel } from "@/lib/ugc/languages";
import RielCampana from "./RielCampana";
import AvataresAplicantes from "./AvataresAplicantes";
import ApplicantDecisionButtons from "./ApplicantDecisionButtons";
import { QosIcon } from "@/lib/ugc/qos-icons";
import styles from "@/styles/qos.module.css";
import PantallaHeader from "@/components/ugc/PantallaHeader";

type Campana = {
  id: string;
  title: string;
  status: "draft" | "published" | "in_progress" | "completed" | "cancelled";
  budget_amount: number | null;
  deliverables: unknown;
  deadline_days: number | null;
  published_at: string | null;
  created_at: string;
};

type Aplicacion = {
  id: string;
  campaign_id: string;
  creator_id: string;
  status: string;
  pitch_message: string | null;
  rating: number | null;
  created_at: string;
  accepted_at: string | null;
  delivered_at: string | null;
  approved_at: string | null;
};

type Perfil = { id: string; display_name: string | null; avatar_url: string | null; city: string | null };
type PerfilCreador = {
  profile_id: string;
  handle: string | null;
  verified: boolean;
  followers_count: number;
  niches: string[];
  languages: string[];
};
type Stats = { avg_rating: number | null; rating_count: number } | null;

/** Las que ya no esperan nada de nadie. */
const CERRADAS = ["completed", "cancelled"];

export default function UgcTabs({
  campaigns,
  applications,
  profiles,
  creatorProfiles,
  piezasPorCreador,
  statsPorCreador,
  entregasPorApp,
  perfilIncompleto,
}: {
  campaigns: Campana[];
  applications: Aplicacion[];
  profiles: Record<string, Perfil>;
  creatorProfiles: Record<string, PerfilCreador>;
  piezasPorCreador: Record<string, number>;
  statsPorCreador: Record<string, Stats>;
  entregasPorApp: Record<string, number>;
  perfilIncompleto: boolean;
}) {
  const [tab, setTab] = useState<"campanas" | "aplicantes">("campanas");

  const porRevisar = applications.filter(
    (a) => a.status === "pending" || a.status === "reviewing"
  );

  const nombreDe = (creatorId: string) =>
    displayHandle(creatorProfiles[creatorId]?.handle ?? "") ||
    profiles[creatorId]?.display_name ||
    "Creador";

  return (
    <>
      <PantallaHeader
        titulo="Campañas"
        accion={
          <Link href="/ugc/marca/campanas/nueva" className={styles.mcNuevo}>
            <QosIcon name="plus" size={15} />
            Nueva
          </Link>
        }
      />

      {perfilIncompleto && (
        <div className={`${styles.trAviso} ${styles.trAvisoMal}`} style={{ marginBottom: 14 }}>
          <QosIcon name="alert" size={15} className={styles.trAvisoIc} />
          <span>
            Tu negocio está sin completar. Los creadores miran la zona y la descripción antes de
            aplicar. <Link href="/ugc/marca/perfil">Completalo</Link>
          </span>
        </div>
      )}

      <div className={styles.trTabs} role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "campanas"}
          onClick={() => setTab("campanas")}
          className={`${styles.trTabBtn} ${tab === "campanas" ? styles.trTabOn : ""}`}
        >
          Mis campañas
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "aplicantes"}
          onClick={() => setTab("aplicantes")}
          className={`${styles.trTabBtn} ${tab === "aplicantes" ? styles.trTabOn : ""}`}
        >
          Aplicantes
          {porRevisar.length > 0 && <span className={styles.mcCuenta}>{porRevisar.length}</span>}
        </button>
      </div>

      {tab === "campanas" ? (
        <ListaCampanas
          campaigns={campaigns}
          applications={applications}
          profiles={profiles}
          entregasPorApp={entregasPorApp}
        />
      ) : (
        <ListaAplicantes
          campaigns={campaigns}
          applications={applications}
          profiles={profiles}
          creatorProfiles={creatorProfiles}
          piezasPorCreador={piezasPorCreador}
          statsPorCreador={statsPorCreador}
          nombreDe={nombreDe}
        />
      )}
    </>
  );
}

/* ---------------- Pestaña 1: las campañas ---------------- */

function ListaCampanas({
  campaigns,
  applications,
  profiles,
  entregasPorApp,
}: {
  campaigns: Campana[];
  applications: Aplicacion[];
  profiles: Record<string, Perfil>;
  entregasPorApp: Record<string, number>;
}) {
  if (campaigns.length === 0) {
    return (
      <div className={styles.mcVacio}>
        <QosIcon name="megaphone" size={26} className={styles.trVacioIc} />
        <p className={styles.mcVacioTxt}>
          Todavía no publicaste ninguna campaña. La primera es la que trae los primeros creadores.
        </p>
      </div>
    );
  }

  return (
    <>
      {campaigns.map((c) => {
        const suyas = applications.filter((a) => a.campaign_id === c.id);
        const vivas = suyas.filter((a) => !["rejected", "cancelled"].includes(a.status));
        const porRevisar = suyas.filter((a) => a.status === "pending" || a.status === "reviewing");
        const grabando = suyas.filter((a) => a.accepted_at && !a.delivered_at && !a.approved_at);
        const aprobadas = suyas.filter((a) => a.approved_at);
        const cerrada = CERRADAS.includes(c.status);
        const borrador = c.status === "draft";

        // Qué le falta a un borrador para poder publicarse. Decirlo en la
        // tarjeta ahorra entrar a averiguarlo.
        const falta = borrador
          ? [
              !c.budget_amount && "el presupuesto",
              !entregablesEnLinea(c.deliverables) && "los entregables",
            ].filter(Boolean)
          : [];

        return (
          <div key={c.id} className={styles.mcCard}>
            <div className={styles.mcCardTop}>
              <div style={{ minWidth: 0 }}>
                <div className={styles.mcCardTitulo}>{c.title}</div>
                <div className={styles.mcCardMeta}>
                  {borrador
                    ? falta.length > 0
                      ? `Sin publicar · le falta ${falta.join(" y ")}`
                      : "Sin publicar"
                    : [
                        c.budget_amount != null && `₡${c.budget_amount.toLocaleString("es-CR")}`,
                        entregablesEnLinea(c.deliverables),
                        c.deadline_days && `${c.deadline_days} días de plazo`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                </div>
              </div>
              <span
                className={`${styles.mcEstado} ${
                  c.status === "published" ? "" : styles.mcEstadoQuieto
                }`}
              >
                {CAMPAIGN_STATUS_LABEL[c.status]}
              </span>
            </div>

            {/* El riel solo mientras la campaña está viva: en una cerrada ya no
                describe nada que pueda cambiar. */}
            {!borrador && !cerrada && <RielCampana pasos={pasosDeCampana(vivas)} />}

            {cerrada && aprobadas.length > 0 && (
              <div className={styles.mcCardFila} style={{ borderTop: "1px solid var(--line-2)" }}>
                <span className={styles.mcFilaPunto} style={{ background: "var(--ok)" }} />
                <span className={styles.mcFilaTxt}>
                  {aprobadas.reduce((n, a) => n + (entregasPorApp[a.id] ?? 0), 0)} pieza
                  {aprobadas.reduce((n, a) => n + (entregasPorApp[a.id] ?? 0), 0) === 1
                    ? ""
                    : "s"}{" "}
                  aprobada{aprobadas.length === 1 ? "" : "s"}
                </span>
              </div>
            )}

            {borrador ? (
              <div className={styles.mcAplicanteBotones}>
                <Link href={`/ugc/marca/campanas/${c.id}`} className={styles.mcVerBook}>
                  Seguir editando
                </Link>
              </div>
            ) : (
              <Link href={`/ugc/marca/campanas/${c.id}`} className={styles.mcQuienes}>
                <AvataresAplicantes
                  caras={suyas.slice(0, 3).map((a) => ({
                    id: a.id,
                    nombre: profiles[a.creator_id]?.display_name ?? "Creador",
                    avatarUrl: profiles[a.creator_id]?.avatar_url ?? null,
                  }))}
                />
                <span className={styles.mcQuienesTxt}>
                  {[
                    porRevisar.length > 0 && `${porRevisar.length} por revisar`,
                    grabando.length > 0 && `${grabando.length} grabando`,
                    porRevisar.length === 0 &&
                      grabando.length === 0 &&
                      (suyas.length > 0 ? "Ver la campaña" : "Nadie aplicó todavía"),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
                <QosIcon name="chevR" size={16} className={styles.mcFilaChev} />
              </Link>
            )}
          </div>
        );
      })}
    </>
  );
}

/* ---------------- Pestaña 2: los aplicantes ---------------- */

function ListaAplicantes({
  campaigns,
  applications,
  profiles,
  creatorProfiles,
  piezasPorCreador,
  statsPorCreador,
  nombreDe,
}: {
  campaigns: Campana[];
  applications: Aplicacion[];
  profiles: Record<string, Perfil>;
  creatorProfiles: Record<string, PerfilCreador>;
  piezasPorCreador: Record<string, number>;
  statsPorCreador: Record<string, Stats>;
  nombreDe: (id: string) => string;
}) {
  const porRevisar = applications.filter(
    (a) => a.status === "pending" || a.status === "reviewing"
  );
  const decididos = applications.filter(
    (a) => !["pending", "reviewing"].includes(a.status)
  );

  if (applications.length === 0) {
    return (
      <div className={styles.mcVacio}>
        <QosIcon name="users" size={26} className={styles.trVacioIc} />
        <p className={styles.mcVacioTxt}>
          Todavía nadie aplicó a tus campañas. Cuando alguien lo haga, aparece acá.
        </p>
      </div>
    );
  }

  // Agrupados por campaña: quien revisa está decidiendo PARA una campaña, y
  // mezclar aplicantes de dos briefs distintos obliga a acordarse de cuál era
  // cuál en cada tarjeta.
  const campanasConPendientes = campaigns.filter((c) =>
    porRevisar.some((a) => a.campaign_id === c.id)
  );

  return (
    <>
      {campanasConPendientes.map((c) => {
        const suyos = porRevisar.filter((a) => a.campaign_id === c.id);
        return (
          <div key={c.id}>
            <div className={styles.mcGrupo}>
              <span className={styles.mcGrupoTit}>{c.title}</span>
              <span className={styles.mcGrupoMeta}>
                {suyos.length} sin revisar
              </span>
            </div>
            {suyos.map((a) => {
              const p = profiles[a.creator_id];
              const cp = creatorProfiles[a.creator_id];
              const st = statsPorCreador[a.creator_id];
              const piezas = piezasPorCreador[a.creator_id] ?? 0;

              return (
                <div key={a.id} className={styles.mcAplicante}>
                  <div className={styles.mcAplicanteTop}>
                    <span className={styles.mcAplicanteFoto}>
                      {p?.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.avatar_url} alt="" />
                      ) : (
                        nombreDe(a.creator_id).replace(/^@/, "").slice(0, 2).toUpperCase()
                      )}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className={styles.mcAplicanteNombre}>
                        {nombreDe(a.creator_id)}
                        {cp?.verified && <QosIcon name="check" size={13} />}
                      </div>
                      <div className={styles.mcAplicanteMeta}>
                        {[
                          cp?.followers_count
                            ? `${cp.followers_count.toLocaleString("es-CR")} seguidores`
                            : null,
                          p?.city,
                          cp?.niches?.[0],
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    </div>
                    {/* La nota promedio sale de `creator_public_stats`, que es
                        pública: acá NO se puede calcular, porque una marca solo
                        ve las aplicaciones de sus propias campañas. */}
                    {st && st.rating_count > 0 && st.avg_rating != null ? (
                      <span className={styles.mcNota}>{st.avg_rating.toFixed(1)}/5</span>
                    ) : (
                      <span className={styles.mcNotaNueva}>Nuevo</span>
                    )}
                  </div>

                  <div className={styles.mcChips}>
                    <span className={styles.mcChip}>
                      {piezas > 0
                        ? `${piezas} pieza${piezas === 1 ? "" : "s"} en su book`
                        : "Book vacío"}
                    </span>
                    {(cp?.languages ?? []).map((l) => (
                      <span key={l} className={styles.mcChip}>
                        {languageLabel(l)}
                      </span>
                    ))}
                  </div>

                  {a.pitch_message && <p className={styles.mcPitch}>“{a.pitch_message}”</p>}

                  <div className={styles.mcAplicanteBotones}>
                    {cp?.handle && (
                      <Link
                        href={`/ugc/creadores/${cp.handle.replace(/^@/, "")}`}
                        className={styles.mcVerBook}
                      >
                        Ver book
                      </Link>
                    )}
                    <ApplicantDecisionButtons
                      applicationId={a.id}
                      campaignId={a.campaign_id}
                      creatorName={nombreDe(a.creator_id)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}

      {decididos.length > 0 && (
        <>
          <h2 className={styles.mcSecTit} style={{ marginTop: "24px" }}>
            Ya decididos
          </h2>
          <div className={styles.trLista}>
            {decididos.map((a) => {
              const p = profiles[a.creator_id];
              const campana = campaigns.find((c) => c.id === a.campaign_id);
              return (
                <Link
                  key={a.id}
                  href={`/ugc/marca/campanas/${a.campaign_id}`}
                  className={styles.mcDecidido}
                >
                  <span className={styles.mcDecididoFoto}>
                    {p?.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.avatar_url} alt="" />
                    ) : (
                      nombreDe(a.creator_id).replace(/^@/, "").slice(0, 2).toUpperCase()
                    )}
                  </span>
                  <span className={styles.mcDecididoTxt}>
                    <span className={styles.mcDecididoNombre}>{nombreDe(a.creator_id)}</span>
                    <span className={styles.mcDecididoSub}>{campana?.title ?? ""}</span>
                  </span>
                  <span className={styles.mcEstado + " " + styles.mcEstadoQuieto}>
                    {APPLICATION_STATUS_LABEL[a.status as keyof typeof APPLICATION_STATUS_LABEL]}
                  </span>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
