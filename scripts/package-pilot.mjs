/** Package a vetted, exact-commit tester bundle without collecting feedback or changing Pages. */
import { readFile, writeFile, readdir, mkdir, cp, rm, lstat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root=path.resolve(fileURLToPath(new URL('../',import.meta.url)));
const output=path.join(root,'_pilot');
const participantOutput=path.join(root,'_pilot_participant');
const runtime=path.join(root,'_runtime');
const check=async p=>{
  const stat=await lstat(p);
  if(stat.isSymbolicLink())throw new Error('Refusing symbolic link: '+p);
  return stat;
};
const old=await lstat(output).catch(e=>{if(e.code==='ENOENT')return null;throw e;});
if(path.dirname(output)!==root||path.basename(output)!=='_pilot'||old?.isSymbolicLink()||(old&&!old.isDirectory()))
  throw new Error('Unsafe pilot output path');
const runtimeStat=await check(runtime);
if(!runtimeStat.isDirectory())throw new Error('Missing _runtime. Run npm run package:runtime first.');
const runtimeManifest=JSON.parse(await readFile(path.join(runtime,'runtime-manifest.json'),'utf8'));
if(!runtimeManifest.commit||!/^[0-9a-f]{40}$/.test(runtimeManifest.commit))
  throw new Error('Exact source commit required for a pilot package.');
if(runtimeManifest.channel!=='internal-alpha')throw new Error('Expected a vetted alpha runtime.');
// The runtime's own integrity manifest must remain intact and is copied as one unit.
const extras=[
  'docs/pilot/README.md','docs/pilot/FACILITATOR_ONLY.md','docs/pilot/participant-tasks.md',
  'docs/pilot/feedback-template.csv',
  'docs/pilot/fixtures/type7-four-values.csv',
  'docs/pilot/fixtures/data-quality-duplicate-headers.csv',
  'docs/pilot/fixtures/sensor-observations.csv'
];
const extrasRead=await Promise.all(extras.map(async name=>{
  const file=path.join(root,...name.split('/'));
  const stat=await check(file);
  if(!stat.isFile())throw new Error('Missing pilot source '+name);
  return {name,content:await readFile(file)};
}));
await rm(output,{recursive:true,force:true});
await cp(runtime,path.join(output,'APP'),{recursive:true,errorOnExist:true,force:false});
for(const {name,content} of extrasRead){
  const destination=path.join(output,'PILOT',...name.replace(/^docs\/pilot\//,'').split('/'));
  await mkdir(path.dirname(destination),{recursive:true});
  await writeFile(destination,content);
}
async function listFiles(dir,prefix=''){
  const collected=[];
  for(const entry of await readdir(dir,{withFileTypes:true})){
    const abs=path.join(dir,entry.name),rel=prefix?prefix+'/'+entry.name:entry.name;
    if(entry.isSymbolicLink())throw new Error('Unexpected symlink inside pilot package: '+rel);
    if(entry.isDirectory())collected.push(...await listFiles(abs,rel));
    else if(entry.isFile())collected.push(rel);
    else throw new Error('Nonregular pilot output: '+rel);
  }
  return collected;
}
const files=(await listFiles(output)).sort();
const manifest={schema:'sg-datasense-independent-pilot-v1',candidateCommit:runtimeManifest.commit,
  candidateVersion:runtimeManifest.version,channel:'restricted-evaluation-alpha',
  statement:'Contains no participant data; beta acceptance and license are not implied.',
  files:await Promise.all(files.map(async name=>{
    const data=await readFile(path.join(output,...name.split('/')));
    return {path:name,bytes:data.byteLength,sha256:createHash('sha256').update(data).digest('hex')};
  }))
};
await writeFile(path.join(output,'pilot-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({path:output,commit:manifest.candidateCommit,version:manifest.candidateVersion,
  files:manifest.files.length+1, audience:'facilitator-only'},null,2));

// Create an entirely separate artifact for participants. Never ship the answer key or
// facilitator feedback files in the same ZIP as the tester app.
const participantOld=await lstat(participantOutput).catch(e=>{if(e.code==='ENOENT')return null;throw e;});
if(path.dirname(participantOutput)!==root||path.basename(participantOutput)!=='_pilot_participant'||
    participantOld?.isSymbolicLink()||(participantOld&&!participantOld.isDirectory()))
  throw new Error('Unsafe participant output path');
await rm(participantOutput,{recursive:true,force:true});
await cp(runtime,path.join(participantOutput,'APP'),{recursive:true,errorOnExist:true,force:false});
const participants=[
  ['docs/pilot/participant-tasks.md','TASKS/README.md'],
  ...extras.filter(name=>name.startsWith('docs/pilot/fixtures/'))
    .map(name=>[name,'TASKS/'+name.slice('docs/pilot/'.length)])
];
for(const [source,destination] of participants){
  const bytes=await readFile(path.join(root,...source.split('/')));
  const dest=path.join(participantOutput,...destination.split('/'));
  await mkdir(path.dirname(dest),{recursive:true});
  await writeFile(dest,bytes);
}
const participantFiles=(await listFiles(participantOutput)).sort();
if(participantFiles.some(p=>/facilitator|feedback|answer-key/i.test(p)))
  throw new Error('Private facilitator material leaked into participant output');
const participantManifest={
  schema:'sg-datasense-blinded-participant-v1',candidateCommit:runtimeManifest.commit,
  candidateVersion:runtimeManifest.version,channel:'restricted-evaluation-alpha',
  notice:'Synthetic fixtures and blind participant instructions ONLY; no facilitator answers.',
  files:await Promise.all(participantFiles.map(async name=>{
    const data=await readFile(path.join(participantOutput,...name.split('/')));
    return {path:name,bytes:data.byteLength,sha256:createHash('sha256').update(data).digest('hex')};
  }))
};
await writeFile(path.join(participantOutput,'participant-manifest.json'),
  JSON.stringify(participantManifest,null,2)+'\n');
console.log(JSON.stringify({path:participantOutput,commit:participantManifest.candidateCommit,
  files:participantManifest.files.length+1,audience:'participants'},null,2));
