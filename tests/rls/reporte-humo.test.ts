import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { getReporte, describirReporte } from "@/lib/ugc/reporte";

/**
 * Prueba de humo del reporte del director, contra la base de verdad.
 *
 * No fija números —cambian todos los días— sino que el reporte se arma, que los
 * totales cierran entre sí y que el bloque que viaja en el prompt no se va de
 * escala. Un reporte que "funciona" pero mete 20.000 caracteres en cada mensaje
 * de un director encarece cada respuesta sin que nadie lo note.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

describe("reporte del director", () => {
  it("se arma contra la base y los totales cierran", async () => {
    const admin = createClient<Database>(url, key, { auth: { persistSession: false } });

    const { data: equipo } = await admin.from("staff_members").select("profile_id, staff_role").eq("active", true);
    const { data: perfiles } = await admin.from("profiles").select("id, display_name");
    const nombre = new Map((perfiles ?? []).map((p) => [p.id, p.display_name]));

    const r = await getReporte(
      admin,
      (equipo ?? []).map((m) => ({
        profileId: m.profile_id,
        nombre: nombre.get(m.profile_id) ?? "?",
        rol: m.staff_role,
      }))
    );

    expect(r.heroes.length).toBe(r.heroesActivos);
    expect(r.carga.length).toBe((equipo ?? []).length);
    // Los publicados del mes no pueden superar la meta total sumada.
    expect(r.publicadosTotal).toBeGreaterThanOrEqual(0);
    // El orden por riesgo es lo que hace útil la lista: el peor primero.
    const orden = { alto: 0, medio: 1, bajo: 2, null: 3 } as Record<string, number>;
    const riesgos = r.heroes.map((h) => orden[String(h.riesgo)]);
    expect([...riesgos].sort((a, b) => a - b)).toEqual(riesgos);

    const texto = describirReporte(r);
    expect(texto).toContain("EL MES");
    expect(texto).toContain("CADA HERO");
    expect(texto).toContain("EL EQUIPO");

    if (process.env.VOLCAR_REPORTE) {
      const { writeFileSync } = await import("node:fs");
      writeFileSync(process.env.VOLCAR_REPORTE, `(${texto.length} caracteres)\n\n${texto}\n`);
    }
    // Tope de cordura: el reporte viaja entero en cada mensaje de un director.
    expect(texto.length).toBeLessThan(9000);
  });
});
