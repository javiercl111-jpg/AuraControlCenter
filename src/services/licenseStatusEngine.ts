import type { ClientStatus, PlatformClient } from "../types/platformClient";

function todayInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

export function calculateClientLicenseStatus(
  client: PlatformClient,
  today: string = todayInputValue()
): ClientStatus {
  if (client.status === "CANCELLED") {
    return "CANCELLED";
  }

  if (!client.renewalDate || !client.graceUntil) {
    return client.status || "ACTIVE";
  }

  if (client.renewalDate >= today) {
    return "ACTIVE";
  }

  if (client.graceUntil >= today) {
    return "GRACE_PERIOD";
  }

  return "SUSPENDED";
}

export function getLicenseStatusLabel(status: ClientStatus): string {
  switch (status) {
    case "ACTIVE":
      return "Activa";
    case "GRACE_PERIOD":
      return "Periodo de gracia";
    case "SUSPENDED":
      return "Suspendida";
    case "CANCELLED":
      return "Cancelada";
    default:
      return status;
  }
}