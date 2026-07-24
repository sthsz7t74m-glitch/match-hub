function setupHomeV067(){
  const home=document.querySelector('#homeView');
  const live=document.querySelector('#liveSection');
  const overview=document.querySelector('#dailyOverview');
  const hero=document.querySelector('#favoriteHero');
  if(home&&live&&overview&&hero){
    home.insertBefore(live,home.firstChild);
    if(hero.nextElementSibling!==overview)home.insertBefore(overview,hero.nextSibling);
  }
  const calendar=document.querySelector('.calendar-panel');
  if(calendar&&!calendar.querySelector('.calendar-collapse-button')){
    const head=calendar.querySelector('.calendar-head');
    const body=document.createElement('div');
    body.className='calendar-body';
    [...calendar.children].filter(el=>el!==head).forEach(el=>body.appendChild(el));
    calendar.appendChild(body);
    const button=document.createElement('button');
    button.type='button';button.className='mini-button calendar-collapse-button';button.textContent='カレンダーを開く';button.setAttribute('aria-expanded','false');
    head.appendChild(button);calendar.classList.add('is-collapsed');
    button.addEventListener('click',()=>{const collapsed=calendar.classList.toggle('is-collapsed');button.textContent=collapsed?'カレンダーを開く':'カレンダーを閉じる';button.setAttribute('aria-expanded',String(!collapsed));});
  }
  if(home&&!home.querySelector('.home-quick-actions')){
    const actions=document.createElement('div');actions.className='home-quick-actions';
    actions.innerHTML='<button class="text-button" data-home-jump="schedule">試合日程を見る</button><button class="text-button" data-home-jump="calendar">カレンダーを見る</button>';
    const favoritesHeading=home.querySelector('.section-heading');favoritesHeading?.before(actions);
  }
}
document.addEventListener('click',event=>{const button=event.target.closest('[data-home-jump]');if(!button)return;if(button.dataset.homeJump==='schedule'){document.querySelector('#scheduleList')?.scrollIntoView({behavior:'smooth',block:'start'});}else{const calendar=document.querySelector('.calendar-panel');calendar?.classList.remove('is-collapsed');const toggle=calendar?.querySelector('.calendar-collapse-button');if(toggle){toggle.textContent='カレンダーを閉じる';toggle.setAttribute('aria-expanded','true');}calendar?.scrollIntoView({behavior:'smooth',block:'start'});}},true);
const observer=new MutationObserver(setupHomeV067);observer.observe(document.body,{childList:true,subtree:true});queueMicrotask(setupHomeV067);