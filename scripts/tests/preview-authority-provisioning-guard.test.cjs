"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const { evaluateAuthorityProvisioningSources, loadAuthorityProvisioningSources } = require("../preview-authority-provisioning-guard.cjs");

const root = path.resolve(__dirname, "..", "..");
const real = () => loadAuthorityProvisioningSources(root);
const first = "src/modules/intelligence/serverAuthorityProvisioning/AuthorityProvisioningService.ts";
const entry = "functions/src/previewDiscoveryIndex.ts";
const adapter = "functions/src/infrastructure/firestore/authorityProvisioning/FirestoreAuthorityProvisioningAdapter.ts";
const types = "src/modules/intelligence/serverAuthorityProvisioning/authorityProvisioningTypes.ts";
function denied(file, text, code) {
  const sources = real();
  sources[file] += `\n${text}`;
  assert.ok(evaluateAuthorityProvisioningSources(sources).includes(code));
}

test("1. accepts the real closed Preview inventory", () => assert.deepEqual(evaluateAuthorityProvisioningSources(real()), []));
test("2. rejects Firebase client SDK", () => denied(first, 'import { getAuth } from "firebase/auth";', "FIREBASE_CLIENT_SDK_FORBIDDEN"));
test("3. rejects React", () => denied(first, 'import React from "react";', "REACT_FORBIDDEN"));
test("4. rejects callable transport", () => denied(first, "onCall(() => null)", "PUBLIC_TRANSPORT_FORBIDDEN"));
test("5. rejects HTTP transport", () => denied(first, "onRequest(() => null)", "PUBLIC_TRANSPORT_FORBIDDEN"));
test("6. rejects Preview Discovery export", () => denied(entry, "export { createPrivatePreviewAuthorityProvisioningCompositionV1 };", "PREVIEW_DISCOVERY_EXPORT_FORBIDDEN"));
test("7. rejects Production identity", () => denied(first, "const project = 'aura-control-center-debb3'", "NON_PREVIEW_REFERENCE_FORBIDDEN"));
test("8. rejects Staging", () => denied(first, "const environment = 'STAGING'", "NON_PREVIEW_REFERENCE_FORBIDDEN"));
test("9. rejects email authority", () => denied(first, "email authority", "EMAIL_AUTHORITY_FORBIDDEN"));
test("10. rejects claims authority", () => denied(first, "rawClaims", "CLAIMS_AUTHORITY_FORBIDDEN"));
test("11. rejects credentials", () => denied(first, "adminCredential", "SECRET_OR_CREDENTIAL_FORBIDDEN"));
test("12. rejects logging", () => denied(first, "console.log(authUid)", "SENSITIVE_LOGGING_SURFACE_FORBIDDEN"));
test("13. rejects ambient randomness", () => denied(first, "Math.random()", "AMBIENT_NONDETERMINISM_FORBIDDEN"));
test("14. rejects global privilege", () => denied(first, "platform.admin", "GLOBAL_PRIVILEGE_FORBIDDEN"));
test("15. rejects broad capability allowlist", () => { const sources = real(); sources[types] = sources[types].replace("Object.freeze([] as const)", "Object.freeze(['admin'] as const)"); assert.ok(evaluateAuthorityProvisioningSources(sources).includes("CAPABILITY_ALLOWLIST_NOT_CLOSED")); });
test("16. rejects extra writes", () => denied(adapter, "transaction.create(extra, {})", "WRITE_SET_NOT_EXACT"));
test("17. rejects update writes", () => denied(adapter, "transaction.update(ref, {})", "UNAUTHORIZED_WRITE_PRIMITIVE"));
