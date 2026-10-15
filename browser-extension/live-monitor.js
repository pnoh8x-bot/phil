/* Read-only draft observation: only view tabs and scroll positions may change.
 * No player, queue, Draft, Autodraft or account controls are touched. */
(function(root){
 const clean=s=>(s||'').trim().replace(/\s+/g,' ');
 function tab(doc,label){
  const candidates=Array.from(doc.querySelectorAll('[role="tab"],button,a,li,div,span'));
  const visible=candidates.filter(e=>clean(e.textContent)===label&&e.getClientRects().length&&e.getAttribute('aria-disabled')!=='true'&&!e.disabled);
  // Yahoo also renders its navigation as plain div/span click targets.
  // Prefer the innermost visible label: its click bubbles to the real handler.
  return visible.find(e=>!visible.some(other=>other!==e&&e.contains?.(other)))||visible[0];
 }
 function selected(doc){
  const marked=['Players','Board','Results','Standings'].find(name=>{const e=tab(doc,name);return e&&(e.getAttribute('aria-selected')==='true'||/(^|[-_\s])(selected|active)($|[-_\s])/i.test(e.className+' '+(e.parentElement?.className||'')));});
  if(marked)return marked;
  if(resultsTable(doc))return 'Results';
  const heads=Array.from(doc.querySelectorAll('table thead')).map(e=>clean(e.textContent));
  if(heads.some(s=>/^Rank Team/.test(s)))return 'Standings';
  // Some draft tables call the name column "Name" rather than "Player".
  if(heads.some(s=>/PTS/.test(s)&&/FG%/.test(s))&&doc.querySelector('.ys-player[data-id]'))return 'Players';
 }
 function resultsTable(doc){return Array.from(doc.querySelectorAll('table')).find(t=>Array.from(t.querySelectorAll('thead tr')).at(-1)?.textContent.replace(/\s+/g,'').trim()==='PickPlayerTeam');}
 async function observe({doc,url,capture,idle,delay=ms=>new Promise(r=>setTimeout(r,ms))}){
  const original=selected(doc),subOriginal=original==='Results'?['Teams','Round by Round','Positions Drafted Grid'].find(name=>{const e=tab(doc,name);return e&&(e.getAttribute('aria-selected')==='true'||/(^|[-_\s])(selected|active)($|[-_\s])/i.test(e.className));}):null;
  if(!original)return {status:'unrecognized_view',reason:'Yahoo 현재 탭을 인식하지 못했습니다. 결과 화면 자동 전환이 보류됩니다.'};
  if(idle()<2500)return {status:'waiting',reason:'사용자 입력 중 · 마지막 입력 후 2.5초 동안 화면 전환을 기다립니다.'};
  const scrolls=[];let changed=false;
  try{
   if(original!=='Results'){const e=tab(doc,'Results');if(!e)return {status:'error',reason:'Results 탭을 찾지 못했습니다.'};e.click();changed=true;await delay(350);}
   if(idle()<2500)return {status:'waiting',reason:'사용자 조작 감지'};
   const round=tab(doc,'Round by Round');
   if(round){round.click();await delay(350);}
   let table=resultsTable(doc);
   if(!table){await delay(700);table=resultsTable(doc);}
   if(!table)return {status:'error',reason:'Yahoo 결과 표를 찾지 못했습니다.'};
   // Virtualized results are merged by pick number; only contiguous histories pass.
   let scroller=table.parentElement;
   while(scroller&&!(scroller.scrollHeight>scroller.clientHeight+20&&/auto|scroll/.test(getComputedStyle(scroller).overflowY)))scroller=scroller.parentElement;
   await capture();
   if(scroller){
    scrolls.push([scroller,scroller.scrollTop]);scroller.scrollTop=0;await delay(120);await capture();
    for(let step=0;step<25&&scroller.scrollTop+scroller.clientHeight<scroller.scrollHeight-5;step++){
     if(idle()<2500)break;
     const before=scroller.scrollTop;scroller.scrollTop+=Math.max(100,scroller.clientHeight-60);await delay(100);await capture();
     if(scroller.scrollTop===before)break;
    }
   }
   return {status:'observing',at:new Date().toISOString()};
  }finally{
   for(const [e,top] of scrolls)e.scrollTop=top;
   // Restore only if the user did not choose another tab during observation.
   if(changed&&selected(doc)==='Results'&&idle()>=2500)tab(doc,original)?.click();
   else if(subOriginal&&subOriginal!=='Round by Round'&&selected(doc)==='Results'&&idle()>=2500)tab(doc,subOriginal)?.click();
  }
 }
 root.NBALiveMonitor={tab,selected,resultsTable,observe};if(typeof module!=='undefined')module.exports=root.NBALiveMonitor;
})(globalThis);
