const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "../..");

const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

const exists = (relativePath) =>
  fs.existsSync(path.join(root, relativePath));

test("production authorization accepts explicit PREVIEW and PRODUCTION environments", () => {
  const source = read(
    "functions/src/growth/authorization/GrowthSocialCapabilityAuthorizationV1.ts",
  );

  assert.match(
    source,
    /export type GrowthSocialCapabilityEnvironmentV1[\s\S]*'PREVIEW'[\s\S]*'PRODUCTION'/,
    "Growth authorization must define an explicit PREVIEW | PRODUCTION environment contract",
  );

  assert.match(
    source,
    /expectedEnvironment\s*:\s*GrowthSocialCapabilityEnvironmentV1/,
    "Capability authorization must receive the expected runtime environment explicitly",
  );

  assert.doesNotMatch(
    source,
    /GROWTH_SOCIAL_CAPABILITY_ENVIRONMENT_V1\s*=\s*[\r\n\s]*'PREVIEW'/,
    "Authorization must not remain globally pinned to PREVIEW",
  );
});

test("production LinkedIn deployment unit is isolated from preview-discovery", () => {
  const relativePath =
    "functions/src/growth/deployment/productionGrowthLinkedInDeploymentUnitV1.ts";

  assert.equal(
    exists(relativePath),
    true,
    "Dedicated production Growth LinkedIn deployment unit must exist",
  );

  const source = read(relativePath);

  assert.match(
    source,
    /aura-control-center-debb3/,
    "Production deployment unit must bind the production Firebase project",
  );

  assert.match(
    source,
    /PRODUCTION/,
    "Production deployment unit must require PRODUCTION environment",
  );

  assert.match(
    source,
    /production-growth-linkedin-rt/,
    "Production deployment unit must use the dedicated Growth LinkedIn runtime identity",
  );

  assert.match(
    source,
    /GROWTH_LINKEDIN_ACCESS_TOKEN/,
    "Production deployment unit must declare the existing LinkedIn secret",
  );

  assert.doesNotMatch(
    source,
    /preview-growth-linkedin-rt|preview-discovery/,
    "Production deployment unit must not reuse Preview identity or codebase",
  );
});

test("shared LinkedIn callable is no longer directly coupled to Preview deployment authority", () => {
  const source = read(
    "functions/src/composition/linkedin/GrowthLinkedInCallableRuntimeV1.ts",
  );

  assert.doesNotMatch(
    source,
    /PREVIEW_DISCOVERY_CALLABLE_OPTIONS_V1/,
    "Shared callable implementation must not directly consume Preview callable options",
  );

  assert.doesNotMatch(
    source,
    /assertPreviewDiscoveryRuntimeV1/,
    "Shared callable implementation must not directly assert Preview runtime",
  );

  assert.match(
    source,
    /createGrowthLinkedInRuntimeReadinessV1/,
    "Shared callable must expose an environment-bound factory",
  );
});

test("Growth runtime card derives its environment from the certified Firebase client runtime", () => {
  const source = read(
    "src/pages/GrowthPage.tsx",
  );

  assert.match(
    source,
    /clientRuntimeEnvironment/,
    "Growth UI must consume clientRuntimeEnvironment",
  );

  assert.doesNotMatch(
    source,
    />Preview</,
    "Growth UI must not hardcode Preview in the runtime card",
  );
});

test("existing Preview deployment boundary remains explicitly Preview-only", () => {
  const source = read(
    "functions/src/discovery/deployment/previewDiscoveryDeploymentUnitV1.ts",
  );

  assert.match(
    source,
    /PREVIEW_DISCOVERY_ENVIRONMENT_V1\s*=\s*"PREVIEW"/,
    "Existing Preview deployment environment must remain explicit",
  );

  assert.match(
    source,
    /PREVIEW_DISCOVERY_PROJECT_ID_V1\s*=\s*"aura-intel-preview"/,
    "Existing Preview project authority must remain unchanged",
  );

  assert.match(
    source,
    /preview-growth-linkedin-rt/,
    "Existing Preview runtime identity must remain unchanged",
  );
});
test("production callable preserves App Check enforcement and Production client initializes App Check", () => {
  const productionConfiguration = read(
    "src/config/productionClientConfigurationV1.ts",
  );

  const firebaseRuntime = read(
    "src/config/firebase.ts",
  );

  const deploymentPath =
    "functions/src/growth/deployment/productionGrowthLinkedInDeploymentUnitV1.ts";

  assert.match(
    productionConfiguration,
    /VITE_RECAPTCHA_SITE_KEY/,
    "Production client configuration must require the App Check site key",
  );

  assert.match(
    productionConfiguration,
    /readonly appCheckEnabled:\s*true/,
    "Production client configuration must explicitly enable App Check",
  );

  assert.match(
    productionConfiguration,
    /readonly recaptchaSiteKey:\s*string/,
    "Production client configuration must expose the App Check site key",
  );

  assert.doesNotMatch(
    firebaseRuntime,
    /clientConfiguration\.environment\s*!==\s*"PREVIEW"/,
    "Firebase App Check initialization must not be restricted to Preview",
  );

  assert.match(
    firebaseRuntime,
    /clientConfiguration\.appCheckEnabled/,
    "Firebase runtime must gate App Check using the certified configuration",
  );

  assert.equal(
    exists(deploymentPath),
    true,
    "Production Growth LinkedIn deployment unit must exist",
  );

  const deployment = read(deploymentPath);

  assert.match(
    deployment,
    /enforceAppCheck:\s*true/,
    "Production Growth LinkedIn callable must enforce App Check",
  );
});