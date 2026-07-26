const leagues=[['j1','J1'],['j2','J2'],['j3','J3']];
const clubs=[
{id:'urawa',name:'浦和レッズ',area:'埼玉',league:'j1',mark:'浦'},
{id:'fc-tokyo',name:'FC東京',area:'東京',league:'j1',mark:'東'},
{id:'yokohama-fm',name:'横浜F・マリノス',area:'神奈川',league:'j1',mark:'横'},
{id:'kashima',name:'鹿島アントラーズ',area:'茨城',league:'j1',mark:'鹿'},
{id:'gamba',name:'ガンバ大阪',area:'大阪',league:'j1',mark:'脚'},
{id:'chiba',name:'ジェフユナイテッド千葉',area:'千葉',league:'j2',mark:'千'},
{id:'omiya',name:'RB大宮アルディージャ',area:'埼玉',league:'j2',mark:'宮'},
{id:'iwata',name:'ジュビロ磐田',area:'静岡',league:'j2',mark:'磐'},
{id:'matsumoto',name:'松本山雅FC',area:'長野',league:'j3',mark:'松'},
{id:'gifu',name:'FC岐阜',area:'岐阜',league:'j3',mark:'岐'},
{id:'ryukyu',name:'FC琉球',area:'沖縄',league:'j3',mark:'琉'}
];
const favoriteKey='sportsHubFavoriteJClub';
let activeLeague='j1';
let query='';
const tabs=document.querySelector('#leagueTabs');
const grid=document.querySelector('#clubGrid');
const search=document.querySelector('#clubSearch');
const count=document.querySelector('#clubCount');
const favorite=()=>SportsHub.storage.get(favoriteKey);
function renderTabs(){tabs.innerHTML=leagues.map(([id,label])=>`<button class="chip${activeLeague===id?' active':''}" type="button" data-league="${id}">${label}</button>`).join('');}
function renderClubs(){const normalized=query.trim().toLowerCase();const current=favorite();const visible=clubs.filter(club=>club.league===activeLeague&&(!normalized||club.name.toLowerCase().includes(normalized)||club.area.includes(query.trim())));count.textContent=`${visible.length}クラブ`;grid.innerHTML=visible.map(club=>`<article class="club-card${current===club.id?' selected':''}"><span class="club-badge">${club.mark}</span><span class="club-copy"><strong>${club.name}</strong><small>${club.area}・${club.league.toUpperCase()}</small></span><button class="club-favorite" type="button" data-club="${club.id}" aria-label="${club.name}をお気に入り登録">${current===club.id?'★':'☆'}</button></article>`).join('')||'<div class="empty-state"><strong>該当するクラブがありません</strong><p>検索条件を変えてみてください。</p></div>';}
tabs.addEventListener('click',event=>{const button=event.target.closest('[data-league]');if(!button)return;activeLeague=button.dataset.league;renderTabs();renderClubs();});
grid.addEventListener('click',event=>{const button=event.target.closest('[data-club]');if(!button)return;const club=clubs.find(item=>item.id===button.dataset.club);if(favorite()===club.id){SportsHub.storage.remove(favoriteKey);SportsHub.toast('お気に入りを解除しました');}else{SportsHub.storage.set(favoriteKey,club.id);SportsHub.toast(`${club.name}をお気に入りに登録しました`);}renderClubs();});
search.addEventListener('input',()=>{query=search.value;renderClubs();});
SportsHub.applyTheme();
renderTabs();
renderClubs();