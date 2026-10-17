/* Champions League uses the same club IDs and fixtures as the domestic hub. */
const championsState = {tab:'matches',status:'all',round:'all',favorites:false};
const clEscape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clDate = value => new Date(value).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo',month:'numeric',day:'numeric',weekday:'short',hour:'2-digit',minute:'2-digit'});
function championsMatches(data, filters=championsState) {
  return (data?.fixtures||[]).filter(f => f.leagueId===2)
    .filter(f => filters.round==='all'||f.round===filters.round)
    .filter(f => !filters.favorites||state.favorites.includes(f.home.id)||state.favorites.includes(f.away.id))
    .filter(f => filters.status==='all'||(filters.status==='finished'?isFinished(f):['SCHEDULED','TIMED','IN_PLAY','PAUSED'].includes(f.status)))
    .sort((a,b) => filters.status==='finished'?new Date(b.date)-new Date(a.date):new Date(a.date)-new Date(b.date));
}
function championsTable(data) {
  const standing=(data?.standings||[]).find(s=>s.leagueId===2);
  const rows=standing?.rows||[];
  if(!rows.length)return '<p class="empty">リーグフェーズの順位データはまだ取得できていません。</p>';
  return `<p class="cl-legend">リーグフェーズ終了時：1〜8位＝ベスト16、9〜24位＝プレーオフ、25位以下＝敗退。色は現在の順位帯です。</p><div class="cl-table-scroll"><table class="cl-table"><thead><tr><th scope="col">順位</th><th scope="col">クラブ</th><th scope="col">試</th><th scope="col">勝</th><th scope="col">分</th><th scope="col">敗</th><th scope="col">得</th><th scope="col">失</th><th scope="col">差</th><th scope="col">点</th></tr></thead><tbody>${rows.map(r=>`<tr class="cl-zone-${r.rank<=8?'direct':r.rank<=24?'playoff':'out'} ${state.favorites.includes(r.team.id)?'favorite-row':''}"><td>${clEscape(r.rank)}</td><th scope="row"><button class="cl-team-button" data-open-team="${r.team.id}">${clEscape(teamName(r.team))}</button></th>${['played','win','draw','lose','goalsFor','goalsAgainst','goalsDiff','points'].map(k=>`<td>${clEscape(r[k]??'—')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function renderChampions() {
  const root=document.querySelector('#championsView');if(!root)return;
  const fixtures=(state.data?.fixtures||[]).filter(f=>f.leagueId===2);
  const rounds=[...new Set(fixtures.map(f=>f.round).filter(Boolean))];
  if(championsState.round!=='all'&&!rounds.includes(championsState.round))championsState.round='all';
  const league=(state.data?.leagues||[]).find(l=>l.id===2);
  const season=state.data?.season;
  const seasonLabel=season?`${season}/${String(Number(season)+1).slice(-2)}`:'';
  const matches=championsMatches(state.data);
  root.innerHTML=`<div class="cl-heading"><div><p class="eyebrow">UEFA CHAMPIONS LEAGUE</p><h2 id="championsTitle">チャンピオンズリーグ</h2><p class="muted">${clEscape(seasonLabel)} · 日本時間（JST）</p></div><button class="text-button" data-cl-home>クラブへ戻る</button></div><div class="chips cl-tabs">${[['matches','日程・結果'],['standings','順位表']].map(([key,label])=>`<button class="chip ${championsState.tab===key?'active':''}" data-cl-tab="${key}" aria-pressed="${championsState.tab===key}">${label}</button>`).join('')}</div>${!league?'<p class="cl-notice" role="status">CLデータの取得待ちです。「最新情報に更新」で公開データを再読み込みできます。</p>':''}${championsState.tab==='standings'?championsTable(state.data):`<div class="cl-controls"><label>表示<select id="clStatus"><option value="all">すべて</option><option value="upcoming">今後・試合中</option><option value="finished">終了した試合</option></select></label><label>ラウンド<select id="clRound"><option value="all">すべて</option>${rounds.map(r=>`<option value="${clEscape(r)}">${clEscape(r)}</option>`).join('')}</select></label><label class="cl-favorite"><input id="clFavorites" type="checkbox" ${championsState.favorites?'checked':''}>お気に入りのみ</label></div><p class="muted">${matches.length}試合 · お気に入りは5大リーグと共通</p><div class="stack cl-matches">${matches.length?matches.map(f=>`<div><p class="cl-kickoff">${clEscape(clDate(f.date))} JST</p>${matchCard(f,{rich:true})}</div>`).join(''):'<p class="empty">該当する試合はありません。条件を変更するか、更新後に確認してください。</p>'}</div>`}`;
  if(championsState.tab==='matches'){
    root.querySelector('#clStatus').value=championsState.status;
    root.querySelector('#clRound').value=championsState.round;
  }
}
const renderBeforeChampions=render;
render=function(){
  renderBeforeChampions();
  const active=state.view==='champions';
  document.querySelector('#championsView')?.classList.toggle('hidden',!active);
  if(active){document.querySelector('#onboarding')?.classList.add('hidden');renderChampions();}
};
// The standard standings tab must use CL advancement bands, not domestic relegation bands.
const standingsBeforeChampions=renderStandingsV100;
renderStandingsV100=function(){
  if(state.league!==2)return standingsBeforeChampions();
  const ids=(state.data?.standings||[]).map(s=>s.leagueId);
  document.querySelector('#standingsTabs').innerHTML=ids.map(id=>`<button class="chip ${id===2?'active':''}" data-standing-league="${id}">${clEscape(leagueNames[id]||id)}</button>`).join('');
  const tools=document.querySelector('#standingsToolsV100');if(tools)tools.innerHTML='';
  document.querySelector('#standingsTable').innerHTML=championsTable(state.data);
};
renderStandings=renderStandingsV100;
document.addEventListener('click',event=>{
  if(event.target.closest('[data-open-champions]')){event.preventDefault();state.view='champions';setActiveNav('');render();window.scrollTo({top:0});}
  if(event.target.closest('[data-cl-home]')){state.view='home';setActiveNav('home');render();}
  const tab=event.target.closest('[data-cl-tab]');if(tab){championsState.tab=tab.dataset.clTab;renderChampions();}
});
document.querySelector('#championsView')?.addEventListener('change',event=>{
  if(event.target.id==='clStatus')championsState.status=event.target.value;
  if(event.target.id==='clRound')championsState.round=event.target.value;
  if(event.target.id==='clFavorites')championsState.favorites=event.target.checked;
  renderChampions();
});
if(new URLSearchParams(location.search).get('view')==='champions'){state.view='champions';setActiveNav('');}
const clVersion=document.querySelector('.version');if(clVersion)clVersion.textContent='v1.1.15';
if(state.data)render();
