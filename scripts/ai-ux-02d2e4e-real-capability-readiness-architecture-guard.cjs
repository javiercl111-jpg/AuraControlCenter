const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const sourcePath = path.join(
  root,
  "scripts",
  "ai-ux-02d2e4e-real-capability-readiness.mjs",
);

function fail(code) {
  process.stderr.write(`AI_UX_02D2E4E_ARCHITECTURE_GUARD=FAIL ${code}\n`);
  process.exit(1);
}

if (!fs.existsSync(sourcePath)) fail("COMPOSITION_MISSING");
const source = fs.readFileSync(sourcePath, "utf8");

for (const symbol of [
  "RealConsumerBoundaryReadinessAdapterV1",
  "RealCapabilityRotationAuthorityAdapterV1",
  "RealCanaryPolicyRevalidationAdapterV1",
  "OperationalD2E4EFinalCeremonyEntrypointV1",
]) {
  if (!source.includes(`class ${symbol}`)) fail(`SYMBOL_MISSING_${symbol}`);
}

const preflight = source.slice(source.indexOf("async preflight(input)"));
const order = [
  "consumerBoundary.assertReady",
  "rotationAuthority.revalidate",
  "canaryRevalidation.revalidate",
  "this.#runnerFactory",
].map((value) => preflight.indexOf(value));
if (order.some((index) => index < 0) ||
    order.some((index, position) => position > 0 && index <= order[position - 1])) {
  fail("PREFLIGHT_ORDER_INVALID");
}

if (/\bmock\b|\bfixtureRepository\b/iu.test(source)) {
  fail("TEST_DOUBLE_IN_OPERATIONAL_ENTRYPOINT");
}
if (/environment:\s*["'](?:PRODUCTION|STAGING)["']/u.test(source)) {
  fail("NON_PREVIEW_TARGET_AVAILABLE");
}
const beforeRunner = preflight.slice(0, preflight.indexOf("this.#runnerFactory"));
if (/\.rotate\s*\(|\.activateImmutable\s*\(|\.deployOnce\s*\(/u.test(beforeRunner)) {
  fail("REMOTE_WRITE_IN_PREFLIGHT");
}

process.stdout.write("AI_UX_02D2E4E_ARCHITECTURE_GUARD=PASS\n");
