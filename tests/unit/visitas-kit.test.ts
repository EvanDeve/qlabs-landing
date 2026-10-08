import { describe, it, expect } from "vitest";
import { esBotDeVistaPrevia, inicioVentanaVisitas, textoVisitas } from "@/lib/ugc/visitas-kit";
import { urlDelKit } from "@/lib/ugc/handles";

describe("esBotDeVistaPrevia (RF-15)", () => {
  it("reconoce a los lectores de vista previa y buscadores", () => {
    const bots = [
      "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
      "meta-externalagent/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)",
      "WhatsApp/2.23.20.0",
      "Twitterbot/1.0",
      "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)",
      "TelegramBot (like TwitterBot)",
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
      "LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)",
      "Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.1.1 Safari/605.1.15 (Applebot/0.1)",
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/120.0.0.0 Safari/537.36",
    ];
    for (const ua of bots) expect(esBotDeVistaPrevia(ua), ua).toBe(true);
  });

  it("sin user-agent también cuenta como bot", () => {
    expect(esBotDeVistaPrevia("")).toBe(true);
    expect(esBotDeVistaPrevia(null)).toBe(true);
    expect(esBotDeVistaPrevia(undefined)).toBe(true);
  });

  // El navegador interno de Instagram es una persona tocando el link de la bio:
  // es justo la visita que el creador quiere contar.
  it("no confunde a una persona con un bot, ni dentro de Instagram o Facebook", () => {
    const personas = [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 339.0.3.12.91 (iPhone15,2; iOS 17_5; es_CR; es; scale=3.00; 1179x2556; 621132451)",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/470.0.0.40.97;FBBV/621000000;FBDV/iPhone15,2;FBMD/iPhone;FBSN/iOS;FBSV/17.5;FBSS/3;FBLC/es_LA;FBOP/5]",
    ];
    for (const ua of personas) expect(esBotDeVistaPrevia(ua), ua).toBe(false);
  });
});

describe("inicioVentanaVisitas", () => {
  it("30 días son hoy y los 29 anteriores", () => {
    expect(inicioVentanaVisitas("2026-10-30")).toBe("2026-10-01");
  });

  it("cruza fin de mes", () => {
    expect(inicioVentanaVisitas("2026-10-08")).toBe("2026-09-09");
  });

  it("cruza fin de año", () => {
    expect(inicioVentanaVisitas("2027-01-10")).toBe("2026-12-12");
  });

  it("cuenta el 29 de febrero de un año bisiesto", () => {
    expect(inicioVentanaVisitas("2028-03-01", 2)).toBe("2028-02-29");
  });

  it("una ventana de 1 día es solo hoy", () => {
    expect(inicioVentanaVisitas("2026-10-08", 1)).toBe("2026-10-08");
  });
});

describe("textoVisitas (RF-17, RF-18)", () => {
  it("sin visitas invita a compartir el link", () => {
    const t = textoVisitas({ total: 0, deMarcas: 0 });
    expect(t.vacio).toBe(true);
    expect(t.nota.toLowerCase()).toContain("compart");
  });

  it("usa singular y plural", () => {
    expect(textoVisitas({ total: 1, deMarcas: 1 })).toMatchObject({
      vacio: false,
      titulo: "1 visita",
      nota: "1 de una marca · últimos 30 días",
    });
    expect(textoVisitas({ total: 12, deMarcas: 3 })).toMatchObject({
      vacio: false,
      titulo: "12 visitas",
      nota: "3 de marcas · últimos 30 días",
    });
  });

  it("sin visitas de marcas lo dice", () => {
    expect(textoVisitas({ total: 5, deMarcas: 0 }).nota).toBe("Ninguna de marcas todavía · últimos 30 días");
  });
});

describe("urlDelKit (RF-20)", () => {
  it("da el mismo link con y sin @", () => {
    expect(urlDelKit("https://qlabsmethod.com", "@vale.cr")).toBe("https://qlabsmethod.com/ugc/creadores/vale.cr");
    expect(urlDelKit("https://qlabsmethod.com", "vale.cr")).toBe("https://qlabsmethod.com/ugc/creadores/vale.cr");
  });
});
