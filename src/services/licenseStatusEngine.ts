import type { ClientStatus, PlatformClient } from "../types/platformClient";

function todayInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

function addMonths(dateValue: string, months: number): string {
  const date = new Date(`${dateValue}T00:00:00`);
  date.setMonth(date.getMonth() + months);
  return date.toISOString().slice(0, 10);
}

function addDays(dateValue: string, days: number): string {
  const date = new Date(`${dateValue}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function buildMissingLicenseDates(
  client: PlatformClient,
  today: string = todayInputValue()
): {
  startDate: string;
  renewalDate: string;
  graceUntil: string;
} {
  const startDate = client.startDate || today;

  const renewalDate =
    client.renewalDate ||
    addMonths(startDate, client.billingCycle === "YEARLY" ? 12 : 1);

  const graceUntil = client.graceUntil || addDays(renewalDate, 15);

  return {
    startDate,
    renewalDate,
    graceUntil,
  };
}

export function calculateClientLicenseStatus(
  client: PlatformClient,
  today: string = todayInputValue()
): ClientStatus {
  if (client.status === "CANCELLED") {
    return "CANCELLED";
  }

  const dates = buildMissingLicenseDates(client, today);

  if (dates.renewalDate >= today) {
    return "ACTIVE";
  }

  if (dates.graceUntil >= today) {
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