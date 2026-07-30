import fs from "node:fs";
import path from "node:path";
import { getApps } from "firebase-admin/app";
import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createAuthorityDarkCompositionV1,
} from "../src/composition/authorityDarkComposition";
import {
  AuthorityDarkCompositionError,
  type AuthorityDarkCompositionErrorCode,
} from "../src/composition/authorityDarkComposition/authorityDarkCompositionErrors";
import {
  createAuthorityDarkCompositionTestCapabilityForInternalTests,
} from "../src/composition/authorityDarkComposition/authorityDarkCompositionTestCapability";

const DEMO_PROJECT_ID = "demo-authority-dark-composition";
const EMULATOR_HOST = "127.0.0.1:8088";

function createFirestoreDouble(
  access?: () => void,
): Readonly<Record<string, unknown>> {
  return Object.freeze({
    collection(): never {
      access?.();
      throw new Error("Firestore must not be opened by composition.");
    },
    runTransaction(): never {
      access?.();
      throw new Error(
        "A transaction must not start during composition.",
      );
    },
  });
}

function createClock(access?: () => void) {
  return Object.freeze({
    nowIso(): string {
      access?.();
      return "2026-07-30T12:00:00.000Z";
    },
  });
}

function validTestOnlyInput(
  overrides: Readonly<Record<string, unknown>> = {},
): Readonly<Record<string, unknown>> {
  return Object.freeze({
    mode: "TEST_ONLY",
    firestore: createFirestoreDouble(),
    clock: createClock(),
    emulatorHost: EMULATOR_HOST,
    projectId: DEMO_PROJECT_ID,
    capability:
      createAuthorityDarkCompositionTestCapabilityForInternalTests(),
    ...overrides,
  });
}

function expectCompositionError(
  input: unknown,
  code: AuthorityDarkCompositionErrorCode,
): void {
  expect(() => createAuthorityDarkCompositionV1(input)).toThrow(
    expect.objectContaining({
      name: "AuthorityDarkCompositionError",
      code,
    }),
  );
}

function listTypeScriptFiles(directory: string): readonly string[] {
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return listTypeScriptFiles(entryPath);
      }
      return entry.isFile() && entry.name.endsWith(".ts")
        ? [entryPath]
        : [];
    });
}

describe("Authority Dark Composition disabled mode", () => {
  it("returns an inert closed composition with a null repository", () => {
    expect(
      createAuthorityDarkCompositionV1({ mode: "DISABLED" }),
    ).toEqual({
      version: "1",
      mode: "DISABLED",
      status: "INERT",
      repository: null,
    });
  });

  it("does not access Firestore or clock while rejecting ambiguous dependencies", () => {
    let firestoreAccesses = 0;
    let clockCalls = 0;
    const input = {
      mode: "DISABLED",
      firestore: createFirestoreDouble(() => {
        firestoreAccesses += 1;
      }),
      clock: createClock(() => {
        clockCalls += 1;
      }),
    };

    expectCompositionError(
      input,
      "AUTHORITY_DARK_COMPOSITION_AMBIGUOUS_DISABLED_INPUT",
    );
    expect(firestoreAccesses).toBe(0);
    expect(clockCalls).toBe(0);
  });

  it.each([
    undefined,
    null,
    true,
    "TEST_ONLY",
    { mode: "ACTIVE" },
    { mode: "PRODUCTION" },
    { mode: "LIVE" },
    { mode: "SHADOW_WRITE" },
  ])("rejects unknown or non-record input %#", (input) => {
    expect(() =>
      createAuthorityDarkCompositionV1(input),
    ).toThrow(AuthorityDarkCompositionError);
  });
});

describe("Authority Dark Composition TEST_ONLY capability", () => {
  it("requires the explicit internal capability", () => {
    expectCompositionError(
      validTestOnlyInput({ capability: undefined }),
      "AUTHORITY_DARK_COMPOSITION_TEST_CAPABILITY_REQUIRED",
    );
    expectCompositionError(
      validTestOnlyInput({ capability: true }),
      "AUTHORITY_DARK_COMPOSITION_TEST_CAPABILITY_REQUIRED",
    );
  });

  it("cannot reconstruct the capability from a serialized payload", () => {
    const capability =
      createAuthorityDarkCompositionTestCapabilityForInternalTests();
    const serialized: unknown = JSON.parse(
      JSON.stringify(capability),
    );

    expect(serialized).toEqual({});
    expectCompositionError(
      validTestOnlyInput({ capability: serialized }),
      "AUTHORITY_DARK_COMPOSITION_TEST_CAPABILITY_REQUIRED",
    );
  });

  it("does not export the capability constructor from the public directory index", () => {
    const publicExports = fs.readFileSync(
      path.resolve(
        __dirname,
        "../src/composition/authorityDarkComposition/index.ts",
      ),
      "utf8",
    );
    expect(publicExports).not.toContain(
      "createAuthorityDarkCompositionTestCapabilityForInternalTests",
    );
  });
});

