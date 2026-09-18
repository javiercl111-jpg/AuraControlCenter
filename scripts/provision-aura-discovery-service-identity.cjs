"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { createRequire } = require("node:module");

const PROJECT_ID = "aura-intel-preview";
const ENVIRONMENT = "PREVIEW";

const SERVICE_ACCOUNT_EMAIL =
  "preview-discovery-complete-rt@aura-intel-preview.iam.gserviceaccount.com";

const BINDING_COLLECTION =
  "discovery_oidc_service_identity_bindings";

const MEMBERSHIP_COLLECTION = "tenant_memberships";

const BINDING_SCHEMA_VERSION =
  "DiscoveryOidcServiceIdentityBindingV1";

const BINDING_VERSION = "1";
const MEMBERSHIP_SCHEMA_VERSION = "1";
const ROLE_VOCABULARY_VERSION = "1";
const MEMBERSHIP_KEY_VERSION = "1";

const PROVIDER = "GOOGLE_CLOUD_IAM";
const AUTHENTICATION_METHOD = "OIDC_SERVICE_ACCOUNT";
const PROVIDER_SUBJECT_PREFIX = "google-oidc-sub:";
const BINDING_DOCUMENT_PREFIX = "oidc-service-v1-";

const APPLY_CHANGE_ID =
  "DISC-INT-CRM-ACTIVATION-I4-SERVICE-IDENTITY-V1";

class PreviewServiceIdentityProvisioningError extends Error {
  constructor(code) {
    super(code);
    this.name = "PreviewServiceIdentityProvisioningError";
    this.code = code;
  }
}

function fail(code) {
  throw new PreviewServiceIdentityProvisioningError(code);
}

function digest(value) {
  return createHash("sha256")
    .update(value, "utf8")
    .digest("hex");
}

function isRecord(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function exactKeys(value, expected) {
  if (!isRecord(value)) return false;

  const actual = Object.keys(value).sort();
  const required = [...expected].sort();

  return (
    actual.length === required.length &&
    actual.every((key, index) => key === required[index])
  );
}

function canonicalTimestamp(value) {
  if (typeof value !== "string") fail("INVALID_TIMESTAMP");

  const milliseconds = Date.parse(value);

  if (
    !Number.isFinite(milliseconds) ||
    new Date(milliseconds).toISOString() !== value
  ) {
    fail("INVALID_TIMESTAMP");
  }

  return value;
}

function canonicalIdentifier(value, code) {
  if (
    typeof value !== "string" ||
    value.length < 3 ||
    value.length > 128 ||
    !/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(value) ||
    value.toLowerCase() === "system"
  ) {
    fail(code);
  }

  return value;
}

function canonicalTenantId(value) {
  if (
    typeof value !== "string" ||
    value.length < 3 ||
    value.length > 160 ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value) ||
    value.toLowerCase() === "aura_root"
  ) {
    fail("INVALID_TENANT_ID");
  }

  return value;
}

function canonicalActorType(value) {
  if (!["USER", "SERVICE", "SYSTEM"].includes(value)) {
    fail("INVALID_ACTOR_TYPE");
  }

  return value;
}

function createProviderSubject(verifiedGoogleSubject) {
  if (
    typeof verifiedGoogleSubject !== "string" ||
    verifiedGoogleSubject.trim() !== verifiedGoogleSubject ||
    verifiedGoogleSubject.length < 1 ||
    verifiedGoogleSubject.length > 220 ||
    !/^[A-Za-z0-9][A-Za-z0-9_:/.-]*$/.test(
      verifiedGoogleSubject,
    ) ||
    verifiedGoogleSubject.includes("..") ||
    verifiedGoogleSubject.includes("@")
  ) {
    fail("INVALID_VERIFIED_GOOGLE_SUBJECT");
  }

  const providerSubjectId =
    `${PROVIDER_SUBJECT_PREFIX}${verifiedGoogleSubject}`;

  if (providerSubjectId.length > 256) {
    fail("INVALID_VERIFIED_GOOGLE_SUBJECT");
  }

  return providerSubjectId;
}

function bindingDocumentId(providerSubjectId) {
  return `${BINDING_DOCUMENT_PREFIX}${digest(providerSubjectId)}`;
}

function frame(value) {
  return `${value.length}:${value}`;
}

function membershipKey(principalId, tenantId) {
  return [
    `v${MEMBERSHIP_KEY_VERSION}`,
    frame("SERVICE"),
    frame(principalId),
    frame(tenantId),
  ].join("|");
}

