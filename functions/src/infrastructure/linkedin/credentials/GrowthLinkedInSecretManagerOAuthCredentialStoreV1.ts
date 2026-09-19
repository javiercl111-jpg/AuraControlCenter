import {
  createHash,
} from 'node:crypto';

import {
  SecretManagerServiceClient,
} from '@google-cloud/secret-manager';

import {
  assertGrowthLinkedInOAuthCredentialGrantV1,
  type GrowthLinkedInOAuthCredentialGrantV1,
} from './GrowthLinkedInOAuthCredentialGrantV1';

import {
  assertGrowthLinkedInOAuthCredentialKeyV1,
  type GrowthLinkedInOAuthCredentialKeyV1,
  type GrowthLinkedInOAuthCredentialStoreV1,
} from './GrowthLinkedInOAuthCredentialStoreV1';

export const GROWTH_LINKEDIN_OAUTH_SECRET_PREFIX_V1 =
  'growth-linkedin-oauth-v1' as const;

export interface GrowthLinkedInSecretManagerOAuthCredentialStoreDependenciesV1 {
  readonly client?: SecretManagerServiceClient;
  readonly projectId?: string;
  readonly secretPrefix?: string;
}

const resolveProjectIdV1 = (
  explicitProjectId?: string,
): string => {
  const projectId =
    explicitProjectId ??
    process.env.GCLOUD_PROJECT ??
    process.env.GOOGLE_CLOUD_PROJECT ??
    '';

  if (!projectId.trim()) {
    throw new Error(
      'LINKEDIN_OAUTH_SECRET_MANAGER_PROJECT_ID_REQUIRED',
    );
  }

  return projectId.trim();
};

const createSecretIdV1 = (
  key: GrowthLinkedInOAuthCredentialKeyV1,
  prefix: string,
): string => {
  const digest =
    createHash('sha256')
      .update(
        `${key.tenantId.trim()}\u0000${key.bindingId.trim()}`,
        'utf8',
      )
      .digest('hex');

  return `${prefix}-${digest}`;
};

const isNotFoundV1 = (
  error: unknown,
): boolean => {
  if (
    error === null ||
    typeof error !== 'object'
  ) {
    return false;
  }

  const candidate =
    error as {
      readonly code?: unknown;
    };

  return candidate.code === 5;
};

export class GrowthLinkedInSecretManagerOAuthCredentialStoreV1
implements GrowthLinkedInOAuthCredentialStoreV1 {
  private readonly client:
    SecretManagerServiceClient;

  private readonly projectId:
    string;

  private readonly secretPrefix:
    string;

  constructor(
    dependencies:
      GrowthLinkedInSecretManagerOAuthCredentialStoreDependenciesV1 = {},
  ) {
    this.client =
      dependencies.client ??
      new SecretManagerServiceClient();

    this.projectId =
      resolveProjectIdV1(
        dependencies.projectId,
      );

    this.secretPrefix =
      dependencies.secretPrefix?.trim() ||
      GROWTH_LINKEDIN_OAUTH_SECRET_PREFIX_V1;
  }

  async readGrant(
    key: GrowthLinkedInOAuthCredentialKeyV1,
  ): Promise<GrowthLinkedInOAuthCredentialGrantV1 | null> {
    assertGrowthLinkedInOAuthCredentialKeyV1(
      key,
    );

    const secretId =
      createSecretIdV1(
        key,
        this.secretPrefix,
      );

    const name =
      `projects/${this.projectId}/secrets/${secretId}/versions/latest`;

    try {
      const [version] =
        await this.client.accessSecretVersion({
          name,
        });

      const payload =
        version.payload?.data;

      if (!payload) {
        throw new Error(
          'LINKEDIN_OAUTH_SECRET_MANAGER_PAYLOAD_REQUIRED',
        );
      }

      const serialized =
        typeof payload === 'string'
          ? payload
          : Buffer.from(payload).toString('utf8');

      if (!serialized.trim()) {
        throw new Error(
          'LINKEDIN_OAUTH_SECRET_MANAGER_PAYLOAD_REQUIRED',
        );
      }

      const grant =
        JSON.parse(
          serialized,
        ) as GrowthLinkedInOAuthCredentialGrantV1;

      assertGrowthLinkedInOAuthCredentialGrantV1(
        grant,
      );

      if (
        grant.tenantId !== key.tenantId.trim() ||
        grant.bindingId !== key.bindingId.trim()
      ) {
        throw new Error(
          'LINKEDIN_OAUTH_SECRET_MANAGER_IDENTITY_MISMATCH',
        );
      }

      return grant;
    } catch (error) {
      if (isNotFoundV1(error)) {
        return null;
      }

      throw error;
    }
  }
}