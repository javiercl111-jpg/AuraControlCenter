import {
  createGrowthSocialProfileBindingV1,
  type CreateGrowthSocialProfileBindingInputV1,
  type GrowthSocialProfileBindingV1,
} from './GrowthSocialProfileBindingV1';

import {
  type GrowthSocialProfileBindingKeyV1,
  type GrowthSocialProfileBindingListQueryV1,
  type GrowthSocialProfileBindingRepositoryV1,
} from './GrowthSocialProfileBindingRepositoryV1';


export interface GrowthSocialProfileBindingManagementServiceDependenciesV1 {

  readonly repository:
    GrowthSocialProfileBindingRepositoryV1;

}


const requireNonEmptyScopeValueV1 =
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


export class GrowthSocialProfileBindingManagementServiceV1 {

  private readonly repository:
    GrowthSocialProfileBindingRepositoryV1;


  constructor(
    dependencies:
      GrowthSocialProfileBindingManagementServiceDependenciesV1,
  ) {

    const repository =
      dependencies?.repository;

    if (
      repository === null ||
      typeof repository !== 'object' ||
      typeof repository.getById !== 'function' ||
      typeof repository.listByTenant !== 'function' ||
      typeof repository.save !== 'function'
    ) {
      throw new Error(
        'GROWTH_SOCIAL_PROFILE_BINDING_REPOSITORY_REQUIRED',
      );
    }

    this.repository =
      repository;

  }


  async upsert(
    input:
      CreateGrowthSocialProfileBindingInputV1,
  ):
    Promise<GrowthSocialProfileBindingV1> {

    const binding =
      createGrowthSocialProfileBindingV1(
        input,
      );

    await this.repository.save(
      binding,
    );

    return binding;

  }


  async getById(
    key:
      GrowthSocialProfileBindingKeyV1,
  ):
    Promise<GrowthSocialProfileBindingV1 | null> {

    const tenantId =
      requireNonEmptyScopeValueV1(
        key.tenantId,
        'GROWTH_SOCIAL_PROFILE_BINDING_TENANT_ID_REQUIRED',
      );

    const bindingId =
      requireNonEmptyScopeValueV1(
        key.bindingId,
        'GROWTH_SOCIAL_PROFILE_BINDING_ID_REQUIRED',
      );

    const binding =
      await this.repository.getById({
        tenantId,
        bindingId,
      });

    if (binding === null) {
      return null;
    }

    if (
      binding.tenantId !== tenantId ||
      binding.bindingId !== bindingId
    ) {
      throw new Error(
        'GROWTH_SOCIAL_PROFILE_BINDING_REPOSITORY_IDENTITY_MISMATCH',
      );
    }

    return binding;

  }


  async listByTenant(
    query:
      GrowthSocialProfileBindingListQueryV1,
  ):
    Promise<readonly GrowthSocialProfileBindingV1[]> {

    const tenantId =
      requireNonEmptyScopeValueV1(
        query.tenantId,
        'GROWTH_SOCIAL_PROFILE_BINDING_TENANT_ID_REQUIRED',
      );

    const bindings =
      await this.repository.listByTenant({
        tenantId,

        ...(typeof query.provider !== 'undefined'
          ? {
              provider:
                query.provider,
            }
          : {}),

        ...(typeof query.activeOnly !== 'undefined'
          ? {
              activeOnly:
                query.activeOnly,
            }
          : {}),
      });

    for (const binding of bindings) {

      if (binding.tenantId !== tenantId) {
        throw new Error(
          'GROWTH_SOCIAL_PROFILE_BINDING_REPOSITORY_TENANT_SCOPE_MISMATCH',
        );
      }

    }

    return Object.freeze([
      ...bindings,
    ]);

  }

}