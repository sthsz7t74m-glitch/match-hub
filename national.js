const {teams:countries,regions}=SportsHubNational;
const Core=window.FootballCore;
const favoriteService=new Core.FavoriteService({key:'sportsHubFavoriteNationals',legacyKey:'sportsHubFavoriteNational'});
const pageTabs=new Core.PageTabs({root:document.querySelector('#pageTabs')});
let activeRegion='all',query='',nationalMatches=[],selectedDate='';

const filters=document.querySelector('#regionFilters');
const search=document.querySelector('#countrySearch');
const grid=document.querySelector('#countryGrid');
const favoriteGrid=document.querySelector('#favoriteCountryGrid');
const empty=(title,text='')=>Core.EmptyState.render(title,text);
const favoriteIds=()=>favoriteService.list();
const isFavorite=id=>favoriteService.has(id);
const openDetail=id=>{location.href=`./national-detail.html?team=${encodeURIComponent(id)}`;};
const teamName=(id,fallback='')=>SportsHubNational.find(id)?.name||fallback||id;
const dateKey=value=>new Core.MatchModel({kickoff:value}).dateKey;

function matchCard(match){
  const finished=match.status==='finished',live=match.status==='in_play';
  const home=SportsHubNational.find(match.home),away=SportsHubNational.find(match.away);
  return SportsHubComponents.matchCard({match,date:match.kickoff,timeText:finished?'試合終了':live?'LIVE':'',scoreText:finished||live?`${match.homeScore??'-'} - ${match.awayScore??'-'}`:'VS',competition:match.competition||'代表戦',stage:match.round||match.stage||'',venue:match.venue||'',home:{name:teamName(match.home,match.homeName),flag:home?.flag||'🏳️'},away:{name:teamName(match.away,match.awayName),flag:away?.flag||'🏳️'}});
}
function teamCard(country){const selected=isFavorite(country.id);return `<article class="country-card${selected?' selected':''}"><span class="flag" aria-hidden="true">${country.flag}</span><button class="country-copy" type="button" data-open-country="${country.id}"><strong>${country.name}</strong><small>${country.en}</small></button><button class="favorite-button${selected?' active':''}" type="button" data-favorite-country="${country.id}" aria-label="${country.name}代表をお気に入り登録">${selected?'★':'☆'}</button></article>`;}
function renderFilters(){filters.innerHTML=regions.map(([id,label])=>`<button class="chip${activeRegion===id?' active':''}" type="button" data-region="${id}">${label}</button>`).join('');}
function renderCountries(){const normalized=query.trim().toLowerCase(),visible=countries.filter(country=>(activeRegion==='all'||country.region===activeRegion)&&(!normalized||country.name.includes(query.trim())||country.en.toLowerCase().includes(normalized)));document.querySelector('#countryCount').textContent=`${visible.length}代表`;grid.innerHTML=visible.map(teamCard).join('')||empty('該当する代表がありません','検索条件を変えてみてください。');}
function renderFavorites(){const ids=favoriteIds(),teams=ids.map(id=>SportsHubNational.find(id)).filter(Boolean);document.querySelector('#favoriteCountBadge').textContent=teams.length;document.querySelector('#homeFavoriteStatus').textContent=`${teams.length}代表`;document.querySelector('#favoriteTeamCount').textContent=`${teams.length}代表`;favoriteGrid.innerHTML=teams.map(teamCard).join('')||empty('お気に入りがありません','代表一覧の☆から複数登録できます。');const service=new Core.MatchService(nationalMatches);const upcoming=service.upcoming().filter(match=>ids.includes(String(match.home))||ids.includes(String(match.away)));document.querySelector('#favoriteNextMatches').innerHTML=upcoming.slice(0,5).map(matchCard).join('')||empty('次戦データがありません','お気に入りを登録するか、次回更新をお待ちください。');document.querySelector('#favoriteMatches').innerHTML=upcoming.slice(0,20).map(matchCard).join('')||empty('今後の試合がありません','更新後に自動表示されます。');}
function competitionCards(limit){const counts={};nationalMatches.forEach(match=>{const name=match.competition||'代表戦';counts[name]=(counts[name]||0)+1;});const entries=Object.entries(counts).sort((a,b)=>b[1]-a[1]),visible=typeof limit==='number'?entries.slice(0,limit):entries;return visible.map(([name,count])=>`<article><span>🏆</span><h3>${name}</h3><p>${count}試合</p></article>`).join('')||'<article><span>📡</span><h3>データ待機中</h3><p>利用可能な大会を取得します</p></article>';}
function renderMatches(){const ordered=[...nationalMatches].sort((a,b)=>new Date(a.kickoff)-new Date(b.kickoff)),recent=ordered.filter(match=>new Date(match.kickoff).getTime()>=Date.now()-259200000).slice(0,12);document.querySelector('#nationalMatchCount').textContent=`${recent.length}試合`;document.querySelector('#nationalMatches').innerHTML=recent.map(matchCard).join('')||empty('表示できる代表戦がありません','次回更新後に自動表示されます。');document.querySelector('#homeCompetitionSummary').innerHTML=competitionCards(4);document.querySelector('#competitionSummary').innerHTML=competitionCards();}
function renderSchedule(){const ordered=[...nationalMatches].sort((a,b)=>new Date(a.kickoff)-new Date(b.kickoff)),visible=selectedDate?ordered.filter(match=>dateKey(match.kickoff)===selectedDate):ordered;document.querySelector('#scheduleTitle').textContent=selectedDate?`${Number(selectedDate.slice(5,7))}月${Number(selectedDate.slice(8,10))}日の試合`:'試合日程';document.querySelector('#scheduleMatches').innerHTML=visible.slice(0,40).map(matchCard).join('')||empty('この日の試合はありません','別の日付を選択してください。');}
function renderAll(){renderFilters();renderCountries();renderFavorites();renderMatches();renderSchedule();}
async function loadMatchData(){try{const payload=await SportsHubNationalService.loadPayload();nationalMatches=payload.matches||[];document.querySelector('#nationalUpdatedAt').textContent=payload.updatedAt?`最終更新 ${new Date(payload.updatedAt).toLocaleString('ja-JP')}`:'更新データ未生成';renderAll();}catch(error){document.querySelector('#nationalUpdatedAt').textContent='代表戦データを準備中';console.warn('National data unavailable',error);}}

