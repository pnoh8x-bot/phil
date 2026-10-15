importScripts('state.js');
let queue=Promise.resolve();
chrome.runtime.onMessage.addListener((m,sender,reply)=>{
 if(m.type!=='NBA_CAPTURE')return;
 queue=queue.catch(()=>{}).then(async()=>{
  const {nbaConfig:c}=await chrome.storage.local.get('nbaConfig');
  if(!c?.enabled)return {ok:false,error:'연결 꺼짐'};
  const o=m.observation;
  const key='nba:'+c.league_id+':'+c.season,old=(await chrome.storage.local.get(key))[key],value=NBAState.reduce(old,o,c);
  await chrome.storage.local.set({[key]:value,[key+':previous']:old||null});
  return {ok:true,revision:value.revision};
 }).then(reply,e=>reply({ok:false,error:e.message}));
 return true;
});

