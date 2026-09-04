import type {
  GrowthSocialProviderTargetV1,
} from '../GrowthSocialProviderAdapterContractV1';


export const GROWTH_SOCIAL_PROFILE_BINDING_SCHEMA_VERSION_V1 =
  'GROWTH_SOCIAL_PROFILE_BINDING_V1' as const;


export type GrowthSocialProviderV1 =
  GrowthSocialProviderTargetV1;


export type GrowthSocialAccountTypeV1 =
  | 'PROFILE'
  | 'ORGANIZATION'
  | 'PAGE'
  | 'CHANNEL';


export type GrowthSocialConnectionStateV1 =
  | 'PENDING'
  | 'CONNECTED'
  | 'DISCONNECTED'
  | 'REVOKED'
  | 'ERROR';


export interface GrowthSocialProfileBindingV1 {

  readonly bindingId:
    string;

  readonly tenantId:
    string;

  readonly provider:
    GrowthSocialProviderV1;

  readonly accountType:
    GrowthSocialAccountTypeV1;

  readonly externalAccountId:
    string;

  readonly displayName:
    string;

  readonly handle?:
    string;

  readonly profileUrl?:
    string;

  readonly connectionState:
    GrowthSocialConnectionStateV1;

  readonly isActive:
    boolean;

  readonly createdAt:
    string;

  readonly updatedAt:
    string;

  readonly connectedAt?:
    string;

  readonly lastVerifiedAt?:
    string;

}


export interface CreateGrowthSocialProfileBindingInputV1 {

  readonly bindingId:
    string;

  readonly tenantId:
    string;

  readonly provider:
    GrowthSocialProviderV1;

  readonly accountType:
    GrowthSocialAccountTypeV1;

  readonly externalAccountId:
    string;

  readonly displayName:
    string;

  readonly handle?:
    string;

  readonly profileUrl?:
    string;

  readonly connectionState:
    GrowthSocialConnectionStateV1;

  readonly isActive:
    boolean;

  readonly createdAt:
    string;

  readonly updatedAt:
    string;

  readonly connectedAt?:
    string;

  readonly lastVerifiedAt?:
    string;

}


const PROVIDERS_V1:
  readonly GrowthSocialProviderV1[] =
    [
      'LINKEDIN',
      'INSTAGRAM',
      'FACEBOOK',
      'YOUTUBE',
    ];


const ACCOUNT_TYPES_V1:
  readonly GrowthSocialAccountTypeV1[] =
    [
      'PROFILE',
      'ORGANIZATION',
      'PAGE',
      'CHANNEL',
    ];


const CONNECTION_STATES_V1:
  readonly GrowthSocialConnectionStateV1[] =
    [
      'PENDING',
      'CONNECTED',
      'DISCONNECTED',
      'REVOKED',
      'ERROR',
    ];


const FORBIDDEN_CREDENTIAL_KEYS_V1 =
  new Set(
    [
      'accesstoken',
      'refreshtoken',
      'providertoken',
      'credential',
      'credentials',
      'secret',
      'secretvalue',
    ],
  );


const requireNonEmptyStringV1 =
  (
    value:
      unknown,
    errorCode:
      string,
  ):
    string => {

    if (
      typeof value !== 'string' ||
      value.trim().length === 0
    ) {
      throw new Error(errorCode);
    }

    return value.trim();

  };


const optionalNonEmptyStringV1 =
  (
    value:
      unknown,
    errorCode:
      string,
  ):
    string | undefined => {

    if (typeof value === 'undefined') {
      return undefined;
    }

    return requireNonEmptyStringV1(
      value,
      errorCode,
    );

  };


const assertNoCredentialFieldsV1 =
  (
    input:
      CreateGrowthSocialProfileBindingInputV1,
  ):
    void => {

    for (const key of Object.keys(input)) {

      const normalizedKey =
        key
          .replace(/[^a-zA-Z0-9]/g, '')
          .toLowerCase();

      if (
        FORBIDDEN_CREDENTIAL_KEYS_V1.has(
          normalizedKey,
        )
      ) {
        throw new Error(
          'GROWTH_SOCIAL_PROFILE_BINDING_CREDENTIAL_FIELD_FORBIDDEN',
        );
      }
    }

  };