pageTabs.bind();
document.addEventListener('click',event=>{const jump=event.target.closest('[data-page-jump]');if(jump){pageTabs.show(jump.dataset.pageJump);window.scrollTo({top:0,behavior:'smooth'});}});
filters.addEventListener('click',event=>{const button=event.target.closest('[data-region]');if(!button)return;activeRegion=button.dataset.region;renderFilters();renderCountries();});
function handleTeamGridClick(event){const favoriteButton=event.target.closest('[data-favorite-country]');if(favoriteButton){const country=SportsHubNational.find(favoriteButton.dataset.favoriteCountry),added=favoriteService.toggle(country.id);SportsHub.toast(`${country.name}代表を${added?'登録':'解除'}しました`);renderCountries();renderFavorites();window.FootballUI?.calendars?.national?.render();return;}const openButton=event.target.closest('[data-open-country]');if(openButton)openDetail(openButton.dataset.openCountry);}
grid.addEventListener('click',handleTeamGridClick);favoriteGrid.addEventListener('click',handleTeamGridClick);
search.addEventListener('input',()=>{query=search.value;renderCountries();});
document.addEventListener('football:calendar-select',event=>{if(document.body.dataset.hub!=='national')return;selectedDate=event.detail.date;renderSchedule();});
document.querySelector('#clearDateFilter').addEventListener('click',()=>window.FootballUI?.calendars?.national?.clearSelection());
SportsHub.applyTheme();pageTabs.show('home');renderAll();loadMatchData();