const favoriteListExpandedV090=()=>localStorage.getItem('matchHubFavoritesExpanded')==='true';
let favoritesExpandedV090=favoriteListExpandedV090();

function scrollTopV090(behavior='smooth'){
  requestAnimationFrame(()=>requestAnimationFrame(()=>window.scrollTo({top:0,left:0,behavior})));
}

function favoriteTransferCountV090(){
  if(typeof transferData==='undefined'||!Array.isArray(transferData.items))return 0;
  const favs=typeof favoriteText==='function'?favoriteText():'';
  return transferData.items.filter(item=>typeof relevance==='function'&&relevance(item,favs)).length;
}

function renderDailyOverviewV090(){
  const root=document.querySelector('#dailyOverview');
  if(!root||!state.data)return;
  const now=new Date(),today=dayKey(now);
  const favoriteFixtures=(state.data.fixtures||[]).filter(f=>state.favorites.includes(f.home.id)||state.favorites.includes(f.away.id));
  const todayMatches=favoriteFixtures.filter(f=>dayKey(f.date)===today);
  const liveMatches=favoriteFixtures.filter(isLive);
  const primaryNext=fixturesFor(state.primary).find(f=>new Date(f.date)>now&&!isFinished(f));
  const nextText=primaryNext?countdownText(primaryNext.date).replace(/\s+/g,' '):'未定';
  const transferCount=favoriteTransferCountV090();
  root.innerHTML=`<div class="overview-head"><div><p class="eyebrow">TODAY'S FOOTBALL</p><h2>今日のサッカー</h2></div><span>${now.toLocaleDateString('ja-JP',{month:'numeric',day:'numeric',weekday:'short'})}</span></div><div class="overview-grid"><button class="overview-item" data-overview-target="schedule"><span>今日の試合</span><strong>${todayMatches.length}</strong><small>試合</small></button><button class="overview-item ${liveMatches.length?'has-live':''}" data-overview-target="live"><span>LIVE中</span><strong>${liveMatches.length}</strong><small>試合</small></button><button class="overview-item wide" data-overview-target="primary"><span>最推しの次戦</span><strong>${nextText}</strong><small>${primaryNext?teamName(primaryNext.home)+' vs '+teamName(primaryNext.away):'日程未定'}</small></button><button class="overview-item wide" data-overview-target="transfers"><span>お気に入り関連の移籍</span><strong>${transferCount}</strong><small>件のニュース</small></button></div>`;
}

function renderFavoritesV090(){
  const allIds=state.favorites.filter(id=>id!==state.primary);
  const ids=favoritesExpandedV090?allIds:allIds.slice(0,3);
  const list=document.querySelector('#favoriteTeams');
  if(!list)return;
  const cards=ids.map(id=>{
    const t=getTeam(id);if(!t)return'';
    const next=fixturesFor(id).find(f=>new Date(f.date)>new Date()&&!isFinished(f));
    const rank=leagueStarted(t.leagueId)?getRank(id):null;
    return `<article class="team-card reorder-card"><button class="team-open-area" data-open-team="${id}"><div class="team-row"><img class="team-logo" src="${t.logo}" alt=""><div class="team-meta"><div class="team-name">${teamName(t)} <span class="inline-rank">${rank?rank+'位':'開幕前'}</span></div><div class="english-name">${t.name}</div></div></div></button><div class="team-actions"><button class="mini-button" data-move="up" data-move-id="${id}" aria-label="上へ移動">↑</button><button class="mini-button" data-move="down" data-move-id="${id}" aria-label="下へ移動">↓</button><button class="mini-button" data-primary-id="${id}">★ 最推し</button><button class="mini-button danger" data-remove-id="${id}">解除</button></div>${next?matchCard(next,{teamId:id}):'<p class="empty compact-empty">次戦未定</p>'}</article>`;
  }).join('');
  const toggle=allIds.length>3?`<button id="favoriteExpandToggle" class="favorite-expand-button" type="button">${favoritesExpandedV090?'▲ 閉じる':'▼ すべて見る'}<span>${allIds.length}クラブ</span></button>`:'';
  list.innerHTML=(cards||'<p class="empty">ほかのお気に入りはまだありません</p>')+toggle;
}

renderFavorites=renderFavoritesV090;
const baseRenderV090=render;
render=function(){baseRenderV090();renderDailyOverviewV090();};

function activateViewV090(target){
  if(target==='schedule'){
    state.view='home';setActiveNav('schedule');render();
    setTimeout(()=>document.querySelector('.tabs')?.scrollIntoView({behavior:'smooth',block:'start'}),40);
    return;
  }
  state.view=target;setActiveNav(target);render();scrollTopV090();
}

document.addEventListener('click',event=>{
  const toggle=event.target.closest('#favoriteExpandToggle');
  if(toggle){favoritesExpandedV090=!favoritesExpandedV090;localStorage.setItem('matchHubFavoritesExpanded',String(favoritesExpandedV090));renderFavoritesV090();return;}
  const overview=event.target.closest('[data-overview-target]');
  if(overview){
    const target=overview.dataset.overviewTarget;
    if(target==='schedule'){state.range='today';document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x.dataset.range==='today'));renderSchedule();activateViewV090('schedule');}
    else if(target==='live'){state.view='home';setActiveNav('home');render();setTimeout(()=>document.querySelector('#liveSection')?.scrollIntoView({behavior:'smooth',block:'start'}),40);}
    else if(target==='primary'){document.querySelector('#favoriteHero')?.scrollIntoView({behavior:'smooth',block:'start'});}
    else if(target==='transfers'){if(typeof openTransferView==='function')openTransferView();}
    return;
  }
  const nav=event.target.closest('.nav-item[data-view]');
  if(!nav||nav.dataset.view==='transfers')return;
  event.preventDefault();event.stopImmediatePropagation();
  const target=nav.dataset.view;
  const alreadyActive=nav.classList.contains('active');
  if(alreadyActive&&target!=='schedule'){scrollTopV090();return;}
  activateViewV090(target);
},true);

const baseRenderTransfersV090=typeof renderTransfers==='function'?renderTransfers:null;
if(baseRenderTransfersV090){renderTransfers=function(){baseRenderTransfersV090();renderDailyOverviewV090();};}
queueMicrotask(()=>{if(state.data){renderFavoritesV090();renderDailyOverviewV090();}});