/** No dependencies or upload endpoint. Only integrity-checked staged bytes are served. */
import { readFile, lstat } from 'node:fs/promises';
import { createServer as httpServer } from 'node:http';
import { createServer as httpsServer } from 'node:https';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const defaultRoot = fileURLToPath(new URL('../_site', import.meta.url));
const mime = {'.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8',
  '.txt':'text/plain; charset=utf-8', '.md':'text/plain; charset=utf-8',
  '.csv':'text/csv; charset=utf-8', '.svg':'image/svg+xml'};
const loopback = new Set(['127.0.0.1','localhost','::1']);

async function regular(root, name) {
  let current = root;
  for (const part of name.split('/')) {
    current = path.join(current,part);
    if ((await lstat(current)).isSymbolicLink()) throw new Error(`Refusing linked asset: ${name}`);
  }
  if (!(await lstat(current)).isFile()) throw new Error(`Not a regular file: ${name}`);
  return readFile(current);
}

export async function startServer({root=defaultRoot,host='127.0.0.1',port=8765,
  basePath='/',origin,cert,key}={}) {
  if (!Number.isInteger(port) || port<0 || port>65535) throw new Error('Invalid port');
  if (!/^\/(?:[a-zA-Z0-9_-]+\/)*$/.test(basePath)) throw new Error('Base path must be / or /name/');
  if (!loopback.has(host) && !origin) throw new Error('External binding requires an explicit HTTPS origin');
  if (Boolean(cert)!==Boolean(key)) throw new Error('Both TLS certificate and key are required');
  if (!loopback.has(host) && !cert) throw new Error('External binding requires a TLS certificate; use loopback behind a proxy');
  let configured;
  if (origin) {
    configured = new URL(origin);
    if (configured.protocol!=='https:' || configured.pathname!=='/' || configured.search ||
        configured.hash || configured.username || configured.password)
      throw new Error('Origin must be an HTTPS origin without path or credentials');
  }
  root=path.resolve(root);
  const rootStat=await lstat(root);
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) throw new Error('Site root must be a regular directory');
  const manifestBytes=await regular(root,'staging-manifest.json');
  const manifest=JSON.parse(manifestBytes);
  if (manifest.schemaVersion!==1 || !Array.isArray(manifest.files) || manifest.files.length>1000)
    throw new Error('Unsupported site manifest');
  const assets=new Map();
  for (const entry of manifest.files) {
    const name=entry.path;
    if (typeof name!=='string' || !/^(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_.-]+$/.test(name) ||
        name.split('/').some(p=>p.startsWith('.')) || name==='staging-manifest.json' ||
        !mime[path.extname(name)] || assets.has(name) || !Number.isSafeInteger(entry.bytes) ||
        entry.bytes<0 || entry.bytes>10*1024*1024 || !/^[a-f0-9]{64}$/.test(entry.sha256))
      throw new Error('Invalid or duplicate manifest entry');
    const bytes=await regular(root,name);
    if (bytes.length!==entry.bytes || createHash('sha256').update(bytes).digest('hex')!==entry.sha256)
      throw new Error(`Integrity check failed: ${name}`);
    assets.set(name,bytes);
  }
  assets.set('staging-manifest.json',manifestBytes);
  const html=assets.get('index.html')?.toString('utf8');
  const csp=html?.match(/<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"/i)?.[1];
  if (!csp || /[\r\n]/.test(csp)) throw new Error('Missing valid page CSP');
  const headers={
    'Content-Security-Policy':`${csp}; frame-ancestors 'none'`,
    'X-Content-Type-Options':'nosniff', 'X-Frame-Options':'DENY',
    'Referrer-Policy':'no-referrer', 'Cache-Control':'no-store',
    'Permissions-Policy':'camera=(), microphone=(), geolocation=()',
    'Cross-Origin-Opener-Policy':'same-origin', 'Cross-Origin-Resource-Policy':'same-origin',
    'X-Robots-Tag':'noindex, nofollow, noarchive',
    ...(cert ? {'Strict-Transport-Security':'max-age=31536000'} : {}),
  };
  function handler(req,res) {
    const reply=(status,body='',extra={})=>{
      res.writeHead(status,{...headers,'Content-Type':'text/plain; charset=utf-8',
        'Content-Length':Buffer.byteLength(body),...extra});
      res.end(req.method==='HEAD'?undefined:body);
    };
    const listeningPort=server.address().port;
    const allowedHosts = configured ?
      new Set([configured.host.toLowerCase(), ...(!configured.port?[`${configured.hostname.toLowerCase()}:443`]:[])]) :
      new Set(['127.0.0.1','localhost','[::1]'].flatMap(h=>
        listeningPort===(cert?443:80)?[h,`${h}:${listeningPort}`]:[`${h}:${listeningPort}`]));
    if (!allowedHosts.has((req.headers.host??'').toLowerCase())) return reply(421,'Unexpected host');
    if (!['GET','HEAD'].includes(req.method)) return reply(405,'Method not allowed',{'Allow':'GET, HEAD'});
    let pathname;
    try { pathname=decodeURIComponent((req.url??'').split('?')[0]); } catch {return reply(400,'Invalid path');}
    if (!pathname.startsWith('/') || /[\\\u0000-\u001f]/.test(pathname) ||
        pathname.split('/').some(p=>p==='.' || p==='..')) return reply(400,'Invalid path');
    if (basePath!=='/' && pathname===basePath.slice(0,-1)) return reply(308,'',{'Location':basePath});
    if (!pathname.startsWith(basePath)) return reply(404,'Not found');
    const name=pathname.slice(basePath.length) || 'index.html';
    if (name==='favicon.ico') return reply(204);
    const bytes=assets.get(name);
    if (!bytes) return reply(404,'Not found');
    res.writeHead(200,{...headers,'Content-Type':mime[path.extname(name)],'Content-Length':bytes.length});
    res.end(req.method==='HEAD'?undefined:bytes);
  }
  const server=cert ? httpsServer({cert:await readFile(cert),key:await readFile(key),
    minVersion:'TLSv1.2'},handler) : httpServer(handler);
  server.requestTimeout=15000;server.headersTimeout=10000;server.keepAliveTimeout=5000;
  server.maxRequestsPerSocket=100;
  await new Promise((resolve,reject)=>{
    server.once('error',reject);
    server.listen(port,host,()=>{server.removeListener('error',reject);resolve();});
  });
  return server;
}

if (process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const {values}=parseArgs({options:{
      root:{type:'string',default:defaultRoot},host:{type:'string',default:'127.0.0.1'},
      port:{type:'string',default:'8765'},'base-path':{type:'string',default:'/'},
      origin:{type:'string'},cert:{type:'string'},key:{type:'string'}
    }});
    const server=await startServer({...values,port:Number(values.port),basePath:values['base-path']});
    const address=server.address();
    const host=address.family==='IPv6'?`[${address.address}]`:address.address;
    console.log(JSON.stringify({status:'ready',url:
      `${values.origin??`${values.cert?'https':'http'}://${host}:${address.port}`}${values['base-path']}`,
      root:path.resolve(values.root),integrity:'verified',releaseChannel:'alpha'}));
    for(const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>server.close(()=>process.exit(0)));
  } catch(error) {console.error(`DataSense could not start: ${error.message}`);process.exitCode=1;}
}
