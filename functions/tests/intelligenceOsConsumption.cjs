"use strict";

const assert = require("node:assert/strict");
const {
  readFileSync,
  readdirSync,
  realpathSync,
  statSync,
} = require("node:fs");
const { relative, resolve, sep } = require("node:path");

const EXPECTED_NODE_PREFIX = "v20.";
const NOW = "2026-07-29T12:00:00.000Z";
const TENANT_ID = "tenant-node20-validation";
const ACTOR_TYPE = "SYSTEM";
const ACTOR_ID = "actor-node20-validation";
const CONSUMER_ID = "functions-node20-validation";
const SOURCE = "AUTHORIZED_SYSTEM_CONFIGURATION";
const REQUEST_ID = "request-node20-validation";
const CORRELATION_ID = "correlation-node20-validation";

const functionsRoot = resolve(__dirname, "..");
const productionSourceRoot = resolve(functionsRoot, "src");
const stagedPackageRoot = resolve(
  functionsRoot,
  ".generated",
  "aura-intelligence-os"
);
const CERTIFIED_PRODUCTION_CONSUMER_DIRECTORY =
  "infrastructure/firestore/authorityPersistence/";
const CERTIFIED_PRODUCTION_PACKAGE_SPECIFIER =
  "@aura/intelligence-os/server";
const CERTIFIED_COMPOSITION_CONSUMER_FILES = new Set([
  "composition/authorityDarkComposition/authorityDarkCompositionTypes.ts",
  "composition/authorityDarkHandlerComposition/authorityDarkHandlerCompositionFactory.ts",
  "composition/authorityDarkHandlerComposition/authorityDarkHandlerCompositionTypes.ts",
]);
const CERTIFIED_AUTHORITY_PROVISIONING_CONSUMER_FILES = new Set([
  "composition/authorityProvisioning/previewAuthorityProvisioningComposition.ts",
  "infrastructure/firestore/authorityProvisioning/FirestoreAuthorityProvisioningAdapter.ts",
]);
const CERTIFIED_FEATURE_POLICY_CONSUMER_FILES = new Set([
  "infrastructure/firestore/featurePolicy/FirestoreAuthoritativeFeaturePolicySourceV1.ts",
  "infrastructure/firestore/featurePolicy/tests/FirestoreAuthoritativeFeaturePolicySourceV1.test.ts",
]);
const FORBIDDEN_PRODUCTION_SOURCE_REFERENCES = [
  ".generated/aura-intelligence-os",
  "packages/aura-intelligence-os",
  "src/modules/intelligence",
];

function listFiles(directory) {
  const files = [];

  for (const entry of readdirSync(directory).sort()) {
    const absolutePath = resolve(directory, entry);
    const stats = statSync(absolutePath);
    if (stats.isDirectory()) {
      files.push(...listFiles(absolutePath));
    } else if (stats.isFile()) {
      files.push(absolutePath);
    }
  }

  return files;
}

function normalizeProductionSourcePath(file) {
  return file.replaceAll("\\", "/").replace(/^\.\/+/, "");
}

