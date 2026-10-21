import test from 'node:test';
import assert from 'node:assert/strict';
import {CORE_TASKS,FIELDS,parsePilotCsv,scorePilot} from '../scripts/score-pilot.mjs';

function row(code,role,task,overrides={}) {
  return {tester_code:code,role,external:role==='independent'?'yes':'no',
    device_class:'desktop',browser:'Chromium test environment',task_id:task,
    completed:'yes',independent:'yes',answer_correct:'yes',
    seconds:'45',clarity_1_5:'5',severity:'none',comment:'',...overrides};
}
function baseline(){
  return Array.from({length:15},(_,i)=>{
    const role=i<5?'student':i<10?'educator':'independent';
    const code='P'+String(i+1).padStart(3,'0');
    return CORE_TASKS.map(t=>row(code,role,t));
  }).flat();
}
function toCsv(data){
  const cell=(x)=>{
    const s=String(x);
    return /[",\n\r]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;
  };
  return FIELDS.join(',')+'\n'+data.map(rec=>FIELDS.map(key=>cell(rec[key])).join(',')).join('\n')+'\n';
}
test('DS18: correctly structured synthetic scoring fixture meets only pilot thresholds, never grants beta',()=>{
  const parsed=parsePilotCsv(toCsv(baseline()));
  const result=scorePilot(parsed);
  assert.equal(result.status,'pilot_thresholds_met');
  assert.equal(result.participantCount,15);
  assert.equal(result.taskRecordCount,75);
  assert.equal(result.coreJourneySuccessRate,1);
  assert.equal(result.cohorts.external,5);
  assert.equal(result.explanationClarityMedian,5);
  assert.match(result.betaDecision,/HOLD/);
  assert.doesNotMatch(JSON.stringify(result),/P001|Chromium test environment/);
});
test('DS18: one participant failing one required task is not a full successful journey',()=>{
  const data=baseline();
  data[0]=row('P001','student','T01',{completed:'no',independent:'no',answer_correct:'no'});
  const scored=scorePilot(data);
  assert.equal(scored.coreCompleteIndependentCorrect,14);
  assert.equal(scored.taskStats.T01.correctRate,Number((14/15).toFixed(4)));
});
test('DS18: P1 blocker prevents acceptance even with numerical success',()=>{
  const data=baseline();
  data[0]=row('P001','student','T01',{severity:'P1'});
  const report=scorePilot(data);
  assert.equal(report.status,'pilot_not_yet_accepted');
  assert.equal(report.criteria.noBlockingIssues,false);
  assert.equal(report.severityCounts.P1,1);
});
test('DS18: incomplete cohort cannot pass minimum participants',()=>{
  const sample=baseline().filter(x=>x.tester_code!=='P015');
  const report=scorePilot(sample);
  assert.equal(report.criteria.minimumParticipants,false);
  assert.equal(report.status,'pilot_not_yet_accepted');
});
test('DS18: duplicate participant/task and inconsistent metadata reject',()=>{
  const data=baseline();
  assert.throws(()=>scorePilot([...data,data[0]]),/Duplicate task/);
  assert.throws(()=>scorePilot([...data,row('P001','other','T06')]),/Inconsistent participant metadata/);
});
test('DS18: strict column order and invalid category reject',()=>{
  const baselineRows=baseline();
  assert.throws(()=>parsePilotCsv('name,role\na,b\n'),/schema differs/);
  baselineRows[0]=row('P001','student','T01',{severity:'SEVERE'});
  assert.throws(()=>parsePilotCsv(toCsv(baselineRows)),/invalid issue severity/);
});
test('DS18: correctly quoted notes parse but never appear in aggregate output',()=>{
  const data=baseline();
  data[0]=row('P001','student','T01',{comment:'Quoted text, "do not reveal".'});
  const parsed=parsePilotCsv(toCsv(data));
  assert.equal(parsed[0].comment,'Quoted text, "do not reveal".');
  assert.doesNotMatch(JSON.stringify(scorePilot(parsed)),/Quoted text/);
});
test('DS18: missing core tasks are counted as failure, optional tasks do not inflate success',()=>{
  const data=baseline().filter(x=>!(x.tester_code==='P001'&&x.task_id==='T02'));
  data.push(row('P001','student','T06',{answer_correct:'na'}));
  const report=scorePilot(data);
  assert.equal(report.coreCompleteIndependentCorrect,14);
  assert.equal(report.taskStats.T02.coverage,Number((14/15).toFixed(4)));
});
test('DS18: no records means HOLD, never an accidental pass',()=>{
  const report=scorePilot([]);
  assert.equal(report.status,'pilot_not_yet_accepted');
  assert.equal(report.participantCount,0);
  assert.match(report.betaDecision,/HOLD/);
});
