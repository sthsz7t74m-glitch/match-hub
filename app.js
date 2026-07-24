const state={data:null,favorites:JSON.parse(localStorage.getItem('matchHubFavorites')||'[]'),primary:Number(localStorage.getItem('matchHubPrimary')||0),range:'week',view:'home',league:null,searchLeague:null};
const $=s=>document.querySelector(s);const $$=s=>[...document.querySelectorAll(s)];
const leagueNames={39:'プレミアリーグ',140:'ラ・リーガ',135:'セリエA',78:'ブンデスリーガ',61:'リーグ・アン'};
const japaneseTeams={"Arsenal FC":"アーセナル","Liverpool FC":"リヴァプール","Manchester City FC":"マンチェスター・シティ","Manchester United FC":"マンチェスター・ユナイテッド","Chelsea FC":"チェルシー","Tottenham Hotspur FC":"トッテナム","FC Barcelona":"バルセロナ","Real Madrid CF":"レアル・マドリード","Club Atlético de Madrid":"アトレティコ・マドリード","FC Internazionale Milano":"インテル","AC Milan":"ACミラン","Juventus FC":"ユヴェントス","FC Bayern München":"バイエルン・ミュンヘン","Borussia Dortmund":"ドルトムント","Paris Saint-Germain FC":"パリ・サンジェルマン","Olympique de Marseille":"マルセイユ"};
const teamName=t=>japaneseTeams[t?.name]||t?.shortName||t?.name||'未定';
const save=()=>{localStorage.setItem('matchHubFavorites',JSON.stringify(state.favorites));localStorage.setItem('matchHubPrimary',String(state.primary||0));};
const isLive=f=>['IN_PLAY','PAUSED'].includes(f.status);const isFinished=f=>f.status==='FINISHED';

async function loadData(force=false){
  $('#updateStatus').textContent='データを取得中…';
  try{
    const r=await fetch(`./data/football.json?${force?Date.now():''}`,{cache:force?'no-store':'default'});
    if(!r.ok)throw new Error('data');
    const json=await r.json();if(!json||!Array.isArray(json.teams))throw new Error('empty');
    state.data=json;
    state.favorites=state.favorites.filter(id=>json.teams.some(t=>t.id===id));
    if(state.primary&&!json.teams.some(t=>t.id===state.primary))state.primary=0;
    save();render();
    const d=new Date(json.updatedAt);$('#updateStatus').textContent=`最終更新 ${d.toLocaleString('ja-JP',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}`;
  }catch(e){
    $('#updateStatus').textContent='データを取得できませんでした';
    state.data={updatedAt:new Date().toISOString(),teams:[],fixtures:[],standings:[]};render();
  }
}

function render(){
  if(!state.data)return;
  const hasPrimary=state.primary&&state.data.teams.some(t=>t.id===state.primary);
  $('#onboarding').classList.toggle('hidden',hasPrimary);
  $('#homeView').classList.toggle('hidden',!hasPrimary||state.view!=='home');
  $('#standingsView').classList.toggle('hidden',state.view!=='standings');
  $('#searchView').classList.toggle('hidden',state.view!=='search');
  $('#settingsView').classList.toggle('hidden',state.view!=='settings');
  renderPicker();renderSearchFilters();
  if(hasPrimary){renderHero();renderFavorites();renderSchedule();}
  renderStandings();renderGlobalSearch();
  $('#favoriteCount').textContent=`${state.favorites.length}クラブ登録中`;
}

