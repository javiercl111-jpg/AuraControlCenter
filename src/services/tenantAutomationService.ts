import {
    buildMissingLicenseDates,
    calculateClientLicenseStatus,
  } from "./licenseStatusEngine";
  import { updateClientLicenseEvaluation } from "./platformClientUpdateService";
  import { syncTenantFromClientStatus } from "./platformTenantService";
  import type { ClientStatus, PlatformClient } from "../types/platformClient";
  
  export async function evaluateClientAndSyncTenant(
    client: PlatformClient
  ): Promise<{
    clientId: string;
    previousStatus: ClientStatus;
    calculatedStatus: ClientStatus;
    updated: boolean;
  }> {
    const calculatedStatus = calculateClientLicenseStatus(client);
    const dates = buildMissingLicenseDates(client);
  
    const needsStatusUpdate = calculatedStatus !== client.status;
    const needsDateRepair =
      !client.startDate || !client.renewalDate || !client.graceUntil;
  
    if (needsStatusUpdate || needsDateRepair) {
      await updateClientLicenseEvaluation(client.id, {
        status: calculatedStatus,
        startDate: dates.startDate,
        renewalDate: dates.renewalDate,
        graceUntil: dates.graceUntil,
      });
    }
  
    await syncTenantFromClientStatus({
      tenantDocumentId: client.tenantId,
      clientStatus: calculatedStatus,
    });
  
    return {
      clientId: client.id,
      previousStatus: client.status,
      calculatedStatus,
      updated: needsStatusUpdate || needsDateRepair,
    };
  }