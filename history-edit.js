"use strict";
window.SetFlowHistory=(()=>{
 let api=null,editing=false,drafts=new Map(),activeDate=null,lastDeleted=null,changed=false;
 const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const pad=x=>String(x).padStart(2,"0");
 const dayOf=at=>{const d=new Date(at);return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate())};
 const timeOf=at=>{const d=new Date(at);return pad(d.getHours())+":"+pad(d.getMinutes())};
 const db=()=>api.data();
 const padAt=(day,time)=>{const d=new Date(day+"T"+time+":00");return Number.isFinite(d.getTime())&&dayOf(d)===day&&timeOf(d)===time?d.toISOString():null};
 const makeDraft=(r,isNew=false)=>({id:r.id,exerciseId:r.exerciseId,weight:String(r.weight),reps:String(r.reps),day:dayOf(r.at),time:timeOf(r.at),at:r.at,isNew,remove:false,restSeconds:r.restSeconds??90});
 function begin(){
  if(editing)return;
  editing=true;changed=false;activeDate=api.getDate();
  drafts=new Map(db().records.filter(r=>!r.deletedAt&&dayOf(r.at)===activeDate).map(r=>[r.id,makeDraft(r)]));
  api.refresh();
 }
 function currentRows(realRows){return editing?[...drafts.values()]:realRows}
 function isEditing(){return editing}
 function renderBanner(){return lastDeleted?'<div class="history-undo-note">セットを削除しました <button type="button" data-history-action="restore" data-id="'+esc(lastDeleted)+'">元に戻す</button></div>':""}
 function toolbar(exercises,sets,isOlder){
  const summary=exercises+'種目 · '+sets+'セット';
  if(editing){
   return '<div class="history-mode-toolbar history-mode-edit"><span class="muted">編集中 · '+summary+'</span>'+
    '<div class="history-mode-buttons"><button type="button" data-history-action="cancel">取消</button>'+
    '<button type="button" class="history-commit" data-history-action="commit">保存して終了</button></div></div>';
  }
  return renderBanner()+'<div class="history-mode-toolbar"><span class="muted">'+summary+'</span><div class="history-mode-buttons">'+
   (isOlder?'<button class="history-latest" data-action="history-latest">最新の日付へ</button>':"")+
   '<button class="history-start" data-history-action="begin">編集</button></div></div>';
 }
 function renderSet(r,index){
  if(!editing)return '<div class="history-set"><span class="history-set-index">'+(index+1)+'</span>'+
   '<span class="history-set-detail"><strong>'+esc(r.weight)+' kg</strong><span class="history-set-multiply">×</span>'+esc(r.reps)+' 回</span></div>';
  if(r.remove)return '<div class="history-edit-deleted"><span>'+ (index+1)+' · 削除予定</span><button type="button" data-history-action="undodelete" data-id="'+esc(r.id)+'">元に戻す</button></div>';
  const attrs='data-id="'+esc(r.id)+'"';
  const exercise=db().exercises.find(x=>x.id===r.exerciseId);
  const options=db().exercises.map(x=>'<option value="'+esc(x.id)+'" '+(x.id===r.exerciseId?"selected":"")+'>'+esc(x.name)+'</option>').join("");
  const a='<label class="history-number-field"><input '+attrs+' data-history-field="weight" aria-label="重量" type="number" inputmode="decimal" min="0" max="2000" step="0.5" value="'+esc(r.weight)+'"><span>kg</span></label>';
  const b='<label class="history-number-field"><input '+attrs+' data-history-field="reps" aria-label="回数" type="number" inputmode="numeric" min="1" max="500" step="1" value="'+esc(r.reps)+'"><span>回</span></label>';
  return '<div class="history-edit-row"><span class="history-edit-index">'+(index+1)+'</span>'+a+'<span class="history-times">×</span>'+b+
   '<button class="history-trash-button" type="button" data-history-action="delete" '+attrs+' aria-label="このセットを削除"><svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 3h4l1 3H9l1-3Zm-4 4 1 14h10l1-14M10 11v6M14 11v6"/></svg></button></div>'+
   '<details class="history-row-more"><summary>種目・日時</summary><label>種目<select '+attrs+' data-history-field="exerciseId">'+options+'</select></label>'+
   '<div class="history-edit-more-grid">'+compactDate('day',r,attrs)+compactDate('time',r,attrs)+'</div></details>';
 }
 function compactDate(kind,r,attrs){
  const val=kind==="day"?r.day:r.time,label=kind==="day"?"日付":"時刻";
  return '<label>'+label+'<span class="history-native-control"><span class="history-native-display" data-history-display="'+kind+'" '+attrs+'>'+esc(kind==="day"?val.replace(/-/g,"/"):val)+'</span>'+
   '<input '+attrs+' data-history-field="'+kind+'" type="'+(kind==="day"?"date":"time")+'" value="'+esc(val)+'"></span></label>';
 }
 function addRow(groupId){
  return editing?'<button type="button" class="history-add-set" data-history-action="add" data-exercise-id="'+esc(groupId)+'">＋ セット追加</button>':"";
 }
 function addExercise(){
  if(!editing)return "";
  return '<div class="history-add-exercise"><label>別の種目を追加<select id="history-add-exercise">'+db().exercises.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.name)+'</option>').join("")+'</select></label>'+
   '<button type="button" data-history-action="add-selected">＋ 追加</button></div>';
 }
 function handleField(input){
  const field=input?.dataset?.historyField,id=input?.dataset?.id;
  if(!editing||!field||!drafts.has(id))return false;
  const r=drafts.get(id);r[field]=input.value;changed=true;
  if(field==="day"||field==="time"){
   const display=document.querySelector('[data-history-display="'+field+'"][data-id="'+CSS.escape(id)+'"]');
   if(display)display.textContent=field==="day"?input.value.replace(/-/g,"/"):input.value;
  }
  return true;
 }
 function add(exerciseId){
  if(!editing)return;
  const exercise=db().exercises.find(x=>x.id===exerciseId);
  if(!exercise)return;
  const inGroup=[...drafts.values()].filter(r=>r.exerciseId===exerciseId&&!r.remove);
  const previous=inGroup[inGroup.length-1]||[...db().records].reverse().find(r=>r.exerciseId===exerciseId&&!r.deletedAt);
  const time=previous&&dayOf(previous.at)===activeDate?timeOf(previous.at):"12:00";
  const at=padAt(activeDate,time)||new Date().toISOString();
  const id=crypto.randomUUID();
  const draft=makeDraft({id,exerciseId,weight:previous?.weight??0,reps:previous?.reps??10,at,restSeconds:exercise.rest},true);
  draft.day=activeDate;draft.time=time;
  drafts.set(id,draft);changed=true;api.refresh();
 }
 function commit(){
  if(!editing)return;
  const result=[];
  for(const r of drafts.values()){
   if(r.remove)continue;
   const w=Number(r.weight),reps=Number(r.reps);
   if(r.weight===""||!Number.isFinite(w)||w<0||w>2000||r.reps===""||!Number.isInteger(reps)||reps<1||reps>500){alert("セットの重量・回数を確認してください");return}
   const exercise=db().exercises.find(x=>x.id===r.exerciseId);
   if(!exercise){alert("種目を選択してください");return}
   const at=(r.day===dayOf(r.at)&&r.time===timeOf(r.at))?r.at:padAt(r.day,r.time);
   if(!at){alert("日付と時刻を確認してください");return}
   result.push({...r,weight:w,reps,at,exerciseName:exercise.name,restSeconds:exercise.rest});
  }
  // Commit all edits together. Never write a partial batch if validation fails.
  const original=db().records;
  const next=original.map(r=>({...r}));
  const byId=new Map(next.map(r=>[r.id,r]));
  const changedAt=Date.now();let deleteCount=0,hasMutations=false;
  for(const r of drafts.values()){
   const stored=byId.get(r.id);
   if(r.remove){
    if(stored&&!stored.deletedAt){stored.deletedAt=new Date(changedAt).toISOString();stored.dirty=true;stored.localEditAt=changedAt;deleteCount++;hasMutations=true;lastDeleted=stored.id}
    continue;
   }
   const updated=result.find(x=>x.id===r.id);
   if(!updated)continue;
   if(stored){
    const fields=["weight","reps","at","exerciseId","exerciseName"];
    if(fields.some(key=>stored[key]!==updated[key])){
     Object.assign(stored,{weight:updated.weight,reps:updated.reps,at:updated.at,exerciseId:updated.exerciseId,exerciseName:updated.exerciseName,dirty:true,localEditAt:changedAt});
     hasMutations=true;
    }
   }else{
    next.push({id:updated.id,at:updated.at,exerciseId:updated.exerciseId,exerciseName:updated.exerciseName,weight:updated.weight,reps:updated.reps,restSeconds:updated.restSeconds,dirty:true,localEditAt:changedAt,sheetSynced:false});
    hasMutations=true;
   }
  }
  next.sort((a,b)=>Date.parse(a.at)-Date.parse(b.at));
  db().records=next;
  if(!api.save()){db().records=original;alert("保存できませんでした。変更は確定していません");return}
  editing=false;changed=false;drafts.clear();api.refresh();
  if(hasMutations&&api.connected())api.sync();
 }
 function restore(id){
  const r=db().records.find(x=>x.id===id&&x.deletedAt);if(!r)return;
  r.deletedAt=null;r.dirty=true;r.localEditAt=Date.now();lastDeleted=null;
  db().deletedRecordIds=(db().deletedRecordIds||[]).filter(x=>x!==id);
  api.setDate(dayOf(r.at));if(api.save()){api.refresh();if(api.connected())api.sync()}
 }
 function renderTrash(){
  const deleted=db().records.filter(r=>r.deletedAt).sort((a,b)=>String(b.deletedAt).localeCompare(String(a.deletedAt)));
  if(!deleted.length)return "";
  return '<section class="card history-trash"><details><summary>削除した筋トレ記録 ('+deleted.length+'件)・復元できます</summary>'+
   deleted.map(r=>'<div class="history-trash-row"><span>'+esc(r.exerciseName)+' · '+esc(r.weight)+' kg × '+esc(r.reps)+' 回<small>'+dayOf(r.at)+'</small></span>'+
   '<button type="button" data-history-action="restore" data-id="'+esc(r.id)+'">復元</button></div>').join("")+'</details></section>';
 }
 function handle(button){
  const action=button.dataset.historyAction;
  if(!action)return false;
  if(action==="begin"){begin();return true}
  if(action==="cancel"){if(changed&&!confirm("編集内容を保存せずに終了しますか？"))return true;editing=false;changed=false;drafts.clear();api.refresh();return true}
  if(action==="commit"){commit();return true}
  if(action==="add"){add(button.dataset.exerciseId);return true}
  if(action==="add-selected"){add(document.getElementById("history-add-exercise")?.value);return true}
  if(action==="delete"){
   if(!editing)return true;
   const r=drafts.get(button.dataset.id);if(!r||r.remove)return true;
   const ex=db().exercises.find(x=>x.id===r.exerciseId);
   if(!confirm("このセットを削除予定にしますか？\n"+(ex?.name||"種目")+" / "+r.weight+" kg × "+r.reps+" 回\n「保存して終了」まで確定されません。"))return true;
   r.remove=true;changed=true;api.refresh();return true;
  }
  if(action==="undodelete"){const r=drafts.get(button.dataset.id);if(r){r.remove=false;changed=true;api.refresh()}return true}
  if(action==="restore"){restore(button.dataset.id);return true}
  if(action==="edit"){
   if(!editing)begin();
   api.setTab("history");
   const r=db().records.find(x=>x.id===button.dataset.id);
   if(r){api.setDate(dayOf(r.at));if(activeDate!==api.getDate()){editing=false;begin()}api.refresh()}
   return true;
  }
  return false;
 }
 const init=deps=>{api=deps};
 return {init,isEditing,currentRows,toolbar,renderSet,addRow,addExercise,renderBanner,renderTrash,handle,handleField};
})();
