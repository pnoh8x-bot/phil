(async()=>{
 let running=false,monitorStatus;
 async function capture(){
  if(running)return;running=true;
  try{
   const {nbaConfig}=await chrome.storage.local.get('nbaConfig');if(!nbaConfig?.enabled)return;
   const observation=NBAParser.parse(document,location.href);if(!observation)return;
   if(monitorStatus)observation.monitor=monitorStatus;
   const result=await chrome.runtime.sendMessage({type:'NBA_CAPTURE',observation});
   if(result&&!result.ok)console.warn('NBA Helper:',result.error);
  }catch(e){console.warn('NBA Helper sync:',e.message);}finally{running=false;}
 }
 let timer;new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(capture,500)}).observe(document.body,{childList:true,subtree:true,characterData:true});
 let activity=0,monitorBusy=false,pressed=false;
 for(const name of ['pointerdown','keydown','wheel','touchstart'])document.addEventListener(name,e=>{if(e.isTrusted){activity=Date.now();if(name==='pointerdown')pressed=true;}},{capture:true,passive:true});
 document.addEventListener('pointerup',()=>{pressed=false;},{capture:true,passive:true});
 setInterval(async()=>{
  if(monitorBusy||!/^\/draftclient\/nba\/\d+\/\d+\/?$/.test(location.pathname))return;
  const {nbaConfig:c}=await chrome.storage.local.get('nbaConfig');
  if(!c?.enabled||c.auto_results===false||location.pathname.split('/')[3]!==String(c.draft_room_id||c.league_id))return;
  monitorBusy=true;
  try{monitorStatus=await NBALiveMonitor.observe({doc:document,url:location.href,capture,idle:()=>pressed?0:Date.now()-activity});}
  catch(e){console.warn('NBA 자동 결과 관찰:',e.message);}finally{monitorBusy=false;}
 },8000);
 setInterval(capture,5000);capture();
 setInterval(async()=>{const {nbaConfig}=await chrome.storage.local.get('nbaConfig');if(nbaConfig?.enabled&&location.pathname.endsWith('/draftresults')&&!location.search.includes('previous')&&!document.querySelector('.yfa-draft-scheduled'))location.reload();},15000);
})();
