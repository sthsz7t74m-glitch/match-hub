(function(){
  const body=document.body;
  const isNational=body.classList.contains('football-hub')&&location.pathname.includes('national');
  const isJLeague=body.classList.contains('football-hub')&&location.pathname.includes('jleague');
  if(!isNational&&!isJLeague)return;
  const normalize=value=>String(value||'').toLowerCase().replace(/f\.c\.|fc/g,'').replace(/[・･\.．\-ー\s]/g,'').replace(/ユナイテッド/g,'').replace(/1969/g,'');
  const dateKey=value=>{const d=new Date(value);return Number.isNaN(d.getTime())?'':`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
  const getStored=key=>{try{const value=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(value)?value:[];}catch{return[];}};
  let payload=null;
  function favoriteMatcher(){
    if(isNational){const ids=new Set(getStored('sportsHubFavoriteNationals'));return match=>ids.has(match.home)||ids.has(match.away);}
    const ids=getStored('sportsHubFavoriteJClubs');
    const names=new Set(ids.map(id=>window.SportsHubJLeague?.find(id)?.name).filter(Boolean).map(normalize));
    return match=>[match.home,match.away].some(team=>{const candidates=[team?.name,team?.shortName,team?.displayName].map(normalize);return candidates.some(name=>[...names].some(target=>name===target||name.includes(target)||target.includes(name)));});
  }
  function markCalendar(){
    if(!payload)return;
    const matcher=favoriteMatcher();
    const matches=isNational?(payload.matches||[]):((payload.matches||[]));
    const favoriteDates=new Map();
    matches.filter(matcher).forEach(match=>{const key=dateKey(match.kickoff||match.date);if(key)favoriteDates.set(key,(favoriteDates.get(key)||0)+1);});
    document.querySelectorAll('#matchCalendar [data-date]').forEach(button=>{
      const count=favoriteDates.get(button.dataset.date)||0;
      button.classList.toggle('calendar-day--favorite',count>0);
      if(count>0)button.title=`推しの試合 ${count}件`;
    });
  }
  const endpoint=isNational?'./data/national-matches.json':'./data/jleague.json';
  fetch(`${endpoint}?v=${Date.now()}`,{cache:'no-store'}).then(r=>r.ok?r.json():Promise.reject(new Error(`HTTP ${r.status}`))).then(data=>{payload=data;markCalendar();const calendar=document.querySelector('#matchCalendar');if(calendar)new MutationObserver(markCalendar).observe(calendar,{childList:true,subtree:true});}).catch(error=>console.warn('Shared football hub enhancement unavailable',error));
  document.querySelector('#pageTabs')?.addEventListener('click',()=>window.scrollTo({top:0,behavior:'smooth'}));
})();
