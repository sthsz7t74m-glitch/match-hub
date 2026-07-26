window.FootballUI=window.FootballUI||{};
(function(ns){
  const Core=window.FootballCore||{};
  const pad=value=>String(value).padStart(2,'0');
  const dayKey=value=>{const model=Core.MatchModel?new Core.MatchModel({date:value}):null;if(model?.dateKey)return model.dateKey;const d=new Date(value);return Number.isNaN(d.getTime())?'':`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;};
  const favoriteList=key=>Core.FavoriteService?new Core.FavoriteService({key}).list():(()=>{try{return JSON.parse(localStorage.getItem(key)||'[]');}catch{return[];}})();
  const jClubTeamIds={'fc-tokyo':'3384','tokyo-verdy':'3393','machida':'22167','yokohama-fm':'7116','kashima':'7115','mito':'131701','urawa':'3385','chiba':'7111','kashiwa':'7476','kawasaki':'7112','shimizu':'7104','nagoya':'7108','kyoto':'21361','gamba':'7102','cerezo':'7109','kobe':'7477','okayama':'22522','hiroshima':'7114','fukuoka':'7107','nagasaki':'19001'};
  const shellConfigs={
    jleague:{eyebrow:'JAPAN PROFESSIONAL FOOTBALL',title:'Jリーグ',version:'v3.0.6',back:'./sports-home.html',nav:[['home','⌂','ホーム'],['schedule','▤','日程'],['standings','≡','順位'],['clubs','⌕','クラブ'],['favorites','★','推し','favoriteCountBadge']]},
    national:{eyebrow:'NATIONAL TEAMS',title:'各国代表',version:'v3.1.4',back:'./sports-home.html',nav:[['home','⌂','ホーム'],['schedule','▤','日程'],['teams','⌕','代表'],['competitions','🏆','大会'],['favorites','★','推し','favoriteCountBadge']]}
  };

  class BottomNavigation{constructor(root){this.root=root;}normalize(){if(!this.root)return;const items=[...this.root.querySelectorAll('.nav-item')];this.root.style.setProperty('--nav-count',items.length);items.forEach(item=>{const label=item.querySelector('span');if(label)item.setAttribute('aria-label',label.textContent.trim());});}}

  class FootballShell{
    constructor(page=document.body.dataset.hub){this.page=page;this.config=shellConfigs[page];}
    renderHeader(){const root=document.querySelector('.topbar');if(!root||!this.config)return;root.innerHTML=`<div style="display:flex;align-items:center;gap:10px"><a class="back-link" href="${this.config.back}" aria-label="Sports Hubへ戻る">←</a><div><p class="eyebrow">${this.config.eyebrow}</p><h1>${this.config.title} <span class="version">${this.config.version}</span></h1></div></div><div class="topbar__actions"><button id="themeButton" class="icon-button" type="button" aria-label="テーマ切替">◐</button></div>`;}
    renderNavigation(){const root=document.querySelector('#pageTabs');if(!root||!this.config)return;root.innerHTML=this.config.nav.map(([page,icon,label,badge],index)=>`<button class="nav-item hub-nav__item${index===0?' active':''}" data-page="${page}" type="button">${icon}<span>${label}${badge?` <b id="${badge}">0</b>`:''}</span></button>`).join('');root.setAttribute('aria-label',`${this.config.title}メニュー`);new BottomNavigation(root).normalize();}
    render(){this.renderHeader();this.renderNavigation();}
  }

  class FootballCalendar{
    constructor({root,title,prev,next,today=null,getMatches,getFavorites,getPrimary,getDate,getTeamVisual,onSelect}){Object.assign(this,{root,title,prev,next,today,getMatches,getFavorites,getPrimary,getDate,getTeamVisual,onSelect});this.cursor=new Date();this.selected='';this.bound=false;}
    bind(){if(this.bound)return;this.bound=true;this.prev?.addEventListener('click',()=>this.shift(-1));this.next?.addEventListener('click',()=>this.shift(1));this.today?.addEventListener('click',()=>this.goToday());this.root?.addEventListener('click',e=>{const b=e.target.closest('[data-calendar-day]');if(!b)return;this.select(this.selected===b.dataset.calendarDay?'':b.dataset.calendarDay);});}
    emit(){this.onSelect?.(this.selected);document.dispatchEvent(new CustomEvent('football:calendar-select',{detail:{date:this.selected,calendar:this}}));}
    select(date=''){this.selected=date;this.emit();this.render();}
    clearSelection(){this.select('');}
    goToday(){this.cursor=new Date();this.select('');}
    shift(delta){this.cursor=new Date(this.cursor.getFullYear(),this.cursor.getMonth()+delta,1);this.select('');}
    setCursor(value){const d=new Date(value);if(!Number.isNaN(d.getTime()))this.cursor=new Date(d.getFullYear(),d.getMonth(),1);this.render();}
    render(){if(!this.root)return;this.bind();const y=this.cursor.getFullYear(),m=this.cursor.getMonth();if(this.title)this.title.textContent=`${y}年${m+1}月`;const favorites=new Set((this.getFavorites?.()||[]).map(String)),primary=String(this.getPrimary?.()||''),matches=this.getMatches?.()||[],map=new Map();matches.forEach(match=>{const key=dayKey(this.getDate(match));if(!key)return;if(!map.has(key))map.set(key,[]);map.get(key).push(match);});const first=new Date(y,m,1),last=new Date(y,m+1,0),todayKey=dayKey(new Date()),cells=[];for(let i=0;i<first.getDay();i++)cells.push('<button class="football-calendar__day is-blank" type="button" disabled></button>');for(let day=1;day<=last.getDate();day++){const key=`${y}-${pad(m+1)}-${pad(day)}`,items=map.get(key)||[],favoriteIds=[];items.forEach(item=>[item.home,item.away].forEach(team=>{const id=String(team?.id??team??'');if(favorites.has(id)&&!favoriteIds.includes(id))favoriteIds.push(id);}));const primaryMatch=primary&&favoriteIds.includes(primary),marks=favoriteIds.slice(0,2).map(id=>{const v=this.getTeamVisual?.(id)||{};return v.logo?`<img src="${v.logo}" alt="">`:`<span>${v.label||'★'}</span>`;}).join(''),classes=['football-calendar__day',items.length?'has-match':'',favoriteIds.length?'has-favorite':'',primaryMatch?'has-primary':'',this.selected===key?'is-selected':'',todayKey===key?'is-today':''].filter(Boolean).join(' ');cells.push(`<button class="${classes}" data-calendar-day="${key}" data-date="${key}" type="button"><span>${day}</span>${items.length?`<b>${items.length}</b>`:''}${marks?`<small>${marks}</small>`:''}</button>`);}this.root.innerHTML=cells.join('');}
  }

  class FootballPageAdapter{
    constructor(){this.page=document.body.dataset.hub||this.detect();this.repositories={five:new Core.JsonRepository('./data/football.json'),jleague:new Core.JsonRepository('./data/jleague.json'),national:new Core.JsonRepository('./data/national-matches.json')};}
    detect(){if(document.querySelector('#calendarGrid'))return'five';if(document.querySelector('#jUpdated'))return'jleague';return'national';}
    async start(){if(this.page==='five')return this.startFive();if(this.page==='jleague')return this.startJLeague();return this.startNational();}
    register(calendar){ns.calendars=ns.calendars||{};ns.calendars[this.page]=calendar;calendar.render();return calendar;}
    startFive(){return this.repositories.five.get().then(data=>this.register(new FootballCalendar({root:document.querySelector('#calendarGrid'),title:document.querySelector('#calendarTitle'),prev:document.querySelector('#calendarPrev'),next:document.querySelector('#calendarNext'),today:document.querySelector('#calendarToday'),getMatches:()=>data.fixtures||[],getFavorites:()=>favoriteList('matchHubFavorites'),getPrimary:()=>localStorage.getItem('matchHubPrimary')||'',getDate:m=>m.date,getTeamVisual:id=>{const t=(data.teams||[]).find(x=>String(x.id)===String(id));return{logo:t?.logo,label:'★'};}})));}
    startJLeague(){return this.repositories.jleague.get().then(data=>this.register(new FootballCalendar({root:document.querySelector('#matchCalendar'),title:document.querySelector('#calendarTitle'),prev:document.querySelector('#calendarPrev'),next:document.querySelector('#calendarNext'),getMatches:()=>data.matches||[],getFavorites:()=>favoriteList('sportsHubFavoriteJClubs').map(id=>jClubTeamIds[id]||id),getPrimary:()=>'',getDate:m=>m.date,getTeamVisual:id=>{const team=(data.teams||[]).find(t=>String(t.id)===String(id));return{logo:team?.logo,label:window.SportsHubJLeague?.find?.(Object.keys(jClubTeamIds).find(key=>jClubTeamIds[key]===String(id))||String(id))?.mark||'●'};}})));}
    startNational(){return this.repositories.national.get().then(data=>this.register(new FootballCalendar({root:document.querySelector('#matchCalendar'),title:document.querySelector('#calendarTitle'),prev:document.querySelector('#calendarPrev'),next:document.querySelector('#calendarNext'),getMatches:()=>data.matches||[],getFavorites:()=>favoriteList('sportsHubFavoriteNationals'),getPrimary:()=>'',getDate:m=>m.kickoff,getTeamVisual:id=>({label:window.SportsHubNational?.find?.(id)?.flag||'●'})})));}
  }

  Object.assign(ns,{FootballCalendar,BottomNavigation,FootballShell,FootballPageAdapter});
  new FootballShell(document.body.dataset.hub).render();
  document.addEventListener('DOMContentLoaded',()=>new FootballPageAdapter().start().catch(error=>console.warn('Shared football UI unavailable',error)));
})(window.FootballUI);