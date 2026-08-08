import {
  CREATE_CRM_LEAD_RESULT_SCHEMA_V1,
  CRM_LEAD_CREATE_CAPABILITY_V1,
  CrmLeadCreateErrorV1,
  parseCreateCrmLeadRequestV1,
  type CreateCrmLeadInputV1,
} from "./createCrmLeadContractV1";

export interface CrmLeadCreateAuthorityV1 {
  readonly role: string;
  readonly isActive: boolean;
  readonly capabilities: readonly string[];
}

export interface CrmLeadCreateAuthorityPortV1 {
  resolve(uid: string): Promise<CrmLeadCreateAuthorityV1 | null>;
}

export interface CrmLeadCreatePersistenceCommandV1 {
  readonly actorUid: string;
  readonly idempotencyKey: string;
  readonly lead: CreateCrmLeadInputV1;
}

export interface CrmLeadCreatePersistencePortV1 {
  create(
    command: CrmLeadCreatePersistenceCommandV1,
  ): Promise<"CREATED" | "REUSED">;
}

export interface CrmLeadCreateInvocationV1 {
  readonly auth?: Readonly<{ uid?: string }> | null;
  readonly app?: Readonly<{ appId?: string }> | null;
}

export interface CreateCrmLeadResultV1 {
  readonly schemaVersion: typeof CREATE_CRM_LEAD_RESULT_SCHEMA_V1;
  readonly action: "CREATED" | "REUSED";
}

export class CreateCrmLeadServiceV1 {
  constructor(
    private readonly authority: CrmLeadCreateAuthorityPortV1,
    private readonly persistence: CrmLeadCreatePersistencePortV1,
  ) {}

  async execute(
    value: unknown,
    invocation: CrmLeadCreateInvocationV1,
  ): Promise<CreateCrmLeadResultV1> {
    const uid = invocation.auth?.uid?.trim();
    if (!uid) throw new CrmLeadCreateErrorV1("UNAUTHENTICATED");
    if (!invocation.app?.appId?.trim()) {
      throw new CrmLeadCreateErrorV1("APP_CHECK_REJECTED");
    }

    const request = parseCreateCrmLeadRequestV1(value);
    const authority = await this.authority.resolve(uid);
    if (
      authority === null ||
      authority.isActive !== true ||
      !authority.capabilities.includes(CRM_LEAD_CREATE_CAPABILITY_V1)
    ) {
      throw new CrmLeadCreateErrorV1("PERMISSION_DENIED");
    }

    const action = await this.persistence.create({
      actorUid: uid,
      idempotencyKey: request.idempotencyKey,
      lead: request.lead,
    });
    return Object.freeze({
      schemaVersion: CREATE_CRM_LEAD_RESULT_SCHEMA_V1,
      action,
    });
  }
}
