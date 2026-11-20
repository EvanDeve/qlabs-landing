import { describe, it, expect } from "vitest";
import {
  armarFila,
  avanceDelDia,
  diasDeAdelanto,
  textoAdelanto,
  textoFilaVacia,
  vistaDelDashboard,
  type VideoDeFila,
} from "@/lib/ugc/edicion";

const HOY = "2026-11-20"; // viernes
const SABADO = "2026-11-21";

function video(id: string, publishDate: string | null, extra: Partial<VideoDeFila> = {}): VideoDeFila {
  return {
    id,
    titulo: `Video ${id}`,
    cliente: "Delitalia",
    publishDate,
    publishTime: null,
    createdAt: "2026-11-01T12:00:00Z",
    plataforma: "reels",
    grabado: false,
    ...extra,
  };
}

describe("vistaDelDashboard", () => {
  it("solo el editor activo ve la vista de editor", () => {
    expect(vistaDelDashboard({ staff_role: "editor", active: true })).toBe("editor");
    expect(vistaDelDashboard({ staff_role: "editor", active: false })).toBe("agencia");
    expect(vistaDelDashboard({ staff_role: "director", active: true })).toBe("agencia");
    expect(vistaDelDashboard({ staff_role: "guionista", active: true })).toBe("agencia");
    expect(vistaDelDashboard(null)).toBe("agencia");
  });
});

describe("armarFila", () => {
  it("separa los atrasados (el más viejo primero) y ordena el resto como el reparto", () => {
    const fila = armarFila(
      [
        video("sin-fecha", null),
        video("futuro", "2026-11-25"),
        video("hoy", HOY),
        video("atrasado-nuevo", "2026-11-18"),
        video("atrasado-viejo", "2026-09-30"),
      ],
      HOY
    );
    expect(fila.atrasados.map((v) => v.id)).toEqual(["atrasado-viejo", "atrasado-nuevo"]);
    expect(fila.atrasados.map((v) => v.diasParaPublicar)).toEqual([-51, -2]);
    expect(fila.resto.map((v) => v.id)).toEqual(["hoy", "futuro", "sin-fecha"]);
    expect(fila.resto.map((v) => v.diasParaPublicar)).toEqual([0, 5, null]);
  });

  it("conserva los datos de cada video", () => {
    const fila = armarFila([video("a", "2026-11-22", { grabado: true, plataforma: "tiktok" })], HOY);
    expect(fila.resto[0]).toMatchObject({ id: "a", grabado: true, plataforma: "tiktok", cliente: "Delitalia" });
  });

  it("fila vacía", () => {
    expect(armarFila([], HOY)).toEqual({ atrasados: [], resto: [] });
  });
});

describe("diasDeAdelanto y textoAdelanto", () => {
  it("cuenta hasta el primer video con fecha e ignora los sin fecha", () => {
    expect(diasDeAdelanto([{ publishDate: null }, { publishDate: "2026-11-27" }, { publishDate: "2026-11-23" }], HOY)).toBe(3);
  });
  it("0 si el primero se publica hoy", () => {
    expect(diasDeAdelanto([{ publishDate: HOY }], HOY)).toBe(0);
  });
  it("negativo si el primero está atrasado", () => {
    expect(diasDeAdelanto([{ publishDate: "2026-11-25" }, { publishDate: "2026-11-17" }], HOY)).toBe(-3);
  });
  it("null sin fechas", () => {
    expect(diasDeAdelanto([], HOY)).toBeNull();
    expect(diasDeAdelanto([{ publishDate: null }], HOY)).toBeNull();
  });
  it("textos", () => {
    expect(textoAdelanto(3)).toBe("3 días de adelanto");
    expect(textoAdelanto(1)).toBe("1 día de adelanto");
    expect(textoAdelanto(0)).toBe("Al día: el próximo se publica hoy");
    expect(textoAdelanto(-1)).toBe("1 día de atraso");
    expect(textoAdelanto(-4)).toBe("4 días de atraso");
    expect(textoAdelanto(null)).toBeNull();
  });
});

describe("avanceDelDia", () => {
  it("día hábil: llevás N de 8", () => {
    expect(avanceDelDia(3, HOY)).toEqual({ terminados: 3, meta: 8, texto: "Llevás 3 de 8", cumplida: false });
  });
  it("puede pasar de 8", () => {
    expect(avanceDelDia(10, HOY)).toEqual({ terminados: 10, meta: 8, texto: "Llevás 10 de 8", cumplida: true });
    expect(avanceDelDia(8, HOY).cumplida).toBe(true);
  });
  it("sábado: sin meta", () => {
    const a = avanceDelDia(2, SABADO);
    expect(a.meta).toBeNull();
    expect(a.cumplida).toBeNull();
    expect(a.texto).not.toContain("de 8");
    expect(a.texto).toBe("Terminaste 2 hoy");
  });
  it("sábado con 1 y con 0", () => {
    expect(avanceDelDia(1, SABADO).texto).toBe("Terminaste 1 hoy");
    expect(avanceDelDia(0, SABADO).texto).toBe("Hoy no hay meta");
  });
});

describe("textoFilaVacia", () => {
  it("sin disponibles", () => {
    expect(textoFilaVacia(0)).toBe("No tenés videos en tu fila y no hay ninguno disponible para tomar.");
  });
  it("con disponibles", () => {
    expect(textoFilaVacia(1)).toBe("No tenés videos en tu fila. Hay 1 disponible en Por editar.");
    expect(textoFilaVacia(12)).toBe("No tenés videos en tu fila. Hay 12 disponibles en Por editar.");
  });
});
