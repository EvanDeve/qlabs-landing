import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { firmaValida } from "@/lib/whatsapp/firma";
import { validarAccion } from "@/lib/ugc/agente";

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

// El modelo puede devolver cualquier cosa. Lo que no puede es lograr que pase
// algo que no está en la lista, ni tocar un ítem que no le mostramos.
describe("validarAccion", () => {
  const COLUMNAS = ["Guion", "Grabación", "Publicado"];

  it("acepta las cuatro formas válidas", () => {
    expect(validarAccion({ tipo: "ninguna" }, 3, COLUMNAS)).toEqual({ tipo: "ninguna" });
    expect(validarAccion({ tipo: "marcar_hecho", item: 2 }, 3, COLUMNAS)).toEqual({ tipo: "marcar_hecho", item: 2 });
    expect(validarAccion({ tipo: "mover_pieza", item: 1, columna: "Guion" }, 3, COLUMNAS)).toEqual({
      tipo: "mover_pieza",
      item: 1,
      columna: "Guion",
    });
    expect(validarAccion({ tipo: "reprogramar", item: 3, fecha: "2026-08-15" }, 3, COLUMNAS)).toEqual({
      tipo: "reprogramar",
      item: 3,
      fecha: "2026-08-15",
    });
  });

  // Un ítem fuera de rango es el modelo apuntándole a algo que no vio. Nunca
  // puede convertirse en una escritura.
  it("descarta un ítem que no existe en la agenda", () => {
    for (const item of [0, 4, -1, 99, 1.5]) {
      expect(validarAccion({ tipo: "marcar_hecho", item }, 3, COLUMNAS)).toEqual({ tipo: "ninguna" });
    }
  });

  it("descarta una columna que no está en el tablero", () => {
    expect(validarAccion({ tipo: "mover_pieza", item: 1, columna: "Inventada" }, 3, COLUMNAS)).toEqual({
      tipo: "ninguna",
    });
  });

  it("acepta la columna sin importar mayúsculas, que es como la va a escribir el modelo", () => {
    expect(validarAccion({ tipo: "mover_pieza", item: 1, columna: "grabación" }, 3, COLUMNAS)).toEqual({
      tipo: "mover_pieza",
      item: 1,
      columna: "Grabación",
    });
  });

  it("descarta una fecha que no sea YYYY-MM-DD", () => {
    for (const fecha of ["mañana", "15/08/2026", "2026-8-15", ""]) {
      expect(validarAccion({ tipo: "reprogramar", item: 1, fecha }, 3, COLUMNAS)).toEqual({ tipo: "ninguna" });
    }
  });

  it("descarta un tipo de acción que no inventamos nosotros", () => {
    expect(validarAccion({ tipo: "borrar_pieza", item: 1 }, 3, COLUMNAS)).toEqual({ tipo: "ninguna" });
    expect(validarAccion({ tipo: "reasignar", item: 1, a: "otro" }, 3, COLUMNAS)).toEqual({ tipo: "ninguna" });
  });

  it("no se cae con basura", () => {
    for (const basura of [null, undefined, "texto", 42, [], { sin: "tipo" }]) {
      expect(validarAccion(basura, 3, COLUMNAS)).toEqual({ tipo: "ninguna" });
    }
  });
});
