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
const key='sportsHubFavoriteNational';
let activeRegion='all';
let query='';
const grid=document.querySelector('#countryGrid');
const filters=document.querySelector('#regionFilters');
const search=document.querySelector('#countrySearch');
const title=document.querySelector('#favoriteTitle');
const desc=document.querySelector('#favoriteDescription');
const flag=document.querySelector('#favoriteFlag');
const clear=document.querySelector('#clearFavorite');
const toast=document.querySelector('#toast');
function favorite(){return countries.find(c=>c.id===localStorage.getItem(key));}
function showToast(message){toast.textContent=message;toast.classList.add('show');clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>toast.classList.remove('show'),1800);}
function renderHero(){const selected=favorite();if(!selected){title.textContent='推し代表を選ぼう';desc.textContent='好きな国を登録すると、この画面の先頭に固定されます。';flag.textContent='🌍';clear.classList.add('hidden');return;}title.textContent=`${selected.name}代表`;desc.textContent=`${selected.en}を推し代表に登録中`;flag.textContent=selected.flag;clear.classList.remove('hidden');}
function renderFilters(){filters.innerHTML=regions.map(([id,label])=>`<button class="chip${activeRegion===id?' active':''}" type="button" data-region="${id}">${label}</button>`).join('');}
function renderCountries(){const selected=favorite();const normalized=query.trim().toLowerCase();const visible=countries.filter(c=>(activeRegion==='all'||c.region===activeRegion)&&(!normalized||c.name.includes(query.trim())||c.en.toLowerCase().includes(normalized)));grid.innerHTML=visible.map(c=>`<button class="country-card${selected?.id===c.id?' selected':''}" type="button" data-country="${c.id}"><span class="flag">${c.flag}</span><span><strong>${c.name}</strong><small>${c.en}</small></span></button>`).join('')||'<div class="empty-state"><strong>該当する代表がありません</strong><p>検索条件を変えてみてください。</p></div>';}
function render(){renderHero();renderFilters();renderCountries();}
filters.addEventListener('click',e=>{const button=e.target.closest('[data-region]');if(!button)return;activeRegion=button.dataset.region;render();});
grid.addEventListener('click',e=>{const button=e.target.closest('[data-country]');if(!button)return;const country=countries.find(c=>c.id===button.dataset.country);localStorage.setItem(key,country.id);render();showToast(`${country.name}代表を登録しました`);});
search.addEventListener('input',()=>{query=search.value;renderCountries();});
clear.addEventListener('click',()=>{localStorage.removeItem(key);render();showToast('推し代表を解除しました');});
const themeButton=document.querySelector('#themeButton');
const themeKey='sportsHubTheme';
if(localStorage.getItem(themeKey)==='light')document.body.classList.add('light');
themeButton.addEventListener('click',()=>{document.body.classList.toggle('light');localStorage.setItem(themeKey,document.body.classList.contains('light')?'light':'dark');});
render();
