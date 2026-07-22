import { randomUUID } from "crypto";
import type {
  ExecutiveDiscoveryAdapter as ExecutiveDiscoveryAdapterPort,
  ExecutiveDiscoveryEvaluationInput,
} from "../contracts/ExecutiveDiscoveryAdapter";
import type { ExecutiveDiscoveryApiClient } from "../contracts/ExecutiveDiscoveryApiClient";
import {
  EXECUTIVE_DISCOVERY_CAPABILITY_VERSION,
  EXECUTIVE_DISCOVERY_SCHEMA_VERSION,
  type ExecutiveDiscoveryApiRequest,
} from "../contracts/ExecutiveDiscoveryApiRequest";
import type { ExecutiveDiscoveryApiErrorEnvelope } from "../contracts/ExecutiveDiscoveryApiResponse";
import type { ExecutiveDiagnosis } from "../contracts/ExecutiveDiagnosis";
import {
  ExecutiveDiscoveryTransportError,
  ExecutiveDiscoveryTransportErrorCode,
  type ExecutiveDiscoveryTransportErrorCode as TransportErrorCode,
} from "../contracts/ExecutiveDiscoveryTransportError";
import {
  isExecutiveDiagnosisForRequest,
  isExecutiveDiscoveryApiEnvelopeShape,
  isExecutiveDiscoveryApiRequest,
} from "./validation";

export const EXECUTIVE_DISCOVERY_ADAPTER_VERSION = "1.0.0" as const;

export interface ExecutiveDiscoveryClock {
  readonly now: () => string;
}

export interface ExecutiveDiscoveryIdFactory {
  readonly createId: (scope: "request" | "correlation") => string;
}

export interface DefaultExecutiveDiscoveryAdapterOptions {
  readonly apiClient: ExecutiveDiscoveryApiClient;
  readonly capabilityVersion?: string;
  readonly clock?: ExecutiveDiscoveryClock;
  readonly idFactory?: ExecutiveDiscoveryIdFactory;
}

const systemClock: ExecutiveDiscoveryClock = {
  now: () => new Date().toISOString(),
};

const randomIdFactory: ExecutiveDiscoveryIdFactory = {
  createId: (scope) => `${scope}-${randomUUID()}`,
};

function publicError(
  code: TransportErrorCode,
  message: string,
  request: ExecutiveDiscoveryApiRequest,
  httpStatus?: number,
  retryable = false,
): ExecutiveDiscoveryTransportError {
  return new ExecutiveDiscoveryTransportError({
    code,
    message,
    retryable,
    httpStatus,
    correlationId: request.correlationId,
  });
}

function translateApiError(
  status: number,
  envelope: ExecutiveDiscoveryApiErrorEnvelope,
  request: ExecutiveDiscoveryApiRequest,
): ExecutiveDiscoveryTransportError {
  if (status === 401) {
    return publicError(
      ExecutiveDiscoveryTransportErrorCode.AUTHENTICATION_REQUIRED,
      "Aura Intelligence rejected the service authentication.",
      request,
      status,
    );
  }
  if (status === 403) {
    return publicError(
      ExecutiveDiscoveryTransportErrorCode.ACCESS_FORBIDDEN,
      "The service is not authorized to evaluate this discovery.",
      request,
      status,
    );
  }
  if (status === 422) {
    if (envelope.error.code === "INVALID_DISCOVERY_EVIDENCE") {
      return publicError(
        ExecutiveDiscoveryTransportErrorCode.INVALID_EVIDENCE,
        "The Executive Discovery evidence was rejected.",
        request,
        status,
      );
    }
    if (envelope.error.code === "UNSUPPORTED_SCHEMA_VERSION") {
      return publicError(
        ExecutiveDiscoveryTransportErrorCode.UNSUPPORTED_SCHEMA_VERSION,
        "The Executive Discovery schema version is not supported.",
        request,
        status,
      );
    }
    if (envelope.error.code === "INVALID_DISCOVERY_REQUEST") {
      return publicError(
        ExecutiveDiscoveryTransportErrorCode.INVALID_REQUEST,
        "The Executive Discovery request was rejected.",
        request,
        status,
      );
    }
    return publicError(
      ExecutiveDiscoveryTransportErrorCode.REQUEST_REJECTED,
      "Aura Intelligence could not process the Executive Discovery request.",
      request,
      status,
    );
  }
  if (status === 429 || status >= 500) {
    return publicError(
      ExecutiveDiscoveryTransportErrorCode.SERVICE_FAILURE,
      "Aura Intelligence could not complete the Executive Discovery request.",
      request,
      status,
      true,
    );
  }

  return publicError(
    ExecutiveDiscoveryTransportErrorCode.REQUEST_REJECTED,
    "Aura Intelligence rejected the Executive Discovery request.",
    request,
    status,
  );
}

