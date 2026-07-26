const {leagues,clubs}=SportsHubJLeague;
const favoriteKey='sportsHubFavoriteJClub';
let activeLeague='j1';
let query='';
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

function renderTabs(){
  tabs.innerHTML=leagues.map(([id,label])=>`<button class="chip${activeLeague===id?' active':''}" type="button" data-league="${id}">${label}</button>`).join('');
}

function renderClubs(){
  const normalized=query.trim().toLowerCase();
  const current=favorite();
  const visible=clubs.filter(club=>club.league===activeLeague&&(!normalized||club.name.toLowerCase().includes(normalized)||club.area.includes(query.trim())));
  count.textContent=`${visible.length}クラブ`;
  grid.innerHTML=visible.map(club=>`<article class="club-card${current===club.id?' selected':''}"><span class="club-badge">${club.mark}</span><button class="club-copy" type="button" data-open-club="${club.id}"><strong>${club.name}</strong><small>${club.area}・${club.league.toUpperCase()}</small></button><button class="club-favorite" type="button" data-favorite-club="${club.id}" aria-label="${club.name}をお気に入り登録">${current===club.id?'★':'☆'}</button></article>`).join('')||'<div class="empty-state"><strong>該当するクラブがありません</strong><p>検索条件を変えてみてください。</p></div>';
}

function teamCell(team){
  return `<span class="j-team">${team.logo?`<img src="${team.logo}" alt="">`:''}<strong>${team.shortName||team.name}</strong></span>`;
}

function renderMatches(data){
  const now=Date.now();
  const finished=(data.matches||[]).filter(match=>match.status==='FINISHED'&&new Date(match.date).getTime()<=now).slice(-4);
  const upcoming=(data.matches||[]).filter(match=>match.status!=='FINISHED'&&new Date(match.date).getTime()>=now).slice(0,8);
  const list=[...finished,...upcoming];
  matchCountNode.textContent=`${list.length}試合`;
  matchesNode.innerHTML=list.map(match=>{
    const date=new Date(match.date);
    const done=match.status==='FINISHED';
    const center=done?`${match.score.home??'-'} - ${match.score.away??'-'}`:date.toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'});
    return `<article class="j-match-card"><div class="j-match-meta"><span>${date.toLocaleDateString('ja-JP',{month:'numeric',day:'numeric',weekday:'short'})}</span><span>${match.matchday?`第${match.matchday}節`:match.stage||''}</span></div><div class="j-match-teams">${teamCell(match.home)}<strong class="j-match-score">${center}</strong>${teamCell(match.away)}</div></article>`;
  }).join('')||'<div class="empty-state"><strong>表示できる試合がありません</strong><p>次回更新後に自動表示されます。</p></div>';
}

function renderStandings(data){
  standingsNode.innerHTML=(data.standings||[]).map(row=>`<div class="j-standing-row"><strong>${row.rank}</strong><span class="j-standing-team">${row.team.logo?`<img src="${row.team.logo}" alt="">`:''}${row.team.shortName||row.team.name}</span><span>${row.played}試合</span><b>${row.points}</b><small>${row.goalsDiff>0?'+':''}${row.goalsDiff}</small></div>`).join('')||'<div class="empty-state"><strong>順位データがありません</strong><p>シーズン開始後に表示されます。</p></div>';
}

async function loadLiveData(){
  try{
    const response=await fetch(`./data/jleague.json?v=${Date.now()}`,{cache:'no-store'});
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    const data=await response.json();
    const updated=new Date(data.updatedAt);
    updatedNode.textContent=`最終更新 ${updated.toLocaleString('ja-JP',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}・${data.dataSource||'football-data.org'}`;
    renderMatches(data);
    renderStandings(data);
  }catch(error){
    updatedNode.textContent='実データの初回取得を待っています';
    matchCountNode.textContent='未取得';
    matchesNode.innerHTML='<div class="empty-state"><strong>Jリーグデータを準備中</strong><p>GitHub Actionsの初回取得後、自動で表示されます。</p></div>';
    standingsNode.innerHTML='<div class="empty-state"><strong>順位データを準備中</strong><p>データ取得後に自動表示されます。</p></div>';
    console.warn('J League data unavailable',error);
  }
}

tabs.addEventListener('click',event=>{const button=event.target.closest('[data-league]');if(!button)return;activeLeague=button.dataset.league;renderTabs();renderClubs();});
grid.addEventListener('click',event=>{const favoriteButton=event.target.closest('[data-favorite-club]');if(favoriteButton){const club=SportsHubJLeague.find(favoriteButton.dataset.favoriteClub);if(favorite()===club.id){SportsHub.storage.remove(favoriteKey);SportsHub.toast('お気に入りを解除しました');}else{SportsHub.storage.set(favoriteKey,club.id);SportsHub.toast(`${club.name}をお気に入りに登録しました`);}renderClubs();return;}const openButton=event.target.closest('[data-open-club]');if(openButton)openDetail(openButton.dataset.openClub);});
search.addEventListener('input',()=>{query=search.value;renderClubs();});
SportsHub.applyTheme();
renderTabs();
renderClubs();
loadLiveData();
