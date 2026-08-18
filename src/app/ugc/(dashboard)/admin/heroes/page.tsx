import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { deleteHeroAction, setHeroArchivedAction } from "@/lib/actions/heroes";
import { QosIcon } from "@/lib/ugc/qos-icons";
import { diaCR } from "@/lib/ugc/calendar";
import NewHeroButton from "@/components/ugc/admin/NewHeroButton";
import ConfirmDeleteButton from "@/components/ugc/admin/ConfirmDeleteButton";
import styles from "../qos.module.css";

export const dynamic = "force-dynamic";

const PALETTE = ["#6d54f3", "#c0392b", "#2aa5c0", "#3f8f4f", "#b3487f", "#8a5a2b", "#1f9ac9", "#b8442f", "#5a5f6d"];
function colorFor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

type HeroRow = {
  id: string;
  name: string;
  industry: string | null;
  logo_url: string | null;
  drive_url: string | null;
  contacts: { name: string; phone?: string }[];
  archived: boolean;
};

export default async function HeroesPage() {
  const supabase = await createClient();

  const { data: clients } = await supabase
    .from("agency_clients")
    .select("id, name, industry, logo_url, drive_url, contacts, archived")
    .order("name", { ascending: true });

  const clientIds = (clients ?? []).map((c) => c.id);

  const { data: contentPieces } = clientIds.length
    ? await supabase.from("content_pieces").select("brand_id, column_id, publish_date").in("brand_id", clientIds)
    : { data: [] };

  // Qué columna significa "publicado" lo dice su bandera is_done, no el nombre.
  const { data: columns } = await supabase.from("content_columns").select("id, name, is_done");
  const columnById = new Map((columns ?? []).map((c) => [c.id, c]));

  const latestStageByBrandId = new Map<string, string>();
  const nextPublishByBrandId = new Map<string, string>();
  const activeCountByBrandId = new Map<string, number>();
  for (const piece of contentPieces ?? []) {
    // Una tarea interna no tiene expediente en el que aparecer.
    if (!piece.brand_id) continue;
    if (!columnById.get(piece.column_id)?.is_done) {
      latestStageByBrandId.set(piece.brand_id, piece.column_id);
      activeCountByBrandId.set(piece.brand_id, (activeCountByBrandId.get(piece.brand_id) ?? 0) + 1);
    }
    // Día de CR, no instante: comparando instantes, una pieza que publica HOY
    // se descartaba como pasada desde las 18:00 del día anterior.
    if (piece.publish_date && diaCR(piece.publish_date) >= diaCR(new Date())) {
      const current = nextPublishByBrandId.get(piece.brand_id);
      if (!current || piece.publish_date < current) nextPublishByBrandId.set(piece.brand_id, piece.publish_date);
    }
  }

  const activos = (clients ?? []).filter((c) => !c.archived);
  const archivados = (clients ?? []).filter((c) => c.archived);

  const tarjeta = (client: HeroRow) => (
    <HeroCard
      key={client.id}
      client={client}
      color={colorFor(client.id)}
      activeCount={activeCountByBrandId.get(client.id) ?? 0}
      stageName={
        client.archived ? null : columnById.get(latestStageByBrandId.get(client.id) ?? "")?.name ?? null
      }
      nextPublish={nextPublishByBrandId.get(client.id) ?? null}
    />
  );

  return (
    <div>
      <NewHeroButton />
      <div className={styles.heroCards}>{activos.map(tarjeta)}</div>

      {archivados.length > 0 && (
        // Abajo y con encabezado propio: siguen accesibles —hay que poder
        // entrar a ver el trabajo que se les hizo— pero no compiten por la
        // atención con los clientes que sí están activos.
        <div style={{ marginTop: "32px" }}>
          <div className={styles.sectionHead}>
            <h2>Archivados ({archivados.length})</h2>
          </div>
          <p style={{ fontSize: "12.5px", color: "var(--ink-3)", marginBottom: "14px" }}>
            No cuentan en el Dashboard ni en el Pase de servicio, y no aparecen al crear piezas. Su
            trabajo se conserva: en el Pipeline se ve con &ldquo;Ver Heroes archivados&rdquo;.
          </p>
          <div className={styles.heroCards} style={{ opacity: 0.75 }}>
            {archivados.map(tarjeta)}
          </div>
        </div>
      )}
    </div>
  );
}

