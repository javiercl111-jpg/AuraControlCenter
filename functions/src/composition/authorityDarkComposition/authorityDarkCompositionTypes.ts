import type { Firestore } from "firebase-admin/firestore";
import type {
  AuthorityClockPort,
  AuthorityMutationRepositoryPort,
} from "@aura/intelligence-os/server";

import type {
  AuthorityDarkCompositionTestCapability,
} from "./authorityDarkCompositionTestCapability";

export const AUTHORITY_DARK_COMPOSITION_VERSION = "1";

export type AuthorityDarkCompositionMode =
  | "DISABLED"
  | "TEST_ONLY";

export interface AuthorityDarkCompositionEnvironmentSnapshot {
  readonly GOOGLE_APPLICATION_CREDENTIALS?: string;
}

export type AuthorityDarkCompositionInputV1 =
  | Readonly<{
      mode: "DISABLED";
      firestore?: never;
      clock?: never;
      emulatorHost?: never;
      projectId?: never;
      capability?: never;
      environmentSnapshot?: never;
    }>
  | Readonly<{
      mode: "TEST_ONLY";
      firestore: Firestore;
      clock: AuthorityClockPort;
      emulatorHost: string;
      projectId: string;
      capability: AuthorityDarkCompositionTestCapability;
      environmentSnapshot?: AuthorityDarkCompositionEnvironmentSnapshot;
    }>;

export type AuthorityDarkCompositionV1 =
  | Readonly<{
      version: typeof AUTHORITY_DARK_COMPOSITION_VERSION;
      mode: "DISABLED";
      status: "INERT";
      repository: null;
    }>
  | Readonly<{
      version: typeof AUTHORITY_DARK_COMPOSITION_VERSION;
      mode: "TEST_ONLY";
      status: "READY_FOR_TEST";
      repository: AuthorityMutationRepositoryPort;
    }>;
