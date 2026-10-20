document.addEventListener('click',event=>{
  const homeButton=event.target.closest('[data-view="home"]');
  if(!homeButton)return;
  window.scrollTo({top:0,left:0,behavior:'instant'});
},true);
