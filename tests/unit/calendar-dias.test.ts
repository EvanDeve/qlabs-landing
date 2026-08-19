import { describe, it, expect } from "vitest";
import {
  CALENDAR_EVENT_LABEL_PLURAL,
  CALENDAR_EVENT_TYPES,
  CALENDAR_EVENT_TYPE_LABEL,
  diaCR,
  diaCorto,
  entraEnLaGrilla,
  esTipoDeEvento,
  horaCR,
  instanteCR,
  nivelDeCarga,
  sumarDias,
} from "@/lib/ugc/calendar";

// El bug que estas pruebas cuidan: una pieza puesta para el 1 de agosto se veía
// en todos lados —Kanban, Calendario y el WhatsApp del agente— como del 31 de
// julio. La causa era guardar un DÍA en una columna de INSTANTES: '2026-08-01'
// se completaba con la medianoche UTC, que en Costa Rica (UTC-6) son las 18:00
// del día anterior.
//
// Es un bug que no se ve desarrollando desde Costa Rica con datos recién
// creados, y aparece en producción o al caer la tarde. Por eso vive acá.

describe("diaCR", () => {
  // EL caso del bug. Un día suelto NO es un instante: convertirlo lo corre.
  it("devuelve un día suelto tal cual, sin correrlo", () => {
    expect(diaCR("2026-08-01")).toBe("2026-08-01");
    expect(diaCR("2026-01-01")).toBe("2026-01-01");
    expect(diaCR("2026-12-31")).toBe("2026-12-31");
  });

  it("traduce un instante a la zona de Costa Rica", () => {
    // Medianoche UTC del 1 de agosto = 18:00 del 31 de julio en CR.
    expect(diaCR("2026-08-01T00:00:00Z")).toBe("2026-07-31");
    // 06:00 UTC ya es medianoche del 1 en CR.
    expect(diaCR("2026-08-01T06:00:00Z")).toBe("2026-08-01");
    // 23:30 CR del 1 = 05:30Z del 2, y sigue siendo el día 1.
    expect(diaCR("2026-08-02T05:30:00Z")).toBe("2026-08-01");
  });

  it("acepta un Date igual que un string", () => {
    expect(diaCR(new Date("2026-08-01T00:00:00Z"))).toBe("2026-07-31");
  });

  // De esto depende que se pueda comparar con < y > como texto en todo Q·OS.
  it("el orden alfabético coincide con el cronológico", () => {
    const dias = ["2026-08-10", "2026-07-31", "2026-08-02", "2026-12-01", "2026-01-05"];

    expect([...dias].sort()).toEqual(["2026-01-05", "2026-07-31", "2026-08-02", "2026-08-10", "2026-12-01"]);
  });
});

describe("diaCorto", () => {
  it("muestra el día que se guardó, no el anterior", () => {
    expect(diaCorto("2026-08-01")).toContain("1");
    expect(diaCorto("2026-08-01")).toContain("ago");
  });

  // Antes esto usaba toLocaleDateString sin timeZone, así que dependía de la
  // zona del proceso: en la compu de alguien en CR daba una fecha y en Vercel
  // (UTC) otra. El resultado tiene que ser el mismo en cualquier servidor.
  it("no depende de la zona horaria del proceso", () => {
    const original = process.env.TZ;
    const resultados = new Set<string>();
    for (const tz of ["UTC", "America/Costa_Rica", "Asia/Tokyo", "Pacific/Kiritimati"]) {
      process.env.TZ = tz;
      resultados.add(diaCorto("2026-08-01"));
    }
    process.env.TZ = original;

    expect(resultados.size).toBe(1);
  });
});

describe("sumarDias", () => {
  it("cruza el fin de mes", () => {
    expect(diaCR(sumarDias(new Date("2026-07-31T18:00:00Z"), 3))).toBe("2026-08-03");
  });

  it("resta con negativos", () => {
    expect(diaCR(sumarDias(new Date("2026-08-02T18:00:00Z"), -3))).toBe("2026-07-30");
  });
});

