import { test } from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {summarize, cleanNumericColumn, parseNumericCell,quantileType7,percentileType7,
  buildFrequency,makeOgive,makeBoxPlot,sturgesBinCount} from '../dist/index.js';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/numpy-oracle.json',import.meta.url),'utf-8'));
function near(actual,expected,label,tolerance=1e-10) {
  if (expected === null) return assert.equal(actual,null,label);
  assert.ok(typeof actual==='number' && Number.isFinite(actual),`${label}: must be finite; got ${actual}`);
  // relative tolerance scaled to the result rather than data magnitude, important for variance at large offsets.
  const err=Math.abs(actual-expected);
  assert.ok(err <= tolerance*Math.max(1,Math.abs(expected)), `${label}: ${actual} != ${expected}, delta ${err}`);
}

for (const [name,item] of Object.entries(fixture.cases)) {
  test(`NumPy reference ${name}`,()=>{
    const result=summarize(item.data);
    for (const [k,expected] of Object.entries(item.expected)) {
      if (k==='p10'||k==='p90') near(percentileType7(item.data,k==='p10'?10:90),expected,`${name}.${k}`);
      else near(result[k],expected,`${name}.${k}`);
    }
    assert.equal(result.method.quantiles,'Hyndman-Fan-7');
  });
}

test('DS-T001-004: basic reference values',()=>{
  const r=summarize([1,2,3,4]);
  assert.equal(r.sum,10);assert.equal(r.mean,2.5);assert.equal(r.median,2.5);
  assert.equal(r.min,1);assert.equal(r.max,4);assert.equal(r.range,3);
  assert.equal(r.q1,1.75);assert.equal(r.q3,3.25);assert.equal(r.iqr,1.5);
  assert.equal(r.populationVariance,1.25);
  near(r.sampleVariance,5/3,'sample variance');
});

test('DS-T005-007: singleton empty constant',()=>{
  const one=summarize([10]);assert.equal(one.populationVariance,0);assert.equal(one.sampleVariance,null);
  const none=summarize([]);assert.equal(none.n,0);assert.equal(none.mean,null);assert.equal(none.q1,null);
  const constant=summarize([5,5,5,5]);assert.equal(constant.iqr,0);assert.deepEqual(constant.mode,[5]);
  assert.equal(makeBoxPlot([5,5,5,5]).outliers.length,0);
});

test('DS-T008-010: multimode and no informative mode',()=>{
  assert.deepEqual(summarize([1,1,2,3]).mode,[1]);
  assert.deepEqual(summarize([1,1,2,2,3]).mode,[1,2]);
  assert.equal(summarize([1,2,3]).modeStatus,'no-informative-mode');
});

test('DS-T011-016: numeric validation, exclusions, zeros, scientific, nonfinite',()=>{
  assert.equal(summarize([-10,-5,0,5]).mean,-2.5);
  const mixed=cleanNumericColumn(['2','NA','4','','N/A']);
  assert.deepEqual([mixed.validCount,mixed.missingCount,mixed.invalidCount],[2,3,0]);
  assert.equal(summarize(mixed.values).mean,3);
  const invalid=cleanNumericColumn(['2','hello','4']);
  assert.deepEqual([invalid.validCount,invalid.invalidCount],[2,1]);
  const zeros=cleanNumericColumn(['0','0','2']);
  assert.equal(zeros.validCount,3); assert.deepEqual(zeros.values,[0,0,2]);
  assert.deepEqual(cleanNumericColumn(['1e2','-2.5E1']).values,[100,-25]);
  assert.deepEqual([cleanNumericColumn(['NaN','Infinity','1']).validCount,
    cleanNumericColumn(['NaN','Infinity','1']).invalidCount],[1,2]);
  assert.equal(parseNumericCell('1,234').kind,'invalid');
  assert.equal(parseNumericCell('0x10').kind,'invalid');
});

