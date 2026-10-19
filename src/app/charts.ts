/** SVG statistical charts. Values and labels always originate from verified mathematical objects. */
import type { FrequencyDistribution,OgivePoint,BoxPlotSummary } from '../domain/types.js';
const NS='http://www.w3.org/2000/svg';
const WIDTH=740, HEIGHT=270;
const axis='#596c81',grid='#dfe8f1',accent='#176aa2',muted='#35465e';
function svgElement<K extends keyof SVGElementTagNameMap>(tag:K, attrs:Record<string,string|number>={}): SVGElementTagNameMap[K] {
  const el=document.createElementNS(NS,tag);
  for (const [k,v] of Object.entries(attrs)) el.setAttribute(k,String(v));
  return el;
}
function label(svg:SVGSVGElement,x:number,y:number,text:string,attr:Record<string,string|number>={}):void {
  const el=svgElement('text',{x,y,fill:muted,'font-size':12,...attr});el.textContent=text;svg.append(el);
}
function line(svg:SVGSVGElement,x1:number,y1:number,x2:number,y2:number,stroke=axis,strokeWidth=1.25):void {
  svg.append(svgElement('line',{x1,y1,x2,y2,stroke,'stroke-width':strokeWidth}));
}
function number(x:number):string {
  if (!Number.isFinite(x)) return 'invalid';
  if (x===0) return '0';
  return Number(x.toPrecision(5)).toString();
}
function base(id:string,title:string,description:string):SVGSVGElement {
  const svg=svgElement('svg',{viewBox:`0 0 ${WIDTH} ${HEIGHT}`,role:'img', 'aria-labelledby':`${id}-title ${id}-desc`,
    xmlns:NS,width:'740',height:'270',preserveAspectRatio:'xMidYMid meet'});
  const t=svgElement('title',{id:`${id}-title`});t.textContent=title;
  const d=svgElement('desc',{id:`${id}-desc`});d.textContent=description;
  svg.append(t,d);return svg;
}
function xyAxes(svg:SVGSVGElement,left:number,top:number,right:number,bottom:number,yMax:number,yTitle:string):void {
  for(let i=0;i<=4;i++) {
    const y=bottom-(bottom-top)*i/4;
    line(svg,left,y,right,y,grid,.9);label(svg,left-8,y+4,number(yMax*i/4),{'text-anchor':'end'});
  }
  line(svg,left,top,left,bottom);line(svg,left,bottom,right,bottom);
  label(svg,12,18,yTitle,{'font-size':12,'font-weight':600});
}
export function histogramSvg(dist:FrequencyDistribution, id='histogram'):SVGSVGElement {
  const max=Math.max(1,...dist.bins.map(b=>b.count));
  const desc=`${dist.n} observations grouped into ${dist.bins.length} ${dist.isConstant?'constant-data bin':'left-inclusive bins'}; bar frequencies ${dist.bins.map(b=>b.count).join(', ')||'none'}. A frequency table provides the exact values.`;
  const svg=base(id,'Histogram of valid observations',desc);
  const left=65,right=710,top=40,bottom=225;
  xyAxes(svg,left,top,right,bottom,Math.ceil(max),'Frequency');
  const n=dist.bins.length;
  if(n) {
    const slot=(right-left)/n;
    dist.bins.forEach((b,i)=>{
      const height=(bottom-top)*(b.count/Math.ceil(max));
      svg.append(svgElement('rect',{x:left+i*slot+1,y:bottom-height,width:Math.max(1,slot-2),height,
        fill:accent,rx:Math.min(2,slot/5)}));
    });
    const low=dist.bins[0]!.lower,high=dist.bins.at(-1)!.upper;
    label(svg,left,bottom+18,number(low),{'text-anchor':'start'});
    label(svg,right,bottom+18,number(high),{'text-anchor':'end'});
    label(svg,(left+right)/2,bottom+35,'Class boundaries',{'text-anchor':'middle'});
  }
  return svg;
}
export function ogiveSvg(points:readonly OgivePoint[],n:number,id='ogive'):SVGSVGElement {
  const svg=base(id,'Less-than cumulative-frequency ogive',`Grouped cumulative frequencies at bin upper boundaries; final count ${n}. The table lists exact class boundaries and cumulative frequencies.`);
  const left=65,right=710,top=40,bottom=225;
  xyAxes(svg,left,top,right,bottom,Math.max(1,n),'Cumulative frequency');
  if(!points.length) return svg;
  const xmin=points[0]!.x,xmax=points[points.length-1]!.x;
  const range=xmax-xmin;
  if(!(range>0)) return svg;
  const px=(x:number)=>left+(right-left)*(x-xmin)/range;
  const py=(y:number)=>bottom-(bottom-top)*y/Math.max(1,n);
  const d=points.map((p,i)=>`${i?'L':'M'} ${px(p.x).toFixed(3)} ${py(p.cumulative).toFixed(3)}`).join(' ');
  svg.append(svgElement('path',{d,fill:'none',stroke:accent,'stroke-width':3,'stroke-linecap':'round','stroke-linejoin':'round'}));
  for (const p of points) svg.append(svgElement('circle',{cx:px(p.x),cy:py(p.cumulative),r:3.4,fill:accent}));
  label(svg,left,bottom+18,number(xmin),{'text-anchor':'start'});
  label(svg,right,bottom+18,number(xmax),{'text-anchor':'end'});
  label(svg,(left+right)/2,bottom+35,'Upper class boundary',{'text-anchor':'middle'});
  return svg;
}
export function boxplotSvg(data:BoxPlotSummary,id='boxplot'):SVGSVGElement {
  const detail=`Median ${number(data.median??NaN)}, Type-7 quartiles ${number(data.q1??NaN)} and ${number(data.q3??NaN)}; observed whiskers ${number(data.lowerWhisker??NaN)}, ${number(data.upperWhisker??NaN)}; ${data.outliers.length} outlier observations.`;
  const svg=base(id,'Horizontal Tukey-style box plot',detail);
  if(data.median===null || data.q1===null || data.q3===null||data.lowerWhisker===null||data.upperWhisker===null) return svg;
  const all=[data.lowerWhisker,data.upperWhisker,...data.outliers];
  const dataMin=Math.min(...all),dataMax=Math.max(...all);
  const padding=dataMin===dataMax?Math.max(1,Math.abs(dataMin)*.03):Math.max((dataMax-dataMin)*.06,Number.EPSILON);
  const xmin=dataMin-padding,xmax=dataMax+padding, left=65,right=710,y=128;
  const px=(value:number)=>left+(right-left)*(value-xmin)/(xmax-xmin);
  line(svg,left,210,right,210);
  for(let i=0;i<=4;i++) {
    const x=left+(right-left)*i/4;
    line(svg,x,206,x,214);
    label(svg,x,230,number(xmin+(xmax-xmin)*i/4),{'text-anchor':'middle'});
  }
  label(svg,(left+right)/2,252,'Observed values',{'text-anchor':'middle'});
  const a=px(data.lowerWhisker),b=px(data.upperWhisker),ql=px(data.q1),qu=px(data.q3),m=px(data.median);
  line(svg,a,y,b,y,accent,2.5);
  line(svg,a,y-21,a,y+21,accent,2);line(svg,b,y-21,b,y+21,accent,2);
  svg.append(svgElement('rect',{x:Math.min(ql,qu),y:y-35,width:Math.max(1,Math.abs(qu-ql)),height:70,fill:'#d1e6f5',stroke:accent,'stroke-width':2}));
  line(svg,m,y-35,m,y+35,'#b25122',3);
  // Identical outlier values are combined visually; the tabular summary still reports all observations.
  const unique=[...new Set(data.outliers)].sort((x,y)=>x-y);
  for (const value of unique.slice(0,75)) svg.append(svgElement('circle',{cx:px(value),cy:y,r:5,fill:'#b25122',stroke:'#ffffff','stroke-width':1}));
  if(unique.length>75) label(svg,right,34,`Showing 75 of ${unique.length} distinct outlier positions`,{'text-anchor':'end'});
  label(svg,left,22,`Observed whiskers · Type-7 quartiles · ${data.outliers.length} outlier observations`,{'font-size':12});
  return svg;
}
