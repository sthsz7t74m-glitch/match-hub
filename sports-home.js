document.querySelectorAll('.coming-soon').forEach(card=>{
  card.addEventListener('click',()=>{
    const label=card.querySelector('h2')?.textContent?.trim()||'この競技';
    SportsHub.toast(`${label}は現在準備中です`,2200);
  });
});
SportsHub.applyTheme();