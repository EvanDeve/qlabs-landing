import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !ANON || !SERVICE) {
  throw new Error(
    "Faltan NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY o SUPABASE_SERVICE_ROLE_KEY.\n" +
      "Corré con: node --env-file=.env.local ... (ver package.json → test:rls)"
  );
}

/** Cliente con service role: SALTA RLS. Solo para montar y desmontar el escenario. */
export const admin: SupabaseClient = createClient(URL, SERVICE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** Cliente anónimo: el visitante sin sesión. Sujeto a RLS como cualquiera. */
export function anonClient(): SupabaseClient {
  return createClient(URL!, ANON!, { auth: { persistSession: false, autoRefreshToken: false } });
}

export type TestUser = {
  id: string;
  email: string;
  /** Cliente autenticado como este usuario: sujeto a RLS con su propio rol. */
  client: SupabaseClient;
};

// Rastro de todo lo creado, para que el teardown no dependa de que los tests
// hayan pasado. Borrar el auth.user alcanza: profiles.id referencia
// auth.users(id) on delete cascade, y el resto del marketplace cuelga de ahí.
const created: string[] = [];

export async function makeUser(role: "creator" | "brand" | "admin"): Promise<TestUser> {
  const email = `rlstest.${role}.${randomUUID()}@testmail.cr`;
  const password = randomUUID();

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    // El trigger handle_new_user copia esto a profiles.role.
    user_metadata: { role },
  });
  if (error || !data.user) throw new Error(`No se pudo crear el usuario de prueba: ${error?.message}`);
  created.push(data.user.id);

  const client = anonClient();
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw new Error(`No se pudo iniciar sesión de prueba: ${signInError.message}`);

  return { id: data.user.id, email, client };
}

export async function cleanup() {
  const errores: string[] = [];
  for (const id of created.splice(0)) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) errores.push(`${id}: ${error.message}`);
  }
  // Que se vea fuerte: dejar cuentas colgando en el proyecto real no es
  // aceptable, y el proyecto real es también producción.
  if (errores.length) throw new Error(`Quedaron cuentas de prueba sin borrar:\n${errores.join("\n")}`);
}

/** Verifica a un creador como lo haría un admin desde el panel. */
export async function verifyCreator(profileId: string) {
  const { error } = await admin.from("creator_profiles").update({ verified: true }).eq("profile_id", profileId);
  if (error) throw error;
}
