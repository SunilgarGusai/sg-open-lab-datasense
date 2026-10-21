/** Dedicated worker: holds parsed CSV rows off-thread, never posts whole raw dataset to the UI. */
import { parseCsvBytes,profileCsvColumns,getColumnById,summarize,buildFrequency,sturgesBinCount,
  makeOgive,makeBoxPlot,CSV_LIMITS } from '../index.js';
import { analysisManifest } from '../export/report.js';
import { explainStatistic } from '../education/explain.js';
import type { CsvDataset,CsvColumnProfile } from '../import/csv.js';
import type { ExplanationMetric } from '../education/explain.js';
import type { WorkerInput,WorkerOutput,AnalysisResult } from './worker-protocol.js';

const VERSION = '0.4.1-alpha.1';
const EXPLANATIONS:readonly ExplanationMetric[] = ['mean','median','q1','q3','populationVariance','sampleVariance','frequency'];
let dataset:CsvDataset|null=null;
let profiles:readonly CsvColumnProfile[]=[];
let title='';
let sha256:string|null=null;
const ctx=self as unknown as {onmessage:((event:MessageEvent<WorkerInput>)=>void)|null;
  postMessage:(message:WorkerOutput)=>void};
function send(message:WorkerOutput):void {ctx.postMessage(message);}
async function fingerprint(bytes:Uint8Array):Promise<string|null> {
  try {
    if (!crypto?.subtle) return null;
    const digest=await crypto.subtle.digest('SHA-256',bytes as Uint8Array<ArrayBuffer>);
    return Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');
  } catch {return null;}
}
function evaluateSelection(id:number,columnId:string,bins:string):AnalysisResult {
  if (!dataset) throw new Error('Load a CSV before selecting a column.');
  const profile=getColumnById(dataset,columnId);
  const numeric=profile.numeric;
  const counts={totalRows:numeric.totalRows,validCount:numeric.validCount,
    missingCount:numeric.missingCount,invalidCount:numeric.invalidCount};
  const base={id,columnId,display:profile.header.display,numeric:counts};
  if (!numeric.validCount) return {...base,summary:null,frequency:null,ogive:[],boxplot:null,
    manifest:null,explanations:{}};
  const requestedBins=bins==='auto'?sturgesBinCount(numeric.validCount):Number(bins);
  if (!Number.isSafeInteger(requestedBins)||requestedBins<1||requestedBins>CSV_LIMITS.maxColumns)
    throw new Error('Invalid group count.');
  const summary=summarize(numeric.values);
  const frequency=buildFrequency(numeric.values,requestedBins);
  const ogive=makeOgive(frequency),boxplot=makeBoxPlot(numeric.values);
  const manifest=analysisManifest({
    sourceName:title,sourceBytes:dataset.byteLength,sourceSha256:sha256,
    columnId,columnName:profile.header.display,appVersion:VERSION,requestedBins:frequency.requestedBins
  },numeric,summary,frequency,ogive,boxplot);
  const explanations:AnalysisResult['explanations']={};
  for(const metric of EXPLANATIONS) explanations[metric]=explainStatistic(numeric.values,summary,metric,frequency);
  return {...base,summary,frequency,ogive,boxplot,manifest,explanations};
}
ctx.onmessage=async({data:message})=>{
  const id=message.id;
  try{
    if(message.type==='load'){
      // The byte buffer was transferred, not copied; enforce the same hard bound again.
      const bytes=new Uint8Array(message.buffer);
      if(bytes.byteLength>CSV_LIMITS.maxBytes)throw new Error('Maximum CSV file size is 5 MiB.');
      send({type:'progress',id,stage:'Checking CSV syntax…'});
      dataset=null;profiles=[];title='';sha256=null;
      const parsed=parseCsvBytes(bytes);
      send({type:'progress',id,stage:'Profiling numerical columns…'});
      const examined=profileCsvColumns(parsed);
      const first=examined.find(p=>p.eligible)??examined[0];
      if(!first)throw new Error('No columns found in CSV.');
      dataset=parsed;profiles=examined;title=message.title;
      sha256=await fingerprint(bytes);
      send({type:'progress',id,stage:'Calculating statistical results…'});
      const analysis=evaluateSelection(id,first.header.id,message.bins);
      send({type:'loaded',id,title,byteLength:parsed.byteLength,sha256,
        totalRows:parsed.totalRows,
        headers:examined.map(p=>({id:p.header.id,display:p.header.display,
          validCount:p.numeric.validCount,eligible:p.eligible})),
        warnings:parsed.warnings,previewHeaders:parsed.headers.map(h=>h.display),
        previewRows:parsed.rows.slice(0,10).map(r=>[...r]),analysis});
      return;
    }
    if(message.type==='analyze'){
      send({type:'progress',id,stage:'Updating statistical calculations…'});
      send({type:'analyzed',id,analysis:evaluateSelection(id,message.columnId,message.bins)});
    }
  }catch(e){
    const error=e as {code?:string;message?:string};
    send({type:'error',id,code:typeof error.code==='string'?error.code:'ANALYSIS_ERROR',
      message:typeof error.message==='string'?error.message:'The CSV could not be analyzed.'});
  }
};
