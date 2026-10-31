"use strict";
window.SetFlowBody=(()=>{
 const SHEET="1a1c7sYQX9sSWfgcZ3kGviHdTBF6R7m2kCHHUDUe2shQ";
 const TAB="'測定履歴'";
 const HEADERS=["測定日時","年齢 (歳)","身長 (cm)","体重 (kg)","体脂肪率 (%)","脂肪量 (kg)","除脂肪量 (kg)","筋肉量 (kg)","筋肉量評価","体水分量 (kg)","推定骨量 (kg)","基礎代謝量 (kcal/日)","代謝判定","内臓脂肪レベル","内臓脂肪判定","BMI","標準体重 (kg)","肥満度 (%)","体脂肪率標準範囲 (%)","体型・機器"];
 const METRICS=[{i:3,label:"体重",unit:"kg",min:0,max:500},{i:4,label:"体脂肪率",unit:"%",min:0,max:100},{i:7,label:"筋肉量",unit:"kg",min:0,max:300},{i:15,label:"BMI",unit:"",min:0,max:100}];
 const MORE=[{i:2,name:"身長",unit:"cm",min:50,max:250},{i:5,name:"脂肪量",unit:"kg",min:0,max:300},{i:6,name:"除脂肪量",unit:"kg",min:0,max:300},{i:9,name:"体水分量",unit:"kg",min:0,max:300},{i:10,name:"推定骨量",unit:"kg",min:0,max:50},{i:11,name:"基礎代謝量",unit:"kcal/日",min:0,max:6000},{i:13,name:"内臓脂肪レベル",unit:"",min:0,max:60},{i:16,name:"標準体重",unit:"kg",min:0,max:500},{i:17,name:"肥満度",unit:"%",min:-100,max:500}];
 const esc=s=>String(s??"").replace(/[&<>"']/g,x=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[x]));
 let api=null, editId=null, metric=3, syncing=false, status="",lastPull=0;
 const db=()=>{const d=api.getData();if(!Array.isArray(d.bodyMeasurements))d.bodyMeasurements=[];if(!Array.isArray(d.deletedBodyIds))d.deletedBodyIds=[];return d};
 const rows=()=>db().bodyMeasurements;
 const pad=x=>String(x).padStart(2,"0");
 const now=()=>{const d=new Date();return {day:d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate()),time:pad(d.getHours())+":"+pad(d.getMinutes())}};
 const atKey=s=>{const v=String(s||"").trim().replace("T"," ");const m=/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})/.exec(v);return m?m[1]+" "+m[2]:null};
 const dateText=s=>{const v=atKey(s);return v?v.slice(0,10).replace(/-/g,"/")+(v.slice(11)==="00:00"?"":" "+v.slice(11)):"--"};
 const val=(row,i)=>row.values[i]===0?0:row.values[i]??"";
 const latest=()=>[...rows()].sort((a,b)=>String(b.at).localeCompare(String(a.at)));
 const numeric=(v,min,max)=>{if(v===""||v==null)return "";const n=Number(v);return Number.isFinite(n)&&n>=min&&n<=max?n:null};
 const field=(idx,label,unit="",min=0,max=100000,step="any")=>'<label class="body-field">'+esc(label)+(unit?' <small>('+esc(unit)+')</small>':"")+'<input data-body-field="'+idx+'" type="number" inputmode="decimal" step="'+step+'" min="'+min+'" max="'+max+'" value="" placeholder="—"></label>';
 const sparkline=items=>{
  const points=items.slice().reverse().filter(e=>Number.isFinite(Number(val(e,metric)))&&val(e,metric)!=="").slice(-30);
  if(points.length<2)return '<p class="muted body-empty-chart">2回以上の測定で推移を表示します</p>';
  const values=points.map(e=>Number(val(e,metric))),lo=Math.min(...values),hi=Math.max(...values),span=hi-lo||1,w=320,h=95;
  const xy=values.map((v,i)=>(14+i*(w-28)/(values.length-1)).toFixed(1)+","+(h-12-(v-lo)/span*(h-28)).toFixed(1)).join(" ");
  return '<svg class="body-chart" viewBox="0 0 320 95" role="img" aria-label="'+esc(METRICS.find(x=>x.i===metric).label)+'の推移"><polyline points="'+xy+'" fill="none" stroke="#7fa2ff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'+
  '<div class="body-trend-ends"><span>'+esc(dateText(points[0].at).slice(0,10))+'</span><span>'+esc(dateText(points[points.length-1].at).slice(0,10))+'</span></div>';
 };
 function render(){
  const sorted=latest(),current=sorted[0],selected=METRICS.find(m=>m.i===metric);
  const metricTiles=METRICS.map(m=>{
   const v=current?val(current,m.i):"";
   return '<button type="button" class="body-metric '+(metric===m.i?"selected":"")+'" data-body-action="metric" data-index="'+m.i+'"><span>'+m.label+'</span><strong>'+(v===""?"—":esc(v))+'</strong><small>'+m.unit+'</small></button>';
  }).join("");
  const cards=sorted.map(entry=>{
   const fields=METRICS.map(m=>{const v=val(entry,m.i);return '<div><span class="muted">'+m.label+'</span><strong>'+(v===""?"—":esc(v))+(v!==""&&m.unit?" "+m.unit:"")+'</strong></div>'}).join("");
   const details=entry.values.map((v,i)=>i!==0&&i!==3&&i!==4&&i!==7&&i!==15&&v!==""&&v!=null?'<div class="body-detail"><span>'+esc(HEADERS[i])+'</span><span>'+esc(v)+'</span></div>':"").join("");
   return '<article class="card body-entry"><div class="body-entry-top"><strong>'+esc(dateText(entry.at))+'</strong><button type="button" data-body-action="edit" data-id="'+esc(entry.id)+'">編集</button></div><div class="body-entry-metrics">'+fields+'</div>'+ (details?'<details><summary>全項目を見る</summary>'+details+'</details>':"")+'</article>';
  }).join("");
  return '<div class="body-toolbar"><span class="muted">測定履歴 '+sorted.length+'件</span><button type="button" data-body-action="new" class="body-new">＋ 測定を追加</button></div>'+
   '<div class="body-metrics">'+metricTiles+'</div><section class="card body-chart-card"><div class="body-chart-title">'+selected.label+'の推移</div>'+sparkline(sorted)+'</section>'+
   '<div id="body-sync-note" class="body-sync-note">'+esc(status||(!api.connected()?"Google未接続・端末に保存":""))+'</div>'+
   '<div id="body-form-slot">'+(editId==="new"||editId?form(): "")+'</div>'+
   '<div class="body-history-list">'+(cards||'<p class="body-no-records">測定データはまだありません。Googleに接続すると過去の測定を読み込みます。</p>')+'</div>';
 }
 function form(){
  const item=editId!=="new"?rows().find(x=>x.id===editId):null;
  const t=now(),at=item?atKey(item.at):null;
  const date=at?at.slice(0,10):t.day,time=at?at.slice(11):t.time;
  const s='<section class="card body-editor"><div class="body-editor-title"><h2>'+(item?"測定を編集":"新しい測定")+'</h2><button data-body-action="cancel" type="button">閉じる</button></div>'+
   '<div class="body-date-fields"><label>測定日<input id="body-day" type="date" value="'+date+'" '+(item?"disabled":"")+'></label><label>時刻<input id="body-time" type="time" value="'+time+'" '+(item?"disabled":"")+'></label></div>'+
   '<div class="body-input-grid">'+field(3,"体重","kg",0,500)+field(4,"体脂肪率","%",0,100)+field(7,"筋肉量","kg",0,300)+field(15,"BMI","",0,100)+'</div>'+
   '<details class="body-more"><summary>その他の測定値</summary><div class="body-input-grid">'+MORE.map(m=>field(m.i,m.name,m.unit,m.min,m.max)).join("")+'</div>'+
   '<label class="body-field">筋肉量評価<input data-body-field="8" type="text" value=""></label>'+
   '<label class="body-field">代謝判定<input data-body-field="12" type="text" value=""></label>'+
   '<label class="body-field">内臓脂肪判定<input data-body-field="14" type="text" value=""></label>'+
   '<label class="body-field">体脂肪率標準範囲<input data-body-field="18" type="text" value=""></label>'+
   '<label class="body-field">体型・機器<input data-body-field="19" type="text" value=""></label>'+
   '<label class="body-field">測定時年齢<input data-body-field="1" type="number" min="0" max="125" step="1" value=""></label></details>'+
   '<button type="button" class="primary body-save" data-body-action="save">測定値を保存</button>'+
   (item?'<button type="button" class="body-delete" data-body-action="delete">この測定を削除</button>':"")+'</section>';
  return s;
 }
 function populateForm(){
  if(editId==="new")return;
  const item=rows().find(x=>x.id===editId);if(!item)return;
  for(let i=1;i<20;i++){const field=document.querySelector('[data-body-field="'+i+'"]');if(field)field.value=val(item,i)}
 }
 function refresh(preserve=false){
  if(api.activeTab()!=="body")return;
  if(preserve&&document.querySelector(".body-editor"))return;
  api.refresh();
  populateForm();
 }
 function setStatus(s){status=s;const n=document.getElementById("body-sync-note");if(n)n.textContent=s}
 function handleClick(button){
  const action=button.dataset.bodyAction;if(!action)return false;
  if(action==="metric"){metric=Number(button.dataset.index);refresh();return true}
  if(action==="new"){editId="new";refresh();document.getElementById("body-form-slot")?.scrollIntoView?.({block:"nearest"});return true}
  if(action==="edit"){editId=button.dataset.id;refresh();document.getElementById("body-form-slot")?.scrollIntoView?.({block:"nearest"});return true}
  if(action==="cancel"){editId=null;refresh();return true}
  if(action==="delete"){
   const item=rows().find(x=>x.id===editId);if(!item)return true;
   if(!confirm("この測定を削除しますか？\nGoogleシートに同期済みの場合も削除されます。"))return true;
   db().deletedBodyIds.push(item.id);db().bodyMeasurements=rows().filter(x=>x.id!==item.id);
   editId=null;api.save();refresh();if(api.connected())api.triggerSync();return true
  }
  if(action==="save"){
   const current=editId==="new"?null:rows().find(x=>x.id===editId);
   const day=document.getElementById("body-day")?.value, time=document.getElementById("body-time")?.value;
   const at=current?.at||atKey((day||"")+" "+(time||""));
   if(!at){alert("日付と時刻を入力してください");return true}
   const id=atKey(at);
   if(!current && rows().some(r=>r.id===id)){alert("同じ日時の測定が既に存在します。履歴から「編集」を選んでください");return true}
   const values=current?[...current.values]:Array(20).fill("");
   values[0]=id;
   const inputs=document.querySelectorAll("[data-body-field]");
   for(const field of inputs){
    const i=Number(field.dataset.bodyField),value=field.value.trim();
    const def=[...METRICS,...MORE].find(d=>d.i===i);
    if(def){const n=numeric(value,def.min,def.max);if(n===null){alert("「"+HEADERS[i]+"」の入力値を確認してください");return true}values[i]=n}
    else if(i===1){const n=numeric(value,0,125);if(n===null||n!==""&&!Number.isInteger(n)){alert("測定時年齢を確認してください");return true}values[i]=n}
    else values[i]=value.slice(0,160);
   }
   if(values[3]===""){alert("体重を入力してください");return true}
   const item={id,at:id,values,dirty:true};
   if(current)db().bodyMeasurements=rows().map(x=>x.id===current.id?item:x);
   else rows().push(item);
   if(!api.save()){alert("端末への保存に失敗しました");return true}
   editId=null;refresh();setStatus("端末に保存しました。"+(api.connected()?"Googleへ同期中":"Google接続後に同期します"));
   if(api.connected())api.triggerSync();return true;
  }
  return false;
 }
 function parseCloud(row){
  if(!Array.isArray(row)||!row.length)return null;
  const at=atKey(row[0]);if(!at)return null;
  const values=Array.from({length:20},(_,i)=>row[i]??"");values[0]=at;
  // Empty rows and malformed weight should never become measurements.
  if(numeric(values[3],0,500)===null||values[3]==="")return null;
  return {id:at,at,values,dirty:false};
 }
 async function sync(){
  if(!api.connected())return;
  if(syncing)return;
  syncing=true;setStatus("体組成データを同期中…");
  try{
   const response=await api.request("/values/"+encodeURIComponent(TAB)+"!A2:T?valueRenderOption=UNFORMATTED_VALUE",{},SHEET);
   const cloud=new Map();
   const cloudRows=response.values||[];
   cloudRows.forEach((r,i)=>{const item=parseCloud(r);if(item&&!cloud.has(item.id))cloud.set(item.id,{item,row:i+2})});
   const deleted=new Set(db().deletedBodyIds);
   const local=new Map(rows().map(r=>[r.id,r]));
   let pulled=0,pushed=0;
   // Fetch cloud records that do not already exist locally. Local dirty edits take precedence.
   for(const [id,remote] of cloud){
    if(deleted.has(id))continue;
    if(!local.has(id)){rows().push(remote.item);local.set(id,remote.item);pulled++}
    else if(!local.get(id).dirty)Object.assign(local.get(id),remote.item);
   }
   // Persist cloud data before attempting writes.
   if(!api.save())throw Error("端末への保存に失敗しました");
   // Deletion clears the original row in place; other rows remain untouched.
   const toClear=[...deleted].filter(id=>cloud.has(id)).map(id=>TAB+"!A"+cloud.get(id).row+":T"+cloud.get(id).row);
   if(toClear.length)await api.request("/values:batchClear",{method:"POST",body:JSON.stringify({ranges:toClear})},SHEET);
   for(const r of [...rows()].filter(r=>r.dirty)){
    const existing=cloud.get(r.id);
    const location=existing?"/values/"+encodeURIComponent(TAB)+"!A"+existing.row+":T"+existing.row:"/values/"+encodeURIComponent(TAB)+"!A:T:append";
    const query=existing?"?valueInputOption=RAW":"?valueInputOption=RAW&insertDataOption=INSERT_ROWS";
    await api.request(location+query,{method:existing?"PUT":"POST",body:JSON.stringify({values:[r.values]})},SHEET);
    r.dirty=false;pushed++;
   }
   if(!api.save())throw Error("端末への保存に失敗しました");
   lastPull=Date.now();setStatus("同期済み"+(pulled?" · "+pulled+"件を読み込み":"")+(pushed?" · "+pushed+"件を保存":""));
   refresh(true);
  }catch(e){setStatus("体組成の同期エラー："+(e.message||String(e)));throw e}
  finally{syncing=false}
 }
 const init=deps=>{api=deps;db()};
 return {init,render,handleClick,sync,refresh,version:"1.0"};
})();