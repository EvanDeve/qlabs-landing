/**
 * Visitas del media kit: cuántas veces se abrió el kit de un creador en los
 * últimos 30 días y cuántas de esas fueron de marcas.
 *
 * El número es orientativo (lo dice la spec): un bot que no se identifica se
 * cuela. Lo que sí no puede pasar es contar la vista previa que arma WhatsApp
 * cada vez que alguien pega el link.
 */

// Ojo: NO hay "instagram" ni "FBAN" acá. El navegador interno de Instagram y
// Facebook es una persona que tocó el link de la bio, justo la visita que el
// creador quiere ver.
const BOTS = new RegExp(
  [
    "facebookexternalhit",
    "facebookcatalog",
    "meta-externalagent",
    "Facebot",
    "^WhatsApp/",
    "Twitterbot",
    "Slackbot",
    "Slack-ImgProxy",
    "TelegramBot",
    "Googlebot",
    "Google-InspectionTool",
    "AdsBot-Google",
    "bingbot",
    "LinkedInBot",
    "Discordbot",
    "Applebot",
    "DuckDuckBot",
    "YandexBot",
    "Baiduspider",
    "SkypeUriPreview",
    "Pinterestbot",
    "redditbot",
    "Embedly",
    "HeadlessChrome",
    "bot/",
    "crawler",
    "spider",
  ].join("|"),
  "i"
);

/** User-agents de lectores de vista previa y buscadores (RF-15). UA vacío o ausente también cuenta como bot. */
export function esBotDeVistaPrevia(userAgent: string | null | undefined): boolean {
  if (!userAgent?.trim()) return true;
  return BOTS.test(userAgent);
}

/** Primer día de la ventana de N días que termina hoy (inclusive), en 'yyyy-MM-dd'. 30 días = hoy y los 29 anteriores. */
export function inicioVentanaVisitas(hoyCR: string, dias = 30): string {
  // Cuenta sobre el día como texto en UTC puro: con la hora local de por medio
  // un cambio de horario o la zona del servidor corren el resultado un día.
  const fecha = new Date(`${hoyCR}T00:00:00Z`);
  fecha.setUTCDate(fecha.getUTCDate() - (dias - 1));
  return fecha.toISOString().slice(0, 10);
}

/** Lo que dice la tarjeta del inicio (RF-17, RF-18), con singular/plural. */
export function textoVisitas(r: {
  total: number;
  deMarcas: number;
}): { vacio: true; titulo: string; nota: string } | { vacio: false; titulo: string; nota: string } {
  if (r.total === 0) {
    return {
      vacio: true,
      titulo: "Tu kit todavía no tiene visitas",
      nota: "Compartí tu link en la bio o mandáselo a una marca.",
    };
  }
  const marcas =
    r.deMarcas === 0
      ? "Ninguna de marcas todavía"
      : r.deMarcas === 1
        ? "1 de una marca"
        : `${r.deMarcas} de marcas`;
  return {
    vacio: false,
    titulo: r.total === 1 ? "1 visita" : `${r.total} visitas`,
    nota: `${marcas} · últimos 30 días`,
  };
}
