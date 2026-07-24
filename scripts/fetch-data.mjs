import fs from 'node:fs/promises';

const API='https://api.football-data.org/v4';
const token=process.env.FOOTBALL_DATA_TOKEN;
if(!token)throw new Error('FOOTBALL_DATA_TOKEN is not configured');

const leagues=[
  {code:'PL',id:39,name:'Premier League',ja:'プレミアリーグ',color:'#7c3aed'},
  {code:'PD',id:140,name:'Primera Division',ja:'ラ・リーガ',color:'#f97316'},
  {code:'SA',id:135,name:'Serie A',ja:'セリエA',color:'#2563eb'},
  {code:'BL1',id:78,name:'Bundesliga',ja:'ブンデスリーガ',color:'#dc2626'},
  {code:'FL1',id:61,name:'Ligue 1',ja:'リーグ・アン',color:'#0891b2'}
];

const japaneseNames={
  'arsenal':'アーセナル','aston villa':'アストン・ヴィラ','bournemouth':'ボーンマス','brentford':'ブレントフォード','brighton hove albion':'ブライトン','burnley':'バーンリー','chelsea':'チェルシー','crystal palace':'クリスタル・パレス','everton':'エヴァートン','fulham':'フラム','leeds united':'リーズ・ユナイテッド','liverpool':'リヴァプール','manchester city':'マンチェスター・シティ','manchester united':'マンチェスター・ユナイテッド','newcastle united':'ニューカッスル・ユナイテッド','nottingham forest':'ノッティンガム・フォレスト','sunderland':'サンダーランド','tottenham hotspur':'トッテナム・ホットスパー','west ham united':'ウェストハム・ユナイテッド','wolverhampton wanderers':'ウォルヴァーハンプトン',
  'deportivo alaves':'アラベス','athletic club':'アスレティック・ビルバオ','atletico madrid':'アトレティコ・マドリード','club atletico de madrid':'アトレティコ・マドリード','barcelona':'バルセロナ','celta de vigo':'セルタ・デ・ビーゴ','elche':'エルチェ','espanyol':'エスパニョール','getafe':'ヘタフェ','girona':'ジローナ','levante':'レバンテ','mallorca':'マジョルカ','osasuna':'オサスナ','real betis':'レアル・ベティス','real madrid':'レアル・マドリード','real oviedo':'レアル・オビエド','real sociedad':'レアル・ソシエダ','sevilla':'セビージャ','valencia':'バレンシア','villarreal':'ビジャレアル','rayo vallecano':'ラージョ・バジェカーノ',
  'atalanta':'アタランタ','bologna':'ボローニャ','cagliari':'カリアリ','como 1907':'コモ','cremonese':'クレモネーゼ','fiorentina':'フィオレンティーナ','genoa':'ジェノア','hellas verona':'エラス・ヴェローナ','internazionale':'インテル','inter milan':'インテル','juventus':'ユヴェントス','lazio':'ラツィオ','lecce':'レッチェ','milan':'ACミラン','napoli':'ナポリ','parma':'パルマ','pisa':'ピサ','roma':'ローマ','sassuolo':'サッスオーロ','torino':'トリノ','udinese':'ウディネーゼ',
  'augsburg':'アウクスブルク','bayer leverkusen':'バイヤー・レヴァークーゼン','bayern munchen':'バイエルン・ミュンヘン','bayern munich':'バイエルン・ミュンヘン','borussia dortmund':'ボルシア・ドルトムント','borussia monchengladbach':'ボルシアMG','eintracht frankfurt':'アイントラハト・フランクフルト','freiburg':'フライブルク','hamburger sv':'ハンブルガーSV','heidenheim':'ハイデンハイム','hoffenheim':'ホッフェンハイム','koln':'ケルン','mainz 05':'マインツ','rb leipzig':'RBライプツィヒ','st pauli':'ザンクト・パウリ','stuttgart':'シュトゥットガルト','union berlin':'ウニオン・ベルリン','werder bremen':'ヴェルダー・ブレーメン','wolfsburg':'ヴォルフスブルク',
  'angers':'アンジェ','auxerre':'オセール','brest':'ブレスト','le havre':'ル・アーヴル','lens':'ランス','lille':'リール','lorient':'ロリアン','lyon':'リヨン','olympique lyonnais':'リヨン','marseille':'マルセイユ','olympique de marseille':'マルセイユ','metz':'メス','monaco':'モナコ','nantes':'ナント','nice':'ニース','paris fc':'パリFC','paris saint germain':'パリ・サンジェルマン','paris saint-germain':'パリ・サンジェルマン','rennes':'レンヌ','strasbourg':'ストラスブール','toulouse':'トゥールーズ'
};
const normalizeName=value=>(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\b(fc|cf|afc|ac|ssc|ss|as|calcio|football club|fussball-club|fussballclub)\b/g,' ').replace(/[^a-z0-9]+/g,' ').trim();
function japaneseName(...values){for(const value of values){const key=normalizeName(value);if(japaneseNames[key])return japaneseNames[key];}return values.find(Boolean)||'名称未定';}
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function request(path,attempt=0){const response=await fetch(`${API}${path}`,{headers:{'X-Auth-Token':token}});if(response.status===429&&attempt<2){const waitMs=Number(response.headers.get('retry-after')||60)*1000;await sleep(waitMs);return request(path,attempt+1);}if(!response.ok)throw new Error(`${path}: HTTP ${response.status} ${await response.text()}`);const json=await response.json();await sleep(6500);return json;}

