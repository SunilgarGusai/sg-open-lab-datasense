/** Versioned browser/worker contract: only selected-column aggregates cross the boundary. */
import type { NumericSummary, FrequencyDistribution, OgivePoint, BoxPlotSummary, NumericColumn } from '../domain/types.js';
import type { AnalysisManifest } from '../export/report.js';
import type { CalculationExplanation, ExplanationMetric } from '../education/explain.js';

export type NumericCounts = Pick<NumericColumn, 'totalRows'|'validCount'|'missingCount'|'invalidCount'>;
export type AnalysisResult = {
  readonly id: number;
  readonly columnId: string;
  readonly display: string;
  readonly numeric: NumericCounts;
  readonly summary: NumericSummary | null;
  readonly frequency: FrequencyDistribution | null;
  readonly ogive: readonly OgivePoint[];
  readonly boxplot: BoxPlotSummary | null;
  readonly manifest: AnalysisManifest | null;
  readonly explanations: Partial<Record<ExplanationMetric, CalculationExplanation>>;
};
export type WorkerInput =
  | {readonly type:'load';readonly id:number;readonly title:string;readonly buffer:ArrayBuffer;readonly bins:string}
  | {readonly type:'analyze';readonly id:number;readonly columnId:string;readonly bins:string};
export type WorkerOutput =
  | {readonly type:'progress'; readonly id:number;readonly stage:string}
  | {readonly type:'loaded';readonly id:number;readonly title:string; readonly byteLength:number;
     readonly sha256:string|null;readonly totalRows:number;
     readonly headers:readonly {id:string;display:string;validCount:number;eligible:boolean}[];
     readonly warnings:readonly string[];readonly previewHeaders:readonly string[];
     readonly previewRows:readonly (readonly string[])[];readonly analysis:AnalysisResult}
  | {readonly type:'analyzed';readonly id:number;readonly analysis:AnalysisResult}
  | {readonly type:'error';readonly id:number;readonly code:string;readonly message:string};
