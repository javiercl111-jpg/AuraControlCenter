import { describe, expect, it } from 'vitest';

import type {
  GrowthAudienceV1,
  GrowthAuthorityContextV1,
  GrowthChannelV1,
  GrowthObjectiveV1,
  GrowthOfferV1,
  GrowthPrincipalReferenceV1,
  GrowthWorkspaceContextV1,
} from '../GrowthWorkspaceContextV1';


describe(
  'GROWTH-COMMERCIAL-01 | GrowthWorkspaceContextV1 contract',
  () => {
    it(
      'represents a person, professional, creator, or organization without duplicating platform authority',
      () => {
        const principalTypes:
          GrowthPrincipalReferenceV1['principalType'][] = [
            'PERSON',
            'PROFESSIONAL',
            'CREATOR',
            'ORGANIZATION',
          ];

        expect(principalTypes).toEqual([
          'PERSON',
          'PROFESSIONAL',
          'CREATOR',
          'ORGANIZATION',
        ]);

        const authority: GrowthAuthorityContextV1 = {
          tenantId: 'tenant-001',
          organizationId: 'organization-001',
          clientId: 'client-001',
        };

        expect(authority.organizationId).toBe('organization-001');
      },
    );

    it(
      'supports product, service, content, and personal-brand offers',
      () => {
        const offerTypes: GrowthOfferV1['type'][] = [
          'PRODUCT',
          'SERVICE',
          'CONTENT',
          'PERSONAL_BRAND',
        ];

        expect(offerTypes).toHaveLength(4);
      },
    );

    it(
      'preserves offer value proposition, benefits, and differentiators',
      () => {
        const offer: GrowthOfferV1 = {
          offerId: 'offer-001',
          type: 'SERVICE',
          name: 'Business consulting',
          description: 'Strategic business consulting',
          valueProposition:
            'Turn business context into an actionable growth strategy',
          benefits: [
            'Commercial clarity',
            'Prioritized actions',
          ],
          differentiators: [
            'Governed AI intelligence',
          ],
          targetAudienceSummary:
            'Business owners seeking structured growth',
          geography: ['Mexico'],
        };

        expect(offer.valueProposition).toContain('growth strategy');
        expect(offer.benefits).toHaveLength(2);
        expect(offer.differentiators).toHaveLength(1);
      },
    );

    it(
      'supports B2B, B2C, and community audiences',
      () => {
        const audienceTypes: GrowthAudienceV1['type'][] = [
          'B2B',
          'B2C',
          'COMMUNITY',
        ];

        expect(audienceTypes).toEqual([
          'B2B',
          'B2C',
          'COMMUNITY',
        ]);
      },
    );

    it(
      'supports customer, audience, offer, brand, and strategy objectives',
      () => {
        const objectiveTypes: GrowthObjectiveV1['type'][] = [
          'GET_CUSTOMERS',
          'INCREASE_AUDIENCE',
          'PROMOTE_OFFER',
          'BUILD_BRAND',
          'CREATE_STRATEGY',
        ];

        expect(objectiveTypes).toHaveLength(5);
      },
    );

    it(
      'supports commercial and audience channels without coupling them to a provider',
      () => {
        const channelTypes: GrowthChannelV1['type'][] = [
          'LINKEDIN',
          'INSTAGRAM',
          'FACEBOOK',
          'EMAIL',
          'WEBSITE',
          'CRM',
          'PHONE',
          'OTHER',
        ];

        expect(channelTypes).toHaveLength(8);
      },
    );

    it(
      'composes the canonical Growth workspace context',
      () => {
        const workspace: GrowthWorkspaceContextV1 = {
          workspaceId: 'growth-workspace-001',

          ownerRef: {
            principalId: 'principal-001',
            principalType: 'ORGANIZATION',
            displayName: 'Example Organization',
          },

          authorityContext: {
            tenantId: 'tenant-001',
            organizationId: 'organization-001',
            clientId: 'client-001',
          },

          offers: [
            {
              offerId: 'offer-001',
              type: 'PRODUCT',
              name: 'Example Product',
              description: 'Example product description',
              valueProposition: 'Example value proposition',
              benefits: ['Benefit'],
              differentiators: ['Differentiator'],
              targetAudienceSummary: 'Mid-market organizations',
              geography: ['Mexico'],
            },
          ],

          audiences: [
            {
              audienceId: 'audience-001',
              type: 'B2B',
              description: 'Mid-market decision makers',
              characteristics: ['Operational responsibility'],
              locations: ['Mexico'],
              preferredChannels: ['LINKEDIN', 'EMAIL'],
            },
          ],

          objectives: [
            {
              objectiveId: 'objective-001',
              type: 'GET_CUSTOMERS',
              description: 'Generate qualified commercial opportunities',
              targetMetric: 'qualified_leads',
              targetValue: 20,
            },
          ],

          channels: [
            {
              channelId: 'channel-001',
              type: 'LINKEDIN',
              enabled: true,
            },
          ],
        };

        expect(workspace.offers).toHaveLength(1);
        expect(workspace.audiences).toHaveLength(1);
        expect(workspace.objectives).toHaveLength(1);
        expect(workspace.channels).toHaveLength(1);
      },
    );
  },
);