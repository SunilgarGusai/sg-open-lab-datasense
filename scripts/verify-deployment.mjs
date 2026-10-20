/** Compare an authorized public Pages deployment with this commit's built bytes. */
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../_site/',import.meta.url));
const base=new URL(process.argv[2]);
if(base.protocol!=='https:' || base.hostname!=='sunilgargusai.github.io' ||
   base.pathname!=='/sg-open-lab-datasense/' || base.search || base.hash || base.username || base.password) {
  throw new Error('Expected the dedicated, authorized DataSense HTTPS Pages origin');
}
const output=path.resolve(process.argv[3] ?? 'evidence/deployed-https/bytes-and-headers.json');
const manifest=JSON.parse(await readFile(path.join(root,'staging-manifest.json'),'utf8'));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const record={url:base.href,commit:manifest.commit,version:manifest.version,checkedAt:new Date().toISOString(),
  status:'running',files:[],limitations:[
    'GitHub Pages controls response headers; the local Node server header policy is not applied here.',
    'The application CSP remains in HTML; frame-ancestors requires a hosting response header.',
    'Public preview and public source do not constitute public-beta approval.'
  ]};
try {
  for(const name of [...manifest.files.map(f=>f.path),'staging-manifest.json']) {
    const url=new URL(name,base);
    if(!url.href.startsWith(base.href))throw new Error('Invalid artifact path');
    const expected=await readFile(path.join(root,...name.split('/')));
    const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(30000),cache:'no-store'});
    const actual=Buffer.from(await response.arrayBuffer());
    const item={path:name,status:response.status,bytes:actual.length,sha256:sha(actual),
      expectedSha256:sha(expected),headers:Object.fromEntries(response.headers)};
    record.files.push(item);
    if(response.status!==200 || !actual.equals(expected))throw new Error(`Deployed bytes differ: ${name}`);
  }
  record.status='pass';
} catch(error) {
  record.status='fail';record.error=error.message;throw error;
} finally {
  await mkdir(path.dirname(output),{recursive:true});
  await writeFile(output,JSON.stringify(record,null,2)+'\n');
  console.log(JSON.stringify({status:record.status,url:record.url,commit:record.commit,files:record.files.length}));
}
