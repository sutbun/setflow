"use strict";
const KEY="setflow-mvp-v1";
const seed=()=>({exercises:[{id:"bench",name:"ベンチプレス",rest:90},{id:"squat",name:"スクワット",rest:180},{id:"pull",name:"ラットプルダウン",rest:90}],records:[],selected:"bench",timer:null});
let data;try{data=JSON.parse(localStorage.getItem(KEY))||seed();if(!Array.isArray(data.exercises)||!Array.isArray(data.records))data=seed()}catch{data=seed()}
let tab="train",notified=false,historyDate=null;
const SHEET_ID="1ie5gs_68OGtXD_4XBfF-SI70JowQhkMIku_e5QIWV20";
const APP_VERSION="DEV-10.31-1";
let googleToken="", tokenExpiry=0, syncing=false, syncAgain=false, syncError="";
let lastCloudCheck=0, restoredThisSession=0;
let gisLoadPromise=null;
const connected=()=>googleToken&&Date.now()<tokenExpiry-60000;
const getClientId=()=>localStorage.getItem("setflow-google-client-id")||"";
const unsynced=()=>data.records.filter(r=>!r.sheetSynced).length;

const el=document.getElementById("app"),fmt=n=>{n=Math.max(0,Math.ceil(n));return String(Math.floor(n/60)).padStart(2,"0")+":"+String(n%60).padStart(2,"0")};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(data));return true}catch{alert("保存できませんでした。空き容量を確認してください。");return false}};
const ex=()=>data.exercises.find(x=>x.id===data.selected)||data.exercises[0];
const last=id=>[...data.records].reverse().find(r=>r.exerciseId===id);
const today=id=>data.records.filter(r=>r.exerciseId===id&&new Date(r.at).toDateString()===new Date().toDateString());

const recordDay=timestamp=>{
 const d=new Date(timestamp);
 if(!Number.isFinite(d.getTime()))return "";
 const pad=n=>String(n).padStart(2,"0");
 return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
};
const recordedDays=()=>[...new Set(data.records.map(r=>recordDay(r.at)).filter(Boolean))].sort().reverse();
const historyRows=()=>{
 const days=recordedDays();
 if(!days.length){historyDate=null;return '<div class="history-empty">まだ記録がありません</div>'}
 if(!historyDate)historyDate=days[0];
 const selected=historyDate;
 const older=days.find(d=>d<selected);
 const newer=[...days].reverse().find(d=>d>selected);
 const onDate=data.records.filter(r=>recordDay(r.at)===selected).sort((a,b)=>new Date(a.at)-new Date(b.at));
 const groups=new Map();
 for(const r of onDate){
  const key=r.exerciseId||r.exerciseName;
  if(!groups.has(key))groups.set(key,{name:r.exerciseName||data.exercises.find(e=>e.id===r.exerciseId)?.name||"種目未設定",records:[]});
  groups.get(key).records.push(r);
 }
 const navigation='<div class="history-nav">'+
 '<button type="button" class="history-arrow" data-action="history-older" aria-label="前の記録日" '+(!older?"disabled":"")+'>&lsaquo;</button>'+
 '<label class="history-date-picker"><span class="history-date-display" aria-hidden="true">'+esc(selected.replace(/-/g,"/"))+'</span><input id="history-date" class="history-date-input" type="date" aria-label="表示する日付" value="'+esc(selected)+'"></label>'+
 '<button type="button" class="history-arrow" data-action="history-newer" aria-label="次の記録日" '+(!newer?"disabled":"")+'>&rsaquo;</button></div>';
 const summary='<div class="history-summary">'+groups.size+'種目 · '+onDate.length+'セット'+
 (selected!==days[0]?'<button class="history-latest" data-action="history-latest">最新の日付へ</button>':"")+'</div>';
 if(!onDate.length)return navigation+summary+'<p class="history-empty">この日の記録はありません。左右の矢印で記録がある日に移動できます。</p>';
 const sections=[...groups.values()].map(group=>
  '<section class="card history-exercise"><div class="history-exercise-heading"><h2>'+esc(group.name)+'</h2><span class="muted">'+group.records.length+'セット</span></div>'+
  group.records.map((r,index)=>'<div class="history-set"><span class="history-set-index">'+(index+1)+'</span><span class="history-set-detail"><strong>'+esc(r.weight)+' kg</strong><span class="history-set-multiply">×</span>'+esc(r.reps)+' 回</span></div>').join("")+'</section>').join("");
 return navigation+summary+sections;
};

