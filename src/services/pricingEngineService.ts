import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import { db } from "../config/firebase";
import type { AuraModuleCode } from "../types/platformClient";
import type {
  ModulePricingRule,
  PricingPlan,
  PricingPlanCode,
} from "../types/pricingPlan";
import type {
  FounderSetupDiscountMode,
  HcmMigrationType,
  ImplementationType,
  MaintenanceInitialLoadType,
  PricingQuoteInput,
  PricingQuoteResult,
  QuoteLineItem,
  SetupBreakdownItem,
  SetupCalculationType,
} from "../types/quote";

const PRICING_RULES_COLLECTION = "platform_pricing_rules";
const MODULE_RULES_COLLECTION = "platform_module_pricing_rules";
const SETTINGS_COLLECTION = "platform_settings";

const DEFAULT_ANNUAL_DISCOUNT_PERCENT = 10;
const DEFAULT_MAX_ALLOWED_DISCOUNT_PERCENT = 15;

const HCM_SETUP_BASE_PRICE = 19900;
const HCM_SETUP_POINT_PRICE = 2500;

const MAINTENANCE_SETUP_BASE_PRICE = 12900;
const MAINTENANCE_SETUP_POINT_PRICE = 2000;

interface PricingSettings {
  annualDiscountPercent: number;
  maxAllowedDiscountPercent: number;
}

const DEFAULT_PLANS: Omit<PricingPlan, "id">[] = [
  {
    planCode: "STARTER",
    name: "Starter",
    employeeMin: 1,
    employeeMax: 50,
    includedLocations: 1,
    includedCompanies: 1,
    baseMonthlyPrice: 2999,
    extraLocationPrice: 500,
    extraCompanyPrice: 1000,
    includedModules: ["AURA_HCM"],
    active: true,
    sortOrder: 1,
  },
  {
    planCode: "PROFESSIONAL",
    name: "Professional",
    employeeMin: 51,
    employeeMax: 200,
    includedLocations: 3,
    includedCompanies: 1,
    baseMonthlyPrice: 4999,
    extraLocationPrice: 500,
    extraCompanyPrice: 1000,
    includedModules: ["AURA_HCM"],
    active: true,
    sortOrder: 2,
  },
  {
    planCode: "BUSINESS",
    name: "Business",
    employeeMin: 201,
    employeeMax: 500,
    includedLocations: 5,
    includedCompanies: 1,
    baseMonthlyPrice: 6999,
    extraLocationPrice: 500,
    extraCompanyPrice: 1000,
    includedModules: ["AURA_HCM"],
    active: true,
    sortOrder: 3,
  },
  {
    planCode: "ENTERPRISE",
    name: "Enterprise",
    employeeMin: 501,
    employeeMax: 1000,
    includedLocations: 10,
    includedCompanies: 1,
    baseMonthlyPrice: 9999,
    extraLocationPrice: 500,
    extraCompanyPrice: 1000,
    includedModules: ["AURA_HCM"],
    active: true,
    sortOrder: 4,
  },
  {
    planCode: "CORPORATE",
    name: "Corporate",
    employeeMin: 1001,
    employeeMax: null,
    includedLocations: 20,
    includedCompanies: 1,
    baseMonthlyPrice: 14999,
    extraLocationPrice: 500,
    extraCompanyPrice: 1000,
    includedModules: ["AURA_HCM"],
    active: true,
    sortOrder: 5,
  },
];

const DEFAULT_MODULE_RULES: ModulePricingRule[] = [
  {
    moduleCode: "AURA_HCM",
    label: "Aura HCM",
    monthlyPrice: 0,
    includedInBase: true,
    active: true,
  },
  {
    moduleCode: "AURA_MAINTENANCE",
    label: "Aura Maintenance OS",
    monthlyPrice: 3500,
    includedInBase: false,
    active: true,
  },
  {
    moduleCode: "AURA_SIGNATURE",
    label: "Aura Signature",
    monthlyPrice: 1500,
    includedInBase: false,
    active: true,
  },
  {
    moduleCode: "AURA_INTELLIGENCE",
    label: "Aura Intelligence",
    monthlyPrice: 2500,
    includedInBase: false,
    active: true,
  },
];

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

