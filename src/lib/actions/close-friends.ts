"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { ResultadoReclamo } from "@/lib/database.types";
import type { ReclamarState } from "@/lib/actions/loyalty";
import { qrSvg } from "@/lib/ugc/loyalty";
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

  const { data, error } = await supabase.rpc("completar_registro_miembro", {
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

  redirect(destinoTrasUnirse(data?.cupon ?? null));
}

/**
 * A dónde ir después de unirse por un QR. Si el QR traía un cupón, la wallet lo
 * anuncia: "se agregó" o por qué no (agotado, vencido). `?cupon=` lo lee el
 * Inicio de /cf; no lleva el código ni ids, solo el resultado.
 */
function destinoTrasUnirse(cupon: ResultadoReclamo | null): string {
  if (!cupon) return "/cf?unido=1";
  if (cupon.ok) return `/cf?cupon=${cupon.nuevo ? "nuevo" : "ya_estaba"}`;
  return `/cf?cupon=${cupon.motivo}`;
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
  const { data, error } = await supabase.rpc("completar_registro_miembro", {
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
  redirect(destinoTrasUnirse(data?.cupon ?? null));
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

// ---------------------------------------------------------------------------
// Adentro del panel
// ---------------------------------------------------------------------------

/**
 * Reclamar un cupón desde "Disponibles". Mismo contrato que el del creador
 * (`reclamarCuponAction`) para que la grilla sea la misma: toda la regla vive
 * en `claim_coupon_member`, y su mensaje se muestra tal cual.
 */
export async function reclamarCuponMiembroAction(_prev: ReclamarState, formData: FormData): Promise<ReclamarState> {
  const couponId = String(formData.get("coupon_id") ?? "");
  if (!couponId) return { error: "Cupón inválido." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("claim_coupon_member", { p_coupon: couponId });
  if (error) {
    const esperado = error.message?.trim();
    return { error: esperado && esperado.length < 120 ? esperado : "No se pudo reclamar el cupón. Intentá de nuevo." };
  }
  if (!data?.code) return { error: "No se pudo reclamar el cupón. Intentá de nuevo." };

  revalidatePath("/cf", "layout");
  return { reclamo: { code: data.code, expires_at: data.expires_at, qr: await qrSvg(data.code) } };
}

export type EstadoPerfil = { error?: string; ok?: string } | null;

/**
 * Editar nombre, WhatsApp y nombre de agente. Va con el cliente de sesión: los
 * grants por columna de `members` son los que deciden qué se puede tocar
 * (ver 20260924120000), no este action.
 */
export async function actualizarPerfilMiembroAction(_prev: EstadoPerfil, formData: FormData): Promise<EstadoPerfil> {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const phone = telefonoCR(String(formData.get("phone") ?? ""));
  const agentName = String(formData.get("agent_name") ?? "").trim();

  if (fullName.length < 2 || fullName.length > 80) return { error: "Poné tu nombre." };
  if (!phone) return { error: "Revisá tu WhatsApp: tiene que ser un número de Costa Rica de 8 dígitos." };
  if (!/^[A-Za-z0-9ÁÉÍÓÚÑÜáéíóúñü._]{3,20}$/.test(agentName)) {
    return { error: "El nombre de agente va de 3 a 20 caracteres: letras, números, punto o guion bajo." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/cf/entrar");

  const { data: filas, error } = await supabase
    .from("members")
    .update({ full_name: fullName, phone, agent_name: agentName })
    .eq("profile_id", user.id)
    // Un UPDATE que la RLS no deja pasar no es un error: son cero filas.
    .select("profile_id");

  if (error?.code === "23505") return { error: "Ese nombre de agente ya está tomado. Probá con otro." };
  if (error || !filas?.length) return { error: "No se pudo guardar. Intentá de nuevo." };

  // El saludo de la barra lateral sale de `profiles.display_name`.
  await supabase.from("profiles").update({ display_name: agentName }).eq("id", user.id);

  revalidatePath("/cf", "layout");
  return { ok: "Guardado." };
}

/**
 * Prender o apagar un permiso opcional. Cada cambio es una fila nueva en
 * `member_consents` con la versión del texto: el historial queda.
 */
export async function cambiarConsentimientoAction(formData: FormData): Promise<{ error?: string }> {
  const kind = String(formData.get("kind") ?? "");
  if (kind !== "share_with_brand" && kind !== "whatsapp_marketing") return { error: "Permiso inválido." };
  const brand = String(formData.get("brand_id") ?? "") || null;

  const supabase = await createClient();
  const { error } = await supabase.rpc("cambiar_consentimiento", {
    p_kind: kind,
    p_brand: kind === "share_with_brand" ? brand : null,
    p_granted: formData.get("granted") === "true",
    p_version_textos: VERSION_TEXTOS,
  });
  if (error) return { error: error.message };

  revalidatePath("/cf/perfil");
  return {};
}

export async function pedirEliminacionAction(_prev: EstadoPerfil, formData: FormData): Promise<EstadoPerfil> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("pedir_eliminacion_miembro", {
    p_reason: String(formData.get("reason") ?? "").trim() || null,
  });
  if (error) return { error: error.message };

  revalidatePath("/cf", "layout");
  return { ok: "Listo. Recibimos tu pedido." };
}
