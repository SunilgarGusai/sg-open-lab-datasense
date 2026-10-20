import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm, mkdir, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { request } from 'node:http';

async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'datasense-server-'));
  t.after(() => rm(root, {recursive:true, force:true}));
  const contents = {
    'index.html': '<meta http-equiv="Content-Security-Policy" content="default-src \'self\'; object-src \'none\'">',
    'app.js': 'export const answer = 42;\n',
  };
  const files = Object.entries(contents).map(([name, text]) => ({
    path:name, bytes:Buffer.byteLength(text), sha256:createHash('sha256').update(text).digest('hex')
  }));
  for (const [name,text] of Object.entries(contents)) await writeFile(path.join(root,name),text);
  await writeFile(path.join(root,'staging-manifest.json'),JSON.stringify({schemaVersion:1,files}));
  return root;
}

async function api() { return import('../scripts/serve.mjs'); }
async function running(t, options={}) {
  const root = await fixture(t);
  const { startServer } = await api();
  const server = await startServer({root, port:0, ...options});
  t.after(() => new Promise(resolve => {server.close(resolve);server.closeAllConnections();}));
  return {root, server, port:server.address().port};
}
function fetchRaw(port, url='/', options={}) {
  return new Promise((resolve,reject) => {
    const req=request({hostname:'127.0.0.1',port,path:url,...options}, res=>{
      const parts=[];res.on('data',chunk=>parts.push(chunk));
      res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(parts).toString()}));
    });
    req.on('error',reject);req.end();
  });
}
test('runtime serves verified files with security headers, GET and HEAD', async t=>{
  const {port}=await running(t);
  const r=await fetchRaw(port);
  assert.equal(r.status,200);
  assert.match(r.headers['content-security-policy'],/frame-ancestors 'none'/);
  assert.equal(r.headers['x-content-type-options'],'nosniff');
  assert.equal(r.headers['referrer-policy'],'no-referrer');
  assert.equal(r.headers['cache-control'],'no-store');
  assert.equal(r.headers['x-frame-options'],'DENY');
  assert.match((await fetchRaw(port,'/app.js')).headers['content-type'],/javascript/);
  const head=await fetchRaw(port,'/app.js',{method:'HEAD'});
  assert.equal(head.body,'');assert.ok(Number(head.headers['content-length'])>0);
});
test('runtime has no upload route, directory listing, traversal or unknown-file access',async t=>{
  const {root,port}=await running(t);
  await writeFile(path.join(root,'secret.txt'),'not served');
  for(const url of ['/secret.txt','/.git/config','/../package.json','/%2e%2e/package.json','/%5c..%5csecret.txt','/%00','/dist/','/%zz'])
    assert.notEqual((await fetchRaw(port,url)).status,200,url);
  assert.equal((await fetchRaw(port,'/',{method:'POST'})).status,405);
  assert.equal((await fetchRaw(port,'/',{headers:{Host:'attacker.example'}})).status,421);
});
test('runtime supports a project subpath without leaking root files',async t=>{
  const {port}=await running(t,{basePath:'/datasense/'});
  assert.equal((await fetchRaw(port,'/')).status,404);
  assert.equal((await fetchRaw(port,'/datasense/')).status,200);
  assert.equal((await fetchRaw(port,'/datasense/app.js')).status,200);
  assert.equal((await fetchRaw(port,'/datasense')).status,308);
});
test('runtime fails closed on tampered or missing published bytes',async t=>{
  const root=await fixture(t);const {startServer}=await api();
  await writeFile(path.join(root,'app.js'),'tampered');
  await assert.rejects(startServer({root,port:0}),/Integrity/);
  await rm(path.join(root,'app.js'));
  await assert.rejects(startServer({root,port:0}));
});
test('runtime rejects unsafe manifest paths and duplicate entries',async t=>{
  const root=await fixture(t);const {startServer}=await api();
  for(const files of [
    [{path:'../secret',bytes:0,sha256:'0'.repeat(64)}],
    [{path:'index.html',bytes:0,sha256:'0'.repeat(64)},{path:'index.html',bytes:0,sha256:'0'.repeat(64)}]
  ]) {
    await writeFile(path.join(root,'staging-manifest.json'),JSON.stringify({schemaVersion:1,files}));
    await assert.rejects(startServer({root,port:0}));
  }
});
test('runtime refuses linked assets and requires an explicit origin for external binding',async t=>{
  const root=await fixture(t);const {startServer}=await api();
  await assert.rejects(startServer({root,port:0,host:'0.0.0.0'}),/origin/);
  await mkdir(path.join(root,'other'));
  await rm(path.join(root,'app.js'));
  try {await symlink(path.join(root,'other'),path.join(root,'app.js'),process.platform==='win32'?'junction':'dir');}
  catch(e){if(e.code==='EPERM')return t.skip('symlink unavailable');throw e;}
  await assert.rejects(startServer({root,port:0}),/regular|link/i);
});
