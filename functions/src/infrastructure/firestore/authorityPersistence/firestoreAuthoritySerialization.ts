import { Timestamp } from "firebase-admin/firestore";

export type FirestoreAuthoritySerializableValue =
  | null
  | boolean
  | number
  | string
  | readonly FirestoreAuthoritySerializableValue[]
  | FirestoreAuthorityDocumentData;

export interface FirestoreAuthorityDocumentData {
  readonly [key: string]: FirestoreAuthoritySerializableValue;
}

const SERIALIZATION_ERROR_MESSAGE =
  "Authority Firestore serialization failed.";

export class FirestoreAuthoritySerializationError extends Error {
  readonly code = "AUTHORITY_FIRESTORE_SERIALIZATION_FAILED";

  constructor() {
    super(SERIALIZATION_ERROR_MESSAGE);
    this.name = "FirestoreAuthoritySerializationError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function serializeValue(
  value: unknown,
  ancestors: WeakSet<object>,
): FirestoreAuthoritySerializableValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new FirestoreAuthoritySerializationError();
    }
    return value;
  }
  if (Array.isArray(value)) {
    if (ancestors.has(value)) {
      throw new FirestoreAuthoritySerializationError();
    }
    ancestors.add(value);
    const serialized = value.map((entry) => {
      if (entry === undefined) {
        throw new FirestoreAuthoritySerializationError();
      }
      return serializeValue(entry, ancestors);
    });
    ancestors.delete(value);
    return serialized;
  }
  if (!isPlainRecord(value)) {
    throw new FirestoreAuthoritySerializationError();
  }
  if (ancestors.has(value)) {
    throw new FirestoreAuthoritySerializationError();
  }
  ancestors.add(value);
  const output: Record<string, FirestoreAuthoritySerializableValue> = {};
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string") {
      throw new FirestoreAuthoritySerializationError();
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (
      descriptor === undefined ||
      !descriptor.enumerable ||
      !Object.prototype.hasOwnProperty.call(descriptor, "value")
    ) {
      throw new FirestoreAuthoritySerializationError();
    }
    if (descriptor.value !== undefined) {
      Object.defineProperty(output, key, {
        configurable: true,
        enumerable: true,
        value: serializeValue(descriptor.value, ancestors),
        writable: true,
      });
    }
  }
  ancestors.delete(value);
  return output;
}

function deserializeValue(
  value: unknown,
  ancestors: WeakSet<object>,
): unknown {
  if (value instanceof Timestamp) {
    return Object.freeze({
      seconds: value.seconds,
      nanoseconds: value.nanoseconds,
    });
  }
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  ) {
    return value;
  }
  if (Array.isArray(value)) {
    if (ancestors.has(value)) {
      throw new FirestoreAuthoritySerializationError();
    }
    ancestors.add(value);
    const output = value.map((entry) => {
      if (entry === undefined) {
        throw new FirestoreAuthoritySerializationError();
      }
      return deserializeValue(entry, ancestors);
    });
    ancestors.delete(value);
    return output;
  }
  if (!isPlainRecord(value) || ancestors.has(value)) {
    throw new FirestoreAuthoritySerializationError();
  }
  ancestors.add(value);
  const output: Record<string, unknown> = {};
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string") {
      throw new FirestoreAuthoritySerializationError();
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (
      descriptor === undefined ||
      !descriptor.enumerable ||
      !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
      descriptor.value === undefined
    ) {
      throw new FirestoreAuthoritySerializationError();
    }
    Object.defineProperty(output, key, {
      configurable: true,
      enumerable: true,
      value: deserializeValue(descriptor.value, ancestors),
      writable: true,
    });
  }
  ancestors.delete(value);
  return output;
}

export function serializeAuthorityFirestoreDocument(
  value: unknown,
): FirestoreAuthorityDocumentData {
  const serialized = serializeValue(value, new WeakSet<object>());
  if (!isPlainRecord(serialized)) {
    throw new FirestoreAuthoritySerializationError();
  }
  const output: Record<string, FirestoreAuthoritySerializableValue> = {};
  for (const [key, entry] of Object.entries(serialized)) {
    Object.defineProperty(output, key, {
      configurable: true,
      enumerable: true,
      value: serializeValue(entry, new WeakSet<object>()),
      writable: true,
    });
  }
  return output;
}

export function deserializeAuthorityFirestoreDocument(
  value: unknown,
): Record<string, unknown> {
  const deserialized = deserializeValue(value, new WeakSet<object>());
  if (!isPlainRecord(deserialized)) {
    throw new FirestoreAuthoritySerializationError();
  }
  return deserialized;
}
