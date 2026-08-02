import { createClient } from "@/lib/supabase/server";
import KanbanBoard from "@/components/ugc/admin/KanbanBoard";
import PipelineFilters from "@/components/ugc/admin/PipelineFilters";
import { STAFF_ROLE_LABEL } from "@/lib/ugc/content-meta";
import type { ContentPriority } from "@/lib/database.types";

export const dynamic = "force-dynamic";

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<{ brand?: string; owner?: string; priority?: string }>;
}) {
  const { brand, owner, priority } = await searchParams;
  const supabase = await createClient();

  const [{ data: agencyClients }, { data: staffMembers }, { data: columns }, piecesQuery] =
    await Promise.all([
    supabase.from("agency_clients").select("id, name, logo_url").order("name"),
    supabase.from("staff_members").select("profile_id, staff_role, color").eq("active", true),
    supabase.from("content_columns").select("*").order("position", { ascending: true }),
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

  const brands = (agencyClients ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    logoUrl: c.logo_url,
  }));
  const staff = (staffMembers ?? []).map((s) => ({
    id: s.profile_id,
    name: staffNameById.get(s.profile_id) ?? "Sin nombre",
    role: STAFF_ROLE_LABEL[s.staff_role],
    color: s.color,
  }));

  return (
    <div>
      <PipelineFilters
        brands={brands}
        staff={staff}
        brand={brand}
        owner={owner}
        priority={priority}
        count={contentPieces?.length ?? 0}
      />

      <KanbanBoard
        pieces={contentPieces ?? []}
        columns={columns ?? []}
        brands={brands}
        staff={staff}
      />
    </div>
  );
}
