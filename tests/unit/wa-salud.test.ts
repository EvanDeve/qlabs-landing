import { describe, it, expect } from "vitest";
import {
  evaluarSalud,
  MINIMO_PARA_ALARMAR,
  MAXIMO_EN_VUELO,
  EN_VUELO,
  ENTREGADOS,
  FALLIDOS,
} from "@/lib/ugc/wa-salud";

/**
 * Lo que este vigía tiene que lograr es doble, y la mitad difícil es la
 * segunda: avisar cuando el canal se cae, y CALLARSE el resto de los días. Un
 * aviso que salta seguido se vuelve ruido, la gente lo filtra, y el día que
 * importa de verdad ya nadie lo lee. Por eso hay más casos de "no alarmar" que
 * de "alarmar".
 */
describe("evaluarSalud", () => {
  it("no dice nada cuando no se mandó nada", () => {
    // Un día sin mensajes no es salud ni enfermedad. Y pasa seguido: si todo el
    // equipo tiene la ventana de 24 h cerrada, el cron no manda ni uno.
    expect(evaluarSalud({ entregados: 0, enVuelo: 0, fallidos: 0 })).toEqual({ alerta: false });
  });

  it("no alarma por uno o dos sin entregar", () => {
    // Dos teléfonos apagados no son una caída. Con tan poca muestra, un cero no
    // significa nada.
    expect(evaluarSalud({ entregados: 0, enVuelo: 1, fallidos: 0 })).toEqual({ alerta: false });
    expect(evaluarSalud({ entregados: 0, enVuelo: 1, fallidos: 1 })).toEqual({ alerta: false });
  });

  it("alarma cuando no se entregó NINGUNO de varios — el caso del 2026-09-02", () => {
    // El día real: Twilio aceptó siete mensajes, no entregó ninguno y no
    // devolvió un solo código de error.
    const d = evaluarSalud({ entregados: 0, enVuelo: 7, fallidos: 0 });
    expect(d.alerta).toBe(true);
    if (!d.alerta) throw new Error("inalcanzable");
    expect(d.motivo).toBe("salida_caida");
    // El texto tiene que traer los números: un aviso que solo dice "hay un
    // problema" obliga a ir a buscar lo mismo que ya sabíamos.
    expect(d.texto).toContain("7");
  });

  it("el umbral es exacto: alarma justo en el mínimo, no antes", () => {
    const debajo = MINIMO_PARA_ALARMAR - 1;
    expect(evaluarSalud({ entregados: 0, enVuelo: debajo, fallidos: 0 }).alerta).toBe(false);
    expect(evaluarSalud({ entregados: 0, enVuelo: MINIMO_PARA_ALARMAR, fallidos: 0 }).alerta).toBe(true);
  });

  it("cuenta los fallidos como intentos, no solo los trabados", () => {
    // Tres rebotes con 63016 también son un canal que no está entregando. Si el
    // umbral mirara solo los trabados, este día pasaría desapercibido.
    const d = evaluarSalud({ entregados: 0, enVuelo: 0, fallidos: MINIMO_PARA_ALARMAR });
    expect(d.alerta).toBe(true);
  });

  it("se calla cuando la entrega funciona", () => {
    expect(evaluarSalud({ entregados: 9, enVuelo: 0, fallidos: 0 })).toEqual({ alerta: false });
    // Uno trabado y uno fallido entre nueve entregados es un martes normal.
    expect(evaluarSalud({ entregados: 9, enVuelo: 1, fallidos: 1 })).toEqual({ alerta: false });
  });

  it("avisa de una cola trancada aunque algo se esté entregando", () => {
    // La caída parcial: entrega a algunos y acumula al resto. Sin esta rama, el
    // primer chequeo la deja pasar porque `entregados` no es cero.
    const d = evaluarSalud({ entregados: 2, enVuelo: MAXIMO_EN_VUELO, fallidos: 0 });
    expect(d.alerta).toBe(true);
    if (!d.alerta) throw new Error("inalcanzable");
    expect(d.motivo).toBe("cola_trabada");
  });

  it("un cero total gana sobre la cola trancada", () => {
    // Los dos criterios se cumplen a la vez; el que se reporta tiene que ser el
    // grave, porque son acciones distintas: uno es "revisá la cuenta", el otro
    // "mirá si se destraba".
    const d = evaluarSalud({ entregados: 0, enVuelo: MAXIMO_EN_VUELO + 3, fallidos: 0 });
    if (!d.alerta) throw new Error("tenía que alarmar");
    expect(d.motivo).toBe("salida_caida");
  });
});

describe("los grupos de estados", () => {
  it("no se pisan entre sí", () => {
    // Un estado en dos grupos haría que el mismo mensaje se cuente dos veces y
    // los umbrales dejarían de significar lo que dicen.
    const todos = [...EN_VUELO, ...ENTREGADOS, ...FALLIDOS];
    expect(new Set(todos).size).toBe(todos.length);
  });

  it("cubren los estados que Twilio devuelve de verdad", () => {
    // Tomados de la respuesta real de la API. Uno que falte cae en ningún
    // grupo y desaparece de los conteos sin que nada falle.
    const deTwilio = [
      "queued",
      "accepted",
      "sending",
      "sent",
      "delivered",
      "read",
      "undelivered",
      "failed",
      "canceled",
    ];
    const cubiertos = new Set<string>([...EN_VUELO, ...ENTREGADOS, ...FALLIDOS]);
    for (const estado of deTwilio) expect(cubiertos.has(estado)).toBe(true);
  });
});
