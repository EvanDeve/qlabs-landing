import { describe, it, expect } from "vitest";
import { resumenDeGrabacion, mensajeAlQuitarVideo } from "@/lib/ugc/cronograma";

describe("resumenDeGrabacion", () => {
  it("un mes pendiente no tiene nada que grabar: ni total ni grabados", () => {
    // Si los videos sin tarjeta contaran en el total, un cronograma en
    // revisión diría "0 de 10 grabados" como si fuera un atraso.
    expect(resumenDeGrabacion([{ grabado: null }, { grabado: null }])).toEqual({
      grabados: 0,
      conTarjeta: 0,
      estado: "sin-tarjetas",
    });
    expect(resumenDeGrabacion([]).estado).toBe("sin-tarjetas");
  });

  it("cuenta solo los videos que ya son tarjeta", () => {
    expect(resumenDeGrabacion([{ grabado: true }, { grabado: false }, { grabado: null }])).toEqual({
      grabados: 1,
      conTarjeta: 2,
      estado: "parcial",
    });
  });

  it("distingue ninguno de todos", () => {
    expect(resumenDeGrabacion([{ grabado: false }, { grabado: false }]).estado).toBe("ninguno");
    expect(resumenDeGrabacion([{ grabado: true }, { grabado: true }]).estado).toBe("todos");
    expect(resumenDeGrabacion([{ grabado: true }]).estado).toBe("todos");
  });
});

describe("mensajeAlQuitarVideo", () => {
  it("sin tarjeta: solo avisa que el Hero deja de verlo", () => {
    const m = mensajeAlQuitarVideo(3, { enPipeline: false, grabado: false });
    expect(m).toContain("video 3");
    expect(m).toContain("El Hero deja de verlo");
    expect(m).not.toContain("tarjeta");
  });

  it("con tarjeta: dice que se lleva la tarjeta del pipeline", () => {
    const m = mensajeAlQuitarVideo(7, { enPipeline: true, grabado: false });
    expect(m).toContain("Se borra también su tarjeta del pipeline");
    expect(m).toContain("el Hero deja de verlo");
    expect(m).not.toContain("grabada");
  });

  it("grabado: lo dice, porque es trabajo hecho", () => {
    const m = mensajeAlQuitarVideo(1, { enPipeline: true, grabado: true });
    expect(m).toContain("tarjeta del pipeline, que ya figura como grabada");
  });
});
