import { createRequire } from "node:module";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import { deleteApp, initializeApp, type FirebaseApp } from "firebase/app";
import {
  connectFirestoreEmulator,
  doc,
  getDoc,
  getFirestore,
  setDoc,
  updateDoc,
} from "firebase/firestore";

const PROJECT_ID = "demo-aura-preview-rules";
const require = createRequire(import.meta.url);
const admin = require("../../../node_modules/firebase-admin");

let adminApp: ReturnType<typeof admin.initializeApp>;
let adminFirestore: ReturnType<typeof admin.firestore>;
const clientApps: FirebaseApp[] = [];

function emulatorAddress(): Readonly<{ host: string; port: number }> {
  const value = process.env.FIRESTORE_EMULATOR_HOST;
  if (!value) throw new Error("FIRESTORE_EMULATOR_HOST is required.");
  const separator = value.lastIndexOf(":");
  return Object.freeze({
    host: value.slice(0, separator),
    port: Number(value.slice(separator + 1)),
  });
}

function client(
  uid?: string,
  claims: Readonly<Record<string, unknown>> = {},
) {
  const app = initializeApp(
    {
      apiKey: "demo-api-key",
      appId: "demo-preview-rules-app",
      projectId: PROJECT_ID,
    },
    `preview-rules-${clientApps.length}-${crypto.randomUUID()}`,
  );
  clientApps.push(app);
  const firestore = getFirestore(app);
  const { host, port } = emulatorAddress();
  connectFirestoreEmulator(
    firestore,
    host,
    port,
    uid === undefined
      ? undefined
      : { mockUserToken: { sub: uid, user_id: uid, ...claims } },
  );
  return firestore;
}

async function clearFirestore(): Promise<void> {
  const response = await fetch(
    `http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`,
    { method: "DELETE" },
  );
  if (!response.ok) {
    throw new Error(`Could not clear Firestore emulator: ${response.status}`);
  }
}

async function seed(path: string, value: Readonly<Record<string, unknown>>) {
  await adminFirestore.doc(path).set(value);
}

async function expectDenied(operation: Promise<unknown>): Promise<void> {
  await expect(operation).rejects.toMatchObject({ code: "permission-denied" });
}

beforeAll(() => {
  expect(PROJECT_ID.startsWith("demo-")).toBe(true);
  expect(process.env.GOOGLE_APPLICATION_CREDENTIALS).toBeUndefined();
  adminApp = admin.initializeApp({ projectId: PROJECT_ID }, "preview-rules-baseline");
  adminFirestore = admin.firestore(adminApp);
});

beforeEach(async () => {
  await clearFirestore();
});

afterEach(async () => {
  await Promise.all(clientApps.splice(0).map((app) => deleteApp(app)));
});

afterAll(async () => {
  await clearFirestore();
  await adminApp.delete();
});

describe("Preview Firestore Rules fail-closed baseline", () => {
  it("denies an unauthenticated platform administrator write", async () => {
    const firestore = client();
    await expectDenied(setDoc(doc(firestore, "platform_global_admins/admin-a"), {
      isActive: true,
      role: "SUPER_ADMIN",
    }));
  });

  it("denies an ordinary authenticated platform administrator write", async () => {
    const firestore = client("ordinary-user");
    await expectDenied(setDoc(doc(firestore, "platform_global_admins/ordinary-user"), {
      isActive: true,
      role: "SUPER_ADMIN",
    }));
  });

  it("denies a forged SUPER_ADMIN custom claim", async () => {
    const firestore = client("forged-admin", { role: "SUPER_ADMIN" });
    await expectDenied(getDoc(doc(firestore, "platform_tenants/tenant-a")));
  });

  it("denies direct platform tenant writes", async () => {
    const firestore = client("ordinary-user");
    await expectDenied(setDoc(doc(firestore, "platform_tenants/tenant-a"), {
      status: "ACTIVE",
    }));
  });

  it("denies direct rate-limit counter writes", async () => {
    const firestore = client("ordinary-user");
    await expectDenied(setDoc(doc(firestore, "public_rate_limit_counters_v1/counter-a"), {
      count: 0,
    }));
  });

  it("denies direct idempotency writes", async () => {
    const firestore = client("ordinary-user");
    await expectDenied(setDoc(doc(firestore, "discovery_intake_idempotency/key-a"), {
      status: "COMPLETED",
    }));
  });

  it("denies direct capability mutation", async () => {
    await seed("discovery_capabilities_v1/capability-a", { status: "ACTIVE" });
    const firestore = client("ordinary-user");
    await expectDenied(updateDoc(doc(firestore, "discovery_capabilities_v1/capability-a"), {
      status: "CONSUMED",
    }));
  });

  it("denies server-owned Discovery field mutation even to an active admin", async () => {
    await seed("platform_global_admins/admin-a", { isActive: true, role: "SUPER_ADMIN" });
    await seed("discovery_sessions/session-a", { tenantId: "tenant-a", status: "OPEN" });
    const firestore = client("admin-a");
    await expectDenied(updateDoc(doc(firestore, "discovery_sessions/session-a"), {
      status: "COMPLETED",
    }));
  });

  it("denies cross-tenant reads without canonical authority", async () => {
    await seed("platform_tenants/tenant-b", { status: "ACTIVE" });
    const firestore = client("tenant-a-user", { tenantId: "tenant-a" });
    await expectDenied(getDoc(doc(firestore, "platform_tenants/tenant-b")));
  });

  it("denies unknown collections by default", async () => {
    const firestore = client("ordinary-user");
    await expectDenied(setDoc(doc(firestore, "unrecognized_collection/document-a"), {
      value: true,
    }));
  });

  it("defines no public Firestore read path in the Preview baseline", async () => {
    await seed("platform_sales_advisors/advisor-a", { active: true });
    const firestore = client();
    await expectDenied(getDoc(doc(firestore, "platform_sales_advisors/advisor-a")));
  });

  it("allows a subject to read only its backend-owned inbox", async () => {
    await seed("platform_inbox/user-a", { unreadCount: 1 });
    await seed("platform_inbox/user-b", { unreadCount: 2 });
    const firestore = client("user-a");
    expect((await getDoc(doc(firestore, "platform_inbox/user-a"))).data()).toEqual({
      unreadCount: 1,
    });
    await expectDenied(getDoc(doc(firestore, "platform_inbox/user-b")));
  });

  it("allows canonical active-admin reads without granting client writes", async () => {
    await seed("platform_global_admins/admin-a", { isActive: true, role: "SUPER_ADMIN" });
    await seed("platform_tenants/tenant-a", { status: "ACTIVE" });
    const firestore = client("admin-a", { role: "VIEWER" });
    expect((await getDoc(doc(firestore, "platform_global_admins/admin-a"))).data()).toMatchObject({
      isActive: true,
      role: "SUPER_ADMIN",
    });
    expect((await getDoc(doc(firestore, "platform_tenants/tenant-a"))).data()).toEqual({
      status: "ACTIVE",
    });
  });

  it("preserves the Admin SDK backend path", async () => {
    await seed("discovery_sessions/session-admin", { status: "OPEN" });
    await adminFirestore.doc("discovery_sessions/session-admin").update({
      status: "COMPLETED",
    });
    expect((await adminFirestore.doc("discovery_sessions/session-admin").get()).data()).toEqual({
      status: "COMPLETED",
    });
  });
});
