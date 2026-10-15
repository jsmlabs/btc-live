import { evaluateEventConfluence } from './event-replay.js';

const fmt = new Intl.NumberFormat('en-US', {maximumFractionDigits:3});
const palette={ bid:'#75c69e', ask:'#dc8089', line:'#b7c8e1', text:'#b4c0d1', grid:'rgba(185,196,210,.15)' };
const stamp=(n)=>new Date(n).toLocaleTimeString('en-US',{hour12:false});

export function createEventReplayRenderer({doc=document}={}) {
  const byId=(name)=>doc.getElementById(`dashboardEvent${name}`);
  let disposed=false;
  function canvas(id) {
    const node=byId(id), context=node?.getContext('2d');
    if (!context) return null;
    const width=Math.max(140,Math.floor(node.getBoundingClientRect().width||600));
    const scale=Math.min(2,globalThis.devicePixelRatio||1),height=120;
    node.width=width*scale;node.height=height*scale;
    context.setTransform(scale,0,0,scale,0,0);context.clearRect(0,0,width,height);
    return {ctx:context,width,height};
  }
  function series(id, frames, prop, title, color) {
    const c=canvas(id); if(!c)return;
    const {ctx,width}=c;const values=frames.map((f)=>f[prop]);
    const actual=values.filter((v)=>typeof v==='number'&&Number.isFinite(v));
    ctx.font='11px system-ui';ctx.fillStyle=palette.text;
    if(!actual.length){ctx.fillText('No recorded '+title,9,60);return;}
    const min=Math.min(...actual),max=Math.max(...actual),range=Math.max(.00001,max-min);
    let previous=null;
    frames.forEach((f,i)=>{
      const v=f[prop],x=6+(width-12)*(frames.length===1?.5:i/(frames.length-1));
      if(typeof v!=='number'||!Number.isFinite(v)){previous=null;return;}
      const y=92-(v-min)/range*67;
      if(previous && (f.at-previous.at>5000 || (prop==='cvdBtc' && f.flowSegment!==previous.segment) || (prop==='price' && f.price===null))){previous=null;}
      if(previous){ctx.strokeStyle=color;ctx.lineWidth=1.8;ctx.beginPath();ctx.moveTo(previous.x,previous.y);ctx.lineTo(x,y);ctx.stroke();}
      ctx.fillStyle=color;ctx.fillRect(x-1,y-1,2,2);
      previous={x,y,at:f.at,segment:f.flowSegment};
    });
    ctx.fillStyle=palette.text;ctx.fillText(`${title} ${fmt.format(actual.at(-1))}`,7,13);ctx.fillText(`${fmt.format(min)} - ${fmt.format(max)}`,7,113);
  }
  function depth(id,frames,selected) {
    const c=canvas(id); if(!c)return;
    const {ctx,width}=c;ctx.font='11px system-ui';ctx.fillStyle=palette.text;
    const pivot=selected.bands?.[0]?.lower ?? selected.price;
    if(!pivot){ctx.fillText('No synchronized depth at cursor',8,60);return;}
    const bucket=selected.bucketSize,base=Math.floor(pivot/bucket)*bucket-5*bucket;
    const max=Math.max(1,...frames.flatMap((f)=>f.bands?.map((b)=>b.notional)??[]));
    frames.forEach((f,i)=>{
      if(!f.bands)return;
      for(const b of f.bands){const row=Math.round((b.lower-base)/bucket);if(row<0||row>=11)continue;
        const alpha=.12+.78*Math.sqrt(b.notional/max);
        const rgb=b.side==='bid'?'117,198,158':'220,128,137';ctx.fillStyle=`rgba(${rgb},${alpha})`;
        ctx.fillRect(i*width/frames.length,100-(row+1)*8,Math.max(1,width/frames.length),8);
      }
    });
    ctx.fillStyle=palette.text;ctx.fillText('Depth USDT · '+fmt.format(base)+'–'+fmt.format(base+11*bucket),7,115);
  }
  function render(frames, position, state) {
    if(disposed)return;
    const slider=byId('Position'), count=byId('Count');
    if(!frames.length){byId('State').textContent=state;byId('Details').textContent='Record or import validated USD-M Futures depth/trade events.';
      byId('Insight').textContent='No comparable event evidence.';slider.disabled=true;slider.value='0';slider.max='0';count.textContent='0 / 0';
      for(const id of ['PriceCanvas','DeltaCanvas','DepthCanvas']){const c=canvas(id);if(c){c.ctx.fillStyle=palette.text;c.ctx.fillText('No events',8,60);}}return;}
    const index=Math.max(0,Math.min(frames.length-1,position)),f=frames[index];
    slider.disabled=false;slider.value=String(index);slider.max=String(frames.length-1);
    count.textContent=`${index+1} / ${frames.length}`;byId('State').textContent=state;
    byId('Details').textContent=`${stamp(f.at)} · #${f.seq} ${f.kind} · USD-M trade price ${f.price===null?'N/A':fmt.format(f.price)+' USDT'} · depth ${f.depthReady?'SYNCED #'+f.depthId:'GAP'} · CVD ${f.cvdBtc===null?'N/A':fmt.format(f.cvdBtc)+' BTC'}`;
    const insight=evaluateEventConfluence(frames,index);
    byId('Insight').textContent=`${insight.label} · ${insight.detail}`;
    const view=frames.slice(Math.max(0,index-119),index+1);
    series('PriceCanvas',view,'price','Futures price',palette.line);
    series('DeltaCanvas',view,'cvdBtc','Segment CVD BTC',palette.bid);
    depth('DepthCanvas',view,f);
  }
  return {render,dispose(){disposed=true;}};
}
