import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarize, buildFrequency } from '../dist/index.js';
import { explainStatistic } from '../dist/education/explain.js';

function explain(values, metric, distribution) {
  return explainStatistic(values, summarize(values), metric, distribution);
}
test('DS16-01: reference mean explanation follows validated result', () => {
  const x = explain([1,2,3,4], 'mean');
  assert.match(x.conclusion, /2\.5/);
  assert.ok(x.steps.some(step => /10/.test(step)));
  assert.match(x.formula, /number of valid observations/);
});
test('DS16-02: Type-7 quartiles expose exact ranks and interpolation', () => {
  const q1=explain([4,1,3,2],'q1');
  const q3=explain([4,1,3,2],'q3');
  assert.match(q1.conclusion,/1\.75/);
  assert.match(q3.conclusion,/3\.25/);
  assert.ok(q1.steps.some(step=>/0\.75/.test(step)));
  assert.ok(q3.steps.some(step=>/2\.25/.test(step)));
});
test('DS16-03: median shows ordered observations', () => {
  const x=explain([8,1,3,2],'median');
  assert.match(x.conclusion,/2\.5/);
  assert.ok(x.steps.some(step=>/1, 2, 3, 8/.test(step)));
});
test('DS16-04: variance denominators and singleton undefined status are explicit', () => {
  assert.match(explain([1,2,3,4],'populationVariance').conclusion,/1\.25/);
  assert.match(explain([1,2,3,4],'sampleVariance').conclusion,/1\.66666666667/);
  assert.match(explain([5],'sampleVariance').conclusion,/Undefined/);
  assert.match(explain([5],'sampleVariance').formula,/n ≥ 2/);
});
test('DS16-05: empty samples never fabricate a result', () => {
  assert.match(explain([],'mean').conclusion,/Undefined/);
  assert.match(explain([],'q1').conclusion,/Undefined/);
  assert.match(explain([],'populationVariance').conclusion,/Undefined/);
});
test('DS16-06: grouped frequency counts reconcile without affecting source statistics', () => {
  const values=[0,1,2,3],distribution=buildFrequency(values,2);
  const e=explain(values,'frequency',distribution);
  assert.match(e.conclusion,/4 of 4/);
  assert.ok(e.steps.some(step=>/cumulative/.test(step)));
  assert.equal(summarize(values).mean,1.5);
});
test('DS16-07: incomplete or inconsistent explanation inputs reject explicitly', () => {
  const values=[1,2];
  assert.throws(()=>explainStatistic(values,summarize([1]),'mean'),/same finite observations/);
  assert.throws(()=>explainStatistic([1,NaN],summarize([1,2]),'median'),/same finite observations/);
  assert.throws(()=>explainStatistic(values,summarize(values),'frequency',buildFrequency([1,2,3],2)),/matching grouped results/);
});
test('DS16-08: larger datasets do not print all raw observations', () => {
  const x=explain(Array.from({length:150},(_,i)=>i),'mean');
  assert.ok(x.steps.some(step=>/large dataset is summarized/.test(step)));
  assert.ok(x.steps.every(step=>step.length<250));
});
test('DS16-09: rounding note distinguishes explanation from source calculation', () => {
  const x=explain([1e12,1e12+1,1e12+2],'populationVariance');
  assert.match(x.note,/Welford/);
  assert.match(x.note,/rounded/);
});
