/**
 * Converts a value to a finite number, using a fallback if invalid or non-finite.
 */
export function toFiniteNumber(value: unknown, fallback = 0): number {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return fallback;
  }
  return num;
}
