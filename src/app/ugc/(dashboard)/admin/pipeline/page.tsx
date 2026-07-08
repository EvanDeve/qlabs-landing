import { createClient } from "@/lib/supabase/server";
import KanbanBoard from "@/components/ugc/admin/KanbanBoard";
import { STAFF_ROLE_LABEL } from "@/lib/ugc/content-meta";
import type { ContentPriority } from "@/lib/database.types";
import styles from "../qos.module.css";

export const dynamic = "force-dynamic";

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<{ brand?: string; owner?: string; priority?: string }>;
}) {
  const { brand, owner, priority } = await searchParams;
  const supabase = await createClient();

  const [{ data: agencyClients }, { data: staffMembers }, piecesQuery] = await Promise.all([
    supabase.from("agency_clients").select("id, name").order("name"),
    supabase.from("staff_members").select("profile_id, staff_role, color").eq("active", true),
    (() => {
      let query = supabase.from("content_pieces").select("*").order("created_at", { ascending: false });
      if (brand) query = query.eq("brand_id", brand);
      if (owner) query = query.eq("owner_id", owner);
      if (priority) query = query.eq("priority", priority as ContentPriority);
      return query;
    })(),
  ]);

  const { data: contentPieces } = piecesQuery;

  const staffIds = (staffMembers ?? []).map((s) => s.profile_id);
  const { data: staffAccountProfiles } = staffIds.length
    ? await supabase.from("profiles").select("id, display_name").in("id", staffIds)
    : { data: [] };
  const staffNameById = new Map((staffAccountProfiles ?? []).map((p) => [p.id, p.display_name]));

  const brands = (agencyClients ?? []).map((c) => ({ id: c.id, name: c.name }));
  const staff = (staffMembers ?? []).map((s) => ({
    id: s.profile_id,
    name: staffNameById.get(s.profile_id) ?? "Sin nombre",
    role: STAFF_ROLE_LABEL[s.staff_role],
    color: s.color,
  }));

  return (
    <div>
      <form className={styles.pipeToolbar} method="get">
        <select name="brand" defaultValue={brand ?? ""} className={styles.selectInp}>
          <option value="">Todos los Heroes</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>

        <select name="owner" defaultValue={owner ?? ""} className={styles.selectInp}>
          <option value="">Todos los responsables</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        <select name="priority" defaultValue={priority ?? ""} className={styles.selectInp}>
          <option value="">Toda prioridad</option>
          <option value="alta">Alta</option>
          <option value="media">Media</option>
          <option value="baja">Baja</option>
        </select>

        <button type="submit" className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}>
          Filtrar
        </button>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "10px" }}>
          <span className={styles.chip}>{contentPieces?.length ?? 0} piezas en flujo</span>
        </div>
      </form>

      <KanbanBoard pieces={contentPieces ?? []} brands={brands} staff={staff} />
    </div>
  );
}