export const createGrowthSocialProfileBindingV1 =
  (
    input:
      CreateGrowthSocialProfileBindingInputV1,
  ):
    GrowthSocialProfileBindingV1 => {

    assertNoCredentialFieldsV1(
      input,
    );

    if (
      !PROVIDERS_V1.includes(
        input.provider,
      )
    ) {
      throw new Error(
        'GROWTH_SOCIAL_PROFILE_BINDING_PROVIDER_INVALID',
      );
    }

    if (
      !ACCOUNT_TYPES_V1.includes(
        input.accountType,
      )
    ) {
      throw new Error(
        'GROWTH_SOCIAL_PROFILE_BINDING_ACCOUNT_TYPE_INVALID',
      );
    }

    if (
      !CONNECTION_STATES_V1.includes(
        input.connectionState,
      )
    ) {
      throw new Error(
        'GROWTH_SOCIAL_PROFILE_BINDING_CONNECTION_STATE_INVALID',
      );
    }

    if (typeof input.isActive !== 'boolean') {
      throw new Error(
        'GROWTH_SOCIAL_PROFILE_BINDING_ACTIVE_STATE_INVALID',
      );
    }

    const handle =
      optionalNonEmptyStringV1(
        input.handle,
        'GROWTH_SOCIAL_PROFILE_BINDING_HANDLE_INVALID',
      );

    const profileUrl =
      optionalNonEmptyStringV1(
        input.profileUrl,
        'GROWTH_SOCIAL_PROFILE_BINDING_PROFILE_URL_INVALID',
      );

    const connectedAt =
      optionalNonEmptyStringV1(
        input.connectedAt,
        'GROWTH_SOCIAL_PROFILE_BINDING_CONNECTED_AT_INVALID',
      );

    const lastVerifiedAt =
      optionalNonEmptyStringV1(
        input.lastVerifiedAt,
        'GROWTH_SOCIAL_PROFILE_BINDING_LAST_VERIFIED_AT_INVALID',
      );

    return Object.freeze({
      bindingId:
        requireNonEmptyStringV1(
          input.bindingId,
          'GROWTH_SOCIAL_PROFILE_BINDING_ID_REQUIRED',
        ),

      tenantId:
        requireNonEmptyStringV1(
          input.tenantId,
          'GROWTH_SOCIAL_PROFILE_BINDING_TENANT_ID_REQUIRED',
        ),

      provider:
        input.provider,

      accountType:
        input.accountType,

      externalAccountId:
        requireNonEmptyStringV1(
          input.externalAccountId,
          'GROWTH_SOCIAL_PROFILE_BINDING_EXTERNAL_ACCOUNT_ID_REQUIRED',
        ),

      displayName:
        requireNonEmptyStringV1(
          input.displayName,
          'GROWTH_SOCIAL_PROFILE_BINDING_DISPLAY_NAME_REQUIRED',
        ),

      ...(typeof handle === 'string'
        ? { handle }
        : {}),

      ...(typeof profileUrl === 'string'
        ? { profileUrl }
        : {}),

      connectionState:
        input.connectionState,

      isActive:
        input.isActive,

      createdAt:
        requireNonEmptyStringV1(
          input.createdAt,
          'GROWTH_SOCIAL_PROFILE_BINDING_CREATED_AT_REQUIRED',
        ),

      updatedAt:
        requireNonEmptyStringV1(
          input.updatedAt,
          'GROWTH_SOCIAL_PROFILE_BINDING_UPDATED_AT_REQUIRED',
        ),

      ...(typeof connectedAt === 'string'
        ? { connectedAt }
        : {}),

      ...(typeof lastVerifiedAt === 'string'
        ? { lastVerifiedAt }
        : {}),
    });

  };