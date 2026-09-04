import {
  HttpsError,
  onCall,
  type CallableOptions,
} from 'firebase-functions/v2/https';

import {
  GrowthSocialProfileBindingManagementServiceV1,
  type CreateGrowthSocialProfileBindingInputV1,
  type GrowthSocialProfileBindingV1,
  type GrowthSocialProviderV1,
} from '@aura/intelligence-os/server';

import {
  GROWTH_SOCIAL_MANAGE_CAPABILITY_V1,
  type GrowthSocialCapabilityEnvironmentV1,
} from '../../growth/authorization/GrowthSocialCapabilityAuthorizationV1';

import {
  FirestoreGrowthSocialProfileBindingRepositoryV1,
  type GrowthSocialProfileBindingFirestoreV1,
} from '../../growth/social/profiles/FirestoreGrowthSocialProfileBindingRepositoryV1';


export interface GrowthSocialProfileManagementPrincipalV1 {

  readonly uid:
    string;

  readonly role:
    string;

}


export interface GrowthSocialProfileManagementCallableFactoryV1 {

  readonly callableOptions:
    Readonly<CallableOptions>;

  readonly environment:
    GrowthSocialCapabilityEnvironmentV1;

  readonly tenantId:
    string;

  readonly firestore:
    GrowthSocialProfileBindingFirestoreV1;

  readonly assertRuntime:
    () => void;

  readonly resolvePrincipal:
    (
      auth:
        unknown,
    ) =>
      Promise<GrowthSocialProfileManagementPrincipalV1>;

  readonly hasCapability:
    (
      principalId:
        string,
      capability:
        typeof GROWTH_SOCIAL_MANAGE_CAPABILITY_V1,
      environment:
        GrowthSocialCapabilityEnvironmentV1,
    ) =>
      Promise<boolean>;

}


export interface GrowthSocialProfileManagementRequestV1 {

  readonly auth?:
    unknown;

  readonly data:
    unknown;

}


interface GrowthSocialProfileUpsertRequestV1 {

  readonly operation:
    'UPSERT';

  readonly binding:
    Omit<
      CreateGrowthSocialProfileBindingInputV1,
      'tenantId'
    >;

}


interface GrowthSocialProfileGetRequestV1 {

  readonly operation:
    'GET_BY_ID';

  readonly bindingId:
    string;

}


interface GrowthSocialProfileListRequestV1 {

  readonly operation:
    'LIST_BY_TENANT';

  readonly provider?:
    GrowthSocialProviderV1;

  readonly activeOnly?:
    boolean;

}


type GrowthSocialProfileOperationRequestV1 =
  | GrowthSocialProfileUpsertRequestV1
  | GrowthSocialProfileGetRequestV1
  | GrowthSocialProfileListRequestV1;


export type GrowthSocialProfileManagementResponseV1 =
  | Readonly<{
      status:
        'SUCCEEDED';

      operation:
        'UPSERT';

      tenantId:
        string;

      principalId:
        string;

      role:
        string;

      binding:
        GrowthSocialProfileBindingV1;
    }>
  | Readonly<{
      status:
        'SUCCEEDED';

      operation:
        'GET_BY_ID';

      tenantId:
        string;

      principalId:
        string;

      role:
        string;

      binding:
        GrowthSocialProfileBindingV1 | null;
    }>
  | Readonly<{
      status:
        'SUCCEEDED';

      operation:
        'LIST_BY_TENANT';

      tenantId:
        string;

      principalId:
        string;

      role:
        string;

      bindings:
        readonly GrowthSocialProfileBindingV1[];
    }>;


const PROVIDERS_V1 =
  Object.freeze([
    'LINKEDIN',
    'INSTAGRAM',
    'FACEBOOK',
    'YOUTUBE',
  ] as const);


const requireNonEmptyStringV1 =
  (
    value:
      unknown,
    errorMessage:
      string,
  ):
    string => {

    if (
      typeof value !== 'string' ||
      value.trim().length === 0
    ) {
      throw new HttpsError(
        'invalid-argument',
        errorMessage,
      );
    }

    return value.trim();

  };


const requireRecordV1 =
  (
    value:
      unknown,
    errorMessage:
      string,
  ):
    Record<string, unknown> => {

    if (
      value === null ||
      typeof value !== 'object' ||
      Array.isArray(value)
    ) {
      throw new HttpsError(
        'invalid-argument',
        errorMessage,
      );
    }

    return value as Record<string, unknown>;

  };


