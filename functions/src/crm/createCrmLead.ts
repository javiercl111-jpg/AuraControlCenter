import * as admin from "firebase-admin";
import { HttpsError, onCall } from "firebase-functions/v2/https";

import {
  PREVIEW_DISCOVERY_CALLABLE_OPTIONS_V1,
  assertPreviewDiscoveryRuntimeV1,
} from "../discovery/deployment/previewDiscoveryDeploymentUnitV1";
import {
  CrmLeadCreateErrorV1,
  type CrmLeadCreateErrorCodeV1,
} from "./createCrmLeadContractV1";
import { CreateCrmLeadServiceV1 } from "./createCrmLeadCoreV1";
import {
  FirestoreCrmLeadCreateAuthorityV1,
  FirestoreCrmLeadCreatePersistenceV1,
} from "./firestoreCrmLeadCreateV1";

function toHttpsError(code: CrmLeadCreateErrorCodeV1): HttpsError {
  switch (code) {
    case "UNAUTHENTICATED":
      return new HttpsError("unauthenticated", code);
    case "APP_CHECK_REJECTED":
      return new HttpsError("failed-precondition", code);
    case "PERMISSION_DENIED":
      return new HttpsError("permission-denied", code);
    case "INVALID_ARGUMENT":
      return new HttpsError("invalid-argument", code);
    case "IDEMPOTENCY_CONFLICT":
      return new HttpsError("already-exists", code);
    case "INTERNAL_SAFE_FAILURE":
      return new HttpsError("internal", code);
  }
}

export const createCrmLead = onCall(
  PREVIEW_DISCOVERY_CALLABLE_OPTIONS_V1.createCrmLead,
  async (request) => {
    try {
      assertPreviewDiscoveryRuntimeV1();
      const db = admin.firestore();
      const service = new CreateCrmLeadServiceV1(
        new FirestoreCrmLeadCreateAuthorityV1(db),
        new FirestoreCrmLeadCreatePersistenceV1(db),
      );
      return await service.execute(request.data, {
        auth: request.auth,
        app: request.app,
      });
    } catch (error: unknown) {
      if (error instanceof CrmLeadCreateErrorV1) {
        throw toHttpsError(error.code);
      }
      if (error instanceof HttpsError) throw error;
      throw toHttpsError("INTERNAL_SAFE_FAILURE");
    }
  },
);
