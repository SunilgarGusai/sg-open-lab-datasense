/** Browser application: text-only insertion for untrusted content and on-device computation. */
import { parseCsvText, parseCsvBytes, profileCsvColumns, getColumnById, CsvImportError,
  CSV_LIMITS, summarize, buildFrequency, sturgesBinCount, makeOgive, makeBoxPlot } from '../index.js';
import { summaryCsv,frequencyCsv,ogiveCsv,boxplotCsv,analysisManifest,manifestJson,safeBaseName } from '../export/report.js';
import { histogramSvg,ogiveSvg,boxplotSvg } from './charts.js';
import type { CsvDataset,CsvColumnProfile } from '../index.js';
import type { ExportContext } from '../export/report.js';

const VERSION='0.4.0-alpha.1';
function byId<T extends HTMLElement>(id:string):T {
  const el=document.getElementById(id);
  if (!el) throw new Error(`Missing interface element ${id}`);
  return el as T;
}
const status=byId<HTMLDivElement>('status');
const selector=byId<HTMLDivElement>('selector');
const select=byId<HTMLSelectElement>('column-select');
const binSelect=byId<HTMLSelectElement>('bin-select');
const exportControls=byId<HTMLDivElement>('export-controls');
const workspace=byId<HTMLElement>('workspace');
function setBusy(busy:boolean):void { workspace.setAttribute('aria-busy',String(busy)); }
let dataset:CsvDataset|null=null;
let datasetTitle='';
let sourceHash:string|null=null;
let generation=0;
let report: ReturnType<typeof analysisManifest>|null=null;