let cachedPlans: CacheEntry<PricingPlan[]> | null = null;
let cachedModuleRules: CacheEntry<ModulePricingRule[]> | null = null;
let cachedSettings: CacheEntry<PricingSettings> | null = null;

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes TTL

export function clearPricingCache(): void {
  cachedPlans = null;
  cachedModuleRules = null;
  cachedSettings = null;
}

function isCacheValid<T>(entry: CacheEntry<T> | null): boolean {
  if (!entry) return false;
  return Date.now() - entry.timestamp < CACHE_TTL;
}

export async function seedDefaultPricingRules(): Promise<void> {
  clearPricingCache();

  await Promise.all(
    DEFAULT_PLANS.map((plan) =>
      setDoc(
        doc(db, PRICING_RULES_COLLECTION, plan.planCode),
        {
          ...plan,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      )
    )
  );

  await Promise.all(
    DEFAULT_MODULE_RULES.map((rule) =>
      setDoc(
        doc(db, MODULE_RULES_COLLECTION, rule.moduleCode),
        {
          ...rule,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      )
    )
  );

  await setDoc(
    doc(db, SETTINGS_COLLECTION, "pricing"),
    {
      annualDiscountPercent: DEFAULT_ANNUAL_DISCOUNT_PERCENT,
      maxAllowedDiscountPercent: DEFAULT_MAX_ALLOWED_DISCOUNT_PERCENT,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function getPricingSettings(): Promise<PricingSettings> {
  if (isCacheValid(cachedSettings)) {
    return cachedSettings!.data;
  }

  const settingsSnap = await getDoc(doc(db, SETTINGS_COLLECTION, "pricing"));

  if (!settingsSnap.exists()) {
    await seedDefaultPricingRules();

    const data = {
      annualDiscountPercent: DEFAULT_ANNUAL_DISCOUNT_PERCENT,
      maxAllowedDiscountPercent: DEFAULT_MAX_ALLOWED_DISCOUNT_PERCENT,
    };
    cachedSettings = { data, timestamp: Date.now() };
    return data;
  }

  const data = settingsSnap.data();
  const parsedData: PricingSettings = {
    annualDiscountPercent:
      Number(data.annualDiscountPercent) || DEFAULT_ANNUAL_DISCOUNT_PERCENT,
    maxAllowedDiscountPercent:
      Number(data.maxAllowedDiscountPercent) ||
      DEFAULT_MAX_ALLOWED_DISCOUNT_PERCENT,
  };

  cachedSettings = { data: parsedData, timestamp: Date.now() };
  return parsedData;
}

export async function getPricingPlans(): Promise<PricingPlan[]> {
  if (isCacheValid(cachedPlans)) {
    return cachedPlans!.data;
  }

  const q = query(
    collection(db, PRICING_RULES_COLLECTION),
    orderBy("sortOrder", "asc")
  );

  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    await seedDefaultPricingRules();

    const data = DEFAULT_PLANS.map((plan) => ({
      id: plan.planCode,
      ...plan,
    }));
    cachedPlans = { data, timestamp: Date.now() };
    return data;
  }

  const data = snapshot.docs.map((pricingDoc) => ({
    id: pricingDoc.id,
    ...(pricingDoc.data() as Omit<PricingPlan, "id">),
  }));

  cachedPlans = { data, timestamp: Date.now() };
  return data;
}

export async function getModulePricingRules(): Promise<ModulePricingRule[]> {
  if (isCacheValid(cachedModuleRules)) {
    return cachedModuleRules!.data;
  }

  const snapshot = await getDocs(collection(db, MODULE_RULES_COLLECTION));

  if (snapshot.empty) {
    await seedDefaultPricingRules();
    cachedModuleRules = { data: DEFAULT_MODULE_RULES, timestamp: Date.now() };
    return DEFAULT_MODULE_RULES;
  }

  const data = snapshot.docs.map((moduleDoc) => moduleDoc.data() as ModulePricingRule);
  cachedModuleRules = { data, timestamp: Date.now() };
  return data;
}

function findPlanForEmployees(
  plans: PricingPlan[],
  employeeCount: number
): PricingPlan {
  const activePlans = plans.filter((plan) => plan.active);

  const matchedPlan = activePlans.find((plan) => {
    const minValid = employeeCount >= plan.employeeMin;
    const maxValid = plan.employeeMax === null || employeeCount <= plan.employeeMax;

    return minValid && maxValid;
  });

  return matchedPlan || activePlans[activePlans.length - 1];
}

function clampDiscount(value: number, max: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > max) return max;

  return value;
}

function calculateHcmEmployeeScore(employeeCount: number): number {
  if (employeeCount >= 2500) return 5;
  if (employeeCount >= 1001) return 3;
  if (employeeCount >= 501) return 2;
  if (employeeCount >= 251) return 1;
  return 0;
}

function calculateHcmBranchScore(locationCount: number): number {
  if (locationCount > 20) return 4;
  if (locationCount >= 6) return 2;
  if (locationCount >= 2) return 1;
  return 0;
}

function calculateHcmMigrationScore(type: HcmMigrationType): number {
  if (type === "COMPLEX_SYSTEM") return 5;
  if (type === "EXTERNAL_SYSTEM") return 3;
  if (type === "SIMPLE_EXCEL") return 1;
  return 0;
}

function calculateImplementationScore(type: ImplementationType): number {
  if (type === "ONSITE") return 5;
  if (type === "HYBRID") return 2;
  return 0;
}

function calculateIntegrationScore(count: number): number {
  if (count > 5) return 8;
  if (count >= 3) return 5;
  if (count >= 1) return 2;
  return 0;
}

function calculateMaintenanceAssetScore(assetCount: number): number {
  if (assetCount > 5000) return 8;
  if (assetCount >= 2501) return 4;
  if (assetCount >= 1001) return 2;
  if (assetCount >= 500) return 1;
  return 0;
}

function calculateMaintenanceLocationScore(locationCount: number): number {
  if (locationCount > 25) return 8;
  if (locationCount >= 11) return 4;
  if (locationCount >= 2) return 2;
  return 0;
}

function calculateMaintenanceTechnicianScore(technicianCount: number): number {
  if (technicianCount > 100) return 6;
  if (technicianCount >= 51) return 4;
  if (technicianCount >= 26) return 2;
  if (technicianCount >= 10) return 1;
  return 0;
}

function calculateMaintenanceInitialLoadScore(
  type: MaintenanceInitialLoadType
): number {
  if (type === "CMMS_MIGRATION") return 5;
  if (type === "EXCEL") return 2;
  return 0;
}

function calculateFounderSetupDiscountPercent(
  founderClient: boolean,
  mode: FounderSetupDiscountMode
): number {
  if (!founderClient || mode === "NONE") return 0;
  if (mode === "FREE") return 100;
  if (mode === "FIFTY_PERCENT") return 50;
  return 0;
}

function calculateSetup(input: PricingQuoteInput): {
  setupCalculationType: SetupCalculationType;
  setupBasePrice: number;
  setupComplexityScore: number;
  setupBreakdown: SetupBreakdownItem[];
  setupFeeBeforeDiscount: number;
  setupDiscountPercent: number;
  setupDiscountAmount: number;
  setupFee: number;
} {
  const setupBreakdown: SetupBreakdownItem[] = [];

  let setupBasePrice = 0;
  let setupFeeBeforeDiscount = 0;

  const includesHcm = input.selectedModules.includes("AURA_HCM");
  const includesMaintenance =
    input.selectedModules.includes("AURA_MAINTENANCE");

  if (includesHcm) {
    const hcmBreakdown: SetupBreakdownItem[] = [
      {
        product: "AURA_HCM",
        factor: "Empleados",
        score: calculateHcmEmployeeScore(input.employeeCount),
      },
      {
        product: "AURA_HCM",
        factor: "Sucursales",
        score: calculateHcmBranchScore(input.locationCount),
      },
      {
        product: "AURA_HCM",
        factor: "Migración de datos",
        score: calculateHcmMigrationScore(input.hcmMigrationType),
      },
      {
        product: "AURA_HCM",
        factor: "Implementación",
        score: calculateImplementationScore(input.hcmImplementationType),
      },
      {
        product: "AURA_HCM",
        factor: "Integraciones",
        score: calculateIntegrationScore(input.hcmIntegrationCount),
      },
    ];

    const hcmScore = hcmBreakdown.reduce((total, item) => total + item.score, 0);

    setupBreakdown.push(...hcmBreakdown);
    setupBasePrice += HCM_SETUP_BASE_PRICE;
    setupFeeBeforeDiscount += HCM_SETUP_BASE_PRICE + hcmScore * HCM_SETUP_POINT_PRICE;
  }

  if (includesMaintenance) {
    const maintenanceBreakdown: SetupBreakdownItem[] = [
      {
        product: "AURA_MAINTENANCE",
        factor: "Activos",
        score: calculateMaintenanceAssetScore(input.maintenanceAssetCount),
      },
      {
        product: "AURA_MAINTENANCE",
        factor: "Ubicaciones",
        score: calculateMaintenanceLocationScore(input.locationCount),
      },
      {
        product: "AURA_MAINTENANCE",
        factor: "Técnicos",
        score: calculateMaintenanceTechnicianScore(
          input.maintenanceTechnicianCount
        ),
      },
      {
        product: "AURA_MAINTENANCE",
        factor: "Carga inicial",
        score: calculateMaintenanceInitialLoadScore(
          input.maintenanceInitialLoadType
        ),
      },
      {
        product: "AURA_MAINTENANCE",
        factor: "QR masivos",
        score: input.maintenanceMassiveQr ? 3 : 0,
      },
    ];

    const maintenanceScore = maintenanceBreakdown.reduce(
      (total, item) => total + item.score,
      0
    );

    setupBreakdown.push(...maintenanceBreakdown);
    setupBasePrice += MAINTENANCE_SETUP_BASE_PRICE;
    setupFeeBeforeDiscount +=
      MAINTENANCE_SETUP_BASE_PRICE +
      maintenanceScore * MAINTENANCE_SETUP_POINT_PRICE;
  }

  const setupComplexityScore = setupBreakdown.reduce(
    (total, item) => total + item.score,
    0
  );

  const setupCalculationType: SetupCalculationType =
    includesHcm && includesMaintenance
      ? "COMBINED_ENTERPRISE"
      : includesHcm
        ? "HCM_ENTERPRISE"
        : includesMaintenance
          ? "MAINTENANCE_ENTERPRISE"
          : "NONE";

  const setupDiscountPercent = calculateFounderSetupDiscountPercent(
    input.founderClient,
    input.founderSetupDiscountMode
  );

  const setupDiscountAmount = Number(
    ((setupFeeBeforeDiscount * setupDiscountPercent) / 100).toFixed(2)
  );

  const setupFee = Number(
    Math.max(0, setupFeeBeforeDiscount - setupDiscountAmount).toFixed(2)
  );

  return {
    setupCalculationType,
    setupBasePrice,
    setupComplexityScore,
    setupBreakdown,
    setupFeeBeforeDiscount,
    setupDiscountPercent,
    setupDiscountAmount,
    setupFee,
  };
}

export async function calculatePricingQuote(
  input: PricingQuoteInput
): Promise<PricingQuoteResult> {
  const [plans, moduleRules, settings] = await Promise.all([
    getPricingPlans(),
    getModulePricingRules(),
    getPricingSettings(),
  ]);

  const plan = findPlanForEmployees(plans, input.employeeCount);

  const extraLocations = Math.max(0, input.locationCount - plan.includedLocations);
  const extraCompanies = Math.max(0, input.companyCount - plan.includedCompanies);

  const items: QuoteLineItem[] = [
    {
      label: `Aura HCM ${plan.name}`,
      quantity: 1,
      unitPrice: plan.baseMonthlyPrice,
      total: plan.baseMonthlyPrice,
    },
  ];

  if (extraLocations > 0) {
    items.push({
      label: "Ubicaciones adicionales",
      quantity: extraLocations,
      unitPrice: plan.extraLocationPrice,
      total: extraLocations * plan.extraLocationPrice,
    });
  }

  if (extraCompanies > 0) {
    items.push({
      label: "Empresas legales adicionales",
      quantity: extraCompanies,
      unitPrice: plan.extraCompanyPrice,
      total: extraCompanies * plan.extraCompanyPrice,
    });
  }

  input.selectedModules.forEach((moduleCode) => {
    const alreadyIncluded = plan.includedModules.includes(moduleCode);
    const moduleRule = moduleRules.find((rule) => rule.moduleCode === moduleCode);

    if (
      !moduleRule ||
      !moduleRule.active ||
      alreadyIncluded ||
      moduleRule.includedInBase
    ) {
      return;
    }

    items.push({
      label: moduleRule.label,
      quantity: 1,
      unitPrice: moduleRule.monthlyPrice,
      total: moduleRule.monthlyPrice,
    });
  });

  const monthlySubtotal = items.reduce((total, item) => total + item.total, 0);
  const annualSubtotalBeforeDiscount = monthlySubtotal * 12;

  const discountPercent =
    input.billingCycle === "YEARLY"
      ? input.applySpecialDiscount
        ? clampDiscount(
          input.specialDiscountPercent,
          settings.maxAllowedDiscountPercent
        )
        : clampDiscount(
          settings.annualDiscountPercent,
          settings.maxAllowedDiscountPercent
        )
      : 0;

  const discountBase =
    input.billingCycle === "YEARLY"
      ? annualSubtotalBeforeDiscount
      : monthlySubtotal;

  const discountAmount = Number(
    ((discountBase * discountPercent) / 100).toFixed(2)
  );

  const subtotal =
    input.billingCycle === "YEARLY"
      ? Number((annualSubtotalBeforeDiscount - discountAmount).toFixed(2))
      : monthlySubtotal;

  const ivaAmount = Number((subtotal * 0.16).toFixed(2));
  const total = Number((subtotal + ivaAmount).toFixed(2));

  const setup = calculateSetup(input);

  const firstPaymentSubtotal = Number((subtotal + setup.setupFee).toFixed(2));
  const firstPaymentIvaAmount = Number((firstPaymentSubtotal * 0.16).toFixed(2));
  const firstPaymentTotal = Number(
    (firstPaymentSubtotal + firstPaymentIvaAmount).toFixed(2)
  );

  const annualProjectedRevenue = Number(
    (monthlySubtotal * 12 + setup.setupFee).toFixed(2)
  );

  return {
    planCode: plan.planCode as PricingPlanCode,
    planName: plan.name,
    employeeCount: input.employeeCount,
    locationCount: input.locationCount,
    companyCount: input.companyCount,
    employeesLimit: input.employeeCount,
    locationsLimit: input.locationCount,
    companiesLimit: input.companyCount,
    selectedModules: input.selectedModules,
    includedLocations: plan.includedLocations,
    includedCompanies: plan.includedCompanies,
    extraLocations,
    extraCompanies,
    items,
    monthlySubtotal,
    annualSubtotalBeforeDiscount,
    discountPercent,
    discountAmount,
    subtotal,
    ivaAmount,
    total,
    monthlyTotal: monthlySubtotal,
    billingCycle: input.billingCycle,
    industry: input.industry,
    ...setup,
    firstPaymentSubtotal,
    firstPaymentIvaAmount,
    firstPaymentTotal,
    annualProjectedRevenue,
  };
}

export const PRICING_MODULE_OPTIONS: {
  value: AuraModuleCode;
  label: string;
}[] = DEFAULT_MODULE_RULES.map((rule) => ({
  value: rule.moduleCode,
  label: rule.label,
}));