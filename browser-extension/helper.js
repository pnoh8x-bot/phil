(()=>{
 let args;
 async function publish(){
  if(!args)return;const {nbaConfig}=await chrome.storage.local.get('nbaConfig');
  if(!nbaConfig?.enabled||nbaConfig.league_id!==args.league_id||nbaConfig.season!==args.season)return;
  const key=`nba:${args.league_id}:${args.season}`,value=(await chrome.storage.local.get(key))[key];
  if(value)window.postMessage({type:'NBA_HELPER_SNAPSHOT',value},location.origin);
 }
 window.addEventListener('message',async e=>{
  if(e.source!==window||e.origin!==location.origin)return;
  if(e.data?.type==='NBA_HELPER_READY'){args={league_id:String(e.data.league_id),season:e.data.season};publish();}
  if(e.data?.type==='NBA_HELPER_CONNECT'&&/^\d+$/.test(String(e.data.league_id))){args={league_id:String(e.data.league_id),season:e.data.season};const {nbaConfig}=await chrome.storage.local.get('nbaConfig');await chrome.storage.local.set({nbaConfig:{...(nbaConfig?.league_id===args.league_id?nbaConfig:{}),...args,enabled:true}});publish();}
  if(e.data?.type==='NBA_HELPER_DISCONNECT'){await chrome.storage.local.set({nbaConfig:{enabled:false}});window.postMessage({type:'NBA_HELPER_DISCONNECTED'},location.origin);}
 });
 chrome.storage.onChanged.addListener(publish);
 window.postMessage({type:'NBA_HELPER_AVAILABLE'},location.origin);
})();
