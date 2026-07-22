import { isExecutiveDiscoveryApiEnvelopeShape, isExecutiveDiscoveryApiRequest } from "../adapter/validation";
import type {
  ExecutiveDiscoveryApiClient,
  ExecutiveDiscoveryCallOptions,
  ExecutiveDiscoveryRequestSigner,
  ExecutiveDiscoveryRetryPolicy,
} from "../contracts/ExecutiveDiscoveryApiClient";
import type { ExecutiveDiscoveryApiRequest } from "../contracts/ExecutiveDiscoveryApiRequest";
import type {
  ExecutiveDiscoveryApiEnvelope,
  ExecutiveDiscoveryApiResponse,
} from "../contracts/ExecutiveDiscoveryApiResponse";
import {
  ExecutiveDiscoveryTransportError,
  ExecutiveDiscoveryTransportErrorCode,
} from "../contracts/ExecutiveDiscoveryTransportError";
import { serializeExecutiveDiscoveryApiRequest } from "./serializeExecutiveDiscoveryApiRequest";

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_REQUEST_BYTES = 1_048_576;
const DEFAULT_MAX_RESPONSE_BYTES = 2_097_152;

export const EXECUTIVE_DISCOVERY_NO_RETRY_POLICY: ExecutiveDiscoveryRetryPolicy = {
  maxAttempts: 1,
  retryableStatusCodes: [429, 500, 502, 503, 504],
};

export interface ExecutiveDiscoveryHttpRequestInit {
  readonly method: "POST";
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
  readonly signal: AbortSignal;
}

export interface ExecutiveDiscoveryHttpResponse {
  readonly status: number;
  readonly text: () => Promise<string>;
}

export type ExecutiveDiscoveryHttpTransport = (
  url: string,
  init: ExecutiveDiscoveryHttpRequestInit,
) => Promise<ExecutiveDiscoveryHttpResponse>;

export interface HttpExecutiveDiscoveryApiClientOptions {
  readonly endpoint: string;
  readonly signer: ExecutiveDiscoveryRequestSigner;
  readonly timeoutMs?: number;
  readonly maxRequestBytes?: number;
  readonly maxResponseBytes?: number;
  readonly retryPolicy?: ExecutiveDiscoveryRetryPolicy;
  readonly transport?: ExecutiveDiscoveryHttpTransport;
}

async function defaultTransport(
  url: string,
  init: ExecutiveDiscoveryHttpRequestInit,
): Promise<ExecutiveDiscoveryHttpResponse> {
  return globalThis.fetch(url, init);
}

function positiveInteger(value: number, label: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }
  return value;
}

function validateEndpoint(endpoint: string): string {
  let parsed: URL;
  try {
    parsed = new URL(endpoint);
  } catch {
    throw new Error("Executive Discovery endpoint configuration is invalid.");
  }

  if (
    !["http:", "https:"].includes(parsed.protocol) ||
    parsed.username.length > 0 ||
    parsed.password.length > 0
  ) {
    throw new Error("Executive Discovery endpoint configuration is invalid.");
  }
  return parsed.toString();
}

function validateHeaderValue(value: string): boolean {
  return value.length > 0 && !/[\r\n]/.test(value);
}

function invalidRequest(correlationId?: string): ExecutiveDiscoveryTransportError {
  return new ExecutiveDiscoveryTransportError({
    code: ExecutiveDiscoveryTransportErrorCode.INVALID_REQUEST,
    message: "The Executive Discovery request is invalid.",
    retryable: false,
    correlationId,
  });
}

