// `creator_profiles.languages` guarda códigos ISO ("es", "en") y arranca en
// '{es}' por default. Las marcas de hotelería sí filtran por creadores que
// puedan grabar en inglés, así que el campo es editable — pero nunca se muestra
// el código crudo.

export const LANGUAGE_OPTIONS = [
  { code: "es", label: "Español" },
  { code: "en", label: "Inglés" },
] as const;

const LABELS: Record<string, string> = Object.fromEntries(
  LANGUAGE_OPTIONS.map((l) => [l.code, l.label])
);

export function languageLabel(code: string) {
  return LABELS[code] ?? code;
}

export function parseLanguages(values: string[]) {
  const valid = LANGUAGE_OPTIONS.map((l) => l.code) as readonly string[];
  const picked = values.map((v) => v.trim()).filter((v) => valid.includes(v));
  // Todo creador del marketplace es costarricense: español es el piso.
  return picked.length > 0 ? [...new Set(picked)] : ["es"];
}
