export type GrowthPrincipalTypeV1 =
  | 'PERSON'
  | 'PROFESSIONAL'
  | 'CREATOR'
  | 'ORGANIZATION';

export interface GrowthPrincipalReferenceV1 {
  readonly principalId: string;
  readonly principalType: GrowthPrincipalTypeV1;
  readonly displayName: string;
}

export interface GrowthAuthorityContextV1 {
  readonly tenantId?: string;
  readonly organizationId?: string;
  readonly clientId?: string;
}

export type GrowthOfferTypeV1 =
  | 'PRODUCT'
  | 'SERVICE'
  | 'CONTENT'
  | 'PERSONAL_BRAND';

export interface GrowthOfferV1 {
  readonly offerId: string;
  readonly type: GrowthOfferTypeV1;
  readonly name: string;
  readonly description: string;
  readonly valueProposition: string;
  readonly benefits: readonly string[];
  readonly differentiators: readonly string[];
  readonly targetAudienceSummary: string;
  readonly geography?: readonly string[];
}

export type GrowthAudienceTypeV1 =
  | 'B2B'
  | 'B2C'
  | 'COMMUNITY';

export interface GrowthAudienceV1 {
  readonly audienceId: string;
  readonly type: GrowthAudienceTypeV1;
  readonly description: string;
  readonly characteristics: readonly string[];
  readonly locations?: readonly string[];
  readonly preferredChannels?: readonly string[];
}

export type GrowthObjectiveTypeV1 =
  | 'GET_CUSTOMERS'
  | 'INCREASE_AUDIENCE'
  | 'PROMOTE_OFFER'
  | 'BUILD_BRAND'
  | 'CREATE_STRATEGY';

export interface GrowthObjectiveV1 {
  readonly objectiveId: string;
  readonly type: GrowthObjectiveTypeV1;
  readonly description: string;
  readonly targetMetric?: string;
  readonly targetValue?: number;
}

export type GrowthChannelTypeV1 =
  | 'LINKEDIN'
  | 'INSTAGRAM'
  | 'FACEBOOK'
  | 'EMAIL'
  | 'WEBSITE'
  | 'CRM'
  | 'PHONE'
  | 'OTHER';

export interface GrowthChannelV1 {
  readonly channelId: string;
  readonly type: GrowthChannelTypeV1;
  readonly enabled: boolean;
}

export interface GrowthWorkspaceContextV1 {
  readonly workspaceId: string;
  readonly ownerRef: GrowthPrincipalReferenceV1;
  readonly authorityContext: GrowthAuthorityContextV1;
  readonly offers: readonly GrowthOfferV1[];
  readonly audiences: readonly GrowthAudienceV1[];
  readonly objectives: readonly GrowthObjectiveV1[];
  readonly channels: readonly GrowthChannelV1[];
}