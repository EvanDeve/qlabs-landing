import Link from "next/link";
import { requireDirector } from "@/lib/auth/require-director";
import { NuevoBoardForm, EditarBoardForm, type PersonaDelEquipo } from "@/components/ugc/admin/BoardsForms";
import { STAFF_ROLE_LABEL } from "@/lib/ugc/content-meta";
import styles from "@/styles/qos.module.css";

export const dynamic = "force-dynamic";

const BOARDS_FIJOS = new Set(["video", "guion", "it", "admin"]);

/**
 * Los boards del Pipeline y quién entra a cada uno. Solo directores: la RLS de
 * pipeline_boards y pipeline_board_members tampoco deja escribir a nadie más.
 */
export default async function BoardsPage() {
  const { supabase } = await requireDirector();

  const [{ data: boards }, { data: miembros }, { data: staff }, { data: columnas }, { data: piezas }] =
    await Promise.all([
      supabase.from("pipeline_boards").select("id, name, kind").order("position").order("created_at"),
      supabase.from("pipeline_board_members").select("board_id, profile_id"),
      supabase.from("staff_members").select("profile_id, staff_role, active").eq("active", true),
      supabase.from("content_columns").select("id, section"),
      // Solo para contar tarjetas por board: el id y la columna alcanzan.
      supabase.from("content_pieces").select("column_id"),
    ]);

  const ids = (staff ?? []).map((s) => s.profile_id);
  const { data: perfiles } = ids.length
    ? await supabase.from("profiles").select("id, display_name").in("id", ids)
    : { data: [] };
  const nombrePorId = new Map((perfiles ?? []).map((p) => [p.id, p.display_name ?? "Sin nombre"]));

  // Los directores primero (entran a todo), después el resto por nombre.
  const equipo: PersonaDelEquipo[] = (staff ?? [])
    .map((s) => ({
      id: s.profile_id,
      name: nombrePorId.get(s.profile_id) ?? "Sin nombre",
      role: STAFF_ROLE_LABEL[s.staff_role],
      director: s.staff_role === "director",
    }))
    .sort((a, b) => Number(b.director) - Number(a.director) || a.name.localeCompare(b.name, "es"));

  const boardDeColumna = new Map((columnas ?? []).map((c) => [c.id, c.section]));
  const tarjetasPorBoard = new Map<string, number>();
  for (const p of piezas ?? []) {
    const board = boardDeColumna.get(p.column_id);
    if (board) tarjetasPorBoard.set(board, (tarjetasPorBoard.get(board) ?? 0) + 1);
  }

  const miembrosPorBoard = new Map<string, string[]>();
  for (const m of miembros ?? []) {
    miembrosPorBoard.set(m.board_id, [...(miembrosPorBoard.get(m.board_id) ?? []), m.profile_id]);
  }

  return (
    <div style={{ maxWidth: "860px" }}>
      <p style={{ marginBottom: "16px" }}>
        <Link href="/admin/pipeline" className={styles.attnMeta}>
          ← Volver al Pipeline
        </Link>
      </p>

      <div className={`${styles.card} ${styles.cardPad}`} style={{ marginBottom: "24px" }}>
        <div className={styles.sectionHead}>
          <h2>Nuevo board</h2>
        </div>
        <p style={{ fontSize: "12.5px", color: "var(--ink-3)", marginBottom: "16px" }}>
          Arranca con tres columnas (Sin Empezar, En Progreso, Terminado) que después se pueden cambiar desde el
          tablero. Solo lo ven las personas que marques; los directores entran a todos.
        </p>
        <NuevoBoardForm equipo={equipo} />
      </div>

      {(boards ?? []).map((b) => (
        <EditarBoardForm
          key={b.id}
          board={b}
          equipo={equipo}
          miembros={miembrosPorBoard.get(b.id) ?? []}
          tarjetas={tarjetasPorBoard.get(b.id) ?? 0}
          fijo={BOARDS_FIJOS.has(b.id)}
        />
      ))}
    </div>
  );
}
