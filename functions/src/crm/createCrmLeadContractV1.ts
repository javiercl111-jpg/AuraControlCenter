export const CREATE_CRM_LEAD_REQUEST_SCHEMA_V1 =
  "CreateCrmLeadRequestV1" as const;
export const CREATE_CRM_LEAD_RESULT_SCHEMA_V1 =
  "CreateCrmLeadResultV1" as const;
export const CRM_LEAD_CREATE_CAPABILITY_V1 = "crm.leads.create" as const;
export const PREVIEW_CRM_ENVIRONMENT_V1 = "PREVIEW" as const;

const REQUEST_KEYS = Object.freeze(["idempotencyKey", "lead", "schemaVersion"]);
const LEAD_KEYS = Object.freeze([
  "companyName",
  "contactName",
  "email",
  "estimatedValue",
  "interestedModules",
  "leadSourceCode",
  "leadSourceDetail",
  "leadSourceLabel",
  "nextFollowUpDate",
  "notes",
  "phone",
  "source",
]);
const LEAD_SOURCES = new Set([
  "INBOUND",
  "OUTBOUND",
  "REFERRAL",
  "EVENT",
  "PARTNER",
  "OTHER",
]);
const MODULES = new Set([
  "AURA_HCM",
  "AURA_MAINTENANCE",
  "AURA_SIGNATURE",
  "AURA_INTELLIGENCE",
]);

export type CrmLeadCreateErrorCodeV1 =
  | "UNAUTHENTICATED"
  | "APP_CHECK_REJECTED"
  | "PERMISSION_DENIED"
  | "INVALID_ARGUMENT"
  | "IDEMPOTENCY_CONFLICT"
  | "INTERNAL_SAFE_FAILURE";

export class CrmLeadCreateErrorV1 extends Error {
  constructor(readonly code: CrmLeadCreateErrorCodeV1) {
    super(code);
    this.name = "CrmLeadCreateErrorV1";
  }
}

export interface CreateCrmLeadInputV1 {
  readonly companyName: string;
  readonly contactName: string;
  readonly email: string;
  readonly phone: string;
  readonly source?: string;
  readonly leadSourceCode?: string;
  readonly leadSourceLabel?: string;
  readonly leadSourceDetail?: string;
  readonly interestedModules: readonly string[];
  readonly estimatedValue?: number;
  readonly notes: string;
  readonly nextFollowUpDate?: string;
}

export interface CreateCrmLeadRequestV1 {
  readonly schemaVersion: typeof CREATE_CRM_LEAD_REQUEST_SCHEMA_V1;
  readonly idempotencyKey: string;
  readonly lead: CreateCrmLeadInputV1;
}

function fail(): never {
  throw new CrmLeadCreateErrorV1("INVALID_ARGUMENT");
}

function record(value: unknown): Readonly<Record<string, unknown>> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) fail();
  return value as Readonly<Record<string, unknown>>;
}

function exactKeys(
  value: Readonly<Record<string, unknown>>,
  allowed: readonly string[],
): void {
  if (Object.keys(value).some((key) => !allowed.includes(key))) fail();
}

function text(
  value: unknown,
  maximum: number,
  options: Readonly<{ required?: boolean }> = {},
): string {
  if (typeof value !== "string") fail();
  const normalized = value.trim();
  if ((options.required && normalized.length === 0) || normalized.length > maximum) {
    fail();
  }
  return normalized;
}

function optionalText(value: unknown, maximum: number): string | undefined {
  if (value === undefined) return undefined;
  return text(value, maximum);
}

function source(value: unknown): string | undefined {
  const normalized = optionalText(value, 32);
  if (normalized !== undefined && !LEAD_SOURCES.has(normalized)) fail();
  return normalized;
}

function email(value: unknown): string {
  const normalized = text(value, 320).toLowerCase();
  if (normalized && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(normalized)) fail();
  return normalized;
}

function modules(value: unknown): readonly string[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > MODULES.size) fail();
  const normalized = value.map((item) => text(item, 64, { required: true }));
  if (new Set(normalized).size !== normalized.length) fail();
  if (normalized.some((item) => !MODULES.has(item))) fail();
  return Object.freeze(normalized);
}

function estimatedValue(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 1_000_000_000_000
  ) fail();
  return value;
}

function followUpDate(value: unknown): string | undefined {
  const normalized = optionalText(value, 10);
  if (normalized && !/^\d{4}-\d{2}-\d{2}$/u.test(normalized)) fail();
  return normalized;
}

export function parseCreateCrmLeadRequestV1(
  value: unknown,
): CreateCrmLeadRequestV1 {
  const request = record(value);
  exactKeys(request, REQUEST_KEYS);
  if (request.schemaVersion !== CREATE_CRM_LEAD_REQUEST_SCHEMA_V1) fail();
  const idempotencyKey = text(request.idempotencyKey, 100, { required: true });
  if (!/^[A-Za-z0-9._:-]{16,100}$/u.test(idempotencyKey)) fail();

  const input = record(request.lead);
  exactKeys(input, LEAD_KEYS);
  const parsed: CreateCrmLeadInputV1 = Object.freeze({
    companyName: text(input.companyName, 160, { required: true }),
    contactName: text(input.contactName, 160, { required: true }),
    email: email(input.email),
    phone: text(input.phone, 40),
    ...(source(input.source) !== undefined ? { source: source(input.source) } : {}),
    ...(source(input.leadSourceCode) !== undefined
      ? { leadSourceCode: source(input.leadSourceCode) }
      : {}),
    ...(optionalText(input.leadSourceLabel, 80) !== undefined
      ? { leadSourceLabel: optionalText(input.leadSourceLabel, 80) }
      : {}),
    ...(optionalText(input.leadSourceDetail, 500) !== undefined
      ? { leadSourceDetail: optionalText(input.leadSourceDetail, 500) }
      : {}),
    interestedModules: modules(input.interestedModules),
    ...(estimatedValue(input.estimatedValue) !== undefined
      ? { estimatedValue: estimatedValue(input.estimatedValue) }
      : {}),
    notes: text(input.notes, 5_000),
    ...(followUpDate(input.nextFollowUpDate) !== undefined
      ? { nextFollowUpDate: followUpDate(input.nextFollowUpDate) }
      : {}),
  });

  return Object.freeze({
    schemaVersion: CREATE_CRM_LEAD_REQUEST_SCHEMA_V1,
    idempotencyKey,
    lead: parsed,
  });
}