const timerHtml=()=>data.timer?'<section class="card timer-card"><div id="clock" class="clock" role="timer" aria-label="インターバルの残り時間">--:--</div><div class="actions"><button data-action="less">−15秒</button><button data-action="more">＋15秒</button><button data-action="stop">終了</button></div></section>':"";
function render(){
 document.querySelectorAll("[data-tab]").forEach(b=>b.classList.toggle("active",b.dataset.tab===tab));
 if(tab==="train"){const x=ex();if(!x){el.innerHTML='<button data-action="add">＋ 種目を追加</button>'+timerHtml();return}
 const prev=last(x.id),sets=today(x.id);el.innerHTML='<section class="card train-card"><select id="exercise" aria-label="種目">'+data.exercises.map(z=>'<option value="'+esc(z.id)+'" '+(z.id===x.id?"selected":"")+'>'+esc(z.name)+'</option>').join("")+'</select><div class="row train-meta"><span class="muted">今日 '+sets.length+' セット · 休憩 '+fmt(x.rest)+'</span><button data-action="edit">種目設定</button></div><div class="fields"><label>重量 (kg)<input id="weight" type="number" min="0" max="2000" step="0.5" inputmode="decimal" value="'+(prev?prev.weight:0)+'"></label><label>回数<input id="reps" type="number" min="1" max="500" step="1" inputmode="numeric" value="'+(prev?prev.reps:10)+'"></label></div><button class="primary" data-action="complete">✓ セット完了・休憩開始</button></section>'+timerHtml()+'<section class="card record-card"><h2>今日の記録</h2>'+(sets.map((r,i)=>'<div class="row item"><span>'+(i+1)+'セット目　'+r.weight+' kg × '+r.reps+' 回</span><button data-action="undo" data-id="'+esc(r.id)+'">取消</button></div>').join("")||'<p class="muted">まだ記録がありません</p>')+'</section>';
 }else if(tab==="history"){el.innerHTML=historyRows()}else if(tab==="body"){el.innerHTML=window.SetFlowBody.render()}
 else{el.innerHTML='<h1>設定</h1><section class="card"><h2>種目</h2>'+data.exercises.map(x=>'<div class="row item"><span>'+esc(x.name)+'<br><small class="muted">休憩 '+fmt(x.rest)+'</small></span><button data-action="editid" data-id="'+esc(x.id)+'">編集</button></div>').join("")+'<p><button data-action="add">＋ 種目追加</button></p></section><section class="card"><h2>バックアップ</h2><p class="warning">端末内に記録を保存します。サイトデータの消去に備えてJSONバックアップを保管してください。</p><button data-action="export">JSONを書き出す</button><p><label>バックアップを復元<input id="import" type="file" accept=".json,application/json"></label></p></section>'+syncSettingsHtml()}
 tick();
}
function edit(id){const x=data.exercises.find(x=>x.id===id);const name=prompt("種目名",x?.name||"");if(name===null||!name.trim())return;const rest=prompt("休憩時間（秒）",String(x?.rest??90));if(rest===null)return;const n=Number(rest);if(!Number.isInteger(n)||n<0||n>3600){alert("0～3600秒で入力してください");return}if(x){x.name=name.trim();x.rest=n}else{const id=crypto.randomUUID();data.exercises.push({id,name:name.trim(),rest:n});data.selected=id}save();render()}
el.addEventListener("change",async e=>{if(e.target.id==="exercise"){data.selected=e.target.value;save();render()}if(e.target.id==="history-date"){if(/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)){historyDate=e.target.value;render()}}if(e.target.id==="import"&&e.target.files[0]){try{const d=JSON.parse(await e.target.files[0].text());if(!Array.isArray(d.exercises)||!Array.isArray(d.records)||d.records.length>100000||d.exercises.length>1000||!d.exercises.every(x=>typeof x.id==="string"&&typeof x.name==="string"&&Number.isFinite(x.rest))||!d.records.every(x=>Number.isFinite(x.weight)&&Number.isFinite(x.reps)&&typeof x.at==="string"))throw Error("データ形式が不正");if(!confirm("現在のデータを上書きしますか？"))return;data={exercises:d.exercises,records:d.records,selected:d.selected,timer:null,deletedRecordIds:Array.isArray(d.deletedRecordIds)?d.deletedRecordIds:[],bodyMeasurements:Array.isArray(d.bodyMeasurements)?d.bodyMeasurements:(data.bodyMeasurements||[]),deletedBodyIds:Array.isArray(d.deletedBodyIds)?d.deletedBodyIds:(data.deletedBodyIds||[])};save();render()}catch(err){alert("復元できません: "+err.message)}}});
el.addEventListener("click",e=>{const b=e.target.closest("[data-action]");if(!b)return;const a=b.dataset.action;if(b.dataset.bodyAction){if(window.SetFlowBody.handleClick(b))return}
if(a==="history-older"||a==="history-newer"||a==="history-latest"){
 const days=recordedDays();
 const selected=historyDate||days[0];
 const next=a==="history-latest"?days[0]:a==="history-older"?days.find(day=>day<selected):[...days].reverse().find(day=>day>selected);
 if(next){historyDate=next;render()}return;
}if(a==="add")edit();if(a==="edit")edit(ex()?.id);if(a==="editid")edit(b.dataset.id);if(a==="complete"){const x=ex(),wi=document.getElementById("weight"),ri=document.getElementById("reps");if(!x||!wi.value||!ri.value)return;const w=Number(wi.value),r=Number(ri.value);if(!Number.isFinite(w)||w<0||w>2000||!Number.isInteger(r)||r<1||r>500){alert("重量・回数を確認してください");return}b.disabled=true;data.records.push({id:crypto.randomUUID(),exerciseId:x.id,exerciseName:x.name,weight:w,reps:r,restSeconds:x.rest,at:new Date().toISOString()});data.timer=x.rest>0?{end:Date.now()+x.rest*1000}:null;notified=false;save();render();if(connected())syncToSheet().catch(console.warn)}if(a==="stop"){data.timer=null;save();render()}if(a==="more"||a==="less"){data.timer.end+=(a==="more"?15000:-15000);notified=false;save();tick()}if(a==="undo"){if(!confirm("このセットを取り消しますか？\n同期済みの場合、スプレッドシートの行は残ります。"))return;
 const target=data.records.find(x=>x.id===b.dataset.id);
 if(target){if(target.sheetSynced){if(!Array.isArray(data.deletedRecordIds))data.deletedRecordIds=[];if(!data.deletedRecordIds.includes(target.id))data.deletedRecordIds.push(target.id)}
 data.records=data.records.filter(x=>x.id!==target.id);save();render()}}if(a==="check-update"){checkAppUpdate()}if(a==="google-connect"){connectGoogle()}if(a==="google-sync"){if(!connected())connectGoogle();else syncToSheet().catch(err=>{syncError=err.message;updateSyncUI()})}if(a==="export"){const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});const u=URL.createObjectURL(blob),link=document.createElement("a");link.href=u;link.download="setflow-backup.json";link.click();setTimeout(()=>URL.revokeObjectURL(u),3000)}});
