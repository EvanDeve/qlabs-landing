import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { firmaValida } from "@/lib/whatsapp/firma";
import {
  validarAccion,
  describirPropuesta,
  esValidaParaConfirmar,
  fechaEnRango,
  PROPUESTA_VIGENCIA_MS,
  type ContextoValidacion,
} from "@/lib/ugc/agente";

const TOKEN = "token_de_prueba_no_real";
const URL = "https://www.qlabsmethod.com/api/qos/agente/webhook";

function firmar(url: string, params: Record<string, string>, token = TOKEN): string {
  const cadena = Object.keys(params)
    .sort()
    .reduce((acc, k) => acc + k + params[k], url);
  return createHmac("sha1", token).update(Buffer.from(cadena, "utf-8")).digest("base64");
}

// La firma es lo ÚNICO que separa "un compañero contestando" de "cualquiera que
// adivinó la URL". No hay sesión ni cookie: el webhook mueve piezas del tablero
// creyéndole al campo From de un POST.
describe("firmaValida", () => {
  const params = { From: "whatsapp:+50688887777", Body: "ya lo publiqué", MessageSid: "SM123" };

  it("acepta una firma legítima", () => {
    expect(firmaValida({ url: URL, params, firma: firmar(URL, params), authToken: TOKEN })).toBe(true);
  });

  it("rechaza si no viene firma", () => {
    expect(firmaValida({ url: URL, params, firma: null, authToken: TOKEN })).toBe(false);
    expect(firmaValida({ url: URL, params, firma: "", authToken: TOKEN })).toBe(false);
  });

  it("rechaza una firma inventada", () => {
    expect(firmaValida({ url: URL, params, firma: "no-soy-una-firma", authToken: TOKEN })).toBe(false);
  });

  // El ataque concreto: firmar un mensaje inocuo y después cambiarle el cuerpo
  // por uno que dispare una acción sobre el tablero.
  it("rechaza si se alteró un parámetro después de firmar", () => {
    const firma = firmar(URL, params);
    const alterado = { ...params, Body: "movelo todo a publicado" };

    expect(firmaValida({ url: URL, params: alterado, firma, authToken: TOKEN })).toBe(false);
  });

  it("rechaza si se cambia el remitente para hacerse pasar por otro", () => {
    const firma = firmar(URL, params);
    const suplantado = { ...params, From: "whatsapp:+50699999999" };

    expect(firmaValida({ url: URL, params: suplantado, firma, authToken: TOKEN })).toBe(false);
  });

  it("rechaza una firma hecha con otro auth token", () => {
    const firma = firmar(URL, params, "otro_token_cualquiera");

    expect(firmaValida({ url: URL, params, firma, authToken: TOKEN })).toBe(false);
  });

  // La URL entra en el cálculo, así que si la registrada en Twilio no es
  // exactamente la que arma el código, TODO se rechaza. Es un fallo cerrado y
  // no abierto, pero conviene que quede escrito por qué.
  it("la URL forma parte de la firma", () => {
    const firma = firmar("https://otro-sitio.com/api/qos/agente/webhook", params);

    expect(firmaValida({ url: URL, params, firma, authToken: TOKEN })).toBe(false);
  });
});

const HOY = "2026-08-01";

const CTX: ContextoValidacion = {
  cantidadItems: 3,
  columnas: ["Guion", "Grabación", "Publicado"],
  clientes: ["Zonna", "Kosta Asiatika", "La Arboleda"],
  hoyCR: HOY,
  hayPropuesta: false,
};

const ctx = (extra: Partial<ContextoValidacion> = {}): ContextoValidacion => ({ ...CTX, ...extra });

