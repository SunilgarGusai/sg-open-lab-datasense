import type { BoxPlotSummary } from "../domain/types.js";
import { assertFiniteNumbers } from "./numeric.js";
import { quantileType7Sorted } from "./quantiles.js";

/** Tukey-style 1.5*IQR fences, whiskers at most extreme observed in-fence values. */
export function makeBoxPlot(values: readonly number[]): BoxPlotSummary {
  assertFiniteNumbers(values);
  if (!values.length) return { q1:null, median:null, q3:null, iqr:null, lowerFence:null, upperFence:null,
    lowerWhisker:null, upperWhisker:null, outliers:[] };
  const sorted = [...values].sort((a,b)=>a-b);
  const q1 = quantileType7Sorted(sorted,.25);
  const median = quantileType7Sorted(sorted,.5);
  const q3 = quantileType7Sorted(sorted,.75);
  const iqr = q3-q1;
  const lowerFence = q1-1.5*iqr;
  const upperFence = q3+1.5*iqr;
  const inside = sorted.filter(x=>x>=lowerFence && x<=upperFence);
  if (!inside.length) throw new Error("Internal boxplot error: no values within IQR fences.");
  return {q1,median,q3,iqr,lowerFence,upperFence,
    lowerWhisker:inside[0]!,upperWhisker:inside[inside.length-1]!,
    outliers:sorted.filter(x=>x<lowerFence||x>upperFence)};
}
