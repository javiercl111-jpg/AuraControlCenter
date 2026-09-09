export const GROWTH_LINKEDIN_ORGANIZATION_ACCESS_ENDPOINT_V1 =
  'https://api.linkedin.com/rest/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED' as const;

export const GROWTH_LINKEDIN_RESTLI_PROTOCOL_VERSION_V1 =
  '2.0.0' as const;

export const GROWTH_LINKEDIN_API_VERSION_V1 =
  '202607' as const;

export interface GrowthLinkedInOrganizationAccessRecordV1 {
  readonly organization: string;
  readonly role: string;
  readonly state: string;
}

export interface GrowthLinkedInOrganizationAccessResultV1 {
  readonly status:
    | 'LINKEDIN_ORGANIZATION_ACCESS_OK'
    | 'LINKEDIN_ORGANIZATION_ACCESS_EMPTY';
  readonly httpStatus: number;
  readonly organizationCount: number;
  readonly organizations:
    readonly GrowthLinkedInOrganizationAccessRecordV1[];
}

export class GrowthLinkedInOrganizationAccessReaderErrorV1
extends Error {
  constructor(
    readonly code: string,
    readonly httpStatus?: number,
  ) {
    super(code);

    this.name =
      'GrowthLinkedInOrganizationAccessReaderErrorV1';
  }
}

const isRecordV1 =
  (
    value: unknown,
  ): value is Record<string, unknown> =>
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value);

export async function readGrowthLinkedInOrganizationAccessV1(
  accessToken: string,
): Promise<GrowthLinkedInOrganizationAccessResultV1> {
  const canonicalAccessToken =
    accessToken.trim();

  if (!canonicalAccessToken) {
    throw new GrowthLinkedInOrganizationAccessReaderErrorV1(
      'LINKEDIN_ACCESS_TOKEN_REQUIRED',
    );
  }

  const response =
    await fetch(
      GROWTH_LINKEDIN_ORGANIZATION_ACCESS_ENDPOINT_V1,
      {
        method: 'GET',
        headers: {
          Authorization:
            `Bearer ${canonicalAccessToken}`,
          Accept:
            'application/json',
          'X-Restli-Protocol-Version':
            GROWTH_LINKEDIN_RESTLI_PROTOCOL_VERSION_V1,
          'Linkedin-Version':
            GROWTH_LINKEDIN_API_VERSION_V1,
        },
      },
    );

  if (!response.ok) {
    throw new GrowthLinkedInOrganizationAccessReaderErrorV1(
      `LINKEDIN_ORGANIZATION_ACCESS_HTTP_${response.status}`,
      response.status,
    );
  }

  const payload: unknown =
    await response.json();

  if (!isRecordV1(payload)) {
    throw new GrowthLinkedInOrganizationAccessReaderErrorV1(
      'LINKEDIN_ORGANIZATION_ACCESS_RESPONSE_INVALID',
      response.status,
    );
  }

  const elements =
    payload.elements;

  if (!Array.isArray(elements)) {
    throw new GrowthLinkedInOrganizationAccessReaderErrorV1(
      'LINKEDIN_ORGANIZATION_ACCESS_ELEMENTS_INVALID',
      response.status,
    );
  }

  const organizations:
    GrowthLinkedInOrganizationAccessRecordV1[] =
      [];

  for (const element of elements) {
    if (!isRecordV1(element)) {
      continue;
    }

    const organization =
      typeof element.organization === 'string'
        ? element.organization.trim()
        : '';

    if (!organization) {
      continue;
    }

    const role =
      typeof element.role === 'string'
        ? element.role.trim()
        : 'UNKNOWN';

    const state =
      typeof element.state === 'string'
        ? element.state.trim()
        : 'UNKNOWN';

    organizations.push(
      Object.freeze({
        organization,
        role,
        state,
      }),
    );
  }

  return Object.freeze({
    status:
      organizations.length > 0
        ? 'LINKEDIN_ORGANIZATION_ACCESS_OK'
        : 'LINKEDIN_ORGANIZATION_ACCESS_EMPTY',
    httpStatus:
      response.status,
    organizationCount:
      organizations.length,
    organizations:
      Object.freeze(organizations),
  });
}