function extractModuleSpecifiers(source) {
  const specifiers = [];
  const staticModulePattern =
    /\b(?:import|export)\s+(?:[^"'`;]*?\s+from\s+)?["']([^"']+)["']/g;
  const dynamicModulePattern =
    /\b(?:require|import)\s*\(\s*["']([^"']+)["']\s*\)/g;

  for (const pattern of [staticModulePattern, dynamicModulePattern]) {
    for (const match of source.matchAll(pattern)) {
      specifiers.push(match[1]);
    }
  }

  return specifiers;
}

function certifiedProductionConsumerViolations(file, source) {
  const normalizedFile = normalizeProductionSourcePath(file);
  const normalizedSource = source.replaceAll("\\", "/");
  const isCertifiedAdapterDirectory = normalizedFile.startsWith(
    CERTIFIED_PRODUCTION_CONSUMER_DIRECTORY
  );
  const isCertifiedDarkCompositionFile =
    CERTIFIED_COMPOSITION_CONSUMER_FILES.has(normalizedFile);
  const isCertifiedAuthorityProvisioningFile =
    CERTIFIED_AUTHORITY_PROVISIONING_CONSUMER_FILES.has(normalizedFile);
  const isCertifiedFeaturePolicyFile =
    CERTIFIED_FEATURE_POLICY_CONSUMER_FILES.has(normalizedFile);
  const isCertifiedConsumer =
    isCertifiedAdapterDirectory || isCertifiedDarkCompositionFile ||
    isCertifiedAuthorityProvisioningFile ||
    isCertifiedFeaturePolicyFile;
  const moduleSpecifiers = extractModuleSpecifiers(source);
  const packageStringSpecifiers = [
    ...source.matchAll(
      /["'](@aura\/intelligence-os(?:\/[^"']*)?)["']/g
    ),
  ].map((match) => match[1]);
  const packageModuleSpecifiers = moduleSpecifiers.filter((specifier) =>
    specifier.startsWith("@aura/intelligence-os")
  );
  const packageReferenceCount = (
    source.match(/@aura\/intelligence-os/g) || []
  ).length;
  const violations = [];

  if (
    packageReferenceCount !== packageStringSpecifiers.length ||
    packageStringSpecifiers.length !== packageModuleSpecifiers.length
  ) {
    violations.push(
      `${normalizedFile} contains a non-literal or non-module Aura Intelligence OS reference`
    );
  }

  for (const specifier of packageModuleSpecifiers) {
    if (!isCertifiedConsumer) {
      violations.push(
        `${normalizedFile} imports ${specifier} outside the certified directory`
      );
    } else if (specifier !== CERTIFIED_PRODUCTION_PACKAGE_SPECIFIER) {
      violations.push(
        `${normalizedFile} imports unauthorized specifier ${specifier}`
      );
    }
  }

  for (const reference of FORBIDDEN_PRODUCTION_SOURCE_REFERENCES) {
    if (normalizedSource.includes(reference)) {
      violations.push(
        `${normalizedFile} references forbidden source path ${reference}`
      );
    }
  }

  return violations;
}

function assertCertifiedProductionConsumerPolicy() {
  const certifiedImport =
    'import { planAuthorityMutationV1 } from "@aura/intelligence-os/server";';
  const darkCompositionImport =
    'import type { AuthorityClockPort } from "@aura/intelligence-os/server";';
  const darkHandlerImport =
    'import type { AuthorityApplicationServiceV1 } from "@aura/intelligence-os/server";';

  assert.deepEqual(
    certifiedProductionConsumerViolations(
      "infrastructure/firestore/authorityPersistence/adapter.ts",
      certifiedImport
    ),
    []
  );
  for (const file of [
    "composition/authorityDarkHandlerComposition/authorityDarkHandlerCompositionFactory.ts",
    "composition/authorityDarkHandlerComposition/authorityDarkHandlerCompositionTypes.ts",
  ]) {
    assert.deepEqual(
      certifiedProductionConsumerViolations(file, darkHandlerImport),
      []
    );
    assert.deepEqual(
      certifiedProductionConsumerViolations(
        file.replaceAll("/", "\\"),
        darkHandlerImport
      ),
      []
    );
  }
  assert.deepEqual(
    certifiedProductionConsumerViolations(
      "infrastructure\\firestore\\authorityPersistence\\adapter.ts",
      certifiedImport
    ),
    []
  );
  assert.deepEqual(
    certifiedProductionConsumerViolations(
      "composition/authorityDarkComposition/authorityDarkCompositionTypes.ts",
      darkCompositionImport
    ),
    []
  );
  assert.deepEqual(
    certifiedProductionConsumerViolations(
      "composition\\authorityDarkComposition\\authorityDarkCompositionTypes.ts",
      darkCompositionImport
    ),
    []
  );
  assert.deepEqual(
    certifiedProductionConsumerViolations(
      "other\\consumer.ts",
      certifiedImport
    ),
    certifiedProductionConsumerViolations(
      "other/consumer.ts",
      certifiedImport
    )
  );

  for (const [file, source] of [
    ["other/consumer.ts", certifiedImport],
    [
      "infrastructure/firestore/authorityPersistence/adapter.ts",
      'import root from "@aura/intelligence-os";',
    ],
    [
      "infrastructure/firestore/authorityPersistence/adapter.ts",
      'const client = import("@aura/intelligence-os/client");',
    ],
    [
      "infrastructure/firestore/authorityPersistence/adapter.ts",
      'const packageSource = require("../../../../../packages/aura-intelligence-os");',
    ],
    [
      "composition/authorityDarkComposition/authorityDarkCompositionFactory.ts",
      darkCompositionImport,
    ],
    [
      "composition/authorityDarkComposition/authorityDarkCompositionTypes.ts",
      'import type { Client } from "@aura/intelligence-os/client";',
    ],
    [
      "composition/authorityDarkHandlerComposition/index.ts",
      darkHandlerImport,
    ],
    [
      "composition/authorityDarkHandlerComposition/authorityDarkHandlerCompositionFactory.ts",
      'import root from "@aura/intelligence-os";',
    ],
    [
      "composition/authorityDarkHandlerComposition/authorityDarkHandlerCompositionTypes.ts",
      'const client = import("@aura/intelligence-os/client");',
    ],
    [
      "composition/authorityDarkHandlerComposition/authorityDarkHandlerCompositionFactory.ts",
      'const source = require("../../../../packages/aura-intelligence-os");',
    ],
  ]) {
    assert.notDeepEqual(
      certifiedProductionConsumerViolations(file, source),
      [],
      `${file} must remain rejected by the production consumer policy`
    );
  }
}

function assertOnlyCertifiedProductionConsumers() {
  assertCertifiedProductionConsumerPolicy();
  const violations = listFiles(productionSourceRoot)
    .filter((file) => file.endsWith(".ts"))
    .flatMap((file) => {
      const source = readFileSync(file, "utf8");
      return certifiedProductionConsumerViolations(
        relative(productionSourceRoot, file),
        source
      );
    });

  assert.deepEqual(
    violations,
    [],
    "Only certified production Functions consumers may consume Aura Intelligence OS"
  );
}

function assertNoProductionConsumer() {
  assertOnlyCertifiedProductionConsumers();
}

function assertInstalledPackageBoundary() {
  const resolvedServer = require.resolve("@aura/intelligence-os/server");
  const realStagingRoot = realpathSync(stagedPackageRoot);
  const realServer = realpathSync(resolvedServer);
  const relativeServer = relative(realStagingRoot, realServer);

  assert.equal(
    relativeServer === ".." || relativeServer.startsWith(`..${sep}`),
    false,
    "The installed package must resolve from Functions staging"
  );

  const manifest = JSON.parse(
    readFileSync(resolve(stagedPackageRoot, "package.json"), "utf8")
  );
  assert.equal(manifest.name, "@aura/intelligence-os");
  assert.equal(manifest.private, true);
  assert.equal(manifest.type, "commonjs");
  assert.deepEqual(manifest.engines, { node: "20" });
  assert.deepEqual(Object.keys(manifest.exports), ["./server"]);
  assert.equal(manifest.dependencies, undefined);
  assert.equal(manifest.devDependencies, undefined);
  assert.equal(manifest.scripts, undefined);

  assert.throws(
    () =>
      require(
        "@aura/intelligence-os/os/bootstrap/PipelineBootstrapper"
      ),
    (error) =>
      error instanceof Error &&
      error.code === "ERR_PACKAGE_PATH_NOT_EXPORTED"
  );
}

function createBusinessPayload() {
  return {
    schemaVersion: "1",
    targetScenario: {
      scenarioId: "PAYROLL_AUDIT",
      scenarioVersion: "1",
      objectiveKey: "ASSESS_PAYROLL_AUDIT_READINESS",
      requestedStages: [
        "EVIDENCE_EXTRACTION",
        "MENTAL_MODEL",
        "KNOWLEDGE_GRAPH",
        "KNOWLEDGE_COVERAGE",
      ],
      source: SOURCE,
      explicitSelection: true,
    },
    facts: [
      {
        factId: "fact-node20-industry",
        category: "BUSINESS_INDUSTRY",
        value: "HOSPITALITY",
        valueType: "ENUM",
        provenance: {
          sourceType: "INTEGRATION",
          sourceId: "node20-validation-fixture",
          collectionMethod: "SYSTEM_EVENT",
          capturedAt: 200,
          reliability: "HIGH",
          directness: "DIRECT",
          actorType: ACTOR_TYPE,
        },
        reliability: "HIGH",
        directness: "DIRECT",
        polarity: "AFFIRMED",
        observedAt: 100,
        schemaVersion: "1",
      },
    ],
    policy: {
      allowedTaxonomyVersion: "1",
      allowedScenarioVersion: "1",
      allowUnknownReliability: false,
      allowUncertainPolarity: false,
      allowInferredDirectness: false,
      allowedInferenceRuleIds: [],
      maxFacts: 10,
      maxFactValueSize: 256,
      maxTotalPayloadSize: 8192,
      duplicateFactPolicy: "REJECT",
      conflictPolicy: "REJECT",
      failClosed: true,
      requireExplicitScenario: true,
    },
    locale: "es-MX",
    timezone: "America/Mexico_City",
  };
}

async function validateInMemoryComposition(runtime) {
  const productionBootstrapper = new runtime.PipelineBootstrapper({
    clock: {
      now: () => 300,
    },
    evidenceFactory: new runtime.PipelineBootstrapEvidenceFactory(),
  });
  let observedBootstrapInput;
  let observedBootstrapState;
  const observingBootstrapper = {
    async bootstrap(input, signal) {
      observedBootstrapInput = input;
      observedBootstrapState =
        await productionBootstrapper.bootstrap(input, signal);
      return observedBootstrapState;
    },
  };
  const clockPort = {
    now: () => NOW,
  };
  const adapter = new runtime.BootstrapBoundaryAdapter({
    bootstrapper: observingBootstrapper,
    clock: clockPort,
  });
  const featurePolicyPort = {
    async getEffectivePolicy() {
      return {
        enabled: true,
        allowedModes: ["SHADOW_ONLY"],
        allowedSources: [SOURCE],
        maxPayloadBytes: 8192,
        maxTimeoutMs: 30000,
        maxConcurrentExecutions: 1,
        killSwitch: false,
        shadowOnlyEnforced: true,
      };
    },
    async evaluateAuthoritativePolicy(query) {
      assert.equal(query.schemaVersion, "1");
      assert.equal(query.tenantId, TENANT_ID);
      assert.equal(query.consumerId, CONSUMER_ID);
      assert.equal(query.source, SOURCE);
      assert.equal(query.requestedMode, "SHADOW_ONLY");
      assert.deepEqual(query.actor, {
        actorType: ACTOR_TYPE,
        actorId: ACTOR_ID,
      });
      return {
        schemaVersion: "1",
        authorizationPolicyVersion: "policy:node20-validation:v1",
        evaluatedTenantId: query.tenantId,
        evaluatedConsumerId: query.consumerId,
        evaluatedSource: query.source,
        evaluatedActor: query.actor,
        requestedMode: query.requestedMode,
        decision: "ALLOWED",
        reasonCode: "POLICY_ALLOWED",
        effectiveExecutionMode: "SHADOW_ONLY",
        effectiveTimeoutMs: 30000,
      };
    },
  };
  const boundary = new runtime.GovernedExecutionBoundary({
    clockPort,
    featurePolicyPort,
    executionPort: adapter,
  });
  const request = {
    requestId: REQUEST_ID,
    correlationId: CORRELATION_ID,
    tenant: {
      tenantId: TENANT_ID,
    },
    actor: {
      actorType: ACTOR_TYPE,
      actorId: ACTOR_ID,
    },
    source: SOURCE,
    requestedMode: "SHADOW_ONLY",
    payload: createBusinessPayload(),
  };
  const invocationContext = {
    schemaVersion: "1",
    tenantId: TENANT_ID,
    actor: {
      actorType: ACTOR_TYPE,
      actorId: ACTOR_ID,
    },
    consumerId: CONSUMER_ID,
    source: SOURCE,
    requestId: REQUEST_ID,
    correlationId: CORRELATION_ID,
  };

  const response = await boundary.execute(request, invocationContext);

  assert.equal(
    response.status,
    "COMPLETED",
    `Unexpected Boundary response: ${JSON.stringify(response)}`
  );
  assert.equal(response.mode, "SHADOW_ONLY");
  assert.deepEqual(response.errors, []);
  assert.equal(response.requestId, REQUEST_ID);
  assert.equal(response.correlationId, CORRELATION_ID);
  assert.equal(observedBootstrapInput.bootstrapId, REQUEST_ID);
  assert.equal(observedBootstrapInput.tenantId, TENANT_ID);
  assert.equal(observedBootstrapInput.correlationId, CORRELATION_ID);
  assert.equal(observedBootstrapState.status, "ACCEPTED");
  assert.equal(observedBootstrapState.bootstrapId, REQUEST_ID);
  assert.equal(
    observedBootstrapState.initialDomainState.scenario.scenarioId,
    "PAYROLL_AUDIT"
  );
  assert.equal(
    observedBootstrapState.initialDomainState.evidence.length,
    1
  );
  assert.equal(
    JSON.stringify(response).includes("node20-validation-fixture"),
    false,
    "The public Boundary response must not expose business payload"
  );
}

async function main() {
  assertNoProductionConsumer();
  assert.equal(
    process.version.startsWith(EXPECTED_NODE_PREFIX),
    true,
    `Functions consumption validation requires Node 20; received ${process.version}`
  );
  assertInstalledPackageBoundary();

  const runtime = require("@aura/intelligence-os/server");
  for (const exportName of [
    "GovernedExecutionBoundary",
    "BootstrapBoundaryAdapter",
    "PipelineBootstrapper",
    "PipelineBootstrapEvidenceFactory",
  ]) {
    assert.equal(
      typeof runtime[exportName],
      "function",
      `Missing runtime export ${exportName}`
    );
  }

  await validateInMemoryComposition(runtime);
  process.stdout.write(
    `Validated Functions consumption with ${process.version}\n`
  );
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.stack : String(error)}\n`
  );
  process.exitCode = 1;
});
