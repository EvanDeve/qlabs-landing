import { describe, it, expect } from "vitest";
import { modoContacto, enlacesDeTelefono } from "@/lib/ugc/contacto-kit";

const CREADOR = "creador-1";
const visitante = (rol: string | null, marcaVerificada = false, id = "otro") => ({
  id,
  rol,
  marcaVerificada,
});

describe("modoContacto", () => {
  it("si el creador no muestra su teléfono no hay nada, para nadie (RF-12)", () => {
    for (const v of [null, visitante("brand", true), visitante("admin"), visitante("creator", false, CREADOR)]) {
      expect(modoContacto({ tieneTelefono: false, creadorId: CREADOR, visitante: v })).toBe("nada");
    }
  });

  it("sin sesión pide iniciar sesión como marca (RF-09)", () => {
    expect(modoContacto({ tieneTelefono: true, creadorId: CREADOR, visitante: null })).toBe("pedir-sesion");
  });

  it("el creador mirando su propio kit lo ve como propio (RF-11)", () => {
    expect(
      modoContacto({ tieneTelefono: true, creadorId: CREADOR, visitante: visitante("creator", false, CREADOR) })
    ).toBe("propio");
  });

  it("una marca verificada puede verlo (RF-08)", () => {
    expect(modoContacto({ tieneTelefono: true, creadorId: CREADOR, visitante: visitante("brand", true) })).toBe("ver");
  });

  it("el equipo de Q Labs puede verlo", () => {
    expect(modoContacto({ tieneTelefono: true, creadorId: CREADOR, visitante: visitante("admin") })).toBe("ver");
  });

  it("una marca sin verificar no lo ve (RF-09)", () => {
    expect(modoContacto({ tieneTelefono: true, creadorId: CREADOR, visitante: visitante("brand", false) })).toBe(
      "marca-sin-verificar"
    );
  });

  it("otro creador o un miembro ven que es solo para marcas, sin invitarlos a registrarse", () => {
    for (const rol of ["creator", "member", null]) {
      expect(modoContacto({ tieneTelefono: true, creadorId: CREADOR, visitante: visitante(rol) })).toBe(
        "solo-marcas"
      );
    }
  });
});

describe("enlacesDeTelefono", () => {
  it("arma los enlaces de un número tico", () => {
    expect(enlacesDeTelefono("+50688887777")).toEqual({
      legible: "+506 8888 7777",
      whatsapp: "https://wa.me/50688887777",
      llamar: "tel:+50688887777",
    });
  });

  it("un número de otro país sale tal cual, sin inventarle formato", () => {
    expect(enlacesDeTelefono("+14155550123")).toEqual({
      legible: "+14155550123",
      whatsapp: "https://wa.me/14155550123",
      llamar: "tel:+14155550123",
    });
  });
});
