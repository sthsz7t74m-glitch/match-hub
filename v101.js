const baseRenderCalendarV101=renderCalendar;
renderCalendar=function(){
  baseRenderCalendarV101();
  document.querySelectorAll('[data-calendar-day]').forEach(button=>{
    button.querySelector('.primary-star-v101')?.remove();
    const key=button.dataset.calendarDay;
    const matches=(state.data?.fixtures||[]).filter(f=>dayKey(f.date)===key&&(state.favorites.includes(f.home.id)||state.favorites.includes(f.away.id)));
    const hasPrimary=matches.some(f=>f.home.id===state.primary||f.away.id===state.primary);
    button.classList.toggle('primary-day',hasPrimary);
    if(hasPrimary){
      const star=document.createElement('span');
      star.className='primary-star-v101';
      star.textContent='★';
      star.setAttribute('aria-label','最推しクラブの試合日');
      button.appendChild(star);
    }
  });
};
queueMicrotask(()=>{if(state.data)renderCalendar();});