// Los cortes de carga del calendario. Van con prueba porque son una decisión de
// producto de Evan (2026-08-15) y no un detalle de implementación: eligió
// cortes FIJOS —1-2 / 3-4 / 5+— sobre cortes relativos al mes, para que rojo
// signifique lo mismo en agosto que en febrero. Si alguien los mueve sin querer,
// el calendario entero cambia de color sin que nadie lo haya pedido.
describe("nivelDeCarga", () => {
  it("un día sin nada es libre, y NO ligero", () => {
    // La diferencia importa: el día libre no pinta barra. Devolver "ligera"
    // para 0 dibujaría una barrita verde en un día donde no hay nada.
    expect(nivelDeCarga(0)).toBe("libre");
  });

  it("respeta los cortes exactos que se eligieron", () => {
    expect(nivelDeCarga(1)).toBe("ligera");
    expect(nivelDeCarga(2)).toBe("ligera");
    expect(nivelDeCarga(3)).toBe("media");
    expect(nivelDeCarga(4)).toBe("media");
    expect(nivelDeCarga(5)).toBe("llena");
  });

  it("no se rompe con un día muy cargado", () => {
    // El pico medido en agosto 2026 fue 9; el tope es abierto a propósito.
    expect(nivelDeCarga(9)).toBe("llena");
    expect(nivelDeCarga(40)).toBe("llena");
  });

  it("reparte agosto 2026 como se decidió", () => {
    // La distribución real medida contra la base el 2026-08-15: 4 días con 1
    // item, 5 con 2, 5 con 3, 5 con 4, 2 con 5, 3 con 6, 1 con 7, 4 con 8 y 1
    // con 9. Es el reparto con el que Evan eligió estos cortes.
    const agosto = [
      ...Array(4).fill(1), ...Array(5).fill(2), ...Array(5).fill(3), ...Array(5).fill(4),
      ...Array(2).fill(5), ...Array(3).fill(6), ...Array(1).fill(7), ...Array(4).fill(8),
      ...Array(1).fill(9),
    ];
    const cuenta = (n: string) => agosto.filter((x) => nivelDeCarga(x) === n).length;
    expect(cuenta("ligera")).toBe(9);
    expect(cuenta("media")).toBe(10);
    expect(cuenta("llena")).toBe(11);
  });
});

// Qué items tienen lugar propio en la grilla horaria de la vista de Semana.
// Va con prueba por lo mismo que nivelDeCarga: la franja "8 a 8" es una decisión
// de Evan (2026-08-15) y no un detalle. Si alguien la mueve, items que hoy se
// ven en la grilla se van en silencio a la banda de arriba, o al revés.
describe("entraEnLaGrilla", () => {
  it("deja afuera lo que no tiene hora", () => {
    // El caso mayoritario y el motivo de que la banda exista: 36 de los 49
    // items de la semana del 10 al 16 de agosto no tienen hora ninguna.
    expect(entraEnLaGrilla(null)).toBe(false);
  });

  it("acepta los bordes de la franja y rechaza lo de afuera", () => {
    expect(entraEnLaGrilla("08:00")).toBe(true);
    expect(entraEnLaGrilla("07:59")).toBe(false);
    expect(entraEnLaGrilla("19:59")).toBe(true);
    // 20:00 es el FIN de la franja, no una hora dibujable: la última fila que
    // se pinta es la de las 19.
    expect(entraEnLaGrilla("20:00")).toBe(false);
  });

  it("manda a la banda los eventos de madrugada, en vez de perderlos", () => {
    // Los 3 de agosto que quedaron corridos por el bug de zona horaria de
    // calendar-events.ts. Que caigan en la banda —con su hora a la vista— es
    // deliberado: si no se dibujaran, el bug sería invisible.
    expect(entraEnLaGrilla("03:00")).toBe(false);
    expect(entraEnLaGrilla("06:00")).toBe(false);
  });

  it("no se confunde con el minuto", () => {
    expect(entraEnLaGrilla("08:40")).toBe(true);
    expect(entraEnLaGrilla("16:41")).toBe(true);
  });
});

