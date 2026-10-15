importScripts('state.js');
let queue=Promise.resolve();
chrome.runtime.onStartup.addListener(()=>chrome.storage.local.remove('nbaMonitor'));
chrome.tabs.onRemoved.addListener(async id=>{const {nbaMonitor}=await chrome.storage.local.get('nbaMonitor');if(nbaMonitor?.tab_id===id)await chrome.storage.local.remove('nbaMonitor');});
chrome.runtime.onMessage.addListener((m,sender,reply)=>{
 if(m.type!=='NBA_CAPTURE')return;
 queue=queue.catch(()=>{}).then(async()=>{
  const {nbaConfig:c,nbaMonitor}=await chrome.storage.local.get(['nbaConfig','nbaMonitor']);
  if(!c?.enabled)return {ok:false,error:'연결 꺼짐'};
  let monitor=nbaMonitor;const o=m.observation;
  if(o.live&&c.auto_monitor!==false&&!monitor&&sender.tab&&o.room_id===(c.draft_room_id||c.league_id)){
   const tab=await chrome.tabs.duplicate(sender.tab.id);monitor={tab_id:tab.id,room_id:o.room_id};
   await chrome.storage.local.set({nbaMonitor:monitor});await chrome.tabs.update(sender.tab.id,{active:true});
  }
  const isMonitor=monitor?.tab_id===sender.tab?.id;
  if(monitor&&!isMonitor&&(o.results_visible||o.result_page)){o.results_visible=false;o.result_page=false;o.picks=[];}
  const key='nba:'+c.league_id+':'+c.season,old=(await chrome.storage.local.get(key))[key],value=NBAState.reduce(old,o,c);
  await chrome.storage.local.set({[key]:value,[key+':previous']:old||null});
  return {ok:true,revision:value.revision,monitor:isMonitor};
 }).then(reply,e=>reply({ok:false,error:e.message}));
 return true;
});

