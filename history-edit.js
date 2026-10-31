"use strict";
window.SetFlowHistory=(()=>{
 let api=null,editingId=null,lastDeleted=null;
 const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const pad=x=>String(x).padStart(2,"0");
 const dayOf=at=>{const d=new Date(at);return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate())};
 const timeOf=at=>{const d=new Date(at);return pad(d.getHours())+":"+pad(d.getMinutes())};
 const db=()=>api.data();
 const confirmText=r=>r.exerciseName+" / "+r.weight+" kg × "+r.reps+" 回";
 const editor=r=>{
  const options=db().exercises.map(x=>'<option value="'+esc(x.id)+'" '+(x.id===r.exerciseId?"selected":"")+'>'+esc(x.name)+'</option>').join("");
  return '<section class="history-edit-panel"><div class="history-edit-fields">'+
   '<label>重量 (kg)<input id="history-edit-weight" type="number" min="0" max="2000" step="0.5" inputmode="decimal" value="'+esc(r.weight)+'"></label>'+
   '<label>回数<input id="history-edit-reps" type="number" min="1" max="500" step="1" inputmode="numeric" value="'+esc(r.reps)+'"></label></div>'+
   '<details><summary>種目・日時も修正</summary><label>種目<select id="history-edit-exercise">'+options+'</select></label>'+
   '<div class="history-edit-fields"><label>日付<input id="history-edit-day" type="date" value="'+dayOf(r.at)+'"></label>'+
   '<label>時刻<input id="history-edit-time" type="time" value="'+timeOf(r.at)+'"></label></div></details>'+
   '<div class="history-edit-actions"><button type="button" data-history-action="save" class="history-save">保存</button>'+
   '<button type="button" data-history-action="cancel">閉じる</button>'+
   '<button type="button" data-history-action="delete" class="history-delete">削除…</button></div></section>';
 };
 const renderSet=(r,i)=>'<div class="history-set"><span class="history-set-index">'+(i+1)+'</span>'+
  '<span class="history-set-detail"><strong>'+esc(r.weight)+' kg</strong><span class="history-set-multiply">×</span>'+esc(r.reps)+' 回</span>'+
  '<button type="button" class="history-set-edit" data-history-action="edit" data-id="'+esc(r.id)+'">編集</button></div>'+
  (editingId===r.id?editor(r):"");
 const renderBanner=()=>lastDeleted?'<div class="history-undo-note">セットを削除しました <button type="button" data-history-action="restore" data-id="'+esc(lastDeleted)+'">元に戻す</button></div>':"";
 const renderTrash=()=>{
  const items=db().records.filter(r=>r.deletedAt).sort((a,b)=>String(b.deletedAt).localeCompare(String(a.deletedAt)));
  if(!items.length)return "";
  return '<section class="card history-trash"><details><summary>削除した筋トレ記録 ('+items.length+'件)・復元できます</summary>'+
   items.map(r=>'<div class="history-trash-row"><span>'+esc(confirmText(r))+'<small>'+esc(dayOf(r.at))+'</small></span>'+
   '<button type="button" data-history-action="restore" data-id="'+esc(r.id)+'">復元</button></div>').join("")+'</details></section>';
 };
 function handle(button){
  const action=button.dataset.historyAction,id=button.dataset.id;
  if(!action)return false;
  if(action==="edit"){editingId=id;api.setTab("history");api.setDate(dayOf(db().records.find(r=>r.id===id).at));api.refresh();return true}
  if(action==="cancel"){editingId=null;api.refresh();return true}
  if(action==="restore"){
   const r=db().records.find(x=>x.id===id&&x.deletedAt);
   if(!r)return true;
   r.deletedAt=null;r.dirty=true;
   db().deletedRecordIds=(db().deletedRecordIds||[]).filter(x=>x!==id);
   lastDeleted=null;api.setDate(dayOf(r.at));
   if(api.save()){api.refresh();if(api.connected())api.sync()}return true;
  }
  const r=db().records.find(x=>x.id===editingId&&!x.deletedAt);
  if(!r)return true;
  if(action==="delete"){
   if(!confirm("このセットを削除しますか？\n"+confirmText(r)+"\n削除しても設定画面から復元できます。"))return true;
   r.deletedAt=new Date().toISOString();r.dirty=true;lastDeleted=r.id;editingId=null;
   if(api.save()){api.refresh();if(api.connected())api.sync()}return true;
  }
  if(action==="save"){
   const wInput=document.getElementById("history-edit-weight"),nInput=document.getElementById("history-edit-reps");
   const w=Number(wInput?.value),n=Number(nInput?.value);
   if(!wInput?.value||!nInput?.value||!Number.isFinite(w)||w<0||w>2000||!Number.isInteger(n)||n<1||n>500){alert("重量・回数を確認してください");return true}
   const exerciseId=document.getElementById("history-edit-exercise")?.value||r.exerciseId;
   const exercise=db().exercises.find(x=>x.id===exerciseId);
   if(!exercise){alert("種目を確認してください");return true}
   const day=document.getElementById("history-edit-day")?.value||dayOf(r.at),time=document.getElementById("history-edit-time")?.value||timeOf(r.at);
   const localDate=new Date(day+"T"+time+":00");
   if(!Number.isFinite(localDate.getTime())||dayOf(localDate.toISOString())!==day){alert("日付・時刻を確認してください");return true}
   const at=(day===dayOf(r.at)&&time===timeOf(r.at))?r.at:localDate.toISOString();
   Object.assign(r,{weight:w,reps:n,exerciseId,exerciseName:exercise.name,at,dirty:true});
   editingId=null;api.setDate(dayOf(at));
   if(api.save()){api.refresh();if(api.connected())api.sync()}return true;
  }
  return true;
 }
 const init=deps=>{api=deps};
 return {init,renderSet,renderBanner,renderTrash,handle};
})();
