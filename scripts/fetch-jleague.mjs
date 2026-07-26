import fs from 'node:fs/promises';

const LEAGUES=[
  {id:'j1',code:'jpn.1',label:'J1'},
  {id:'j2',code:'jpn.2',label:'J2'},
  {id:'j3',code:'jpn.3',label:'J3'}
];
const FALLBACK_CLUBS={
  j2:[
    ['sapporo','北海道コンサドーレ札幌'],['hachinohe','ヴァンラーレ八戸'],['sendai','ベガルタ仙台'],['akita','ブラウブリッツ秋田'],['yamagata','モンテディオ山形'],['iwaki','いわきFC'],['tochigi-city','栃木シティ'],['omiya','RB大宮アルディージャ'],['yokohama-fc','横浜FC'],['shonan','湘南ベルマーレ'],['kofu','ヴァンフォーレ甲府'],['niigata','アルビレックス新潟'],['toyama','カターレ富山'],['iwata','ジュビロ磐田'],['fujieda','藤枝MYFC'],['tokushima','徳島ヴォルティス'],['imabari','FC今治'],['tosu','サガン鳥栖'],['oita','大分トリニータ'],['miyazaki','テゲバジャーロ宮崎']
  ],
  j3:[
    ['fukushima','福島ユナイテッドFC'],['tochigi-sc','栃木SC'],['gunma','ザスパ群馬'],['sagamihara','SC相模原'],['matsumoto','松本山雅FC'],['nagano','AC長野パルセイロ'],['kanazawa','ツエーゲン金沢'],['gifu','FC岐阜'],['shiga','レイラック滋賀FC'],['fc-osaka','FC大阪'],['nara','奈良クラブ'],['tottori','ガイナーレ鳥取'],['yamaguchi','レノファ山口FC'],['sanuki','カマタマーレ讃岐'],['ehime','愛媛FC'],['kochi','高知ユナイテッドSC'],['kitakyushu','ギラヴァンツ北九州'],['kumamoto','ロアッソ熊本'],['kagoshima','鹿児島ユナイテッドFC'],['ryukyu','FC琉球']
  ]
};
const season=new Date().getUTCFullYear();
const dateRange=`${season}0101-${season}1231`;

async function requestJson(url){
  const response=await fetch(url,{headers:{'User-Agent':'match-hub/1.0'}});
  if(!response.ok)throw new Error(`${url}: HTTP ${response.status} ${await response.text()}`);
  return response.json();
}

const teamMap=new Map();
function normalizeTeam(team={},league='j1'){
  const id=String(team.id||team.uid||team.slug||team.abbreviation||team.displayName||'');
  if(!id)return null;
  const value={id,league,name:team.displayName||team.name||team.shortDisplayName||'名称未定',shortName:team.shortDisplayName||team.name||team.displayName||'名称未定',tla:team.abbreviation||'',logo:team.logo||team.logos?.[0]?.href||'',venue:'',area:'Japan'};
  const key=`${league}:${id}`;
  teamMap.set(key,{...(teamMap.get(key)||{}),...value});
  return teamMap.get(key);
}

let matches=[];
let standings=[];
const availability={teams:false,matches:false,standings:false};
const errors=[];
const leaguesAvailability={};