function tick(){if(!data.timer)return;const node=document.getElementById("clock");if(!node)return;const left=data.timer.end-Date.now();node.textContent=fmt(left/1000);if(left<=0&&!notified){notified=true;try{navigator.vibrate?.([150,100,150]);const A=window.AudioContext||window.webkitAudioContext;if(A){const ctx=new A(),o=ctx.createOscillator(),g=ctx.createGain();o.connect(g);g.connect(ctx.destination);o.frequency.value=880;g.gain.value=.07;o.start();o.stop(ctx.currentTime+.2);o.onended=()=>ctx.close()}}catch{}}}
document.querySelectorAll("[data-tab]").forEach(b=>b.onclick=()=>{tab=b.dataset.tab;render();if(tab==="body"&&connected())window.SetFlowBody.sync().catch(console.warn)});document.addEventListener("visibilitychange",()=>{if(!document.hidden){tick();updateSyncUI();trySync()}});window.addEventListener("online",trySync);
window.SetFlowBody.init({getData:()=>data,save,request:sheetRequest,connected,refresh:render,activeTab:()=>tab,triggerSync:()=>syncToSheet().catch(console.warn)});
setInterval(tick,250);setInterval(updateSyncUI,30000);render();
if(getClientId())loadGIS().catch(()=>{});
if("serviceWorker"in navigator)navigator.serviceWorker.register("./sw.js").catch(()=>{});

