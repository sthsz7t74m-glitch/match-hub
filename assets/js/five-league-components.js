(function(){
  const components=window.SportsHubComponents;
  if(!components)return;

  let data=null;
  let scheduled=false;
  const fixtureMap=new Map();
  const parseIds=key=>{
    try{return JSON.parse(localStorage.getItem(key)||'[]').map(Number).filter(Boolean);}catch{return [];}
  };
  const teamName=team=>team?.nameJa||team?.shortName||team?.name||'未定';
  const dayKey=value=>{const date=new Date(value);return Number.isNaN(date.getTime())?'':`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;};

  function normalizeFixture(fixture){
    const finished=fixture.status==='FINISHED';
    const live=['IN_PLAY','PAUSED','LIVE'].includes(fixture.status);
    const score=finished||live?`${fixture.goals?.home??'-'} - ${fixture.goals?.away??'-'}`:'VS';
    return {
      id:fixture.id,
      date:fixture.date,
      status:finished?'finished':live?'live':String(fixture.status||'scheduled').toLowerCase(),
      competition:fixture.competitionJa||fixture.competition||'',
      round:fixture.round||'',
      venue:fixture.venue||'',
      scoreText:score,
      decision:fixture.decision||'',
      penalties:fixture.penalties||null,
      home:{name:teamName(fixture.home),logo:fixture.home?.logo||''},
      away:{name:teamName(fixture.away),logo:fixture.away?.logo||''}
    };
  }

  function upgradeMatchCards(){
    if(!data)return;
    document.querySelectorAll('article.match-card[data-fixture]:not([data-shared-match])').forEach(node=>{
      const fixture=fixtureMap.get(String(node.dataset.fixture));
      if(!fixture)return;
      const normalized=normalizeFixture(fixture);
      node.outerHTML=components.matchCard({
        match:normalized,
        date:fixture.date,
        home:normalized.home,
        away:normalized.away,
        scoreText:normalized.scoreText,
        competition:normalized.competition,
        stage:normalized.round,
        venue:normalized.venue,
        className:'five-league-match-card',
        attributes:{'data-fixture':fixture.id,'data-shared-match':'1'}
      });
    });
  }

  function upgradeCalendar(){
    if(!data)return;
    const favorites=new Set(parseIds('matchHubFavorites'));
    const primary=Number(localStorage.getItem('matchHubPrimary')||0);
    document.querySelectorAll('#calendarGrid [data-calendar-day]').forEach(button=>{
      const date=button.dataset.calendarDay;
      const fixtures=(data.fixtures||[]).filter(fixture=>dayKey(fixture.date)===date&&(favorites.has(Number(fixture.home?.id))||favorites.has(Number(fixture.away?.id))));
      const primaryMatch=fixtures.some(fixture=>Number(fixture.home?.id)===primary||Number(fixture.away?.id)===primary);
      const teamIds=[];
      fixtures.forEach(fixture=>{
        [fixture.home,fixture.away].forEach(team=>{if(favorites.has(Number(team?.id))&&!teamIds.includes(Number(team.id)))teamIds.push(Number(team.id));});
      });
      const signature=`${fixtures.length}|${primaryMatch?'1':'0'}|${teamIds.slice(0,3).join(',')}`;
      if(button.dataset.favoriteSignature===signature)return;
      button.dataset.favoriteSignature=signature;
      button.classList.toggle('calendar-day--favorite',fixtures.length>0);
      button.classList.toggle('calendar-day--primary',primaryMatch);
      button.querySelector('.calendar-favorite-marks')?.remove();
      if(!fixtures.length){button.removeAttribute('title');return;}
      const marks=document.createElement('small');
      marks.className='calendar-favorite-marks';
      teamIds.slice(0,3).forEach(id=>{
        const team=(data.teams||[]).find(item=>Number(item.id)===id);
        if(team?.logo){const img=document.createElement('img');img.src=team.logo;img.alt='';marks.appendChild(img);}
        else{const span=document.createElement('span');span.textContent=id===primary?'★':'●';marks.appendChild(span);}
      });
      button.appendChild(marks);
      button.title=primaryMatch?`最推しを含む ${fixtures.length}試合`:`推しクラブの試合 ${fixtures.length}件`;
    });
  }

  function apply(){scheduled=false;upgradeMatchCards();upgradeCalendar();}
  function queueApply(){if(scheduled)return;scheduled=true;requestAnimationFrame(apply);}

  fetch(`./data/football.json?v=${Date.now()}`,{cache:'no-store'})
    .then(response=>{if(!response.ok)throw new Error(`HTTP ${response.status}`);return response.json();})
    .then(payload=>{
      data=payload;
      (data.fixtures||[]).forEach(fixture=>fixtureMap.set(String(fixture.id),fixture));
      queueApply();
      const observer=new MutationObserver(queueApply);
      ['#liveMatches','#favoriteHero','#favoriteTeams','#calendarGrid','#calendarMatches','#scheduleList','#detailMatchList'].forEach(selector=>{
        const node=document.querySelector(selector);if(node)observer.observe(node,{childList:true,subtree:true});
      });
      window.addEventListener('storage',queueApply);
      document.addEventListener('click',event=>{if(event.target.closest('[data-team],[data-primary-id],[data-remove-id],[data-calendar-day],[data-range]'))setTimeout(queueApply,0);});
    })
    .catch(error=>console.warn('Five league shared component adapter unavailable',error));
})();