for(const league of LEAGUES){
  const leagueAvailability={teams:false,matches:false,standings:false};
  try{
    const scoreboardUrl=`https://site.api.espn.com/apis/site/v2/sports/soccer/${league.code}/scoreboard?dates=${dateRange}&limit=1000`;
    const payload=await requestJson(scoreboardUrl);
    const leagueMatches=(payload.events||[]).flatMap(event=>{
      const competition=event.competitions?.[0];
      if(!competition)return [];
      const homeCompetitor=(competition.competitors||[]).find(item=>item.homeAway==='home');
      const awayCompetitor=(competition.competitors||[]).find(item=>item.homeAway==='away');
      const home=normalizeTeam(homeCompetitor?.team,league.id);
      const away=normalizeTeam(awayCompetitor?.team,league.id);
      if(!home||!away)return [];
      const completed=Boolean(event.status?.type?.completed);
      return [{id:String(event.id),league:league.id,date:event.date,status:completed?'FINISHED':(event.status?.type?.state==='in'?'IN_PLAY':'SCHEDULED'),matchday:event.week?.number||null,stage:event.season?.type?.name||event.season?.slug||'',competition:event.league?.name||payload.leagues?.[0]?.name||league.label,home:{...home},away:{...away},score:{home:homeCompetitor?.score===''||homeCompetitor?.score==null?null:Number(homeCompetitor.score),away:awayCompetitor?.score===''||awayCompetitor?.score==null?null:Number(awayCompetitor.score)},venue:competition.venue?.fullName||'',round:competition.type?.text||event.week?.text||''}];
    });
    matches.push(...leagueMatches);
    leagueAvailability.matches=leagueMatches.length>0;
  }catch(error){errors.push(`${league.id} scoreboard: ${error.message}`);}

  try{
    const standingsUrl=`https://site.api.espn.com/apis/v2/sports/soccer/${league.code}/standings`;
    const payload=await requestJson(standingsUrl);
    const entries=payload.children?.[0]?.standings?.entries||payload.standings?.entries||[];
    const leagueStandings=entries.map((entry,index)=>{
      const team=normalizeTeam(entry.team,league.id);
      if(!team)return null;
      const stats=Object.fromEntries((entry.stats||[]).map(stat=>[stat.name,stat.value??stat.displayValue]));
      return {league:league.id,rank:Number(stats.rank||entry.rank||index+1),team:{...team},played:Number(stats.gamesPlayed||stats.games||0),win:Number(stats.wins||0),draw:Number(stats.ties||stats.draws||0),lose:Number(stats.losses||0),goalsDiff:Number(stats.pointDifferential||stats.goalDifference||0),points:Number(stats.points||0),form:''};
    }).filter(Boolean);
    standings.push(...leagueStandings);
    leagueAvailability.standings=leagueStandings.length>0;
  }catch(error){errors.push(`${league.id} standings: ${error.message}`);}

  if(!leagueAvailability.teams&&FALLBACK_CLUBS[league.id]){
    FALLBACK_CLUBS[league.id].forEach(([id,name])=>normalizeTeam({id,displayName:name,shortDisplayName:name},league.id));
  }
  if(!leagueAvailability.standings&&FALLBACK_CLUBS[league.id]){
    const fallbackRows=FALLBACK_CLUBS[league.id].map(([id],index)=>({league:league.id,rank:index+1,team:{...teamMap.get(`${league.id}:${id}`)},played:0,win:0,draw:0,lose:0,goalsDiff:0,points:0,form:'',provisional:true}));
    standings.push(...fallbackRows);
    leagueAvailability.standings=true;
  }
  leagueAvailability.teams=[...teamMap.values()].some(team=>team.league===league.id);
  leaguesAvailability[league.id]=leagueAvailability;
}

matches.sort((a,b)=>new Date(a.date)-new Date(b.date));
standings.sort((a,b)=>a.league.localeCompare(b.league)||a.rank-b.rank);
availability.teams=teamMap.size>0;
availability.matches=matches.length>0;
availability.standings=standings.length>0;

const output={updatedAt:new Date().toISOString(),dataSource:'ESPN + J League roster fallback',competitionCode:'jpn.1,jpn.2,jpn.3',season,availability,leaguesAvailability,errors,teams:[...teamMap.values()],matches,standings};
await fs.mkdir('data',{recursive:true});
await fs.writeFile('data/jleague.json',`${JSON.stringify(output,null,2)}\n`);
console.log(`Saved ${output.teams.length} J League teams, ${matches.length} matches and ${standings.length} standing rows.`);
if(errors.length)console.warn(errors.join('\n'));