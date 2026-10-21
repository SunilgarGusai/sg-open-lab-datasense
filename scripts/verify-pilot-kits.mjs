/** DS-18 audience separation, file integrity and exact-commit verification. */
import {readFile, readdir, lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(fileURLToPath(new URL('../',import.meta.url)));
const bundles=[['facilitator','_pilot','pilot-manifest.json'],
 ['participant','_pilot_participant','participant-manifest.json']];
const manifests={};
for(const [audience,dir,file] of bundles){
 const home=path.join(root,dir);
 const m=JSON.parse(await readFile(path.join(home,file),'utf8'));
 if(!/^[a-f0-9]{40}$/.test(m.candidateCommit))throw new Error(audience+': invalid SHA');
 const actual=new Set();
 for(const entry of m.files){
  const name=entry.path;
  if(typeof name!=='string'||!name.startsWith('APP/')&&!name.startsWith('PILOT/')&&!name.startsWith('TASKS/')||
     name.split('/').some(v=>v==='..'||v===''||v.startsWith('.'))||actual.has(name))
     throw new Error(audience+': suspicious path '+name);
  actual.add(name);
  const location=path.join(home,...name.split('/'));
  const st=await lstat(location);
  if(!st.isFile()||st.isSymbolicLink())throw new Error(audience+': nonregular entry '+name);
  const bytes=await readFile(location);
  if(bytes.length!==entry.bytes||createHash('sha256').update(bytes).digest('hex')!==entry.sha256)
    throw new Error(audience+': integrity mismatch '+name);
 }
 manifests[audience]={home,manifest:m,names:actual};
}
if(manifests.facilitator.manifest.candidateCommit!==manifests.participant.manifest.candidateCommit)
 throw new Error('Audience packages are different versions');
const f=manifests.facilitator.names,p=manifests.participant.names;
for(const name of ['PILOT/FACILITATOR_ONLY.md','PILOT/feedback-template.csv','PILOT/README.md'])
 if(!f.has(name))throw new Error('Missing facilitator item '+name);
for(const name of ['TASKS/README.md','TASKS/fixtures/type7-four-values.csv',
 'TASKS/fixtures/data-quality-duplicate-headers.csv','TASKS/fixtures/sensor-observations.csv'])
 if(!p.has(name))throw new Error('Missing blinded participant item '+name);
if([...p].some(name=>/facilitator|feedback-template|answer-key|PILOT\//i.test(name)))
 throw new Error('Facilitator data leaked into participant ZIP');
for(const name of p){
 if(name.startsWith('APP/')) {
  if(!f.has(name))throw new Error('Participant app file missing in facilitator candidate '+name);
  const a=await readFile(path.join(manifests.participant.home,...name.split('/')));
  const b=await readFile(path.join(manifests.facilitator.home,...name.split('/')));
  if(!a.equals(b))throw new Error('Different app bytes in participant kit: '+name);
 }
}
const participantTasks=await readFile(path.join(manifests.participant.home,'TASKS/README.md'),'utf8');
if(/(?:23\.4|22\.5|1\.75|3\.25|1\.666667|score \(2\)|3 valid, 3 missing)/i.test(participantTasks))
 throw new Error('Reference answers leaked into participant instructions');
if(!participantTasks.includes('T05')||!participantTasks.includes('T01'))
 throw new Error('Participant tasks incomplete');
console.log(JSON.stringify({status:'pass',commit:manifests.participant.manifest.candidateCommit,
 facilitatorFileCount:f.size+1,participantFileCount:p.size+1,
 outcome:'blinded participant package contains no facilitator-only materials'}));
