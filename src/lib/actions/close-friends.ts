"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { destinoDeSesion } from "@/lib/ugc/estado-cuenta";
import { VERSION_TEXTOS } from "@/lib/cf/copy";
import { frenoEntrar, frenoRegistro } from "@/lib/cf/freno";
import {
  datosDelFormulario,
  limpiarCodigoInvitacion,
  problemaDelRegistro,
  telefonoCR,
} from "@/lib/cf/registro";

/**
 * El alta de Close Friends, en dos pasos y con la autenticación que ya usa el
 * proyecto (Supabase Auth), sin contraseña:
 *
 *   1. `pedirCodigoAction` valida el formulario y le manda a la persona un
 *      código por correo (Supabase → SMTP de Resend). El largo lo define
 *      Supabase (Auth → Email → "Email OTP Length", de 6 a 10): el código acepta
 *      de 6 a 10 dígitos para no romperse si alguien lo cambia ahí.
 *   2. `verificarCodigoAction` canjea ese código por la sesión y recién ahí
 *      llama a `completar_registro_miembro`, que es la que decide todo de nuevo
 *      en la base: código QR activo, edad, alias libre, que la cuenta no sea de
 *      creador o marca.
 *
 * Entre un paso y otro los datos viajan en el formulario (campos ocultos), no
 * en una tabla: todavía no hay nadie a quien atarlos, y la función de la base
 * vuelve a validar todo lo que llega.
 */

export type EstadoRegistro =
  | { paso: "datos"; error?: string }
  | { paso: "codigo"; email: string; enviadoEn: number; error?: string; aviso?: string };

/** Cualquier largo que Supabase permita configurar para el código por correo. */
const OTP_VALIDO = /^\d{6,10}$/;

/** Los mensajes de Supabase Auth vienen en inglés y no son para la persona. */
function mensajeDeAuth(message: string, status?: number): string {
  if (status === 429 || /security purposes|rate limit/i.test(message)) {
    return "Pediste un código hace poco. Esperá un minuto y probá de nuevo.";
  }
  if (/expired|invalid/i.test(message)) return "Ese código no es válido o ya venció. Revisalo o pedí otro.";
  return "No pudimos mandarte el código. Intentá de nuevo en un momento.";
}

// ---------------------------------------------------------------------------
// Registro por QR
// ---------------------------------------------------------------------------

/**
 * Un solo action para el formulario de registro: el paso lo dice el propio
 * formulario (`paso`). Así el componente tiene un único estado y "Reenviar" es
 * simplemente volver a pedir con los mismos datos.
 */
export async function registroAction(prev: EstadoRegistro, formData: FormData): Promise<EstadoRegistro> {
  const paso = String(formData.get("paso") ?? "");
  if (paso === "codigo") return verificarCodigoAction(prev, formData);
  const estado = await pedirCodigoAction(prev, formData);
  if (paso === "reenviar" && estado.paso === "codigo") {
    return { ...estado, aviso: "Te mandamos un código nuevo." };
  }
  return estado;
}

async function pedirCodigoAction(_prev: EstadoRegistro, formData: FormData): Promise<EstadoRegistro> {
  const codigo = limpiarCodigoInvitacion(String(formData.get("codigo") ?? ""));
  if (!codigo) return { paso: "datos", error: "Este código de invitación no es válido." };

  const datos = datosDelFormulario(formData);
  const problema = problemaDelRegistro(datos);
  if (problema) return { paso: "datos", error: problema };

  if (!(await frenoRegistro(codigo))) {
    return { paso: "datos", error: "Hubo demasiados intentos desde acá. Probá de nuevo en un rato." };
  }

  // El QR se vuelve a mirar: entre que abrió la página y mandó el formulario la
  // marca pudo desactivarlo.
  const admin = createAdminClient();
  const [{ data: invitacion }, { data: libre }] = await Promise.all([
    admin.rpc("invitacion_publica", { p_code: codigo }),
    admin.rpc("agente_disponible", { p_agent_name: datos.agentName }),
  ]);
  if (!invitacion) {
    return { paso: "datos", error: "Este código de invitación ya no está activo. Pedile al negocio uno nuevo." };
  }
  if (libre === false) return { paso: "datos", error: "Ese nombre de agente ya está tomado. Probá con otro." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: datos.email,
    options: { shouldCreateUser: true },
  });
  if (error) {
    console.error("[pedirCodigoAction] signInWithOtp:", error.status, error.message);
    return { paso: "datos", error: mensajeDeAuth(error.message, error.status) };
  }

  return { paso: "codigo", email: datos.email, enviadoEn: Date.now() };
}

