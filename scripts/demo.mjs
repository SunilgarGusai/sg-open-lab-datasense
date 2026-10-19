import {summarize,cleanNumericColumn,buildFrequency,makeOgive,makeBoxPlot} from '../dist/index.js';
const raw = ['12','15','18','18','21','24','27','30','33','36','NA','oops'];
const cleaned = cleanNumericColumn(raw);
const summary = summarize(cleaned.values);
const bins = buildFrequency(cleaned.values,5);
const report = {
  input: {total:cleaned.totalRows,valid:cleaned.validCount,missing:cleaned.missingCount,invalid:cleaned.invalidCount},
  statistics:{n:summary.n,mean:summary.mean,median:summary.median,q1:summary.q1,q3:summary.q3,
    populationVariance:summary.populationVariance,sampleVariance:summary.sampleVariance},
  frequency:bins.bins,ogive:makeOgive(bins),boxplot:makeBoxPlot(cleaned.values)
};
process.stdout.write(JSON.stringify(report,null,2)+'\n');