const parseOperationRequestV1 =
  (
    data:
      unknown,
  ):
    GrowthSocialProfileOperationRequestV1 => {

    const record =
      requireRecordV1(
        data,
        'SOCIAL_PROFILE_MANAGEMENT_REQUEST_INVALID',
      );

    const operation =
      record.operation;

    if (operation === 'UPSERT') {

      const binding =
        requireRecordV1(
          record.binding,
          'SOCIAL_PROFILE_MANAGEMENT_BINDING_REQUIRED',
        );

      if (
        Object.prototype.hasOwnProperty.call(
          binding,
          'tenantId',
        )
      ) {
        throw new HttpsError(
          'invalid-argument',
          'SOCIAL_PROFILE_MANAGEMENT_TENANT_IS_SERVER_MANAGED',
        );
      }

      return {
        operation:
          'UPSERT',

        binding:
          binding as Omit<
            CreateGrowthSocialProfileBindingInputV1,
            'tenantId'
          >,
      };

    }

    if (operation === 'GET_BY_ID') {

      return {
        operation:
          'GET_BY_ID',

        bindingId:
          requireNonEmptyStringV1(
            record.bindingId,
            'SOCIAL_PROFILE_MANAGEMENT_BINDING_ID_REQUIRED',
          ),
      };

    }

    if (operation === 'LIST_BY_TENANT') {

      const provider =
        record.provider;

      if (
        typeof provider !== 'undefined' &&
        (
          typeof provider !== 'string' ||
          !PROVIDERS_V1.includes(
            provider as GrowthSocialProviderV1,
          )
        )
      ) {
        throw new HttpsError(
          'invalid-argument',
          'SOCIAL_PROFILE_MANAGEMENT_PROVIDER_INVALID',
        );
      }

      const activeOnly =
        record.activeOnly;

      if (
        typeof activeOnly !== 'undefined' &&
        typeof activeOnly !== 'boolean'
      ) {
        throw new HttpsError(
          'invalid-argument',
          'SOCIAL_PROFILE_MANAGEMENT_ACTIVE_ONLY_INVALID',
        );
      }

      return {
        operation:
          'LIST_BY_TENANT',

        ...(typeof provider === 'string'
          ? {
              provider:
                provider as GrowthSocialProviderV1,
            }
          : {}),

        ...(typeof activeOnly === 'boolean'
          ? {
              activeOnly,
            }
          : {}),
      };

    }

    throw new HttpsError(
      'invalid-argument',
      'SOCIAL_PROFILE_MANAGEMENT_OPERATION_INVALID',
    );

  };


const executeOperationV1 =
  async (
    operationRequest:
      GrowthSocialProfileOperationRequestV1,
    service:
      GrowthSocialProfileBindingManagementServiceV1,
    tenantId:
      string,
    principal:
      GrowthSocialProfileManagementPrincipalV1,
  ):
    Promise<GrowthSocialProfileManagementResponseV1> => {

    if (operationRequest.operation === 'UPSERT') {

      const binding =
        await service.upsert({
          ...operationRequest.binding,
          tenantId,
        });

      return Object.freeze({
        status:
          'SUCCEEDED',

        operation:
          'UPSERT',

        tenantId,

        principalId:
          principal.uid,

        role:
          principal.role,

        binding,
      });

    }

    if (operationRequest.operation === 'GET_BY_ID') {

      const binding =
        await service.getById({
          tenantId,

          bindingId:
            operationRequest.bindingId,
        });

      return Object.freeze({
        status:
          'SUCCEEDED',

        operation:
          'GET_BY_ID',

        tenantId,

        principalId:
          principal.uid,

        role:
          principal.role,

        binding,
      });

    }

    const bindings =
      await service.listByTenant({
        tenantId,

        ...(typeof operationRequest.provider !== 'undefined'
          ? {
              provider:
                operationRequest.provider,
            }
          : {}),

        ...(typeof operationRequest.activeOnly !== 'undefined'
          ? {
              activeOnly:
                operationRequest.activeOnly,
            }
          : {}),
      });

    return Object.freeze({
      status:
        'SUCCEEDED',

      operation:
        'LIST_BY_TENANT',

      tenantId,

      principalId:
        principal.uid,

      role:
        principal.role,

      bindings:
        Object.freeze([
          ...bindings,
        ]),
    });

  };


export const executeGrowthSocialProfileManagementRequestV1 =
  async (
    dependencies:
      GrowthSocialProfileManagementCallableFactoryV1,
    request:
      GrowthSocialProfileManagementRequestV1,
  ):
    Promise<GrowthSocialProfileManagementResponseV1> => {

    dependencies.assertRuntime();

    if (!request.auth) {
      throw new HttpsError(
        'unauthenticated',
        'AUTHENTICATION_REQUIRED',
      );
    }

    const tenantId =
      requireNonEmptyStringV1(
        dependencies.tenantId,
        'SOCIAL_PROFILE_MANAGEMENT_TENANT_CONFIGURATION_REQUIRED',
      );

    const principal =
      await dependencies.resolvePrincipal(
        request.auth,
      );

    const capabilityAuthorized =
      await dependencies.hasCapability(
        principal.uid,
        GROWTH_SOCIAL_MANAGE_CAPABILITY_V1,
        dependencies.environment,
      );

    if (!capabilityAuthorized) {
      throw new HttpsError(
        'permission-denied',
        'SOCIAL_PROFILE_MANAGEMENT_NOT_AUTHORIZED',
      );
    }

    const repository =
      new FirestoreGrowthSocialProfileBindingRepositoryV1({
        firestore:
          dependencies.firestore,
      });

    const service =
      new GrowthSocialProfileBindingManagementServiceV1({
        repository,
      });

    const operationRequest =
      parseOperationRequestV1(
        request.data,
      );

    return executeOperationV1(
      operationRequest,
      service,
      tenantId,
      principal,
    );

  };


export const createGrowthSocialProfileManagementCallableRuntimeV1 =
  (
    dependencies:
      GrowthSocialProfileManagementCallableFactoryV1,
  ) =>
    onCall(
      {
        ...dependencies.callableOptions,

        enforceAppCheck:
          true,
      },

      async (
        request,
      ) =>
        executeGrowthSocialProfileManagementRequestV1(
          dependencies,
          request,
        ),
    );