/* Shared real extension transport; no Yahoo requests. */
(function(root){
function bind(storage,win){
 let args=null,stopped=false;
 async function publish(){
  const {nbaConfig:c}=await storage.get('nbaConfig');if(!c?.enabled||stopped)return;
  const league=args?.league_id||c.league_id,season=args?.season||c.season;if(league!==c.league_id||season!==c.season)return;
  const key='nba:'+league+':'+season,value=(await storage.get(key))[key];
  if(value?.live&&value.room_id!==(c.draft_room_id||c.league_id))return;
  if(c.draft_room_id&&(!value?.live||value.room_id!==c.draft_room_id))return;
  if(value)win.postMessage({type:'NBA_HELPER_SNAPSHOT',value,config:c},win.location.origin);
 }
 async function handle(e){
  if(e.source!==win||e.origin!==win.location.origin)return;const m=e.data;
  if(m?.type==='NBA_HELPER_READY'){args=m.league_id?{league_id:String(m.league_id),season:m.season}:null;await publish();}
  if(m?.type==='NBA_HELPER_CONNECT'&&/^\d+$/.test(String(m.league_id))){
   const {nbaConfig:c}=await storage.get('nbaConfig');args={league_id:String(m.league_id),season:m.season};stopped=false;
   await storage.set({nbaConfig:{...(c?.league_id===args.league_id?c:{}),...args,team_id:m.team_id,enabled:true,auto_monitor:false}});await publish();
  }
  if(m?.type==='NBA_HELPER_ACK')await storage.set({nbaLastAck:{league_id:m.league_id,room_id:m.room_id,revision:m.revision,received_at:new Date().toISOString()}});
  if(m?.type==='NBA_HELPER_DISCONNECT'){stopped=true;const {nbaConfig:c}=await storage.get('nbaConfig');await storage.set({nbaConfig:{...c,enabled:false}});win.postMessage({type:'NBA_HELPER_DISCONNECTED'},win.location.origin);}
 }
 win.addEventListener('message',e=>handle(e).catch(e=>win.postMessage({type:'NBA_HELPER_ERROR',error:e.message},win.location.origin)));
 storage.onChanged.addListener(changes=>{if(Object.keys(changes).some(k=>k.startsWith('nba:')||k==='nbaConfig'))publish().catch(()=>{});});
 win.postMessage({type:'NBA_HELPER_AVAILABLE'},win.location.origin);return {publish,handle};
}
root.NBATransport={bind};if(typeof module!=='undefined')module.exports=root.NBATransport;
})(globalThis);

