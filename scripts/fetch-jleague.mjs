import fs from 'node:fs/promises';

const API='https://api.football-data.org/v4';
const token=process.env.FOOTBALL_DATA_TOKEN;
if(!token)throw new Error('FOOTBALL_DATA_TOKEN is not configured');

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function request(path,attempt=0){
  const response=await fetch(`${API}${path}`,{headers:{'X-Auth-Token':token}});
  if(response.status===429&&attempt<2){
    const waitMs=Number(response.headers.get('retry-after')||60)*1000;
    await sleep(waitMs);
    return request(path,attempt+1);
  }
  if(!response.ok)throw new Error(`${path}: HTTP ${response.status} ${await response.text()}`);
  const json=await response.json();
  await sleep(6500);
  return json;
}

async function optionalRequest(path,fallback){
  try{return await request(path);}
  catch(error){
    console.warn(`Skip restricted J League endpoint: ${error.message}`);
    return fallback;
  }
}

const competition='JJL';
const teamResponse=await optionalRequest(`/competitions/${competition}/teams`,{teams:[],season:null});
const matchResponse=await optionalRequest(`/competitions/${competition}/matches`,{matches:[],competition:{currentSeason:null}});
const standingResponse=await optionalRequest(`/competitions/${competition}/standings`,{standings:[]});

const teams=(teamResponse.teams||[]).map(team=>({
  id:team.id,
  name:team.name,
  shortName:team.shortName||team.name,
  tla:team.tla||'',
  logo:team.crest||'',
  venue:team.venue||'',
  area:team.area?.name||'Japan'
}));

const matches=(matchResponse.matches||[]).map(match=>({
  id:match.id,
  date:match.utcDate,
  status:match.status,
  matchday:match.matchday||null,
  stage:match.stage||null,
  competition:match.competition?.name||'J. League',
  home:{id:match.homeTeam.id,name:match.homeTeam.name,shortName:match.homeTeam.shortName||match.homeTeam.name,logo:match.homeTeam.crest||''},
  away:{id:match.awayTeam.id,name:match.awayTeam.name,shortName:match.awayTeam.shortName||match.awayTeam.name,logo:match.awayTeam.crest||''},
  score:{home:match.score?.fullTime?.home??null,away:match.score?.fullTime?.away??null}
})).sort((a,b)=>new Date(a.date)-new Date(b.date));

const total=(standingResponse.standings||[]).find(item=>item.type==='TOTAL');
const standings=(total?.table||[]).map(row=>({
  rank:row.position,
  team:{id:row.team.id,name:row.team.name,shortName:row.team.shortName||row.team.name,logo:row.team.crest||''},
  played:row.playedGames,
  win:row.won,
  draw:row.draw,
  lose:row.lost,
  goalsDiff:row.goalDifference,
  points:row.points,
  form:row.form||''
}));

const output={
  updatedAt:new Date().toISOString(),
  dataSource:'football-data.org',
  competitionCode:competition,
  season:teamResponse.season||matchResponse.competition?.currentSeason||null,
  availability:{teams:teams.length>0,matches:matches.length>0,standings:standings.length>0},
  teams,
  matches,
  standings
};

await fs.mkdir('data',{recursive:true});
await fs.writeFile('data/jleague.json',`${JSON.stringify(output,null,2)}\n`);
console.log(`Saved ${teams.length} J League teams, ${matches.length} matches and ${standings.length} standing rows.`);