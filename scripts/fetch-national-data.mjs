import fs from 'node:fs/promises';

const API='https://api.football-data.org/v4';
const token=process.env.FOOTBALL_DATA_TOKEN;
if(!token)throw new Error('FOOTBALL_DATA_TOKEN is not configured');

const competitions=[
  {code:'WC',nameJa:'FIFAワールドカップ'},
  {code:'EC',nameJa:'UEFA欧州選手権'},
  {code:'UNL',nameJa:'UEFAネーションズリーグ'},
  {code:'CLI',nameJa:'コパ・リベルタドーレス'}
];

const aliases={
  japan:['japan'],korea:['south korea','korea republic','korea'],australia:['australia'],
  argentina:['argentina'],brazil:['brazil'],uruguay:['uruguay'],england:['england'],
  france:['france'],germany:['germany'],spain:['spain'],italy:['italy'],portugal:['portugal'],
  netherlands:['netherlands','holland'],usa:['united states','usa'],mexico:['mexico'],canada:['canada'],
  morocco:['morocco'],senegal:['senegal'],nigeria:['nigeria']
};
const normalize=value=>(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
function teamId(name){const value=normalize(name);for(const [id,names] of Object.entries(aliases)){if(names.some(alias=>value===alias||value.includes(alias)))return id;}return null;}
async function request(path){const response=await fetch(`${API}${path}`,{headers:{'X-Auth-Token':token}});if(!response.ok)throw new Error(`HTTP ${response.status}`);return response.json();}

const matches=[];
for(const competition of competitions){
  try{
    const payload=await request(`/competitions/${competition.code}/matches`);
    for(const match of payload.matches||[]){
      const home=teamId(match.homeTeam?.name||match.homeTeam?.shortName);
      const away=teamId(match.awayTeam?.name||match.awayTeam?.shortName);
      if(!home&&!away)continue;
      matches.push({
        id:String(match.id),kickoff:match.utcDate,status:match.status==='FINISHED'?'finished':match.status,
        competition:competition.nameJa,stage:match.stage||'',round:match.matchday?`第${match.matchday}節`:'',
        home:home||normalize(match.homeTeam?.name),away:away||normalize(match.awayTeam?.name),
        homeName:match.homeTeam?.name||'',awayName:match.awayTeam?.name||'',
        homeScore:match.score?.fullTime?.home??null,awayScore:match.score?.fullTime?.away??null
      });
    }
  }catch(error){console.warn(`Skip ${competition.code}: ${error.message}`);}
}
const unique=[...new Map(matches.map(match=>[match.id,match])).values()].sort((a,b)=>new Date(a.kickoff)-new Date(b.kickoff));
const output={updatedAt:new Date().toISOString(),source:'football-data.org',matches:unique};
await fs.mkdir('data',{recursive:true});
await fs.writeFile('data/national-matches.json',`${JSON.stringify(output,null,2)}\n`);
console.log(`Saved ${unique.length} national matches.`);