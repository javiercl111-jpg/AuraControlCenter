import { deepStrictEqual, notStrictEqual, strictEqual } from "assert";
import { readFileSync } from "fs";
import { resolve } from "path";
import { generateIdempotencyHash } from "../idempotencyHelper";
import {
  DiscoveryReportSessionScopeInput,
  getDiscoveryReportSessionScopeFailure,
} from "../reports/requestExecutiveDocument";

type TestBody = () => void | Promise<void>;

interface TestCase {
  readonly name: string;
  readonly run: TestBody;
}

const now = Date.UTC(2026, 6, 22, 18, 0, 0);
const baseScope: DiscoveryReportSessionScopeInput = {
  storedSessionTokenHash: "hash-session-a",
  presentedSessionTokenHash: "hash-session-a",
  sessionTokenExpiresAtMillis: now + 60_000,
  linkStatus: "completed",
  linkDossierId: "dossier_session_a",
  requestedSessionId: "dossier_session_a",
  requestedProspectId: "prospect-a",
  sessionLinkId: "link-a",
  requestedLinkId: "link-a",
  sessionProspectId: "prospect-a",
  linkTenantId: "aura_root",
  sessionTenantId: "aura_root",
  prospectTenantId: "aura_root",
  linkOrganizationId: "organization-a",
  sessionOrganizationId: "organization-a",
  prospectOrganizationId: "organization-a",
};

const repositoryRoot = resolve(__dirname, "../../../..");

const tests: readonly TestCase[] = [
  {
    name: "A valid public session can request its own report",
    run: () => {
      strictEqual(getDiscoveryReportSessionScopeFailure(baseScope, now), null);
    },
  },
  {
    name: "Session A cannot request session B",
    run: () => {
      strictEqual(
        getDiscoveryReportSessionScopeFailure(
          { ...baseScope, requestedSessionId: "dossier_session_b" },
          now
        ),
        "DISCOVERY_SESSION_MISMATCH"
      );
    },
  },
  {
    name: "A session cannot request another prospect report",
    run: () => {
      strictEqual(
        getDiscoveryReportSessionScopeFailure(
          { ...baseScope, requestedProspectId: "prospect-b" },
          now
        ),
        "DISCOVERY_PROSPECT_MISMATCH"
      );
    },
  },
  {
    name: "An invalid session token fails closed",
    run: () => {
      strictEqual(
        getDiscoveryReportSessionScopeFailure(
          { ...baseScope, presentedSessionTokenHash: "hash-invalid" },
          now
        ),
        "SESSION_TOKEN_INVALID"
      );
    },
  },
  {
    name: "An expired or unbounded session token fails closed",
    run: () => {
      strictEqual(
        getDiscoveryReportSessionScopeFailure(
          { ...baseScope, sessionTokenExpiresAtMillis: now },
          now
        ),
        "SESSION_TOKEN_EXPIRED"
      );
      strictEqual(
        getDiscoveryReportSessionScopeFailure(
          { ...baseScope, sessionTokenExpiresAtMillis: null },
          now
        ),
        "SESSION_TOKEN_EXPIRED"
      );
    },
  },
  {
    name: "Tenant and organization mismatches fail closed",
    run: () => {
      strictEqual(
        getDiscoveryReportSessionScopeFailure(
          { ...baseScope, prospectTenantId: "tenant-b" },
          now
        ),
        "DISCOVERY_TENANT_MISMATCH"
      );
      strictEqual(
        getDiscoveryReportSessionScopeFailure(
          { ...baseScope, prospectOrganizationId: "organization-b" },
          now
        ),
        "DISCOVERY_ORGANIZATION_MISMATCH"
      );
    },
  },
  {
    name: "Idempotency hashing is stable per key and private per secret",
    run: () => {
      const key = "6f566564-e091-47f2-baf8-10f19f151a97";
      const first = generateIdempotencyHash(key, "secret-a");
      const retry = generateIdempotencyHash(key, "secret-a");
      const anotherAttempt = generateIdempotencyHash(
        "76cc59b0-906e-4759-b8ed-ef2e2c6cabf3",
        "secret-a"
      );
      const anotherSecret = generateIdempotencyHash(key, "secret-b");

      strictEqual(first, retry);
      notStrictEqual(first, anotherAttempt);
      notStrictEqual(first, anotherSecret);
      strictEqual(first.length, 64);
    },
  },
  {
    name: "Lead and idempotency completion share one transaction",
    run: () => {
      const source = readFileSync(
        resolve(repositoryRoot, "functions/src/discovery/createDiscoveryLead.ts"),
        "utf8"
      );
      const atomicWrite = source.match(
        /runTransaction\(async \(transaction\)[\s\S]*?transaction\.set\(docRef, linkPayload\);[\s\S]*?transaction\.update\(idempotencyRef/
      );
      strictEqual(Boolean(atomicWrite), true);
      strictEqual(source.includes("processingAttemptId !== transactionResult.processingAttemptId"), true);
    },
  },
  {
    name: "Preform retries reuse a cryptographic key and navigate with the returned fragment URL",
    run: () => {
      const pageSource = readFileSync(resolve(repositoryRoot, "src/pages/DiscoverPage.tsx"), "utf8");
      const serviceSource = readFileSync(
        resolve(repositoryRoot, "src/modules/discovery/services/discoveryLinkService.ts"),
        "utf8"
      );

      strictEqual(pageSource.includes("preformAttemptRef.current?.signature !== attemptSignature"), true);
      strictEqual(pageSource.includes("idempotencyKey: preformAttemptRef.current.idempotencyKey"), true);
      strictEqual(serviceSource.includes("globalThis.crypto.randomUUID()"), true);
      strictEqual(pageSource.includes("navigate(getDiscoveryNavigationTarget(newLink)"), true);
      strictEqual(serviceSource.includes("new URL(response.discoveryUrl)"), true);
      strictEqual(serviceSource.includes('url.searchParams.has("access")'), true);
      strictEqual(pageSource.includes("?access=${newLink.oneTimeToken}"), false);
    },
  },
  {
    name: "Functions deploy has a mandatory source build",
    run: () => {
      const firebaseConfig = JSON.parse(
        readFileSync(resolve(repositoryRoot, "firebase.json"), "utf8")
      ) as { functions?: { predeploy?: string[] } };
      deepStrictEqual(firebaseConfig.functions?.predeploy, [
        'npm --prefix "$RESOURCE_DIR" run build',
      ]);
    },
  },
];

async function runTests(): Promise<void> {
  let passed = 0;
  const failures: string[] = [];
  for (const test of tests) {
    try {
      await test.run();
      passed += 1;
      console.log(`PASS ${test.name}`);
    } catch (error: unknown) {
      failures.push(test.name);
      console.error(`FAIL ${test.name}`, error);
    }
  }

  console.log(`${passed}/${tests.length} tests passed`);
  if (failures.length > 0) {
    throw new Error(`Discovery access-integrity tests failed: ${failures.join(", ")}`);
  }
}

void runTests().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