function HeroCard({
  client,
  color,
  activeCount,
  stageName,
  nextPublish,
}: {
  client: HeroRow;
  color: string;
  activeCount: number;
  stageName: string | null;
  nextPublish: string | null;
}) {
  const primaryContact = client.contacts[0];

  return (
    <div className={styles.hcard}>
      <Link href={`/ugc/admin/heroes/${client.id}`}>
        <div className={styles.hcardTop}>
          {client.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={client.logo_url} alt={client.name} className={styles.hcardMono} style={{ objectFit: "cover" }} />
          ) : (
            <span className={styles.hcardMono} style={{ background: color }}>
              {client.name.slice(0, 2).toUpperCase()}
            </span>
          )}
          <div>
            <div className={styles.hcardName}>{client.name}</div>
            <div className={styles.hcardInd}>{client.industry ?? "Sin industria"}</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <span className={styles.tag}>
            {activeCount} pieza{activeCount === 1 ? "" : "s"} activa{activeCount === 1 ? "" : "s"}
          </span>
          {stageName && <span className={styles.tag}>{stageName}</span>}
          {client.archived && <span className={styles.tag}>Archivado</span>}
        </div>

        {primaryContact && (
          <div style={{ marginTop: "8px", fontSize: "12px", color: "var(--ink-2)" }}>
            <i className="fa-regular fa-address-card" aria-hidden /> {primaryContact.name}
            {primaryContact.phone && ` · ${primaryContact.phone}`}
          </div>
        )}

        <div className={styles.hcardFoot}>
          {nextPublish && !client.archived && (
            <span style={{ fontSize: "11.5px", color: "var(--ink-2)" }}>
              Próx.{" "}
              <b style={{ color: "var(--ink)", fontWeight: 600 }}>
                {new Date(nextPublish).toLocaleDateString("es-CR", { day: "numeric", month: "short" })}
              </b>
            </span>
          )}
        </div>
      </Link>

      <div style={{ display: "flex", gap: "8px", marginTop: "12px", flexWrap: "wrap" }}>
        {client.drive_url && (
          <a
            href={client.drive_url}
            target="_blank"
            rel="noreferrer"
            className={`${styles.btn} ${styles.btnSm} ${styles.btnGhost}`}
            style={{ flex: 1, justifyContent: "center" }}
          >
            <QosIcon name="drive" size={14} /> Drive
          </a>
        )}

        {/* Archivar va sin confirmación porque se deshace con un clic; borrar
            sigue con ConfirmDeleteButton porque arrastra las piezas. Que el
            reversible sea el botón fácil es justamente el punto. */}
        <form action={setHeroArchivedAction} style={{ flex: 1 }}>
          <input type="hidden" name="id" value={client.id} />
          <input type="hidden" name="archived" value={(!client.archived).toString()} />
          <button
            type="submit"
            className={`${styles.btn} ${styles.btnSm} ${client.archived ? styles.btnPrimary : styles.btnGhost}`}
            style={{ width: "100%", justifyContent: "center" }}
          >
            {client.archived ? "Reactivar" : "Archivar"}
          </button>
        </form>

        <ConfirmDeleteButton
          action={deleteHeroAction.bind(null, client.id)}
          confirmMessage={`¿Borrar definitivamente a ${client.name}? Esto elimina sus piezas y eventos. No se puede deshacer. Si el cliente solo dejó de estar activo, usá "Archivar".`}
          className={`${styles.btn} ${styles.btnSm} ${styles.btnDanger}`}
          style={{ flex: 1, justifyContent: "center" }}
        >
          Borrar Hero
        </ConfirmDeleteButton>
      </div>
    </div>
  );
}
