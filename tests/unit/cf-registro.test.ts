import { describe, it, expect } from "vitest";
import {
  telefonoCR,
  esMayorDeEdad,
  problemaDelRegistro,
  limpiarCodigoInvitacion,
  type DatosRegistro,
} from "@/lib/cf/registro";

const bien: DatosRegistro = {
  fullName: "Ana Mora",
  phone: "8888 7777",
  email: "ana@correo.cr",
  birthdate: "1995-05-10",
  agentName: "Ána.Mora",
  aceptaTerminos: true,
  comparteConMarca: false,
  whatsapp: false,
};

describe("telefonoCR", () => {
  it("acepta las formas en que la gente escribe un número tico", () => {
    for (const n of ["88887777", "8888 7777", "8888-7777", "+506 8888 7777", "50688887777", "(506) 8888-7777"]) {
      expect(telefonoCR(n)).toBe("+50688887777");
    }
  });

  it("rechaza lo que no es de Costa Rica o no tiene 8 dígitos", () => {
    for (const n of ["", "8888777", "888877771", "+1 305 555 1234", "18887777", "98887777"]) {
      expect(telefonoCR(n)).toBeNull();
    }
  });
});

describe("esMayorDeEdad", () => {
  // Mediodía en Costa Rica, para que ninguna zona corra el día.
  const hoy = new Date("2026-09-24T18:00:00Z");

  it("cumple 18 hoy: entra", () => {
    expect(esMayorDeEdad("2008-09-24", hoy)).toBe(true);
  });

  it("cumple 18 mañana: no entra", () => {
    expect(esMayorDeEdad("2008-09-25", hoy)).toBe(false);
  });

  it("usa el día de Costa Rica, no el de UTC", () => {
    // 02:00 UTC del 25 son las 20:00 del 24 en Costa Rica: todavía es el 24.
    const noche = new Date("2026-09-25T02:00:00Z");
    expect(esMayorDeEdad("2008-09-25", noche)).toBe(false);
  });

  it("una fecha mal formada no pasa", () => {
    expect(esMayorDeEdad("24/09/2000", hoy)).toBe(false);
  });
});

describe("problemaDelRegistro", () => {
  const hoy = new Date("2026-09-24T18:00:00Z");

  it("un formulario bien lleno no tiene problema", () => {
    expect(problemaDelRegistro(bien, hoy)).toBeNull();
  });

  it("menor de edad", () => {
    expect(problemaDelRegistro({ ...bien, birthdate: "2010-01-01" }, hoy)).toContain("mayores de 18");
  });

  it("sin términos", () => {
    expect(problemaDelRegistro({ ...bien, aceptaTerminos: false }, hoy)).toContain("términos");
  });

  it("alias con espacio o demasiado corto", () => {
    expect(problemaDelRegistro({ ...bien, agentName: "ana mora" }, hoy)).toContain("nombre de agente");
    expect(problemaDelRegistro({ ...bien, agentName: "an" }, hoy)).toContain("nombre de agente");
  });

  it("los opcionales no son obligatorios", () => {
    expect(problemaDelRegistro({ ...bien, comparteConMarca: false, whatsapp: false }, hoy)).toBeNull();
  });
});

describe("limpiarCodigoInvitacion", () => {
  it("normaliza a mayúsculas", () => {
    expect(limpiarCodigoInvitacion("yjrga5fxak")).toBe("YJRGA5FXAK");
  });

  it("rechaza lo que no puede ser un código (y así no llega a la base)", () => {
    for (const c of ["", "CORTO", "YJRGA5FXAK1", "YJRGA0FXAK", "../../etc"]) {
      expect(limpiarCodigoInvitacion(c)).toBeNull();
    }
  });
});