const teams=[],fixtures=[],standings=[];let season=null;
for(const league of leagues){
  console.log(`Fetching ${league.name}`);
  const teamResponse=await request(`/competitions/${league.code}/teams`);
  const matchResponse=await request(`/competitions/${league.code}/matches`);
  const standingResponse=await request(`/competitions/${league.code}/standings`);
  season||=teamResponse.season?.startDate?.slice(0,4)||null;
  for(const team of teamResponse.teams||[])teams.push({id:team.id,name:team.name,shortName:japaneseName(team.name,team.shortName),englishShortName:team.shortName||team.name,tla:team.tla||'',logo:team.crest||'',leagueId:league.id,leagueCode:league.code,color:league.color,venue:team.venue||''});
  for(const match of matchResponse.matches||[])fixtures.push({id:match.id,date:match.utcDate,status:match.status,elapsed:null,competition:match.competition?.name||league.name,competitionJa:league.ja,leagueId:league.id,leagueCode:league.code,round:match.matchday?`第${match.matchday}節`:(match.stage||''),venue:'',home:{id:match.homeTeam.id,name:match.homeTeam.name,shortName:japaneseName(match.homeTeam.name,match.homeTeam.shortName),logo:match.homeTeam.crest||''},away:{id:match.awayTeam.id,name:match.awayTeam.name,shortName:japaneseName(match.awayTeam.name,match.awayTeam.shortName),logo:match.awayTeam.crest||''},goals:{home:match.score?.fullTime?.home??null,away:match.score?.fullTime?.away??null},score:match.score||{},events:[]});
  const total=(standingResponse.standings||[]).find(item=>item.type==='TOTAL');
  standings.push({leagueId:league.id,leagueCode:league.code,leagueName:league.name,leagueNameJa:league.ja,rows:(total?.table||[]).map(row=>({rank:row.position,team:{id:row.team.id,name:row.team.name,shortName:japaneseName(row.team.name,row.team.shortName),logo:row.team.crest||''},played:row.playedGames,win:row.won,draw:row.draw,lose:row.lost,goalsDiff:row.goalDifference,points:row.points,form:row.form||''}))});
}
const output={updatedAt:new Date().toISOString(),season,dataSource:'football-data.org',dataMode:'current-free-plan',leagues,teams,fixtures:fixtures.sort((a,b)=>new Date(a.date)-new Date(b.date)),standings};
await fs.mkdir('data',{recursive:true});
await fs.writeFile('data/football.json',`${JSON.stringify(output,null,2)}\n`);
console.log(`Saved ${teams.length} teams and ${fixtures.length} fixtures.`);
