import { describe, it, expect, afterAll, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";

// El envío se mockea a propósito: este test corre contra el proyecto Supabase
// REAL (no hay staging) y sin el mock le mandaría un correo de prueba a todo el
// equipo en cada corrida. Mockeado además podemos afirmar QUÉ dice el correo,
// que es lo que de verdad importa acá.
const enviados: { to: string; subject: string; html: string }[] = [];
vi.mock("@/lib/email/resend", () => ({
  sendTransactionalEmail: async (to: string, subject: string, html: string) => {
    enviados.push({ to, subject, html });
  },
  getUserEmail: async (userId: string) => `${userId}@ejemplo.test`,
}));

const { notifyAdminsOfPendingVerification, VERIFICATION_PENDING } = await import(
  "@/lib/ugc/admin-alerts"
);

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const MARCA_DE_PRUEBA = `__test_${crypto.randomUUID()}`;
const CREADOR_DE_PRUEBA = `__test_${crypto.randomUUID()}`;

afterAll(async () => {
  const { error } = await admin
    .from("notifications")
    .delete()
    .eq("type", VERIFICATION_PENDING)
    .in("payload->>subject_name", [MARCA_DE_PRUEBA, CREADOR_DE_PRUEBA]);
  if (error) throw new Error(`no se limpiaron las notificaciones de prueba: ${error.message}`);
});

describe("aviso de verificación pendiente", () => {
  it("le crea una notificación a cada admin, y solo a los admins", async () => {
    const { data: admins } = await admin.from("profiles").select("id").eq("role", "admin");
    expect(admins?.length ?? 0).toBeGreaterThan(0);

    await notifyAdminsOfPendingVerification({
      profileId: crypto.randomUUID(),
      role: "brand",
      name: MARCA_DE_PRUEBA,
      detail: "Industria de prueba",
    });

    const { data: rows } = await admin
      .from("notifications")
      .select("profile_id, type, payload, read")
      .eq("payload->>subject_name", MARCA_DE_PRUEBA);

    // Uno por admin, ninguno de más — y a nadie que no sea admin.
    expect(rows?.length).toBe(admins!.length);
    expect(new Set(rows!.map((r) => r.profile_id))).toEqual(new Set(admins!.map((a) => a.id)));

    // El payload tiene que traer lo que la campana necesita para armar el texto
    // y el link; si falta subject_role el aviso sale mal redactado.
    const row = rows![0];
    expect(row.type).toBe(VERIFICATION_PENDING);
    expect(row.read).toBe(false);
    expect((row.payload as Record<string, unknown>).subject_role).toBe("brand");
    expect((row.payload as Record<string, unknown>).subject_detail).toBe("Industria de prueba");

    // Un correo por admin, y dice qué queda bloqueado. Desde el bloqueo duro
    // (migración 20260807000000) el bloqueo ya no es por acción —publicar,
    // aplicar— sino la entrada entera: el aviso tiene que decir eso, porque es
    // lo que le marca al equipo la urgencia de revisar.
    expect(enviados.length).toBe(admins!.length);
    expect(enviados[0].subject).toContain(MARCA_DE_PRUEBA);
    expect(enviados[0].subject).toContain("marca");
    expect(enviados[0].html).toContain("no puede entrar al panel");
    expect(enviados[0].html).toContain("/ugc/admin/marketplace");
  });

  it("le cambia el texto según sea creador o marca", async () => {
    enviados.length = 0;

    await notifyAdminsOfPendingVerification({
      profileId: crypto.randomUUID(),
      role: "creator",
      name: CREADOR_DE_PRUEBA,
      detail: "Heredia",
    });

    expect(enviados[0].subject).toContain("creador");
    expect(enviados[0].subject).not.toContain("marca");
    expect(enviados[0].html).toContain("no puede entrar al panel");
    expect(enviados[0].html).toContain("Ciudad: Heredia");
  });
});
