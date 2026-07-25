let standingsModeV100='all';
let transferScopeV100='all';
let transferDirectionV100='all';

function toastV100(message){
  let node=document.querySelector('#appToastV100');
  if(!node){node=document.createElement('div');node.id='appToastV100';node.className='app-toast';document.body.appendChild(node);}
  node.textContent=message;node.classList.add('show');clearTimeout(toastV100.timer);toastV100.timer=setTimeout(()=>node.classList.remove('show'),1800);
}

function primaryNamesV100(){const t=getTeam(state.primary);return [t?.name,t?.shortName,t?.nameJa,teamName(t)].filter(Boolean).map(x=>String(x).toLowerCase());}
function itemTextV100(item){return `${item.player||''} ${item.from||''} ${item.to||''} ${item.titleJa||''} ${item.originalTitle||''}`.toLowerCase();}
function isPrimaryTransferV100(item){const text=itemTextV100(item);return primaryNamesV100().some(name=>name.length>2&&text.includes(name));}
function transferDirectionMatchV100(item){
  if(transferDirectionV100==='all')return true;
  const names=(state.favorites||[]).map(getTeam).filter(Boolean).flatMap(t=>[t.name,t.shortName,t.nameJa,teamName(t)]).filter(Boolean).map(x=>String(x).toLowerCase());
  const field=String(transferDirectionV100==='in'?item.to||'':item.from||'').toLowerCase();
  return names.some(name=>name.length>2&&field.includes(name));
}

const baseMatchesFilterV100=typeof matchesFilter==='function'?matchesFilter:()=>true;
matchesFilter=function(item){
  if(!baseMatchesFilterV100(item))return false;
  if(transferScopeV100==='favorites'){
    const favs=typeof favoriteText==='function'?favoriteText():'';
    if(!(typeof relevance==='function'&&relevance(item,favs)))return false;
  }
  if(transferScopeV100==='primary'&&!isPrimaryTransferV100(item))return false;
  return transferDirectionMatchV100(item);
};

function ensureTransferToolsV100(){
  const view=document.querySelector('#transfersView'),list=document.querySelector('#transferList');if(!view||!list)return;
  let tools=view.querySelector('#transferToolsV100');
  if(!tools){tools=document.createElement('div');tools.id='transferToolsV100';tools.className='transfer-tools-v100';list.before(tools);}
  tools.innerHTML=`<div class="chips"><button class="chip ${transferScopeV100==='all'?'active':''}" data-transfer-scope="all">全クラブ</button><button class="chip ${transferScopeV100==='favorites'?'active':''}" data-transfer-scope="favorites">お気に入り関連</button><button class="chip ${transferScopeV100==='primary'?'active':''}" data-transfer-scope="primary">最推しのみ</button></div><div class="chips"><button class="chip ${transferDirectionV100==='all'?'active':''}" data-transfer-direction="all">加入・放出</button><button class="chip ${transferDirectionV100==='in'?'active':''}" data-transfer-direction="in">加入</button><button class="chip ${transferDirectionV100==='out'?'active':''}" data-transfer-direction="out">放出</button></div>`;
}

const baseRenderTransfersV100=typeof renderTransfers==='function'?renderTransfers:null;
if(baseRenderTransfersV100){renderTransfers=function(){ensureTransferToolsV100();baseRenderTransfersV100();document.querySelectorAll('.transfer-card').forEach((card,i)=>{if(i<3)card.classList.add('is-new');});};}

function recentSummaryV100(){
  const root=document.querySelector('#favoriteHero');if(!root||!state.primary)return;
  root.querySelector('.form-summary-v100')?.remove();
  const list=fixturesFor(state.primary).filter(isFinished).slice(-5).reverse();if(!list.length)return;
  let points=0,gf=0,ga=0;const forms=[];
  list.forEach(f=>{const home=f.home.id===state.primary,own=Number(home?f.goals.home:f.goals.away)||0,opp=Number(home?f.goals.away:f.goals.home)||0;gf+=own;ga+=opp;if(own>opp){points+=3;forms.push('○');}else if(own===opp){points+=1;forms.push('△');}else forms.push('●');});
  let streak=0,streakType='';for(const mark of forms){const type=mark==='○'?'連勝':mark==='●'?'連敗':'';if(!type||streakType&&streakType!==type)break;streakType=type;streak++;}
  const div=document.createElement('div');div.className='form-summary-v100';div.innerHTML=`<div><span>直近5試合</span><strong class="form-marks">${forms.join(' ')}</strong></div><div class="form-stats"><span>勝点 <b>${points}</b></span><span>得失点 <b>${gf-ga>0?'+':''}${gf-ga}</b></span>${streak>=2?`<span class="streak">${streak}${streakType}</span>`:''}</div>`;
  const details=root.querySelector('.recent-details');if(details)details.before(div);else root.appendChild(div);
}
const baseRenderHeroV100=renderHero;
renderHero=function(){baseRenderHeroV100();recentSummaryV100();};