export class DefaultExecutiveDiscoveryAdapter
  implements ExecutiveDiscoveryAdapterPort
{
  private readonly apiClient: ExecutiveDiscoveryApiClient;
  private readonly capabilityVersion: string;
  private readonly clock: ExecutiveDiscoveryClock;
  private readonly idFactory: ExecutiveDiscoveryIdFactory;

  public constructor(options: DefaultExecutiveDiscoveryAdapterOptions) {
    this.apiClient = options.apiClient;
    this.capabilityVersion =
      options.capabilityVersion ?? EXECUTIVE_DISCOVERY_CAPABILITY_VERSION;
    this.clock = options.clock ?? systemClock;
    this.idFactory = options.idFactory ?? randomIdFactory;
  }

  public async evaluate(
    input: ExecutiveDiscoveryEvaluationInput,
  ): Promise<ExecutiveDiagnosis> {
    const request = this.buildRequest(input);
    if (!isExecutiveDiscoveryApiRequest(request)) {
      throw publicError(
        ExecutiveDiscoveryTransportErrorCode.INVALID_REQUEST,
        "The Executive Discovery request is invalid.",
        request,
      );
    }

    const response = await this.apiClient.evaluate(request);
    if (!isExecutiveDiscoveryApiEnvelopeShape(response.body)) {
      throw publicError(
        ExecutiveDiscoveryTransportErrorCode.INVALID_RESPONSE,
        "Aura Intelligence returned an invalid response.",
        request,
        response.status,
      );
    }

    if (response.status === 200 && response.body.success) {
      if (response.body.meta.correlationId !== request.correlationId) {
        throw publicError(
          ExecutiveDiscoveryTransportErrorCode.INVALID_RESPONSE,
          "Aura Intelligence returned an invalid response.",
          request,
          response.status,
        );
      }
      if (!isExecutiveDiagnosisForRequest(response.body.data, request)) {
        throw publicError(
          ExecutiveDiscoveryTransportErrorCode.INVALID_DIAGNOSIS,
          "Aura Intelligence returned an invalid Executive Diagnosis.",
          request,
          response.status,
        );
      }
      return response.body.data;
    }

    if (response.body.success) {
      throw publicError(
        ExecutiveDiscoveryTransportErrorCode.INVALID_RESPONSE,
        "Aura Intelligence returned an invalid response.",
        request,
        response.status,
      );
    }

    return Promise.reject(translateApiError(response.status, response.body, request));
  }

  private buildRequest(
    input: ExecutiveDiscoveryEvaluationInput,
  ): ExecutiveDiscoveryApiRequest {
    return {
      schemaVersion: EXECUTIVE_DISCOVERY_SCHEMA_VERSION,
      capabilityVersion: this.capabilityVersion,
      requestId: input.requestId ?? this.idFactory.createId("request"),
      correlationId:
        input.correlationId ?? this.idFactory.createId("correlation"),
      idempotencyKey: input.idempotencyKey,
      organizationId: input.organizationId,
      tenantId: input.tenantId,
      companyId: input.companyId,
      sessionId: input.sessionId,
      discoveryDefinitionVersion: input.discoveryDefinitionVersion,
      locale: input.locale,
      requestedAt: this.clock.now(),
      evidence: input.evidence,
      consentAssertion: input.consentAssertion,
      ...(input.metadata === undefined ? {} : { metadata: input.metadata }),
    };
  }
}

