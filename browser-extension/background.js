importScripts('state.js');
let queue=Promise.resolve();
let collectorStarting;
async function ensureCollector(c,force=false){
 if(!chrome.tabs||!c?.enabled||c.auto_collect===false)return;
 if(collectorStarting)return collectorStarting;
 collectorStarting=(async()=>{
  const scope=c.league_id+':'+c.season,{nbaCollector:old}=await chrome.storage.local.get('nbaCollector');
  const snapshot=(await chrome.storage.local.get('nba:'+scope))['nba:'+scope];
  if(!force&&snapshot?.collection?.status==='complete'&&snapshot?.adp_collection?.status==='complete'&&Date.now()-Date.parse(snapshot.collection.updated_at)<6*3600*1000)return;
  if(!force&&old?.scope===scope){try{await chrome.tabs.get(old.tab_id);return;}catch{}}
  const url=`https://basketball.fantasysports.yahoo.com/nba/${c.league_id}/players#nba-helper-collect`;
  const tab=await chrome.tabs.create({url,active:false});
  await chrome.storage.local.set({nbaCollector:{scope,tab_id:tab.id,started_at:new Date().toISOString()}});
 })().finally(()=>collectorStarting=null);
 return collectorStarting;
}
chrome.runtime.onMessage.addListener((m,sender,reply)=>{
 if(m.type==='NBA_COLLECTOR_HELLO'){
  chrome.storage.local.get(['nbaCollector','nbaConfig']).then(({nbaCollector:r,nbaConfig:c})=>reply({enabled:!!c?.enabled&&c.auto_collect!==false&&r?.tab_id===sender.tab?.id&&r.scope===c.league_id+':'+c.season}));return true;
 }
 if(m.type==='NBA_COLLECTOR_START'){
  chrome.storage.local.get('nbaConfig').then(({nbaConfig:c})=>ensureCollector(c,true)).then(()=>reply({ok:true}),e=>reply({ok:false,error:e.message}));return true;
 }
 if(m.type==='NBA_COLLECTOR_ERROR'){
  queue=queue.catch(()=>{}).then(async()=>{const {nbaConfig:c,nbaCollector:r}=await chrome.storage.local.get(['nbaConfig','nbaCollector']);if(r?.tab_id!==sender.tab?.id||!c)return;const key='nba:'+c.league_id+':'+c.season,s=(await chrome.storage.local.get(key))[key];if(s)await chrome.storage.local.set({[key]:{...s,collection:{...s.collection,status:'error',error:String(m.error).slice(0,300)}}});}).then(()=>reply({ok:true}));return true;
 }
 if(m.type!=='NBA_CAPTURE')return;
 queue=queue.catch(()=>{}).then(async()=>{
  const {nbaConfig:c}=await chrome.storage.local.get('nbaConfig');
  if(!c?.enabled)return {ok:false,error:'연결 꺼짐'};
  const o=m.observation;
  const key='nba:'+c.league_id+':'+c.season,old=(await chrome.storage.local.get(key))[key],value=NBAState.reduce(old,o,c);
  if(old?.picks?.length&&(old.room_id!==value.room_id||old.live!==value.live))await chrome.storage.local.set({[key+':archive:'+(old.room_id||'league-results')]:old});
  await chrome.storage.local.set({[key]:value,[key+':previous']:old||null});
  if(o.live)ensureCollector(c).catch(console.warn);
  return {ok:true,revision:value.revision};
 }).then(reply,e=>reply({ok:false,error:e.message}));
 return true;
});

