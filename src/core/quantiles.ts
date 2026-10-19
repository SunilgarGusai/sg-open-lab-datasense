import { assertFiniteNumbers } from "./numeric.js";

/** Hyndman–Fan Type 7 / NumPy method='linear', with p in [0,1]. */
export function quantileType7(values: readonly number[], p: number): number | null {
  if (!Number.isFinite(p) || p < 0 || p > 1) throw new RangeError("Quantile probability must be between 0 and 1.");
  assertFiniteNumbers(values);
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return quantileType7Sorted(sorted, p);
}

/** Internal helper: input must already be ascending. */
export function quantileType7Sorted(sorted: readonly number[], p: number): number {
  if (!Number.isFinite(p) || p < 0 || p > 1) throw new RangeError("Quantile probability must be between 0 and 1.");
  if (sorted.length === 0) throw new RangeError("Quantile undefined for empty data.");
  if (p === 0) return sorted[0]!;
  if (p === 1) return sorted[sorted.length - 1]!;
  const h = (sorted.length - 1) * p;
  const i = Math.floor(h);
  const weight = h - i;
  const a = sorted[i]!;
  const b = sorted[Math.min(i + 1, sorted.length - 1)]!;
  if (weight === 0) return a;
  // This interpolation reduces cancellation for nearby values.
  const v = a + weight * (b - a);
  if (Number.isFinite(v)) return v;
  // Fallback for extremes where subtraction may overflow but result is finite.
  return (1 - weight) * a + weight * b;
}

export function percentileType7(values: readonly number[], percentile: number): number | null {
  if (!Number.isFinite(percentile) || percentile < 0 || percentile > 100) throw new RangeError("Percentile must be between 0 and 100.");
  return quantileType7(values, percentile / 100);
}
