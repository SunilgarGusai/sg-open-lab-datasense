/** Public mathematical contract; null means mathematically undefined/unavailable. */
export type ModeStatus = "single" | "multiple" | "no-informative-mode" | "undefined";

export interface NumericExclusion {
  readonly rowIndex: number; // 0-based data row, excluding header
  readonly raw: string | null | undefined;
  readonly kind: "missing" | "invalid";
}

export interface NumericColumn {
  readonly values: readonly number[];
  readonly totalRows: number;
  readonly validCount: number;
  readonly missingCount: number;
  readonly invalidCount: number;
  readonly exclusions: readonly NumericExclusion[];
}

export interface NumericSummary {
  readonly n: number;
  readonly sum: number | null;
  readonly min: number | null;
  readonly max: number | null;
  readonly range: number | null;
  readonly mean: number | null;
  readonly median: number | null;
  readonly q1: number | null;
  readonly q3: number | null;
  readonly iqr: number | null;
  readonly populationVariance: number | null;
  readonly sampleVariance: number | null;
  readonly populationStandardDeviation: number | null;
  readonly sampleStandardDeviation: number | null;
  readonly mode: readonly number[];
  readonly modeStatus: ModeStatus;
  readonly method: {
    readonly quantiles: "Hyndman-Fan-7";
    readonly variance: "Welford-offset-stabilized";
    readonly missingPolicy: "blank-NA-N/A-null-hyphen";
  };
}

export interface Bin {
  readonly lower: number;
  readonly upper: number;
  readonly count: number;
  readonly cumulativeCount: number;
  readonly relativeFrequency: number;
  readonly rightClosed: boolean;
}

export interface FrequencyDistribution {
  readonly n: number;
  readonly requestedBins: number;
  readonly bins: readonly Bin[];
  readonly isConstant: boolean;
  readonly binning: "equal-width-left-closed-final-right-closed";
}

export interface OgivePoint { readonly x: number; readonly cumulative: number; readonly percent: number; }

export interface BoxPlotSummary {
  readonly q1: number | null;
  readonly median: number | null;
  readonly q3: number | null;
  readonly iqr: number | null;
  readonly lowerFence: number | null;
  readonly upperFence: number | null;
  readonly lowerWhisker: number | null;
  readonly upperWhisker: number | null;
  readonly outliers: readonly number[];
}
