const {leagues,clubs}=SportsHubJLeague;
const favoriteKey='sportsHubFavoriteJClubs';
const legacyFavoriteKey='sportsHubFavoriteJClub';
let activeLeague='j1';
let activePage='home';
let query='';
let liveData=null;
let calendarCursor=new Date();
let selectedDate='';

const $=selector=>document.querySelector(selector);
const tabs=$('#leagueTabs');
const pageTabs=$('#pageTabs');
const grid=$('#clubGrid');
const search=$('#clubSearch');
const count=$('#clubCount');
const matchesNode=$('#jleagueMatches');
const standingsNode=$('#jleagueStandings');
const homeStandings=$('#homeStandings');
const matchCountNode=$('#matchCount');
const updatedNode=$('#jUpdated');
const scheduleMatches=$('#scheduleMatches');
const favoriteMatches=$('#favoriteMatches');
const favoriteNextMatches=$('#favoriteNextMatches');
const favoriteClubGrid=$('#favoriteClubGrid');
const favoriteCountBadge=$('#favoriteCountBadge');
const favoriteClubCount=$('#favoriteClubCount');
const homeFavoriteStatus=$('#homeFavoriteStatus');
const calendar=$('#matchCalendar');
const calendarTitle=$('#calendarTitle');
const scheduleTitle=$('#scheduleTitle');

const teamNames={'21361':'京都サンガF.C.','7477':'ヴィッセル神戸','19001':'V・ファーレン長崎','7114':'サンフレッチェ広島','7116':'横浜F・マリノス','22167':'FC町田ゼルビア','7111':'ジェフユナイテッド千葉','3385':'浦和レッズ','3384':'FC東京','7115':'鹿島アントラーズ','7109':'セレッソ大阪','7102':'ガンバ大阪','7107':'アビスパ福岡','22522':'ファジアーノ岡山','7108':'名古屋グランパス','7104':'清水エスパルス','7112':'川崎フロンターレ','7476':'柏レイソル','3393':'東京ヴェルディ','131701':'水戸ホーリーホック'};
const clubTeamIds={'fc-tokyo':'3384','tokyo-verdy':'3393','machida':'22167','yokohama-fm':'7116','kashima':'7115','mito':'131701','urawa':'3385','chiba':'7111','kashiwa':'7476','kawasaki':'7112','shimizu':'7104','nagoya':'7108','kyoto':'21361','gamba':'7102','cerezo':'7109','kobe':'7477','okayama':'22522','hiroshima':'7114','fukuoka':'7107','nagasaki':'19001'};