function setStatus(message:string,error=false):void {
  status.textContent=message;status.classList.toggle('error',error);
  status.setAttribute('role', error?'alert':'status');
  status.setAttribute('aria-live', error?'assertive':'polite');
}
function el<K extends keyof HTMLElementTagNameMap>(tag:K,text?:string):HTMLElementTagNameMap[K] {
  const item=document.createElement(tag);if(text!==undefined)item.textContent=text;return item;
}
function table(headers:readonly string[],rows:readonly (readonly string[])[], captionText:string):HTMLTableElement {
  const t=el('table'),thead=el('thead'),hr=el('tr');
  const caption=el('caption',captionText);caption.className='table-caption';t.append(caption);
  for(const head of headers){const th=el('th',head);th.scope='col';hr.append(th);}thead.append(hr);t.append(thead);
  const tbody=el('tbody');
  for(const fields of rows){const tr=el('tr');for(const field of fields)tr.append(el('td',field));tbody.append(tr);}
  t.append(tbody);return t;
}
function fmt(value:number|null|undefined):string {
  if(value===null||value===undefined)return 'Undefined';
  if(!Number.isFinite(value))return 'Invalid';
  return Number(value.toPrecision(8)).toLocaleString('en-US',{maximumFractionDigits:8});
}
function clear(target:string):HTMLElement {
  const root=byId<HTMLElement>(target);root.replaceChildren();return root;
}
function render(profile:CsvColumnProfile):void {
  if(!dataset)return;
  const numeric=profile.numeric;
  byId('empty-state').classList.add('hidden');
  byId('results').classList.remove('hidden');
  byId('dataset-meta').textContent=`${datasetTitle} · ${profile.header.display}`;
  const quality=clear('quality');
  for(const label of [`Rows: ${numeric.totalRows}`,`Valid: ${numeric.validCount}`,`Missing: ${numeric.missingCount}`,`Invalid: ${numeric.invalidCount}`])
    quality.append(el('span',label));
  const statistics=clear('statistics');
  const freqTable=clear('frequency-table');
  clear('frequency-chart');clear('ogive-chart');clear('ogive-table');clear('boxplot-chart');clear('boxplot-table');
  report=null; exportControls.classList.add('hidden');
  if(numeric.validCount===0){
    statistics.append(el('p','No valid numeric values. Select another column or correct the CSV.'));
    freqTable.append(el('p','Frequency distributions and chart exports require numeric observations.'));
    return;
  }
  let dist: ReturnType<typeof buildFrequency>;
  try{
    const bins=binSelect.value==='auto'?sturgesBinCount(numeric.validCount):Number(binSelect.value);
    dist=buildFrequency(numeric.values,bins);
  }catch(error){
    setStatus(error instanceof Error?`Cannot group this numeric column: ${error.message}`:'Cannot group this numeric column.',true);
    statistics.append(el('p','Try fewer bins for numeric values with extremely narrow or large ranges.'));
    return;
  }
  const summary=summarize(numeric.values),ogive=makeOgive(dist),box=makeBoxPlot(numeric.values);
  const metrics:readonly [string,number|null|undefined][]=[
    ['Mean',summary.mean],['Median',summary.median],['Min',summary.min],['Max',summary.max],
    ['Mode',summary.modeStatus==='single'?summary.mode[0]:null],['Q1 (Type 7)',summary.q1],
    ['Q3 (Type 7)',summary.q3],['IQR',summary.iqr],['Population variance',summary.populationVariance],
    ['Sample variance',summary.sampleVariance],['Population SD',summary.populationStandardDeviation],
    ['Sample SD',summary.sampleStandardDeviation]
  ];
  for(const [name,value] of metrics){const dl=el('dl');dl.className='metric';dl.append(el('dt',name),el('dd',fmt(value)));statistics.append(dl);}
  if(summary.modeStatus==='multiple'||summary.modeStatus==='no-informative-mode')
    statistics.append(el('p',summary.modeStatus==='multiple'?`Multiple modes: ${summary.mode.map(fmt).join(', ')}`:
      'No uniquely informative mode: every distinct observation has equal frequency.'));
  if(dist.isConstant)freqTable.append(el('p','All valid observations are equal; one nonzero-width histogram bin is used.'));
  const rows=dist.bins.map(b=>[
    `${fmt(b.lower)} to ${fmt(b.upper)}${b.rightClosed?' (last upper included)':' (upper excluded)'}`,
    String(b.count),String(b.cumulativeCount),`${(b.relativeFrequency*100).toFixed(2)}%`
  ]);
  freqTable.append(table(['Class interval','Frequency','Cumulative','Relative'],rows,'Grouped frequency distribution'));
  clear('frequency-chart').append(histogramSvg(dist));
  clear('ogive-chart').append(ogiveSvg(ogive,dist.n));
  clear('ogive-table').append(table(['Class boundary','Cumulative count','Cumulative %'],
    ogive.map(p=>[fmt(p.x),String(p.cumulative),`${fmt(p.percent)}%`]),'Ogive coordinates and cumulative counts'));
  clear('boxplot-chart').append(boxplotSvg(box));
  clear('boxplot-table').append(table(['Box-plot property','Value'],[
    ['Lower fence',fmt(box.lowerFence)],['Lower observed whisker',fmt(box.lowerWhisker)],
    ['Q1 (Type 7)',fmt(box.q1)],['Median',fmt(box.median)],['Q3 (Type 7)',fmt(box.q3)],
    ['Upper observed whisker',fmt(box.upperWhisker)],['Upper fence',fmt(box.upperFence)],
    ['Outlier observations',String(box.outliers.length)],
    ['Outlier examples',box.outliers.length ? `${box.outliers.slice(0,12).map(fmt).join(', ')}${box.outliers.length>12?' …':''}`:'None']
  ],'Box plot quartiles, fences, whiskers and outliers'));
  report=analysisManifest({sourceName:datasetTitle,sourceBytes:dataset.byteLength,sourceSha256:sourceHash,
    columnId:profile.header.id,columnName:profile.header.display,appVersion:VERSION,requestedBins:dist.requestedBins},
    numeric,summary,dist,ogive,box);
  exportControls.classList.remove('hidden');
}
function renderPreview(data:CsvDataset):void {
  const preview=clear('preview');
  preview.append(table(data.headers.map(h=>h.display),data.rows.slice(0,10).map(row=>[...row]),'First ten CSV observations'));
  if(data.rows.length>10)preview.append(el('p',`Preview shows 10 of ${data.totalRows} rows.`));
}
async function sha256(bytes:Uint8Array):Promise<string|null>{
  try{
    if(!crypto?.subtle)return null;
    const digest=await crypto.subtle.digest('SHA-256',bytes as Uint8Array<ArrayBuffer>);
    return Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
  }catch{return null;}
}
async function load(data:CsvDataset,title:string,bytes:Uint8Array,token:number):Promise<void>{
  const digest=await sha256(bytes);
  if(token!==generation)return;
  sourceHash=digest;dataset=data;datasetTitle=title;
  selector.classList.remove('hidden');clear('warnings');
  for(const warning of data.warnings)byId('warnings').append(el('p',warning));
  const columns=profileCsvColumns(data);
  select.replaceChildren();
  for(const profile of columns){
    const option=el('option',`${profile.header.display} (${profile.numeric.validCount} numeric)`);
    option.value=profile.header.id;select.append(option);
  }
  const first=columns.find(p=>p.eligible)??columns[0];
  if(first)select.value=first.header.id;
  renderPreview(data);
  if(first)render(first);
  setStatus(`Loaded ${title}: ${data.totalRows} rows, ${data.headers.length} columns. Processed locally.${digest?' Source SHA-256 recorded.':' Source hash unavailable.'}`);
}
function errorState(error:unknown):void {
  generation++;dataset=null;datasetTitle='';sourceHash=null;report=null;
  byId<HTMLInputElement>('csv-file').value='';setBusy(false);
  selector.classList.add('hidden');exportControls.classList.add('hidden');
  clear('warnings');byId('results').classList.add('hidden');byId('empty-state').classList.remove('hidden');
  byId('empty-state').textContent='Correct the CSV and try again, or load a built-in sample.';
  setStatus(error instanceof CsvImportError?`${error.code}: ${error.message}`:'Could not read the file. Use a valid UTF-8 CSV with headers.',true);
}
byId<HTMLInputElement>('csv-file').addEventListener('change',async(event)=>{
  const file=(event.currentTarget as HTMLInputElement).files?.[0];if(!file)return;
  const token=++generation;
  if(file.size>CSV_LIMITS.maxBytes){errorState(new CsvImportError('FILE_TOO_LARGE','Maximum CSV size is 5 MiB.'));return;}
  setStatus('Reading and checking local file…');setBusy(true);
  try{
    const bytes=new Uint8Array(await file.arrayBuffer());
    if(token!==generation)return;
    await load(parseCsvBytes(bytes),file.name,bytes,token);
  }catch(error){if(token===generation)errorState(error);}
  finally{if(token===generation)setBusy(false);}
});
select.addEventListener('change',()=>{if(dataset)render(getColumnById(dataset,select.value));});
binSelect.addEventListener('change',()=>{if(dataset)render(getColumnById(dataset,select.value));});
async function sample(source:string,title:string):Promise<void>{
  byId<HTMLInputElement>('csv-file').value='';const token=++generation;
  setBusy(true);setStatus('Loading built-in sample…');
  try{await load(parseCsvText(source),title,new TextEncoder().encode(source),token);}
  catch(error){if(token===generation)errorState(error);}
  finally{if(token===generation)setBusy(false);}
}
const SAMPLES={
  scores:'score,group\n12,A\n15,A\n18,B\n18,B\n21,A\n24,B\n27,B\n30,A\n33,A\n36,B\n',
  missing:'score,name\n4,Alice\nNA,Bob\n8,Carol\n,David\ninvalid,Eve\n12,Farah\n-,Gopal\n'
};
byId('sample-scores').addEventListener('click',()=>{void sample(SAMPLES.scores,'Synthetic sample scores');});
byId('sample-ties').addEventListener('click',()=>{void sample(SAMPLES.missing,'Synthetic missing-value example');});

