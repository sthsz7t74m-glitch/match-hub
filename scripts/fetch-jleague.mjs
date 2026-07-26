import fs from 'node:fs/promises';

const ESPN_SCOREBOARD='https://site.api.espn.com/apis/site/v2/sports/soccer/jpn.1/scoreboard';
const ESPN_STANDINGS='https://site.api.espn.com/apis/v2/sports/soccer/jpn.1/standings';

const season=new Date().getUTCFullYear();
const dateRange=`${season}0101-${season}1231`;

async function requestJson(url){
  const response=await fetch(url,{headers:{'User-Agent':'match-hub/1.0'}});
  if(!response.ok)throw new Error(`${url}: HTTP ${response.status} ${await response.text()}`);
  return response.json();
}

const teamMap=new Map();
const rememberTeam=competitor=>{
  const team=competitor?.team||{};
  const id=String(team.id||team.uid||team.slug||team.abbreviation||team.displayName||'');
  if(!id)return null;
  if(!teamMap.has(id))teamMap.set(id,{
    id,
    name:team.displayName||team.name||team.shortDisplayName||'名称未定',
    shortName:team.shortDisplayName||team.name||team.displayName||'名称未定',
    tla:team.abbreviation||'',
    logo:team.logo||team.logos?.[0]?.href||'',
    venue:'',
    area:'Japan'
  });
  return id;
};

let matches=[];
let standings=[];
const availability={teams:false,matches:false,standings:false};
const errors=[];

try{
  const payload=await requestJson(`${ESPN_SCOREBOARD}?dates=${dateRange}&limit=1000`);
  matches=(payload.events||[]).flatMap(event=>{
    const competition=event.competitions?.[0];
    if(!competition)return [];
    const homeCompetitor=(competition.competitors||[]).find(item=>item.homeAway==='home');
    const awayCompetitor=(competition.competitors||[]).find(item=>item.homeAway==='away');
    const homeId=rememberTeam(homeCompetitor);
    const awayId=rememberTeam(awayCompetitor);
    if(!homeId||!awayId)return [];
    const completed=Boolean(event.status?.type?.completed);
    return [{
      id:String(event.id),
      date:event.date,
      status:completed?'FINISHED':(event.status?.type?.state==='in'?'IN_PLAY':'SCHEDULED'),
      matchday:event.week?.number||null,
      stage:event.season?.type?.name||event.season?.slug||'',
      competition:event.league?.name||payload.leagues?.[0]?.name||'J1 League',
      home:{...teamMap.get(homeId)},
      away:{...teamMap.get(awayId)},
      score:{
        home:homeCompetitor?.score===''||homeCompetitor?.score==null?null:Number(homeCompetitor.score),
        away:awayCompetitor?.score===''||awayCompetitor?.score==null?null:Number(awayCompetitor.score)
      },
      venue:competition.venue?.fullName||'',
      round:competition.type?.text||event.week?.text||''
    }];
  }).sort((a,b)=>new Date(a.date)-new Date(b.date));
  availability.matches=matches.length>0;
  availability.teams=teamMap.size>0;
}catch(error){errors.push(`scoreboard: ${error.message}`);}

try{
  const payload=await requestJson(ESPN_STANDINGS);
  const entries=payload.children?.[0]?.standings?.entries||payload.standings?.entries||[];
  standings=entries.map((entry,index)=>{
    const team=entry.team||{};
    const id=String(team.id||team.uid||team.slug||team.abbreviation||team.displayName||index);
    if(!teamMap.has(id))teamMap.set(id,{
      id,
      name:team.displayName||team.name||'名称未定',
      shortName:team.shortDisplayName||team.name||team.displayName||'名称未定',
      tla:team.abbreviation||'',
      logo:team.logo||team.logos?.[0]?.href||'',
      venue:'',
      area:'Japan'
    });
    const stats=Object.fromEntries((entry.stats||[]).map(stat=>[stat.name,stat.value??stat.displayValue]));
    return {
      rank:Number(stats.rank||entry.rank||index+1),
      team:{...teamMap.get(id)},
      played:Number(stats.gamesPlayed||stats.games||0),
      win:Number(stats.wins||0),
      draw:Number(stats.ties||stats.draws||0),
      lose:Number(stats.losses||0),
      goalsDiff:Number(stats.pointDifferential||stats.goalDifference||0),
      points:Number(stats.points||0),
      form:''
    };
  }).sort((a,b)=>a.rank-b.rank);
  availability.standings=standings.length>0;
  availability.teams=teamMap.size>0;
}catch(error){errors.push(`standings: ${error.message}`);}

const output={
  updatedAt:new Date().toISOString(),
  dataSource:'ESPN multi-source adapter',
  competitionCode:'jpn.1',
  season,
  availability,
  errors,
  teams:[...teamMap.values()],
  matches,
  standings
};

await fs.mkdir('data',{recursive:true});
await fs.writeFile('data/jleague.json',`${JSON.stringify(output,null,2)}\n`);
console.log(`Saved ${output.teams.length} J League teams, ${matches.length} matches and ${standings.length} standing rows.`);
if(errors.length)console.warn(errors.join('\n'));
