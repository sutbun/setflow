"use strict";
window.SetFlowGrowth=(()=>{
 const escape=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const pad=n=>String(n).padStart(2,"0");
 const localDay=date=>date.getFullYear()+"-"+pad(date.getMonth()+1)+"-"+pad(date.getDate());
 const asDate=record=>{const d=new Date(record.at);return Number.isFinite(d.getTime())?d:null};
 const oneRM=r=>{
  const weight=Number(r.weight),reps=Number(r.reps);
  if(!Number.isFinite(weight)||weight<=0||!Number.isInteger(reps)||reps<1||reps>10)return null;
  return reps===1?weight:weight*(1+reps/30);
 };
 const round=n=>Math.round(n*10)/10;
 const formatted=n=>Number.isFinite(n)?String(round(n)):"—";
 function monday(date){
  const d=new Date(date.getFullYear(),date.getMonth(),date.getDate());
  d.setDate(d.getDate()-(d.getDay()+6)%7);return d;
 }
 function analyze(data,exerciseId,now=new Date()){
  const selected=(Array.isArray(data.records)?data.records:[]).filter(r=>
   !r.deletedAt&&r.exerciseId===exerciseId&&asDate(r)&&
   Number.isFinite(Number(r.weight))&&Number.isInteger(Number(r.reps))&&Number(r.reps)>0
  ).sort((a,b)=>asDate(a)-asDate(b));
  const valid=selected.map(r=>({r,value:oneRM(r)})).filter(x=>x.value!==null);
  const best=valid.reduce((acc,x)=>!acc||x.value>acc.value?x:acc,null);
  const validDays=new Map();
  for(const item of valid){
   const day=localDay(asDate(item.r));
   const prior=validDays.get(day);
   if(!prior||item.value>prior.value)validDays.set(day,item);
  }
  const sessions=[...validDays].sort((a,b)=>a[0].localeCompare(b[0])).map(([day,item])=>({day,value:item.value,record:item.r}));
  const recent=sessions.at(-1),previous=sessions.at(-2);
  const delta=recent&&previous?round(recent.value-previous.value):null;
  const start=monday(now);
  const weeks=[];
  for(let offset=7;offset>=0;offset--){
   const date=new Date(start);
   date.setDate(start.getDate()-7*offset);
   const end=new Date(date);end.setDate(date.getDate()+7);
   const count=selected.filter(r=>{const t=asDate(r);return t>=date&&t<end}).length;
   weeks.push({start:localDay(date),label:pad(date.getMonth()+1)+"/"+pad(date.getDate()),count});
  }
  return {records:selected,best,e1rm:best?.value??null,sessions,delta,weeks,
    weekCount:weeks.at(-1).count,previousWeekCount:weeks.at(-2).count,
    hasZeroWeights:selected.some(r=>Number(r.weight)===0)};
 }
 function chart(sessions){
  if(sessions.length<2)return '<p class="growth-empty-chart">別の日の記録が増えると筋力の推移を表示します</p>';
  const points=sessions.slice(-12),values=points.map(p=>p.value);
  const min=Math.min(...values),max=Math.max(...values),range=max-min||1,w=320,h=120;
  const positions=points.map((p,i)=>({x:16+i*(w-32)/(points.length-1),y:h-18-(p.value-min)/range*(h-40)}));
  const path=positions.map((p,i)=>(i?"L":"M")+p.x.toFixed(2)+" "+p.y.toFixed(2)).join(" ");
  const marks=positions.map(p=>'<circle cx="'+p.x.toFixed(2)+'" cy="'+p.y.toFixed(2)+'" r="3.5" fill="#91adff"/>').join("");
  return '<div class="growth-chart-label"><span>'+formatted(max)+' kg</span><span>'+formatted(min)+' kg</span></div>'+
   '<svg class="growth-rm-chart" viewBox="0 0 '+w+' '+h+'" role="img" aria-label="測定日ごとの推定1RMの推移">'+
   '<path d="'+path+'" fill="none" stroke="#86a5ff" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>'+marks+'</svg>'+
   '<div class="growth-chart-ends"><span>'+escape(points[0].day.replace(/-/g,"/"))+'</span><span>'+escape(points.at(-1).day.replace(/-/g,"/"))+'</span></div>';
 }
 function weekBars(weeks){
  const max=Math.max(1,...weeks.map(w=>w.count));
  return '<div class="growth-weeks">'+weeks.map(w=>{
   const height=w.count===0?0:Math.max(7,Math.round(w.count/max*58));
   return '<div class="growth-week"><span class="growth-week-count">'+w.count+'</span>'+
    '<div class="growth-week-track"><div class="growth-week-bar" style="height:'+height+'px"></div></div>'+
    '<span class="growth-week-label">'+w.label+'</span></div>';
  }).join("")+'</div>';
 }
 function render(data,chosenId,now=new Date()){
  const exercises=Array.isArray(data.exercises)?data.exercises:[];
  const allIds=new Map(exercises.map(e=>[e.id,e.name]));
  for(const r of data.records||[])if(!r.deletedAt&&r.exerciseId&&!allIds.has(r.exerciseId))allIds.set(r.exerciseId,r.exerciseName||"種目");
  if(!allIds.size)return '<p class="growth-empty">種目を登録すると成長指標を確認できます。</p>';
  const id=allIds.has(chosenId)?chosenId:allIds.keys().next().value;
  const options=[...allIds].map(([key,name])=>'<option value="'+escape(key)+'" '+(key===id?"selected":"")+'>'+escape(name)+'</option>').join("");
  const a=analyze(data,id,now),best=a.best?.r;
  const delta=a.delta===null?'比較データ不足':a.delta>0?'+'+formatted(a.delta)+' kg':a.delta<0?formatted(a.delta)+' kg':'変化なし';
  const deltaStyle=a.delta>0?' positive':a.delta<0?' negative':'';
  const mark=best?escape(formatted(Number(best.weight)))+' kg × '+escape(best.reps)+' 回':'—';
  const caution=a.hasZeroWeights?'重量0kgのセットは推定1RMに含みません。':'';
  return '<div class="growth-view"><label class="growth-exercise-select">種目<select id="growth-exercise" aria-label="成長を確認する種目">'+options+'</select></label>'+
   '<section class="card growth-summary-card"><div class="growth-stats">'+
   '<div><span class="growth-stat-label">自己ベスト（セット）</span><strong>'+mark+'</strong></div>'+
   '<div><span class="growth-stat-label">推定1RM</span><strong>'+(a.e1rm===null?'—':formatted(a.e1rm)+' kg')+'</strong></div>'+
   '</div><div class="growth-compare"><span>前の記録日との推定1RM比較</span><strong class="growth-change'+deltaStyle+'">'+delta+'</strong></div>'+
   '<p class="growth-footnote">推定1RMは重量がある1〜10回のセットをEpley式で概算。限界まで行ったとは限らず、実測最大筋力ではありません。'+caution+'</p></section>'+
   '<section class="card growth-chart-card"><h2>筋力の推移</h2>'+chart(a.sessions)+'</section>'+
   '<section class="card growth-volume-card"><div class="growth-week-heading"><h2>週間セット数</h2><strong>'+a.weekCount+'セット</strong></div>'+
   '<p class="growth-secondary">先週 '+a.previousWeekCount+'セット · 選択中の種目 · 月〜日で集計</p>'+
   weekBars(a.weeks)+'</section>'+
   '<p class="growth-note">記録・編集・削除はこれまでどおり。成長指標は自動計算されます。</p></div>';
 }
 return {analyze,render,oneRM,monday};
})();