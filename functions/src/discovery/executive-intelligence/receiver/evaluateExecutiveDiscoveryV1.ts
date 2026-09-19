import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { onRequest } from "firebase-functions/v2/https";
import { PREVIEW_DISCOVERY_HTTP_OPTIONS_V1, assertPreviewDiscoveryRuntimeV1 } from "../../deployment/previewDiscoveryDeploymentUnitV1";
import { createExecutiveDiscoveryReceiverCompositionV1, ExecutiveDiscoveryReceiverFailureV1, EXECUTIVE_DISCOVERY_MAX_BODY_BYTES_V1 } from "../../../composition/discoveryIntelligence/createExecutiveDiscoveryReceiverCompositionV1";
import { isExecutiveDiscoveryApiRequest } from "../adapter/validation";
import type { ExecutiveDiscoveryApiResponse } from "../contracts/ExecutiveDiscoveryApiResponse";

export interface ExecutiveDiscoveryHttpInputV1 {
  readonly method: string;
  readonly headers: Readonly<Record<string, string | string[] | undefined>>;
  readonly rawBody?: Buffer;
}
type Composition = ReturnType<typeof createExecutiveDiscoveryReceiverCompositionV1>;
const rejected = (status: number, code: string): ExecutiveDiscoveryApiResponse => ({ status, body: { success: false, error: { code, message: "Executive Discovery request could not be completed." } } });

export function createExecutiveDiscoveryHttpHandlerV1(resolveComposition: () => Composition) {
  return async (input: ExecutiveDiscoveryHttpInputV1): Promise<ExecutiveDiscoveryApiResponse> => {
    try {
      if (input.method !== "POST") return rejected(405, "METHOD_NOT_ALLOWED");
      const contentType = input.headers["content-type"];
      if (typeof contentType !== "string" || !/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(contentType)) return rejected(415, "JSON_REQUIRED");
      if (!Buffer.isBuffer(input.rawBody) || input.rawBody.length === 0) return rejected(400, "INVALID_REQUEST");
      if (input.rawBody.length > EXECUTIVE_DISCOVERY_MAX_BODY_BYTES_V1) return rejected(413, "BODY_TOO_LARGE");
      const authorization = input.headers.authorization;
      if (typeof authorization !== "string" || authorization.length > 16_384 || !/^Bearer [^\s]+$/.test(authorization)) return rejected(401, "AUTHENTICATION_REQUIRED");
      let body: unknown;
      try { body = JSON.parse(input.rawBody.toString("utf8")); } catch { return rejected(400, "INVALID_REQUEST"); }
      if (!isExecutiveDiscoveryApiRequest(body)) return rejected(400, "INVALID_REQUEST");
      return await resolveComposition().evaluate(authorization, body);
    } catch (error: unknown) {
      if (error instanceof ExecutiveDiscoveryReceiverFailureV1) return rejected(error.status, error.safeCode);
      return rejected(500, "INTERNAL_ERROR");
    }
  };
}
const productionHandler = createExecutiveDiscoveryHttpHandlerV1(() => {
  assertPreviewDiscoveryRuntimeV1();
  if (getApps().length === 0) initializeApp();
  return createExecutiveDiscoveryReceiverCompositionV1({ firestore: getFirestore() });
});
export const evaluateExecutiveDiscoveryV1 = onRequest(PREVIEW_DISCOVERY_HTTP_OPTIONS_V1.evaluateExecutiveDiscoveryV1, async (request, response) => {
  const result = await productionHandler(request);
  response.set("Cache-Control", "no-store").status(result.status).json(result.body);
});
