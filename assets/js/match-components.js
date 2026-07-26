window.SportsHubComponents=window.SportsHubComponents||{};

(function(components){
  const escapeHtml=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));

  function statusLabel(match){
    const status=String(match.status||'').toLowerCase();
    if(['finished','final'].includes(status))return '試合終了';
    if(['in_play','in-play','live','paused'].includes(status))return 'LIVE';
    return match.timeLabel||'';
  }

  function decisionLabel(match){
    if(match.decisionLabel)return match.decisionLabel;
    const homePens=match.penalties?.home;
    const awayPens=match.penalties?.away;
    if(Number.isFinite(homePens)&&Number.isFinite(awayPens))return `PK ${homePens}-${awayPens}`;
    if(match.decision==='penalties')return 'PK戦決着';
    if(match.decision==='extra_time')return '延長戦決着';
    if(match.status==='finished'||match.status==='FINISHED')return '通常決着';
    return '';
  }

  function teamMarkup(team={},side='home'){
    const badge=team.logo
      ? `<img class="match-card__badge" src="${escapeHtml(team.logo)}" alt="" loading="lazy" onerror="this.hidden=true">`
      : `<span class="match-card__fallback" aria-hidden="true">${escapeHtml(team.badge||team.flag||'⚽')}</span>`;
    return `<span class="match-card__team match-card__team--${side}">${badge}<strong>${escapeHtml(team.name||'未定')}</strong></span>`;
  }

  components.matchCard=function matchCard(options={}){
    const match=options.match||{};
    const date=new Date(options.date||match.kickoff||match.date);
    const validDate=!Number.isNaN(date.getTime());
    const dateText=options.dateText||(validDate?date.toLocaleDateString('ja-JP',{month:'numeric',day:'numeric',weekday:'short'}):'日時未定');
    const timeText=options.timeText||statusLabel(match)||(validDate?date.toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'}):'');
    const score=options.scoreText??match.scoreText??'VS';
    const decision=decisionLabel(match);
    const competition=options.competition||match.competition||'';
    const stage=options.stage||match.round||match.stage||'';
    const venue=options.venue||match.venue||'';
    return `<article class="match-card${decision.includes('PK')?' match-card--penalties':''}">
      <div class="match-card__meta"><span>${escapeHtml([dateText,timeText].filter(Boolean).join(' '))}</span><span>${escapeHtml(competition||stage)}</span></div>
      <div class="match-card__body">${teamMarkup(options.home||match.home,'home')}<div class="match-card__score"><strong>${escapeHtml(score)}</strong>${decision?`<small class="match-card__decision">${escapeHtml(decision)}</small>`:''}</div>${teamMarkup(options.away||match.away,'away')}</div>
      ${(stage||venue)?`<div class="match-card__footer">${stage?`<span>${escapeHtml(stage)}</span>`:''}${venue?`<span>${escapeHtml(venue)}</span>`:''}</div>`:''}
    </article>`;
  };
})(window.SportsHubComponents);
