/** Additional real-browser checks; uses an installed QA-only Playwright module. */
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { startServer } from './serve.mjs';
import { serializeCsv } from '../dist/export/report.js';

const {values}=parseArgs({options:{output:{type:'string'},module:{type:'string'},channel:{type:'string'}}});
if (!values.output) throw new Error('--output is required');
const output=path.resolve(values.output);
await mkdir(output,{recursive:false});
const pw=await import(values.module?pathToFileURL(path.resolve(values.module)).href:'playwright');
const server=await startServer({port:0});
const browser=await pw.chromium.launch({headless:true,...(values.channel?{channel:values.channel}:{})});
const report={date:new Date().toISOString(),browser:browser.version(),checks:[],limitations:[
  'CPU throttling simulates reduced processor speed; it is not a real slow-device test.',
  'Computed contrast and keyboard/reflow checks are not screen-reader or WCAG certification.'
]};
const page=await browser.newPage({viewport:{width:1280,height:900}});
const errors=[];
page.on('pageerror',e=>errors.push(String(e)));
async function check(name,fn) {
  console.log(`Checking ${name}`);
  try {report.checks.push({name,status:'pass',details:await fn()});}
  catch(e) {report.checks.push({name,status:'fail',error:String(e)});}
  await writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
}
const assert=(condition,message)=>{if(!condition)throw new Error(message);};
function contrast(a,b) {
  const luminance=color=>{
    const channels=color.match(/[\d.]+/g).slice(0,3).map(Number).map(n=>{
      const v=n/255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;
    });
    return channels[0]*.2126+channels[1]*.7152+channels[2]*.0722;
  };
  const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
}
try {
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.locator('#sample-scores').click();
  await page.locator('#export-controls').waitFor({state:'visible'});
  await check('focus indicator contrast against white',async()=>{
    await page.locator('#sample-scores').focus();
    // Keyboard interaction activates :focus-visible even after pointer sample loading.
    await page.keyboard.press('Tab');
    const color=await page.locator(':focus').evaluate(el=>getComputedStyle(el).outlineColor);
    const ratio=contrast(color,'rgb(255, 255, 255)');
    assert(ratio>=3,`Focus contrast ${ratio.toFixed(2)}:1 is below 3:1`);
    return {color,ratio};
  });
  await check('computed text and chart contrast palette',async()=>{
    const pairs=[
      ['body','#182640','#f6f8fc'],['muted','#52637c','#f7f9fc'],
      ['button','#ffffff','#175f95'],['error','#a12b3b','#fdf0f1'],
      ['chart text','#35465e','#ffffff'],['chart axes','#596c81','#ffffff'],
      ['bars','#176aa2','#ffffff'],['box edge','#176aa2','#d1e6f5'],
      ['median','#b25122','#d1e6f5']
    ];
    const rgb=hex=>'rgb('+[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)).join(',')+')';
    const results=pairs.map(([name,a,b])=>({name,ratio:contrast(rgb(a),rgb(b))}));
    for(const item of results)assert(item.ratio>=(['body','muted','button','error','chart text'].includes(item.name)?4.5:3),item.name);
    return results;
  });
  await check('320 CSS-pixel reflow and keyboard-readable charts',async()=>{
    await page.setViewportSize({width:320,height:740});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Page overflow');
    const results=[];
    for(const id of ['frequency-chart','ogive-chart','boxplot-chart']) {
      const region=page.locator('#'+id);
      assert(await region.getAttribute('tabindex')==='0',id+' cannot receive keyboard focus');
      await region.focus();await page.keyboard.press('ArrowRight');
      await page.waitForFunction(id=>document.getElementById(id).scrollLeft>0,id);
      const size=await region.evaluate(el=>({
        scrollLeft:el.scrollLeft,client:el.clientWidth,scroll:el.scrollWidth,
        renderedFont:parseFloat(el.querySelector('svg text').getAttribute('font-size'))*
          el.querySelector('svg').getBoundingClientRect().width/740
      }));
      assert(size.scrollLeft>0 && size.renderedFont>=12,id+' labels shrink or do not scroll');
      results.push({id,...size});
    }
    await page.screenshot({path:path.join(output,'narrow-chart.png'),fullPage:true});
    return results;
  });
  await check('colliding labels remain unique in visible selector',async()=>{
    await page.locator('#csv-file').setInputFiles({name:'collision.csv',mimeType:'text/csv',buffer:Buffer.from('score,score (2),score\n1,2,3')});
    await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Loaded collision.csv'));
    const labels=await page.locator('#column-select option').allTextContents();
    assert(labels[2]==='score (3) (1 numeric)',JSON.stringify(labels));return labels;
  });
  const header=Array.from({length:100},(_,i)=>`c${i}`).join(',')+'\n';
  const workloads=[
    {name:'near-5MiB-100-columns',source:header+(Array(100).fill('1').join(',')+'\n').repeat(26210),rows:26210,columns:100},
    {name:'31000-rows-100-columns-missing-invalid',source:header+(Array(100).fill('').map((_,i)=>i%3===0?'1':i%3===1?'':'x').join(',')+'\n').repeat(31000),rows:31000,columns:100},
    {name:'50000-rows-50-columns',source:Array.from({length:50},(_,i)=>`c${i}`).join(',')+'\n'+(Array(50).fill('1').join(',')+'\n').repeat(50000),rows:50000,columns:50},
    {name:'50000-rows-100-columns-sparse',source:header+('1'+','.repeat(99)+'\n').repeat(50000),rows:50000,columns:100}
  ];
  const cdp=await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
  for(const item of workloads) await check(item.name+'-4x-cpu',async()=>{
    const bytes=Buffer.from(item.source);
    assert(bytes.length<=5*1024*1024,'Test exceeds supported input limit');
    const started=performance.now();
    await page.locator('#csv-file').setInputFiles({name:item.name+'.csv',mimeType:'text/csv',buffer:bytes});
    await page.waitForFunction(name=>document.querySelector('#status').textContent.includes('Loaded '+name),item.name,{timeout:60000});
    assert((await page.locator('#quality').textContent()).includes(`Rows: ${item.rows}`),'row count');
    await page.locator('#column-select').selectOption(`column-${item.columns-1}`);
    return {bytes:bytes.length,rows:item.rows,elapsedMs:Math.round(performance.now()-started)};
  });
  await cdp.send('Emulation.setCPUThrottlingRate',{rate:1});
  await check('overwide input rejects and recovers',async()=>{
    await page.locator('#csv-file').setInputFiles({name:'wide.csv',mimeType:'text/csv',buffer:Buffer.from(','.repeat(1_000_000))});
    await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('COLUMN_LIMIT'));
    await page.locator('#sample-scores').click();
    await page.locator('#export-controls').waitFor({state:'visible'});
    return {status:await page.locator('#status').textContent()};
  });
  await check('runtime has no page errors',()=>{assert(errors.length===0,errors.join('\n'));return errors;});
  const prefixes=['=1+1','+1+1','-1+1','@SUM(1,1)',' =1+1','\t=1+1','\r=1+1','\n=1+1','\uFEFF=1+1','\u200b=1+1',"'already text",'ordinary'];
  await writeFile(path.join(output,'spreadsheet-prefixes.csv'),serializeCsv([['case','value'],...prefixes.map((v,i)=>[i,v])]));
} finally {
  await browser.close();server.close();server.closeAllConnections();
  report.status=report.checks.some(c=>c.status==='fail')?'fail':'pass';
  await writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
  if(report.status==='fail')process.exitCode=1;
}
