"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type AgentSettingsState = { error: string } | { message: string } | null;

/** Topes de longitud. No son de seguridad: son para que el prompt no se vaya de escala. */
const MAX_NOMBRE = 40;
const MAX_TEXTO = 4000;

/**
 * Guarda la personalidad del agente.
 *
 * La escritura va con el cliente de sesión, no con el service-role: la policy
 * `agent_settings_update_director` es la que autoriza, así que alguien del
 * equipo que no sea director y llegara a invocar esta acción no escribe nada.
 * Con service-role tendríamos que reimplementar el chequeo de rol acá y confiar
 * en no habernos olvidado.
 *
 * Lo que se guarda es solo la capa editable. Las reglas que impiden que el
 * agente invente clientes o prometa trabajo viven en REGLAS_FIJAS
 * (src/lib/ugc/agente.ts) y no se pueden tocar desde acá — junto con que la
 * validación real de las acciones es código, no prompt.
 */
export async function saveAgentSettingsAction(
  _prevState: AgentSettingsState,
  formData: FormData
): Promise<AgentSettingsState> {
  const nombre = String(formData.get("nombre") ?? "").trim();
  const persona = String(formData.get("persona") ?? "").trim();
  const instrucciones = String(formData.get("instrucciones") ?? "").trim();
  const sobreQlabs = String(formData.get("sobre_qlabs") ?? "").trim();
  const guionPublico = String(formData.get("guion_publico") ?? "").trim();
  const linkAgenda = String(formData.get("link_agenda") ?? "").trim();
  const responderDesconocidos = formData.get("responder_desconocidos") === "on";

  if (!nombre) return { error: "El nombre no puede quedar vacío." };
  if (nombre.length > MAX_NOMBRE) return { error: `El nombre no puede pasar de ${MAX_NOMBRE} caracteres.` };
  if ([persona, instrucciones, sobreQlabs, guionPublico].some((t) => t.length > MAX_TEXTO)) {
    return { error: `Cada texto puede tener hasta ${MAX_TEXTO} caracteres.` };
  }

  // Un "calendly.com/q-labs" sin esquema no es clickeable en WhatsApp, y el
  // agente lo mandaría igual: nadie se enteraría hasta que alguien no pudiera
  // agendar. La base tiene el mismo check; este es para que el error se vea acá.
  if (linkAgenda && !/^https:\/\/[^\s]+$/.test(linkAgenda)) {
    return { error: "El link tiene que empezar con https:// y no llevar espacios." };
  }

  // El interruptor no se puede prender sin haber escrito qué decir. Es el mismo
  // chequeo que hace el webhook antes de contestar, repetido acá para que el
  // error se vea en el formulario y no en un silencio inexplicable.
  if (responderDesconocidos && !sobreQlabs) {
    return { error: "Para que le conteste a gente de afuera primero tenés que escribir qué decir sobre Q Labs." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sesión vencida. Volvé a entrar." };

  const { error } = await supabase
    .from("agent_settings")
    .update({
      nombre,
      persona,
      instrucciones,
      sobre_qlabs: sobreQlabs,
      guion_publico: guionPublico,
      link_agenda: linkAgenda,
      responder_desconocidos: responderDesconocidos,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    })
    .eq("id", true);

  if (error) {
    console.error("[agent-settings] no se pudo guardar:", error.message);
    return { error: "No se pudo guardar. Intentá de nuevo." };
  }

  revalidatePath("/ugc/admin/mclovin");
  return { message: "Guardado. Va a usarlo en el próximo mensaje." };
}
