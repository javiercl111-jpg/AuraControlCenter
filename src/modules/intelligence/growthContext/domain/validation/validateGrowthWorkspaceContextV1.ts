import type {
  GrowthWorkspaceContextV1,
} from '../GrowthWorkspaceContextV1';

const forbiddenKeys = [
  'denueSource',
  'inegiSource',
  'firestorePath',
  'sourceAuthority',
];

function requireValue(
  value: unknown,
  message: string,
): void {
  if (
    typeof value !== 'string' ||
    value.trim().length === 0
  ) {
    throw new Error(message);
  }
}

export function validateGrowthWorkspaceContextV1(
  context: GrowthWorkspaceContextV1,
): true {

  requireValue(
    context.workspaceId,
    'GROWTH_WORKSPACE_ID_REQUIRED',
  );

  if (!context.ownerRef) {
    throw new Error(
      'GROWTH_OWNER_REQUIRED',
    );
  }

  if (
    context.ownerRef.principalType === 'ORGANIZATION' &&
    !context.authorityContext.organizationId
  ) {
    throw new Error(
      'GROWTH_ORGANIZATION_AUTHORITY_REQUIRED',
    );
  }

  for (const offer of context.offers) {

    requireValue(
      offer.offerId,
      'GROWTH_OFFER_ID_REQUIRED',
    );

    requireValue(
      offer.name,
      'GROWTH_OFFER_NAME_REQUIRED',
    );

    requireValue(
      offer.valueProposition,
      'GROWTH_OFFER_VALUE_PROPOSITION_REQUIRED',
    );
  }

  for (const objective of context.objectives) {

    requireValue(
      objective.objectiveId,
      'GROWTH_OBJECTIVE_ID_REQUIRED',
    );

    requireValue(
      objective.description,
      'GROWTH_OBJECTIVE_DESCRIPTION_REQUIRED',
    );
  }

  for (const audience of context.audiences) {

    requireValue(
      audience.audienceId,
      'GROWTH_AUDIENCE_ID_REQUIRED',
    );

    requireValue(
      audience.description,
      'GROWTH_AUDIENCE_DESCRIPTION_REQUIRED',
    );
  }

  for (const key of forbiddenKeys) {

    if (
      key in (context as unknown as Record<string, unknown>)
    ) {
      throw new Error(
        `GROWTH_EXTERNAL_AUTHORITY_LEAK:${key}`,
      );
    }
  }

  return true;
}