import { createClient } from "./platformClientService";
import { markLeadAsConverted } from "./platformLeadService";
import { createTenantFromClient } from "./platformTenantService";

import type {
  AuraModuleCode,
  ClientFiscalData,
} from "../types/platformClient";
import type { PlatformLead } from "../types/platformLead";

function normalizeModules(modules: string[]): AuraModuleCode[] {
  const allowedModules: AuraModuleCode[] = [
    "AURA_HCM",
    "AURA_MAINTENANCE",
    "AURA_SIGNATURE",
    "AURA_INTELLIGENCE",
  ];

  const normalized = modules.filter((moduleCode): moduleCode is AuraModuleCode =>
    allowedModules.includes(moduleCode as AuraModuleCode)
  );

  return normalized.length ? normalized : ["AURA_HCM"];
}

function buildPendingFiscalData(lead: PlatformLead): ClientFiscalData {
  return {
    legalName: lead.companyName,
    rfc: "PENDIENTE",
    taxRegime: "PENDIENTE",
    cfdiUse: "G03",
    paymentMethod: "PPD",
    paymentForm: "99",
    fiscalZipCode: "00000",
    billingEmail: lead.email || "",
    billingContactName: lead.contactName || "",
    billingPhone: lead.phone || "",
    billingNotes:
      "Cliente convertido desde CRM. Datos fiscales pendientes de validar.",
  };
}

export async function convertLeadToClientAndTenant(lead: PlatformLead): Promise<{
  clientId: string;
  tenantId: string;
}> {
  if (lead.convertedClientId) {
    throw new Error("Este prospecto ya fue convertido a cliente.");
  }

  const enabledModules = normalizeModules(lead.interestedModules || []);

  const clientId = await createClient({
    companyName: lead.companyName,
    tradeName: lead.companyName,
    planCode: "HCM_PROFESSIONAL",
    billingCycle: "MONTHLY",
    status: "ACTIVE",
    enabledModules,
    fiscalData: buildPendingFiscalData(lead),
  });

  const tenantId = await createTenantFromClient({
    clientId,
    companyName: lead.companyName,
    tradeName: lead.companyName,
    status: "ACTIVE",
    licenseStatus: "ACTIVE",
    enabledModules,
  });

  await markLeadAsConverted({
    leadId: lead.id,
    clientId,
    tenantId,
  });

  return {
    clientId,
    tenantId,
  };
}