function desiredBinding(input, occurredAt) {
  return Object.freeze({
    schemaVersion: BINDING_SCHEMA_VERSION,
    bindingVersion: BINDING_VERSION,
    environment: ENVIRONMENT,
    projectId: PROJECT_ID,
    provider: PROVIDER,
    authenticationMethod: AUTHENTICATION_METHOD,
    providerSubjectId: input.providerSubjectId,
    serviceAccountEmail: SERVICE_ACCOUNT_EMAIL,
    canonicalPrincipalId: input.canonicalPrincipalId,
    bindingId: input.bindingId,
    status: "ACTIVE",
    createdAt: occurredAt,
    updatedAt: occurredAt,
  });
}

function desiredMembership(input, occurredAt) {
  const key = membershipKey(
    input.canonicalPrincipalId,
    input.tenantId,
  );

  const actor = Object.freeze({
    actorType: input.actorType,
    actorId: input.actorId,
  });

  return Object.freeze({
    schemaVersion: MEMBERSHIP_SCHEMA_VERSION,
    membershipId: key,
    membershipKey: key,
    principalType: "SERVICE",
    principalId: input.canonicalPrincipalId,
    tenantId: input.tenantId,
    roles: Object.freeze(["TENANT_SERVICE"]),
    roleVocabularyVersion: ROLE_VOCABULARY_VERSION,
    status: "ACTIVE",
    membershipVersion: 1,
    authorityVersion: 1,
    createdAt: occurredAt,
    updatedAt: occurredAt,
    createdBy: actor,
    updatedBy: actor,
  });
}

function validateExistingBinding(value, expected) {
  if (
    !exactKeys(value, [
      "schemaVersion",
      "bindingVersion",
      "environment",
      "projectId",
      "provider",
      "authenticationMethod",
      "providerSubjectId",
      "serviceAccountEmail",
      "canonicalPrincipalId",
      "bindingId",
      "status",
      "createdAt",
      "updatedAt",
    ])
  ) {
    fail("EXISTING_BINDING_CONFLICT");
  }

  if (
    value.schemaVersion !== BINDING_SCHEMA_VERSION ||
    value.bindingVersion !== BINDING_VERSION ||
    value.environment !== ENVIRONMENT ||
    value.projectId !== PROJECT_ID ||
    value.provider !== PROVIDER ||
    value.authenticationMethod !== AUTHENTICATION_METHOD ||
    value.providerSubjectId !== expected.providerSubjectId ||
    value.serviceAccountEmail !== SERVICE_ACCOUNT_EMAIL ||
    value.canonicalPrincipalId !== expected.canonicalPrincipalId ||
    value.bindingId !== expected.bindingId ||
    value.status !== "ACTIVE"
  ) {
    fail("EXISTING_BINDING_CONFLICT");
  }

  const createdAt = canonicalTimestamp(value.createdAt);
  const updatedAt = canonicalTimestamp(value.updatedAt);

  if (Date.parse(updatedAt) < Date.parse(createdAt)) {
    fail("EXISTING_BINDING_CONFLICT");
  }

  return "REUSED";
}

function sameActor(value, expected) {
  return (
    exactKeys(value, ["actorType", "actorId"]) &&
    value.actorType === expected.actorType &&
    value.actorId === expected.actorId
  );
}

function validateExistingMembership(value, expected) {
  if (
    !exactKeys(value, [
      "schemaVersion",
      "membershipId",
      "membershipKey",
      "principalType",
      "principalId",
      "tenantId",
      "roles",
      "roleVocabularyVersion",
      "status",
      "membershipVersion",
      "authorityVersion",
      "createdAt",
      "updatedAt",
      "createdBy",
      "updatedBy",
    ])
  ) {
    fail("EXISTING_MEMBERSHIP_CONFLICT");
  }

  if (
    value.schemaVersion !== MEMBERSHIP_SCHEMA_VERSION ||
    value.membershipId !== expected.membershipId ||
    value.membershipKey !== expected.membershipKey ||
    value.principalType !== "SERVICE" ||
    value.principalId !== expected.principalId ||
    value.tenantId !== expected.tenantId ||
    !Array.isArray(value.roles) ||
    value.roles.length !== 1 ||
    value.roles[0] !== "TENANT_SERVICE" ||
    value.roleVocabularyVersion !== ROLE_VOCABULARY_VERSION ||
    value.status !== "ACTIVE" ||
    value.membershipVersion !== 1 ||
    value.authorityVersion !== 1 ||
    !sameActor(value.createdBy, expected.createdBy) ||
    !sameActor(value.updatedBy, expected.updatedBy)
  ) {
    fail("EXISTING_MEMBERSHIP_CONFLICT");
  }

  const createdAt = canonicalTimestamp(value.createdAt);
  const updatedAt = canonicalTimestamp(value.updatedAt);

  if (Date.parse(updatedAt) < Date.parse(createdAt)) {
    fail("EXISTING_MEMBERSHIP_CONFLICT");
  }

  return "REUSED";
}

