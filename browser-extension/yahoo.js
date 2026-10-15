(async()=>{
 let running=false;
 function monitorView(){
  if(!document.getElementById('nba-observer-banner')){
   const banner=document.createElement('div');banner.id='nba-observer-banner';banner.textContent='NBA Helper 관찰용 탭 · 이 탭을 열어두세요. 선수 지명은 원래 Yahoo 탭에서 진행합니다.';
   banner.style.cssText='position:fixed;bottom:0;left:0;z-index:2147483647;background:#14314e;color:white;padding:6px;font:13px sans-serif';document.body.appendChild(banner);
  }
  const tabs=Array.from(document.querySelectorAll('[role=tab]'));
  const results=tabs.find(e=>e.textContent.trim()==='Results');
  if(results&&results.getAttribute('aria-selected')!=='true'){results.click();return;}
  const rounds=tabs.find(e=>e.textContent.trim()==='Round by Round');
  if(rounds&&rounds.getAttribute('aria-selected')!=='true')rounds.click();
 }
 async function capture(){
  if(running)return;running=true;
  try{
   const {nbaConfig}=await chrome.storage.local.get('nbaConfig');if(!nbaConfig?.enabled)return;
   const observation=NBAParser.parse(document,location.href);if(!observation)return;
   const result=await chrome.runtime.sendMessage({type:'NBA_CAPTURE',observation});
   if(result?.ok&&result.monitor)monitorView();
   if(result&&!result.ok)console.warn('NBA Helper:',result.error);
  }catch(e){console.warn('NBA Helper sync:',e.message);}finally{running=false;}
 }
 let timer;new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(capture,500)}).observe(document.body,{childList:true,subtree:true,characterData:true});
 setInterval(capture,5000);capture();
 setInterval(async()=>{const {nbaConfig}=await chrome.storage.local.get('nbaConfig');if(nbaConfig?.enabled&&location.pathname.endsWith('/draftresults')&&!location.search.includes('previous')&&!document.querySelector('.yfa-draft-scheduled'))location.reload();},15000);
})();
