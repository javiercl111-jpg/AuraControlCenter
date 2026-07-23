export const MAX_HYPOTHESIS_SIMILARITY = 0.8;

const SIMILARITY_STOP_WORDS = new Set([
  "alguna",
  "algun",
  "ante",
  "como",
  "considera",
  "consideran",
  "cual",
  "cuando",
  "dentro",
  "desde",
  "donde",
  "empresa",
  "esta",
  "este",
  "estos",
  "haber",
  "hacia",
  "hasta",
  "para",
  "pero",
  "porque",
  "puede",
  "pueden",
  "quiero",
  "sobre",
  "tiene",
  "tienen",
  "usted",
]);

export function calculateQuestionSimilarity(
  firstQuestion: string,
  secondQuestion: string,
): number {
  const first = normalizeForSimilarity(firstQuestion);
  const second = normalizeForSimilarity(secondQuestion);

  if (!first || !second) {
    return 0;
  }

  if (first === second) {
    return 1;
  }

  const editSimilarity = normalizedEditSimilarity(first, second);
  const bigramSimilarity = diceCoefficient(first, second);
  const tokenSimilarity = tokenContainment(first, second);

  return Math.max(editSimilarity, bigramSimilarity, tokenSimilarity);
}

export function isQuestionTooSimilar(
  proposedQuestion: string,
  canonicalQuestion: string,
  threshold = MAX_HYPOTHESIS_SIMILARITY,
): boolean {
  return calculateQuestionSimilarity(
    proposedQuestion,
    canonicalQuestion,
  ) > threshold;
}

export function normalizeForSimilarity(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizedEditSimilarity(first: string, second: string): number {
  const longestLength = Math.max(first.length, second.length);
  if (longestLength === 0) {
    return 1;
  }

  const previous = Array.from(
    { length: second.length + 1 },
    (_, index) => index,
  );

  for (let firstIndex = 1; firstIndex <= first.length; firstIndex += 1) {
    const current = [firstIndex];

    for (let secondIndex = 1; secondIndex <= second.length; secondIndex += 1) {
      const substitutionCost =
        first[firstIndex - 1] === second[secondIndex - 1] ? 0 : 1;
      current[secondIndex] = Math.min(
        (current[secondIndex - 1] ?? 0) + 1,
        (previous[secondIndex] ?? 0) + 1,
        (previous[secondIndex - 1] ?? 0) + substitutionCost,
      );
    }

    previous.splice(0, previous.length, ...current);
  }

  const distance = previous[second.length] ?? longestLength;
  return 1 - distance / longestLength;
}

function diceCoefficient(first: string, second: string): number {
  const firstBigrams = countBigrams(first.replace(/\s+/g, " "));
  const secondBigrams = countBigrams(second.replace(/\s+/g, " "));
  const totalBigrams = sumCounts(firstBigrams) + sumCounts(secondBigrams);

  if (totalBigrams === 0) {
    return 0;
  }

  let overlap = 0;
  for (const [bigram, count] of firstBigrams) {
    overlap += Math.min(count, secondBigrams.get(bigram) ?? 0);
  }

  return (2 * overlap) / totalBigrams;
}

function countBigrams(text: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (let index = 0; index < text.length - 1; index += 1) {
    const bigram = text.slice(index, index + 2);
    counts.set(bigram, (counts.get(bigram) ?? 0) + 1);
  }
  return counts;
}

function sumCounts(counts: Map<string, number>): number {
  let total = 0;
  for (const count of counts.values()) {
    total += count;
  }
  return total;
}

function tokenContainment(first: string, second: string): number {
  const firstTokens = contentTokens(first);
  const secondTokens = contentTokens(second);
  const smallestSize = Math.min(firstTokens.size, secondTokens.size);

  if (smallestSize === 0) {
    return 0;
  }

  let intersectionSize = 0;
  for (const token of firstTokens) {
    if (secondTokens.has(token)) {
      intersectionSize += 1;
    }
  }

  return intersectionSize / smallestSize;
}

function contentTokens(text: string): Set<string> {
  return new Set(
    text
      .split(" ")
      .filter((token) =>
        token.length >= 3 && !SIMILARITY_STOP_WORDS.has(token)
      ),
  );
}
