import type {
  AuthorityApplicationExecutionContextV1,
  AuthorityApplicationServiceRequestV1,
  AuthorityApplicationServiceResultV1,
  AuthorityApplicationServiceV1,
  AuthorityClockPort,
} from "@aura/intelligence-os/server";

import type {
  AuthorityDarkHandlerTestCapabilityV1,
} from "./authorityDarkHandlerTestCapability";

export const AUTHORITY_DARK_HANDLER_COMPOSITION_VERSION = "1";
export const AUTHORITY_DARK_HANDLER_COMPOSITION_METADATA_VERSION = "1";

export type AuthorityDarkHandlerCompositionMode =
  | "DISABLED"
  | "TEST_ONLY";

export interface AuthorityDarkHandlerCompositionMetadataV1 {
  readonly schemaVersion:
    typeof AUTHORITY_DARK_HANDLER_COMPOSITION_METADATA_VERSION;
  readonly compositionId: string;
  readonly purpose: "AUTHORITY_DARK_HANDLER_TEST";
}

export interface AuthorityDarkHandlerInvocationV1 {
  invokeTestOnly(
    request: AuthorityApplicationServiceRequestV1,
    context: AuthorityApplicationExecutionContextV1,
    capability: AuthorityDarkHandlerTestCapabilityV1,
  ): Promise<AuthorityApplicationServiceResultV1>;
}

export type AuthorityDarkHandlerCompositionInputV1 =
  | Readonly<{
      mode: "DISABLED";
      capability?: never;
      applicationService?: never;
      clock?: never;
      metadata?: never;
    }>
  | Readonly<{
      mode: "TEST_ONLY";
      capability: AuthorityDarkHandlerTestCapabilityV1;
      applicationService: AuthorityApplicationServiceV1;
      clock: AuthorityClockPort;
      metadata: AuthorityDarkHandlerCompositionMetadataV1;
    }>;

export type AuthorityDarkHandlerCompositionV1 =
  | Readonly<{
      version: typeof AUTHORITY_DARK_HANDLER_COMPOSITION_VERSION;
      mode: "DISABLED";
      status: "INERT";
    }>
  | Readonly<{
      version: typeof AUTHORITY_DARK_HANDLER_COMPOSITION_VERSION;
      mode: "TEST_ONLY";
      status: "READY_FOR_TEST";
      metadata: AuthorityDarkHandlerCompositionMetadataV1;
      invocation: Readonly<AuthorityDarkHandlerInvocationV1>;
    }>;