describe("Authority Dark Composition TEST_ONLY validation", () => {
  it("requires an injected Firestore Admin-compatible instance", () => {
    expectCompositionError(
      validTestOnlyInput({ firestore: undefined }),
      "AUTHORITY_DARK_COMPOSITION_FIRESTORE_REQUIRED",
    );
    expectCompositionError(
      validTestOnlyInput({ firestore: {} }),
      "AUTHORITY_DARK_COMPOSITION_FIRESTORE_REQUIRED",
    );
  });

  it("requires an injected authority clock", () => {
    expectCompositionError(
      validTestOnlyInput({ clock: undefined }),
      "AUTHORITY_DARK_COMPOSITION_CLOCK_REQUIRED",
    );
    expectCompositionError(
      validTestOnlyInput({ clock: {} }),
      "AUTHORITY_DARK_COMPOSITION_CLOCK_REQUIRED",
    );
  });

  it.each([
    [
      undefined,
      "AUTHORITY_DARK_COMPOSITION_EMULATOR_HOST_REQUIRED",
    ],
    [
      "firestore.internal:8080",
      "AUTHORITY_DARK_COMPOSITION_EMULATOR_HOST_INVALID",
    ],
    [
      "http://127.0.0.1:8080",
      "AUTHORITY_DARK_COMPOSITION_EMULATOR_HOST_INVALID",
    ],
    [
      "127.0.0.1:8080/path",
      "AUTHORITY_DARK_COMPOSITION_EMULATOR_HOST_INVALID",
    ],
    [
      "127.0.0.1",
      "AUTHORITY_DARK_COMPOSITION_EMULATOR_HOST_INVALID",
    ],
    [
      "localhost:8080",
      "AUTHORITY_DARK_COMPOSITION_EMULATOR_HOST_INVALID",
    ],
    [
      "127.0.0.1:65536",
      "AUTHORITY_DARK_COMPOSITION_EMULATOR_HOST_INVALID",
    ],
  ] as const)(
    "rejects unsafe emulator host %#",
    (emulatorHost, code) => {
      expectCompositionError(
        validTestOnlyInput({ emulatorHost }),
        code,
      );
    },
  );

  it.each([
    [
      undefined,
      "AUTHORITY_DARK_COMPOSITION_DEMO_PROJECT_REQUIRED",
    ],
    [
      "authority-production",
      "AUTHORITY_DARK_COMPOSITION_DEMO_PROJECT_INVALID",
    ],
    [
      "demo-",
      "AUTHORITY_DARK_COMPOSITION_DEMO_PROJECT_INVALID",
    ],
    [
      "demo_Authority",
      "AUTHORITY_DARK_COMPOSITION_DEMO_PROJECT_INVALID",
    ],
  ] as const)(
    "rejects unsafe project ID %#",
    (projectId, code) => {
      expectCompositionError(
        validTestOnlyInput({ projectId }),
        code,
      );
    },
  );

  it("rejects production credentials whenever the snapshot contains the key", () => {
    for (const credentialValue of [
      "",
      "/credential.json",
      undefined,
    ]) {
      expectCompositionError(
        validTestOnlyInput({
          environmentSnapshot: {
            GOOGLE_APPLICATION_CREDENTIALS:
              credentialValue,
          },
        }),
        "AUTHORITY_DARK_COMPOSITION_CREDENTIALS_FORBIDDEN",
      );
    }
  });

  it("rejects unknown input and environment keys", () => {
    expectCompositionError(
      validTestOnlyInput({ enabled: true }),
      "AUTHORITY_DARK_COMPOSITION_INVALID_INPUT",
    );
    expectCompositionError(
      validTestOnlyInput({
        environmentSnapshot: { REMOTE_FLAG: "on" },
      }),
      "AUTHORITY_DARK_COMPOSITION_INVALID_INPUT",
    );
  });
});

describe("Authority Dark Composition construction", () => {
  it("returns only a ready repository port without opening dependencies", () => {
    let firestoreAccesses = 0;
    let clockCalls = 0;
    const appCountBefore = getApps().length;
    const composition = createAuthorityDarkCompositionV1(
      validTestOnlyInput({
        firestore: createFirestoreDouble(() => {
          firestoreAccesses += 1;
        }),
        clock: createClock(() => {
          clockCalls += 1;
        }),
      }),
    );

    expect(composition).toMatchObject({
      version: "1",
      mode: "TEST_ONLY",
      status: "READY_FOR_TEST",
    });
    if (composition.mode !== "TEST_ONLY") {
      throw new Error("Expected TEST_ONLY composition.");
    }
    expect(typeof composition.repository.execute).toBe(
      "function",
    );
    expect(Object.keys(composition)).toEqual([
      "version",
      "mode",
      "status",
      "repository",
    ]);
    expect("firestore" in composition).toBe(false);
    expect("app" in composition).toBe(false);
    expect("credential" in composition).toBe(false);
    expect("execute" in composition).toBe(false);
    expect("run" in composition).toBe(false);
    expect("dispatch" in composition).toBe(false);
    expect(firestoreAccesses).toBe(0);
    expect(clockCalls).toBe(0);
    expect(getApps()).toHaveLength(appCountBefore);
  });
});