function download(content:string,mime:string,name:string):void {
  const url=URL.createObjectURL(new Blob([content],{type:mime}));
  const a=el('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
byId('export-controls').addEventListener('click',(event)=>{
  const target=event.target as HTMLElement;
  const button=target.closest<HTMLButtonElement>('button[data-export]');
  if(!button||!report||!dataset)return;
  const data=report;const prefix=`datasense-${safeBaseName(datasetTitle)}-${safeBaseName(data.selection.label)}`;
  const ctx:ExportContext={sourceName:data.source.name,sourceBytes:data.source.bytes,
    sourceSha256:data.source.sha256,columnId:data.selection.id,columnName:data.selection.label,
    appVersion:VERSION,requestedBins:data.frequency.requestedBins};
  const profile=getColumnById(dataset,select.value);
  const kind=button.dataset.export;
  if(kind==='summary') download(summaryCsv(data.computed.summary,profile.numeric,ctx),'text/csv;charset=utf-8',`${prefix}-summary.csv`);
  else if(kind==='frequency') download(frequencyCsv({n:data.dataQuality.valid,requestedBins:data.frequency.requestedBins,
    isConstant:data.frequency.isConstant,binning:'equal-width-left-closed-final-right-closed',bins:data.computed.bins}),
    'text/csv;charset=utf-8',`${prefix}-frequency.csv`);
  else if(kind==='ogive')download(ogiveCsv(data.computed.ogive),'text/csv;charset=utf-8',`${prefix}-ogive.csv`);
  else if(kind==='boxplot')download(boxplotCsv(data.computed.boxplot),'text/csv;charset=utf-8',`${prefix}-boxplot.csv`);
  else if(kind==='manifest')download(manifestJson(data),'application/json;charset=utf-8',`${prefix}-manifest.json`);
  else if(kind==='histogram-svg'||kind==='ogive-svg'||kind==='boxplot-svg'){
    const chartId=kind.replace('-svg','');
    const svg=byId<HTMLDivElement>(chartId==='histogram'?'frequency-chart':`${chartId}-chart`).querySelector('svg');
    if(!svg) return;
    const copy=svg.cloneNode(true) as SVGSVGElement;
    copy.setAttribute('xmlns','http://www.w3.org/2000/svg');
    download('<?xml version="1.0" encoding="UTF-8"?>\n'+new XMLSerializer().serializeToString(copy),
      'image/svg+xml;charset=utf-8',`${prefix}-${chartId}.svg`);
  }
  setStatus(`Prepared ${kind} export. Your source CSV remains on your device.`);
});
