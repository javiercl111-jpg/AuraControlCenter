import {
  createHash,
  createHmac,
  timingSafeEqual,
} from "node:crypto";

import { RateLimitError } from "./rateLimitErrors";
import type {
  RateLimitDimension,
  RateLimitKeyV1,
} from "./rateLimitTypes";

const MINIMUM_HMAC_SECRET_BYTES = 32;
const MAXIMUM_CANONICAL_KEY_BYTES = 2_048;

export interface DeriveRateLimitHmacKeyInputV1 {
  readonly dimension: RateLimitDimension;
  readonly canonicalValue: string;
  readonly secret: string | Uint8Array;
  readonly keyVersion: string;
}

function secretByteLength(secret: string | Uint8Array): number {
  return typeof secret === "string"
    ? Buffer.byteLength(secret, "utf8")
    : secret.byteLength;
}

export function deriveRateLimitHmacKeyV1(
  input: DeriveRateLimitHmacKeyInputV1,
): RateLimitKeyV1 {
  if (
    typeof input.canonicalValue !== "string" ||
    input.canonicalValue.length === 0 ||
    Buffer.byteLength(input.canonicalValue, "utf8") >
      MAXIMUM_CANONICAL_KEY_BYTES
  ) {
    throw new RateLimitError(
      "CONFIGURATION_ERROR",
      "Rate-limit canonical key is invalid.",
    );
  }
  if (secretByteLength(input.secret) < MINIMUM_HMAC_SECRET_BYTES) {
    throw new RateLimitError(
      "CONFIGURATION_ERROR",
      "Rate-limit HMAC secret is too short.",
    );
  }
  if (
    typeof input.keyVersion !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/.test(
      input.keyVersion,
    )
  ) {
    throw new RateLimitError(
      "CONFIGURATION_ERROR",
      "Rate-limit HMAC key version is invalid.",
    );
  }

  const purpose =
    `aura:public-rate-limit:v1:${input.dimension}:` +
    `${input.keyVersion}\0`;
  const value = createHmac("sha256", input.secret)
    .update(purpose, "utf8")
    .update(input.canonicalValue, "utf8")
    .digest("hex");
  return Object.freeze({
    scheme: "HMAC_SHA256_V1",
    version: input.keyVersion,
    value,
  });
}

export function createRateLimitKeyFingerprintV1(
  dimension: RateLimitDimension,
  key: RateLimitKeyV1,
): string {
  return createHash("sha256")
    .update(
      `${dimension}\0${key.scheme}\0${key.version}\0${key.value}`,
      "utf8",
    )
    .digest("hex");
}

export function rateLimitKeysEqualV1(
  left: RateLimitKeyV1,
  right: RateLimitKeyV1,
): boolean {
  const leftBuffer = Buffer.from(
    `${left.scheme}\0${left.version}\0${left.value}`,
    "utf8",
  );
  const rightBuffer = Buffer.from(
    `${right.scheme}\0${right.version}\0${right.value}`,
    "utf8",
  );
  return (
    leftBuffer.byteLength === rightBuffer.byteLength &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}
