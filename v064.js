function renderDailyOverview(){
  const root=document.querySelector('#dailyOverview');
  if(!root||!state?.data)return;
  const now=new Date();
  const todayEnd=new Date(now);todayEnd.setHours(23,59,59,999);
  const weekEnd=new Date(now);weekEnd.setDate(now.getDate()+7);
  const favFixtures=(state.data.fixtures||[]).filter(f=>state.favorites.includes(f.home.id)||state.favorites.includes(f.away.id));
  const today=favFixtures.filter(f=>new Date(f.date)>=now&&new Date(f.date)<=todayEnd);
  const week=favFixtures.filter(f=>new Date(f.date)>=now&&new Date(f.date)<=weekEnd);
  const live=favFixtures.filter(isLive);
  const next=favFixtures.filter(f=>new Date(f.date)>now&&!isFinished(f)).sort((a,b)=>new Date(a.date)-new Date(b.date))[0];
  root.innerHTML=`<div class="daily-overview-head"><div><p class="eyebrow">TODAY'S FOOTBALL</p><h2>今日のサッカー</h2></div>${live.length?'<span class="daily-live">LIVE</span>':''}</div><div class="daily-stats"><button data-range-shortcut="today"><strong>${today.length}</strong><span>今日の試合</span></button><button data-range-shortcut="week"><strong>${week.length}</strong><span>今週の試合</span></button><div class="${live.length?'is-live':''}"><strong>${live.length}</strong><span>LIVE</span></div></div>${next?`<button class="daily-next" data-fixture="${next.id}"><span>次の試合</span><strong>${teamName(next.home)} vs ${teamName(next.away)}</strong><small>${new Date(next.date).toLocaleString('ja-JP',{month:'numeric',day:'numeric',weekday:'short',hour:'2-digit',minute:'2-digit'})} ・ あと ${countdownText(next.date)}</small></button>`:'<p class="daily-empty">今後の試合は未定です</p>'}`;
}

const originalRender=render;
render=function(){originalRender();renderDailyOverview();};

document.addEventListener('click',event=>{
  const shortcut=event.target.closest('[data-range-shortcut]');
  if(!shortcut)return;
  state.range=shortcut.dataset.rangeShortcut;
  document.querySelectorAll('[data-range]').forEach(button=>button.classList.toggle('active',button.dataset.range===state.range));
  renderSchedule();
  document.querySelector('#scheduleList')?.scrollIntoView({behavior:'smooth',block:'start'});
});

setInterval(()=>{if(!document.hidden)renderDailyOverview();},60000);
