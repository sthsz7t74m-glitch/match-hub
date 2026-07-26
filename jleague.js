const {leagues,clubs}=SportsHubJLeague;
const favoriteKey='sportsHubFavoriteJClub';
let activeLeague='j1';
let query='';
let liveData=null;
const tabs=document.querySelector('#leagueTabs');
const grid=document.querySelector('#clubGrid');
const search=document.querySelector('#clubSearch');
const count=document.querySelector('#clubCount');
const matchesNode=document.querySelector('#jleagueMatches');
const standingsNode=document.querySelector('#jleagueStandings');
const matchCountNode=document.querySelector('#matchCount');
const updatedNode=document.querySelector('#jUpdated');
const favorite=()=>SportsHub.storage.get(favoriteKey);
const openDetail=id=>{location.href=`./jleague-detail.html?club=${encodeURIComponent(id)}`;};

const teamNames={
  '21361':'京都サンガF.C.','7477':'ヴィッセル神戸','19001':'V・ファーレン長崎','7114':'サンフレッチェ広島',
  '7116':'横浜F・マリノス','22167':'FC町田ゼルビア','7111':'ジェフユナイテッド千葉','3385':'浦和レッズ',
  '3384':'FC東京','7115':'鹿島アントラーズ','7109':'セレッソ大阪','7102':'ガンバ大阪','7107':'アビスパ福岡',
  '22522':'ファジアーノ岡山','7108':'名古屋グランパス','7104':'清水エスパルス','7112':'川崎フロンターレ',
  '7476':'柏レイソル','3393':'東京ヴェルディ','131701':'水戸ホーリーホック'
};

function displayTeamName(team){
  return teamNames[String(team?.id)]||team?.shortName||team?.name||'未定';
}

function normalizeName(value=''){
  return String(value).toLowerCase()
    .replace(/f\.c\.|fc/g,'')
    .replace(/[・･\.．\-ー\s]/g,'')
    .replace(/ユナイテッド/g,'')
    .replace(/1969/g,'')
    .replace(/fmarinos|fマリノス/g,'マリノス')
    .replace(/sanfrecce|sanfreece/g,'サンフレッチェ')
    .replace(/avispa/g,'アビスパ')
    .replace(/vvaren/g,'vファーレン');
}

function getAllLiveTeams(){
  if(!liveData)return [];
  const candidates=[...(liveData.teams||[])];
  (liveData.matches||[]).forEach(match=>candidates.push(match.home,match.away));
  (liveData.standings||[]).forEach(row=>candidates.push(row.team));
  const unique=new Map();
  candidates.filter(Boolean).forEach(team=>{
    const key=String(team.id||team.uid||team.name||team.shortName||'');
    if(key&&!unique.has(key))unique.set(key,team);
  });
  return [...unique.values()];
}

function findLiveTeam(club){
  const target=normalizeName(club.name);
  const teams=getAllLiveTeams();
  const sameLeague=teams.filter(team=>!team.league||team.league===club.league);
  const pool=sameLeague.length?sameLeague:teams;
  return pool.find(team=>[
    team.name,team.shortName,team.displayName,displayTeamName(team)
  ].filter(Boolean).some(name=>{
    const normalized=normalizeName(name);
    return normalized===target||normalized.includes(target)||target.includes(normalized);
  }))||teams.find(team=>[
    team.name,team.shortName,team.displayName,displayTeamName(team)
  ].filter(Boolean).some(name=>normalizeName(name)===target));
}

function renderTabs(){
  tabs.innerHTML=leagues.map(([id,label])=>`<button class="chip${activeLeague===id?' active':''}" type="button" data-league="${id}">${label}</button>`).join('');
}

function renderClubs(){
  const normalized=query.trim().toLowerCase();
  const current=favorite();
  const visible=clubs.filter(club=>club.league===activeLeague&&(!normalized||club.name.toLowerCase().includes(normalized)||club.area.includes(query.trim())));
  count.textContent=`${visible.length}クラブ`;
  grid.innerHTML=visible.map(club=>{
    const live=findLiveTeam(club);
    const emblem=live?.logo
      ?`<span class="club-badge"><img class="club-emblem" src="${live.logo}" alt="${club.name}のエンブレム" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span class="club-mark-fallback" hidden>${club.mark}</span></span>`
      :`<span class="club-badge"><span class="club-mark-fallback">${club.mark}</span></span>`;
    return `<article class="club-card${current===club.id?' selected':''}">${emblem}<button class="club-copy" type="button" data-open-club="${club.id}"><strong>${club.name}</strong><small>${club.area}・${club.league.toUpperCase()}</small></button><button class="club-favorite" type="button" data-favorite-club="${club.id}" aria-label="${club.name}をお気に入り登録">${current===club.id?'★':'☆'}</button></article>`;
  }).join('')||'<div class="empty-state"><strong>該当するクラブがありません</strong><p>検索条件を変えてみてください。</p></div>';
}

function teamCell(team){
  return `<span class="j-team">${team?.logo?`<img src="${team.logo}" alt="" loading="lazy" onerror="this.hidden=true">`:''}<strong>${displayTeamName(team)}</strong></span>`;
}