// El otro lado del mismo problema: diaCR/horaCR LEEN un instante, instanteCR lo
// ESCRIBE. El bug fue guardar con `new Date('2026-08-26T08:00')`, que lee el
// string en la zona del proceso: en la Mac del equipo (CR) daba bien y en Vercel
// (UTC) guardaba las 08:00 como 08:00Z, o sea las 2 de la madrugada en CR.
//
// El equipo lo reportó como "se borran los horarios": 02:00 cae fuera de la
// franja 8–20 que dibuja la grilla, así que la grabación se iba a la banda
// "Sin hora" y la hora parecía haberse perdido.
//
// Estas pruebas NO dependen de la zona de quien las corre — es justamente la
// propiedad que se rompió.
describe("instanteCR", () => {
  it("interpreta la hora en Costa Rica y no en la zona del proceso", () => {
    // 08:00 en CR (UTC-6) son las 14:00Z. Con el bug daba '2026-08-26T08:00:00Z'.
    expect(instanteCR("2026-08-26T08:00")).toBe("2026-08-26T14:00:00.000Z");
  });

  it("no cambia de día una hora de la mañana temprano", () => {
    // EL caso feo: con el bug, 05:00 se guardaba como 05:00Z = 23:00 del 25 en
    // CR, y la grabación aparecía el día anterior.
    expect(instanteCR("2026-08-26T05:00")).toBe("2026-08-26T11:00:00.000Z");
    expect(diaCR(instanteCR("2026-08-26T05:00"))).toBe("2026-08-26");
  });

  it("la hora que se guarda es la que se vuelve a leer", () => {
    // La ida y vuelta completa: lo que la persona tipea es lo que el calendario
    // le muestra después. Sin esto, reabrir y volver a guardar corría el evento
    // otras seis horas cada vez.
    for (const tipeado of ["2026-08-26T00:00", "2026-08-26T09:30", "2026-08-26T21:01", "2026-12-31T23:59"]) {
      const [dia, hora] = tipeado.split("T");
      expect(diaCR(instanteCR(tipeado))).toBe(dia);
      expect(horaCR(instanteCR(tipeado))).toBe(hora);
    }
  });

  it("acepta el valor con segundos que manda un input con step", () => {
    expect(instanteCR("2026-08-26T08:00:00")).toBe("2026-08-26T14:00:00.000Z");
  });
});

// El filtro por tipo del calendario viaja en la URL (`?tipo=grabacion`), así que
// lo que llega es un string cualquiera: un link viejo, algo tipeado a mano o el
// nombre de un tipo que se renombró. La regla es mostrar de MÁS y nunca una
// pantalla vacía que parezca que no hay nada agendado.
describe("esTipoDeEvento", () => {
  it("acepta los tipos de verdad", () => {
    for (const t of CALENDAR_EVENT_TYPES) expect(esTipoDeEvento(t)).toBe(true);
  });

  it("rechaza cualquier otra cosa, y el calendario sale entero", () => {
    for (const basura of ["", undefined, "grabaciones", "GRABACION", "reunió", "todos", "__proto__"]) {
      expect(esTipoDeEvento(basura)).toBe(false);
    }
  });

  it("cubre todos los tipos que el calendario sabe dibujar", () => {
    // Si mañana se agrega un tipo al enum y no a esta lista, el filtro no lo
    // ofrecería nunca y el hueco sería invisible: los eventos se dibujan igual.
    expect([...CALENDAR_EVENT_TYPES].sort()).toEqual(Object.keys(CALENDAR_EVENT_TYPE_LABEL).sort());
  });

  it("cada tipo tiene su plural, y los que no se derivan pegando una s están bien", () => {
    // "Sin publicaciónes" es lo que sale de concatenar: el plural pierde la
    // tilde. "Guion" suma sílaba. Los otros dos sí son regulares y se listan
    // igual, para que agregar un tipo nuevo obligue a decidir su plural.
    expect(CALENDAR_EVENT_LABEL_PLURAL).toEqual({
      publicacion: "publicaciones",
      grabacion: "grabaciones",
      reunion: "reuniones",
      entrega: "entregas",
      guion: "guiones",
    });
    for (const t of CALENDAR_EVENT_TYPES) expect(CALENDAR_EVENT_LABEL_PLURAL[t]).toBeTruthy();
  });
});
