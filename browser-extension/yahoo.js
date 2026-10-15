(async()=>{
 let running=false;
 async function capture(){
  if(running)return;running=true;
  try{
   const {nbaConfig}=await chrome.storage.local.get('nbaConfig');if(!nbaConfig?.enabled)return;
   const observation=NBAParser.parse(document,location.href);
   if(!observation||observation.league_id!==nbaConfig.league_id||observation.historical||observation.season!==nbaConfig.season)return;
   const key=`nba:${nbaConfig.league_id}:${nbaConfig.season}`;
   const stored=(await chrome.storage.local.get(key))[key]||{version:1,league_id:nbaConfig.league_id,season:nbaConfig.season,picks:[],players:[],adp:[],settings:{},teams:[]};
   const merge=(old,rows)=>Object.values(Object.fromEntries([...old,...rows].map(p=>[p.YAHOO_ID,p])));
   if(observation.players.length){const source=observation.players[0].STAT_SOURCE;if(stored.stat_source && stored.stat_source!==source)stored.players=[];stored.stat_source=source;}
   stored.players=merge(stored.players,observation.players);stored.adp=merge(stored.adp,observation.adp);
   stored.settings={...stored.settings,...observation.settings};
   if(observation.teams.length)stored.teams=observation.teams;
   // Replace complete results snapshots, including undo/reset, never merge pick histories.
   if(location.pathname.endsWith('/draftresults')){stored.picks=observation.picks;stored.draft_teams=observation.draft_teams;stored.draft_status=observation.draft_status;stored.picks_at=observation.captured_at;}
   const adps=Object.fromEntries(stored.adp.map(p=>[p.YAHOO_ID,p]));
   stored.board=stored.players.filter(p=>adps[p.YAHOO_ID]).map(p=>({...p,...adps[p.YAHOO_ID],ADP_RANK:1}));
   stored.source_url=observation.source_url;stored.captured_at=observation.captured_at;
   await chrome.storage.local.set({[key]:stored});
  }finally{running=false;}
 }
 // Observe rendered changes; no Yahoo API requests are made.
 let timer;new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(capture,800)}).observe(document.body,{childList:true,subtree:true,characterData:true});
 setInterval(capture,5000);capture();
 // Results page is safe to reload; draft-room tabs are never reloaded or clicked.
 setInterval(async()=>{const {nbaConfig}=await chrome.storage.local.get('nbaConfig');if(nbaConfig?.enabled&&location.pathname.endsWith('/draftresults')&&!location.search.includes('previous')&&!document.querySelector('.yfa-draft-scheduled'))location.reload();},15000);
})();
