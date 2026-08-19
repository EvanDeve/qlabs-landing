import { describe, it, expect } from "vitest";
import { textoDelVacio } from "@/components/ugc/admin/CalendarView";

// El calendario tiene dos filtros que se cruzan (tipo y Hero), así que la
// agenda del día puede quedar vacía por cuatro motivos distintos. El texto
// tiene que decir CUÁL, porque el riesgo concreto es afirmar que no hay nada
// un día que sí tiene cosas: si el equipo lee "Nada agendado" un jueves con 16
// publicaciones, deja de confiar en la pantalla.
describe("textoDelVacio", () => {
  it("sin filtros, el día está vacío de verdad", () => {
    expect(textoDelVacio(null, null, 0)).toBe("Nada agendado este día.");
  });

  it("con un tipo puesto, nombra el tipo y NO dice que el día esté vacío", () => {
    const t = textoDelVacio("grabacion", null, 4);
    expect(t).toBe("Sin grabaciones este día. El día tiene 4 items.");
    expect(t).not.toContain("Nada agendado");
  });

  it("con un Hero puesto, nombra al Hero", () => {
    expect(textoDelVacio(null, "Zonna Gastrobar", 9)).toBe(
      "Nada de Zonna Gastrobar este día. El día tiene 9 items."
    );
  });

  it("con los dos, nombra los dos", () => {
    expect(textoDelVacio("grabacion", "Zonna Gastrobar", 3)).toBe(
      "Sin grabaciones de Zonna Gastrobar este día. El día tiene 3 items."
    );
  });

  it("no cuenta un día que además está vacío de verdad", () => {
    // "El día tiene 0 items" es ruido: la primera frase ya lo dijo.
    expect(textoDelVacio("grabacion", null, 0)).toBe("Sin grabaciones este día.");
    expect(textoDelVacio("grabacion", "Snowty", 0)).toBe("Sin grabaciones de Snowty este día.");
  });

  it("singular y plural de la cuenta", () => {
    expect(textoDelVacio("reunion", null, 1)).toContain("1 item.");
    expect(textoDelVacio("reunion", null, 2)).toContain("2 items.");
  });

  it("usa el plural escrito a mano y no uno pegado con s", () => {
    // "publicaciónes" es lo que sale de concatenar; acá tiene que salir bien.
    expect(textoDelVacio("publicacion", null, 0)).toBe("Sin publicaciones este día.");
    expect(textoDelVacio("guion", null, 0)).toBe("Sin guiones este día.");
  });
});
