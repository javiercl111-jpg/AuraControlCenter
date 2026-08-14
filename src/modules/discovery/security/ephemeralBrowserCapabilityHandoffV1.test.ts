import { describe, expect, it } from "vitest";

import { EphemeralBrowserCapabilityHandoffV1 } from "./ephemeralBrowserCapabilityHandoffV1";

const SESSION_BEARER = "a".repeat(64);
const REPORT_BEARER = "b".repeat(64);

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe("EphemeralBrowserCapabilityHandoffV1", () => {
  it("starts without a session capability", () => {
    expect(new EphemeralBrowserCapabilityHandoffV1().has("SESSION")).toBe(false);
  });

  it("starts without a report capability", () => {
    expect(new EphemeralBrowserCapabilityHandoffV1().has("REPORT")).toBe(false);
  });

  it("accepts a session capability in memory", () => {
    const handoff = new EphemeralBrowserCapabilityHandoffV1();
    handoff.accept("SESSION", SESSION_BEARER);
    expect(handoff.has("SESSION")).toBe(true);
  });

  it("accepts a report capability independently", () => {
    const handoff = new EphemeralBrowserCapabilityHandoffV1();
    handoff.accept("REPORT", REPORT_BEARER);
    expect(handoff.has("REPORT")).toBe(true);
    expect(handoff.has("SESSION")).toBe(false);
  });

  it("rejects an empty bearer", () => {
    const handoff = new EphemeralBrowserCapabilityHandoffV1();
    expect(() => handoff.accept("SESSION", "")).toThrow("EPHEMERAL_CAPABILITY_REQUIRED");
  });

  it("rejects a whitespace-only bearer", () => {
    const handoff = new EphemeralBrowserCapabilityHandoffV1();
    expect(() => handoff.accept("SESSION", "   ")).toThrow("EPHEMERAL_CAPABILITY_REQUIRED");
  });

  it("rejects replacement while a capability is present", () => {
    const handoff = new EphemeralBrowserCapabilityHandoffV1();
    handoff.accept("SESSION", SESSION_BEARER);
    expect(() => handoff.accept("SESSION", REPORT_BEARER)).toThrow("EPHEMERAL_CAPABILITY_ALREADY_PRESENT");
  });

  it("rejects use when no capability is available", async () => {
    const handoff = new EphemeralBrowserCapabilityHandoffV1();
    await expect(handoff.execute("SESSION", async () => "unused")).rejects.toThrow("EPHEMERAL_CAPABILITY_UNAVAILABLE");
  });

  it("supplies the bearer only to the authorized operation", async () => {
    const handoff = new EphemeralBrowserCapabilityHandoffV1();
    handoff.accept("SESSION", SESSION_BEARER);
    const received = await handoff.execute("SESSION", async (requestBearer) => requestBearer);
    expect(received).toBe(SESSION_BEARER);
  });

  it("normalizes surrounding whitespace before a request", async () => {
    const handoff = new EphemeralBrowserCapabilityHandoffV1();
    handoff.accept("SESSION", ` ${SESSION_BEARER} `);
    const received = await handoff.execute("SESSION", async (requestBearer) => requestBearer);
    expect(received).toBe(SESSION_BEARER);
  });

  it("discards a capability after terminal success", async () => {
    const handoff = new EphemeralBrowserCapabilityHandoffV1();
    handoff.accept("SESSION", SESSION_BEARER);
    await handoff.execute("SESSION", async () => "complete");
    expect(handoff.has("SESSION")).toBe(false);
  });

  it("retains a session lease only when explicitly authorized", async () => {
    const handoff = new EphemeralBrowserCapabilityHandoffV1();
    handoff.accept("SESSION", SESSION_BEARER);
    await handoff.execute("SESSION", async () => ({ ok: true }), {
      retainAfterSuccess: (result) => result.ok,
    });
    expect(handoff.has("SESSION")).toBe(true);
  });

  it("discards a capability when the result is terminal", async () => {
    const handoff = new EphemeralBrowserCapabilityHandoffV1();
    handoff.accept("SESSION", SESSION_BEARER);
    await handoff.execute("SESSION", async () => ({ ok: false }), {
      retainAfterSuccess: (result) => result.ok,
    });
    expect(handoff.has("SESSION")).toBe(false);
  });

  it("fails closed after a rejected request", async () => {
    const handoff = new EphemeralBrowserCapabilityHandoffV1();
    handoff.accept("SESSION", SESSION_BEARER);
    await expect(handoff.execute("SESSION", async () => {
      throw new Error("NETWORK_UNCERTAIN");
    })).rejects.toThrow("NETWORK_UNCERTAIN");
    expect(handoff.has("SESSION")).toBe(false);
  });

  it("fails closed when the retention classifier throws", async () => {
    const handoff = new EphemeralBrowserCapabilityHandoffV1();
    handoff.accept("SESSION", SESSION_BEARER);
    await expect(handoff.execute("SESSION", async () => "result", {
      retainAfterSuccess: () => {
        throw new Error("CLASSIFICATION_FAILED");
      },
    })).rejects.toThrow("CLASSIFICATION_FAILED");
    expect(handoff.has("SESSION")).toBe(false);
  });

  it("blocks a duplicate request while one is in flight", async () => {
    const handoff = new EphemeralBrowserCapabilityHandoffV1();
    const pending = deferred<string>();
    handoff.accept("SESSION", SESSION_BEARER);
    const first = handoff.execute("SESSION", () => pending.promise);
    await expect(handoff.execute("SESSION", async () => "duplicate")).rejects.toThrow("EPHEMERAL_CAPABILITY_USE_IN_FLIGHT");
    pending.resolve("done");
    await first;
  });

  it("reports in-flight state only during execution", async () => {
    const handoff = new EphemeralBrowserCapabilityHandoffV1();
    const pending = deferred<string>();
    handoff.accept("SESSION", SESSION_BEARER);
    const request = handoff.execute("SESSION", () => pending.promise);
    expect(handoff.isInFlight("SESSION")).toBe(true);
    pending.resolve("done");
    await request;
    expect(handoff.isInFlight("SESSION")).toBe(false);
  });

  it("rejects replacement while a request is in flight", async () => {
    const handoff = new EphemeralBrowserCapabilityHandoffV1();
    const pending = deferred<string>();
    handoff.accept("SESSION", SESSION_BEARER);
    const request = handoff.execute("SESSION", () => pending.promise, { retainAfterSuccess: () => true });
    expect(() => handoff.accept("SESSION", REPORT_BEARER)).toThrow("EPHEMERAL_CAPABILITY_ALREADY_PRESENT");
    pending.resolve("done");
    await request;
  });

  it("allows independent session and report requests", async () => {
    const handoff = new EphemeralBrowserCapabilityHandoffV1();
    handoff.accept("SESSION", SESSION_BEARER);
    handoff.accept("REPORT", REPORT_BEARER);
    const values = await Promise.all([
      handoff.execute("SESSION", async (value) => value),
      handoff.execute("REPORT", async (value) => value),
    ]);
    expect(values).toEqual([SESSION_BEARER, REPORT_BEARER]);
  });

  it("clears one capability without affecting the other", () => {
    const handoff = new EphemeralBrowserCapabilityHandoffV1();
    handoff.accept("SESSION", SESSION_BEARER);
    handoff.accept("REPORT", REPORT_BEARER);
    handoff.clear("SESSION");
    expect(handoff.has("SESSION")).toBe(false);
    expect(handoff.has("REPORT")).toBe(true);
  });

  it("clear is idempotent", () => {
    const handoff = new EphemeralBrowserCapabilityHandoffV1();
    handoff.clear("SESSION");
    handoff.clear("SESSION");
    expect(handoff.has("SESSION")).toBe(false);
  });

  it("clearAll discards every capability", () => {
    const handoff = new EphemeralBrowserCapabilityHandoffV1();
    handoff.accept("SESSION", SESSION_BEARER);
    handoff.accept("REPORT", REPORT_BEARER);
    handoff.clearAll();
    expect(handoff.has("SESSION")).toBe(false);
    expect(handoff.has("REPORT")).toBe(false);
  });

  it("a new instance cannot resume an earlier instance", () => {
    const first = new EphemeralBrowserCapabilityHandoffV1();
    first.accept("SESSION", SESSION_BEARER);
    const remounted = new EphemeralBrowserCapabilityHandoffV1();
    expect(remounted.has("SESSION")).toBe(false);
  });

  it("does not reveal private custody through JSON serialization", () => {
    const handoff = new EphemeralBrowserCapabilityHandoffV1();
    handoff.accept("SESSION", SESSION_BEARER);
    expect(JSON.stringify(handoff)).toBe("{}");
    expect(JSON.stringify(handoff)).not.toContain(SESSION_BEARER);
  });

  it("does not reveal private custody through object spread", () => {
    const handoff = new EphemeralBrowserCapabilityHandoffV1();
    handoff.accept("SESSION", SESSION_BEARER);
    expect({ ...handoff }).toEqual({});
  });

  it("can accept a newly issued capability only after explicit clearing", () => {
    const handoff = new EphemeralBrowserCapabilityHandoffV1();
    handoff.accept("SESSION", SESSION_BEARER);
    handoff.clear("SESSION");
    handoff.accept("SESSION", REPORT_BEARER);
    expect(handoff.has("SESSION")).toBe(true);
  });

  it("clearing during an uncertain request prevents later restoration", async () => {
    const handoff = new EphemeralBrowserCapabilityHandoffV1();
    const pending = deferred<string>();
    handoff.accept("SESSION", SESSION_BEARER);
    const request = handoff.execute("SESSION", () => pending.promise, { retainAfterSuccess: () => true });
    handoff.clear("SESSION");
    pending.resolve("late-success");
    await request;
    expect(handoff.has("SESSION")).toBe(false);
  });

  it("never exposes capability material in availability errors", async () => {
    const handoff = new EphemeralBrowserCapabilityHandoffV1();
    await expect(handoff.execute("REPORT", async () => REPORT_BEARER)).rejects.not.toThrow(REPORT_BEARER);
  });
});