function leagueButtons(selected,attr){
  const leagues=[...new Set(state.data.teams.map(t=>t.leagueId))];
  return [`<button class="chip ${selected===null?'active':''}" ${attr}="all">すべて</button>`,...leagues.map(id=>`<button class="chip ${selected===id?'active':''}" ${attr}="${id}">${leagueNames[id]||id}</button>`)].join('');
}
function renderPicker(){
  $('#leagueFilters').innerHTML=leagueButtons(state.league,'data-league');
  const q=($('#teamSearch').value||'').trim().toLowerCase();
  const teams=state.data.teams.filter(t=>(state.league===null||t.leagueId===state.league)&&matchesQuery(t,q));
  $('#teamPicker').innerHTML=teams.map(t=>pickerCard(t,true)).join('')||'<p class="empty">チームが見つかりません</p>';
}
function renderSearchFilters(){$('#globalLeagueFilters').innerHTML=leagueButtons(state.searchLeague,'data-search-league');}
function matchesQuery(t,q){return !q||t.name.toLowerCase().includes(q)||teamName(t).toLowerCase().includes(q)||(t.tla||'').toLowerCase().includes(q)}
function pickerCard(t,primary=false){
  const favorite=state.favorites.includes(t.id),main=state.primary===t.id;
  return `<button class="picker-card ${favorite?'selected':''}" data-team="${t.id}" data-primary="${primary}"><img src="${t.logo}" alt=""><span><strong>${teamName(t)}</strong><br><small>${t.name}</small></span><b class="picker-mark">${main?'★':favorite?'✓':'＋'}</b></button>`;
}

function renderHero(){
  const t=getTeam(state.primary);if(!t)return;
  const all=fixturesFor(t.id),next=all.filter(f=>new Date(f.date)>new Date()&&!isFinished(f)).slice(0,3),recent=all.filter(isFinished).slice(-5).reverse();
  const rank=getRank(t.id),nextMatch=next[0];document.documentElement.style.setProperty('--accent',t.color||'#e11d48');
  $('#favoriteHero').innerHTML=`<div class="hero-team"><img class="team-logo hero-logo" src="${t.logo}" alt=""><div class="hero-copy"><p class="eyebrow">MY FAVORITE</p><h2>${teamName(t)}</h2><p class="english-name">${t.name}</p><div class="hero-badges"><span class="rank">${rank?rank+'位':'開幕前'}</span><span class="league-badge">${leagueNames[t.leagueId]||''}</span></div></div></div>${nextMatch?`<div class="countdown"><span>次戦まで</span><strong data-countdown="${nextMatch.date}">${countdownText(nextMatch.date)}</strong></div>`:''}<div class="stack hero-matches">${next.map(matchCard).join('')||'<p class="empty">次の試合は未定です</p>'}</div><div class="recent-form"><span>直近5試合</span><div>${recent.length?recent.map(f=>formDot(f,t.id)).join(''):'<small class="muted">結果なし</small>'}</div></div>`;
}
function formDot(f,id){const h=f.home.id===id,own=h?f.goals.home:f.goals.away,opp=h?f.goals.away:f.goals.home;const result=own>opp?'win':own<opp?'loss':'draw';return `<span class="form-dot ${result}" title="${teamName(h?f.away:f.home)} ${own}-${opp}">${result==='win'?'勝':result==='loss'?'負':'分'}</span>`}
function countdownText(date){const diff=new Date(date)-new Date();if(diff<=0)return'まもなく開始';const d=Math.floor(diff/86400000),h=Math.floor(diff%86400000/3600000),m=Math.floor(diff%3600000/60000);return d>0?`${d}日 ${h}時間`:`${h}時間 ${m}分`}

