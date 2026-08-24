import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  GrowthLinkedInServerCredentialBoundaryV1,
} from '../../../src/infrastructure/linkedin/credentials/GrowthLinkedInServerCredentialBoundaryV1';

describe(
  'GROWTH-CLOSURE-01 | LinkedIn Server Credential Boundary Behavior V1',
  () => {

    it(
      'acquires ACCESS_TOKEN for the explicit tenant',
      async () => {
        const acquire =
          vi.fn()
            .mockResolvedValue({
              credentialKind: 'ACCESS_TOKEN',
              accessToken: 'synthetic-server-token',
              tokenType: 'Bearer',
            });

        const boundary =
          new GrowthLinkedInServerCredentialBoundaryV1({
            acquire,
          });

        const lease =
          await boundary.acquire({
            tenantId: 'tenant-aura-001',
            credentialKind: 'ACCESS_TOKEN',
          });

        expect(acquire)
          .toHaveBeenCalledWith({
            tenantId: 'tenant-aura-001',
            credentialKind: 'ACCESS_TOKEN',
          });

        expect(lease.accessToken)
          .toBe('synthetic-server-token');

        expect(lease.tokenType)
          .toBe('Bearer');
      },
    );

    it(
      'rejects an empty tenant before calling the source',
      async () => {
        const acquire = vi.fn();

        const boundary =
          new GrowthLinkedInServerCredentialBoundaryV1({
            acquire,
          });

        await expect(
          boundary.acquire({
            tenantId: '   ',
            credentialKind: 'ACCESS_TOKEN',
          }),
        ).rejects.toThrow(
          'LINKEDIN_SERVER_TENANT_ID_REQUIRED',
        );

        expect(acquire)
          .not
          .toHaveBeenCalled();
      },
    );

    it(
      'rejects an empty access token',
      async () => {
        const boundary =
          new GrowthLinkedInServerCredentialBoundaryV1({
            acquire:
              vi.fn()
                .mockResolvedValue({
                  credentialKind: 'ACCESS_TOKEN',
                  accessToken: '   ',
                  tokenType: 'Bearer',
                }),
          });

        await expect(
          boundary.acquire({
            tenantId: 'tenant-aura-001',
            credentialKind: 'ACCESS_TOKEN',
          }),
        ).rejects.toThrow(
          'LINKEDIN_SERVER_ACCESS_TOKEN_REQUIRED',
        );
      },
    );

    it(
      'rejects a non-Bearer token',
      async () => {
        const boundary =
          new GrowthLinkedInServerCredentialBoundaryV1({
            acquire:
              vi.fn()
                .mockResolvedValue({
                  credentialKind: 'ACCESS_TOKEN',
                  accessToken: 'synthetic-token',
                  tokenType: 'Basic',
                }),
          });

        await expect(
          boundary.acquire({
            tenantId: 'tenant-aura-001',
            credentialKind: 'ACCESS_TOKEN',
          }),
        ).rejects.toThrow(
          'LINKEDIN_SERVER_TOKEN_TYPE_INVALID',
        );
      },
    );

  },
);