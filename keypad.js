"use strict";
window.SetFlowKeypad=(()=>{
 let root=null,active=null,kind=null,replaceNext=true,initialized=false;
 const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const isWeight=()=>kind==="weight";
 const config=k=>k==="weight"?{unit:"kg",title:"重量",deltas:[-5,-2.5,2.5,5],min:0,max:2000}:{unit:"回",title:"回数",deltas:[-5,-1,1,5],min:1,max:500};
 // Pure input logic, also reused by the tests.
 function compute(current,key,k,overwrite=false){
  const {min,max}=config(k);
  const old=String(current??"");
  if(key==="back"){return {value:old.slice(0,-1),overwrite:false}}
  if(key==="clear"){return {value:"",overwrite:true}}
  if(key==="dot"){
   if(k!=="weight")return {value:old,overwrite};
   if(overwrite||!old)return {value:"0.",overwrite:false};
   return {value:old.includes(".")?old:old+".",overwrite:false};
  }
  if(/^delta:-?\d+(?:\.\d+)?$/.test(key)){
   const delta=Number(key.slice(6));
   const next=Math.max(min,Math.min(max,Math.round(((Number(old)||0)+delta)*100)/100));
   return {value:String(next),overwrite:true};
  }
  if(!/^[0-9]$/.test(key))return {value:old,overwrite};
  let next=overwrite?key:old+key;
  if(!next.includes("."))next=String(Number(next));
  if(next.includes(".")&&next.split(".")[1].length>2)return {value:old,overwrite:false};
  const value=Number(next);
  if(!Number.isFinite(value)||value>max)return {value:old,overwrite:false};
  return {value:next,overwrite:false};
 }
 function ensureRoot(){
  if(root)return;
  root=document.createElement("div");
  root.id="setflow-keypad";
  root.className="setflow-keypad";
  root.hidden=true;
  document.body.appendChild(root);
 }
 function close(){
  if(active?.classList)active.classList.remove("keypad-current");
  active=null;kind=null;replaceNext=true;
  if(root)root.hidden=true;
  document.body.classList.remove("keypad-visible");
 }
 function otherInput(input){
  const otherKind=input?.dataset?.keypad==="weight"?"reps":"weight";
  if(input?.id==="weight"||input?.id==="reps"){
   const other=document.getElementById(otherKind);
   return other?.dataset?.keypad===otherKind?other:null;
  }
  return input?.closest?.(".history-edit-row")?.querySelector?.('input[data-keypad="'+otherKind+'"]')||null;
 }
 function open(input){
  if(!input||!input.dataset?.keypad)return;
  const selectedKind=input.dataset.keypad;
  if(selectedKind!=="weight"&&selectedKind!=="reps")return;
  if(active!==input)close();
  ensureRoot();
  active=input;kind=selectedKind;replaceNext=true;
  active.classList?.add("keypad-current");
  const c=config(selectedKind);
  const row=c.deltas.map(delta=>'<button type="button" class="kp-adjust" data-kp="delta:'+delta+'" aria-label="'+(delta>0?"+":"")+delta+c.unit+'">'+(delta>0?"+":"")+delta+'</button>').join("");
  const digits=["1","2","3","4","5","6","7","8","9","dot","0","back"].map(token=>{
   const label=token==="dot"?".":token==="back"?"⌫":token;
   return '<button type="button" data-kp="'+token+'" '+(token==="dot"&&!isWeight()?"disabled":"")+' aria-label="'+(token==="back"?"一文字削除":token==="dot"?"小数点":token)+'">'+label+'</button>';
  }).join("");
  const alternate=otherInput(active);
  root.innerHTML='<div class="kp-shell" role="dialog" aria-label="SetFlow 数字入力">'+
   '<div class="kp-header"><div><span class="kp-label">'+c.title+'</span><strong id="kp-value"></strong><small>'+c.unit+'</small></div>'+
   '<button type="button" class="kp-close" data-kp="close" aria-label="閉じる">×</button></div>'+
   '<div class="kp-adjustments">'+row+'</div>'+
   '<div class="kp-digits">'+digits+'</div>'+
   '<div class="kp-footer"><button type="button" data-kp="close" class="kp-done">完了</button>'+
   (alternate?'<button type="button" data-kp="switch" class="kp-record" aria-label="'+(isWeight()?"回数":"重量")+'の入力へ切り替え">'+(isWeight()?"回数へ →":"← 重量へ")+'</button>':"")+'</div></div>';
  root.hidden=false;document.body.classList.add("keypad-visible");
  refresh();
  // readOnly + inputmode=none suppress the native numeric keyboard on iPhone.
  input.blur?.();
  input.scrollIntoView?.({block:"nearest"});
 }
 function refresh(){if(root&&active){const v=root.querySelector("#kp-value");if(v)v.textContent=active.value||"—"}}
 function key(token){
  if(!active)return;
  if(token==="close"){close();return}
  if(token==="switch"){
   const other=otherInput(active);
   if(other)open(other);
   return;
  }
  const result=compute(active.value,token,kind,replaceNext);
  active.value=result.value;
  replaceNext=result.overwrite;
  if(active.dataset.historyField)window.SetFlowHistory?.handleField?.(active);
  refresh();
 }
 function captureClick(event){
  const target=event.target;
  const control=target.closest?.("[data-kp]");
  if(root?.contains(target)&&control){
   event.preventDefault();event.stopPropagation();
   key(control.dataset.kp);return;
  }
  const input=target.closest?.("input[data-keypad]");
  if(input){
   event.preventDefault();
   open(input);return;
  }
  if(active&&!root?.contains(target))close();
 }
 function keyboard(event){
  if(!active||event.metaKey||event.ctrlKey||event.altKey)return;
  const token=/^\d$/.test(event.key)?event.key:event.key==="Backspace"?"back":event.key==="."||event.key==="Decimal"?"dot":event.key==="Escape"||event.key==="Enter"?"close":null;
  if(!token)return;
  event.preventDefault();key(token);
 }
 function init(){
  if(initialized)return;
  initialized=true;ensureRoot();
  document.addEventListener("click",captureClick,true);
  document.addEventListener("keydown",keyboard,true);
 }
 return {init,close,isOpen:()=>!!active,compute,open,key};
})();