const params=new URLSearchParams(location.search);
const fallback=SportsHub.storage.get('sportsHubFavoriteNational','japan');
const selected=SportsHubNational.find(params.get('team')||fallback)||SportsHubNational.teams[0];
const favoriteKey='sportsHubFavoriteNational';
let teamMatches=[];
function renderTeam(){
  document.title=`${selected.name}代表 | Sports Hub`;
  document.querySelector('#pageTitle').childNodes[0].nodeValue=`${selected.name}代表 `;
  document.querySelector('#teamName').textContent=`${selected.name}代表`;
  document.querySelector('#teamEnglish').textContent=selected.en;
  document.querySelector('#teamFlag').textContent=selected.flag;
  document.querySelector('#teamRegion').textContent=SportsHubNational.regionNames[selected.region]||'代表';
  syncFavorite();
}
function syncFavorite(){
  const button=document.querySelector('#favoriteButton');
  const isFavorite=SportsHub.storage.get(favoriteKey)===selected.id;
  button.classList.toggle('is-favorite',isFavorite);
  button.textContent=isFavorite?'★ 推し代表に登録中':'☆ 推し代表に登録';
}
function formatKickoff(value){return new Intl.DateTimeFormat('ja-JP',{month:'numeric',day:'numeric',weekday:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(value));}
function renderMatches(){
  const upcoming=SportsHubNationalService.upcoming(teamMatches);
  const finished=SportsHubNationalService.finished(teamMatches);
  const next=upcoming[0];
  const nextMatch=document.querySelector('#nextMatchContent');
  nextMatch.innerHTML=next?`<div class="match-summary"><span>${formatKickoff(next.kickoff)}</span><strong>${SportsHubNational.find(next.home)?.name||next.home} vs ${SportsHubNational.find(next.away)?.name||next.away}</strong><small>${next.competition||'代表戦'}</small></div>`:'<div class="empty-state"><span>📅</span><strong>今後の試合データはありません</strong><p>データ更新後に自動表示されます。</p></div>';
  document.querySelector('#matchesList').innerHTML=teamMatches.length?teamMatches.map(match=>`<article class="match-summary"><span>${formatKickoff(match.kickoff)}</span><strong>${SportsHubNational.find(match.home)?.name||match.home} vs ${SportsHubNational.find(match.away)?.name||match.away}</strong><small>${match.competition||'代表戦'}</small></article>`).join(''):'<div class="empty-state"><span>⚽</span><strong>日程データはまだありません</strong><p>共通JSONまたはAPI接続後に表示されます。</p></div>';
  document.querySelector('#upcomingCount').textContent=String(upcoming.length);
  document.querySelector('#finishedCount').textContent=String(finished.length);
  document.querySelector('#totalCount').textContent=String(teamMatches.length);
}
async function loadMatches(){
  const matches=await SportsHubNationalService.load();
  teamMatches=SportsHubNationalService.forTeam(matches,selected.id);
  renderMatches();
}
document.querySelector('.detail-tabs').addEventListener('click',event=>{
  const button=event.target.closest('[data-tab]');
  if(!button)return;
  document.querySelectorAll('.detail-tab').forEach(tab=>tab.classList.toggle('active',tab===button));
  document.querySelectorAll('.tab-panel').forEach(panel=>panel.classList.add('hidden'));
  document.querySelector(`#${button.dataset.tab}Panel`)?.classList.remove('hidden');
});
document.querySelector('#favoriteButton').addEventListener('click',()=>{
  const current=SportsHub.storage.get(favoriteKey);
  if(current===selected.id){SportsHub.storage.remove(favoriteKey);SportsHub.toast('推し代表を解除しました');}
  else{SportsHub.storage.set(favoriteKey,selected.id);SportsHub.toast(`${selected.name}代表を登録しました`);}
  syncFavorite();
});
SportsHub.applyTheme();
renderTeam();
loadMatches();