async function verificarCodigoAction(_prev: EstadoRegistro, formData: FormData): Promise<EstadoRegistro> {
  const codigo = limpiarCodigoInvitacion(String(formData.get("codigo") ?? ""));
  const datos = datosDelFormulario(formData);
  const token = String(formData.get("token") ?? "").replace(/\D/g, "");

  if (!codigo) return { paso: "datos", error: "Este código de invitación no es válido." };
  // `enviadoEn` se conserva: equivocarse de código no reinicia la espera para reenviar.
  const enviadoEn = _prev.paso === "codigo" ? _prev.enviadoEn : Date.now();
  if (!OTP_VALIDO.test(token)) return { paso: "codigo", email: datos.email, enviadoEn, error: "Revisá el código: son solo números." };

  const supabase = await createClient();
  const { error: authError } = await supabase.auth.verifyOtp({ email: datos.email, token, type: "email" });
  if (authError) {
    return { paso: "codigo", email: datos.email, enviadoEn, error: mensajeDeAuth(authError.message, authError.status) };
  }

  const { error } = await supabase.rpc("completar_registro_miembro", {
    p_code: codigo,
    p_full_name: datos.fullName,
    p_phone: telefonoCR(datos.phone),
    p_birthdate: datos.birthdate,
    p_agent_name: datos.agentName,
    p_acepta_terminos: datos.aceptaTerminos,
    p_comparte_con_marca: datos.comparteConMarca,
    p_whatsapp: datos.whatsapp,
    p_version_textos: VERSION_TEXTOS,
  });

  if (error) {
    // La sesión se cierra: la cuenta quedó verificada pero sin rol, y si se
    // quedara abierta la persona andaría logueada sin ser nada. El próximo
    // intento vuelve a pedir código y termina bien.
    await supabase.auth.signOut();
    // Dos altas simultáneas con el mismo alias: el unique de la base gana.
    const mensaje =
      error.code === "23505" ? "Ese nombre de agente ya está tomado. Probá con otro." : error.message;
    return { paso: "datos", error: mensaje };
  }

  redirect("/cf");
}

// ---------------------------------------------------------------------------
// Unirse a otro negocio con la sesión ya abierta
// ---------------------------------------------------------------------------

export type EstadoUnirme = { error?: string } | null;

/**
 * Un miembro que escanea el QR de otro negocio no llena nada de nuevo: un toque
 * y queda vinculado. Solo se le pregunta lo que es por negocio, compartir sus
 * datos con ESTE negocio.
 */
export async function unirmeConSesionAction(_prev: EstadoUnirme, formData: FormData): Promise<EstadoUnirme> {
  const codigo = limpiarCodigoInvitacion(String(formData.get("codigo") ?? ""));
  if (!codigo) return { error: "Este código de invitación no es válido." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("completar_registro_miembro", {
    p_code: codigo,
    p_full_name: null,
    p_phone: null,
    p_birthdate: null,
    p_agent_name: null,
    p_acepta_terminos: true,
    p_comparte_con_marca: formData.get("comparte_con_marca") === "on",
    p_whatsapp: false,
    p_version_textos: VERSION_TEXTOS,
  });

  if (error) return { error: error.message };
  redirect("/cf");
}

// ---------------------------------------------------------------------------
// Entrar (cuenta que ya existe)
// ---------------------------------------------------------------------------

export type EstadoEntrar =
  | { paso: "email"; error?: string }
  | { paso: "codigo"; email: string; error?: string };

export async function entrarAction(prev: EstadoEntrar, formData: FormData): Promise<EstadoEntrar> {
  return String(formData.get("paso") ?? "") === "codigo"
    ? entrarVerificarAction(prev, formData)
    : entrarPedirCodigoAction(prev, formData);
}

async function entrarPedirCodigoAction(_prev: EstadoEntrar, formData: FormData): Promise<EstadoEntrar> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { paso: "email", error: "Revisá tu correo." };

  if (!(await frenoEntrar())) {
    return { paso: "email", error: "Hubo demasiados intentos desde acá. Probá de nuevo en un rato." };
  }

  // shouldCreateUser: false — acá no se crean cuentas; eso es por el QR.
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });

  // Si el correo no tiene cuenta, Supabase da error. Se contesta IGUAL que si
  // la tuviera: si no, esta pantalla serviría para averiguar quién es miembro.
  // Solo el freno de reenvío se muestra, porque ese solo le pasa a quien sí
  // pidió un código hace nada.
  if (error && (error.status === 429 || /security purposes|rate limit/i.test(error.message))) {
    return { paso: "email", error: mensajeDeAuth(error.message, error.status) };
  }
  if (error) console.error("[entrarPedirCodigoAction] signInWithOtp:", error.status, error.message);

  return { paso: "codigo", email };
}

async function entrarVerificarAction(_prev: EstadoEntrar, formData: FormData): Promise<EstadoEntrar> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const token = String(formData.get("token") ?? "").replace(/\D/g, "");
  if (!OTP_VALIDO.test(token)) return { paso: "codigo", email, error: "Revisá el código: son solo números." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error || !data.user) {
    return { paso: "codigo", email, error: mensajeDeAuth(error?.message ?? "invalid", error?.status) };
  }

  // Una cuenta de creador o marca que entre por acá va a su panel, como hace
  // /admin/login con una cuenta que no es del equipo: sin error, sin confirmar
  // nada. Una cuenta sin rol (se verificó pero el alta falló) no tiene adónde
  // ir en /cf: se cierra y se le pide que escanee el QR otra vez.
  const destino = await destinoDeSesion(supabase, data.user.id);
  if (destino === "/ugc/onboarding") {
    await supabase.auth.signOut();
    return {
      paso: "email",
      error: "Todavía no terminaste de unirte. Escaneá de nuevo el QR del negocio para completar tu registro.",
    };
  }
  // Si venía de un QR (entró para unirse a otro negocio), vuelve a ese QR.
  const next = String(formData.get("next") ?? "");
  if (destino === "/cf" && /^\/cf\/unirme\/[A-Z0-9]{10}$/.test(next)) redirect(next);
  redirect(destino);
}

/**
 * Cerrar sesión. Desde la página de un QR (alguien con la sesión de su cuenta
 * de creador o marca que quiere unirse con otro correo) vuelve a ese QR.
 */
export async function salirCfAction(formData: FormData) {
  const codigo = limpiarCodigoInvitacion(String(formData.get("codigo") ?? ""));
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(codigo ? `/cf/unirme/${codigo}` : "/cf/entrar");
}
