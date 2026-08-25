import { describe, expect, it } from "vitest";

import {
  assertXlsxImportEnabled,
  isXlsxImportEnabled,
  XLSX_IMPORT_FEATURE_FLAG,
} from "./xlsxImportContainment";

describe("xlsxImportContainment", () => {
  it("uses the canonical feature flag name", () => {
    expect(XLSX_IMPORT_FEATURE_FLAG).toBe(
      "VITE_MARKET_INTELLIGENCE_XLSX_IMPORT_ENABLED",
    );
  });

  it("fails closed when absent", () => {
    expect(isXlsxImportEnabled(undefined)).toBe(false);
    expect(() => assertXlsxImportEnabled(undefined)).toThrow();
  });

  it("fails closed for false and arbitrary values", () => {
    expect(isXlsxImportEnabled("false")).toBe(false);
    expect(isXlsxImportEnabled("1")).toBe(false);
    expect(isXlsxImportEnabled(true)).toBe(false);
  });

  it("enables only exact literal true", () => {
    expect(isXlsxImportEnabled("true")).toBe(true);
    expect(() => assertXlsxImportEnabled("true")).not.toThrow();
  });
});