window.FootballUI=window.FootballUI||{};

(function(ns){
  const pad=value=>String(value).padStart(2,'0');
  const dayKey=value=>{const d=new Date(value);return Number.isNaN(d.getTime())?'':`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;};
  const readJson=(key,fallback=[])=>{try{return JSON.parse(localStorage.getItem(key)||JSON.stringify(fallback));}catch{return fallback;}};

  class FootballCalendar{
    constructor({root,title,prev,next,today=null,getMatches,getFavorites,getPrimary,getDate,getTeamVisual,onSelect}){
      this.root=root;this.title=title;this.prev=prev;this.next=next;this.today=today;
      this.getMatches=getMatches;this.getFavorites=getFavorites;this.getPrimary=getPrimary;
      this.getDate=getDate;this.getTeamVisual=getTeamVisual;this.onSelect=onSelect;
      this.cursor=new Date();this.selected='';this.bound=false;
    }
    bind(){if(this.bound)return;this.bound=true;
      this.prev?.addEventListener('click',()=>this.shift(-1));
      this.next?.addEventListener('click',()=>this.shift(1));
      this.today?.addEventListener('click',()=>{this.cursor=new Date();this.selected='';this.render();});
      this.root?.addEventListener('click',e=>{const b=e.target.closest('[data-calendar-day]');if(!b)return;this.selected=this.selected===b.dataset.calendarDay?'':b.dataset.calendarDay;this.onSelect?.(this.selected);this.render();});
    }
    shift(delta){this.cursor=new Date(this.cursor.getFullYear(),this.cursor.getMonth()+delta,1);this.selected='';this.onSelect?.('');this.render();}
    setCursor(value){const d=new Date(value);if(!Number.isNaN(d.getTime()))this.cursor=new Date(d.getFullYear(),d.getMonth(),1);}
    render(){if(!this.root)return;this.bind();
      const y=this.cursor.getFullYear(),m=this.cursor.getMonth();
      if(this.title)this.title.textContent=`${y}年${m+1}月`;
      const favorites=new Set((this.getFavorites?.()||[]).map(String));
      const primary=String(this.getPrimary?.()||'');
      const matches=(this.getMatches?.()||[]);
      const map=new Map();
      matches.forEach(match=>{const key=dayKey(this.getDate(match));if(!key)return;(map.get(key)||map.set(key,[]).get(key)).push(match);});
      const first=new Date(y,m,1),last=new Date(y,m+1,0),todayKey=dayKey(new Date());
      const cells=[];
      for(let i=0;i<first.getDay();i++)cells.push('<button class="football-calendar__day is-blank" type="button" disabled></button>');
      for(let day=1;day<=last.getDate();day++){
        const key=`${y}-${pad(m+1)}-${pad(day)}`,items=map.get(key)||[];
        const favoriteIds=[];
        items.forEach(item=>[item.home,item.away].forEach(team=>{const id=String(team?.id??team??'');if(favorites.has(id)&&!favoriteIds.includes(id))favoriteIds.push(id);}));
        const primaryMatch=primary&&favoriteIds.includes(primary);
        const marks=favoriteIds.slice(0,2).map(id=>{const v=this.getTeamVisual?.(id)||{};return v.logo?`<img src="${v.logo}" alt="">`:`<span>${v.label||'★'}</span>`;}).join('');
        const classes=['football-calendar__day',items.length?'has-match':'',favoriteIds.length?'has-favorite':'',primaryMatch?'has-primary':'',this.selected===key?'is-selected':'',todayKey===key?'is-today':''].filter(Boolean).join(' ');
        cells.push(`<button class="${classes}" data-calendar-day="${key}" type="button"><span>${day}</span>${items.length?`<b>${items.length}</b>`:''}${marks?`<small>${marks}</small>`:''}</button>`);
      }
      this.root.innerHTML=cells.join('');
    }
  }

  class BottomNavigation{
    constructor(root){this.root=root;}
    normalize(){if(!this.root)return;const items=[...this.root.querySelectorAll('.nav-item')];this.root.style.setProperty('--nav-count',items.length);items.forEach(item=>{const label=item.querySelector('span');if(label)item.setAttribute('aria-label',label.textContent.trim());});}
  }

  class FootballPageAdapter{
    constructor(){this.page=document.body.dataset.hub||this.detect();}
    detect(){if(document.querySelector('#calendarGrid'))return'five';if(document.querySelector('#jUpdated'))return'jleague';return'national';}
    async start(){new BottomNavigation(document.querySelector('.bottom-nav')).normalize();
      if(this.page==='five')return this.startFive();
      if(this.page==='jleague')return this.startJLeague();
      return this.startNational();
    }
    async json(path){const r=await fetch(`${path}?v=${Date.now()}`,{cache:'no-store'});if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.json();}
    startFive(){return this.json('./data/football.json').then(data=>{
      const calendar=new FootballCalendar({root:document.querySelector('#calendarGrid'),title:document.querySelector('#calendarTitle'),prev:document.querySelector('#calendarPrev'),next:document.querySelector('#calendarNext'),today:document.querySelector('#calendarToday'),getMatches:()=>data.fixtures||[],getFavorites:()=>readJson('matchHubFavorites',[]),getPrimary:()=>localStorage.getItem('matchHubPrimary')||'',getDate:m=>m.date,getTeamVisual:id=>{const t=(data.teams||[]).find(x=>String(x.id)===String(id));return{logo:t?.logo,label:'★'};},onSelect:key=>{const old=document.querySelector(`[data-calendar-day="${key}"]`);old?.dispatchEvent(new CustomEvent('football-calendar-select',{bubbles:true,detail:{key}}));}});calendar.render();new MutationObserver(()=>calendar.render()).observe(document.querySelector('#favoriteTeams')||document.body,{childList:true,subtree:true});
    });}
    startJLeague(){return this.json('./data/jleague.json').then(data=>{
      const calendar=new FootballCalendar({root:document.querySelector('#matchCalendar'),title:document.querySelector('#calendarTitle'),prev:document.querySelector('#calendarPrev'),next:document.querySelector('#calendarNext'),getMatches:()=>data.matches||[],getFavorites:()=>readJson('sportsHubFavoriteJClubs',[]),getPrimary:()=>'',getDate:m=>m.date,getTeamVisual:id=>{const team=(data.teams||[]).find(t=>String(t.id)===String(id));return{logo:team?.logo,label:'●'};},onSelect:key=>{window.dispatchEvent(new CustomEvent('shared-calendar-select',{detail:{key,page:'jleague'}}));}});calendar.render();
    });}
    startNational(){return this.json('./data/national-matches.json').then(data=>{
      const calendar=new FootballCalendar({root:document.querySelector('#matchCalendar'),title:document.querySelector('#calendarTitle'),prev:document.querySelector('#calendarPrev'),next:document.querySelector('#calendarNext'),getMatches:()=>data.matches||[],getFavorites:()=>readJson('sportsHubFavoriteNationals',[]),getPrimary:()=>'',getDate:m=>m.kickoff,getTeamVisual:id=>({label:(window.SportsHubNational?.find?.(id)?.flag)||'●'}),onSelect:key=>{window.dispatchEvent(new CustomEvent('shared-calendar-select',{detail:{key,page:'national'}}));}});calendar.render();
    });}
  }

  ns.FootballCalendar=FootballCalendar;ns.BottomNavigation=BottomNavigation;ns.FootballPageAdapter=FootballPageAdapter;
  document.addEventListener('DOMContentLoaded',()=>new FootballPageAdapter().start().catch(error=>console.warn('Shared football UI unavailable',error)));
})(window.FootballUI);