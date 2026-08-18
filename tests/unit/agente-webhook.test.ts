import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { firmaValida } from "@/lib/whatsapp/firma";
import {
  validarAccion,
  resolverNombre,
  describirPropuesta,
  describirEvento,
  HORA_POR_DEFECTO,
  describirLoHecho,
  normalizarTitulo,
  esValidaParaConfirmar,
  fechaEnRango,
  PROPUESTA_VIGENCIA_MS,
  type ContextoValidacion,
} from "@/lib/ugc/agente";
import type { AgendaItem } from "@/lib/ugc/agenda";

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
  equipo: ["Evan", "Daniel", "Andrés"],
  hoyCR: HOY,
  hayPendiente: false,
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
  const pieza = { titulo: "Reel de brunch de domingo", cliente: "Zonna", fecha: "2026-08-06" };

  it("acepta una propuesta completa", () => {
    expect(validarAccion({ tipo: "proponer_pieza", pieza }, ctx())).toEqual({
      tipo: "proponer_pieza",
      pieza: { titulo: "Reel de brunch de domingo", cliente: "Zonna", fecha: "2026-08-06" },
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
    for (const cliente of ["El Bar de la Esquina", "", "Sodalacosecha"]) {
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

  it("no se cae si la pieza no es un objeto", () => {
    for (const basura of [null, undefined, "Zonna el jueves", 42, []]) {
      expect(validarAccion({ tipo: "proponer_pieza", pieza: basura }, ctx())).toEqual({ tipo: "ninguna" });
    }
  });
});

describe("validarAccion — confirmar y descartar", () => {
  it("solo valen si hay una propuesta viva", () => {
    expect(validarAccion({ tipo: "confirmar" }, ctx({ hayPendiente: true }))).toEqual({ tipo: "confirmar" });
    expect(validarAccion({ tipo: "descartar" }, ctx({ hayPendiente: true }))).toEqual({ tipo: "descartar" });
  });

  // Sin este candado, un "dale" suelto después de que la propuesta se venció
  // haría que el modelo contestara "listo, ya la anoté" sin que exista nada.
  it("se descartan si no hay nada que confirmar", () => {
    expect(validarAccion({ tipo: "confirmar" }, ctx({ hayPendiente: false }))).toEqual({ tipo: "ninguna" });
    expect(validarAccion({ tipo: "descartar" }, ctx({ hayPendiente: false }))).toEqual({ tipo: "ninguna" });
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
      ctx({ hayPendiente: true })
    );

    expect(accion).toEqual({ tipo: "confirmar" });
  });
});

// Contra los nombres que hay de verdad en la base: "Zonna Gastrobar",
// "La Árboleda", "Entrecote". Nadie escribe eso por WhatsApp.
describe("resolverCliente", () => {
  const REALES = ["Zonna Gastrobar", "La Árboleda", "La Bontá", "La Maremmana", "Entrecote", "Kosta Asiatika"];

  it("resuelve el nombre corto que usa la gente", () => {
    expect(resolverNombre("Zonna", REALES)).toBe("Zonna Gastrobar");
    expect(resolverNombre("entrecot", REALES)).toBe("Entrecote");
  });

  it("no se traba con las tildes", () => {
    expect(resolverNombre("la arboleda", REALES)).toBe("La Árboleda");
    expect(resolverNombre("La Bonta", REALES)).toBe("La Bontá");
  });

  it("acepta el nombre completo tal cual", () => {
    expect(resolverNombre("Kosta Asiatika", REALES)).toBe("Kosta Asiatika");
    expect(resolverNombre("  ZONNA GASTROBAR  ", REALES)).toBe("Zonna Gastrobar");
  });

  // Lo importante: la ambigüedad termina en una pregunta, nunca en una pieza
  // cargada al cliente equivocado.
  it("devuelve null si hay más de un candidato", () => {
    expect(resolverNombre("La", REALES)).toBeNull();
  });

  it("devuelve null si no se parece a ninguno", () => {
    expect(resolverNombre("El Bar de la Esquina", REALES)).toBeNull();
    expect(resolverNombre("", REALES)).toBeNull();
    expect(resolverNombre("   ", REALES)).toBeNull();
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
// Un evento es lo único que el agente escribe con HORA, y la hora es donde este
// repo ya se quemó una vez (ver la migración 20260801000000). Todo lo que entre
// mal acá termina en una reunión a la que no va nadie.
describe("validarAccion — proponer un evento", () => {
  const evento = {
    titulo: "Reunión de arranque",
    tipo: "reunion",
    cliente: "Kosta Asiatika",
    fecha: "2026-08-06",
    hora: "15:00",
    responsable: "Daniel",
  };

  it("acepta un evento completo y normaliza los nombres a como están cargados", () => {
    const accion = validarAccion(
      { tipo: "proponer_evento", evento: { ...evento, cliente: "kosta", responsable: "daniel" } },
      ctx()
    );
    expect(accion).toEqual({
      tipo: "proponer_evento",
      evento: { ...evento, cliente: "Kosta Asiatika", responsable: "Daniel" },
    });
  });

  // Una reunión de equipo no es de ningún Hero, y un evento sin responsable
  // dicho queda a nombre de quien lo pide. Los dos nulls son legítimos.
  it("acepta un evento interno, sin cliente y sin responsable", () => {
    const accion = validarAccion(
      { tipo: "proponer_evento", evento: { ...evento, cliente: null, responsable: null } },
      ctx()
    );
    expect(accion).toMatchObject({ tipo: "proponer_evento", evento: { cliente: null, responsable: null } });
  });

  it("descarta los cinco tipos que no existen", () => {
    for (const tipo of ["almuerzo", "", "REUNION", 1, null]) {
      expect(validarAccion({ tipo: "proponer_evento", evento: { ...evento, tipo } }, ctx())).toEqual({
        tipo: "ninguna",
      });
    }
  });

  // Que la reunión le caiga a otra persona es peor que no crearla: esa persona
  // no se entera de que la tiene y quien la pidió cree que quedó.
  it("descarta un responsable que no está en el equipo", () => {
    expect(
      validarAccion({ tipo: "proponer_evento", evento: { ...evento, responsable: "Fernando" } }, ctx())
    ).toEqual({ tipo: "ninguna" });
  });

  it("descarta un cliente que no existe, igual que en una pieza", () => {
    expect(
      validarAccion({ tipo: "proponer_evento", evento: { ...evento, cliente: "El Bar de la Esquina" } }, ctx())
    ).toEqual({ tipo: "ninguna" });
  });

  // Sin hora dictada el evento igual se crea: la pone el sistema. Lo que no
  // puede pasar es que una hora inventada por el modelo entre como si se la
  // hubieran dicho.
  it("una hora mal formada se descarta sola, sin tumbar el evento", () => {
    for (const hora of ["3pm", "25:00", "15:70", "15", ""]) {
      expect(validarAccion({ tipo: "proponer_evento", evento: { ...evento, hora } }, ctx())).toMatchObject({
        tipo: "proponer_evento",
        evento: { hora: null },
      });
    }
  });

  it("acepta la medianoche y el último minuto del día", () => {
    for (const hora of ["00:00", "23:59"]) {
      expect(validarAccion({ tipo: "proponer_evento", evento: { ...evento, hora } }, ctx())).toMatchObject({
        evento: { hora },
      });
    }
  });

  it("no se cae si el evento no es un objeto", () => {
    for (const basura of [null, undefined, "reunión el martes", 42, []]) {
      expect(validarAccion({ tipo: "proponer_evento", evento: basura }, ctx())).toEqual({ tipo: "ninguna" });
    }
  });
});

describe("validarAccion — cancelar un evento", () => {
  it("acepta un número que está en la lista", () => {
    expect(validarAccion({ tipo: "cancelar_evento", item: 2 }, ctx())).toEqual({
      tipo: "cancelar_evento",
      item: 2,
    });
  });

  it("descarta un número que no se le mostró", () => {
    for (const item of [0, 99, -1, 1.5, "2"]) {
      expect(validarAccion({ tipo: "cancelar_evento", item }, ctx())).toEqual({ tipo: "ninguna" });
    }
  });
});

describe("describirEvento", () => {
  const base = {
    titulo: "Reunión de arranque",
    tipo: "reunion" as const,
    cliente: "Kosta Asiatika",
    fecha: "2026-08-06",
    hora: "15:00",
    responsable: "Daniel",
  };

  it("dice qué, para quién, cuándo, a qué hora y de quién es", () => {
    const texto = describirEvento(base, "2026-08-01");
    expect(texto).toContain("Reunión");
    expect(texto).toContain("Kosta Asiatika");
    expect(texto).toContain("15:00");
    expect(texto).toContain("Daniel");
  });

  // Un evento sin hora visible es el que después aparece a las 9 de la mañana
  // sin que nadie sepa por qué.
  it("muestra la hora por defecto cuando no se dictó ninguna", () => {
    expect(describirEvento({ ...base, hora: null }, "2026-08-01")).toContain(HORA_POR_DEFECTO);
  });

  it("dice que es interna cuando no tiene Hero", () => {
    expect(describirEvento({ ...base, cliente: null }, "2026-08-01")).toContain("interna");
  });
});

describe("describirPropuesta", () => {
  const pieza = { titulo: "Reel de brunch", cliente: "Zonna", fecha: "2026-08-06", tipo: "grabar" } as const;

  it("dice qué, para quién y cuándo", () => {
    const texto = describirPropuesta(pieza, HOY);
    expect(texto).toContain("Publicar");
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

// El 2026-08-03 McLovin cerró la tarjeta equivocada y Daniel leyó "Pura vida."
// La respuesta del modelo no sirve para detectar el error: hay que decirle qué
// tocó el sistema, con el dato del sistema.
describe("describirLoHecho", () => {
  function item(titulo: string): AgendaItem {
    return {
      key: `k-${titulo}`,
      ref: { kind: "piece", pieceId: "p1", campo: "publish_date" },
      titulo,
      heroe: "Delitalia",
      conHora: false,
      accion: "Publicar",
      columna: "Por editar",
      prioridad: null,
      enRiesgo: false,
      fecha: "2026-08-04",
    };
  }
  const items = [item("Reel de brunch"), item("Unboxing ramen")];

  it("nombra la pieza que se movió y a dónde fue", () => {
    const texto = describirLoHecho({ tipo: "mover_pieza", item: 2, columna: "Publicado" }, items);
    expect(texto).toBe("Listo, moví Unboxing ramen a Publicado.");
  });

  // Cerrar ya no pregunta (2026-08-18): pasa en el acto. Como es la única que
  // saca la tarjeta de la vista, esta línea es la última oportunidad de cazar un
  // error, así que nombra la tarjeta Y su Hero.
  it("al cerrar nombra la tarjeta y su Hero, porque después ya no se ve", () => {
    const texto = describirLoHecho({ tipo: "marcar_hecho", item: 1 }, items);
    expect(texto).toBe("Listo, cerré Reel de brunch — Delitalia.");
  });

  // El paréntesis era la marca de sistema más visible que quedaba: un compañero
  // no habla entre paréntesis. Ver describirLoHecho().
  it("no habla entre paréntesis", () => {
    for (const accion of [
      { tipo: "mover_pieza", item: 1, columna: "Publicado" },
      { tipo: "marcar_hecho", item: 1 },
      { tipo: "reprogramar", item: 1, fecha: "2026-08-09" },
    ] as const) {
      expect(describirLoHecho(accion, items)).not.toMatch(/[()]/);
    }
  });

  // Desde que cualquiera puede tocar cualquier tarjeta, quien la mueve tiene que
  // saber que al dueño ya se le avisó: si no, o va a contárselo aparte o se
  // queda con la duda de si el otro se enteró.
  it("avisa que se le avisó al dueño cuando la tarjeta era de otro", () => {
    const ajena = [{ ...item("Reel de brunch"), responsable: "Daniel", ajena: true }];

    expect(describirLoHecho({ tipo: "mover_pieza", item: 1, columna: "Publicado" }, ajena)).toContain(
      "Ya le avisé a Daniel."
    );
    expect(describirLoHecho({ tipo: "marcar_hecho", item: 1 }, ajena)).toContain("Ya le avisé a Daniel.");
    expect(describirLoHecho({ tipo: "reprogramar", item: 1, fecha: "2026-08-09" }, ajena)).toContain(
      "Ya le avisé a Daniel."
    );
  });

  // Una tarjeta propia no genera aviso, así que decir que se avisó sería mentir.
  it("no dice nada de avisos cuando la tarjeta es suya", () => {
    expect(describirLoHecho({ tipo: "mover_pieza", item: 1, columna: "Publicado" }, items)).not.toMatch(/avis/i);
  });

  // El caso que se cuela: una tarjeta TUYA que aparece por búsqueda —porque cayó
  // fuera de la ventana de tu agenda— trae responsable igual. Sin mirar `ajena`,
  // McLovin te contestaba "ya le avisé a Evan" hablándote de vos en tercera
  // persona, y mintiendo: a uno mismo no se le avisa.
  it("no avisa de uno mismo cuando la tarjeta encontrada es suya", () => {
    const propiaEncontrada = [{ ...item("Reel de brunch"), responsable: "Evan", ajena: false }];
    const texto = describirLoHecho({ tipo: "mover_pieza", item: 1, columna: "Publicado" }, propiaEncontrada);

    expect(texto).not.toMatch(/avis/i);
    expect(texto).not.toContain("Evan");
  });

  it("dice la fecha nueva al reprogramar", () => {
    const texto = describirLoHecho({ tipo: "reprogramar", item: 1, fecha: "2026-08-09" }, items);
    expect(texto).toContain("2026-08-09");
  });

  // Una línea de más en cada mensaje se vuelve ruido y se deja de leer, así que
  // solo se cuenta lo que de verdad tocó el tablero.
  it("no dice nada cuando la acción no toca el tablero", () => {
    expect(describirLoHecho({ tipo: "ninguna" }, items)).toBeNull();
    expect(describirLoHecho({ tipo: "descartar" }, items)).toBeNull();
  });

  it("no inventa un título si el número no existe en la agenda", () => {
    expect(describirLoHecho({ tipo: "mover_pieza", item: 9, columna: "Publicado" }, items)).toBeNull();
  });
});

// Lo que decide si una pieza que se va a crear ya está en el tablero. Se compara
// exacto y no "parecido": un falso positivo bloquea una pieza legítima, y esa no
// la reclama nadie — el duplicado, en cambio, se ve y se borra.
describe("normalizarTitulo", () => {
  it("ignora acentos, mayúsculas y espacios de más", () => {
    expect(normalizarTitulo("  Reel de BRUNCH  del   Día ")).toBe(normalizarTitulo("reel de brunch del dia"));
  });

  it("no da por iguales dos títulos que solo se parecen", () => {
    expect(normalizarTitulo("Reel de brunch 2")).not.toBe(normalizarTitulo("Reel de brunch"));
  });
});