const baseMatchCardV100=matchCard;
matchCard=function(f,opt={}){
  let html=baseMatchCardV100(f,opt);
  html=html.replace('<div class="side home">',`<div class="side home team-link" data-card-team="${f.home.id}">`).replace('<div class="side away">',`<div class="side away team-link" data-card-team="${f.away.id}">`);
  if(f.home.id===state.primary||f.away.id===state.primary)html=html.replace('class="match-card ','class="match-card primary-match-v100 ');
  return html;
};

function ensureStandingsToolsV100(){
  const tabs=document.querySelector('#standingsTabs');if(!tabs)return;
  let tools=document.querySelector('#standingsToolsV100');if(!tools){tools=document.createElement('div');tools.id='standingsToolsV100';tools.className='chips standings-tools-v100';tabs.after(tools);}
  tools.innerHTML=['all','favorites','europe','relegation'].map(mode=>`<button class="chip ${standingsModeV100===mode?'active':''}" data-standings-mode="${mode}">${{all:'全順位',favorites:'お気に入り',europe:'欧州圏',relegation:'降格圏'}[mode]}</button>`).join('');
}
function renderStandingsV100(){
  const leagues=[...new Set((state.data?.standings||[]).map(s=>s.leagueId))];if(state.league===null&&leagues.length)state.league=leagues[0];
  document.querySelector('#standingsTabs').innerHTML=leagues.map(id=>`<button class="chip ${state.league===id?'active':''}" data-standing-league="${id}">${leagueNames[id]||id}</button>`).join('');ensureStandingsToolsV100();
  const table=document.querySelector('#standingsTable');if(!leagueStarted(state.league)){const opening=getOpeningMatch(state.league);table.innerHTML=`<div class="preseason-empty"><strong>シーズン開幕前</strong><span>${opening?`開幕予定 ${new Date(opening.date).toLocaleDateString('ja-JP',{month:'numeric',day:'numeric',weekday:'short'})}`:'開幕日未定'}</span><p>順位表はリーグ戦開始後に表示されます。</p></div>`;return;}
  let rows=state.data.standings.find(s=>s.leagueId===state.league)?.rows||[];const total=rows.length;
  if(standingsModeV100==='favorites')rows=rows.filter(r=>state.favorites.includes(r.team.id));
  if(standingsModeV100==='europe')rows=rows.filter(r=>r.rank<=6);
  if(standingsModeV100==='relegation')rows=rows.filter(r=>r.rank>total-3);
  table.innerHTML=rows.length?`<table><thead><tr><th>順位</th><th>変動</th><th>クラブ</th><th>試</th><th>差</th><th>点</th></tr></thead><tbody>${rows.map(r=>`<tr class="${state.favorites.includes(r.team.id)?'favorite-row ':''}${r.rank<=4?'zone-cl ':r.rank<=6?'zone-el ':r.rank>total-3?'zone-drop ':''}" data-open-team="${r.team.id}"><td>${r.rank}</td><td>${rankMove(r.team.id,r.rank)}</td><td><div class="standing-team"><img src="${r.team.logo}" alt="">${teamName(r.team)}</div></td><td>${r.played}</td><td>${r.goalsDiff>0?'+':''}${r.goalsDiff}</td><td><strong>${r.points}</strong></td></tr>`).join('')}</tbody></table><div class="zone-legend"><span class="cl">CL圏</span><span class="el">EL圏</span><span class="drop">降格圏</span></div>`:'<div class="empty-action"><strong>該当するクラブがありません</strong><button data-standings-mode="all" class="text-button">全順位を表示</button></div>';
}
renderStandings=renderStandingsV100;

const baseRenderCalendarV100=renderCalendar;
renderCalendar=function(){
  baseRenderCalendarV100();if(!state.data)return;
  const map={};for(const f of state.data.fixtures||[]){if(!(state.favorites.includes(f.home.id)||state.favorites.includes(f.away.id)))continue;(map[dayKey(f.date)]??=[]).push(f);}
  document.querySelectorAll('[data-calendar-day]').forEach(button=>{const list=map[button.dataset.calendarDay]||[];if(!list.length)return;const primary=list.some(f=>f.home.id===state.primary||f.away.id===state.primary);if(primary)button.classList.add('primary-day');const color=leagueColors[list[0].leagueId];if(color)button.style.setProperty('--day-color',color);});
};

