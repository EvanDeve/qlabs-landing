import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { updateHeroProfileAction } from "@/lib/actions/heroes";
import { CONTENT_STAGE_LABEL } from "@/lib/ugc/content-stage";
import { QosIcon } from "@/lib/ugc/qos-icons";
import HeroLogoField from "@/components/ugc/admin/HeroLogoField";
import HeroContactsField from "@/components/ugc/admin/HeroContactsField";
import styles from "../../qos.module.css";

export const dynamic = "force-dynamic";

const PALETTE = ["#6d54f3", "#c0392b", "#2aa5c0", "#3f8f4f", "#b3487f", "#8a5a2b", "#1f9ac9", "#b8442f", "#5a5f6d"];
function colorFor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

export default async function HeroDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: client } = await supabase.from("agency_clients").select("*").eq("id", id).maybeSingle();

  if (!client) notFound();

  const { data: contentPieces } = await supabase
    .from("content_pieces")
    .select("id, code, title, stage, publish_date")
    .eq("brand_id", id)
    .order("created_at", { ascending: false });

  const activeCount = (contentPieces ?? []).filter((p) => p.stage !== "publicado").length;
  const publishedCount = (contentPieces ?? []).filter((p) => p.stage === "publicado").length;

  return (
    <div>
      <Link href="/ugc/admin/heroes" className={styles.backBtn}>
        <QosIcon name="chevL" size={14} /> Heroes
      </Link>

      <div className={styles.dossierHd}>
        <div className={styles.dsrRow}>
          {client.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={client.logo_url} alt={client.name} className={styles.dsrMono} style={{ objectFit: "cover" }} />
          ) : (
            <span className={styles.dsrMono} style={{ background: colorFor(client.id) }}>
              {client.name.slice(0, 2).toUpperCase()}
            </span>
          )}
          <div>
            <div className={styles.dsrId}>EXPEDIENTE HERO</div>
            <div className={styles.dsrName}>{client.name}</div>
            <div className={styles.dsrInd}>
              {client.industry ?? "Sin industria"} {client.website && `· ${client.website}`}
              {client.drive_url && (
                <>
                  {" "}
                  ·{" "}
                  <a
                    href={client.drive_url}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: "inherit", textDecoration: "underline", display: "inline-flex", alignItems: "center", gap: "4px" }}
                  >
                    <QosIcon name="drive" size={13} /> Drive
                  </a>
                </>
              )}
            </div>
          </div>
          <div style={{ display: "flex", gap: "26px", marginLeft: "auto", flexWrap: "wrap" }}>
            <div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: "22px", fontWeight: 800, color: "#fff" }}>
                {activeCount}
              </div>
              <div style={{ fontSize: "11px", color: "rgba(244,243,251,.55)" }}>Piezas activas</div>
            </div>
            <div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: "22px", fontWeight: 800, color: "#fff" }}>
                {publishedCount}
              </div>
              <div style={{ fontSize: "11px", color: "rgba(244,243,251,.55)" }}>Publicadas</div>
            </div>
          </div>
        </div>
        <div className={styles.dsrMeta}>
          <div>
            <div className={styles.dmL}>Cliente desde</div>
            <div className={styles.dmV}>{client.client_since ?? "—"}</div>
          </div>
          <div>
            <div className={styles.dmL}>Contactos</div>
            <div className={styles.dmV}>
              {client.contacts.length > 0 ? client.contacts.map((c) => c.name).join(", ") : "—"}
            </div>
          </div>
        </div>
      </div>

      <form action={updateHeroProfileAction}>
        <input type="hidden" name="id" value={client.id} />

        <div className={`${styles.card} ${styles.cardPad}`} style={{ marginBottom: "20px" }}>
          <div className={styles.sectionHead}>
            <QosIcon name="briefcase" size={16} />
            <h2>Perfil</h2>
          </div>

          <div className={styles.settingsRow}>
            <div className={styles.settingsLabel}>
              <strong>Nombre</strong>
              <p>Cómo aparece este cliente en todo Q·OS.</p>
            </div>
            <div className={styles.settingsControl}>
              <input name="name" required defaultValue={client.name} className={styles.inp} />
            </div>
          </div>

          <div className={styles.settingsRow}>
            <div className={styles.settingsLabel}>
              <strong>Industria</strong>
              <p>Rubro del negocio (opcional).</p>
            </div>
            <div className={styles.settingsControl}>
              <input name="industry" defaultValue={client.industry ?? ""} className={styles.inp} />
            </div>
          </div>

          <div className={styles.settingsRow}>
            <div className={styles.settingsLabel}>
              <strong>Sitio web</strong>
              <p>Link a la página del cliente (opcional).</p>
            </div>
            <div className={styles.settingsControl}>
              <input name="website" defaultValue={client.website ?? ""} className={styles.inp} />
            </div>
          </div>

          <div className={styles.settingsRow}>
            <div className={styles.settingsLabel}>
              <strong>Logo</strong>
              <p>Se muestra en las tarjetas y el expediente.</p>
            </div>
            <div className={styles.settingsControl}>
              <HeroLogoField currentUrl={client.logo_url} />
            </div>
          </div>

          <div className={styles.settingsRow}>
            <div className={styles.settingsLabel}>
              <strong>Cliente desde</strong>
              <p>Fecha en la que empezó la relación comercial.</p>
            </div>
            <div className={styles.settingsControl}>
              <input type="date" name="client_since" defaultValue={client.client_since ?? ""} className={styles.inp} />
            </div>
          </div>
        </div>

        <div className={`${styles.card} ${styles.cardPad}`} style={{ marginBottom: "20px" }}>
          <div className={styles.sectionHead}>
            <QosIcon name="drive" size={16} />
            <h2>Acceso y contacto</h2>
          </div>

          <div className={styles.settingsRow}>
            <div className={styles.settingsLabel}>
              <strong>Link de Drive</strong>
              <p>Carpeta compartida con este cliente.</p>
            </div>
            <div className={styles.settingsControl}>
              <input name="drive_url" placeholder="https://drive.google.com/..." defaultValue={client.drive_url ?? ""} className={styles.inp} />
            </div>
          </div>

          <div className={styles.settingsRow}>
            <div className={styles.settingsLabel}>
              <strong>Email de contacto</strong>
              <p>Correo principal para coordinar con el cliente.</p>
            </div>
            <div className={styles.settingsControl}>
              <input type="email" name="contact_email" defaultValue={client.contact_email ?? ""} className={styles.inp} />
            </div>
          </div>

          <div className={styles.settingsRow}>
            <div className={styles.settingsLabel}>
              <strong>Contactos</strong>
              <p>Personas del lado del cliente con las que coordinamos.</p>
            </div>
            <div className={styles.settingsControl}>
              <HeroContactsField defaultValue={client.contacts} />
            </div>
          </div>
        </div>

        <div className={`${styles.card} ${styles.cardPad}`} style={{ marginBottom: "20px" }}>
          <div className={styles.sectionHead}>
            <QosIcon name="doc" size={16} />
            <h2>Relación comercial</h2>
          </div>

          <div className={styles.settingsRow}>
            <div className={styles.settingsLabel}>
              <strong>Servicios contratados</strong>
              <p>Separados por coma.</p>
            </div>
            <div className={styles.settingsControl}>
              <input name="servicios" defaultValue={(client.servicios ?? []).join(", ")} className={styles.inp} />
            </div>
          </div>
        </div>

        <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} style={{ marginBottom: "28px" }}>
          Guardar
        </button>
      </form>

      <div className={`${styles.card} ${styles.cardPad}`}>
        <div className={styles.sectionHead}>
          <h2>Piezas de contenido ({contentPieces?.length ?? 0})</h2>
        </div>
        {contentPieces && contentPieces.length > 0 ? (
          contentPieces.map((piece) => (
            <div key={piece.id} className={styles.attnItem} style={{ cursor: "default" }}>
              <div className={styles.attnBody}>
                <span className={styles.sopTag}>{piece.code}</span>
                <div className={styles.attnTitle} style={{ marginTop: "4px" }}>
                  {piece.title}
                </div>
              </div>
              <span className={styles.tag}>{CONTENT_STAGE_LABEL[piece.stage]}</span>
            </div>
          ))
        ) : (
          <div className={styles.empty}>Todavía no hay piezas para este Hero. Creá una desde el Pipeline.</div>
        )}
      </div>
    </div>
  );
}
