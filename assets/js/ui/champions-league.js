/* UEFA competitions share the domestic hub's clubs and fixtures. */
const uefaCompetitions = {champions:{id:2,code:'CL',title:'チャンピオンズリーグ',heading:'UEFA CHAMPIONS LEAGUE'},europa:{id:2146,code:'EL',title:'ヨーロッパリーグ',heading:'UEFA EUROPA LEAGUE'}};
let activeUefaCompetition = () => uefaCompetitions[state.view] || uefaCompetitions.champions;
const championsState = {tab:'matches',status:'all',round:'all',favorites:false};
const clEscape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clDate = value => new Date(value).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo',month:'numeric',day:'numeric',weekday:'short',hour:'2-digit',minute:'2-digit'});
function championsMatches(data, filters=championsState) {
  return (data?.fixtures||[]).filter(f => f.leagueId===activeUefaCompetition().id)
    .filter(f => filters.round==='all'||f.round===filters.round)
    .filter(f => !filters.favorites||state.favorites.includes(f.home.id)||state.favorites.includes(f.away.id))
    .filter(f => filters.status==='all'||(filters.status==='finished'?isFinished(f):['SCHEDULED','TIMED','IN_PLAY','PAUSED'].includes(f.status)))
    .sort((a,b) => filters.status==='finished'?new Date(b.date)-new Date(a.date):new Date(a.date)-new Date(b.date));
}
function championsTable(data) {
  const standing=(data?.standings||[]).find(s=>s.leagueId===activeUefaCompetition().id);
  const rows=standing?.rows||[];
  if(!rows.length)return '<p class="empty">リーグフェーズの順位データはまだ取得できていません。</p>';
  return `<p class="cl-legend">${standing.provisional?'※ UEFA公式結果から集計した暫定順位。公式順位の同点時の細則と一致しない場合があります。':''} リーグフェーズ終了時：1〜8位＝ベスト16、9〜24位＝プレーオフ、25位以下＝敗退。色は現在の順位帯です。</p><div class="cl-table-scroll"><table class="cl-table"><thead><tr><th scope="col">順位</th><th scope="col">クラブ</th><th scope="col">試</th><th scope="col">勝</th><th scope="col">分</th><th scope="col">敗</th><th scope="col">得</th><th scope="col">失</th><th scope="col">差</th><th scope="col">点</th></tr></thead><tbody>${rows.map(r=>`<tr class="cl-zone-${r.rank<=8?'direct':r.rank<=24?'playoff':'out'} ${state.favorites.includes(r.team.id)?'favorite-row':''}"><td>${clEscape(r.rank)}</td><th scope="row"><button class="cl-team-button" data-open-team="${r.team.id}">${clEscape(teamName(r.team))}</button></th>${['played','win','draw','lose','goalsFor','goalsAgainst','goalsDiff','points'].map(k=>`<td>${clEscape(r[k]??'—')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function renderChampions() {
  const root=document.querySelector('#championsView');if(!root)return;
  const fixtures=(state.data?.fixtures||[]).filter(f=>f.leagueId===activeUefaCompetition().id);
  const rounds=[...new Set(fixtures.map(f=>f.round).filter(Boolean))];
  if(championsState.round!=='all'&&!rounds.includes(championsState.round))championsState.round='all';
  const league=(state.data?.leagues||[]).find(l=>l.id===activeUefaCompetition().id);
  const season=state.data?.season;
  const seasonLabel=season?`${season}/${String(Number(season)+1).slice(-2)}`:'';
  const matches=championsMatches(state.data);
  const competition=activeUefaCompetition();
  const renderUefaMatch=f=>matchCard(f,{rich:true});
  root.innerHTML=`<div class="cl-heading"><div><p class="eyebrow">${competition.heading}</p><h2 id="championsTitle">${competition.code}</h2><p class="muted">${clEscape(seasonLabel)} · 日本時間（JST）</p></div><button class="text-button" data-cl-home>クラブへ戻る</button></div><div class="chips cl-tabs">${[['matches','日程・結果'],['standings','順位表']].map(([key,label])=>`<button class="chip ${championsState.tab===key?'active':''}" data-cl-tab="${key}" aria-pressed="${championsState.tab===key}">${label}</button>`).join('')}</div>${!league?'<p class="cl-notice" role="status">${competition.code}データの取得待ちです。「最新情報に更新」で公開データを再読み込みできます。</p>':''}${championsState.tab==='standings'?championsTable(state.data):`<div class="cl-controls"><label>表示<select id="clStatus"><option value="all">すべて</option><option value="upcoming">今後・試合中</option><option value="finished">終了した試合</option></select></label><label>ラウンド<select id="clRound"><option value="all">すべて</option>${rounds.map(r=>`<option value="${clEscape(r)}">${clEscape(r)}</option>`).join('')}</select></label><label class="cl-favorite"><input id="clFavorites" type="checkbox" ${championsState.favorites?'checked':''}>お気に入りのみ</label></div><p class="muted">${matches.length}試合 · お気に入りは5大リーグと共通</p><div class="stack cl-matches">${matches.length?matches.map(f=>`<div>${renderUefaMatch(f)}</div>`).join(''):'<p class="empty">該当する試合はありません。条件を変更するか、更新後に確認してください。</p>'}</div>`}`;
  if(championsState.tab==='matches'){
    root.querySelector('#clStatus').value=championsState.status;
    root.querySelector('#clRound').value=championsState.round;
  }
}
const renderBeforeChampions=render;
render=function(){
  renderBeforeChampions();
  const active=state.view==='champions'||state.view==='europa';
  document.querySelector('.cl-entry')?.classList.toggle('hidden',state.view!=='home'&&!active);
  const switcher=document.querySelector('.cl-entry');
  if(switcher){
    switcher.setAttribute('aria-label','大会の表示');
    switcher.innerHTML=`<a class="chip ${!active?'active':''}" href="./" data-cl-home ${!active?'aria-current="page"':''}>クラブ</a>${Object.entries(uefaCompetitions).map(([key,competition])=>`<a class="chip ${state.view===key?'active':''}" href="?view=${key}" data-open-uefa="${key}" ${state.view===key?'aria-current="page"':''}>${competition.code}</a>`).join('')}`;
  }
  document.querySelector('#championsView')?.classList.toggle('hidden',!active);
  if(active){document.querySelector('#onboarding')?.classList.add('hidden');renderChampions();}
};
// The standard standings tab must use CL advancement bands, not domestic relegation bands.
const standingsBeforeChampions=renderStandingsV100;
renderStandingsV100=function(){
  if(state.league!==2&&state.league!==2146)return standingsBeforeChampions();
  const ids=(state.data?.standings||[]).map(s=>s.leagueId);
  document.querySelector('#standingsTabs').innerHTML=ids.map(id=>`<button class="chip ${id===2?'active':''}" data-standing-league="${id}">${clEscape(leagueNames[id]||id)}</button>`).join('');
  const tools=document.querySelector('#standingsToolsV100');if(tools)tools.innerHTML='';
  document.querySelector('#standingsTable').innerHTML=championsTable(state.data);
};
renderStandings=renderStandingsV100;
document.addEventListener('click',event=>{
  const openUefa=event.target.closest('[data-open-uefa], [data-open-champions]');
  if(openUefa){event.preventDefault();state.view=openUefa.dataset.openUefa||'champions';championsState.tab='matches';championsState.round='all';setActiveNav('');render();window.scrollTo({top:0});}
  else if(event.target.closest('[data-cl-home]')){event.preventDefault();state.view='home';setActiveNav('home');render();}
  const tab=event.target.closest('[data-cl-tab]');if(tab){championsState.tab=tab.dataset.clTab;renderChampions();}
});
document.querySelector('#championsView')?.addEventListener('change',event=>{
  if(event.target.id==='clStatus')championsState.status=event.target.value;
  if(event.target.id==='clRound')championsState.round=event.target.value;
  if(event.target.id==='clFavorites')championsState.favorites=event.target.checked;
  renderChampions();
});
if(['champions','europa'].includes(new URLSearchParams(location.search).get('view'))){state.view=new URLSearchParams(location.search).get('view');setActiveNav('');}
const clVersion=document.querySelector('.version');if(clVersion)clVersion.textContent='v1.1.35';
if(state.data)render();
