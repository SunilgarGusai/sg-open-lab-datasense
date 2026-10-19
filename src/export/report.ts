/** Dependency-free reproducibility exports. Public reports contain aggregated results, never raw rows. */
import type { NumericColumn, NumericSummary, FrequencyDistribution, OgivePoint, BoxPlotSummary } from '../domain/types.js';

export interface ExportContext {
  readonly sourceName: string;
  readonly sourceBytes: number;
  readonly sourceSha256: string | null;
  readonly columnId: string;
  readonly columnName: string;
  readonly appVersion: string;
  readonly requestedBins: number;
}

/** Treat text as untrusted spreadsheet data even when it will be quoted. */
export function csvSafeText(value: string): string {
  // Control/invisible prefixes can be used to hide a spreadsheet formula introducer.
  // A leading literal apostrophe forces spreadsheet text treatment; add a second if input starts with one.
  if (/^[\s\u0000-\u001f\u007f\ufeff\u200b-\u200f\u2060]*[=+\-@]/u.test(value) ||
      /^[\t\r\n']/u.test(value)) return "'" + value;
  return value;
}
function csvCell(value: string | number | null): string {
  const safe = typeof value === 'number' ? (Number.isFinite(value) ? String(value) : '') : csvSafeText(value ?? '');
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}
export function serializeCsv(rows: readonly (readonly (string | number | null)[])[]): string {
  if (rows.length === 0) throw new RangeError('CSV must have a header row.');
  const width = rows[0]!.length;
  if (!width || rows.some(row => row.length !== width)) throw new RangeError('CSV rows must have equal nonzero lengths.');
  return rows.map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n';
}

export function summaryCsv(summary: NumericSummary, column: NumericColumn, ctx: ExportContext): string {
  const values: [string, number | string | null][] = [
    ['dataset',ctx.sourceName], ['column',ctx.columnName], ['source_sha256',ctx.sourceSha256 ?? 'unavailable'],
    ['total_rows',column.totalRows],['valid_rows',column.validCount],['missing_rows',column.missingCount],
    ['invalid_rows',column.invalidCount],['mean',summary.mean],['median',summary.median],
    ['minimum',summary.min],['maximum',summary.max],['range',summary.range],['sum',summary.sum],
    ['q1_type7',summary.q1],['q3_type7',summary.q3],['iqr',summary.iqr],
    ['population_variance',summary.populationVariance],['sample_variance',summary.sampleVariance],
    ['population_sd',summary.populationStandardDeviation], ['sample_sd',summary.sampleStandardDeviation],
    ['mode_status',summary.modeStatus], ['mode_values', summary.mode.join('; ')],
    ['quantile_method',summary.method.quantiles], ['variance_method',summary.method.variance],
    ['app_version',ctx.appVersion]
  ];
  // CSV is key/value rather than values interpreted as column headings.
  return serializeCsv([['metric','value'], ...values]);
}
export function frequencyCsv(dist: FrequencyDistribution): string {
  return serializeCsv([['lower_bound','upper_bound','lower_included','upper_included','frequency','cumulative_frequency','relative_frequency'],
    ...dist.bins.map(b=>[b.lower,b.upper,'yes',b.rightClosed?'yes':'no',b.count,b.cumulativeCount,b.relativeFrequency])]);
}
export function ogiveCsv(points: readonly OgivePoint[]): string {
  return serializeCsv([['upper_class_boundary','cumulative_frequency','cumulative_percent'],...points.map(p=>[p.x,p.cumulative,p.percent])]);
}
export function boxplotCsv(box: BoxPlotSummary): string {
  return serializeCsv([['measure','value'],
    ...([['q1_type7',box.q1], ['median_type7',box.median], ['q3_type7',box.q3],['iqr',box.iqr],
      ['lower_fence',box.lowerFence],['upper_fence',box.upperFence],['lower_observed_whisker',box.lowerWhisker],
      ['upper_observed_whisker',box.upperWhisker],['outlier_count',box.outliers.length],
      ['outlier_values',box.outliers.join('; ')]] as [string, string | number | null][])]);
}
export interface AnalysisManifest {
  readonly schema: 'sg-datasense-analysis-v1';
  readonly app: { readonly name:'SG Open Lab DataSense'; readonly version:string };
  readonly source: {readonly name:string;readonly bytes:number;readonly sha256:string|null};
  readonly selection: {readonly id:string;readonly label:string};
  readonly dataQuality: {readonly total:number;readonly valid:number;readonly missing:number;readonly invalid:number};
  readonly definitions: {readonly quantiles:string;readonly variance:string;readonly missingValues:string;readonly binning:string;readonly boxplot:string;readonly outliers:string};
  readonly frequency: {readonly requestedBins:number;readonly actualBins:number;readonly isConstant:boolean};
  readonly computed: {readonly summary:NumericSummary;readonly bins:FrequencyDistribution['bins'];readonly ogive:readonly OgivePoint[];readonly boxplot:BoxPlotSummary};
  readonly warnings: readonly string[];
}
export function analysisManifest(ctx: ExportContext, column:NumericColumn, summary:NumericSummary, dist:FrequencyDistribution,
  ogive:readonly OgivePoint[],box:BoxPlotSummary): AnalysisManifest {
  if (column.totalRows !== column.validCount+column.missingCount+column.invalidCount ||
      column.validCount!==summary.n || dist.n!==summary.n)
    throw new Error('Refusing to export internally inconsistent data.');
  return {
    schema:'sg-datasense-analysis-v1',app:{name:'SG Open Lab DataSense',version:ctx.appVersion},
    source:{name:ctx.sourceName,bytes:ctx.sourceBytes,sha256:ctx.sourceSha256},
    selection:{id:ctx.columnId,label:ctx.columnName},
    dataQuality:{total:column.totalRows,valid:column.validCount,missing:column.missingCount,invalid:column.invalidCount},
    definitions:{quantiles:'Hyndman-Fan Type 7 (linear interpolation)',variance:'Welford, population n / sample n-1',
      missingValues:'blank, NA, N/A, null, hyphen (trimmed; case-insensitive)',binning:dist.binning,
      boxplot:'Type-7 quartiles, 1.5*IQR Tukey-style fences, whiskers at extreme observed in-fence values',
      outliers:'observations outside fences (not removed from descriptive statistics)'},
    frequency:{requestedBins:ctx.requestedBins,actualBins:dist.bins.length,isConstant:dist.isConstant},
    computed:{summary,bins:dist.bins,ogive,boxplot:box},
    warnings:['Statistical results apply only to valid numeric observations in the selected column.',
      'Histogram and ogive are grouped approximations; the box plot uses ungrouped observations.',
      ...(ctx.sourceSha256?[]:['Source SHA-256 unavailable in this environment; verify the original CSV independently.'])]
  };
}
export function manifestJson(value: AnalysisManifest): string { return JSON.stringify(value,null,2)+'\n'; }
export function safeBaseName(name:string):string {
  const slug=name.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,45).toLowerCase();
  return slug || 'dataset';
}
