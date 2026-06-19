import type { AuraModuleCode } from "./platformClient";

export type PricingPlanCode =
  | "STARTER"
  | "PROFESSIONAL"
  | "BUSINESS"
  | "ENTERPRISE"
  | "CORPORATE";

export interface PricingPlan {
  id: string;
  planCode: PricingPlanCode;
  name: string;
  employeeMin: number;
  employeeMax: number | null;
  includedLocations: number;
  includedCompanies: number;
  baseMonthlyPrice: number;
  extraLocationPrice: number;
  extraCompanyPrice: number;
  includedModules: AuraModuleCode[];
  active: boolean;
  sortOrder: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ModulePricingRule {
  moduleCode: AuraModuleCode;
  label: string;
  monthlyPrice: number;
  includedInBase: boolean;
  active: boolean;
}