import { describe, it, expect } from "vitest";
import { leerBusqueda, vale } from "@/lib/ugc/busqueda";

/** Los Heroes y las columnas reales, con sus nombres tal como están cargados. */
const HEROES = [
  { id: "h1", name: "Zonna Gastrobar" },
  { id: "h2", name: "Kosta Asiatika" },
  { id: "h3", name: "La Árboleda" },
  { id: "h4", name: "Dulce Chilena" },
  { id: "h5", name: "Entrecote" },
];

const COLUMNAS = [
  { id: "v3", name: "Por editar" },
  { id: "v4", name: "EN CURSO/Revision" },
  { id: "v6", name: "Publicado" },
  { id: "i8", name: "En Progreso" },
];

const leer = (mensaje: string) => leerBusqueda(mensaje, HEROES, COLUMNAS);

describe("leerBusqueda", () => {
  it("reconoce al Hero aunque lo escriban corto y en minúsculas", () => {
    // Nadie escribe "Zonna Gastrobar" por WhatsApp.
    expect(leer("qué le queda a zonna gastrobar?").heroIds).toEqual(["h1"]);
    expect(leer("cómo va lo de KOSTA ASIATIKA").heroIds).toEqual(["h2"]);
  });

  it("reconoce el Hero sin tildes, que es como se escribe en el celular", () => {
    expect(leer("qué hay de la arboleda").heroIds).toEqual(["h3"]);
  });

  it("reconoce la columna nombrada", () => {
    expect(leer("cuántas cosas hay en Por editar?").columnaIds).toEqual(["v3"]);
    expect(leer("qué está en en progreso").columnaIds).toEqual(["i8"]);
  });

  // El nombre del Hero ya trajo TODAS sus tarjetas: volver a buscar "zonna"
  // dentro de los títulos es pedir lo mismo por segunda vez.
  it("no busca por título las palabras del Hero que ya pescó", () => {
    const b = leer("el reel de brunch de zonna gastrobar");
    expect(b.heroIds).toEqual(["h1"]);
    expect(b.palabras).not.toContain("zonna");
    expect(b.palabras).not.toContain("gastrobar");
    expect(b.palabras).toContain("reel");
    expect(b.palabras).toContain("brunch");
  });

  it("descarta las palabras que aparecen en cualquier mensaje", () => {
    // "mae", "pura vida" y "dale" no están en ningún diccionario de stopwords y
    // son las que más se repiten en este chat.
    const b = leer("mae, qué tengo pendiente esta semana? dale gracias");
    expect(b.palabras).not.toContain("mae");
    expect(b.palabras).not.toContain("semana");
    expect(b.palabras).not.toContain("dale");
    expect(b.palabras).not.toContain("gracias");
  });

  it("descarta las palabras demasiado cortas para buscar un título", () => {
    for (const corta of ["de", "el", "va", "ya"]) {
      expect(leer(`y ${corta} qué`).palabras).not.toContain(corta);
    }
  });

  // Las palabras se meten dentro de un `or(...)` de PostgREST, separado por
  // comas: un signo de puntuación pegado partiría la condición al medio.
  it("saca la puntuación, que rompería la consulta", () => {
    const b = leer("¿cómo va el «brunch», ya está?");
    expect(b.palabras).toContain("brunch");
    for (const p of b.palabras) expect(p).toMatch(/^[\p{L}\p{N}]+$/u);
  });

  it("no repite una palabra dicha dos veces", () => {
    const b = leer("el brunch, ese brunch del domingo");
    expect(b.palabras.filter((p) => p === "brunch")).toHaveLength(1);
  });
});

describe("vale", () => {
  // Sin esto se pagaría una consulta al tablero por cada "dale" y cada "gracias".
  it("un mensaje sin nada que buscar no dispara consultas", () => {
    expect(vale(leer("dale"))).toBe(false);
    expect(vale(leer("gracias mae"))).toBe(false);
    expect(vale(leer("sí"))).toBe(false);
  });

  it("un mensaje que menciona algo sí busca", () => {
    expect(vale(leer("el reel de brunch"))).toBe(true);
    expect(vale(leer("qué hay de entrecote"))).toBe(true);
    expect(vale(leer("qué hay en publicado"))).toBe(true);
  });
});
