/** Educational explanations derived from validated computations, never a replacement for them. */
import type { FrequencyDistribution, NumericSummary } from '../domain/types.js';

export type ExplanationMetric =
  'mean' | 'median' | 'q1' | 'q3' | 'populationVariance' | 'sampleVariance' | 'frequency';

export interface CalculationExplanation {
  readonly title: string;
  readonly formula: string;
  readonly steps: readonly string[];
  readonly conclusion: string;
  readonly note: string;
}

function display(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return 'Undefined or unavailable';
  return Number(value.toPrecision(12)).toString();
}

export function explainStatistic(
  values: readonly number[], summary: NumericSummary, metric: ExplanationMetric,
  frequency?: FrequencyDistribution
): CalculationExplanation {
  if (summary.n !== values.length || values.some(v => !Number.isFinite(v))) {
    throw new Error('Explanation requires the same finite observations used for the validated summary.');
  }
  const n = values.length;
  const preview = n <= 12 ? 'Valid observations: ' + values.map(display).join(', ') + '.' :
    'A large dataset is summarized rather than displaying all original observations.';
  const note = 'Educational arithmetic may be displayed with rounded values. The published statistic comes from the validated numerical engine; excluded CSV values do not participate.';
  if (metric === 'mean') {
    return {
      title: 'Arithmetic mean', formula: 'Mean = sum of valid observations / number of valid observations.',
      steps: [preview, 'Number of valid observations (n) = ' + n + '.',
        'Sum from the validated engine = ' + display(summary.sum) + '.',
        n ? 'Mean = ' + display(summary.sum) + ' / ' + n + ' = ' + display(summary.mean) + '.' :
          'There are no valid observations, so the mean is undefined.'],
      conclusion: 'Reported mean: ' + display(summary.mean) + '.', note
    };
  }
  if (metric === 'median' || metric === 'q1' || metric === 'q3') {
    const p = metric === 'median' ? 0.5 : metric === 'q1' ? 0.25 : 0.75;
    const result = metric === 'median' ? summary.median : metric === 'q1' ? summary.q1 : summary.q3;
    const title = metric === 'median' ? 'Median' : metric === 'q1' ? 'First quartile (Q1)' : 'Third quartile (Q3)';
    const steps: string[] = ['Use only the ' + n + ' valid numerical observations.', 'Probability p = ' + p + '.'];
    if (n) {
      const sorted = [...values].sort((a, b) => a - b);
      if (n <= 12) steps.push('Sorted observations: ' + sorted.map(display).join(', ') + '.');
      const h = (n - 1) * p, j = Math.floor(h), g = h - j;
      const low = sorted[j]!, high = sorted[Math.min(j + 1, n - 1)]!;
      steps.push('Zero-based Type-7 position h = (n - 1) × p = ' + display(h) + '.');
      steps.push('Lower sorted position j = ' + j + '; interpolation fraction g = ' + display(g) + '.');
      steps.push('Adjacent values: x[' + (j + 1) + '] = ' + display(low) +
        ' and x[' + (Math.min(j + 1, n - 1) + 1) + '] = ' + display(high) + ' (positions shown one-based).');
      steps.push('Interpolate: lower + g × (upper - lower).');
    } else steps.push('No quantile exists for an empty valid dataset.');
    return { title, formula: 'Type-7 quantile: h = (n - 1)p, j = floor(h), g = h - j; Q(p) = x[j] + g(x[j + 1] - x[j]), using zero-based indexing.',
      steps, conclusion: 'Reported ' + title.toLowerCase() + ': ' + display(result) + '.', note };
  }
  if (metric === 'populationVariance' || metric === 'sampleVariance') {
    const sample = metric === 'sampleVariance';
    const result = sample ? summary.sampleVariance : summary.populationVariance;
    const divisor = sample ? n - 1 : n;
    const steps = [preview, 'Valid observation count n = ' + n + '.',
      'Mean from the validated engine = ' + display(summary.mean) + '.',
      'For each valid observation, consider its squared deviation (xᵢ - mean)².',
      'Divisor = ' + (sample ? 'n - 1 = ' : 'n = ') + divisor + '.',
      result === null ? 'The selected variance is undefined or numerically unavailable.' :
        'The offset-stabilized Welford algorithm evaluates the variance without relying on naive large-number subtraction.'];
    return {
      title: sample ? 'Sample variance' : 'Population variance',
      formula: sample ? 's² = Σ(xᵢ - mean)² / (n - 1); requires n ≥ 2.' :
        'σ² = Σ(xᵢ - mean)² / n; requires n ≥ 1.',
      steps, conclusion: 'Reported ' + (sample ? 'sample' : 'population') + ' variance: ' + display(result) + '.',
      note: note + ' This conceptual sum-of-squares formula is implemented through a numerically stabilized Welford recurrence.'
    };
  }
  if (metric === 'frequency') {
    if (!frequency || frequency.n !== n) throw new Error('Frequency explanation requires matching grouped results.');
    const count = frequency.bins.reduce((sum, bin) => sum + bin.count, 0);
    const steps = [
      'Valid observations n = ' + n + '; requested groups = ' + frequency.requestedBins +
      '; actual groups = ' + frequency.bins.length + '.',
      frequency.isConstant ? 'All observations coincide; a single nonzero-width group is used.' :
        'The observed range is divided into equal-width groups.',
      'Group boundaries are left-inclusive. The rightmost upper boundary is also inclusive.',
      ...frequency.bins.slice(0, 8).map((bin, i) => 'Group ' + (i + 1) + ': [' +
        display(bin.lower) + ', ' + display(bin.upper) + (bin.rightClosed ? ']': ')') +
        ', frequency = ' + bin.count + ', cumulative = ' + bin.cumulativeCount + '.'),
      ...(frequency.bins.length > 8 ? ['Remaining groups omitted here; use the exact frequency table.'] : []),
      'Sum of all group counts = ' + count + ' (must equal valid observations n = ' + n + ').'
    ];
    return {
      title: 'Grouped frequency distribution',
      formula: 'Relative frequency = group count / n; cumulative frequency = sum of counts through that group.',
      steps, conclusion: 'Frequency reconciliation: ' + count + ' of ' + n + ' valid observations.',
      note: 'Frequency grouping is a summary of ungrouped data. Changing group boundaries changes grouped results but not descriptive statistics.'
    };
  }
  throw new Error('Unsupported explanation metric.');
}