function parseArguments(argv) {
  const allowedPrefixes = [
    "--project=",
    "--environment=",
    "--verified-sub-file=",
    "--canonical-principal-id=",
    "--tenant-id=",
    "--actor-type=",
    "--actor-id=",
    "--confirm-change-id=",
  ];

  for (const argument of argv) {
    if (
      argument !== "--dry-run" &&
      argument !== "--apply" &&
      !allowedPrefixes.some(
        (prefix) => argument.startsWith(prefix),
      )
    ) {
      fail("UNEXPECTED_ARGUMENT");
    }
  }

  const valueOf = (prefix) =>
    argv.find(
      (argument) => argument.startsWith(prefix),
    )?.slice(prefix.length);

  const apply = argv.includes("--apply");
  const explicitDryRun = argv.includes("--dry-run");

  if (apply && explicitDryRun) {
    fail("EXECUTION_MODE_CONFLICT");
  }

  const dryRun = !apply;

  const projectId = valueOf("--project=");
  const environment = valueOf("--environment=");
  const verifiedSubFile = valueOf("--verified-sub-file=");
  const canonicalPrincipalId = canonicalIdentifier(
    valueOf("--canonical-principal-id="),
    "INVALID_CANONICAL_PRINCIPAL_ID",
  );
  const tenantId = canonicalTenantId(
    valueOf("--tenant-id="),
  );
  const actorType = canonicalActorType(
    valueOf("--actor-type="),
  );
  const actorId = canonicalIdentifier(
    valueOf("--actor-id="),
    "INVALID_ACTOR_ID",
  );

  if (projectId !== PROJECT_ID) {
    fail("PROJECT_NOT_PREVIEW");
  }

  if (environment !== ENVIRONMENT) {
    fail("ENVIRONMENT_NOT_PREVIEW");
  }

  if (
    typeof verifiedSubFile !== "string" ||
    verifiedSubFile.trim().length === 0
  ) {
    fail("VERIFIED_SUB_FILE_REQUIRED");
  }

  if (
    apply &&
    valueOf("--confirm-change-id=") !== APPLY_CHANGE_ID
  ) {
    fail("APPLY_CONFIRMATION_REQUIRED");
  }

  return Object.freeze({
    dryRun,
    apply,
    projectId,
    environment,
    verifiedSubFile,
    canonicalPrincipalId,
    tenantId,
    actorType,
    actorId,
  });
}

function readVerifiedSubject(filePath) {
  const value = fs
    .readFileSync(filePath, "utf8")
    .trim();

  return createProviderSubject(value);
}

function safeLocator(value) {
  return digest(value).slice(0, 24);
}

function safeErrorCode(error) {
  if (
    error instanceof PreviewServiceIdentityProvisioningError
  ) {
    return error.code;
  }

  return "CONTROLLED_OPERATION_FAILED";
}

function createFirestoreRepository(firestore) {
  return Object.freeze({
    runTransaction(operation) {
      return firestore.runTransaction(
        async (transaction) => {
          const bindings =
            firestore.collection(BINDING_COLLECTION);

          const memberships =
            firestore.collection(MEMBERSHIP_COLLECTION);

          return operation(
            Object.freeze({
              async getBinding(documentId) {
                const snapshot =
                  await transaction.get(
                    bindings.doc(documentId),
                  );

                return snapshot.exists
                  ? snapshot.data()
                  : null;
              },

              async getMembership(documentId) {
                const snapshot =
                  await transaction.get(
                    memberships.doc(documentId),
                  );

                return snapshot.exists
                  ? snapshot.data()
                  : null;
              },

              createBinding(documentId, document) {
                transaction.create(
                  bindings.doc(documentId),
                  document,
                );
              },

              createMembership(documentId, document) {
                transaction.create(
                  memberships.doc(documentId),
                  document,
                );
              },
            }),
          );
        },
      );
    },
  });
}

