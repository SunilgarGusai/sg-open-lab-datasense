/**
 * DS-18 pilot aggregator, intentionally dependency-free beyond the existing CSV engine.
 * Produces aggregate, anonymized statistics; never emits participant notes or identities.
 * Does NOT certify manual release gates or invent human participation.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { parseCsvText } from '../dist/index.js';
import { pathToFileURL } from 'node:url';

export const CORE_TASKS=Object.freeze(['T01','T02','T03','T04','T05']);
export const TASKS=Object.freeze([...CORE_TASKS,'T06','T07']);
export const FIELDS=Object.freeze([
  'tester_code','role','external','device_class','browser','task_id',
  'completed','independent','answer_correct','seconds','clarity_1_5','severity','comment'
]);
const ROLES=new Set(['student','educator','independent','other']);
const DEVICES=new Set(['desktop','mobile','tablet']);
const SEVERITIES=new Set(['none','P0','P1','P2','P3']);
const ANSWERS=new Set(['yes','no']);
const VALID_ANSWERS=new Set(['yes','no','na']);
const median=(values)=>{
  if(!values.length)return null;
  const s=[...values].sort((a,b)=>a-b);
  const m=Math.floor(s.length/2);
  return s.length%2?s[m]:(s[m-1]+s[m])/2;
};
const round=(v)=>Number(v.toFixed(4));

export function parsePilotCsv(raw) {
  const data=parseCsvText(raw);
  const names=data.headers.map(h=>h.original);
  if(names.length!==FIELDS.length||names.some((name,i)=>name!==FIELDS[i])) {
    throw new Error('Feedback CSV schema differs from docs/pilot/feedback-template.csv.');
  }
  return data.rows.map((row,i)=>{
    const out=Object.fromEntries(FIELDS.map((key,k)=>[key,row[k]??'']));
    const location='feedback row '+(i+2);
    if(!/^P[0-9]{3,5}$/.test(out.tester_code))throw new Error(location+': use anonymous tester code P001, P002, ...');
    if(!ROLES.has(out.role))throw new Error(location+': unrecognized role.');
    if(!ANSWERS.has(out.external))throw new Error(location+': external must be yes/no.');
    if(!DEVICES.has(out.device_class))throw new Error(location+': invalid device class.');
    if(!out.browser.trim()||out.browser.length>70)throw new Error(location+': browser required, maximum 70 characters.');
    if(!TASKS.includes(out.task_id))throw new Error(location+': invalid task ID.');
    if(!ANSWERS.has(out.completed)||!ANSWERS.has(out.independent)||
       !VALID_ANSWERS.has(out.answer_correct))throw new Error(location+': invalid completion, independence or correctness.');
    if(CORE_TASKS.includes(out.task_id)&&out.answer_correct==='na')throw new Error(location+': core task correctness cannot be na.');
    if(out.seconds!==''&&(!/^\d+$/.test(out.seconds)||Number(out.seconds)>7200))
      throw new Error(location+': duration must be whole seconds from 0 to 7200 or empty.');
    if(out.clarity_1_5!==''&&!/^[1-5]$/.test(out.clarity_1_5))
      throw new Error(location+': clarity is 1-5 or empty.');
    if(!SEVERITIES.has(out.severity))throw new Error(location+': invalid issue severity.');
    if(out.comment.length>300)throw new Error(location+': note exceeds 300 characters.');
    return out;
  });
}

export function scorePilot(records) {
  const groups=new Map();
  for(const record of records){
    if(!groups.has(record.tester_code))groups.set(record.tester_code,[]);
    const group=groups.get(record.tester_code);
    if(group.some(x=>x.task_id===record.task_id))
      throw new Error('Duplicate task record for '+record.tester_code+' '+record.task_id);
    if(group.some(x=>x.role!==record.role||x.external!==record.external||
      x.device_class!==record.device_class||x.browser!==record.browser))
      throw new Error('Inconsistent participant metadata for '+record.tester_code);
    group.push(record);
  }
  const participants=[...groups.values()];
  const n=participants.length;
  const count=(fn)=>participants.filter(fn).length;
  const taskStats=Object.fromEntries(TASKS.map(task=>{
    const reported=participants.flatMap(group=>group.filter(x=>x.task_id===task));
    const correct=reported.filter(x=>x.completed==='yes'&&x.answer_correct==='yes').length;
    const independentCorrect=reported.filter(x=>x.completed==='yes'&&x.independent==='yes'&&x.answer_correct==='yes').length;
    return [task,{reported:reported.length,correct,independentCorrect,
      coverage:n?round(reported.length/n):null,
      correctRate:n?round(correct/n):null}];
  }));
  const fullSuccess=count(group=>CORE_TASKS.every(task=>group.some(x=>x.task_id===task&&
    x.completed==='yes'&&x.independent==='yes'&&x.answer_correct==='yes')));
  const clarity=participants.flatMap(g=>g.filter(x=>x.task_id==='T02'&&x.clarity_1_5!=='')
    .map(x=>Number(x.clarity_1_5)));
  const blocking=records.filter(x=>x.severity==='P0'||x.severity==='P1');
  const pass={
    minimumParticipants:n>=15,
    studentCoverage:count(g=>g[0]?.role==='student')>=5,
    educatorCoverage:count(g=>g[0]?.role==='educator')>=3,
    externalCoverage:count(g=>g[0]?.external==='yes')>=3,
    coreJourneySuccess:n>0&&fullSuccess/n>=0.8,
    coreTaskCorrectness:n>0&&CORE_TASKS.every(t=>taskStats[t].correct/n>=0.9),
    noBlockingIssues:blocking.length===0,
    explanationClarity:clarity.length>=10&&median(clarity)>=4
  };
  const bySeverity=Object.fromEntries([...SEVERITIES].map(s=>[s,records.filter(x=>x.severity===s).length]));
  return {
    schema:'sg-datasense-pilot-report-v1',
    status:Object.values(pass).every(Boolean)?'pilot_thresholds_met':'pilot_not_yet_accepted',
    betaDecision:'HOLD — independent human evidence, manual accessibility, ownership/licensing and approved release are separately required.',
    participantCount:n,taskRecordCount:records.length,
    cohorts:{student:count(g=>g[0]?.role==='student'),educator:count(g=>g[0]?.role==='educator'),
      independent:count(g=>g[0]?.role==='independent'),
      external:count(g=>g[0]?.external==='yes'),mobile:count(g=>g[0]?.device_class==='mobile')},
    coreCompleteIndependentCorrect:fullSuccess,
    coreJourneySuccessRate:n?round(fullSuccess/n):null,
    explanationClarityMedian:median(clarity),
    severityCounts:bySeverity,taskStats,criteria:pass,
    sampleLimitations:'Results use self-reported synthetic-data tasks; independently review reports and confirm participants are real. This algorithm cannot verify human identity, screen readers or deployed-site security.'
  };
}

if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){
  const input=process.argv[2];
  const output=process.argv[3];
  if(!input){
    console.error('Usage: node scripts/score-pilot.mjs <completed-feedback.csv> [aggregate-report.json]');
    process.exitCode=2;
  } else {
    try {
      const raw=await readFile(input,'utf8');
      const report=scorePilot(parsePilotCsv(raw));
      const json=JSON.stringify(report,null,2)+'\n';
      if(output)await writeFile(output,json,'utf8');
      else process.stdout.write(json);
      if(report.status!=='pilot_thresholds_met')process.exitCode=1;
    } catch(e) {
      console.error('Pilot scoring rejected input: '+e.message);
      process.exitCode=2;
    }
  }
}
