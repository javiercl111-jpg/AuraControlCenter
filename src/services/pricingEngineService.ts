import {
    collection,
    getDocs,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    doc,
  } from "firebase/firestore";
  
  import { db } from "../config/firebase";
  import type { AuraModuleCode } from "../types/platformClient";
  import type {
    ModulePricingRule,
    PricingPlan,
    PricingPlanCode,
  } from "../types/pricingPlan";
  import type {
    PricingQuoteInput,
    PricingQuoteResult,
    QuoteLineItem,
  } from "../types/quote";
  
  const PRICING_RULES_COLLECTION = "platform_pricing_rules";
  const MODULE_RULES_COLLECTION = "platform_module_pricing_rules";
  
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
  
  export async function seedDefaultPricingRules(): Promise<void> {
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
  }
  
  export async function getPricingPlans(): Promise<PricingPlan[]> {
    const q = query(
      collection(db, PRICING_RULES_COLLECTION),
      orderBy("sortOrder", "asc")
    );
  
    const snapshot = await getDocs(q);
  
    if (snapshot.empty) {
      await seedDefaultPricingRules();
      return DEFAULT_PLANS.map((plan) => ({
        id: plan.planCode,
        ...plan,
      }));
    }
  
    return snapshot.docs.map((pricingDoc) => ({
      id: pricingDoc.id,
      ...(pricingDoc.data() as Omit<PricingPlan, "id">),
    }));
  }
  
  export async function getModulePricingRules(): Promise<ModulePricingRule[]> {
    const snapshot = await getDocs(collection(db, MODULE_RULES_COLLECTION));
  
    if (snapshot.empty) {
      await seedDefaultPricingRules();
      return DEFAULT_MODULE_RULES;
    }
  
    return snapshot.docs.map((moduleDoc) => moduleDoc.data() as ModulePricingRule);
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
  
  export async function calculatePricingQuote(
    input: PricingQuoteInput
  ): Promise<PricingQuoteResult> {
    const [plans, moduleRules] = await Promise.all([
      getPricingPlans(),
      getModulePricingRules(),
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
  
      if (!moduleRule || !moduleRule.active || alreadyIncluded || moduleRule.includedInBase) {
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
    const subtotal =
      input.billingCycle === "YEARLY" ? monthlySubtotal * 12 : monthlySubtotal;
  
    const ivaAmount = Number((subtotal * 0.16).toFixed(2));
    const total = Number((subtotal + ivaAmount).toFixed(2));
  
    return {
      planCode: plan.planCode as PricingPlanCode,
      planName: plan.name,
      employeeCount: input.employeeCount,
      locationCount: input.locationCount,
      companyCount: input.companyCount,
      selectedModules: input.selectedModules,
      includedLocations: plan.includedLocations,
      includedCompanies: plan.includedCompanies,
      extraLocations,
      extraCompanies,
      items,
      subtotal,
      ivaAmount,
      total,
      monthlyTotal: monthlySubtotal,
      billingCycle: input.billingCycle,
    };
  }
  
  export const PRICING_MODULE_OPTIONS: {
    value: AuraModuleCode;
    label: string;
  }[] = DEFAULT_MODULE_RULES.map((rule) => ({
    value: rule.moduleCode,
    label: rule.label,
  }));