const {teams:countries,regions}=SportsHubNational;
const favoriteKey='sportsHubFavoriteNationals';
const legacyFavoriteKey='sportsHubFavoriteNational';
let activeRegion='all';
let query='';
let nationalMatches=[];
let calendarCursor=new Date();
let selectedDate='';

const tabs=document.querySelector('#pageTabs');
const filters=document.querySelector('#regionFilters');
const search=document.querySelector('#countrySearch');
const grid=document.querySelector('#countryGrid');
const favoriteGrid=document.querySelector('#favoriteCountryGrid');

function favoriteIds(){
  const stored=SportsHub.storage.get(favoriteKey);
  if(Array.isArray(stored))return stored;
  const legacy=SportsHub.storage.get(legacyFavoriteKey);
  if(legacy){SportsHub.storage.set(favoriteKey,[legacy]);SportsHub.storage.remove(legacyFavoriteKey);return [legacy];}
  return [];
}
function isFavorite(id){return favoriteIds().includes(id);}
function toggleFavorite(id){
  const current=favoriteIds();
  const next=current.includes(id)?current.filter(item=>item!==id):[...current,id];
  SportsHub.storage.set(favoriteKey,next);
  return next.includes(id);
}
function openDetail(id){location.href=`./national-detail.html?team=${encodeURIComponent(id)}`;}
function teamName(id){return SportsHubNational.find(id)?.name||id;}
function formatDate(value){return new Intl.DateTimeFormat('ja-JP',{month:'numeric',day:'numeric',weekday:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(value));}
function dateKey(value){const d=new Date(value);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function emptyState(title,text,icon='🌍'){return `<div class="empty-state"><span>${icon}</span><strong>${title}</strong><p>${text}</p></div>`;}

function matchCard(match){
  const finished=match.status==='finished';
  const score=finished&&match.homeScore!==null?`${match.homeScore} - ${match.awayScore}`:'VS';
  const home=SportsHubNational.find(match.home);
  const away=SportsHubNational.find(match.away);
  return `<article class="match-summary"><div class="match-meta"><span>${formatDate(match.kickoff)}</span><span>${match.competition||'代表戦'}</span></div><div class="match-teams"><span class="match-team"><b>${home?.flag||'🏳️'}</b><strong>${teamName(match.home)}</strong></span><em>${score}</em><span class="match-team away"><strong>${teamName(match.away)}</strong><b>${away?.flag||'🏳️'}</b></span></div>${match.round||match.stage?`<small>${match.round||match.stage}</small>`:''}</article>`;
}
function teamCard(country){
  const selected=isFavorite(country.id);
  return `<article class="country-card${selected?' selected':''}"><span class="flag" aria-hidden="true">${country.flag}</span><button class="country-copy" type="button" data-open-country="${country.id}"><strong>${country.name}</strong><small>${country.en}</small></button><button class="favorite-button${selected?' active':''}" type="button" data-favorite-country="${country.id}" aria-label="${country.name}代表をお気に入り登録">${selected?'★':'☆'}</button></article>`;
}
function renderTabs(page='home'){
  document.querySelectorAll('.hub-nav__item').forEach(button=>button.classList.toggle('active',button.dataset.page===page));
  document.querySelectorAll('.page-view').forEach(view=>view.classList.toggle('active',view.id===`page-${page}`));
}
function renderFilters(){filters.innerHTML=regions.map(([id,label])=>`<button class="chip${activeRegion===id?' active':''}" type="button" data-region="${id}">${label}</button>`).join('');}
function renderCountries(){
  const normalized=query.trim().toLowerCase();
  const visible=countries.filter(country=>(activeRegion==='all'||country.region===activeRegion)&&(!normalized||country.name.includes(query.trim())||country.en.toLowerCase().includes(normalized)));
  document.querySelector('#countryCount').textContent=`${visible.length}代表`;
  grid.innerHTML=visible.map(teamCard).join('')||emptyState('該当する代表がありません','検索条件を変えてみてください。');
}
function renderFavorites(){
  const ids=favoriteIds();
  const teams=ids.map(id=>SportsHubNational.find(id)).filter(Boolean);
  document.querySelector('#favoriteCountBadge').textContent=teams.length;
  document.querySelector('#homeFavoriteStatus').textContent=`${teams.length}代表`;
  document.querySelector('#favoriteTeamCount').textContent=`${teams.length}代表`;
  favoriteGrid.innerHTML=teams.map(teamCard).join('')||emptyState('お気に入りがありません','代表一覧の☆から複数登録できます。','☆');

  const favoriteMatches=nationalMatches.filter(match=>ids.includes(match.home)||ids.includes(match.away));
  const upcoming=SportsHubNationalService.upcoming(favoriteMatches);
  document.querySelector('#favoriteNextMatches').innerHTML=upcoming.slice(0,5).map(matchCard).join('')||emptyState('次戦データがありません','お気に入りを登録するか、次回更新をお待ちください。','📅');
  document.querySelector('#favoriteMatches').innerHTML=upcoming.slice(0,20).map(matchCard).join('')||emptyState('今後の試合がありません','更新後に自動表示されます。','📅');
}
function competitionCards(limit){
  const counts={};
  nationalMatches.forEach(match=>{const name=match.competition||'代表戦';counts[name]=(counts[name]||0)+1;});
  const entries=Object.entries(counts).sort((a,b)=>b[1]-a[1]);
  const visible=typeof limit==='number'?entries.slice(0,limit):entries;
  return visible.map(([name,count])=>`<article><span>🏆</span><h3>${name}</h3><p>${count}試合</p></article>`).join('')||'<article><span>📡</span><h3>データ待機中</h3><p>利用可能な大会を取得します</p></article>';
}
function renderMatches(){
  const ordered=[...nationalMatches].sort((a,b)=>new Date(a.kickoff)-new Date(b.kickoff));
  const now=Date.now();
  const recent=ordered.filter(match=>new Date(match.kickoff).getTime()>=now-1000*60*60*24*3).slice(0,12);
  document.querySelector('#nationalMatchCount').textContent=`${recent.length}試合`;
  document.querySelector('#nationalMatches').innerHTML=recent.map(matchCard).join('')||emptyState('表示できる代表戦がありません','次回更新後に自動表示されます。');
  document.querySelector('#homeCompetitionSummary').innerHTML=competitionCards(4);
  document.querySelector('#competitionSummary').innerHTML=competitionCards();
}
function renderCalendar(){
  const year=calendarCursor.getFullYear();
  const month=calendarCursor.getMonth();
  document.querySelector('#calendarTitle').textContent=`${year}年${month+1}月`;
  const first=new Date(year,month,1);
  const last=new Date(year,month+1,0);
  const matchDays=new Set(nationalMatches.filter(match=>{const d=new Date(match.kickoff);return d.getFullYear()===year&&d.getMonth()===month;}).map(match=>dateKey(match.kickoff)));
  const cells=[];
  ['日','月','火','水','木','金','土'].forEach(day=>cells.push(`<div class="calendar-weekday">${day}</div>`));
  for(let i=0;i<first.getDay();i++)cells.push('<span></span>');
  for(let day=1;day<=last.getDate();day++){
    const key=`${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const has=matchDays.has(key);
    cells.push(`<button class="calendar-day${has?' has-match':''}${selectedDate===key?' selected':''}" type="button" data-date="${key}"><span>${day}</span>${has?'<small>●</small>':''}</button>`);
  }
  document.querySelector('#matchCalendar').innerHTML=cells.join('');
  renderSchedule();
}
function renderSchedule(){
  const ordered=[...nationalMatches].sort((a,b)=>new Date(a.kickoff)-new Date(b.kickoff));
  const visible=selectedDate?ordered.filter(match=>dateKey(match.kickoff)===selectedDate):ordered;
  document.querySelector('#scheduleTitle').textContent=selectedDate?`${Number(selectedDate.slice(5,7))}月${Number(selectedDate.slice(8,10))}日の試合`:'試合日程';
  document.querySelector('#scheduleMatches').innerHTML=visible.slice(0,40).map(matchCard).join('')||emptyState('この日の試合はありません','別の日付を選択してください。','📅');
}
function renderAll(){renderFilters();renderCountries();renderFavorites();renderMatches();renderCalendar();}
async function loadMatchData(){
  try{
    const payload=await SportsHubNationalService.loadPayload();
    nationalMatches=payload.matches||[];
    document.querySelector('#nationalUpdatedAt').textContent=payload.updatedAt?`最終更新 ${new Date(payload.updatedAt).toLocaleString('ja-JP')}`:'更新データ未生成';
    renderAll();
  }catch(error){
    document.querySelector('#nationalUpdatedAt').textContent='代表戦データを準備中';
    console.warn('National data unavailable',error);
  }
}

tabs.addEventListener('click',event=>{const button=event.target.closest('[data-page]');if(button)renderTabs(button.dataset.page);});
document.addEventListener('click',event=>{const jump=event.target.closest('[data-page-jump]');if(jump)renderTabs(jump.dataset.pageJump);});
filters.addEventListener('click',event=>{const button=event.target.closest('[data-region]');if(!button)return;activeRegion=button.dataset.region;renderFilters();renderCountries();});
function handleTeamGridClick(event){
  const favoriteButton=event.target.closest('[data-favorite-country]');
  if(favoriteButton){const country=SportsHubNational.find(favoriteButton.dataset.favoriteCountry);const added=toggleFavorite(country.id);SportsHub.toast(`${country.name}代表を${added?'登録':'解除'}しました`);renderCountries();renderFavorites();return;}
  const openButton=event.target.closest('[data-open-country]');if(openButton)openDetail(openButton.dataset.openCountry);
}
grid.addEventListener('click',handleTeamGridClick);favoriteGrid.addEventListener('click',handleTeamGridClick);
search.addEventListener('input',()=>{query=search.value;renderCountries();});
document.querySelector('#matchCalendar').addEventListener('click',event=>{const button=event.target.closest('[data-date]');if(!button)return;selectedDate=selectedDate===button.dataset.date?'':button.dataset.date;renderCalendar();});
document.querySelector('#calendarPrev').addEventListener('click',()=>{calendarCursor=new Date(calendarCursor.getFullYear(),calendarCursor.getMonth()-1,1);selectedDate='';renderCalendar();});
document.querySelector('#calendarNext').addEventListener('click',()=>{calendarCursor=new Date(calendarCursor.getFullYear(),calendarCursor.getMonth()+1,1);selectedDate='';renderCalendar();});
document.querySelector('#clearDateFilter').addEventListener('click',()=>{selectedDate='';renderCalendar();});
SportsHub.applyTheme();renderTabs();renderAll();loadMatchData();