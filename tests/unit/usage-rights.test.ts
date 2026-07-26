import { describe, it, expect } from "vitest";
import {
  hasUsageRights,
  usageRightsChips,
  isUsageScope,
  isUsageDuration,
  USAGE_SCOPES,
  USAGE_DURATIONS,
} from "@/lib/ugc/usage-rights";

// Los derechos de uso son lo que el creador lee antes de comprometerse. El
// riesgo real acá no es que se vea feo: es que una campaña sin derechos
// pactados se muestre como si tuviera alguno.
describe("hasUsageRights", () => {
  it("es falso para campañas viejas, anteriores al campo", () => {
    expect(
      hasUsageRights({
        usage_rights_scope: null,
        usage_rights_duration: null,
        usage_rights_editing: null,
        usage_rights_notes: null,
      })
    ).toBe(false);
  });

  it("exige alcance Y duración: con uno solo no hay trato claro", () => {
    expect(hasUsageRights({ usage_rights_scope: "pauta", usage_rights_duration: null })).toBe(false);
    expect(hasUsageRights({ usage_rights_scope: null, usage_rights_duration: "meses_6" })).toBe(false);
    expect(hasUsageRights({ usage_rights_scope: "pauta", usage_rights_duration: "meses_6" })).toBe(true);
  });

  it("una nota suelta no alcanza para dar por pactados los derechos", () => {
    expect(
      hasUsageRights({
        usage_rights_scope: null,
        usage_rights_duration: null,
        usage_rights_notes: "lo hablamos por WhatsApp",
      })
    ).toBe(false);
  });
});

describe("usageRightsChips", () => {
  it("no devuelve chips cuando no hay derechos pactados", () => {
    expect(usageRightsChips({ usage_rights_scope: null, usage_rights_duration: null })).toEqual([]);
  });

  it("arma alcance, duración y edición en ese orden", () => {
    expect(
      usageRightsChips({
        usage_rights_scope: "pauta",
        usage_rights_duration: "meses_6",
        usage_rights_editing: true,
      })
    ).toEqual(["Orgánico + pauta", "6 meses", "Editable"]);
  });

  it("distingue explícitamente 'Sin editar' — el silencio no puede leerse como permiso", () => {
    const chips = usageRightsChips({
      usage_rights_scope: "organico",
      usage_rights_duration: "meses_3",
      usage_rights_editing: false,
    });
    expect(chips).toEqual(["Solo redes de la marca", "3 meses", "Sin editar"]);
  });

  it("editing en null se trata como 'Sin editar', nunca como permitido", () => {
    const chips = usageRightsChips({
      usage_rights_scope: "todo_medio",
      usage_rights_duration: "perpetuo",
      usage_rights_editing: null,
    });
    expect(chips[2]).toBe("Sin editar");
  });

  it("tiene etiqueta para cada valor posible del enum", () => {
    for (const scope of USAGE_SCOPES) {
      for (const duration of USAGE_DURATIONS) {
        const chips = usageRightsChips({
          usage_rights_scope: scope,
          usage_rights_duration: duration,
          usage_rights_editing: true,
        });
        expect(chips).toHaveLength(3);
        expect(chips.every((c) => typeof c === "string" && c.length > 0)).toBe(true);
        expect(chips.some((c) => c.includes("undefined"))).toBe(false);
      }
    }
  });
});

// Estos guards son lo que separa lo que manda el navegador de lo que entra a la
// base: el server action los usa para revalidar los radios del formulario.
describe("guards de enum", () => {
  it("acepta exactamente los valores del enum de Postgres", () => {
    expect(USAGE_SCOPES.every(isUsageScope)).toBe(true);
    expect(USAGE_DURATIONS.every(isUsageDuration)).toBe(true);
  });

  it("rechaza basura, vacío y valores del otro enum", () => {
    for (const malo of ["", "PAUTA", "pauta ", "todo", "meses_6", "'; drop table campaigns;--"]) {
      expect(isUsageScope(malo)).toBe(false);
    }
    for (const malo of ["", "6", "meses_9", "siempre", "pauta"]) {
      expect(isUsageDuration(malo)).toBe(false);
    }
  });
});