describe("Authority Dark Composition architecture", () => {
  const repositoryRoot = path.resolve(__dirname, "..", "..");
  const compositionRoot = path.join(
    repositoryRoot,
    "functions",
    "src",
    "composition",
    "authorityDarkComposition",
  );
  const adapterRoot = path.join(
    repositoryRoot,
    "functions",
    "src",
    "infrastructure",
    "firestore",
    "authorityPersistence",
  );
  const packageRoot = path.join(
    repositoryRoot,
    "src",
    "modules",
    "intelligence",
  );
  const compositionSource = listTypeScriptFiles(compositionRoot)
    .map((file) => fs.readFileSync(file, "utf8"))
    .join("\n");
  const adapterSource = listTypeScriptFiles(adapterRoot)
    .map((file) => fs.readFileSync(file, "utf8"))
    .join("\n");
  const packageSource = listTypeScriptFiles(packageRoot)
    .filter(
      (file) => !file.split(path.sep).includes("tests"),
    )
    .map((file) => fs.readFileSync(file, "utf8"))
    .join("\n");
  const functionsIndex = fs.readFileSync(
    path.join(repositoryRoot, "functions", "src", "index.ts"),
    "utf8",
  );
  const externalFunctionsConsumers = listTypeScriptFiles(
    path.join(repositoryRoot, "functions", "src"),
  )
    .filter((file) => !file.startsWith(compositionRoot))
    .filter((file) =>
      fs
        .readFileSync(file, "utf8")
        .includes("authorityDarkComposition"),
    );

  it("lives only in Functions and is absent from package, adapter and runtime index", () => {
    expect(compositionRoot).toContain(
      path.join("functions", "src", "composition"),
    );
    expect(packageSource).not.toContain(
      "authorityDarkComposition",
    );
    expect(adapterSource).not.toContain(
      "authorityDarkComposition",
    );
    expect(functionsIndex).not.toContain(
      "authorityDarkComposition",
    );
    expect(functionsIndex).not.toContain(
      "AuthorityDarkComposition",
    );
    expect(externalFunctionsConsumers).toEqual([]);
  });

  it("registers no handler, trigger, export or execution wrapper", () => {
    expect(compositionSource).not.toMatch(
      /\b(?:onCall|onRequest|onSchedule|onDocument|pubsub|tasks)\b/,
    );
    expect(compositionSource).not.toMatch(
      /\b(?:handle|dispatch|invoke|mutate)\s*\(/,
    );
    expect(compositionSource).not.toMatch(
      /export\s+(?:const|function)\s+(?:execute|run)\b/,
    );
    expect(functionsIndex).not.toMatch(
      /authorityDarkComposition|AuthorityDarkComposition/,
    );
  });

  it("has no environment, Admin initialization, remote flag or production mode", () => {
    expect(compositionSource).not.toMatch(
      /process\.env|initializeApp|getFirestore\s*\(/,
    );
    expect(compositionSource).not.toMatch(
      /RemoteConfig|remote[-_ ]?config|feature[-_ ]?flag/i,
    );
    expect(compositionSource).not.toMatch(
      /["'](?:ACTIVE|ENABLED|PRODUCTION|LIVE|SHADOW_WRITE)["']/,
    );
    expect(compositionSource).not.toMatch(
      /\b(?:Date\.now|new\s+Date|Math\.random)\b/,
    );
  });

  it("exposes the OS package only from the exact certified types file", () => {
    const packageConsumers = listTypeScriptFiles(
      compositionRoot,
    ).filter((file) =>
      fs
        .readFileSync(file, "utf8")
        .includes("@aura/intelligence-os"),
    );
    expect(packageConsumers).toEqual([
      path.join(
        compositionRoot,
        "authorityDarkCompositionTypes.ts",
      ),
    ]);
    const publicTypes = fs.readFileSync(
      packageConsumers[0],
      "utf8",
    );
    expect(publicTypes).toContain(
      "AuthorityMutationRepositoryPort",
    );
    expect(publicTypes).not.toContain(
      "FirestoreAuthorityMutationRepository",
    );
  });

  it("contains no credentials, real project, deploy, migration, outbox or delivery runtime", () => {
    expect(compositionSource).not.toMatch(
      /BEGIN (?:RSA )?PRIVATE KEY|client_email|private_key/,
    );
    expect(compositionSource).not.toMatch(
      /aura-control-center-[a-z0-9]+/,
    );
    expect(compositionSource).not.toMatch(
      /\bfirebase\s+(?:deploy|use)\b/,
    );
    expect(compositionSource).not.toMatch(
      /class\s+\w*(?:Migration|Outbox|Delivery)\w*(?:Worker|Executor)/,
    );
  });
});