function renderFavorites(){
  const ids=state.favorites.filter(id=>id!==state.primary);
  $('#favoriteTeams').innerHTML=ids.map(id=>{const t=getTeam(id);if(!t)return'';const next=fixturesFor(id).find(f=>new Date(f.date)>new Date()&&!isFinished(f));return `<article class="team-card"><div class="team-row"><img class="team-logo" src="${t.logo}" alt=""><div class="team-meta"><div class="team-name">${teamName(t)} <span class="inline-rank">${getRank(id)?getRank(id)+'位':'開幕前'}</span></div><div class="english-name">${t.name}</div></div><div class="team-actions"><button class="mini-button" data-primary-id="${id}">★ 最推し</button><button class="mini-button danger" data-remove-id="${id}">解除</button></div></div>${next?matchCard(next):'<p class="empty compact-empty">次戦未定</p>'}</article>`}).join('')||'<p class="empty">ほかのお気に入りはまだありません</p>';
}
function renderSchedule(){
  const now=new Date();
  let end;
  if(state.range==='today')end=new Date(now.getFullYear(),now.getMonth(),now.getDate(),23,59,59,999);
  if(state.range==='week'){end=new Date(now);end.setDate(now.getDate()+7);}
  if(state.range==='month')end=new Date(now.getFullYear(),now.getMonth()+1,0,23,59,59,999);
  let list=state.data.fixtures.filter(f=>(state.favorites.includes(f.home.id)||state.favorites.includes(f.away.id))&&new Date(f.date)>=new Date(now.getTime()-8*3600000)&&new Date(f.date)<=end);
  list.sort((a,b)=>statusOrder(a)-statusOrder(b)||new Date(a.date)-new Date(b.date));
  $('#scheduleList').innerHTML=list.map(matchCard).join('')||'<p class="empty">この期間の試合はありません</p>';
}
function statusOrder(f){if(isLive(f))return 0;if(f.home.id===state.primary||f.away.id===state.primary)return 1;return 2;}
function matchCard(f){
  const date=new Date(f.date),finished=isFinished(f),live=isLive(f),postponed=['POSTPONED','SUSPENDED','CANCELLED'].includes(f.status);
  const center=live?`${f.goals.home??0} - ${f.goals.away??0}`:finished?'結果を見る':postponed?'延期':'VS';
  return `<article class="match-card ${live?'live':''} ${postponed?'postponed':''}" data-fixture="${f.id}"><div class="match-top"><span class="competition">${f.competitionJa||f.competition}</span><span class="match-meta">${date.toLocaleString('ja-JP',{month:'numeric',day:'numeric',weekday:'short',hour:'2-digit',minute:'2-digit'})}</span></div><div class="teams-line"><div class="club"><img src="${f.home.logo}" alt=""><span>${teamName(f.home)}</span></div><div class="versus">${center}${live?'<small>LIVE</small>':''}</div><div class="club"><img src="${f.away.logo}" alt=""><span>${teamName(f.away)}</span></div></div></article>`;
}

function renderStandings(){
  const leagues=[...new Set(state.data.standings.map(s=>s.leagueId))];if(state.league===null&&leagues.length)state.league=leagues[0];
  $('#standingsTabs').innerHTML=leagues.map(id=>`<button class="chip ${state.league===id?'active':''}" data-standing-league="${id}">${leagueNames[id]||id}</button>`).join('');
  const rows=state.data.standings.find(s=>s.leagueId===state.league)?.rows||[];
  $('#standingsTable').innerHTML=rows.length?`<table><thead><tr><th>順位</th><th>クラブ</th><th>試</th><th>差</th><th>点</th></tr></thead><tbody>${rows.map(r=>`<tr class="${state.favorites.includes(r.team.id)?'favorite-row':''}"><td>${r.rank}</td><td><div class="standing-team"><img src="${r.team.logo}" alt="">${teamName(r.team)}</div></td><td>${r.played}</td><td>${r.goalsDiff>0?'+':''}${r.goalsDiff}</td><td><strong>${r.points}</strong></td></tr>`).join('')}</tbody></table>`:'<p class="empty">順位データはまだありません</p>';
}
function renderGlobalSearch(){
  const q=($('#globalTeamSearch').value||'').trim().toLowerCase();
  const teams=state.data.teams.filter(t=>(state.searchLeague===null||t.leagueId===state.searchLeague)&&matchesQuery(t,q));
  $('#globalTeamResults').innerHTML=teams.map(t=>pickerCard(t,false)).join('')||'<p class="empty">チームが見つかりません</p>';
}

