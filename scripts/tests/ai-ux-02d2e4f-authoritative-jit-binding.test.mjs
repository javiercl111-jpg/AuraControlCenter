import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  AuthoritativeJitFixtureSessionBindingResolverV1,
} from "../ai-ux-02d2e4f-authoritative-jit-binding.mjs";
import {
  assertAuthorityReceiptV1,
  assertRuntimeErrorV1,
  createAuthorityReceiptV1,
} from "../ai-ux-02d2e4x-policy-readiness-contract-v1.mjs";

const NOW = Date.parse("2026-08-12T20:00:00.000Z");
const FIXTURE = "SYNTHETIC_FIXTURE_V1_8E5D766A3132FF687116E522304115BE";
const TENANT = `tenant-${"ab".repeat(32)}`;
const TRACE = "trace-d2e4f-binding-test";
const authority = createAuthorityReceiptV1({
  receiptId: "authority-receipt-d2e4f-test",
  projectId: "aura-intel-preview",
  authoritativeTenantId: TENANT,
  authoritativeTenantLocator: TENANT,
  syntheticFixtureLocator: FIXTURE,
  intentClass: "DISCOVER_PROBLEM",
  linkId: "synthetic_link_authoritative_7f2d0a1c",
  sessionId: "dossier_synthetic_f0665b7f36af71731b839249759f49c27166f26e_g1",
  turnId: "AI_UX_02D3_CANARY_TURN_0001",
  evidenceDigest: "11".repeat(32),
  certifiedAtMs: NOW - 1_000,
  expiresAtMs: NOW + 60_000,
});
const input = Object.freeze({
  authoritativeTenantId: TENANT,
  syntheticFixtureLocator: FIXTURE,
  intentClass: "DISCOVER_PROBLEM",
  turnId: "AI_UX_02D3_CANARY_TURN_0001",
  traceId: TRACE,
  now: NOW,
});

function resolver(overrides = {}) {
  let writes = 0;
  const events = [];
  const instance = new AuthoritativeJitFixtureSessionBindingResolverV1({
    authorityFactory(received) {
      events.push("authority.resolve");
      assert.deepEqual(received, {
        authoritativeTenantId: TENANT,
        syntheticFixtureLocator: FIXTURE,
        intentClass: "DISCOVER_PROBLEM",
        turnId: overrides.requestTurn ?? input.turnId,
        traceId: TRACE,
      });
      return overrides.authority ?? authority;
    },
    assertCertifiedAuthority(received, options) {
      events.push("authority.assert");
      assert.equal(received, overrides.authority ?? authority);
      assert.equal(options.atMs, NOW);
      assert.equal(options.traceId, TRACE);
      return assertAuthorityReceiptV1(received, { atMs: options.atMs });
    },
    rotationRepository: {
      async inspectExpired(received, now, context) {
        events.push("repository.inspectExpired");
        assert.equal(received, overrides.authority ?? authority);
        assert.equal(now, NOW);
        assert.equal(context.traceId, TRACE);
        return overrides.expectation ?? {
          capabilityLocator: "capability_authoritative_v1",
        };
      },
      async rotate() { writes += 1; },
    },
  });
  return { instance, events, writes: () => writes };
}

test("resolves exact fixture, tenant, link, and session through certified authority", async () => {
  const subject = resolver();
  const result = await subject.instance.resolve(input);
  assert.equal(result.status, "RESOLVED");
  assert.deepEqual(result.binding, {
    authoritativeTenantId: TENANT,
    authoritativeTenantLocator: TENANT,
    syntheticFixtureLocator: FIXTURE,
    intentClass: "DISCOVER_PROBLEM",
    linkId: authority.linkId,
    sessionId: authority.sessionId,
    turnId: authority.turnId,
  });
  assert.deepEqual(subject.events, [
    "authority.resolve",
    "authority.assert",
    "repository.inspectExpired",
  ]);
  assert.equal(subject.writes(), 0);
});

test("fails closed when repository cannot prove the existing binding", async () => {
  const subject = resolver({ expectation: {} });
  await assert.rejects(() => subject.instance.resolve(input), (error) => {
    assert.equal(error.code, "D2E4F_REPOSITORY_BINDING_NOT_FOUND");
    assert.equal(assertRuntimeErrorV1(error), error);
    return true;
  });
  assert.equal(subject.writes(), 0);
});

test("fails closed when authority omits the certified session", async () => {
  const subject = resolver({
    authority: Object.freeze({ ...authority, sessionId: undefined }),
  });
  await assert.rejects(() => subject.instance.resolve(input),
    /D2E4F_AUTHORITATIVE_BINDING_REJECTED/u);
  assert.deepEqual(subject.events, [
    "authority.resolve",
  ]);
});

test("fails closed when caller attempts to substitute the certified turn", async () => {
  const subject = resolver({
    requestTurn: "AI_UX_02D3_CANARY_TURN_0002",
  });
  await assert.rejects(
    () => subject.instance.resolve({
      ...input,
      turnId: "AI_UX_02D3_CANARY_TURN_0002",
    }),
    /D2E4F_AUTHORITATIVE_BINDING_REJECTED/u,
  );
  assert.deepEqual(subject.events, ["authority.resolve"]);
});

test("operational bootstrap path contains no legacy fixed link/session IDs", async () => {
  const files = await Promise.all([
    readFile(new URL("../../src/modules/discovery/security/authorizedJitBootstrapV1.ts", import.meta.url), "utf8"),
    readFile(new URL("../ai-ux-02d2e4-preview-ceremony-controller.mjs", import.meta.url), "utf8"),
    readFile(new URL("../ai-ux-02d2e4-final-preview-ceremony.mjs", import.meta.url), "utf8"),
    readFile(new URL("../ai-ux-02d2e4e-real-capability-readiness.mjs", import.meta.url), "utf8"),
  ]);
  const source = files.join("\n");
  assert.doesNotMatch(source,
    /ai-ux-02d3-preview-synthetic-discovery-(?:link|session)-v1/u);
  assert.doesNotMatch(source, /AUTHORIZED_JIT_BOOTSTRAP_SCOPE_V1/u);
});
