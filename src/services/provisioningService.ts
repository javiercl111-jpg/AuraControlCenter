import {
  collection,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";

import { db } from "../config/firebase";
import type { AuraModuleCode } from "../types/platformClient";
import type {
  ProvisioningResult,
  ProvisioningStep,
} from "../types/provisioning";
import type { PlatformQuote } from "../types/quote";

/**
 * Sanitizes a company name into a URL-friendly slug.
 */
function generateSlug(name: string): string {
  if (!name) return "tenant";
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents/diacritics
    .replace(/[^a-z0-9\s-]/g, "") // Remove non-alphanumeric chars except space/hyphen
    .trim()
    .replace(/\s+/g, "-") // Convert spaces to hyphens
    .replace(/-+/g, "-"); // Collapse multiple hyphens
}

/**
 * Maps product code to a readable product name.
 */
function getProductName(code: AuraModuleCode): string {
  switch (code) {
    case "AURA_HCM":
      return "Aura HCM";
    case "AURA_MAINTENANCE":
      return "Aura Maintenance OS";
    case "AURA_SIGNATURE":
      return "Aura Signature";
    case "AURA_INTELLIGENCE":
      return "Aura Intelligence";
    default:
      return code;
  }
}

/**
 * Attempts to parse the unit price for a module from the quote's items list.
 */
function getModuleMonthlyPrice(quote: PlatformQuote, moduleCode: AuraModuleCode): number {
  if (!quote.items || quote.items.length === 0) return 0;

  let keyword = "";
  switch (moduleCode) {
    case "AURA_HCM":
      keyword = "hcm";
      break;
    case "AURA_MAINTENANCE":
      keyword = "maintenance";
      break;
    case "AURA_SIGNATURE":
      keyword = "signature";
      break;
    case "AURA_INTELLIGENCE":
      keyword = "intelligence";
      break;
  }

  const matchedItem = quote.items.find((item) =>
    item.label.toLowerCase().includes(keyword)
  );

  return matchedItem ? matchedItem.unitPrice : 0;
}

/**
 * Main provisioning engine function.
 * Orchestrates the creation of Client, Tenant, Subscription, Licenses, and Provisioning Job.
 * This is fully idempotent: if documents already exist for this quoteId, it reuses them.
 */
export async function provisionAcceptedQuote(quote: PlatformQuote): Promise<ProvisioningResult> {
  const steps: ProvisioningStep[] = [
    {
      key: "VALIDATE_QUOTE",
      label: "Validar propuesta comercial",
      status: "PENDING",
      createdAt: new Date().toISOString(),
      completedAt: null,
      errorMessage: null,
    },
    {
      key: "CREATE_CLIENT",
      label: "Crear cliente en Control Center",
      status: "PENDING",
      createdAt: new Date().toISOString(),
      completedAt: null,
      errorMessage: null,
    },
    {
      key: "CREATE_TENANT",
      label: "Crear inquilino (Tenant)",
      status: "PENDING",
      createdAt: new Date().toISOString(),
      completedAt: null,
      errorMessage: null,
    },
    {
      key: "CREATE_SUBSCRIPTION",
      label: "Crear suscripción de servicio",
      status: "PENDING",
      createdAt: new Date().toISOString(),
      completedAt: null,
      errorMessage: null,
    },
    {
      key: "CREATE_LICENSES",
      label: "Generar licencias de productos",
      status: "PENDING",
      createdAt: new Date().toISOString(),
      completedAt: null,
      errorMessage: null,
    },
    {
      key: "READY_FOR_MANUAL_SETUP",
      label: "Listo para configuración manual",
      status: "PENDING",
      createdAt: new Date().toISOString(),
      completedAt: null,
      errorMessage: null,
    },
  ];

  const updateStepStatus = (
    key: string,
    status: "IN_PROGRESS" | "COMPLETED" | "FAILED",
    errorMsg?: string
  ) => {
    const step = steps.find((s) => s.key === key);
    if (step) {
      step.status = status;
      if (status === "COMPLETED" || status === "FAILED") {
        step.completedAt = new Date().toISOString();
      }
      if (errorMsg) {
        step.errorMessage = errorMsg;
      }
    }
  };

  // Step 1: VALIDATE_QUOTE
  updateStepStatus("VALIDATE_QUOTE", "IN_PROGRESS");
  if (!quote.id) {
    const err = "El ID de la cotización es obligatorio.";
    updateStepStatus("VALIDATE_QUOTE", "FAILED", err);
    throw new Error(err);
  }

  if (quote.status !== "ACCEPTED") {
    const err = `La cotización debe estar en estado ACCEPTED. Estado actual: ${quote.status}`;
    updateStepStatus("VALIDATE_QUOTE", "FAILED", err);
    throw new Error(err);
  }

  if (!quote.prospectName) {
    const err = "El nombre del prospecto / empresa es obligatorio.";
    updateStepStatus("VALIDATE_QUOTE", "FAILED", err);
    throw new Error(err);
  }

  if (!quote.selectedModules || quote.selectedModules.length === 0) {
    const err = "La cotización debe tener al menos un módulo seleccionado.";
    updateStepStatus("VALIDATE_QUOTE", "FAILED", err);
    throw new Error(err);
  }

  if (quote.total === undefined || quote.total === null) {
    const err = "El total comercial de la cotización es obligatorio.";
    updateStepStatus("VALIDATE_QUOTE", "FAILED", err);
    throw new Error(err);
  }

  if (quote.setupFee === undefined || quote.setupFee === null) {
    const err = "La tarifa de setup de la cotización es obligatoria.";
    updateStepStatus("VALIDATE_QUOTE", "FAILED", err);
    throw new Error(err);
  }

  if (quote.firstPaymentTotal === undefined || quote.firstPaymentTotal === null) {
    const err = "El total del primer pago de la cotización es obligatorio.";
    updateStepStatus("VALIDATE_QUOTE", "FAILED", err);
    throw new Error(err);
  }

  if (!quote.pricingMode) {
    const err = "El modo de precios (pricingMode) de la cotización es obligatorio.";
    updateStepStatus("VALIDATE_QUOTE", "FAILED", err);
    throw new Error(err);
  }
  updateStepStatus("VALIDATE_QUOTE", "COMPLETED");

  // IDEMPOTENCY / DATABASE LOOKUPS
  // Check if documents already exist for this quoteId to prevent duplication.
  let clientId = "";
  let tenantId = "";
  let subscriptionId = "";
  let licenseIds: string[] = [];
  let provisioningJobId = "";

  // Query platform_clients
  const clientsSnap = await getDocs(
    query(collection(db, "platform_clients"), where("quoteId", "==", quote.id), limit(1))
  );
  if (!clientsSnap.empty) {
    clientId = clientsSnap.docs[0].id;
  }

  // Query platform_tenants
  const tenantsSnap = await getDocs(
    query(collection(db, "platform_tenants"), where("quoteId", "==", quote.id), limit(1))
  );
  if (!tenantsSnap.empty) {
    tenantId = tenantsSnap.docs[0].id;
  }

  // Query platform_subscriptions
  const subsSnap = await getDocs(
    query(collection(db, "platform_subscriptions"), where("quoteId", "==", quote.id), limit(1))
  );
  if (!subsSnap.empty) {
    subscriptionId = subsSnap.docs[0].id;
  }

  // Query platform_licenses
  const licensesSnap = await getDocs(
    query(collection(db, "platform_licenses"), where("quoteId", "==", quote.id))
  );
  licenseIds = licensesSnap.docs.map((doc) => doc.id);

  // Query platform_provisioning_jobs
  const jobsSnap = await getDocs(
    query(collection(db, "platform_provisioning_jobs"), where("quoteId", "==", quote.id), limit(1))
  );
  if (!jobsSnap.empty) {
    provisioningJobId = jobsSnap.docs[0].id;
  }

  // If everything already exists, return the existing result (fully idempotent)
  if (clientId && tenantId && subscriptionId && licenseIds.length >= quote.selectedModules.length && provisioningJobId) {
    return {
      clientId,
      tenantId,
      subscriptionId,
      licenseIds,
      provisioningJobId,
    };
  }

  const batch = writeBatch(db);

  // Step 2: CREATE_CLIENT
  updateStepStatus("CREATE_CLIENT", "IN_PROGRESS");
  let clientRef;
  if (!clientId) {
    clientRef = doc(collection(db, "platform_clients"));
    clientId = clientRef.id;

    batch.set(clientRef, {
      quoteId: quote.id,
      companyName: quote.prospectName,
      tradeName: quote.prospectName,
      contactName: quote.contactName,
      contactEmail: quote.contactEmail,
      contactPhone: "",
      status: "ACTIVE",
      source: "QUOTE_ACCEPTED",
      pricingMode: quote.pricingMode,
      founderPricing: quote.founderPricing || false,
      billingCycle: quote.billingCycle,
      selectedModules: quote.selectedModules,
      salesChannel: quote.salesChannel || "DIRECT",
      advisorId: quote.salesChannel === "DIRECT" ? null : (quote.advisorId || null),
      advisorName: quote.salesChannel === "DIRECT" ? null : (quote.advisorName || null),
      advisorEmail: quote.salesChannel === "DIRECT" ? null : (quote.advisorEmail || null),
      ownerAdvisorId: quote.salesChannel === "DIRECT" ? null : (quote.ownerAdvisorId || quote.advisorId || null),
      ownerAdvisorName: quote.salesChannel === "DIRECT" ? null : (quote.ownerAdvisorName || quote.advisorName || null),
      ownerAdvisorEmail: quote.salesChannel === "DIRECT" ? null : (quote.ownerAdvisorEmail || quote.advisorEmail || null),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    updateStepStatus("CREATE_CLIENT", "COMPLETED");
  } else {
    updateStepStatus("CREATE_CLIENT", "COMPLETED", "Reusado cliente existente");
  }

  // Step 3: CREATE_TENANT
  updateStepStatus("CREATE_TENANT", "IN_PROGRESS");
  let tenantRef;
  if (!tenantId) {
    tenantRef = doc(collection(db, "platform_tenants"));
    tenantId = tenantRef.id;

    // Slug generation and duplication prevention
    let baseSlug = generateSlug(quote.prospectName);
    let tenantSlug = baseSlug;
    let isSlugUnique = false;
    let attempt = 0;

    while (!isSlugUnique && attempt < 10) {
      const slugQuery = query(
        collection(db, "platform_tenants"),
        where("tenantSlug", "==", tenantSlug),
        limit(1)
      );
      const slugSnap = await getDocs(slugQuery);

      if (slugSnap.empty) {
        isSlugUnique = true;
      } else {
        attempt++;
        const suffix = Math.random().toString(36).substring(2, 6);
        tenantSlug = `${baseSlug}-${suffix}`;
      }
    }

    batch.set(tenantRef, {
      quoteId: quote.id,
      clientId,
      tenantName: quote.prospectName,
      tenantSlug,
      tenantStatus: "READY",
      hcmTenantStatus: "PENDING_EXTERNAL_SETUP",
      maintenanceTenantStatus: "PENDING_EXTERNAL_SETUP",
      selectedModules: quote.selectedModules,
      allowedDomains: [],
      subdomain: null,
      customDomain: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    updateStepStatus("CREATE_TENANT", "COMPLETED");
  } else {
    updateStepStatus("CREATE_TENANT", "COMPLETED", "Reusado tenant existente");
  }

  // Update client with tenantId if created now
  if (clientRef) {
    batch.update(clientRef, { tenantId });
  }

  // Step 4: CREATE_SUBSCRIPTION
  updateStepStatus("CREATE_SUBSCRIPTION", "IN_PROGRESS");
  let subscriptionRef;
  if (!subscriptionId) {
    subscriptionRef = doc(collection(db, "platform_subscriptions"));
    subscriptionId = subscriptionRef.id;

    const monthlyAmount = quote.monthlyTotal || (quote.billingCycle === "MONTHLY" ? quote.total : Number((quote.total / 12).toFixed(2)));
    const annualAmount = quote.billingCycle === "YEARLY" ? quote.total : Number((quote.total * 12).toFixed(2));

    batch.set(subscriptionRef, {
      quoteId: quote.id,
      clientId,
      tenantId,
      status: "PENDING_ACTIVATION",
      billingCycle: quote.billingCycle,
      pricingMode: quote.pricingMode,
      founderPricing: quote.founderPricing || false,
      monthlyAmount,
      annualAmount,
      setupFee: quote.setupFee,
      firstPaymentTotal: quote.firstPaymentTotal,
      ivaAmount: quote.ivaAmount,
      selectedModules: quote.selectedModules,
      startsAt: null,
      activatedAt: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    updateStepStatus("CREATE_SUBSCRIPTION", "COMPLETED");
  } else {
    updateStepStatus("CREATE_SUBSCRIPTION", "COMPLETED", "Reusado suscripción existente");
  }

  // Step 5: CREATE_LICENSES
  updateStepStatus("CREATE_LICENSES", "IN_PROGRESS");
  const finalLicenseIds = [...licenseIds];

  for (const moduleCode of quote.selectedModules) {
    // If a license document for this module and quote already exists, skip it
    const exists = licensesSnap.docs.some((d) => d.data().productCode === moduleCode);
    if (exists) continue;

    const licenseRef = doc(collection(db, "platform_licenses"));
    const monthlyAmt = getModuleMonthlyPrice(quote, moduleCode);

    batch.set(licenseRef, {
      quoteId: quote.id,
      clientId,
      tenantId,
      subscriptionId,
      productCode: moduleCode,
      productName: getProductName(moduleCode),
      status: "PENDING_ACTIVATION",
      employeesLimit: quote.employeesLimit,
      locationsLimit: quote.locationsLimit,
      companiesLimit: quote.companiesLimit,
      billingCycle: quote.billingCycle,
      monthlyAmount: monthlyAmt,
      annualAmount: monthlyAmt * 12,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    finalLicenseIds.push(licenseRef.id);
  }
  updateStepStatus("CREATE_LICENSES", "COMPLETED");

  // Step 6: READY_FOR_MANUAL_SETUP
  updateStepStatus("READY_FOR_MANUAL_SETUP", "IN_PROGRESS");
  updateStepStatus(
    "READY_FOR_MANUAL_SETUP",
    "COMPLETED",
    "Aprovisionamiento administrativo completado. La activación y setup de HCM / Maintenance OS externos debe realizarse de forma manual."
  );

  // Write Provisioning Job
  let jobRef;
  if (!provisioningJobId) {
    jobRef = doc(collection(db, "platform_provisioning_jobs"));
    provisioningJobId = jobRef.id;

    batch.set(jobRef, {
      quoteId: quote.id,
      clientId,
      tenantId,
      subscriptionId,
      licenseIds: finalLicenseIds,
      status: "COMPLETED",
      steps,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: "system",
      errorMessage: null,
    });
  } else {
    jobRef = doc(db, "platform_provisioning_jobs", provisioningJobId);
    batch.update(jobRef, {
      clientId,
      tenantId,
      subscriptionId,
      licenseIds: finalLicenseIds,
      status: "COMPLETED",
      steps,
      updatedAt: serverTimestamp(),
    });
  }

  // Execute transaction batch
  await batch.commit();

  return {
    clientId,
    tenantId,
    subscriptionId,
    licenseIds: finalLicenseIds,
    provisioningJobId,
  };
}

export default provisionAcceptedQuote;
