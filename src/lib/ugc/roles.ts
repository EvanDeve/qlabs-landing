import type { AppRole } from "@/lib/database.types";

export const ROLE_DASHBOARD: Record<AppRole, string> = {
  creator: "/ugc/creador",
  brand: "/ugc/marca",
  admin: "/admin",
};

export const ROLE_DASHBOARD_LABEL: Record<AppRole, string> = {
  creator: "Ir a mi panel",
  brand: "Ir a mi panel",
  admin: "Ir a Q·OS",
};
