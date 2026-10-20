/** Prepare only the files needed to run/deploy the alpha, without developer tools. */
import { readFile, writeFile, mkdir, lstat, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { startServer } from './serve.mjs';
const root=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const output=path.join(root,'_runtime');
const server=await startServer({root:path.join(root,'_site'),port:0});
await new Promise(resolve=>server.close(resolve));
const manifest=JSON.parse(await readFile(path.join(root,'_site/staging-manifest.json')));
const names=[
  ...manifest.files.map(f=>'_site/'+f.path),'_site/staging-manifest.json',
  'scripts/serve.mjs','scripts/start-windows.ps1','scripts/stop-windows.ps1',
  'Start DataSense.cmd','Stop DataSense.cmd','START_HERE.md','THIRD_PARTY_NOTICES.md','docs/DEPLOYMENT.md'
];
const contents=[];
for(const name of names) {
  let current=root;
  for(const part of name.split('/')) {
    current=path.join(current,part);
    if((await lstat(current)).isSymbolicLink())throw new Error('Linked runtime source');
  }
  contents.push([name,await readFile(current)]);
}
const old=await lstat(output).catch(e=>{if(e.code!=='ENOENT')throw e;return null;});
if(old?.isSymbolicLink() || (old && !old.isDirectory()))throw new Error('Unsafe runtime output');
if(path.dirname(output)!==root || path.basename(output)!=='_runtime')throw new Error('Unsafe output path');
await rm(output,{recursive:true,force:true});
for(const [name,bytes] of contents) {
  const target=path.join(output,...name.split('/'));
  await mkdir(path.dirname(target),{recursive:true});await writeFile(target,bytes);
}
const result={version:manifest.version,commit:manifest.commit,channel:'internal-alpha',
  files:contents.map(([name,bytes])=>({path:name,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')}))};
await writeFile(path.join(output,'runtime-manifest.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({output,version:result.version,commit:result.commit,files:contents.length+1},null,2));