async function executeProvisioning(input) {
  const occurredAt = input.clock.now();

  canonicalTimestamp(occurredAt);

  const providerSubjectId =
    input.providerSubjectId;

  const bindingId =
    bindingDocumentId(providerSubjectId);

  const context = Object.freeze({
    providerSubjectId,
    bindingId,
    canonicalPrincipalId:
      input.options.canonicalPrincipalId,
    tenantId: input.options.tenantId,
    actorType: input.options.actorType,
    actorId: input.options.actorId,
  });

  const binding =
    desiredBinding(context, occurredAt);

  const membership =
    desiredMembership(context, occurredAt);

  return input.repository.runTransaction(
    async (transaction) => {
      const [
        existingBinding,
        existingMembership,
      ] = await Promise.all([
        transaction.getBinding(binding.bindingId),
        transaction.getMembership(
          membership.membershipId,
        ),
      ]);

      const bindingAction =
        existingBinding === null
          ? "CREATED"
          : validateExistingBinding(
              existingBinding,
              binding,
            );

      const membershipAction =
        existingMembership === null
          ? "CREATED"
          : validateExistingMembership(
              existingMembership,
              membership,
            );

      const writes =
        Number(bindingAction === "CREATED") +
        Number(membershipAction === "CREATED");

      if (!input.options.dryRun) {
        if (bindingAction === "CREATED") {
          transaction.createBinding(
            binding.bindingId,
            binding,
          );
        }

        if (membershipAction === "CREATED") {
          transaction.createMembership(
            membership.membershipId,
            membership,
          );
        }
      }

      return Object.freeze({
        status: "PASS",
        mode:
          input.options.dryRun
            ? "DRY_RUN"
            : "APPLY",
        projectId: PROJECT_ID,
        environment: ENVIRONMENT,
        bindingAction,
        membershipAction,
        writes:
          input.options.dryRun
            ? 0
            : writes,
        plannedWrites: writes,
        bindingLocator:
          safeLocator(binding.bindingId),
        principalLocator:
          safeLocator(binding.canonicalPrincipalId),
        membershipLocator:
          safeLocator(membership.membershipId),
        providerSubjectPrinted: false,
        serviceAccountEmailPrinted: false,
        productiveAllowed: false,
      });
    },
  );
}

async function main() {
  const options =
    parseArguments(process.argv.slice(2));

  const providerSubjectId =
    readVerifiedSubject(
      options.verifiedSubFile,
    );

  const functionsRequire =
    createRequire(
      path.resolve(
        __dirname,
        "..",
        "functions",
        "package.json",
      ),
    );

  const {
    applicationDefault,
    getApps,
    initializeApp,
  } = functionsRequire("firebase-admin/app");

  const {
    getFirestore,
  } = functionsRequire("firebase-admin/firestore");

  const appName =
    "aura-discovery-service-identity-provisioner";

  const app =
    getApps().find(
      (candidate) =>
        candidate.name === appName,
    ) ??
    initializeApp(
      {
        credential: applicationDefault(),
        projectId: PROJECT_ID,
      },
      appName,
    );

  const result =
    await executeProvisioning({
      options,
      providerSubjectId,
      repository:
        createFirestoreRepository(
          getFirestore(app),
        ),
      clock: Object.freeze({
        now: () =>
          new Date().toISOString(),
      }),
    });

  process.stdout.write(
    `${JSON.stringify(result, null, 2)}\n`,
  );
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(
      `${JSON.stringify({
        status: "FAILED",
        safeErrorCode:
          safeErrorCode(error),
        providerSubjectPrinted: false,
        serviceAccountEmailPrinted: false,
        productiveAllowed: false,
      })}\n`,
    );

    process.exitCode = 1;
  });
}

module.exports = Object.freeze({
  APPLY_CHANGE_ID,
  BINDING_COLLECTION,
  BINDING_SCHEMA_VERSION,
  ENVIRONMENT,
  MEMBERSHIP_COLLECTION,
  PROJECT_ID,
  SERVICE_ACCOUNT_EMAIL,
  bindingDocumentId,
  createFirestoreRepository,
  createProviderSubject,
  executeProvisioning,
  membershipKey,
  parseArguments,
});
