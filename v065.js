function renderCalendarV065(){
  const d=state.calendarDate,y=d.getFullYear(),m=d.getMonth(),first=new Date(y,m,1),last=new Date(y,m+1,0);
  const title=$('#calendarTitle');if(title)title.textContent=`${y}年 ${m+1}月`;
  const favoriteMatches=(state.data?.fixtures||[]).filter(f=>state.favorites.includes(f.home.id)||state.favorites.includes(f.away.id));
  const map={};for(const f of favoriteMatches){const k=dayKey(f.date);(map[k]??=[]).push(f);}
  let html='';
  for(let i=0;i<first.getDay();i++)html+='<button class="calendar-day blank" disabled></button>';
  for(let day=1;day<=last.getDate();day++){
    const date=new Date(y,m,day),k=dayKey(date),count=map[k]?.length||0,selected=state.calendarSelected===k,today=k===dayKey(new Date());
    html+=`<button class="calendar-day ${count?'has-match':''} ${selected?'selected':''} ${today?'today':''}" data-calendar-day="${k}" aria-label="${m+1}月${day}日${count?`、試合${count}件`:''}"><span>${day}</span>${count?'<i aria-hidden="true">⚽</i>':''}</button>`;
  }
  $('#calendarGrid').innerHTML=html;
  const selectedList=state.calendarSelected?(map[state.calendarSelected]||[]):[];
  const selectedDate=state.calendarSelected?new Date(`${state.calendarSelected}T00:00:00`):null;
  const heading=selectedDate?`<div class="calendar-selected-head"><strong>${selectedDate.toLocaleDateString('ja-JP',{month:'numeric',day:'numeric',weekday:'short'})}</strong><span>${selectedList.length}試合</span></div>`:'';
  $('#calendarMatches').innerHTML=state.calendarSelected?`${heading}${selectedList.map(f=>matchCard(f,{rich:true})).join('')||'<p class="empty compact-empty">この日の試合はありません</p>'}`:'<div class="calendar-guide"><strong>⚽の日をタップ</strong><span>お気に入りクラブの試合だけ表示します</span></div>';
}

renderCalendar=renderCalendarV065;

document.addEventListener('click',event=>{
  const todayButton=event.target.closest('#calendarToday');
  if(!todayButton)return;
  const now=new Date();
  state.calendarDate=new Date(now.getFullYear(),now.getMonth(),1);
  state.calendarSelected=dayKey(now);
  renderCalendar();
},true);

queueMicrotask(()=>{if(state.data)renderCalendar();});
