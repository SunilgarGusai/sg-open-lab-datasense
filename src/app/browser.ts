/** Browser interface: controls, accessible rendering and explicitly requested downloads. */
import { CSV_LIMITS } from '../index.js';
import { summaryCsv,frequencyCsv,ogiveCsv,boxplotCsv,manifestJson,safeBaseName } from '../export/report.js';
import { histogramSvg,ogiveSvg,boxplotSvg } from './charts.js';
import type { ExportContext } from '../export/report.js';
import type { CalculationExplanation,ExplanationMetric } from '../education/explain.js';
import type { AnalysisResult,WorkerOutput,WorkerInput } from './worker-protocol.js';

const VERSION='0.4.1-alpha.1';
function byId<T extends HTMLElement>(id:string):T {
  const el=document.getElementById(id);
  if (!el) throw new Error(`Missing interface element ${id}`);
  return el as T;
}
const status=byId<HTMLDivElement>('status');
const selector=byId<HTMLDivElement>('selector');
const select=byId<HTMLSelectElement>('column-select');
const binSelect=byId<HTMLSelectElement>('bin-select');
const explanationSelect=byId<HTMLSelectElement>('explanation-select');
const workedExample=byId<HTMLElement>('worked-example');
const exportControls=byId<HTMLDivElement>('export-controls');
const workspace=byId<HTMLElement>('workspace');
const cancelButton=byId<HTMLButtonElement>('cancel-analysis');
const workerUrl=new URL('./analysis-worker.js',import.meta.url);
let worker:Worker;
let busy=false;
let generation=0;
let datasetTitle='';
let activeAnalysis:AnalysisResult|null=null;
let report:AnalysisResult['manifest']=null;
let explanationState:AnalysisResult['explanations']|null=null;
function setBusy(value:boolean):void {
  busy=value;
  workspace.setAttribute('aria-busy',String(value));
  cancelButton.classList.toggle('hidden',!value);
  select.disabled=value;binSelect.disabled=value;
}
function newWorker():Worker {
  const next=new Worker(workerUrl,{type:'module',name:'datasense-analysis'});
  next.onmessage=(event:MessageEvent<WorkerOutput>)=>receive(event.data);
  next.onerror=()=>{
    resetWorker();
    errorState('WORKER_FAILURE: The analysis worker stopped unexpectedly. Please try again.');
  };
  return next;
}
function resetWorker():void{
  if(worker) worker.terminate();
  worker=newWorker();
}

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
function renderExplanation():void {
  const details=explanationState?.[explanationSelect.value as ExplanationMetric];
  if(!details){workedExample.classList.add('hidden');clear('explanation-body');return;}
  const container=clear('explanation-body');
  container.append(el('h4',details.title));
  const formula=el('p',details.formula);formula.className='explanation-formula';container.append(formula);
  const list=el('ol');
  for(const step of details.steps)list.append(el('li',step));
  container.append(list);
  const conclusion=el('p',details.conclusion);conclusion.className='explanation-result';container.append(conclusion);
  const note=el('p',details.note);note.className='explanation-note';container.append(note);
  workedExample.classList.remove('hidden');
}
function render(data:AnalysisResult):void {
  activeAnalysis=data;
  const numeric=data.numeric;
  byId('empty-state').classList.add('hidden');
  byId('results').classList.remove('hidden');
  byId('dataset-meta').textContent=`${datasetTitle} · ${data.display}`;
  const quality=clear('quality');
  for(const label of [`Rows: ${numeric.totalRows}`,`Valid: ${numeric.validCount}`,`Missing: ${numeric.missingCount}`,`Invalid: ${numeric.invalidCount}`])
    quality.append(el('span',label));
  const statistics=clear('statistics');
  const freqTable=clear('frequency-table');
  clear('frequency-chart');clear('ogive-chart');clear('ogive-table');clear('boxplot-chart');clear('boxplot-table');
  report=null; explanationState=null;renderExplanation();exportControls.classList.add('hidden');
  if(numeric.validCount===0){
    statistics.append(el('p','No valid numeric values. Select another column or correct the CSV.'));
    freqTable.append(el('p','Frequency distributions and chart exports require numeric observations.'));
    return;
  }
  const {summary,frequency:dist,ogive,boxplot:box}=data;
  if(!summary||!dist||!box){statistics.append(el('p','Statistics could not be calculated.'));return;}
  explanationState=data.explanations;
  renderExplanation();
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
  report=data.manifest;
  exportControls.classList.remove('hidden');
}
function renderPreview(headers:readonly string[],rows:readonly (readonly string[])[],totalRows:number):void {
  const preview=clear('preview');
  preview.append(table(headers,rows,'First ten CSV observations'));
  if(totalRows>10)preview.append(el('p',`Preview shows 10 of ${totalRows} rows.`));
}
function clearAnalysis():void {
  activeAnalysis=null;report=null;explanationState=null;renderExplanation();
  selector.classList.add('hidden');exportControls.classList.add('hidden');
  byId('results').classList.add('hidden');byId('empty-state').classList.remove('hidden');
  clear('warnings');
}
function errorState(message:string):void {
  ++generation;
  clearAnalysis();
  byId<HTMLInputElement>('csv-file').value='';
  setBusy(false);
  byId('empty-state').textContent='Correct the CSV and try again, or load a built-in sample.';
  setStatus(message,true);
}
function receive(message:WorkerOutput):void {
  if(message.id!==generation)return;
  if(message.type==='progress'){setStatus(message.stage);return;}
  if(message.type==='error'){
    errorState(`${message.code}: ${message.message}`);
    return;
  }
  if(message.type==='loaded'){
    datasetTitle=message.title;
    selector.classList.remove('hidden');
    const warnings=clear('warnings');
    for(const warning of message.warnings)warnings.append(el('p',warning));
    select.replaceChildren();
    for(const head of message.headers) {
      const option=el('option',`${head.display} (${head.validCount} numeric)`);
      option.value=head.id;select.append(option);
    }
    select.value=message.analysis.columnId;
    renderPreview(message.previewHeaders,message.previewRows,message.totalRows);
    render(message.analysis);
    setBusy(false);
    setStatus(`Loaded ${datasetTitle}: ${message.totalRows} rows, ${message.headers.length} columns. Processed locally.${message.sha256?' Source SHA-256 recorded.':' Source hash unavailable.'}`);
    return;
  }
  if(message.type==='analyzed') {
    render(message.analysis);
    setBusy(false);
    setStatus(`Updated ${datasetTitle}: ${message.analysis.display}. Processed locally.`);
  }
}
function dispatch(message:WorkerInput,bytes?:ArrayBuffer):void {
  if(bytes)worker.postMessage(message,[bytes]);
  else worker.postMessage(message);
}
function analyzeSelection():void {
  if(!datasetTitle||busy)return;
  const id=++generation;
  setBusy(true);setStatus('Calculating selected column…');
  dispatch({type:'analyze',id,columnId:select.value,bins:binSelect.value});
}
async function loadBytes(bytes:ArrayBuffer,title:string):Promise<void>{
  resetWorker();
  const id=++generation;
  clearAnalysis();
  setBusy(true);
  setStatus('Reading local CSV…');
  dispatch({type:'load',id,title,buffer:bytes,bins:binSelect.value},bytes);
}
byId<HTMLInputElement>('csv-file').addEventListener('change',async(event)=>{
  const file=(event.currentTarget as HTMLInputElement).files?.[0];if(!file)return;
  if(file.size>CSV_LIMITS.maxBytes){
    resetWorker();
    errorState('FILE_TOO_LARGE: Maximum CSV size is 5 MiB.');
    return;
  }
  // Cancel the previous worker immediately, including in-flight mathematical work.
  resetWorker();
  const token=++generation;
  clearAnalysis();
  setBusy(true);setStatus('Reading local CSV…');
  try {
    const bytes=await file.arrayBuffer();
    if(token!==generation)return;
    dispatch({type:'load',id:token,title:file.name,buffer:bytes,bins:binSelect.value},bytes);
  } catch(e) {
    if(token===generation)errorState('FILE_READ_ERROR: Could not read the file.');
  }
});
select.addEventListener('change',analyzeSelection);
binSelect.addEventListener('change',analyzeSelection);
explanationSelect.addEventListener('change',renderExplanation);
cancelButton.addEventListener('click',()=>{
  resetWorker();++generation;
  clearAnalysis();setBusy(false);
  byId<HTMLInputElement>('csv-file').value='';
  datasetTitle='';
  setStatus('Analysis canceled. Choose a sample or CSV to start again.');
});
async function sample(source:string,title:string):Promise<void> {
  byId<HTMLInputElement>('csv-file').value='';
  const bytes=new TextEncoder().encode(source);
  await loadBytes(bytes.buffer,title);
}
const SAMPLES={
  scores:'score,group\n12,A\n15,A\n18,B\n18,B\n21,A\n24,B\n27,B\n30,A\n33,A\n36,B\n',
  missing:'score,name\n4,Alice\nNA,Bob\n8,Carol\n,David\ninvalid,Eve\n12,Farah\n-,Gopal\n'
};
byId('sample-scores').addEventListener('click',()=>{void sample(SAMPLES.scores,'Synthetic sample scores');});
byId('sample-ties').addEventListener('click',()=>{void sample(SAMPLES.missing,'Synthetic missing-value example');});
worker=newWorker();

function download(content:string,mime:string,name:string):void {
  const url=URL.createObjectURL(new Blob([content],{type:mime}));
  const a=el('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
byId('export-controls').addEventListener('click',(event)=>{
  const target=event.target as HTMLElement;
  const button=target.closest<HTMLButtonElement>('button[data-export]');
  if(!button||!report||!activeAnalysis)return;
  const data=report;const prefix=`datasense-${safeBaseName(datasetTitle)}-${safeBaseName(data.selection.label)}`;
  const ctx:ExportContext={sourceName:data.source.name,sourceBytes:data.source.bytes,
    sourceSha256:data.source.sha256,columnId:data.selection.id,columnName:data.selection.label,
    appVersion:VERSION,requestedBins:data.frequency.requestedBins};
  const numeric=activeAnalysis.numeric;
  const kind=button.dataset.export;
  if(kind==='summary') download(summaryCsv(data.computed.summary,numeric,ctx),'text/csv;charset=utf-8',`${prefix}-summary.csv`);
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
