import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { STAFF_ROLE_LABEL, hrefDelPipeline } from "@/lib/ugc/content-meta";
import ContentPieceEditor from "@/components/ugc/admin/ContentPieceEditor";

export const dynamic = "force-dynamic";

/**
 * El detalle de una pieza, con URL propia.
 *
 * Antes era un panel lateral dentro del tablero. Tener ruta es lo que permite
 * mandar a alguien directo a una tarjeta: el Dashboard lo usa desde "Requiere
 * tu atención" —que antes llevaba al expediente del Hero, o sea al lugar
 * equivocado— y sirve para pasarle un link a un compañero por WhatsApp.
 *
 * Vive bajo /pipeline para que el menú siga marcando Pipeline y el rastro de la
 * barra diga de dónde viene.
 */
export default async function PiezaPage({
  params,
  searchParams,
}: {
  params: Promise<{ pieceId: string }>;
  /**
   * `volver` es el query del tablero de donde se vino (pestaña, filtros y
   * búsqueda). Viaja porque esta pantalla tiene URL propia: sin él, salir de la
   * pieza devolvía el Pipeline sin filtros y había que armarlos de nuevo.
   * Puede faltar —se puede llegar acá desde el Dashboard o por un link de
   * WhatsApp— y entonces se vuelve al tablero sin recortes.
   */
  searchParams: Promise<{ volver?: string }>;
}) {
  const [{ pieceId }, { volver }] = await Promise.all([params, searchParams]);

  // La forma se valida antes de consultar: `id` es uuid, y cualquier otra cosa
  // hace fallar la consulta en Postgres —error 500— en vez de devolver vacío,
  // que es lo que corresponde a "esta pieza no existe".
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pieceId)) notFound();

  const supabase = await createClient();

  const [{ data: piece }, { data: columns }, { data: brands }, { data: staff }] = await Promise.all([
    supabase.from("content_pieces").select("*").eq("id", pieceId).maybeSingle(),
    supabase.from("content_columns").select("*").order("position", { ascending: true }),
    // Archivados incluidos: si la pieza pertenece a un Hero archivado, su
    // nombre tiene que seguir apareciendo en el select o el formulario mandaría
    // la pieza al primer Hero de la lista al guardar.
    supabase.from("agency_clients").select("id, name").order("name"),
    supabase.from("staff_directory").select("profile_id, staff_role, color").eq("active", true),
  ]);

  if (!piece) notFound();

  const staffIds = (staff ?? []).map((s) => s.profile_id);
  const { data: perfiles } = staffIds.length
    ? await supabase.from("profiles").select("id, display_name").in("id", staffIds)
    : { data: [] };
  const nombrePorId = new Map((perfiles ?? []).map((p) => [p.id, p.display_name]));

  return (
    <ContentPieceEditor
      piece={piece}
      volverHref={hrefDelPipeline(volver)}
      columns={columns ?? []}
      brands={brands ?? []}
      staff={(staff ?? []).map((s) => ({
        id: s.profile_id,
        name: nombrePorId.get(s.profile_id) ?? "Sin nombre",
        role: STAFF_ROLE_LABEL[s.staff_role],
        color: s.color,
      }))}
    />
  );
}
