document.addEventListener('click',event=>{
  const homeButton=event.target.closest('[data-view="home"]');
  if(!homeButton)return;
  requestAnimationFrame(()=>requestAnimationFrame(()=>window.scrollTo({top:0,left:0,behavior:'smooth'})));
},true);
