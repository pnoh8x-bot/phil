/* Pure DOM parser. No fetch, cookies, page internals, or hidden network calls. */
(function(root){
 const text=e=>(e?.textContent||'').trim().replace(/\s+/g,' ');
 const number=s=>/^[-+]?\d*\.?\d+%?$/.test(s||'')?Number(s.replace('%','')):null;
 const player=row=>{const a=Array.from(row.querySelectorAll('a[href]')).find(a=>/\/nba\/players\/\d+\/?$/.test(new URL(a.href,'https://sports.yahoo.com').pathname));return a?{id:a.href.match(/players\/(\d+)/)[1],name:text(a),cell:a.closest('td')}:null};
 function parse(doc,url){
  const u=new URL(url), match=u.pathname.match(/^\/nba\/(\d+)(?:\/|$)/);if(!match)return null;
  const seasonText=text(doc.querySelector('#yfa-draftresults-select option:checked'));
  const historical=u.searchParams.get('draft_results_period')==='previous'||(Number(seasonText.match(/20\d{2}/)?.[0]||new Date().getFullYear())<new Date().getFullYear());
  const season=Number(seasonText.match(/20\d{2}/)?.[0]||new Date().getFullYear());
  const out={version:1,league_id:match[1],season,historical,source_url:u.origin+u.pathname+(historical?'?draft_results_period=previous':''),captured_at:new Date().toISOString(),picks:[],players:[],adp:[],settings:{},teams:[]};
  for(const row of doc.querySelectorAll('#settings-table tr')){const cells=row.querySelectorAll('td');if(cells.length===2)out.settings[text(cells[0]).replace(/:$/,'')]=text(cells[1]);}
  for(const opt of doc.querySelectorAll('#fteamselect option')){if(/^\d+$/.test(opt.value))out.teams.push({id:opt.value,name:text(opt)});}
  for(const table of doc.querySelectorAll('table')){
   const head=Array.from(table.querySelectorAll('thead tr')).at(-1);
   const headers=head?Array.from(head.children).map(x=>text(x).replace(/[\uE000-\uF8FF]/g,'').trim()):[];
   const round=Number(text(table.querySelector('thead')).match(/^Round\s+(\d+)$/)?.[1]);
   const body=Array.from(table.querySelectorAll('tbody tr'));
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
    if(headers.includes('Avg Pick')){const n=number(val('Avg Pick'));if(n>0)out.adp.push({YAHOO_ID:p.id,PLAYER:p.name,ADP_AVG:n});}
    if(headers.includes('PTS') && headers.includes('FG%')){
     const record={YAHOO_ID:p.id,PLAYER:p.name,STAT_SOURCE:text(doc.querySelector('#statselect option:checked'))};
     for(const [target,source] of Object.entries({'PTS':'PTS','REB':'REB','AST':'AST','STL':'ST','BLK':'BLK','3PM':'3PTM','TO':'TO','FG%':'FG%','FT%':'FT%','GP':'GP*'}))record[target]=number(val(source));
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
