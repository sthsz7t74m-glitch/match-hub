let favoritesOnlyV080=false;
const uiPrefsV080={
  showEnglish:localStorage.getItem('matchHubShowEnglish')!=='false',
  density:localStorage.getItem('matchHubDensity')||'standard'
};
function applyUiPrefsV080(){
  document.documentElement.classList.toggle('hide-english',!uiPrefsV080.showEnglish);
  document.documentElement.classList.toggle('compact-mode',uiPrefsV080.density==='compact');
  const english=document.querySelector('#showEnglishToggle');if(english)english.checked=uiPrefsV080.showEnglish;
  const density=document.querySelector('#densitySelect');if(density)density.value=uiPrefsV080.density;
}
function renderGlobalSearchV080(){
  const input=document.querySelector('#globalTeamSearch');
  const q=(input?.value||'').trim().toLowerCase();
  let teams=(state.data?.teams||[]).filter(t=>(state.searchLeague===null||t.leagueId===state.searchLeague)&&matchesQuery(t,q));
  if(favoritesOnlyV080)teams=teams.filter(t=>state.favorites.includes(t.id));
  teams.sort((a,b)=>Number(state.favorites.includes(b.id))-Number(state.favorites.includes(a.id))||teamName(a).localeCompare(teamName(b),'ja'));
  const count=document.querySelector('#globalSearchCount');if(count)count.textContent=`${teams.length}クラブ`;
  const list=document.querySelector('#globalTeamResults');if(list)list.innerHTML=teams.map(t=>pickerCard(t,false)).join('')||'<p class="empty">チームが見つかりません</p>';
}
renderGlobalSearch=renderGlobalSearchV080;
document.addEventListener('click',event=>{
  const favoriteFilter=event.target.closest('#favoritesOnlyToggle');
  if(favoriteFilter){favoritesOnlyV080=!favoritesOnlyV080;favoriteFilter.classList.toggle('active',favoritesOnlyV080);favoriteFilter.setAttribute('aria-pressed',String(favoritesOnlyV080));renderGlobalSearchV080();return;}
  const resetOrder=event.target.closest('#resetFavoriteOrder');
  if(resetOrder){const rest=state.favorites.filter(id=>id!==state.primary).sort((a,b)=>teamName(getTeam(a)).localeCompare(teamName(getTeam(b)),'ja'));state.favorites=[state.primary,...rest];save();renderFavorites();}
},true);
document.addEventListener('change',event=>{
  if(event.target.matches('#showEnglishToggle')){uiPrefsV080.showEnglish=event.target.checked;localStorage.setItem('matchHubShowEnglish',String(uiPrefsV080.showEnglish));applyUiPrefsV080();}
  if(event.target.matches('#densitySelect')){uiPrefsV080.density=event.target.value;localStorage.setItem('matchHubDensity',uiPrefsV080.density);applyUiPrefsV080();}
});
queueMicrotask(()=>{applyUiPrefsV080();if(state.data)renderGlobalSearchV080();});