const baseRenderGlobalSearchV100=renderGlobalSearch;
renderGlobalSearch=function(){
  const input=document.querySelector('#globalTeamSearch'),q=(input?.value||'').trim().toLowerCase();let teams=(state.data?.teams||[]).filter(t=>(state.searchLeague===null||t.leagueId===state.searchLeague)&&matchesQuery(t,q));if(typeof favoritesOnlyV080!=='undefined'&&favoritesOnlyV080)teams=teams.filter(t=>state.favorites.includes(t.id));teams.sort((a,b)=>Number(state.favorites.includes(b.id))-Number(state.favorites.includes(a.id))||teamName(a).localeCompare(teamName(b),'ja'));
  const count=document.querySelector('#globalSearchCount');if(count)count.textContent=`${teams.length}クラブ`;
  const list=document.querySelector('#globalTeamResults');if(!list)return;
  list.innerHTML=teams.map(t=>{const favorite=state.favorites.includes(t.id),main=state.primary===t.id;return `<article class="picker-card-v100 ${favorite?'selected':''}"><div class="picker-team-v100"><img src="${t.logo}" alt=""><span><strong>${teamName(t)}</strong><small class="english-name">${t.name}</small></span></div><div class="picker-actions-v100"><button type="button" data-team="${t.id}" data-primary="false" class="${favorite?'remove':'add'}">${favorite?'✓ 追加済み':'＋ 追加'}</button><button type="button" data-primary-id="${t.id}" class="primary-choice ${main?'active':''}">${main?'★ 最推し':'☆ 最推しにする'}</button></div></article>`;}).join('')||'<div class="empty-action"><strong>チームが見つかりません</strong><button class="text-button" data-clear-search-v100>検索をクリア</button></div>';
};

function enhanceEmptyStatesV100(){
  const schedule=document.querySelector('#scheduleList');if(schedule?.querySelector(':scope > .empty'))schedule.innerHTML=`<div class="empty-action"><strong>この期間の試合はありません</strong><span>期間を広げるか、お気に入りを追加してみよう</span><div><button class="text-button" data-empty-month-v100>今月を見る</button><button class="text-button" data-view="search">クラブを追加</button></div></div>`;
  const favorites=document.querySelector('#favoriteTeams');if(favorites?.querySelector(':scope > .empty'))favorites.innerHTML=`<div class="empty-action"><strong>ほかのお気に入りはまだありません</strong><button class="text-button" data-view="search">クラブを追加</button></div>`;
}
const baseRenderV100=render;
render=function(){baseRenderV100();enhanceEmptyStatesV100();};

const baseLoadDataV100=loadData;
loadData=async function(force=false){
  document.documentElement.classList.add('is-loading-v100');const status=document.querySelector('#updateStatus');if(status&&force)status.textContent='最新データを更新中…';
  await baseLoadDataV100(force);document.documentElement.classList.remove('is-loading-v100');
  if(status?.textContent.includes('できませんでした'))status.innerHTML='データを取得できませんでした <button class="text-button" data-retry-v100>再試行</button>';
};

document.addEventListener('click',event=>{
  const side=event.target.closest('[data-card-team]');if(side){event.preventDefault();event.stopImmediatePropagation();openTeamDetail(Number(side.dataset.cardTeam));return;}
  const standings=event.target.closest('[data-standings-mode]');if(standings){standingsModeV100=standings.dataset.standingsMode;renderStandingsV100();return;}
  const scope=event.target.closest('[data-transfer-scope]');if(scope){transferScopeV100=scope.dataset.transferScope;renderTransfers();return;}
  const direction=event.target.closest('[data-transfer-direction]');if(direction){transferDirectionV100=direction.dataset.transferDirection;renderTransfers();return;}
  if(event.target.closest('[data-clear-search-v100]')){const input=document.querySelector('#globalTeamSearch');if(input)input.value='';renderGlobalSearch();return;}
  if(event.target.closest('[data-empty-month-v100]')){state.range='month';document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x.dataset.range==='month'));renderSchedule();return;}
  if(event.target.closest('[data-retry-v100]')){loadData(true);return;}
  const add=event.target.closest('.picker-card-v100 [data-team]');if(add){const id=Number(add.dataset.team);setTimeout(()=>toastV100(state.favorites.includes(id)?`${teamName(getTeam(id))}を追加しました`:`${teamName(getTeam(id))}を解除しました`),0);}
  const primary=event.target.closest('.picker-card-v100 [data-primary-id]');if(primary)setTimeout(()=>toastV100(`${teamName(getTeam(Number(primary.dataset.primaryId)))}を最推しに設定しました`),0);
},true);

queueMicrotask(()=>{if(state.data){render();renderTransfers();}});
