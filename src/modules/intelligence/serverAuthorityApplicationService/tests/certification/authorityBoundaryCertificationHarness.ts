import {
  createAuthorityApplicationServiceV1,
} from '../../authorityApplicationServiceFactories';
import type {
  AuthorityApplicationExecutionContextV1,
  AuthorityApplicationServiceRequestV1,
  AuthorityApplicationServiceResultV1,
} from '../../authorityApplicationServiceTypes';
import {
  applicationRequest,
  dependencies,
  dependencyState,
  executionContext,
  type DependencyState,
} from '../fixtures';

export interface AuthorityBoundaryCertificationRun {
  readonly result: AuthorityApplicationServiceResultV1;
  readonly state: DependencyState;
  readonly request: AuthorityApplicationServiceRequestV1;
  readonly context: AuthorityApplicationExecutionContextV1;
}

export async function runAuthorityBoundaryCertification(
  configure: (state: DependencyState) => void = () => undefined,
  request: AuthorityApplicationServiceRequestV1 = applicationRequest(),
  context: AuthorityApplicationExecutionContextV1 = executionContext(),
): Promise<AuthorityBoundaryCertificationRun> {
  const state = dependencyState();
  configure(state);
  const result = await createAuthorityApplicationServiceV1(
    dependencies(state),
  ).execute(request, context);
  return Object.freeze({ result, state, request, context });
}

export async function runWithClockCancellation(
  abortOnClockCall: number,
): Promise<AuthorityBoundaryCertificationRun> {
  const state = dependencyState();
  const controller = new AbortController();
  state.controller = controller;
  const base = dependencies(state);
  const context = executionContext({
    cancellationSignal: controller.signal,
  });
  const service = createAuthorityApplicationServiceV1({
    ...base,
    clock: {
      nowIso() {
        state.clockCalls += 1;
        if (state.clockCalls === abortOnClockCall) {
          controller.abort();
        }
        return '2026-07-30T12:01:30.000Z';
      },
    },
  });
  const request = applicationRequest();
  const result = await service.execute(request, context);
  return Object.freeze({ result, state, request, context });
}

export function nestedFixture(
  value: Readonly<Record<string, unknown>>,
  field: string,
  overrides: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  const nested = value[field];
  if (
    typeof nested !== 'object' ||
    nested === null ||
    Array.isArray(nested)
  ) {
    throw new Error('Certification fixture is invalid.');
  }
  return { ...value, [field]: { ...nested, ...overrides } };
}
