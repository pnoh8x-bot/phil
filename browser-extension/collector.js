/* Navigate ordinary displayed HTML pages only. Never opens a draft client. */
(function(root){
 const clean=s=>(s||'').trim().replace(/\s+/g,' ');
 function nextPage(doc,url){
  const current=new URL(url),offset=Number(current.searchParams.get('count')||0);
  for(const a of doc.querySelectorAll('a[href]')){
   if(!/^Next\s+\d+$/i.test(clean(a.textContent))&&a.getAttribute('rel')!=='next')continue;
   const next=new URL(a.getAttribute('href'),url);
   if(next.origin!==current.origin||next.pathname!==current.pathname)continue;
   if(Number(next.searchParams.get('count'))<=offset)continue;
   const parameter=(u,k)=>u.searchParams.get(k)??(k==='myteam'?'0':null);
   if(['status','stat1','pos','eteam','fteam','myteam','sort','sdir'].some(k=>parameter(next,k)!==parameter(current,k)))continue;
   next.hash='nba-helper-collect';return next.href;
  }
  return null;
 }
 function filterChange(doc){
  const wanted=[['statusselect','All Players'],['eteamselect','All Teams'],['fteamselect','No Team Selected'],['statselect','Remaining Games (proj)']];
  for(const [id,label] of wanted){const el=doc.getElementById(id);if(!el)return {error:'Yahoo 선수 필터를 찾지 못했습니다: '+id};const opt=Array.from(el.options).find(o=>clean(o.textContent)===label);if(!opt)return {error:'Yahoo 통계 선택지가 없습니다: '+label};if(el.value!==opt.value)return {element:el,value:opt.value};}
  const position=doc.querySelector('input[name="pos"][value="P"]');
  if(position&&!position.checked)return {radio:position};
  const mine=doc.querySelector('input[name="myteam"]');if(mine?.checked)return {radio:mine};
  const search=doc.querySelector('input[type="search"]');
  if(search?.value)return {error:'자동 수집 탭의 선수 검색어를 비워주세요.'};
  return {ready:true};
 }
 root.NBACollector={nextPage,filterChange};if(typeof module!=='undefined')module.exports=root.NBACollector;
})(globalThis);
