const countries=[
{id:'japan',name:'日本',en:'Japan',flag:'🇯🇵',region:'asia'},
{id:'korea',name:'韓国',en:'South Korea',flag:'🇰🇷',region:'asia'},
{id:'australia',name:'オーストラリア',en:'Australia',flag:'🇦🇺',region:'asia'},
{id:'argentina',name:'アルゼンチン',en:'Argentina',flag:'🇦🇷',region:'south-america'},
{id:'brazil',name:'ブラジル',en:'Brazil',flag:'🇧🇷',region:'south-america'},
{id:'uruguay',name:'ウルグアイ',en:'Uruguay',flag:'🇺🇾',region:'south-america'},
{id:'england',name:'イングランド',en:'England',flag:'🏴',region:'europe'},
{id:'france',name:'フランス',en:'France',flag:'🇫🇷',region:'europe'},
{id:'germany',name:'ドイツ',en:'Germany',flag:'🇩🇪',region:'europe'},
{id:'spain',name:'スペイン',en:'Spain',flag:'🇪🇸',region:'europe'},
{id:'italy',name:'イタリア',en:'Italy',flag:'🇮🇹',region:'europe'},
{id:'portugal',name:'ポルトガル',en:'Portugal',flag:'🇵🇹',region:'europe'},
{id:'netherlands',name:'オランダ',en:'Netherlands',flag:'🇳🇱',region:'europe'},
{id:'usa',name:'アメリカ',en:'United States',flag:'🇺🇸',region:'north-america'},
{id:'mexico',name:'メキシコ',en:'Mexico',flag:'🇲🇽',region:'north-america'},
{id:'canada',name:'カナダ',en:'Canada',flag:'🇨🇦',region:'north-america'},
{id:'morocco',name:'モロッコ',en:'Morocco',flag:'🇲🇦',region:'africa'},
{id:'senegal',name:'セネガル',en:'Senegal',flag:'🇸🇳',region:'africa'},
{id:'nigeria',name:'ナイジェリア',en:'Nigeria',flag:'🇳🇬',region:'africa'}
];
const regions=[['all','すべて'],['asia','アジア'],['europe','欧州'],['south-america','南米'],['north-america','北中米'],['africa','アフリカ']];
const favoriteKey='sportsHubFavoriteNational';
let activeRegion='all';
let query='';
const grid=document.querySelector('#countryGrid');
const filters=document.querySelector('#regionFilters');
const search=document.querySelector('#countrySearch');
const title=document.querySelector('#favoriteTitle');
const description=document.querySelector('#favoriteDescription');
const flag=document.querySelector('#favoriteFlag');
const clearButton=document.querySelector('#clearFavorite');
const hero=document.querySelector('#favoriteHero');
const heroOpenLabel=document.querySelector('#heroOpenLabel');
const favorite=()=>countries.find(country=>country.id===SportsHub.storage.get(favoriteKey));
const openDetail=id=>{location.href=`./national-detail.html?team=${encodeURIComponent(id)}`;};
function renderHero(){
  const selected=favorite();
  title.textContent=selected?`${selected.name}代表`:'推し代表を選ぼう';
  description.textContent=selected?`${selected.en}を推し代表に登録中`:'好きな国を登録すると、この画面の先頭に固定されます。';
  flag.textContent=selected?.flag||'🌍';
  clearButton.classList.toggle('hidden',!selected);
  heroOpenLabel.classList.toggle('hidden',!selected);
  hero.classList.toggle('has-favorite',Boolean(selected));
}
function renderFilters(){filters.innerHTML=regions.map(([id,label])=>`<button class="chip${activeRegion===id?' active':''}" type="button" data-region="${id}">${label}</button>`).join('');}
function renderCountries(){
  const selected=favorite();
  const normalized=query.trim().toLowerCase();
  const visible=countries.filter(country=>(activeRegion==='all'||country.region===activeRegion)&&(!normalized||country.name.includes(query.trim())||country.en.toLowerCase().includes(normalized)));
  grid.innerHTML=visible.map(country=>`<article class="country-card${selected?.id===country.id?' selected':''}" data-country="${country.id}"><span class="flag" aria-hidden="true">${country.flag}</span><button class="country-copy" type="button" data-open-country="${country.id}"><strong>${country.name}</strong><small>${country.en}</small></button><button class="favorite-button${selected?.id===country.id?' active':''}" type="button" data-favorite-country="${country.id}" aria-label="${country.name}代表を推し登録">${selected?.id===country.id?'★':'☆'}</button></article>`).join('')||'<div class="empty-state"><strong>該当する代表がありません</strong><p>検索条件を変えてみてください。</p></div>';
}
function render(){renderHero();renderFilters();renderCountries();}
filters.addEventListener('click',event=>{const button=event.target.closest('[data-region]');if(!button)return;activeRegion=button.dataset.region;renderFilters();renderCountries();});
grid.addEventListener('click',event=>{
  const favoriteButton=event.target.closest('[data-favorite-country]');
  if(favoriteButton){const country=countries.find(item=>item.id===favoriteButton.dataset.favoriteCountry);const current=SportsHub.storage.get(favoriteKey);if(current===country.id){SportsHub.storage.remove(favoriteKey);SportsHub.toast('推し代表を解除しました');}else{SportsHub.storage.set(favoriteKey,country.id);SportsHub.toast(`${country.name}代表を登録しました`);}render();return;}
  const openButton=event.target.closest('[data-open-country]');
  if(openButton)openDetail(openButton.dataset.openCountry);
});
hero.addEventListener('click',()=>{const selected=favorite();if(selected)openDetail(selected.id);});
hero.addEventListener('keydown',event=>{if((event.key==='Enter'||event.key===' ')&&favorite()){event.preventDefault();openDetail(favorite().id);}});
search.addEventListener('input',()=>{query=search.value;renderCountries();});
clearButton.addEventListener('click',event=>{event.stopPropagation();SportsHub.storage.remove(favoriteKey);render();SportsHub.toast('推し代表を解除しました');});
SportsHub.applyTheme();
render();