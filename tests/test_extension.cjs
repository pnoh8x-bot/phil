/* Synthetic browser API integration; does not claim actual Chrome validation. */
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {reduce}=require('../browser-extension/state.js');
const {bind}=require('../browser-extension/transport.js');
const config={enabled:true,league_id:'123',team_id:'9',season:2026};
const base=()=>({live:true,room_id:'123',season:2026,captured_at:new Date().toISOString(),source_url:'https://basketball.fantasysports.yahoo.com/draftclient/nba/123/9',results_visible:true,current_pick:3,draft_slot:3,picks:[{pick:1,player_id:'1',player:'Synthetic 1',team:'Other'},{pick:2,player_id:'2',player:'Synthetic 2',team:'Other'}]});
let tests=0;async function test(name,fn){await fn();tests++;process.stdout.write('PASS '+name+'\n');}
function mockStorage(initial){const data=structuredClone(initial),listeners=[];return {data,onChanged:{addListener:fn=>listeners.push(fn)},get:async keys=>typeof keys==='string'?{[keys]:data[keys]}:Object.fromEntries(keys.map(k=>[k,data[k]])),set:async changes=>{Object.assign(data,structuredClone(changes));for(const fn of listeners)fn(changes);},remove:async key=>{delete data[key];}};}
(async()=>{
await test('ID-only merge, ADP not rank, source URL has no query',()=>{let o=base();o.players=[{YAHOO_ID:'3',PLAYER:'Synthetic',PTS:1,STAT_SOURCE:'Proj',STAT_BASIS:'season_total'}];o.adp=[{YAHOO_ID:'3',ADP_AVG:8.2}];const s=reduce(null,o,config);assert.equal(s.board[0].ADP_AVG,8.2);assert.equal(s.picks.length,2);assert.equal(s.history_complete,true);});
await test('virtualized observations retain and verify a contiguous merged history',()=>{let s=reduce(null,base(),config);const o=base();o.picks=o.picks.slice(1);s=reduce(s,o,config);assert.equal(s.picks.length,2);assert.equal(s.history_complete,true);});
await test('complete undo atomically replaces history',()=>{let s=reduce(null,base(),config),o=base();o.current_pick=2;o.picks=o.picks.slice(0,1);s=reduce(s,o,config);assert.equal(s.picks.length,1);assert.equal(s.current_pick,2);assert.equal(s.history_complete,true);});
await test('wrong league, season, historical, duplicate IDs stop',()=>{for(const change of [{room_id:'456'},{season:2025},{historical:true},{picks:[{pick:1,player_id:'1'},{pick:2,player_id:'001'}]}])assert.throws(()=>reduce(null,{...base(),...change},config));});
await test('changing statistic source clears previous baseline',()=>{let o=base();o.players=[{YAHOO_ID:'3',STAT_SOURCE:'A'}];let s=reduce(null,o,config);o.players=[{YAHOO_ID:'4',STAT_SOURCE:'B'}];s=reduce(s,o,config);assert.deepEqual(s.board.map(p=>p.YAHOO_ID),['4']);});
await test('real transport publishes scoped state and stores app ACK without feedback loop',async()=>{const state=reduce(null,base(),config),storage=mockStorage({nbaConfig:config,'nba:123:2026':state}),sent=[];const win={location:{origin:'https://nba-draft-helper.onrender.com'},postMessage:m=>sent.push(m),addEventListener:()=>{}};const t=bind(storage,win);await t.handle({source:win,origin:win.location.origin,data:{type:'NBA_HELPER_READY'}});assert.equal(sent.at(-1).value.revision,1);await t.handle({source:win,origin:win.location.origin,data:{type:'NBA_HELPER_ACK',league_id:'123',revision:1}});assert.equal(storage.data.nbaLastAck.revision,1);const n=sent.length;await t.handle({source:{},origin:'https://evil.example',data:{type:'NBA_HELPER_DISCONNECT'}});assert.equal(sent.length,n);await t.handle({source:win,origin:win.location.origin,data:{type:'NBA_HELPER_READY',league_id:'456',season:2026}});assert.equal(sent.length,n);await t.handle({source:win,origin:win.location.origin,data:{type:'NBA_HELPER_DISCONNECT'}});assert.equal(storage.data.nbaConfig.enabled,false);assert.equal(storage.data['nba:123:2026'].picks.length,2);});
await test('worker serializes one-client captures without any tabs API even with legacy monitor settings',async()=>{
const storage=mockStorage({nbaConfig:{...config,auto_monitor:true},nbaMonitor:{tab_id:99,room_id:'123'}});let listener;
const chrome={storage:{local:storage},runtime:{onMessage:{addListener:fn=>listener=fn}}};
vm.runInNewContext(fs.readFileSync(require.resolve('../browser-extension/background.js'),'utf8'),{chrome,console,importScripts:()=>{},NBAState:{reduce}});
const capture=o=>new Promise(resolve=>listener({type:'NBA_CAPTURE',observation:o},{tab:{id:10}},resolve));
const [a,b]=await Promise.all([capture(base()),capture(base())]);assert.equal(a.ok,true);assert.equal(b.revision,2);assert.equal(storage.data['nba:123:2026'].picks.length,2);assert.equal(storage.data['nba:123:2026:previous'].revision,1);
});
await test('duplicate-client logout preserves records but immediately invalidates freshness',()=>{
const old=reduce(null,base(),config),s=reduce(old,{...base(),connection_error:'Yahoo duplicate client'},config);
assert.equal(s.history_complete,false);assert.equal(s.picks_at,null);assert.equal(s.picks.length,2);assert.equal(s.connection_error,'Yahoo duplicate client');
const recovered=reduce(s,base(),config);assert.equal(recovered.connection_error,undefined);assert.equal(recovered.history_complete,true);
});
await test('verified projection shot volumes survive live percentage-only and historical captures',()=>{let o=base();o.players=[{YAHOO_ID:'3',STAT_SOURCE:'Remaining Games (proj)',STAT_SEASON:2026,STAT_BASIS:'season_total',FGM:1,FGA:2,FTM:1,FTA:2}];let s=reduce(null,o,config);o.players=[{YAHOO_ID:'3',STAT_SOURCE:'2026-27 Proj Stats',STAT_SEASON:2026,STAT_BASIS:'season_total',PTS:99}];s=reduce(s,o,config);assert.equal(s.board[0].FGA,2);assert.equal(s.stat_source,'Remaining Games (proj)');o.players=[{YAHOO_ID:'4',STAT_SOURCE:'2025-26 Season (avg)',STAT_SEASON:2025,STAT_BASIS:'per_game',FGM:1,FGA:2,FTM:1,FTA:2}];s=reduce(s,o,config);assert.deepEqual(s.board.map(p=>p.YAHOO_ID),['3']);});
await test('actual logout message stops parser before stale tables can be read',()=>{
const {parse}=require('../browser-extension/parser.js');const doc={body:{textContent:'You have been logged off because you logged in from another draft client.'},querySelector:()=>null};
const parsed=parse(doc,'https://basketball.fantasysports.yahoo.com/draftclient/nba/123/9');assert.ok(parsed.connection_error);assert.equal(parsed.picks.length,0);assert.equal(parsed.results_visible,false);
});
await test('visible clock accepts later-round overall and within-round picks consistently',()=>{
const {parse}=require('../browser-extension/parser.js');
const parseClock=text=>parse({body:{textContent:text},querySelector:()=>null,querySelectorAll:()=>[]},'https://basketball.fantasysports.yahoo.com/draftclient/nba/123/9');
for(let overall=1;overall<=60;overall++){
const r=Math.floor((overall-1)/12)+1,within=(overall-1)%12+1;
assert.equal(parseClock('Round '+r+', Pick '+overall).current_pick,overall);
assert.equal(parseClock('Round '+r+' · Pick '+within).current_pick,overall);
}
assert.equal(parseClock('Round 2, Pick 99').current_pick,undefined);
assert.equal(parseClock("You're up in 0 Picks Round 2, Pick 18").draft_slot,7);
});
await test('missing live clock invalidates cached pick instead of reusing first-round clock',()=>{
let old=reduce(null,base(),config);const o=base();delete o.current_pick;
o.picks=Array.from({length:17},(_,i)=>({pick:i+1,player_id:String(i+1),player:'Synthetic',team:'Other'}));
let s=reduce(old,o,config);assert.equal(s.current_pick,undefined);assert.equal(s.history_complete,false);assert.equal(s.picks.length,17);
o.current_pick=18;s=reduce(s,o,config);assert.equal(s.current_pick,18);assert.equal(s.history_complete,true);
});
await test('normal league empty results cannot erase mock history, owner mode, clock or freshness',()=>{
const c={...config,draft_room_id:'456'},o={...base(),room_id:'456'};let s=reduce(null,o,c);const stamp=s.picks_at;
s=reduce(s,{league_id:'123',season:2026,result_page:true,picks:[],draft_status:'Draft scheduled',captured_at:'later',source_url:'league-results'},c);
assert.equal(s.picks.length,2);assert.equal(s.live,true);assert.equal(s.room_id,'456');assert.equal(s.current_pick,3);assert.equal(s.picks_at,stamp);assert.equal(s.history_complete,true);assert.notEqual(s.draft_status,'Draft scheduled');
});
await test('normal stats and ADP enrich the mock without supplying pick ownership',()=>{
const c={...config,draft_room_id:'456'};let s=reduce(null,{...base(),room_id:'456'},c);
s=reduce(s,{league_id:'123',season:2026,result_page:true,picks:[],players:[{YAHOO_ID:'3',STAT_SOURCE:'Remaining Games (proj)',STAT_SEASON:2026,STAT_BASIS:'season_total',FGM:3,FGA:5,FTM:1,FTA:2}],adp:[{YAHOO_ID:'3',ADP_AVG:33}],captured_at:'later'},c);
assert.equal(s.board[0].FGA,5);assert.equal(s.board[0].ADP_AVG,33);assert.equal(s.picks.length,2);assert.equal(s.live,true);
});
await test('live Players capture fixes owner mode without inventing any results',()=>{
const c={...config,draft_room_id:'456'};let s=reduce(null,{league_id:'123',season:2026,result_page:true,picks:[],captured_at:'old'},config);
s=reduce(s,{...base(),room_id:'456',results_visible:false,picks:[],current_pick:64,draft_slot:12},c);
assert.equal(s.live,true);assert.equal(s.room_id,'456');assert.equal(s.picks.length,0);assert.equal(s.history_complete,false);assert.equal(s.picks_at,null);assert.equal(s.current_pick,64);
});
await test('new mock room resets only draft state and old room is never published as new room',async()=>{
const a={...config,draft_room_id:'456'},b={...config,draft_room_id:'789'};let s=reduce(null,{...base(),room_id:'456'},a);
const storage=mockStorage({nbaConfig:b,'nba:123:2026':s}),sent=[];const win={location:{origin:'https://nba-draft-helper.onrender.com'},postMessage:m=>sent.push(m),addEventListener:()=>{}};const t=bind(storage,win);await t.handle({source:win,origin:win.location.origin,data:{type:'NBA_HELPER_READY'}});assert.ok(!sent.some(m=>m.type==='NBA_HELPER_SNAPSHOT'));
s=reduce(s,{...base(),room_id:'789',results_visible:false,picks:[],current_pick:1,draft_slot:8},b);assert.equal(s.picks.length,0);assert.equal(s.room_id,'789');assert.equal(s.draft_slot,8);assert.equal(s.picks_at,null);
});
await test('worker archives the previous room before switching draft state',async()=>{
const old=reduce(null,{...base(),room_id:'456'},{...config,draft_room_id:'456'});
const storage=mockStorage({nbaConfig:{...config,draft_room_id:'789'},'nba:123:2026':old});let listener;
const chrome={storage:{local:storage},runtime:{onMessage:{addListener:fn=>listener=fn}}};
vm.runInNewContext(fs.readFileSync(require.resolve('../browser-extension/background.js'),'utf8'),{chrome,console,importScripts:()=>{},NBAState:{reduce}});
const response=await new Promise(resolve=>listener({type:'NBA_CAPTURE',observation:{...base(),room_id:'789',results_visible:false,picks:[],current_pick:1}},{tab:{id:10}},resolve));
assert.equal(response.ok,true);assert.equal(storage.data['nba:123:2026:archive:456'].picks.length,2);assert.equal(storage.data['nba:123:2026'].picks.length,0);
});
await test('popup restores team identity, preserves legacy room and never opens real results for mock',async()=>{
const data={nbaConfig:{...config,draft_room_id:'456'}},storage=mockStorage(data),elements=Object.fromEntries(['team','room','status','start','stop','results','players','adp','helper'].map(k=>[k,{value:'',textContent:''}])),tabs=[];
vm.runInNewContext(fs.readFileSync(require.resolve('../browser-extension/popup.js'),'utf8'),{document:{getElementById:k=>elements[k]},chrome:{storage:{local:storage},runtime:{sendMessage:async()=>({ok:true})},tabs:{create:x=>tabs.push(x)}},URL,Date});await Promise.resolve();await Promise.resolve();
assert.equal(elements.team.value,'https://basketball.fantasysports.yahoo.com/nba/123/9');await elements.start.onclick();assert.equal(storage.data.nbaConfig.draft_room_id,'456');elements.results.onclick();assert.equal(tabs.length,0);
elements.room.value='https://basketball.fantasysports.yahoo.com/draftclient/nba/789/9?auth=synthetic-secret';await elements.start.onclick();assert.equal(storage.data.nbaConfig.draft_room_id,'789');assert.equal(storage.data.nbaConfig.draft_room_url,'https://basketball.fantasysports.yahoo.com/draftclient/nba/789/9');assert.ok(!JSON.stringify(storage.data.nbaConfig).includes('auth='));
});
await test('collector follows observed next links only and never crosses filter, origin or path',()=>{
 const {nextPage}=require('../browser-extension/collector.js'),url='https://basketball.fantasysports.yahoo.com/nba/123/players?status=ALL&stat1=S_PSR&count=0';
 const doc=href=>({querySelectorAll:()=>[{textContent:'Next 25',getAttribute:k=>k==='href'?href:null}]});
 assert.match(nextPage(doc('?status=ALL&stat1=S_PSR&count=25'),url),/count=25#nba-helper-collect/);
 for(const href of ['?status=A&stat1=S_PSR&count=25','?status=ALL&stat1=S_AS_2025&count=25','?status=ALL&stat1=S_PSR&count=0','https://evil.example/?count=25','/draftclient/nba/123/9?count=25'])assert.equal(nextPage(doc(href),url),null);
});
await test('25-row projection pages accumulate by exact ID and retain missing owned player until next page',()=>{
 const page=(start)=>Array.from({length:25},(_,i)=>({YAHOO_ID:String(start+i),PLAYER:'Synthetic '+(start+i),STAT_SOURCE:'Remaining Games (proj)',STAT_SEASON:2026,STAT_BASIS:'season_total',GP:82,FGM:1,FGA:2,FTM:1,FTA:2}));
 let o={...base(),players:page(1),collection:{season:2026,status:'collecting',page:1}};o.league_id='123';let s=reduce(null,o,config);
 assert.equal(s.players.length,25);assert.ok(!s.players.find(p=>p.YAHOO_ID==='40'));
 s=reduce(s,{...o,players:page(26),collection:{season:2026,status:'complete',page:2}},config);
 assert.equal(s.players.length,50);assert.equal(s.collection.players,50);assert.ok(s.players.find(p=>p.YAHOO_ID==='40'));assert.equal(s.picks.length,2);
});
await test('completed draft does not lose final clock on later Players observations',()=>{
 let o={...base(),draft_status:'complete'},s=reduce(null,o,config);delete o.current_pick;o.results_visible=false;o.picks=[];s=reduce(s,o,config);assert.equal(s.current_pick,3);assert.equal(s.picks.length,2);assert.equal(s.history_complete,true);
});
await test('automatic collection opens one ordinary tab, never a duplicate draft client, and authenticates designated sender',async()=>{
 const storage=mockStorage({nbaConfig:{...config,auto_collect:true}}),tabs=[];let listener;
 const chrome={storage:{local:storage},runtime:{onMessage:{addListener:fn=>listener=fn}},tabs:{create:async options=>{tabs.push(options);return {id:90};},get:async()=>({id:90})}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../browser-extension/background.js'),'utf8'),{chrome,console,importScripts:()=>{},NBAState:{reduce},Date});
 const call=(m,id=10)=>new Promise(resolve=>listener(m,{tab:{id}},resolve));
 await call({type:'NBA_CAPTURE',observation:base()});await new Promise(r=>setTimeout(r,0));await call({type:'NBA_CAPTURE',observation:base()});await new Promise(r=>setTimeout(r,0));
 assert.equal(tabs.length,1);assert.match(tabs[0].url,/\/nba\/123\/players#nba-helper-collect$/);assert.equal(tabs[0].active,false);
 assert.equal((await call({type:'NBA_COLLECTOR_HELLO'},90)).enabled,true);assert.equal((await call({type:'NBA_COLLECTOR_HELLO'},91)).enabled,false);
});
await test('automatic result views restore Players and never click a draft action',async()=>{
 const monitor=require('../browser-extension/live-monitor.js');let selected='Players',clicks=[],captures=0;
 const elements=['Players','Results','Round by Round','Draft','Autodraft'].map(name=>({textContent:name,className:'',parentElement:{className:''},getClientRects:()=>[1],getAttribute:key=>key==='aria-selected'?String(name===selected):null,click(){clicks.push(name);if(['Players','Results'].includes(name))selected=name;}}));
 const table={parentElement:null,querySelectorAll:()=>[{textContent:'Pick Player Team'}]};
 const doc={querySelectorAll:selector=>selector==='table'?(selected==='Results'?[table]:[]):selector==='table thead'?[]:elements};
 const result=await monitor.observe({doc,url:'synthetic',capture:async()=>{captures++;},idle:()=>9999,delay:async()=>{}});
 assert.equal(result.status,'observing');assert.equal(selected,'Players');assert.ok(captures);assert.deepEqual(clicks,['Results','Round by Round','Players']);
 clicks=[];await monitor.observe({doc,capture:async()=>{},idle:()=>0,delay:async()=>{}});assert.equal(clicks.length,0);
});
await test('production collector runner walks stats pages then ADP pages and completes with persistent rows',async()=>{
 const {nextPage,filterChange}=require('../browser-extension/collector.js');
 let phase='stats',page=1,tick,done=false,state;
 const c={...config,auto_collect:true},selects=Object.fromEntries([['statusselect','All Players','ALL'],['eteamselect','All Teams','ALL'],['fteamselect','No Team Selected','NONE'],['statselect','Remaining Games (proj)','S_PSR']].map(([id,text,value])=>[id,{value,options:[{textContent:text,value}]}]));
 const loc={pathname:'/nba/123/players',href:'https://basketball.fantasysports.yahoo.com/nba/123/players?status=ALL&stat1=S_PSR&count=0',origin:'https://basketball.fantasysports.yahoo.com',assign(url){const u=new URL(url);loc.href=url;loc.pathname=u.pathname;if(u.pathname.endsWith('/draftanalysis')){phase='adp';page=1;}else page=2;}};
 const doc={title:'',getElementById:id=>selects[id],querySelector:selector=>selector.includes('caret-right')?{closest:()=>page===1?{disabled:false,getAttribute:()=>null,click:()=>page=2}:{disabled:true,getAttribute:()=>null}}:null,querySelectorAll:()=>phase==='stats'&&page===1?[{textContent:'Next 25',getAttribute:k=>k==='href'?'?status=ALL&stat1=S_PSR&count=25':null}]:[]};
 const chrome={storage:{local:{get:async()=>({nbaConfig:c})}},runtime:{sendMessage:async m=>{if(m.type==='NBA_COLLECTOR_HELLO')return {enabled:true};if(m.type==='NBA_COLLECTOR_ERROR')throw Error(m.error);state=reduce(state,m.observation,c);return {ok:true};}}};
 const parser={parse:()=>({league_id:'123',season:2026,captured_at:new Date().toISOString(),source_url:'synthetic',players:phase==='stats'?Array.from({length:25},(_,i)=>({YAHOO_ID:String((page-1)*25+i+1),PLAYER:'Synthetic',STAT_SOURCE:'Remaining Games (proj)',STAT_SEASON:2026,STAT_BASIS:'season_total',GP:82,FGM:1,FGA:2,FTM:1,FTA:2})):[],adp:phase==='adp'?[{YAHOO_ID:String(page),PLAYER:'Synthetic',ADP_AVG:page+1.5}]:[]})};
 const context={document:doc,location:loc,chrome,NBAParser:parser,NBACollector:{nextPage,filterChange},setInterval:fn=>{tick=fn;return 1;},clearInterval:()=>done=true,URL,Event:class{}};
 const run=()=>vm.runInNewContext(fs.readFileSync(require.resolve('../browser-extension/collector-page.js'),'utf8'),context);
 await run();await new Promise(r=>setTimeout(r,0));assert.equal(page,2);assert.equal(state.players.length,25);
 await run();await new Promise(r=>setTimeout(r,0));assert.equal(phase,'adp');assert.equal(state.players.length,50);assert.equal(state.collection.status,'complete');
 await run();await new Promise(r=>setTimeout(r,0));assert.equal(page,2);await tick();assert.equal(state.adp_collection.status,'complete');assert.equal(state.adp.length,2);assert.equal(state.players.length,50);assert.ok(done);
});
process.stdout.write(tests+' JavaScript checks passed (mock Chrome API)\n');
})().catch(e=>{console.error(e);process.exitCode=1});