function syncSummary(){
 const n=unsynced();
 if(syncing)return "同期中…（未同期 "+n+" 件）";
 if(syncError)return "同期エラー："+syncError+(n?"（未同期 "+n+" 件）":"");
 if(!connected())return n?"Google再接続が必要（未同期 "+n+" 件）":"Google未接続";
 return n?"未同期 "+n+" 件":"Googleに同期済み"+(restoredThisSession?"・履歴 "+restoredThisSession+" 件を復元":"");
}
function updateSyncUI(){
 const status=document.getElementById("sync-status");if(status)status.textContent=syncSummary();
}
function syncSettingsHtml(){
 return '<section class="card"><h2>Googleスプレッドシート</h2>'+
 '<p class="muted">同期先: <a href="https://docs.google.com/spreadsheets/d/'+SHEET_ID+'/edit" target="_blank" rel="noopener" style="color:#a8bdff">SetFlow 筋トレ記録</a></p>'+
 '<label>Google Cloud OAuthクライアントID<input id="google-client-id" type="text" autocomplete="off" value="'+esc(getClientId())+'" placeholder="1234-abc.apps.googleusercontent.com"></label>'+
 '<p class="muted" id="sync-status">'+esc(syncSummary())+'</p>'+
 '<div class="actions"><button data-action="google-connect">Googleで接続 / 再接続</button><button data-action="google-sync">記録を同期（送受信）</button></div>'+
 '<p class="warning">筋トレ履歴と体組成の測定履歴を、それぞれのGoogleスプレッドシートと同期します。期限切れ時は再接続してください。</p></section>'+
 '<section class="app-update"><button type="button" data-action="check-update">アプリの更新を確認</button><p class="muted" id="app-version">Version '+APP_VERSION+'</p></section>';
}
function loadGIS(){
 if(window.google?.accounts?.oauth2)return Promise.resolve();
 if(gisLoadPromise)return gisLoadPromise;
 gisLoadPromise=new Promise((resolve,reject)=>{
  const script=document.createElement("script");script.src="https://accounts.google.com/gsi/client";script.async=true;
  script.onload=resolve;script.onerror=()=>{script.remove();gisLoadPromise=null;reject(Error("Google認証の読み込みに失敗しました"))};
  document.head.appendChild(script);
 });
 return gisLoadPromise;
}
function connectGoogle(){
 const clientId=(document.getElementById("google-client-id")?.value||getClientId()).trim();
 if(!/^[0-9]+-[a-zA-Z0-9_-]+[.]apps[.]googleusercontent[.]com$/.test(clientId)){
  alert("初回のみ「設定」でOAuthクライアントIDを入力してください");return;
 }
 localStorage.setItem("setflow-google-client-id",clientId);
 if(!window.google?.accounts?.oauth2){
  syncError="認証準備中です。もう一度「再接続」を押してください";
  updateSyncUI();loadGIS().catch(e=>{syncError=e.message;updateSyncUI()});return;
 }
 try{
  const client=window.google.accounts.oauth2.initTokenClient({
   client_id:clientId,scope:"https://www.googleapis.com/auth/spreadsheets",
   callback:response=>{
    if(!response.access_token){syncError="Google認証に失敗しました";updateSyncUI();return}
    googleToken=response.access_token;tokenExpiry=Date.now()+1000*(Number(response.expires_in)||3600);
    syncError="";updateSyncUI();trySync(true);
   }
  });
  // 以前の同意が有効な場合は、毎回同意画面を出さない。
  // リクエスト自体は「再接続」を押した時だけ発生する。
  client.requestAccessToken({prompt:""});
 }catch(e){syncError=e.message||"認証を開始できませんでした";updateSyncUI()}
}
function trySync(force=false){
 if(!connected()||!navigator.onLine)return;
 // 端末からの送信がゼロでも、他端末の履歴を受信する。
 if(!force && unsynced()===0 && Date.now()-lastCloudCheck<60000)return;
 syncToSheet().catch(err=>{syncError=err.message;updateSyncUI()});
}
async function sheetRequest(path,opts={},spreadsheetId=SHEET_ID){
 const response=await fetch("https://sheets.googleapis.com/v4/spreadsheets/"+spreadsheetId+path,{
  ...opts,headers:{"Authorization":"Bearer "+googleToken,"Content-Type":"application/json"}
 });
 if(!response.ok){
  const body=await response.json().catch(()=>({}));
  if(response.status===401){googleToken="";tokenExpiry=0}
  throw Error(body.error?.message||"Google Sheets API: "+response.status);
 }
 return response.json();
}

