"use strict";

const fs = require("node:fs");
const path = require("node:path");

const SOURCE_FILES = Object.freeze([
  "src/modules/intelligence/serverAuthorityProvisioning/authorityProvisioningTypes.ts",
  "src/modules/intelligence/serverAuthorityProvisioning/authorityProvisioningPorts.ts",
  "src/modules/intelligence/serverAuthorityProvisioning/authorityProvisioningValidators.ts",
  "src/modules/intelligence/serverAuthorityProvisioning/AuthorityProvisioningService.ts",
  "functions/src/infrastructure/firestore/authorityProvisioning/FirestoreAuthorityProvisioningAdapter.ts",
  "functions/src/composition/authorityProvisioning/previewAuthorityProvisioningComposition.ts",
  "functions/src/previewDiscoveryIndex.ts",
]);

function add(errors, code) {
  if (!errors.includes(code)) errors.push(code);
}

function evaluateAuthorityProvisioningSources(sourceTexts) {
  const errors = [];
  const implementation = SOURCE_FILES.slice(0, -1).map((file) => sourceTexts[file] || "").join("\n");
  const entrypoint = sourceTexts["functions/src/previewDiscoveryIndex.ts"] || "";
  const adapter = sourceTexts["functions/src/infrastructure/firestore/authorityProvisioning/FirestoreAuthorityProvisioningAdapter.ts"] || "";
  const types = sourceTexts["src/modules/intelligence/serverAuthorityProvisioning/authorityProvisioningTypes.ts"] || "";

  if (/from\s+["']firebase(?:\/|["'])|firebase\/app|firebase\/auth/iu.test(implementation)) add(errors, "FIREBASE_CLIENT_SDK_FORBIDDEN");
  if (/from\s+["']react["']|React\./u.test(implementation)) add(errors, "REACT_FORBIDDEN");
  if (/\bonCall\b|\bonRequest\b|https\.on|express\s*\(/u.test(implementation)) add(errors, "PUBLIC_TRANSPORT_FORBIDDEN");
  if (/AuthorityProvisioning|authorityProvisioning/u.test(entrypoint)) add(errors, "PREVIEW_DISCOVERY_EXPORT_FORBIDDEN");
  if (/["']aura-control-center-debb3|["'](?:STAGING|PRODUCTION)["']/iu.test(implementation)) add(errors, "NON_PREVIEW_REFERENCE_FORBIDDEN");
  if (/\bemail\b.*(?:authority|principal|tenant)|(?:authority|principal|tenant).*\bemail\b/iu.test(implementation)) add(errors, "EMAIL_AUTHORITY_FORBIDDEN");
  if (/customClaims|rawClaims|claims\s*:/iu.test(implementation)) add(errors, "CLAIMS_AUTHORITY_FORBIDDEN");
  if (/private[_-]?key|client[_-]?secret|access[_-]?token|refresh[_-]?token|admin[_-]?credential/iu.test(implementation)) add(errors, "SECRET_OR_CREDENTIAL_FORBIDDEN");
  if (/console\.|logger\.|functions\.logger/iu.test(implementation)) add(errors, "SENSITIVE_LOGGING_SURFACE_FORBIDDEN");
  if (/Date\.now\s*\(|Math\.random\s*\(|randomUUID\s*\(/u.test(implementation)) add(errors, "AMBIENT_NONDETERMINISM_FORBIDDEN");
  if (/platform\.admin|super[_-]?admin|globalRole|roles\s*:/iu.test(implementation)) add(errors, "GLOBAL_PRIVILEGE_FORBIDDEN");
  if (!/PREVIEW_DISCOVERY_AUTHORITY_CAPABILITIES\s*=\s*Object\.freeze\(\[\]\s+as const\)/u.test(types)) add(errors, "CAPABILITY_ALLOWLIST_NOT_CLOSED");
  for (const collection of ["platform_global_admins", "platform_tenants", "tenant_memberships", "authority_audit_events"]) {
    if (!adapter.includes(`\"${collection}\"`)) add(errors, "REQUIRED_COLLECTION_MISSING");
  }
  if ((adapter.match(/transaction\.create\s*\(/gu) || []).length !== 4) add(errors, "WRITE_SET_NOT_EXACT");
  if (/\.set\s*\(|\.update\s*\(|\.delete\s*\(|bulkWriter|batch\s*\(/u.test(adapter)) add(errors, "UNAUTHORIZED_WRITE_PRIMITIVE");
  return errors;
}

function loadAuthorityProvisioningSources(repositoryRoot) {
  return Object.fromEntries(SOURCE_FILES.map((file) => [file, fs.readFileSync(path.join(repositoryRoot, file), "utf8")]));
}

function runCli() {
  const root = path.resolve(__dirname, "..");
  const errors = evaluateAuthorityProvisioningSources(loadAuthorityProvisioningSources(root));
  if (errors.length > 0) {
    console.error(`PREVIEW_AUTHORITY_PROVISIONING_GUARD_FAILED:${errors.join(",")}`);
    process.exitCode = 1;
    return;
  }
  console.log("PREVIEW_AUTHORITY_PROVISIONING_GUARD_PASS");
}

if (require.main === module) runCli();
module.exports = { SOURCE_FILES, evaluateAuthorityProvisioningSources, loadAuthorityProvisioningSources };