function getTeam(id){return state.data.teams.find(t=>t.id===id)}
function fixturesFor(id){return state.data.fixtures.filter(f=>f.home.id===id||f.away.id===id).sort((a,b)=>new Date(a.date)-new Date(b.date))}
function getRank(id){for(const s of state.data.standings){const r=s.rows.find(x=>x.team.id===id);if(r)return r.rank}return null}
function selectTeam(id,asPrimary){if(!state.favorites.includes(id))state.favorites.push(id);if(asPrimary||!state.primary)state.primary=id;save();state.view='home';setActiveNav('home');render();}
function showScore(id){
  const f=state.data.fixtures.find(x=>x.id===id);if(!f)return;const show=isFinished(f)||isLive(f);
  $('#scoreDialogBody').innerHTML=`<p class="eyebrow">${f.competitionJa||f.competition}</p><h2 class="dialog-score">${teamName(f.home)} ${show?`${f.goals.home??'-'} - ${f.goals.away??'-'}`:'vs'} ${teamName(f.away)}</h2><p class="muted">${new Date(f.date).toLocaleString('ja-JP')}<br>${f.round||''}</p>${show?'<p class="score-note">結果・速報データ</p>':'<p class="empty">試合前のためスコアは非表示です</p>'}`;$('#scoreDialog').showModal();
}
function setActiveNav(view){$$('.nav-item').forEach(x=>x.classList.toggle('active',x.dataset.view===view));}

document.addEventListener('click',e=>{
  const team=e.target.closest('[data-team]');if(team){const id=Number(team.dataset.team),asPrimary=team.dataset.primary==='true';if(!asPrimary&&state.favorites.includes(id)){state.favorites=state.favorites.filter(x=>x!==id);if(state.primary===id)state.primary=state.favorites[0]||0;save();render();}else selectTeam(id,asPrimary);}
  const chip=e.target.closest('[data-league]');if(chip){state.league=chip.dataset.league==='all'?null:Number(chip.dataset.league);renderPicker();}
  const searchChip=e.target.closest('[data-search-league]');if(searchChip){state.searchLeague=searchChip.dataset.searchLeague==='all'?null:Number(searchChip.dataset.searchLeague);renderSearchFilters();renderGlobalSearch();}
  const st=e.target.closest('[data-standing-league]');if(st){state.league=Number(st.dataset.standingLeague);renderStandings();}
  const tab=e.target.closest('[data-range]');if(tab){state.range=tab.dataset.range;$$('.tab').forEach(x=>x.classList.toggle('active',x===tab));renderSchedule();}
  const nav=e.target.closest('[data-view]');if(nav){const target=nav.dataset.view;state.view=target==='schedule'?'home':target;setActiveNav(target);render();if(target==='schedule')setTimeout(()=>$('.tabs')?.scrollIntoView({behavior:'smooth',block:'start'}),50);}
  const fixture=e.target.closest('[data-fixture]');if(fixture)showScore(Number(fixture.dataset.fixture));
  const pri=e.target.closest('[data-primary-id]');if(pri){state.primary=Number(pri.dataset.primaryId);save();render();}
  const rem=e.target.closest('[data-remove-id]');if(rem&&confirm('お気に入りから解除しますか？')){state.favorites=state.favorites.filter(id=>id!==Number(rem.dataset.removeId));save();render();}
});

$('#teamSearch').addEventListener('input',renderPicker);$('#globalTeamSearch').addEventListener('input',renderGlobalSearch);$('#refreshButton').addEventListener('click',()=>loadData(true));$('#addTeamButton').addEventListener('click',()=>{state.view='search';setActiveNav('search');render();});$('#closeScoreDialog').addEventListener('click',()=>$('#scoreDialog').close());
$('#resetButton').addEventListener('click',()=>{if(confirm('お気に入りと最推し設定をリセットしますか？')){state.favorites=[];state.primary=0;save();state.view='home';setActiveNav('home');render();}});
function setTheme(dark){document.documentElement.dataset.theme=dark?'dark':'light';$('#darkModeToggle').checked=dark;localStorage.setItem('matchHubTheme',dark?'dark':'light')}
$('#themeButton').addEventListener('click',()=>setTheme(document.documentElement.dataset.theme!=='dark'));$('#darkModeToggle').addEventListener('change',e=>setTheme(e.target.checked));setTheme((localStorage.getItem('matchHubTheme')||'dark')==='dark');
setInterval(()=>{$$('[data-countdown]').forEach(el=>el.textContent=countdownText(el.dataset.countdown))},60000);
if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js');loadData();