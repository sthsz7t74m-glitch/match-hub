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
const regionNames={asia:'アジア',europe:'欧州','south-america':'南米','north-america':'北中米',africa:'アフリカ'};
const params=new URLSearchParams(location.search);
const fallback=SportsHub.storage.get('sportsHubFavoriteNational','japan');
const selected=countries.find(country=>country.id===(params.get('team')||fallback))||countries[0];
const favoriteKey='sportsHubFavoriteNational';
function renderTeam(){
  document.title=`${selected.name}代表 | Sports Hub`;
  document.querySelector('#pageTitle').childNodes[0].nodeValue=`${selected.name}代表 `;
  document.querySelector('#teamName').textContent=`${selected.name}代表`;
  document.querySelector('#teamEnglish').textContent=selected.en;
  document.querySelector('#teamFlag').textContent=selected.flag;
  document.querySelector('#teamRegion').textContent=regionNames[selected.region]||'代表';
  syncFavorite();
}
function syncFavorite(){
  const button=document.querySelector('#favoriteButton');
  const isFavorite=SportsHub.storage.get(favoriteKey)===selected.id;
  button.classList.toggle('is-favorite',isFavorite);
  button.textContent=isFavorite?'★ 推し代表に登録中':'☆ 推し代表に登録';
}
document.querySelector('.detail-tabs').addEventListener('click',event=>{
  const button=event.target.closest('[data-tab]');
  if(!button)return;
  document.querySelectorAll('.detail-tab').forEach(tab=>tab.classList.toggle('active',tab===button));
  document.querySelectorAll('.tab-panel').forEach(panel=>panel.classList.add('hidden'));
  document.querySelector(`#${button.dataset.tab}Panel`)?.classList.remove('hidden');
});
document.querySelector('#favoriteButton').addEventListener('click',()=>{
  const current=SportsHub.storage.get(favoriteKey);
  if(current===selected.id){SportsHub.storage.remove(favoriteKey);SportsHub.toast('推し代表を解除しました');}
  else{SportsHub.storage.set(favoriteKey,selected.id);SportsHub.toast(`${selected.name}代表を登録しました`);}
  syncFavorite();
});
SportsHub.applyTheme();
renderTeam();