// Deterministic analytics: never infer missing market observations.
export function validCandle(c) {
  return c && [c.open,c.high,c.low,c.close].every(Number.isFinite) && c.open>0 && c.low>0 && c.high>=Math.max(c.open,c.close) && c.low<=Math.min(c.open,c.close);
}
export function candleMetrics(c) {
  if(!validCandle(c)) return null;
  const range=c.high-c.low, body=Math.abs(c.close-c.open);
  return {change:c.close-c.open,changePercent:(c.close-c.open)/c.open*100,range,body,
    upperWick:c.high-Math.max(c.open,c.close),lowerWick:Math.min(c.open,c.close)-c.low,
    bodyRatio:range===0?null:body/range,volume:Number.isFinite(c.volume)&&c.volume>=0?c.volume:null};
}
export function compareCandles(a,b) {
  const first=candleMetrics(a),second=candleMetrics(b);
  if(!first||!second||!Number.isFinite(a.openTime)||!Number.isFinite(b.openTime)) return null;
  const volumeDifference=first.volume===null||second.volume===null?null:second.volume-first.volume;
  return {first,second,closeDifference:b.close-a.close,closePercent:(b.close-a.close)/a.close*100,
    volumeDifference,volumePercent:volumeDifference===null||first.volume===0?null:volumeDifference/first.volume*100,
    elapsedMs:b.openTime-a.openTime,firstActive:a.closed===false,secondActive:b.closed===false};
}
export function candlePatterns(candles,index) {
  const c=candles?.[index],p=candles?.[index-1];
  if(!validCandle(c)||c.closed!==true) return [];
  const m=candleMetrics(c), result=[];
  if(m.range>0&&m.body/m.range<=0.1) result.push('Doji');
  if(m.range>0&&m.body/m.range<=0.35&&m.lowerWick>=m.body*2&&m.lowerWick>m.upperWick*1.5) result.push('Hammer-like');
  if(m.range>0&&m.body/m.range<=0.35&&m.upperWick>=m.body*2&&m.upperWick>m.lowerWick*1.5) result.push('Shooting-star-like');
  if(validCandle(p)&&p.closed===true) {
    if(c.high<p.high&&c.low>p.low) result.push('Inside Bar');
    if(c.high>p.high&&c.low<p.low) result.push('Outside Bar');
    if(p.close<p.open&&c.close>c.open&&c.open<=p.close&&c.close>=p.open) result.push('Bullish Engulfing');
    if(p.close>p.open&&c.close<c.open&&c.open>=p.close&&c.close<=p.open) result.push('Bearish Engulfing');
  }
  return result;
}
export function volumeMetrics(candles,index,period=20) {
  const candle=candles?.[index];
  if(!validCandle(candle)||candle.closed!==true||!Number.isFinite(candle.volume)||candle.volume<0||!Number.isInteger(period)||period<2||index<period) return null;
  const history=candles.slice(index-period,index);
  if(history.length!==period||history.some(c=>!validCandle(c)||c.closed!==true||!Number.isFinite(c.volume)||c.volume<0)) return null;
  const average=history.reduce((sum,c)=>sum+c.volume,0)/period;
  return {average,relative:average>0?candle.volume/average:null,unusual:average>0&&candle.volume>=average*2};
}
