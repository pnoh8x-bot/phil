const $=id=>document.getElementById(id);let config;
chrome.storage.local.get(['nbaConfig','nbaLastAck']).then(({nbaConfig,nbaLastAck})=>{config=nbaConfig;$('status').textContent=(config?.enabled?'연결 활성화':'연결 꺼짐')+(nbaLastAck?.league_id===config?.league_id?' · Helper 수신 확인 버전 '+nbaLastAck.revision+' · '+nbaLastAck.received_at:' · Helper 수신 확인 대기');if(config?.team_url)$('team').value=config.team_url;});
$('start').onclick=async()=>{
 try{const u=new URL($('team').value),m=u.pathname.match(/^\/nba\/(\d+)\/(\d+)\/?$/);if(u.origin!=='https://basketball.fantasysports.yahoo.com'||!m)throw Error('Yahoo 농구 팀 주소를 입력하세요');
 let draft_room_id;if($('room').value.trim()){const room=new URL($('room').value),r=room.pathname.match(/^\/draftclient\/nba\/(\d+)\/\d+\/?$/);if(room.origin!==u.origin||!r)throw Error('드래프트 방 주소를 확인하세요');draft_room_id=r[1];}
 config={enabled:true,auto_monitor:false,league_id:m[1],team_id:m[2],team_url:u.origin+u.pathname,draft_room_id,season:new Date().getFullYear()};await chrome.storage.local.remove('nbaMonitor');await chrome.storage.local.set({nbaConfig:config});$('status').textContent='연결 활성화 · 드래프트 탭은 하나만 유지하세요';}catch(e){$('status').textContent=e.message;}
};
$('stop').onclick=async()=>{config={...config,enabled:false};await chrome.storage.local.set({nbaConfig:config});$('status').textContent='연결 중지';};
for(const [id,path] of Object.entries({results:'draftresults',players:'players',adp:'draftanalysis'}))$(id).onclick=()=>{if(config?.league_id)chrome.tabs.create({url:`https://basketball.fantasysports.yahoo.com/nba/${config.league_id}/${path}`});};
$('helper').onclick=()=>chrome.tabs.create({url:'https://nba-draft-helper.onrender.com/'});
