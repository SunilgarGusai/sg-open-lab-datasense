import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsvText,getColumnById,summaryCsv,frequencyCsv,ogiveCsv,boxplotCsv,
  csvSafeText,serializeCsv,analysisManifest,manifestJson,safeBaseName,
  summarize,buildFrequency,makeOgive,makeBoxPlot } from '../dist/index.js';

const data=parseCsvText('value,label\n1,A\n2,B\n3,C\n4,D\n100,E\nNA,F\n');
const column=getColumnById(data,'column-0').numeric;
const summary=summarize(column.values),freq=buildFrequency(column.values,5);
const ogive=makeOgive(freq),box=makeBoxPlot(column.values);
const ctx={sourceName:'demo.csv',sourceBytes:data.byteLength,sourceSha256:'a'.repeat(64),columnId:'column-0',columnName:'value',appVersion:'0.3.0-alpha.1',requestedBins:5};

test('DS-T035 CSV escaping quoted fields and the dangerous spreadsheet formula prefixes',()=>{
  const inputs=['=1+1','+SUM(2,3)','-4+1','@cell','  =HYPERLINK(1)','\t=1+1','\n@cmd',"'=1+1",'\u200b=SUM(1,2)'];
  for(const x of inputs) assert.ok(csvSafeText(x).startsWith("'"),`unsafe prefix ${JSON.stringify(x)}`);
  assert.equal(csvSafeText('ordinary, harmless'),'ordinary, harmless');
  assert.equal(csvSafeText('negative number as text: -4'),'negative number as text: -4');
  const result=serializeCsv([['name','value'],['a,"b"\n',-3.5],['=FORMULA()','@one']]);
  const parsed=parseCsvText(result);
  assert.equal(parsed.rows[0][0],'a,"b"\n');
  assert.equal(parsed.rows[0][1],'-3.5');
  assert.equal(parsed.rows[1][0],"'=FORMULA()");
  assert.equal(parsed.rows[1][1],"'@one");
});
test('DS-T036 export filenames remove paths/control characters',()=>{
  assert.equal(safeBaseName('../../My Results.csv'),'my-results-csv');
  assert.equal(safeBaseName(''),'dataset');
});
test('DS-T032 summary CSV roundtrip and reproducibility metadata',()=>{
  const csv=summaryCsv(summary,column,ctx);
  const table=parseCsvText(csv);
  assert.deepEqual(table.headers.map(x=>x.display),['metric','value']);
  const kv=Object.fromEntries(table.rows);
  assert.equal(kv.dataset,'demo.csv');
  assert.equal(kv.valid_rows,'5');assert.equal(kv.missing_rows,'1');
  assert.equal(kv.q1_type7,'2');assert.equal(kv.q3_type7,'4');
  assert.equal(kv.source_sha256,'a'.repeat(64));
});
test('DS-T032 frequency and cumulative CSV roundtrip reconcile',()=>{
  const d=parseCsvText(frequencyCsv(freq));
  assert.equal(d.totalRows,5);
  assert.equal(d.rows.reduce((a,row)=>a+Number(row[4]),0),5);
  assert.equal(d.rows.at(-1)[5],'5');
  assert.equal(d.rows.at(-1)[3],'yes');
  assert.equal(d.rows[0][2],'yes');
  const og=parseCsvText(ogiveCsv(ogive));
  assert.equal(og.rows.at(-1)[1],'5');assert.equal(og.rows.at(-1)[2],'100');
});
test('DS-T032 exported box summary matches source quartiles and outlier count',()=>{
  const d=parseCsvText(boxplotCsv(box));const kv=Object.fromEntries(d.rows);
  assert.equal(kv.lower_observed_whisker,'1');assert.equal(kv.upper_observed_whisker,'4');
  assert.equal(kv.outlier_count,'1');assert.equal(kv.outlier_values,'100');
});
test('DS-T034 deterministic JSON manifest traceable to computation',()=>{
  const manifest=analysisManifest(ctx,column,summary,freq,ogive,box);
  const reconstructed=JSON.parse(manifestJson(manifest));
  assert.equal(reconstructed.schema,'sg-datasense-analysis-v1');
  assert.equal(reconstructed.source.sha256,'a'.repeat(64));
  assert.equal(reconstructed.definitions.quantiles,'Hyndman-Fan Type 7 (linear interpolation)');
  assert.equal(reconstructed.dataQuality.valid,5);
  assert.equal(reconstructed.computed.bins.reduce((s,b)=>s+b.count,0),5);
  assert.equal(reconstructed.computed.ogive.at(-1).percent,100);
  assert.ok(!manifestJson(manifest).includes('"rows"'));
  assert.equal(manifestJson(manifest),manifestJson(manifest));
});
test('DS-T034 inconsistent reports fail closed',()=>{
  assert.throws(()=>analysisManifest(ctx,{...column,missingCount:10},summary,freq,ogive,box));
  assert.throws(()=>analysisManifest(ctx,column,{...summary,n:4},freq,ogive,box));
  assert.throws(()=>analysisManifest(ctx,column,summary,{...freq,n:4},ogive,box));
});
test('DS-T032 empty numeric and singleton outcomes reimport',()=>{
  for(const values of [[],[6],[3,3,3]]){
    const raw=values.map(String);const record={values,totalRows:values.length,validCount:values.length,missingCount:0,invalidCount:0,exclusions:[]};
    const s=summarize(values),f=buildFrequency(values,5),o=makeOgive(f),b=makeBoxPlot(values);
    const manifest=analysisManifest({...ctx,sourceSha256:null},record,s,f,o,b);
    assert.equal(JSON.parse(manifestJson(manifest)).computed.summary.n,values.length);
    assert.equal(parseCsvText(summaryCsv(s,record,ctx)).rows.length>0,true);
    assert.equal(parseCsvText(frequencyCsv(f)).totalRows,f.bins.length);
  }
});
test('DS-T035 malicious CSV column labels stay spreadsheet-inert in reports',()=>{
  const evil={...ctx,sourceName:' =1+1.csv',columnName:'@HYPERLINK("url")'};
  const exported=parseCsvText(summaryCsv(summary,column,evil));
  const kv=Object.fromEntries(exported.rows);
  assert.ok(kv.dataset.startsWith("'"));
  assert.ok(kv.column.startsWith("'"));
});
test('DS-T034 ogive and boxplot invariants for all-equal data',()=>{
  const x=[2,2,2,2];const f=buildFrequency(x,20),og=makeOgive(f),b=makeBoxPlot(x);
  assert.equal(f.bins.length,1);assert.equal(og.length,2);
  assert.deepEqual(og.map(p=>p.cumulative),[0,4]);
  assert.deepEqual([b.q1,b.median,b.q3,b.outliers.length],[2,2,2,0]);
});