export class HttpExecutiveDiscoveryApiClient
  implements ExecutiveDiscoveryApiClient
{
  private readonly endpoint: string;
  private readonly signer: ExecutiveDiscoveryRequestSigner;
  private readonly timeoutMs: number;
  private readonly maxRequestBytes: number;
  private readonly maxResponseBytes: number;
  private readonly transport: ExecutiveDiscoveryHttpTransport;

  public readonly retryPolicy: ExecutiveDiscoveryRetryPolicy;

  public constructor(options: HttpExecutiveDiscoveryApiClientOptions) {
    this.endpoint = validateEndpoint(options.endpoint);
    this.signer = options.signer;
    this.timeoutMs = positiveInteger(
      options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      "timeoutMs",
    );
    this.maxRequestBytes = positiveInteger(
      options.maxRequestBytes ?? DEFAULT_MAX_REQUEST_BYTES,
      "maxRequestBytes",
    );
    this.maxResponseBytes = positiveInteger(
      options.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES,
      "maxResponseBytes",
    );
    this.retryPolicy =
      options.retryPolicy ?? EXECUTIVE_DISCOVERY_NO_RETRY_POLICY;
    this.transport = options.transport ?? defaultTransport;
  }

  public async evaluate(
    request: ExecutiveDiscoveryApiRequest,
    options: ExecutiveDiscoveryCallOptions = {},
  ): Promise<ExecutiveDiscoveryApiResponse> {
    if (!isExecutiveDiscoveryApiRequest(request)) {
      throw invalidRequest();
    }
    if (
      !validateHeaderValue(request.correlationId) ||
      !validateHeaderValue(request.idempotencyKey)
    ) {
      throw invalidRequest(request.correlationId);
    }

    let serializedRequest: string;
    try {
      serializedRequest = serializeExecutiveDiscoveryApiRequest(request);
    } catch {
      throw invalidRequest(request.correlationId);
    }
    if (Buffer.byteLength(serializedRequest, "utf8") > this.maxRequestBytes) {
      throw invalidRequest(request.correlationId);
    }

    let authorization: Awaited<
      ReturnType<ExecutiveDiscoveryRequestSigner["sign"]>
    >;
    try {
      authorization = await this.signer.sign(request);
    } catch (error: unknown) {
      if (error instanceof ExecutiveDiscoveryTransportError) throw error;
      throw new ExecutiveDiscoveryTransportError({
        code: ExecutiveDiscoveryTransportErrorCode.AUTHENTICATION_REQUIRED,
        message: "Executive Discovery service authentication is unavailable.",
        retryable: false,
        correlationId: request.correlationId,
      });
    }
    if (!validateHeaderValue(authorization.token)) {
      throw new ExecutiveDiscoveryTransportError({
        code: ExecutiveDiscoveryTransportErrorCode.AUTHENTICATION_REQUIRED,
        message: "Executive Discovery service authentication is unavailable.",
        retryable: false,
        correlationId: request.correlationId,
      });
    }

    const controller = new AbortController();
    let timedOut = false;
    let externallyAborted = options.signal?.aborted === true;
    const abortFromCaller = (): void => {
      externallyAborted = true;
      controller.abort();
    };
    options.signal?.addEventListener("abort", abortFromCaller, { once: true });
    if (externallyAborted) controller.abort();

    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.timeoutMs);

    try {
      const response = await this.transport(this.endpoint, {
        method: "POST",
        headers: {
          Authorization: `${authorization.scheme} ${authorization.token}`,
          "Content-Type": "application/json; charset=utf-8",
          "X-Correlation-Id": request.correlationId,
          "Idempotency-Key": request.idempotencyKey,
        },
        body: serializedRequest,
        signal: controller.signal,
      });
      const responseText = await response.text();
      if (Buffer.byteLength(responseText, "utf8") > this.maxResponseBytes) {
        throw new ExecutiveDiscoveryTransportError({
          code: ExecutiveDiscoveryTransportErrorCode.INVALID_RESPONSE,
          message: "Aura Intelligence returned an invalid response.",
          retryable: false,
          httpStatus: response.status,
          correlationId: request.correlationId,
        });
      }

      let body: unknown;
      try {
        body = JSON.parse(responseText) as unknown;
      } catch {
        throw new ExecutiveDiscoveryTransportError({
          code: ExecutiveDiscoveryTransportErrorCode.INVALID_RESPONSE,
          message: "Aura Intelligence returned an invalid response.",
          retryable: false,
          httpStatus: response.status,
          correlationId: request.correlationId,
        });
      }
      if (!isExecutiveDiscoveryApiEnvelopeShape(body)) {
        throw new ExecutiveDiscoveryTransportError({
          code: ExecutiveDiscoveryTransportErrorCode.INVALID_RESPONSE,
          message: "Aura Intelligence returned an invalid response.",
          retryable: false,
          httpStatus: response.status,
          correlationId: request.correlationId,
        });
      }

      return {
        status: response.status,
        body: body as ExecutiveDiscoveryApiEnvelope,
      };
    } catch (error: unknown) {
      if (error instanceof ExecutiveDiscoveryTransportError) throw error;
      if (timedOut) {
        throw new ExecutiveDiscoveryTransportError({
          code: ExecutiveDiscoveryTransportErrorCode.TIMEOUT,
          message: "Aura Intelligence did not respond before the timeout.",
          retryable: true,
          correlationId: request.correlationId,
        });
      }
      if (externallyAborted) {
        throw new ExecutiveDiscoveryTransportError({
          code: ExecutiveDiscoveryTransportErrorCode.ABORTED,
          message: "The Executive Discovery request was cancelled.",
          retryable: false,
          correlationId: request.correlationId,
        });
      }
      throw new ExecutiveDiscoveryTransportError({
        code: ExecutiveDiscoveryTransportErrorCode.NETWORK_FAILURE,
        message: "Aura Intelligence is temporarily unreachable.",
        retryable: true,
        correlationId: request.correlationId,
      });
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener("abort", abortFromCaller);
    }
  }
}
