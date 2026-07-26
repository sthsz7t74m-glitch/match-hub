import fs from 'node:fs/promises';

const API='https://api.football-data.org/v4';
const token=process.env.FOOTBALL_DATA_TOKEN;
if(!token)throw new Error('FOOTBALL_DATA_TOKEN is not configured');

const preferredNames={
  WC:'FIFAワールドカップ',EC:'UEFA欧州選手権',UNL:'UEFAネーションズリーグ',
  CA:'コパ・アメリカ',QCAF:'W杯アフリカ予選',QAFC:'W杯アジア予選',
  AFCON:'アフリカネーションズカップ',AFC:'AFCアジアカップ',GC:'CONCACAFゴールドカップ'
};

const aliases={
  japan:['japan'],korea:['south korea','korea republic','republic of korea','korea'],australia:['australia'],
  china:['china pr','china'],iran:['iran'],iraq:['iraq'],qatar:['qatar'],saudi_arabia:['saudi arabia'],
  uae:['united arab emirates','uae'],uzbekistan:['uzbekistan'],indonesia:['indonesia'],thailand:['thailand'],
  vietnam:['vietnam'],india:['india'],jordan:['jordan'],bahrain:['bahrain'],oman:['oman'],
  argentina:['argentina'],brazil:['brazil'],uruguay:['uruguay'],colombia:['colombia'],chile:['chile'],
  ecuador:['ecuador'],paraguay:['paraguay'],peru:['peru'],venezuela:['venezuela'],bolivia:['bolivia'],
  england:['england'],france:['france'],germany:['germany'],spain:['spain'],italy:['italy'],portugal:['portugal'],
  netherlands:['netherlands','holland'],belgium:['belgium'],croatia:['croatia'],denmark:['denmark'],
  switzerland:['switzerland'],austria:['austria'],poland:['poland'],serbia:['serbia'],ukraine:['ukraine'],
  turkey:['turkiye','turkey'],norway:['norway'],sweden:['sweden'],scotland:['scotland'],wales:['wales'],
  czechia:['czech republic','czechia'],hungary:['hungary'],romania:['romania'],greece:['greece'],
  usa:['united states','usa','united states of america'],mexico:['mexico'],canada:['canada'],
  costa_rica:['costa rica'],panama:['panama'],jamaica:['jamaica'],honduras:['honduras'],
  morocco:['morocco'],senegal:['senegal'],nigeria:['nigeria'],egypt:['egypt'],algeria:['algeria'],
  tunisia:['tunisia'],ghana:['ghana'],cameroon:['cameroon'],ivory_coast:['cote d ivoire','ivory coast'],
  south_africa:['south africa'],mali:['mali'],burkina_faso:['burkina faso'],dr_congo:['dr congo','congo dr','democratic republic of congo'],
  new_zealand:['new zealand'],fiji:['fiji'],solomon_islands:['solomon islands'],new_caledonia:['new caledonia'],
  tahiti:['tahiti'],papua_new_guinea:['papua new guinea']
};

const normalize=value=>(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const slug=value=>normalize(value).replace(/ /g,'_');
function teamId(name){
  const value=normalize(name);
  for(const [id,names] of Object.entries(aliases)){
    if(names.some(alias=>value===alias||value.includes(alias)))return id;
  }
  return slug(value);
}
function competitionName(item){
  if(preferredNames[item.code])return preferredNames[item.code];
  const name=item.name||'';
  return name
    .replace(/WC Qualification/gi,'W杯予選')
    .replace(/World Cup/gi,'ワールドカップ')
    .replace(/European Championship/gi,'UEFA欧州選手権')
    .replace(/Nations League/gi,'ネーションズリーグ')
    .replace(/Copa America/gi,'コパ・アメリカ')
    .replace(/Africa Cup/gi,'アフリカネーションズカップ')
    .replace(/Asian Cup/gi,'AFCアジアカップ');
}
function isNationalCompetition(item){
  const value=normalize(`${item.name||''} ${item.code||''}`);
  return [
    'world cup','wc qualification','qualification afc','qualification caf','qualification concacaf','qualification conmebol','qualification uefa',
    'european championship','nations league','copa america','africa cup','asian cup','gold cup','confederations cup','friendlies'
  ].some(keyword=>value.includes(keyword));
}
async function request(path){
  const response=await fetch(`${API}${path}`,{headers:{'X-Auth-Token':token}});
  if(!response.ok)throw new Error(`HTTP ${response.status}`);
  return response.json();
}
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

const catalogue=await request('/competitions');
const competitions=(catalogue.competitions||[]).filter(isNationalCompetition);
console.log(`Found ${competitions.length} national competitions in catalogue.`);

const matches=[];
const loaded=[];
const skipped=[];
for(const competition of competitions){
  try{
    const payload=await request(`/competitions/${competition.id}/matches`);
    const competitionLabel=competitionName(competition);
    for(const match of payload.matches||[]){
      const homeName=match.homeTeam?.name||match.homeTeam?.shortName||'';
      const awayName=match.awayTeam?.name||match.awayTeam?.shortName||'';
      if(!homeName||!awayName)continue;
      matches.push({
        id:`${competition.id}-${match.id}`,
        kickoff:match.utcDate,
        status:match.status==='FINISHED'?'finished':String(match.status||'scheduled').toLowerCase(),
        competition:competitionLabel,
        competitionCode:competition.code||'',
        stage:match.stage||'',
        round:match.matchday?`第${match.matchday}節`:(match.group||''),
        home:teamId(homeName),away:teamId(awayName),homeName,awayName,
        homeScore:match.score?.fullTime?.home??null,awayScore:match.score?.fullTime?.away??null
      });
    }
    loaded.push({code:competition.code||String(competition.id),name:competitionLabel,count:(payload.matches||[]).length});
  }catch(error){
    skipped.push({code:competition.code||String(competition.id),name:competition.name||'',reason:error.message});
    console.warn(`Skip ${competition.code||competition.id}: ${error.message}`);
  }
  await sleep(6500);
}

const unique=[...new Map(matches.map(match=>[match.id,match])).values()].sort((a,b)=>new Date(a.kickoff)-new Date(b.kickoff));
const output={
  updatedAt:new Date().toISOString(),
  source:'football-data.org multi-competition',
  competitionCount:loaded.length,
  competitions:loaded,
  skippedCompetitions:skipped,
  matches:unique
};
await fs.mkdir('data',{recursive:true});
await fs.writeFile('data/national-matches.json',`${JSON.stringify(output,null,2)}\n`);
console.log(`Saved ${unique.length} national matches from ${loaded.length} competitions.`);