// El modelo puede devolver cualquier cosa. Lo que no puede es lograr que pase
// algo que no está en la lista, ni tocar un ítem que no le mostramos.
describe("validarAccion", () => {
  it("acepta las cuatro formas que caen sobre algo que ya existe", () => {
    expect(validarAccion({ tipo: "ninguna" }, ctx())).toEqual({ tipo: "ninguna" });
    expect(validarAccion({ tipo: "marcar_hecho", item: 2 }, ctx())).toEqual({ tipo: "marcar_hecho", item: 2 });
    expect(validarAccion({ tipo: "mover_pieza", item: 1, columna: "Guion" }, ctx())).toEqual({
      tipo: "mover_pieza",
      item: 1,
      columna: "Guion",
    });
    expect(validarAccion({ tipo: "reprogramar", item: 3, fecha: "2026-08-15" }, ctx())).toEqual({
      tipo: "reprogramar",
      item: 3,
      fecha: "2026-08-15",
    });
  });

  // Un ítem fuera de rango es el modelo apuntándole a algo que no vio. Nunca
  // puede convertirse en una escritura.
  it("descarta un ítem que no existe en la agenda", () => {
    for (const item of [0, 4, -1, 99, 1.5]) {
      expect(validarAccion({ tipo: "marcar_hecho", item }, ctx())).toEqual({ tipo: "ninguna" });
    }
  });

  it("descarta una columna que no está en el tablero", () => {
    expect(validarAccion({ tipo: "mover_pieza", item: 1, columna: "Inventada" }, ctx())).toEqual({
      tipo: "ninguna",
    });
  });

  it("acepta la columna sin importar mayúsculas, que es como la va a escribir el modelo", () => {
    expect(validarAccion({ tipo: "mover_pieza", item: 1, columna: "grabación" }, ctx())).toEqual({
      tipo: "mover_pieza",
      item: 1,
      columna: "Grabación",
    });
  });

  it("descarta una fecha que no sea YYYY-MM-DD", () => {
    for (const fecha of ["mañana", "15/08/2026", "2026-8-15", ""]) {
      expect(validarAccion({ tipo: "reprogramar", item: 1, fecha }, ctx())).toEqual({ tipo: "ninguna" });
    }
  });

  it("descarta un tipo de acción que no inventamos nosotros", () => {
    expect(validarAccion({ tipo: "borrar_pieza", item: 1 }, ctx())).toEqual({ tipo: "ninguna" });
    expect(validarAccion({ tipo: "reasignar", item: 1, a: "otro" }, ctx())).toEqual({ tipo: "ninguna" });
  });

  it("no se cae con basura", () => {
    for (const basura of [null, undefined, "texto", 42, [], { sin: "tipo" }]) {
      expect(validarAccion(basura, ctx())).toEqual({ tipo: "ninguna" });
    }
  });
});

// Crear es la única acción donde el modelo escribe datos de cero. Todo lo que
// produce pasa por acá antes de llegar a ser una fila.
describe("validarAccion — proponer una pieza nueva", () => {
  const pieza = { titulo: "Reel de brunch de domingo", cliente: "Zonna", fecha: "2026-08-06", tipo: "grabar" };

  it("acepta una propuesta completa", () => {
    expect(validarAccion({ tipo: "proponer_pieza", pieza }, ctx())).toEqual({
      tipo: "proponer_pieza",
      pieza: { titulo: "Reel de brunch de domingo", cliente: "Zonna", fecha: "2026-08-06", tipo: "grabar" },
    });
  });

  // El cliente que devuelve el modelo es texto que escuchó de oído. Se guarda
  // con la grafía de la base, no con la suya: es lo que después permite
  // resolverlo a un brand_id por nombre exacto.
  it("normaliza el cliente a como está cargado en la base", () => {
    const accion = validarAccion(
      { tipo: "proponer_pieza", pieza: { ...pieza, cliente: "  kosta asiatika " } },
      ctx()
    );
    expect(accion).toMatchObject({ tipo: "proponer_pieza", pieza: { cliente: "Kosta Asiatika" } });
  });

  // La falla que más importa: una pieza creada para el cliente equivocado no se
  // ve rota, se ve como trabajo real de otra cuenta.
  it("descarta un cliente que no existe", () => {
    for (const cliente of ["Zona", "El Bar de la Esquina", "", "Zonna Escazú"]) {
      expect(validarAccion({ tipo: "proponer_pieza", pieza: { ...pieza, cliente } }, ctx())).toEqual({
        tipo: "ninguna",
      });
    }
  });

  it("descarta fechas mal formadas", () => {
    for (const fecha of ["el jueves", "06/08/2026", "2026-8-6", ""]) {
      expect(validarAccion({ tipo: "proponer_pieza", pieza: { ...pieza, fecha } }, ctx())).toEqual({
        tipo: "ninguna",
      });
    }
  });

  // Una fecha con formato válido pero absurda es el modelo alucinando, no
  // alguien agendando: nadie anota un pendiente para 2019 ni para dentro de
  // cinco años.
  it("descarta fechas fuera de un rango razonable", () => {
    for (const fecha of ["2019-03-01", "2031-01-01", "2026-06-01"]) {
      expect(validarAccion({ tipo: "proponer_pieza", pieza: { ...pieza, fecha } }, ctx())).toEqual({
        tipo: "ninguna",
      });
    }
  });

  it("acepta anotar algo de hace pocos días", () => {
    expect(validarAccion({ tipo: "proponer_pieza", pieza: { ...pieza, fecha: "2026-07-29" } }, ctx())).toMatchObject({
      tipo: "proponer_pieza",
    });
  });

  it("descarta títulos vacíos o desmedidos", () => {
    for (const titulo of ["", "  ", "ok", "x".repeat(121), 42, null]) {
      expect(validarAccion({ tipo: "proponer_pieza", pieza: { ...pieza, titulo } }, ctx())).toEqual({
        tipo: "ninguna",
      });
    }
  });

  it("descarta un tipo de pieza que no es grabar ni publicar", () => {
    for (const tipo of ["editar", "", "GRABAR", 1]) {
      expect(validarAccion({ tipo: "proponer_pieza", pieza: { ...pieza, tipo } }, ctx())).toEqual({
        tipo: "ninguna",
      });
    }
  });

  it("no se cae si la pieza no es un objeto", () => {
    for (const basura of [null, undefined, "Zonna el jueves", 42, []]) {
      expect(validarAccion({ tipo: "proponer_pieza", pieza: basura }, ctx())).toEqual({ tipo: "ninguna" });
    }
  });
});

