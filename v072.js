const baseRenderV072=render;
render=function(){
  baseRenderV072();
  const transfers=document.querySelector('#transfersView');
  if(transfers)transfers.classList.toggle('hidden',state.view!=='transfers');
};

openTransferView=function(){
  state.view='transfers';
  ['#homeView','#teamDetailView','#standingsView','#searchView','#settingsView','#onboarding'].forEach(selector=>document.querySelector(selector)?.classList.add('hidden'));
  document.querySelector('#transfersView')?.classList.remove('hidden');
  document.querySelectorAll('.nav-item').forEach(item=>item.classList.toggle('active',item.dataset.view==='transfers'));
  renderTransfers();
  window.scrollTo({top:0,behavior:'smooth'});
};

renderFavorites=function(){
  const ids=state.favorites.filter(id=>id!==state.primary);
  $('#favoriteTeams').innerHTML=ids.map(id=>{
    const t=getTeam(id);if(!t)return'';
    const next=fixturesFor(id).find(f=>new Date(f.date)>new Date()&&!isFinished(f));
    const rank=leagueStarted(t.leagueId)?getRank(id):null;
    return `<article class="team-card reorder-card"><button class="team-open-area" data-open-team="${id}"><div class="team-row"><img class="team-logo" src="${t.logo}" alt=""><div class="team-meta"><div class="team-name">${teamName(t)} <span class="inline-rank">${rank?rank+'位':'開幕前'}</span></div><div class="english-name">${t.name}</div></div></div></button><div class="team-actions"><button class="mini-button" data-move="up" data-move-id="${id}" aria-label="上へ移動">↑</button><button class="mini-button" data-move="down" data-move-id="${id}" aria-label="下へ移動">↓</button><button class="mini-button" data-primary-id="${id}">★ 最推し</button><button class="mini-button danger" data-remove-id="${id}">解除</button></div>${next?matchCard(next,{teamId:id}):'<p class="empty compact-empty">次戦未定</p>'}</article>`;
  }).join('')||'<p class="empty">ほかのお気に入りはまだありません</p>';
};

queueMicrotask(()=>{if(state.data)render();});
