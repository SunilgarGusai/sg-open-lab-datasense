import type { FrequencyDistribution, OgivePoint } from "../domain/types.js";
import { assertFiniteNumbers } from "./numeric.js";

export function sturgesBinCount(n: number): number {
  if (!Number.isSafeInteger(n) || n < 0) throw new RangeError("n must be a nonnegative safe integer.");
  return Math.max(1, Math.min(30, Math.ceil(1 + Math.log2(Math.max(n, 1)))));
}

/**
 * Deterministic equal-width bins: [lower,upper), except last [lower,upper].
 * Constant data intentionally gets one non-zero-width bin irrespective of request.
 */
export function buildFrequency(values: readonly number[], requestedBinCount?: number): FrequencyDistribution {
  assertFiniteNumbers(values);
  const n = values.length;
  const requestedBins = requestedBinCount ?? sturgesBinCount(n);
  if (!Number.isInteger(requestedBins) || requestedBins < 1 || requestedBins > 50)
    throw new RangeError("Number of bins must be an integer in [1,50].");
  if (n === 0) return { n, requestedBins, bins: [], isConstant: false, binning: "equal-width-left-closed-final-right-closed" };
  const min = Math.min(...values);
  const max = Math.max(...values);
  const constant = min === max;
  if (constant) {
    const half = Math.max(Math.abs(min) * 1e-6, 0.5);
    const lower = min - half;
    const upper = min + half;
    if (!Number.isFinite(lower) || !Number.isFinite(upper) || lower === upper)
      throw new RangeError("Cannot construct a nonzero-width constant-data bin at this magnitude.");
    return { n, requestedBins, isConstant: true, binning: "equal-width-left-closed-final-right-closed",
      bins: [{ lower, upper, count: n, cumulativeCount: n, relativeFrequency: 1, rightClosed: true }] };
  }
  const range = max - min;
  if (!Number.isFinite(range)) throw new RangeError("Data range exceeds representable floating-point precision.");
  const width = range / requestedBins;
  if (width === 0) throw new RangeError("Cannot represent a positive bin width for this range.");
  const bounds = Array.from({length: requestedBins + 1},(_,i)=>i === requestedBins ? max : min + width*i);
  // Avoid displaying bins with mathematically impossible zero-width intervals.
  for (let i = 0; i < requestedBins; i++) {
    if (!(bounds[i+1]! > bounds[i]!)) throw new RangeError("Bin boundaries collapse at binary64 precision; try fewer bins.");
  }
  const counts = Array(requestedBins).fill(0) as number[];
  for (const value of values) {
    // A numerical approximation chooses a candidate; exact boundary checks fix roundoff.
    let index = Math.min(requestedBins-1,Math.max(0,Math.floor((value-min)/range*requestedBins)));
    while (index > 0 && value < bounds[index]!) index--;
    while (index < requestedBins-1 && value >= bounds[index+1]!) index++;
    counts[index] = counts[index]! + 1;
  }
  let cumulativeCount = 0;
  const bins = counts.map((count,i)=>{
    cumulativeCount += count;
    return { lower: bounds[i]!, upper: bounds[i+1]!, count, cumulativeCount,
      relativeFrequency: count/n, rightClosed: i===requestedBins-1 };
  });
  if (cumulativeCount !== n) throw new Error("Internal frequency reconciliation error.");
  return { n, requestedBins, isConstant: false, bins, binning: "equal-width-left-closed-final-right-closed" };
}

/** Less-than ogive: zero at first lower bound, then cumulative at upper bounds. */
export function makeOgive(distribution: FrequencyDistribution): readonly OgivePoint[] {
  if (distribution.bins.length === 0) return [];
  const first = distribution.bins[0]!;
  return [{x: first.lower, cumulative: 0, percent: 0},
    ...distribution.bins.map(b=>({x:b.upper, cumulative:b.cumulativeCount,percent:100*b.cumulativeCount/distribution.n}))];
}
