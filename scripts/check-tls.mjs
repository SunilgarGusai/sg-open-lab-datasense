import assert from 'node:assert/strict';
import { get } from 'node:https';
import { readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { createHash } from 'node:crypto';
import { startServer } from './serve.mjs';
const {values}=parseArgs({options:{cert:{type:'string'},key:{type:'string'},output:{type:'string'}}});
const cert=await readFile(values.cert);
const server=await startServer({cert:values.cert,key:values.key,port:0});
const port=server.address().port;
function request(extra={}) {
  return new Promise((resolve,reject)=>{
    get({hostname:'127.0.0.1',port,path:'/',agent:false,...extra},res=>{
      const parts=[];res.on('data',chunk=>parts.push(chunk));
      const tls={authorized:res.socket.authorized,protocol:res.socket.getProtocol()};
      res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,bytes:Buffer.concat(parts),...tls}));
    }).on('error',reject);
  });
}
try {
  await assert.rejects(request(), /self-signed|unable to verify|certificate/i);
  const r=await request({ca:cert});
  assert.equal(r.status,200);assert.equal(r.authorized,true);
  assert.match(r.protocol,/TLSv1\.[23]/);
  assert.equal(r.headers['strict-transport-security'],'max-age=31536000');
  assert.match(r.headers['content-security-policy'],/frame-ancestors 'none'/);
  await assert.rejects(request({ca:cert,servername:'wrong.example'}),/does not match|altnames|certificate/i);
  const result={status:'pass',scope:'Local TLS with an explicitly trusted temporary certificate; not public HTTPS deployment',
    certificateValidation:true,untrustedCertificateRejected:true,wrongHostnameRejected:true,
    protocol:r.protocol,headers:r.headers,htmlSha256:createHash('sha256').update(r.bytes).digest('hex')};
  await writeFile(values.output,JSON.stringify(result,null,2)+'\n');
  console.log('PASS: TLS, trust/hostname rejection, HSTS and CSP headers');
} finally {server.close();server.closeAllConnections();}
