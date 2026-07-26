window.FootballUI=window.FootballUI||{};
(async function(ns){
  async function ensureCore(){
    if(window.FootballCore?.JsonRepository)return window.FootballCore;
    await new Promise((resolve,reject)=>{
      const existing=document.querySelector('script[data-football-core]');
      if(existing){existing.addEventListener('load',resolve,{once:true});existing.addEventListener('error',reject,{once:true});return;}
      const script=document.createElement('script');
      script.src='./assets/js/football-core.js?v=2';
      script.dataset.footballCore='true';
      script.onload=resolve;
      script.onerror=reject;
      document.head.appendChild(script);
    });
    return window.FootballCore;
  }

  const Core=await ensureCore();
  const pad=value=>String(value).padStart(2,'0');
  const dayKey=value=>new Core.MatchModel({date:value}).dateKey;
  const favoriteList=(key,legacyKey=null)=>new Core.FavoriteService({key,legacyKey}).list();

  class FootballCalendar{
    constructor({root,title,prev,next,today=null,getMatches,getFavorites,getPrimary,getDate,getTeamVisual,onSelect}){Object.assign(this,{root,title,prev,next,today,getMatches,getFavorites,getPrimary,getDate,getTeamVisual,onSelect});this.cursor=new Date();this.selected='';this.bound=false;}
    bind(){if(this.bound)return;this.bound=true;this.prev?.addEventListener('click',()=>this.shift(-1));this.next?.addEventListener('click',()=>this.shift(1));this.today?.addEventListener('click',()=>{this.cursor=new Date();this.selected='';this.onSelect?.('');this.render();});this.root?.addEventListener('click',event=>{const button=event.target.closest('[data-calendar-day]');if(!button)return;this.selected=this.selected===button.dataset.calendarDay?'':button.dataset.calendarDay;this.onSelect?.(this.selected);this.render();});}
    shift(delta){this.cursor=new Date(this.cursor.getFullYear(),this.cursor.getMonth()+delta,1);this.selected='';this.onSelect?.('');this.render();}
    setCursor(value){const date=new Date(value);if(!Number.isNaN(date.getTime()))this.cursor=new Date(date.getFullYear(),date.getMonth(),1);return this;}
    setSelected(value=''){this.selected=value;this.render();return this;}
    render(){
      if(!this.root)return;
      this.bind();
      const year=this.cursor.getFullYear(),month=this.cursor.getMonth();
      if(this.title)this.title.textContent=`${year}年${month+1}月`;
      const favorites=new Set((this.getFavorites?.()||[]).map(String));
      const primary=String(this.getPrimary?.()||'');
      const matches=this.getMatches?.()||[];
      const matchMap=new Map();
      matches.forEach(match=>{const key=dayKey(this.getDate(match));if(!key)return;if(!matchMap.has(key))matchMap.set(key,[]);matchMap.get(key).push(match);});
      const first=new Date(year,month,1),last=new Date(year,month+1,0),todayKey=dayKey(new Date()),cells=[];
      for(let index=0;index<first.getDay();index++)cells.push('<button class="football-calendar__day is-blank" type="button" disabled></button>');
      for(let day=1;day<=last.getDate();day++){
        const key=`${year}-${pad(month+1)}-${pad(day)}`;
        const items=matchMap.get(key)||[];
        const favoriteIds=[];
        items.forEach(item=>[item.home,item.away].forEach(team=>{const id=String(team?.id??team?.uid??team??'');if(favorites.has(id)&&!favoriteIds.includes(id))favoriteIds.push(id);}));
        const marks=favoriteIds.slice(0,2).map(id=>{const visual=this.getTeamVisual?.(id)||{};return visual.logo?`<img src="${visual.logo}" alt="">`:`<span>${visual.label||'★'}</span>`;}).join('');
        const classes=['football-calendar__day',items.length?'has-match':'',favoriteIds.length?'has-favorite':'',primary&&favoriteIds.includes(primary)?'has-primary':'',this.selected===key?'is-selected':'',todayKey===key?'is-today':''].filter(Boolean).join(' ');
        cells.push(`<button class="${classes}" data-calendar-day="${key}" data-date="${key}" type="button"><span>${day}</span>${items.length?`<b>${items.length}</b>`:''}${marks?`<small>${marks}</small>`:''}</button>`);
      }
      this.root.innerHTML=cells.join('');
    }
  }

  class BottomNavigation{
    constructor(root){this.root=root;}
    normalize(){if(!this.root)return;const items=[...this.root.querySelectorAll('.nav-item')];this.root.style.setProperty('--nav-count',items.length);items.forEach(item=>{const label=item.querySelector('span');if(label)item.setAttribute('aria-label',label.textContent.trim());});}
  }

  class FootballPageAdapter{
    constructor(){
      this.page=document.body.dataset.hub||this.detect();
      this.repositories={five:new Core.JsonRepository('./data/football.json'),jleague:new Core.JsonRepository('./data/jleague.json'),national:new Core.JsonRepository('./data/national-matches.json')};
    }
    detect(){if(document.querySelector('#calendarGrid'))return'five';if(document.querySelector('#jUpdated'))return'jleague';return'national';}
    async start(){new BottomNavigation(document.querySelector('.bottom-nav')).normalize();if(this.page==='five')return this.startFive();if(this.page==='jleague')return this.startJLeague();return this.startNational();}
    async startFive(){const data=await this.repositories.five.get();const service=new Core.MatchService(data.fixtures||[]);const calendar=new FootballCalendar({root:document.querySelector('#calendarGrid'),title:document.querySelector('#calendarTitle'),prev:document.querySelector('#calendarPrev'),next:document.querySelector('#calendarNext'),today:document.querySelector('#calendarToday'),getMatches:()=>service.all().map(model=>model.raw),getFavorites:()=>favoriteList('matchHubFavorites'),getPrimary:()=>localStorage.getItem('matchHubPrimary')||'',getDate:match=>match.date,getTeamVisual:id=>{const team=(data.teams||[]).find(item=>String(item.id)===String(id));return{logo:team?.logo,label:'★'};}});calendar.render();ns.calendar=calendar;}
    async startJLeague(){const data=await this.repositories.jleague.get();const service=new Core.MatchService(data.matches||[]);const calendar=new FootballCalendar({root:document.querySelector('#matchCalendar'),title:document.querySelector('#calendarTitle'),prev:document.querySelector('#calendarPrev'),next:document.querySelector('#calendarNext'),getMatches:()=>service.all().map(model=>model.raw),getFavorites:()=>favoriteList('sportsHubFavoriteJClubs','sportsHubFavoriteJClub'),getPrimary:()=>'',getDate:match=>match.date,getTeamVisual:id=>{const team=(data.teams||[]).find(item=>String(item.id)===String(id));return{logo:team?.logo,label:'●'};},onSelect:key=>document.dispatchEvent(new CustomEvent('football:calendar-select',{detail:{page:'jleague',date:key}}))});calendar.render();ns.calendar=calendar;}
    async startNational(){const data=await this.repositories.national.get();const service=new Core.MatchService(data.matches||[]);const calendar=new FootballCalendar({root:document.querySelector('#matchCalendar'),title:document.querySelector('#calendarTitle'),prev:document.querySelector('#calendarPrev'),next:document.querySelector('#calendarNext'),getMatches:()=>service.all().map(model=>model.raw),getFavorites:()=>favoriteList('sportsHubFavoriteNationals'),getPrimary:()=>'',getDate:match=>match.kickoff??match.date,getTeamVisual:id=>({label:window.SportsHubNational?.find?.(id)?.flag||'●'}),onSelect:key=>document.dispatchEvent(new CustomEvent('football:calendar-select',{detail:{page:'national',date:key}}))});calendar.render();ns.calendar=calendar;}
  }

  Object.assign(ns,{FootballCalendar,BottomNavigation,FootballPageAdapter});
  const boot=()=>new FootballPageAdapter().start().catch(error=>console.warn('Shared football UI unavailable',error));
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot,{once:true}):boot();
})(window.FootballUI);