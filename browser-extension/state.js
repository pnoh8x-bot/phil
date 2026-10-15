/* Pure reducer: complete observations may undo; partial ones cannot erase. */
(function(root){
const id=x=>{const s=String(x);if(!/^\d+$/.test(s)||Number(s)<=0)throw Error('Invalid Yahoo ID');return String(Number(s));};
function reduce(old,o,c){
 if(!c?.enabled||o.historical||o.season!==c.season)throw Error('Inactive/wrong season');
 if(o.live?o.room_id!==(c.draft_room_id||c.league_id):o.league_id!==c.league_id)throw Error('Wrong league/room');
 const s=JSON.parse(JSON.stringify(old||{version:1,league_id:c.league_id,season:c.season,players:[],adp:[],picks:[],teams:[],settings:{}}));
 if(s.league_id!==c.league_id||s.season!==c.season)throw Error('Stored scope mismatch');
 if(o.connection_error){s.connection_error=o.connection_error;s.history_complete=false;s.picks_at=null;s.captured_at=o.captured_at;s.revision=(s.revision||0)+1;return s;}
 delete s.connection_error;
 const merge=(a,b)=>Object.values(Object.fromEntries([...a,...b].map(p=>[id(p.YAHOO_ID),{...p,YAHOO_ID:id(p.YAHOO_ID)}])));
 const quality=rows=>{const p=rows?.[0];if(!p)return -1;const year=p.STAT_SEASON||Number(p.STAT_SOURCE?.match(/20\d{2}/)?.[0]||c.season);if(year!==c.season||!['per_game','season_total'].includes(p.STAT_BASIS))return 0;const volume=['FGM','FGA','FTM','FTA'].every(k=>k in p);return (/Proj|\(proj\)/i.test(p.STAT_SOURCE||'')?2:0)+(volume?2:1);};
 // Retain observed shot volumes when the live table only has percentages.
 if(o.players?.length&&quality(o.players)>=quality(s.players)){const src=o.players[0].STAT_SOURCE;if(s.stat_source&&s.stat_source!==src)s.players=[];s.stat_source=src;s.players=merge(s.players,o.players);}
 s.adp=merge(s.adp,o.adp||[]);s.settings={...s.settings,...o.settings};if(o.teams?.length)s.teams=o.teams;
 if(o.results_visible||o.result_page){
  const ps=(o.picks||[]).map(p=>({...p,player_id:id(p.player_id)})),seen=new Set(),ids=new Set();
  for(const p of ps){if(!Number.isInteger(p.pick)||p.pick<1||seen.has(p.pick)||ids.has(p.player_id))throw Error('Conflicting picks');seen.add(p.pick);ids.add(p.player_id);}
  const max=Math.max(0,...seen),full=seen.size===max&&(o.current_pick==null||o.current_pick===max+1);
  if(full){s.picks=ps;s.history_complete=true;}else{s.picks=Object.values(Object.fromEntries([...s.picks,...ps].map(p=>[p.pick,p])));s.history_complete=false;}
  s.picks.sort((a,b)=>a.pick-b.pick);s.picks_at=o.captured_at;s.live=!!o.live;
 }
 for(const k of ['draft_teams','draft_status','draft_slot','current_pick'])if(o[k]!=null)s[k]=o[k];
 const adp=Object.fromEntries(s.adp.map(p=>[p.YAHOO_ID,p]));
 s.board=s.players.map(p=>({...p,...(adp[p.YAHOO_ID]||{}),ADP_RANK:1}));
 s.source_url=o.source_url;s.captured_at=o.captured_at;s.revision=(s.revision||0)+1;s.team_id=c.team_id;return s;
}
root.NBAState={reduce};if(typeof module!=='undefined')module.exports=root.NBAState;
})(globalThis);

