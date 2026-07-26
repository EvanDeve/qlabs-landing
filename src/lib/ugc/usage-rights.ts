// Derechos de uso del contenido. Se comparte entre el formulario de la marca,
// el detalle de la campaña y el detalle de la promo que ve el creador antes de
// aplicar, para que las tres superficies digan exactamente lo mismo.

export const USAGE_SCOPES = ["organico", "pauta", "todo_medio"] as const;
export const USAGE_DURATIONS = ["meses_3", "meses_6", "meses_12", "perpetuo"] as const;

export type UsageScope = (typeof USAGE_SCOPES)[number];
export type UsageDuration = (typeof USAGE_DURATIONS)[number];

// Etiqueta corta para chips; descripción para el formulario, donde la marca
// está decidiendo y necesita entender qué está cediendo.
export const USAGE_SCOPE_LABEL: Record<UsageScope, string> = {
  organico: "Solo redes de la marca",
  pauta: "Orgánico + pauta",
  todo_medio: "Cualquier medio",
};

export const USAGE_SCOPE_DESC: Record<UsageScope, string> = {
  organico: "La marca publica la pieza en sus propias redes, sin pagar para promocionarla.",
  pauta: "Además de sus redes, la marca puede invertir en anuncios con esta pieza.",
  todo_medio: "Sin límite de canal: web, email, pantallas en local, vallas, lo que sea.",
};

export const USAGE_DURATION_LABEL: Record<UsageDuration, string> = {
  meses_3: "3 meses",
  meses_6: "6 meses",
  meses_12: "12 meses",
  perpetuo: "Siempre",
};

export function isUsageScope(value: string): value is UsageScope {
  return (USAGE_SCOPES as readonly string[]).includes(value);
}

export function isUsageDuration(value: string): value is UsageDuration {
  return (USAGE_DURATIONS as readonly string[]).includes(value);
}

export type UsageRights = {
  usage_rights_scope: UsageScope | null;
  usage_rights_duration: UsageDuration | null;
  usage_rights_editing: boolean | null;
  usage_rights_notes: string | null;
};

// Las campañas creadas antes de esta función no tienen derechos pactados. Se
// distingue a propósito de "no puede": no se asume nada a favor de la marca.
export function hasUsageRights(c: Partial<UsageRights>): boolean {
  return Boolean(c.usage_rights_scope && c.usage_rights_duration);
}

// Chips listos para render. Devuelve [] si la campaña es de las viejas.
export function usageRightsChips(c: Partial<UsageRights>): string[] {
  if (!hasUsageRights(c)) return [];
  return [
    USAGE_SCOPE_LABEL[c.usage_rights_scope as UsageScope],
    USAGE_DURATION_LABEL[c.usage_rights_duration as UsageDuration],
    c.usage_rights_editing ? "Editable" : "Sin editar",
  ];
}
