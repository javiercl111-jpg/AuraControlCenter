import type {
  GrowthSocialProfileBindingV1,
  GrowthSocialProviderV1,
} from './GrowthSocialProfileBindingV1';


export const GROWTH_SOCIAL_PROFILE_BINDING_COLLECTION_V1 =
  'growth_social_profile_bindings_v1' as const;


export interface GrowthSocialProfileBindingKeyV1 {

  readonly tenantId:
    string;

  readonly bindingId:
    string;

}


export interface GrowthSocialProfileBindingListQueryV1 {

  readonly tenantId:
    string;

  readonly provider?:
    GrowthSocialProviderV1;

  readonly activeOnly?:
    boolean;

}


export interface GrowthSocialProfileBindingRepositoryV1 {

  getById(
    key:
      GrowthSocialProfileBindingKeyV1,
  ):
    Promise<GrowthSocialProfileBindingV1 | null>;

  listByTenant(
    query:
      GrowthSocialProfileBindingListQueryV1,
  ):
    Promise<readonly GrowthSocialProfileBindingV1[]>;

  save(
    binding:
      GrowthSocialProfileBindingV1,
  ):
    Promise<void>;

}