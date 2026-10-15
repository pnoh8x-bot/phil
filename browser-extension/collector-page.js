/* One background-visible ordinary Players tab walks every page at 2s intervals. */
(async()=>{
 if(!/^\/nba\/\d+\/(players|draftanalysis)\/?$/.test(location.pathname))return;
 let busy=false,adpSeen=new Set(),adpPages=0,emptyTicks=0,stalled=0;
 async function tick(){
  if(busy)return;busy=true;
  try{
   const {nbaConfig:c}=await chrome.storage.local.get('nbaConfig');
   if(!c?.enabled||c.auto_collect===false||location.pathname.split('/')[2]!==c.league_id)return;
   const permit=await chrome.runtime.sendMessage({type:'NBA_COLLECTOR_HELLO'});if(!permit?.enabled)return;
   if(location.pathname.endsWith('/draftanalysis')){
    const o=NBAParser.parse(document,location.href);
    if(!o?.adp?.length){if(++emptyTicks>15)throw Error('공개 ADP 표를 읽지 못했습니다. 잠긴 값은 추정하지 않습니다.');return;}
    const signature=o.adp.map(p=>p.YAHOO_ID).join(',');if(adpSeen.has(signature)){if(++stalled>15)throw Error('ADP 다음 페이지가 응답하지 않습니다.');return;}stalled=0;adpSeen.add(signature);adpPages++;
    if(adpPages>40)throw Error('ADP 수집 안전 한도에 도달했습니다.');
    const next=document.querySelector('button svg[data-icon="caret-right"]')?.closest('button');
    const more=next&&!next.disabled&&next.getAttribute('aria-disabled')!=='true';
    o.adp_collection={status:more?'collecting':'complete',page:adpPages,updated_at:o.captured_at};
    const result=await chrome.runtime.sendMessage({type:'NBA_CAPTURE',observation:o});if(!result?.ok)throw Error(result?.error||'ADP 저장 실패');
    if(more)next.click();else{clearInterval(interval);document.title='[수집 완료] Yahoo 통계 · ADP';}
    return;
   }
   const change=NBACollector.filterChange(document);
   if(change.error)throw Error(change.error);
   if(change.element){change.element.value=change.value;change.element.dispatchEvent(new Event('change',{bubbles:true}));return;}
   if(change.radio){change.radio.click();return;}
   const query=new URL(location.href).searchParams;
   if(query.get('stat1')!==document.getElementById('statselect').value||query.get('status')!=='ALL')return;
   const o=NBAParser.parse(document,location.href);
   if(!o?.players?.length){if(++emptyTicks>15)throw Error('선수 표를 읽지 못했습니다. Yahoo 로그인을 확인하세요.');return;}
   if(o.players.some(p=>p.STAT_SEASON!==c.season||p.STAT_SOURCE!=='Remaining Games (proj)'||p.STAT_BASIS!=='season_total'))throw Error('현재 시즌 예측 통계를 확인하지 못했습니다.');
   const next=NBACollector.nextPage(document,location.href),offset=Number(new URL(location.href).searchParams.get('count')||0);
   if(!next&&Array.from(document.querySelectorAll('a[href]')).some(a=>/^Next\s+\d+$/i.test(a.textContent.trim())))throw Error('다음 페이지의 선수 범위·시즌이 바뀌어 수집을 멈췄습니다.');
   if(offset>975)throw Error('검증 가능한 최대 1,000명에 도달했습니다. 전체 수집을 완료로 표시하지 않습니다.');
   o.collection={status:next?'collecting':'complete',page:Math.floor(offset/25)+1,offset,updated_at:o.captured_at,source:'Remaining Games (proj)',season:c.season};
   const result=await chrome.runtime.sendMessage({type:'NBA_CAPTURE',observation:o});
   if(!result?.ok)throw Error(result?.error||'통계 저장 응답이 없습니다.');
   if(next)location.assign(next);
   else location.assign(location.origin+`/nba/${c.league_id}/draftanalysis#nba-helper-collect`);
  }catch(e){await chrome.runtime.sendMessage({type:'NBA_COLLECTOR_ERROR',error:e.message}).catch(()=>{});clearInterval(interval);}
  finally{busy=false;}
 }
 const interval=setInterval(tick,2000);tick();
})();