test('DS-T026-027: bin totals, endpoints and relative frequency',()=>{
  const d=buildFrequency([1,2,2,3,4],4);
  assert.equal(d.bins.reduce((s,b)=>s+b.count,0),5);
  assert.equal(d.bins.at(-1).cumulativeCount,5);
  near(d.bins.reduce((s,b)=>s+b.relativeFrequency,0),1,'relative frequencies');
  const b=buildFrequency([0,1,2,3],3);
  assert.deepEqual(b.bins.map(x=>x.count),[1,1,2]);
  assert.equal(b.bins.at(-1).rightClosed,true);
});

test('DS-T028-029: ogive and constant histogram geometry',()=>{
  const d=buildFrequency([0,1,2,3],2);
  const ogive=makeOgive(d);
  assert.deepEqual([ogive[0].cumulative,ogive.at(-1).cumulative],[0,4]);
  assert.equal(ogive[0].x,d.bins[0].lower);
  const c=buildFrequency([4,4,4],10);
  assert.equal(c.bins.length,1);assert.equal(c.bins[0].count,3);
  assert.ok(c.bins[0].upper>c.bins[0].lower);
});

test('DS-T030: outlier flagging, observed whiskers',()=>{
  const b=makeBoxPlot([1,2,3,4,100]);
  assert.deepEqual([b.lowerWhisker,b.upperWhisker],[1,4]);
  assert.deepEqual(b.outliers,[100]);
});

test('DS-T031: stable large offsets',()=>{
  const s=summarize([1e12,1e12+1,1e12+2]);
  near(s.populationVariance,2/3,'offset variance',1e-12);
  near(s.sampleVariance,1,'offset sample variance',1e-12);
});

test('DS-T039-042: missing, ties, reorder and endpoints',()=>{
  assert.equal(summarize(cleanNumericColumn(['','NA']).values).mean,null);
  assert.equal(summarize([2,2,2,3]).median,2);
  assert.equal(summarize([4,1,3,2]).populationVariance,summarize([1,2,3,4]).populationVariance);
  assert.equal(percentileType7([1,3,10],0),1);
  assert.equal(percentileType7([1,3,10],100),10);
  assert.throws(()=>quantileType7([1,2],1.5),RangeError);
  assert.throws(()=>percentileType7([1,2],101),RangeError);
  assert.throws(()=>summarize([1,NaN]),TypeError);
});

test('DS-T043-044: regrouping does not affect statistics; runs deterministic',()=>{
  const input=[1,2,3,4,5];
  const fine=buildFrequency(input,5);
  const coarse=buildFrequency(input,2);
  assert.equal(fine.bins.reduce((s,b)=>s+b.count,0),input.length);
  assert.equal(coarse.bins.reduce((s,b)=>s+b.count,0),input.length);
  assert.deepEqual(buildFrequency(input,5),fine);
  assert.deepEqual(summarize(input),summarize(input));
  assert.equal(sturgesBinCount(0),1);
});

test('property: 200 deterministic datasets preserve exact frequency membership',()=>{
  let state=193981;
  const rand=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  for(let trial=0;trial<200;trial++){
    const n=1+Math.floor(rand()*140);
    const values=Array.from({length:n},()=>Math.floor((rand()-.3)*400)/7);
    const bins=1+Math.floor(rand()*20);
    const d=buildFrequency(values,bins);
    assert.equal(d.bins.reduce((a,b)=>a+b.count,0),n);
    assert.equal(d.bins.at(-1).cumulativeCount,n);
    for (const [i,b] of d.bins.entries()) {
      const count=values.filter(x=>x>=b.lower && (i===d.bins.length-1?x<=b.upper:x<b.upper)).length;
      assert.equal(b.count,count,`trial ${trial}, bin ${i}`);
    }
  }
});

test('performance smoke: 50,000 values analyze without argument exhaustion',()=>{
  const values=Array.from({length:50000},(_,i)=>i%421);
  const stats=summarize(values);
  assert.equal(stats.n,50000);
  const histogram=buildFrequency(values,30);
  assert.equal(histogram.bins.reduce((s,b)=>s+b.count,0),50000);
});