function decodeCloudRecord(row){
 if(!Array.isArray(row)||row.length<6)return null;
 const [rawId,rawAt,rawExerciseId,rawName,rawWeight,rawReps,rawRest]=row;
 const id=String(rawId||"").trim();
 const at=String(rawAt||"").trim();
 const exerciseId=String(rawExerciseId||"").trim();
 const exerciseName=String(rawName||"").trim();
 const weight=Number(rawWeight),reps=Number(rawReps);
 const rest=rawRest===""||rawRest==null?90:Number(rawRest);
 if(!id||!exerciseId||!exerciseName||!Number.isFinite(Date.parse(at))||
    !Number.isFinite(weight)||weight<0||weight>2000||
    !Number.isInteger(reps)||reps<1||reps>500||
    !Number.isInteger(rest)||rest<0||rest>3600)return null;
 return {id,at,exerciseId,exerciseName,weight,reps,restSeconds:rest,sheetSynced:true};
}
function mergeCloudRecords(rows){
 // 削除済みIDは再同期時に復活させない。既存の端末記録は上書きしない。
 const deleted=new Set(Array.isArray(data.deletedRecordIds)?data.deletedRecordIds:[]);
 const localById=new Map(data.records.map(r=>[r.id,r]));
 let imported=0,acknowledged=0,skipped=0;
 for(const row of rows){
  if(!Array.isArray(row)||row.every(cell=>cell==null||cell===""))continue;
  const record=decodeCloudRecord(row);
  if(!record){skipped++;continue}
  if(deleted.has(record.id))continue;
  if(localById.has(record.id)){
   const local=localById.get(record.id);
   if(!local.sheetSynced){local.sheetSynced=true;acknowledged++}
   continue;
  }
  data.records.push(record);localById.set(record.id,record);imported++;
  if(!data.exercises.some(ex=>ex.id===record.exerciseId)){
   data.exercises.push({id:record.exerciseId,name:record.exerciseName,rest:record.restSeconds});
  }
 }
 if(imported){data.records.sort((a,b)=>Date.parse(a.at)-Date.parse(b.at));restoredThisSession+=imported}
 // 入力途中の重量や回数を消さないようにトレーニング画面は再描画しない。
 if(imported&&tab==="history")render();
 return {imported,acknowledged,skipped};
}
async function syncToSheet(){
 if(!connected())throw Error("Googleへの再接続が必要です");
 if(syncing){syncAgain=true;return}
 syncing=true;syncError="";updateSyncUI();
 try{
  // 一度の読み込みでGoogleにある全セットを取得（受信・送信双方で使用）。
  const response=await sheetRequest("/values/%27%E8%A8%98%E9%8C%B2%27!A2:H?valueRenderOption=UNFORMATTED_VALUE");
  const rows=Array.isArray(response.values)?response.values:[];
  const received=mergeCloudRecords(rows);
  // ローカル保存に失敗したら、同期成功として扱わない。
  if(!save())throw Error("端末内への履歴保存に失敗しました");
  const existing=new Set(rows.map(row=>String(row?.[0]||"").trim()).filter(Boolean));
  const deleted=new Set(data.deletedRecordIds||[]);
  const pending=data.records.filter(r=>!existing.has(r.id)&&!deleted.has(r.id));
  if(pending.length){
   const values=pending.map(r=>[r.id,r.at,r.exerciseId,r.exerciseName,r.weight,r.reps,
    r.restSeconds??data.exercises.find(ex=>ex.id===r.exerciseId)?.rest??"",new Date().toISOString()]);
   await sheetRequest("/values/%27%E8%A8%98%E9%8C%B2%27!A:H:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS",
    {method:"POST",body:JSON.stringify({values})});
   for(const r of pending)r.sheetSynced=true;
  }
  if(!save())throw Error("端末内の同期状態を保存できませんでした");
  lastCloudCheck=Date.now();
  try{await window.SetFlowBody.sync()}catch(error){console.warn("Body composition sync failed:",error)}
  if(received.skipped)syncError="形式不正の記録 "+received.skipped+" 件を読み飛ばしました";
 }catch(e){syncError=e.message;throw e}
 finally{
  syncing=false;updateSyncUI();
  if(syncAgain){syncAgain=false;trySync(true)}
 }
}

