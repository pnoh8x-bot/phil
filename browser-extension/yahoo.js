(async()=>{
 let running=false;
 async function capture(){
  if(running)return;running=true;
  try{
   const {nbaConfig}=await chrome.storage.local.get('nbaConfig');if(!nbaConfig?.enabled)return;
   const observation=NBAParser.parse(document,location.href);if(!observation)return;
   const result=await chrome.runtime.sendMessage({type:'NBA_CAPTURE',observation});
   if(result&&!result.ok)console.warn('NBA Helper:',result.error);
  }catch(e){console.warn('NBA Helper sync:',e.message);}finally{running=false;}
 }
 let timer;new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(capture,500)}).observe(document.body,{childList:true,subtree:true,characterData:true});
 setInterval(capture,5000);capture();
 setInterval(async()=>{const {nbaConfig}=await chrome.storage.local.get('nbaConfig');if(nbaConfig?.enabled&&location.pathname.endsWith('/draftresults')&&!location.search.includes('previous')&&!document.querySelector('.yfa-draft-scheduled'))location.reload();},15000);
})();
