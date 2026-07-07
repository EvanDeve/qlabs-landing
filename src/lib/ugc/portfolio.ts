export const PORTFOLIO_CATEGORIES = ["ugc", "foto"] as const;

export const PORTFOLIO_CATEGORY_LABEL: Record<string, string> = {
  ugc: "UGC",
  foto: "Fotografía",
};

export const PORTFOLIO_BUCKET = "portfolio";

export const MAX_PORTFOLIO_FILE_BYTES = 25 * 1024 * 1024;
