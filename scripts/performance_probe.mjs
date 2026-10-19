/** Non-gating, local benchmark: not a universal response-time promise. */
import {performance} from 'node:perf_hooks';
import {parseCsvText, profileCsvColumns, getColumnById, summarize, buildFrequency, makeOgive, makeBoxPlot, sturgesBinCount} from '../dist/index.js';
const t={};let last=performance.now();
function stamp(name){const n=performance.now();t[name]=Number((n-last).toFixed(2));last=n;}
const n=50_000,columns=8;
const header=Array.from({length:columns},(_,i)=>`score_${i+1}`).join(',');
const rows=Array.from({length:n},(_,i)=>Array.from({length:columns},(_,c)=>String(((i*17+c*13)%10000)/10)).join(','));
const text=header+'\n'+rows.join('\n')+'\n';stamp('generate_ms');
const dataset=parseCsvText(text);stamp('parse_ms');
const profiles=profileCsvColumns(dataset);stamp('profile_all_columns_ms');
const selected=getColumnById(dataset,'column-0');stamp('select_ms');
const summ=summarize(selected.numeric.values);stamp('summary_ms');
const freq=buildFrequency(selected.numeric.values,sturgesBinCount(selected.numeric.validCount));stamp('group_ms');
const ogive=makeOgive(freq),box=makeBoxPlot(selected.numeric.values);stamp('ogive_boxplot_ms');
if(dataset.totalRows!==n || profiles.length!==columns ||summ.n!==n ||freq.bins.reduce((s,b)=>s+b.count,0)!==n||ogive.at(-1).cumulative!==n||box.median===null)throw Error('Benchmark data results mismatch');
console.log(JSON.stringify({version:'0.4.0-alpha.1',scenario:'50,000 rows × 8 numeric columns',bytes:Buffer.byteLength(text),rows:n,columns,stages_ms:t,remaining_heap_mb:Number((process.memoryUsage().heapUsed/1024**2).toFixed(1)),caveat:'Node local baseline only; browser UI main-thread responsiveness not established'},null,2));
