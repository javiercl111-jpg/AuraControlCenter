import type {
  GrowthExternalActionRequestV1,
  GrowthExternalActionResultV1,
  GrowthExternalActionTargetV1,
} from '../GrowthExternalActionContractV1';


export type GrowthSocialProviderTargetV1 =
  Extract<
    GrowthExternalActionTargetV1,
    'LINKEDIN' | 'INSTAGRAM' | 'FACEBOOK' | 'YOUTUBE'
  >;


export interface GrowthSocialPublicationContentV1 {

  readonly text:
    string;

  readonly mediaReferenceIds:
    readonly string[];

  readonly linkUrl?:
    string;

}


export interface GrowthSocialPublicationContextV1 {

  readonly tenantId:
    string;

  readonly actionId:
    string;

  readonly correlationId:
    string;

  readonly target:
    GrowthSocialProviderTargetV1;

}


export interface GrowthSocialProviderExecutionReceiptV1 {

  readonly provider:
    string;

  readonly target:
    GrowthSocialProviderTargetV1;

  readonly providerExecutionId:
    string;

  readonly publishedAt:
    string;

  readonly permalink?:
    string;

}


export interface GrowthSocialProviderAdapterV1 {

  readonly target:
    GrowthSocialProviderTargetV1;


  execute(
    request:
      GrowthExternalActionRequestV1,
  ): Promise<GrowthExternalActionResultV1>;

}


export interface GrowthSocialProviderPublishPortV1 {

  publish(
    context:
      GrowthSocialPublicationContextV1,

    content:
      GrowthSocialPublicationContentV1,
  ): Promise<GrowthSocialProviderExecutionReceiptV1>;

}