function formatStage(match){
  if(match.matchday)return `第${match.matchday}節`;
  const labels={'regular-season':'リーグ戦','championship':'優勝決定戦','placement-playoffs':'順位決定戦','2026-j1-100-year-vision-league':'百年構想リーグ'};
  return labels[match.stage]||match.round||'';
}

function matchCard(match){
  const date=new Date(match.date);
  const done=match.status==='FINISHED';
  const live=['IN_PLAY','PAUSED','LIVE'].includes(match.status);
  const score=done||live?`${match.score?.home??'-'} - ${match.score?.away??'-'}`:'未開始';
  const time=done?'試合終了':live?'LIVE':date.toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'});
  return `<article class="j-match-card"><div class="j-match-meta"><span>${date.toLocaleDateString('ja-JP',{month:'numeric',day:'numeric',weekday:'short'})} ${time}</span><span>${formatStage(match)}</span></div><div class="j-match-teams">${teamCell(match.home)}<strong class="j-match-score">${score}</strong>${teamCell(match.away)}</div>${match.venue?`<small class="j-match-venue muted">${match.venue}</small>`:''}</article>`;
}

function renderMatches(data){
  const now=Date.now();
  const sorted=(data.matches||[]).filter(match=>(match.league||'j1')===activeLeague).sort((a,b)=>new Date(a.date)-new Date(b.date));
  const finished=sorted.filter(match=>match.status==='FINISHED'&&new Date(match.date).getTime()<=now).slice(-4);
  const upcoming=sorted.filter(match=>match.status!=='FINISHED'&&new Date(match.date).getTime()>=now).slice(0,8);
  const sections=[];
  if(finished.length)sections.push(`<div class="j-match-section"><p class="eyebrow">直近結果</p><div class="j-match-cards">${finished.map(matchCard).join('')}</div></div>`);
  if(upcoming.length)sections.push(`<div class="j-match-section"><p class="eyebrow">今後の日程</p><div class="j-match-cards">${upcoming.map(matchCard).join('')}</div></div>`);
  matchCountNode.textContent=`${finished.length+upcoming.length}試合`;
  matchesNode.innerHTML=sections.join('')||'<div class="empty-state"><strong>表示できる試合がありません</strong><p>次回更新後に自動表示されます。</p></div>';
}

function renderStandings(data){
  const rows=(data.standings||[]).filter(row=>(row.league||'j1')===activeLeague).sort((a,b)=>(a.rank??999)-(b.rank??999));
  standingsNode.innerHTML=rows.map(row=>{
    const played=row.played??row.gamesPlayed??'-';
    const points=row.points??'-';
    const diff=row.goalsDiff??row.goalDifference??0;
    return `<div class="j-standing-row"><strong>${row.rank??'-'}</strong><span class="j-standing-team">${row.team?.logo?`<img src="${row.team.logo}" alt="" loading="lazy" onerror="this.hidden=true">`:''}${displayTeamName(row.team)}</span><span>${played}試合</span><b>${points}</b><small>${Number(diff)>0?'+':''}${diff}</small></div>`;
  }).join('')||'<div class="empty-state"><strong>順位データがありません</strong><p>データ取得後に表示されます。</p></div>';
}

function renderLiveSections(){
  if(!liveData)return;
  renderClubs();
  renderMatches(liveData);
  renderStandings(liveData);
}

async function loadLiveData(){
  try{
    const response=await fetch(`./data/jleague.json?v=${Date.now()}`,{cache:'no-store'});
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    liveData=await response.json();
    const updated=new Date(liveData.updatedAt);
    updatedNode.textContent=`最終更新 ${updated.toLocaleString('ja-JP',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}・${liveData.dataSource||'公開データ'}`;
    renderLiveSections();
  }catch(error){
    updatedNode.textContent='実データの初回取得を待っています';
    matchCountNode.textContent='未取得';
    matchesNode.innerHTML='<div class="empty-state"><strong>Jリーグデータを準備中</strong><p>GitHub Actionsの初回取得後、自動で表示されます。</p></div>';
    standingsNode.innerHTML='<div class="empty-state"><strong>順位データを準備中</strong><p>データ取得後に自動表示されます。</p></div>';
    console.warn('J League data unavailable',error);
  }
}

tabs.addEventListener('click',event=>{const button=event.target.closest('[data-league]');if(!button)return;activeLeague=button.dataset.league;renderTabs();renderLiveSections();if(!liveData)renderClubs();});
grid.addEventListener('click',event=>{const favoriteButton=event.target.closest('[data-favorite-club]');if(favoriteButton){const club=SportsHubJLeague.find(favoriteButton.dataset.favoriteClub);if(favorite()===club.id){SportsHub.storage.remove(favoriteKey);SportsHub.toast('お気に入りを解除しました');}else{SportsHub.storage.set(favoriteKey,club.id);SportsHub.toast(`${club.name}をお気に入りに登録しました`);}renderClubs();return;}const openButton=event.target.closest('[data-open-club]');if(openButton)openDetail(openButton.dataset.openClub);});
search.addEventListener('input',()=>{query=search.value;renderClubs();});
SportsHub.applyTheme();
renderTabs();
renderClubs();
loadLiveData();