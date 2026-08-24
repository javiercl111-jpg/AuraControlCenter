import type {
  GrowthExternalActionPayloadReferenceV1,
  GrowthExternalActionRequestV1,
  GrowthExternalActionResultV1,
} from '../../GrowthExternalActionContractV1';

import type {
  GrowthSocialPublicationContentV1,
  GrowthSocialPublicationContextV1,
  GrowthSocialProviderAdapterV1,
  GrowthSocialProviderPublishPortV1,
} from '../GrowthSocialProviderAdapterContractV1';


export interface GrowthLinkedInContentResolverV1 {

  resolve(
    payload:
      GrowthExternalActionPayloadReferenceV1,
  ): Promise<GrowthSocialPublicationContentV1>;

}


export interface GrowthLinkedInProviderAdapterDependenciesV1 {

  readonly publishPort:
    GrowthSocialProviderPublishPortV1;

  readonly contentResolver:
    GrowthLinkedInContentResolverV1;

}


export class GrowthLinkedInProviderAdapterV1
implements GrowthSocialProviderAdapterV1 {

  readonly target =
    'LINKEDIN' as const;


  private readonly publishPort:
    GrowthSocialProviderPublishPortV1;

  private readonly contentResolver:
    GrowthLinkedInContentResolverV1;


  constructor(
    dependencies:
      GrowthLinkedInProviderAdapterDependenciesV1,
  ) {

    this.publishPort =
      dependencies.publishPort;

    this.contentResolver =
      dependencies.contentResolver;

  }


  async execute(
    request:
      GrowthExternalActionRequestV1,
  ): Promise<GrowthExternalActionResultV1> {

    if (request.target !== 'LINKEDIN') {

      throw new Error(
        'LINKEDIN_TARGET_REQUIRED',
      );

    }


    const content =
      await this.contentResolver.resolve(
        request.payload,
      );


    if (
      typeof content.text !== 'string' ||
      content.text.trim().length === 0
    ) {

      throw new Error(
        'LINKEDIN_TEXT_REQUIRED',
      );

    }


    const context:
      GrowthSocialPublicationContextV1 = {

        tenantId:
          request.authority.tenantId,

        actionId:
          request.actionId,

        correlationId:
          request.correlation.correlationId,

        target:
          'LINKEDIN',

      };


    const providerReceipt =
      await this.publishPort.publish(
        context,
        content,
      );


    return {

      actionId:
        request.actionId,

      requestId:
        request.correlation.requestId,

      correlationId:
        request.correlation.correlationId,

      state:
        'SUCCEEDED',

      receipt: {

        receiptId:
          `linkedin:${request.actionId}:${providerReceipt.providerExecutionId}`,

        actionId:
          request.actionId,

        state:
          'SUCCEEDED',

        providerExecutionId:
          providerReceipt.providerExecutionId,

        executedAt:
          providerReceipt.publishedAt,

        evidence: [],

      },

      warnings: [],

    };

  }

}