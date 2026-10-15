/* Pure DOM parser. No fetch, cookies, page internals, or hidden network calls. */
(function(root){
 const text=e=>(e?.textContent||'').trim().replace(/\s+/g,' ');
 const number=s=>/^[-+]?\d*\.?\d+%?$/.test(s||'')?Number(s.replace('%','')):null;
 const player=row=>{const a=Array.from(row.querySelectorAll('a[href]')).find(a=>/\/nba\/players\/\d+\/?$/.test(new URL(a.href,'https://sports.yahoo.com').pathname));if(a)return {id:a.href.match(/players\/(\d+)/)[1],name:text(a),cell:a.closest('td')};const live=row.querySelector('.ys-player[data-id]');return live?{id:live.getAttribute('data-id'),name:live.querySelector('img')?.getAttribute('title')||text(live.querySelector('span')),cell:live.closest('td')}:null};
 function parse(doc,url){
  const u=new URL(url), liveMatch=u.pathname.match(/^\/draftclient\/nba\/(\d+)\/(\d+)\/?$/), match=u.pathname.match(/^\/nba\/(\d+)(?:\/|$)/)||liveMatch;if(!match)return null;
  const seasonText=text(doc.querySelector('#yfa-draftresults-select option:checked'));
  const historical=u.searchParams.get('draft_results_period')==='previous'||(Number(seasonText.match(/20\d{2}/)?.[0]||new Date().getFullYear())<new Date().getFullYear());
  const season=Number(seasonText.match(/20\d{2}/)?.[0]||new Date().getFullYear());
  const out={version:1,league_id:match[1],season,historical,source_url:u.origin+u.pathname+(historical?'?draft_results_period=previous':''),captured_at:new Date().toISOString(),picks:[],players:[],adp:[],settings:{},teams:[]};
  if(liveMatch){
   out.live=true;out.room_id=liveMatch[1];out.results_visible=false;
   const header=text(doc.body),clock=header.match(/Round\s+(\d+)\s*,\s*Pick\s+(\d+)/i);
   if(clock){const r=Number(clock[1]),p=Number(clock[2]);if(p>=1&&p<=12){out.current_pick=(r-1)*12+p;const wait=header.match(/You(?:'|’)re up in\s+(\d+)\s+Picks?/i);const mine=/Your Pick|You(?:'|’)re on the clock/i.test(header);if(wait||mine){const own=out.current_pick+(wait?Number(wait[1]):0),round=Math.floor((own-1)/12)+1,within=(own-1)%12+1;out.draft_slot=round%2?within:13-within;}}}
  }
  out.result_page=u.pathname.endsWith('/draftresults');
  for(const row of doc.querySelectorAll('#settings-table tr')){const cells=row.querySelectorAll('td');if(cells.length===2)out.settings[text(cells[0]).replace(/:$/,'')]=text(cells[1]);}
  for(const opt of doc.querySelectorAll('#fteamselect option')){if(/^\d+$/.test(opt.value))out.teams.push({id:opt.value,name:text(opt)});}
  for(const table of doc.querySelectorAll('table')){
   const head=Array.from(table.querySelectorAll('thead tr')).at(-1);
   const headers=head?Array.from(head.children).flatMap(x=>Array(Number(x.getAttribute('colspan')||1)).fill(text(x).replace(/[\uE000-\uF8FF]/g,'').trim())):[];
   const round=Number(text(table.querySelector('thead')).match(/^Round\s+(\d+)$/)?.[1]);
   const body=Array.from(table.querySelectorAll('tbody tr'));
   if(liveMatch && headers.join('|')==='Pick|Player|Team'){
    out.results_visible=true;
    for(const row of body){const p=player(row),cells=Array.from(row.children),pick=Number(text(cells[0]));if(p&&cells.length===3&&Number.isInteger(pick)&&pick>0)out.picks.push({pick,player:p.name,player_id:p.id,team:/^Your Team$/i.test(text(cells[2]))?'__OUR_TEAM__':text(cells[2])});}
   }
   if(round && u.pathname.endsWith('/draftresults')){
    // Table displays within-round positions. First round establishes team count.
    const first=Array.from(doc.querySelectorAll('table')).find(t=>/^Round\s+1$/.test(text(t.querySelector('thead'))));
    const teamCount=first?.querySelectorAll('tbody tr').length;
    if(!teamCount)continue;
    out.draft_teams=teamCount;
    for(const row of body){const p=player(row),cells=Array.from(row.children);const pos=Number(text(cells[0]).replace('.',''));if(p&&pos>0&&pos<=teamCount&&cells.length===3)out.picks.push({pick:(round-1)*teamCount+pos,round,player:p.name,player_id:p.id,team:text(cells[2])});}
   }
   for(const row of body){
    const p=player(row);if(!p)continue;const cells=Array.from(row.children);
    const val=h=>text(cells[headers.indexOf(h)]);
    if(headers.includes('Avg Pick')||(liveMatch&&headers.includes('ADP'))){const n=number(val(liveMatch?'ADP':'Avg Pick'));if(n>0)out.adp.push({YAHOO_ID:p.id,PLAYER:p.name,ADP_AVG:n});}
    if(headers.includes('PTS') && headers.includes('FG%')){
     const statMode=liveMatch?Array.from(doc.querySelectorAll('select option:checked')).map(x=>text(x)).find(x=>/Stats$/.test(x))||'Live draft displayed stats':text(doc.querySelector('#statselect option:checked'));
     const record={YAHOO_ID:p.id,PLAYER:p.name,STAT_SOURCE:statMode};
     record.STAT_BASIS=/Average|\(avg\)/i.test(statMode)?'per_game':/Total|Proj Stats/i.test(statMode)?'season_total':'unknown';
     for(const [target,source] of Object.entries({'PTS':'PTS','REB':'REB','AST':'AST','STL':'ST','BLK':'BLK','3PM':'3PTM','TO':'TO','FG%':'FG%','FT%':'FT%','GP':'GP*'}))record[target]=number(val(source));
     if(liveMatch)record.GP=number(val('GP'));
     for(const prefix of ['FG','FT']){const pair=val(prefix+'M/A*').split('/');if(pair.length===2){record[prefix+'M']=number(pair[0]);record[prefix+'A']=number(pair[1]);}}
     const info=text(p.cell).match(/\b([A-Z]{2,3})\s*-\s*((?:PG|SG|SF|PF|C)(?:,(?:PG|SG|SF|PF|C))*)/);if(info){record.TEAM=info[1];record.POS=info[2];}
     out.players.push(record);
    }
   }
  }
  const scheduled=text(doc.querySelector('.yfa-draft-scheduled')); if(scheduled)out.draft_status=scheduled;
  return out;
 }
 root.NBAParser={parse};if(typeof module!=='undefined')module.exports=root.NBAParser;
})(typeof globalThis!=='undefined'?globalThis:this);
