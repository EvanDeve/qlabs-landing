import { describe, it, expect } from "vitest";
import { destinoConNext, RUTA_PENDIENTE } from "@/lib/ugc/estado-cuenta";

// `destinoConNext` es el único punto que decide dónde aterriza alguien después
// de entrar, y lo comparten las dos puertas (/ugc/login y /admin/login) más el
// server action. Es también el único lugar del proyecto que obedece texto que
// viene por la URL, así que lo que se prueba acá no es tanto la comodidad del
// deep link como los tres casos en que hay que desobedecerlo.

const CREADOR = "/ugc/creador";
const ADMIN = "/admin";

describe("destinoConNext", () => {
  it("sin next, manda al destino de la sesión", () => {
    expect(destinoConNext(ADMIN, undefined)).toBe(ADMIN);
    expect(destinoConNext(CREADOR, "")).toBe(CREADOR);
  });

  it("respeta el deep link dentro del propio árbol", () => {
    expect(destinoConNext(ADMIN, "/admin/pipeline")).toBe("/admin/pipeline");
    expect(destinoConNext(ADMIN, "/admin/pipeline/abc-123")).toBe("/admin/pipeline/abc-123");
    expect(destinoConNext(ADMIN, "/admin")).toBe("/admin");
    expect(destinoConNext(ADMIN, "/admin?mes=2026-08")).toBe("/admin?mes=2026-08");
    expect(destinoConNext(CREADOR, "/ugc/creador/aplicaciones")).toBe("/ugc/creador/aplicaciones");
  });

  it("no deja saltar a otro árbol: un creador con ?next=/admin cae en su panel", () => {
    expect(destinoConNext(CREADOR, "/admin")).toBe(CREADOR);
    expect(destinoConNext(CREADOR, "/admin/equipo")).toBe(CREADOR);
    expect(destinoConNext(ADMIN, "/ugc/marca/campanas")).toBe(ADMIN);
  });

  // El prefijo tiene que compararse por segmento. "/adminfalso" empieza con
  // "/admin", así que un startsWith pelado lo dejaría pasar.
  it("compara por segmento, no por prefijo de texto", () => {
    expect(destinoConNext(ADMIN, "/adminfalso")).toBe(ADMIN);
    expect(destinoConNext(CREADOR, "/ugc/creadores/vale")).toBe(CREADOR);
  });

  // Sin esto, un link con el dominio de Q Labs termina en otro sitio: es la
  // forma clásica de usar un login ajeno como trampolín de phishing.
  it("no es un redirector abierto", () => {
    expect(destinoConNext(ADMIN, "https://otro.sitio/admin")).toBe(ADMIN);
    expect(destinoConNext(ADMIN, "//otro.sitio/admin")).toBe(ADMIN);
    expect(destinoConNext(ADMIN, "http://localhost:3000/admin")).toBe(ADMIN);
    expect(destinoConNext(ADMIN, "admin/pipeline")).toBe(ADMIN);
  });

  // El gate de verificación gana siempre: si la cuenta todavía no puede entrar,
  // el deep link no la puede colar.
  it("una cuenta sin verificar o a medio registrar ignora el next", () => {
    expect(destinoConNext(RUTA_PENDIENTE, "/ugc/creador/aplicaciones")).toBe(RUTA_PENDIENTE);
    expect(destinoConNext(RUTA_PENDIENTE, RUTA_PENDIENTE)).toBe(RUTA_PENDIENTE);
    expect(destinoConNext("/ugc/onboarding", "/ugc/creador")).toBe("/ugc/onboarding");
  });
});
