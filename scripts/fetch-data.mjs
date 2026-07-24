import fs from 'node:fs/promises';

const API='https://v3.football.api-sports.io';
const key=process.env.API_FOOTBALL_KEY;
if(!key)throw new Error('API_FOOTBALL_KEY is not configured');

const leagues=[
  {id:39,name:'Premier League',ja:'プレミアリーグ',color:'#7c3aed'},
  {id:140,name:'La Liga',ja:'ラ・リーガ',color:'#f97316'},
  {id:135,name:'Serie A',ja:'セリエA',color:'#2563eb'},
  {id:78,name:'Bundesliga',ja:'ブンデスリーガ',color:'#dc2626'},
  {id:61,name:'Ligue 1',ja:'リーグ・アン',color:'#0891b2'}
];

// API-Football's free plan currently allows historical seasons only.
// A paid plan can switch seasons by adding API_FOOTBALL_SEASON as a repository variable.
const season=Number(process.env.API_FOOTBALL_SEASON||2024);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let lastRequestAt=0;

async function request(path,attempt=1){
  // Free subscriptions have a strict per-minute request limit.
  // Keep calls at least seven seconds apart to remain below it.
  const wait=Math.max(0,7000-(Date.now()-lastRequestAt));
  if(wait)await sleep(wait);
  lastRequestAt=Date.now();

  const response=await fetch(`${API}${path}`,{headers:{'x-apisports-key':key}});
  if(!response.ok)throw new Error(`${path}: HTTP ${response.status}`);
  const json=await response.json();
  const errors=json.errors||{};

  if(errors.rateLimit&&attempt<=2){
    console.warn(`Rate limit reached. Waiting 65 seconds before retry ${attempt}/2...`);
    await sleep(65000);
    return request(path,attempt+1);
  }
  if(Object.keys(errors).length)throw new Error(`${path}: ${JSON.stringify(errors)}`);
  return json.response||[];
}

const teams=[];const fixtures=[];const standings=[];
for(const league of leagues){
  console.log(`Fetching ${league.name} (${season})`);

  // Run sequentially: Promise.all caused the free plan's per-minute limit to be exceeded.
  const teamResponse=await request(`/teams?league=${league.id}&season=${season}`);
  const fixtureResponse=await request(`/fixtures?league=${league.id}&season=${season}&timezone=Asia%2FTokyo`);
  const standingResponse=await request(`/standings?league=${league.id}&season=${season}`);

  for(const item of teamResponse){
    teams.push({id:item.team.id,name:item.team.name,logo:item.team.logo,leagueId:league.id,color:league.color,venue:item.venue?.name||''});
  }
  for(const item of fixtureResponse){
    fixtures.push({
      id:item.fixture.id,date:item.fixture.date,status:item.fixture.status.short,elapsed:item.fixture.status.elapsed,
      competition:item.league.name,competitionJa:league.ja,leagueId:league.id,round:item.league.round,
      venue:item.fixture.venue?.name||'',home:{id:item.teams.home.id,name:item.teams.home.name,logo:item.teams.home.logo},
      away:{id:item.teams.away.id,name:item.teams.away.name,logo:item.teams.away.logo},goals:item.goals,score:item.score,
      events:item.events||[]
    });
  }
  const table=standingResponse[0]?.league?.standings?.[0]||[];
  standings.push({leagueId:league.id,leagueName:league.name,leagueNameJa:league.ja,rows:table.map(r=>({rank:r.rank,team:r.team,played:r.all.played,win:r.all.win,draw:r.all.draw,lose:r.all.lose,goalsDiff:r.goalsDiff,points:r.points,form:r.form||''}))});
}

const output={
  updatedAt:new Date().toISOString(),
  season,
  dataMode:season===2024?'historical-free-plan':'configured-season',
  leagues,
  teams,
  fixtures:fixtures.sort((a,b)=>new Date(a.date)-new Date(b.date)),
  standings
};
await fs.mkdir('data',{recursive:true});
await fs.writeFile('data/football.json',JSON.stringify(output,null,2)+'\n');
console.log(`Saved ${teams.length} teams and ${fixtures.length} fixtures for season ${season}.`);
