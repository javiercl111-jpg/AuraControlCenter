export const XLSX_IMPORT_FEATURE_FLAG =
  "VITE_MARKET_INTELLIGENCE_XLSX_IMPORT_ENABLED" as const;

export function isXlsxImportEnabled(
  rawValue: unknown = import.meta.env.VITE_MARKET_INTELLIGENCE_XLSX_IMPORT_ENABLED,
): boolean {
  return rawValue === "true";
}

export function assertXlsxImportEnabled(
  rawValue?: unknown,
): void {
  if (!isXlsxImportEnabled(rawValue)) {
    throw new Error(
      "La importación Excel/ZIP está temporalmente deshabilitada por seguridad.",
    );
  }
}