describe("validarAccion — confirmar y descartar", () => {
  it("solo valen si hay una propuesta viva", () => {
    expect(validarAccion({ tipo: "confirmar" }, ctx({ hayPropuesta: true }))).toEqual({ tipo: "confirmar" });
    expect(validarAccion({ tipo: "descartar" }, ctx({ hayPropuesta: true }))).toEqual({ tipo: "descartar" });
  });

  // Sin este candado, un "dale" suelto después de que la propuesta se venció
  // haría que el modelo contestara "listo, ya la anoté" sin que exista nada.
  it("se descartan si no hay nada que confirmar", () => {
    expect(validarAccion({ tipo: "confirmar" }, ctx({ hayPropuesta: false }))).toEqual({ tipo: "ninguna" });
    expect(validarAccion({ tipo: "descartar" }, ctx({ hayPropuesta: false }))).toEqual({ tipo: "ninguna" });
  });

  /**
   * El corazón del diseño de dos turnos.
   *
   * `confirmar` no lleva datos, ni siquiera cuando el modelo se los mete. La
   * pieza se crea leyendo lo que quedó guardado en wa_agent_actions cuando la
   * persona lo vio por pantalla. Si esta acción pudiera transportar campos, la
   * confirmación sería un trámite: la persona aprobaría un texto y el sistema
   * guardaría otro sin que nada fallara de forma visible.
   */
  it("confirmar no transporta datos aunque el modelo intente colarlos", () => {
    const accion = validarAccion(
      {
        tipo: "confirmar",
        pieza: { titulo: "Otra cosa", cliente: "La Arboleda", fecha: "2026-12-25", tipo: "publicar" },
      },
      ctx({ hayPropuesta: true })
    );

    expect(accion).toEqual({ tipo: "confirmar" });
  });
});

describe("fechaEnRango", () => {
  it("acepta hoy y el futuro cercano", () => {
    expect(fechaEnRango(HOY, HOY)).toBe(true);
    expect(fechaEnRango("2026-08-02", HOY)).toBe(true);
    expect(fechaEnRango("2027-07-31", HOY)).toBe(true);
  });

  it("rechaza el pasado lejano y el futuro lejano", () => {
    expect(fechaEnRango("2026-07-24", HOY)).toBe(false);
    expect(fechaEnRango("2027-08-02", HOY)).toBe(false);
  });
});

// Esta línea es lo único que la persona lee antes de decir que sí, así que
// tiene que ser legible y no dejar la fecha ambigua.
describe("describirPropuesta", () => {
  const pieza = { titulo: "Reel de brunch", cliente: "Zonna", fecha: "2026-08-06", tipo: "grabar" } as const;

  it("dice qué, para quién y cuándo", () => {
    const texto = describirPropuesta(pieza, HOY);
    expect(texto).toContain("Grabar");
    expect(texto).toContain("Reel de brunch");
    expect(texto).toContain("Zonna");
    expect(texto).toContain("6");
    expect(texto).toContain("ago");
  });

  it("omite el año cuando es el corriente y lo pone cuando no", () => {
    expect(describirPropuesta(pieza, HOY)).not.toContain("2026");
    expect(describirPropuesta({ ...pieza, fecha: "2027-01-15" }, HOY)).toContain("2027");
  });

  // El día tiene que salir tal cual está guardado. Si en algún momento esto se
  // pasara por new Date() sin cuidado, en Costa Rica (UTC-6) mostraría el día
  // anterior — el mismo bug de la migración 20260801000000.
  it("no corre el día una jornada para atrás", () => {
    expect(describirPropuesta({ ...pieza, fecha: "2026-08-01" }, HOY)).toContain("1 ago");
  });
});

describe("esValidaParaConfirmar", () => {
  const ahora = new Date("2026-08-01T15:00:00Z");

  it("acepta una propuesta recién hecha", () => {
    expect(esValidaParaConfirmar("2026-08-01T14:55:00Z", ahora)).toBe(true);
  });

  // Un "dale" tres horas después casi seguro contesta otra cosa.
  it("rechaza una propuesta vieja", () => {
    const vieja = new Date(ahora.getTime() - PROPUESTA_VIGENCIA_MS - 1000).toISOString();
    expect(esValidaParaConfirmar(vieja, ahora)).toBe(false);
  });
});