async function checkAppUpdate(){
 if(!navigator.onLine){alert("インターネット接続後に再試行してください");return}
 const button=document.querySelector('[data-action="check-update"]');
 if(button){button.disabled=true;button.textContent="更新を確認中…"}
 try{
  // 毎回一意のURLで取得。以前のキャッシュ優先Service Workerにも対応。
  const url="./build.json?check="+Date.now();
  const response=await fetch(url,{cache:"no-store"});
  if(!response.ok)throw Error("最新版の確認に失敗しました（HTTP "+response.status+"）");
  const latest=await response.json();
  if(!latest.version||typeof latest.version!=="string")throw Error("更新情報を取得できませんでした");
  if(latest.version===APP_VERSION){alert("現在、最新版（"+APP_VERSION+"）です");return}
  if(!confirm("新しいバージョン "+latest.version+" に更新しますか？"))return;
  try{
   const registration=await navigator.serviceWorker?.getRegistration();
   await registration?.update();
  }catch(e){console.warn("Service Worker更新の確認に失敗:",e)}
  // ローカルデータを消さず、HTMLとJS/CSSの新しい版を取得する。
  const newUrl=new URL("./",window.location.href);
  newUrl.searchParams.set("app-update",String(Date.now()));
  window.location.replace(newUrl.href);
 }catch(e){alert(e.message||"更新の確認に失敗しました")}
 finally{if(button){button.disabled=false;button.textContent="アプリの更新を確認"}}
}
