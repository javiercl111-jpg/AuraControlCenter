export const GROWTH_SOCIAL_CAPABILITY_GRANT_COLLECTION_V1 =
  'platform_global_admin_growth_capability_grants' as const;

export const GROWTH_SOCIAL_CAPABILITY_GRANT_SCHEMA_VERSION_V1 =
  'GrowthSocialCapabilityGrantV1' as const;

export const GROWTH_SOCIAL_CAPABILITY_ENVIRONMENT_V1 =
  'PREVIEW' as const;

export const GROWTH_SOCIAL_MANAGE_CAPABILITY_V1 =
  'growth.social.manage' as const;

export const GROWTH_SOCIAL_PUBLISH_CAPABILITY_V1 =
  'growth.social.publish' as const;

export type GrowthSocialCapabilityV1 =
  | typeof GROWTH_SOCIAL_MANAGE_CAPABILITY_V1
  | typeof GROWTH_SOCIAL_PUBLISH_CAPABILITY_V1;

const GROWTH_SOCIAL_ALLOWED_CAPABILITIES_V1 =
  new Set<GrowthSocialCapabilityV1>([
    GROWTH_SOCIAL_MANAGE_CAPABILITY_V1,
    GROWTH_SOCIAL_PUBLISH_CAPABILITY_V1,
  ]);

interface GrowthSocialDocumentSnapshotV1 {
  readonly exists: boolean;
  data(): Record<string, unknown> | undefined;
}

interface GrowthSocialDocumentReferenceV1 {
  get(): Promise<GrowthSocialDocumentSnapshotV1>;
}

interface GrowthSocialCollectionReferenceV1 {
  doc(id: string): GrowthSocialDocumentReferenceV1;
}

export interface GrowthSocialCapabilityFirestorePortV1 {
  collection(name: string): GrowthSocialCollectionReferenceV1;
}

const hasExactKeysV1 = (
  value: Record<string, unknown>,
  expected: readonly string[],
): boolean => {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();

  if (actual.length !== wanted.length) {
    return false;
  }

  return actual.every(
    (key, index) =>
      key === wanted[index],
  );
};

const isActivePrincipalV1 = (
  value: Record<string, unknown>,
): boolean => {
  if (value.isActive !== true) {
    return false;
  }

  if (value.status === 'INACTIVE') {
    return false;
  }

  return true;
};

const isValidCapabilityListV1 = (
  value: unknown,
): value is readonly GrowthSocialCapabilityV1[] => {
  if (!Array.isArray(value)) {
    return false;
  }

  if (
    value.length < 1 ||
    value.length > 2
  ) {
    return false;
  }

  const normalized =
    new Set(value);

  if (normalized.size !== value.length) {
    return false;
  }

  return value.every(
    (capability) =>
      typeof capability === 'string' &&
      GROWTH_SOCIAL_ALLOWED_CAPABILITIES_V1.has(
        capability as GrowthSocialCapabilityV1,
      ),
  );
};

const isValidGrantV1 = (
  value: Record<string, unknown>,
): boolean => {
  if (
    !hasExactKeysV1(
      value,
      [
        'capabilities',
        'environment',
        'isActive',
        'schemaVersion',
      ],
    )
  ) {
    return false;
  }

  if (
    value.schemaVersion !==
    GROWTH_SOCIAL_CAPABILITY_GRANT_SCHEMA_VERSION_V1
  ) {
    return false;
  }

  if (
    value.environment !==
    GROWTH_SOCIAL_CAPABILITY_ENVIRONMENT_V1
  ) {
    return false;
  }

  if (value.isActive !== true) {
    return false;
  }

  return isValidCapabilityListV1(
    value.capabilities,
  );
};

export const hasGrowthSocialCapabilityV1 =
  async (
    db: GrowthSocialCapabilityFirestorePortV1,
    uid: string,
    requiredCapability: GrowthSocialCapabilityV1,
  ): Promise<boolean> => {
    const canonicalUid =
      uid.trim();

    if (!canonicalUid) {
      return false;
    }

    if (
      !GROWTH_SOCIAL_ALLOWED_CAPABILITIES_V1.has(
        requiredCapability,
      )
    ) {
      return false;
    }

    const [
      principalSnapshot,
      grantSnapshot,
    ] =
      await Promise.all([
        db
          .collection('platform_global_admins')
          .doc(canonicalUid)
          .get(),
        db
          .collection(
            GROWTH_SOCIAL_CAPABILITY_GRANT_COLLECTION_V1,
          )
          .doc(canonicalUid)
          .get(),
      ]);

    if (
      !principalSnapshot.exists ||
      !grantSnapshot.exists
    ) {
      return false;
    }

    const principal =
      principalSnapshot.data();

    const grant =
      grantSnapshot.data();

    if (
      !principal ||
      !grant
    ) {
      return false;
    }

    if (!isActivePrincipalV1(principal)) {
      return false;
    }

    if (!isValidGrantV1(grant)) {
      return false;
    }

    const capabilities =
      grant.capabilities as
        readonly GrowthSocialCapabilityV1[];

    return capabilities.includes(
      requiredCapability,
    );
  };