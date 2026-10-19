import type { NumericSummary, ModeStatus } from "../domain/types.js";
import { assertFiniteNumbers } from "./numeric.js";
import { quantileType7Sorted } from "./quantiles.js";

const METHOD = { quantiles: "Hyndman-Fan-7", variance: "Welford-offset-stabilized", missingPolicy: "blank-NA-N/A-null-hyphen" } as const;

/**
 * Uses a fixed-offset form of Welford to reduce catastrophic cancellation.
 * Values near a large offset (e.g. 1e12+0,1,2) remain numerically stable.
 */
export function summarize(values: readonly number[]): NumericSummary {
  assertFiniteNumbers(values);
  const n = values.length;
  if (n === 0) {
    return { n, sum: null, min: null, max: null, range: null, mean: null,
      median: null, q1: null, q3: null, iqr: null, populationVariance: null,
      sampleVariance: null, populationStandardDeviation: null, sampleStandardDeviation: null,
      mode: [], modeStatus: "undefined", method: METHOD };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const offset = sorted[0]!;
  let meanShift = 0;
  let m2 = 0;
  // Welford on shifted values has improved accuracy with large common offsets.
  for (let i = 0; i < n; i++) {
    const shifted = values[i]! - offset;
    const delta = shifted - meanShift;
    meanShift += delta / (i + 1);
    const delta2 = shifted - meanShift;
    m2 += delta * delta2;
  }
  // Compensated summation gives a transparent sum while avoiding naive accumulation.
  let total = 0;
  let compensation = 0;
  for (const v of values) {
    const t = total + v;
    if (Math.abs(total) >= Math.abs(v)) compensation += (total - t) + v;
    else compensation += (v - t) + total;
    total = t;
  }
  const safeSum = total + compensation;
  const mean = offset + meanShift;
  // Small negative roundoff from Welford can occur; clamp only at 0.
  const populationVariance = Math.max(0, m2 / n);
  const sampleVariance = n > 1 ? Math.max(0, m2 / (n - 1)) : null;
  const q1 = quantileType7Sorted(sorted, .25);
  const q3 = quantileType7Sorted(sorted, .75);
  const median = quantileType7Sorted(sorted, .5);
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  const maxCount = Math.max(...counts.values());
  const mode: number[] = maxCount > 1 ? [...counts].filter(([, k]) => k === maxCount).map(([k]) => k).sort((a, b) => a - b) : [];
  const modeStatus: ModeStatus = maxCount <= 1 ? "no-informative-mode" : mode.length === 1 ? "single" : "multiple";
  const min = sorted[0]!;
  const max = sorted[n - 1]!;
  return {
    n,
    sum: Number.isFinite(safeSum) ? safeSum : null,
    min,
    max,
    range: Number.isFinite(max - min) ? max - min : null,
    mean: Number.isFinite(mean) ? mean : null,
    median,
    q1,
    q3,
    iqr: q3 - q1,
    populationVariance: Number.isFinite(populationVariance) ? populationVariance : null,
    sampleVariance: sampleVariance !== null && Number.isFinite(sampleVariance) ? sampleVariance : null,
    populationStandardDeviation: Number.isFinite(populationVariance) ? Math.sqrt(populationVariance) : null,
    sampleStandardDeviation: sampleVariance !== null && Number.isFinite(sampleVariance) ? Math.sqrt(sampleVariance) : null,
    mode,
    modeStatus,
    method: METHOD
  };
}