function getFavorites(){
  const stored=SportsHub.storage.get(favoriteKey);
  if(Array.isArray(stored))return stored;
  const legacy=SportsHub.storage.get(legacyFavoriteKey);
  if(legacy){SportsHub.storage.set(favoriteKey,[legacy]);SportsHub.storage.remove(legacyFavoriteKey);return [legacy];}
  return [];
}
function setFavorites(ids){SportsHub.storage.set(favoriteKey,[...new Set(ids)]);}
function isFavorite(id){return getFavorites().includes(id);}
function toggleFavorite(id){
  const ids=getFavorites();
  const club=SportsHubJLeague.find(id);
  if(ids.includes(id)){setFavorites(ids.filter(item=>item!==id));SportsHub.toast(`${club.name}をお気に入りから解除しました`);}
  else{setFavorites([...ids,id]);SportsHub.toast(`${club.name}をお気に入りに追加しました`);}
  renderAll();
}
function displayTeamName(team){return teamNames[String(team?.id)]||team?.shortName||team?.name||'未定';}
function normalizeName(value=''){return String(value).toLowerCase().replace(/f\.c\.|fc/g,'').replace(/[・･\.．\-ー\s]/g,'').replace(/ユナイテッド/g,'').replace(/1969/g,'').replace(/fmarinos|fマリノス/g,'マリノス').replace(/sanfrecce|sanfreece/g,'サンフレッチェ').replace(/avispa/g,'アビスパ').replace(/vvaren/g,'vファーレン');}
function getAllLiveTeams(){
  if(!liveData)return [];
  const candidates=[...(liveData.teams||[])];
  (liveData.matches||[]).forEach(match=>candidates.push(match.home,match.away));
  (liveData.standings||[]).forEach(row=>candidates.push(row.team));
  const unique=new Map();
  candidates.filter(Boolean).forEach(team=>{const key=String(team.id||team.uid||team.name||team.shortName||'');if(key&&!unique.has(key))unique.set(key,team);});
  return [...unique.values()];
}
function teamAliases(team){return [team?.name,team?.shortName,team?.displayName,displayTeamName(team)].filter(Boolean).map(normalizeName).filter(Boolean);}
function findLiveTeam(club){
  const teams=getAllLiveTeams();
  const mappedId=clubTeamIds[club.id];
  if(mappedId){const byId=teams.find(team=>String(team.id||team.uid||'')===mappedId);if(byId)return byId;}
  const target=normalizeName(club.name);
  const pool=teams.filter(team=>!team.league||team.league===club.league);
  const exact=pool.find(team=>teamAliases(team).includes(target));
  if(exact)return exact;
  const partial=pool.filter(team=>teamAliases(team).some(alias=>target.length>=5&&alias.length>=5&&(alias.includes(target)||target.includes(alias))));
  return partial.length===1?partial[0]:null;
}
function findClubByTeam(team){
  const id=String(team?.id||team?.uid||'');
  const mapped=Object.entries(clubTeamIds).find(([,teamId])=>teamId===id);
  if(mapped)return SportsHubJLeague.find(mapped[0]);
  const aliases=teamAliases(team);
  return clubs.find(club=>aliases.includes(normalizeName(club.name)))||null;
}
function emblem(club){
  const live=findLiveTeam(club);
  return live?.logo?`<span class="club-badge"><img class="club-emblem" src="${live.logo}" alt="${club.name}のエンブム" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span class="club-mark-fallback" hidden>${club.mark}</span></span>`:`<span class="club-badge"><span class="club-mark-fallback">${club.mark}</span></span>`;
}
function clubCard(club){
  const selected=isFavorite(club.id);
  return `<article class="club-card${selected?' selected':''}">${emblem(club)}<button class="club-copy" type="button" data-open-club="${club.id}"><strong>${club.name}</strong><small>${club.area}・${club.league.toUpperCase()}</small></button><button class="club-favorite" type="button" data-favorite-club="${club.id}" aria-label="${club.name}をお気に入り登録">${selected?'★':'☆'}</button></article>`;
}
function renderTabs(){tabs.innerHTML=leagues.map(([id,label])=>`<button class="chip${activeLeague===id?' active':''}" type="button" data-league="${id}">${label}</button>`).join('');}
function renderPage(){
  document.querySelectorAll('.page-view').forEach(node=>node.classList.toggle('active',node.id===`page-${activePage}`));
  pageTabs.querySelectorAll('[data-page]').forEach(button=>button.classList.toggle('active',button.dataset.page===activePage));
}
function renderClubs(){
  const normalized=query.trim().toLowerCase();
  const visible=clubs.filter(club=>club.league===activeLeague&&(!normalized||club.name.toLowerCase().includes(normalized)||club.area.includes(query.trim())));
  count.textContent=`${visible.length}クラブ`;
  grid.innerHTML=visible.map(clubCard).join('')||'<div class="empty-state"><strong>該当するクラブがありません</strong></div>';
}
function teamCell(team){return `<span class="j-team">${team?.logo?`<img src="${team.logo}" alt="" loading="lazy" onerror="this.hidden=true">`:''}<strong>${displayTeamName(team)}</strong></span>`;}
function formatStage(match){if(match.matchday)return `第${match.matchday}節`;return {'regular-season':'リーグ戦','championship':'優勝決定戦','placement-playoffs':'順位決定戦','2026-j1-100-year-vision-league':'百年構想リーグ'}[match.stage]||match.round||'';}
function matchCard(match){
  const date=new Date(match.date);const done=match.status==='FINISHED';const live=['IN_PLAY','PAUSED','LIVE'].includes(match.status);
  const score=done||live?`${match.score?.home??'-'} - ${match.score?.away??'-'}`:'未開始';
  const time=done?'試合終了':live?'LIVE':date.toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'});
  return `<article class="j-match-card"><div class="j-match-meta"><span>${date.toLocaleDateString('ja-JP',{month:'numeric',day:'numeric',weekday:'short'})} ${time}</span><span>${formatStage(match)}</span></div><div class="j-match-teams">${teamCell(match.home)}<strong class="j-match-score">${score}</strong>${teamCell(match.away)}</div>${match.venue?`<small class="j-match-venue muted">${match.venue}</small>`:''}</article>`;
}
function leagueMatches(){return (liveData?.matches||[]).filter(match=>(match.league||'j1')===activeLeague).sort((a,b)=>new Date(a.date)-new Date(b.date));}
function renderHomeMatches(){
  const now=Date.now();const sorted=leagueMatches();const finished=sorted.filter(m=>m.status==='FINISHED'&&new Date(m.date).getTime()<=now).slice(-3);const upcoming=sorted.filter(m=>m.status!=='FINISHED'&&new Date(m.date).getTime()>=now).slice(0,5);
  matchCountNode.textContent=`${finished.length+upcoming.length}試合`;
  const blocks=[];if(finished.length)blocks.push(`<div class="j-match-section"><p class="eyebrow">直近結果</p><div class="j-match-cards">${finished.map(matchCard).join('')}</div></div>`);if(upcoming.length)blocks.push(`<div class="j-match-section"><p class="eyebrow">今後の日程</p><div class="j-match-cards">${upcoming.map(matchCard).join('')}</div></div>`);
  matchesNode.innerHTML=blocks.join('')||'<div class="empty-state"><strong>表示できる試合がありません</strong></div>';
}
function favoriteMatchList(){
  const ids=getFavorites();const favoriteClubNames=new Set(ids.map(id=>SportsHubJLeague.find(id)?.name).filter(Boolean).map(normalizeName));
  return (liveData?.matches||[]).filter(match=>[match.home,match.away].some(team=>{const club=findClubByTeam(team);return club?ids.includes(club.id):teamAliases(team).some(alias=>favoriteClubNames.has(alias));})).sort((a,b)=>new Date(a.date)-new Date(b.date));
}
function renderFavorites(){
  const ids=getFavorites();const selected=ids.map(id=>SportsHubJLeague.find(id)).filter(Boolean);
  favoriteCountBadge.textContent=ids.length;favoriteClubCount.textContent=`${ids.length}クラブ`;homeFavoriteStatus.textContent=`${ids.length}クラブ`;
  favoriteClubGrid.innerHTML=selected.map(clubCard).join('')||'<div class="empty-state"><strong>お気に入りはまだありません</strong><p>クラブ一覧の☆を押して追加できます。</p></div>';
  const now=Date.now();const future=favoriteMatchList().filter(match=>new Date(match.date).getTime()>=now&&match.status!=='FINISHED');
  favoriteMatches.innerHTML=future.slice(0,20).map(matchCard).join('')||'<div class="empty-state"><strong>今後の試合がありません</strong></div>';
  favoriteNextMatches.innerHTML=future.slice(0,5).map(matchCard).join('')||'<div class="empty-state"><strong>お気に入りクラブを登録すると次戦が表示されます</strong></div>';
}
function standingRows(limit){
  return (liveData?.standings||[]).filter(row=>(row.league||'j1')===activeLeague).sort((a,b)=>(a.rank??999)-(b.rank??999)).slice(0,limit||999);
}
function standingRow(row){const played=row.played??row.gamesPlayed??'-';const points=row.points??'-';const diff=row.goalsDiff??row.goalDifference??0;return `<div class="j-standing-row"><strong>${row.rank??'-'}</strong><span class="j-standing-team">${row.team?.logo?`<img src="${row.team.logo}" alt="" loading="lazy" onerror="this.hidden=true">`:''}${displayTeamName(row.team)}</span><span>${played}</span><b>${points}</b><small>${Number(diff)>0?'+':''}${diff}</small></div>`;}
function renderStandings(){const rows=standingRows();standingsNode.innerHTML=rows.map(standingRow).join('')||'<div class="empty-state"><strong>順位データがありません</strong></div>';homeStandings.innerHTML=standingRows(5).map(standingRow).join('')||'<div class="empty-state"><strong>順位データがありません</strong></div>';}
function dateKey(date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
function renderCalendar(){
  const year=calendarCursor.getFullYear(),month=calendarCursor.getMonth();calendarTitle.textContent=`${year}年${month+1}月`;
  const first=new Date(year,month,1),last=new Date(year,month+1,0);const matchDates=new Map();leagueMatches().forEach(match=>{const key=dateKey(new Date(match.date));matchDates.set(key,(matchDates.get(key)||0)+1);});
  const cells=['日','月','火','水','木','金','土'].map(day=>`<span class="calendar-weekday">${day}</span>`);for(let i=0;i<first.getDay();i++)cells.push('<span></span>');
  for(let day=1;day<=last.getDate();day++){const date=new Date(year,month,day);const key=dateKey(date);const count=matchDates.get(key)||0;cells.push(`<button class="calendar-day${selectedDate===key?' selected':''}${count?' has-match':''}" data-date="${key}" type="button"><span>${day}</span>${count?`<small>${count}試合</small>`:''}</button>`);}
  calendar.innerHTML=cells.join('');
}
function renderSchedule(){
  const matches=leagueMatches().filter(match=>!selectedDate||dateKey(new Date(match.date))===selectedDate);
  scheduleTitle.textContent=selectedDate?`${new Date(`${selectedDate}T00:00:00`).toLocaleDateString('ja-JP',{month:'long',day:'numeric',weekday:'short'})}の試合`:'試合日程';
  scheduleMatches.innerHTML=matches.map(matchCard).join('')||'<div class="empty-state"><strong>この日の試合はありません</strong></div>';
}
function renderAll(){renderTabs();renderPage();renderClubs();if(liveData){renderHomeMatches();renderStandings();renderCalendar();renderSchedule();}renderFavorites();}
async function loadLiveData(){
  try{const response=await fetch(`./data/jleague.json?v=${Date.now()}`,{cache:'no-store'});if(!response.ok)throw new Error(`HTTP ${response.status}`);liveData=await response.json();const updated=new Date(liveData.updatedAt);updatedNode.textContent=`最終更新 ${updated.toLocaleString('ja-JP',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}・${liveData.dataSource||'公開データ'}`;const firstFuture=leagueMatches().find(match=>new Date(match.date)>new Date());if(firstFuture)calendarCursor=new Date(firstFuture.date);renderAll();}
  catch(error){updatedNode.textContent='実データの初回取得を待っています';console.warn('J League data unavailable',error);renderAll();}
}
pageTabs.addEventListener('click',event=>{const button=event.target.closest('[data-page]');if(!button)return;activePage=button.dataset.page;renderPage();});
document.addEventListener('click',event=>{const jump=event.target.closest('[data-page-jump]');if(jump){activePage=jump.dataset.pageJump;renderPage();window.scrollTo({top:0,behavior:'smooth'});}});
tabs.addEventListener('click',event=>{const button=event.target.closest('[data-league]');if(!button)return;activeLeague=button.dataset.league;selectedDate='';renderAll();});
document.addEventListener('click',event=>{const favoriteButton=event.target.closest('[data-favorite-club]');if(favoriteButton){toggleFavorite(favoriteButton.dataset.favoriteClub);return;}const openButton=event.target.closest('[data-open-club]');if(openButton)location.href=`./jleague-detail.html?club=${encodeURIComponent(openButton.dataset.openClub)}`;});
search.addEventListener('input',()=>{query=search.value;renderClubs();});
calendar.addEventListener('click',event=>{const button=event.target.closest('[data-date]');if(!button)return;selectedDate=button.dataset.date;renderCalendar();renderSchedule();});
$('#calendarPrev').addEventListener('click',()=>{calendarCursor=new Date(calendarCursor.getFullYear(),calendarCursor.getMonth()-1,1);renderCalendar();});
$('#calendarNext').addEventListener('click',()=>{calendarCursor=new Date(calendarCursor.getFullYear(),calendarCursor.getMonth()+1,1);renderCalendar();});
$('#clearDateFilter').addEventListener('click',()=>{selectedDate='';renderCalendar();renderSchedule();});
SportsHub.applyTheme();renderAll();loadLiveData();