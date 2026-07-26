import fs from 'node:fs/promises';

const ESPN='https://site.api.espn.com/apis/site/v2/sports/soccer';
const now=new Date();
const currentYear=now.getUTCFullYear();
const years=[currentYear-2,currentYear-1,currentYear,currentYear+1];

const competitions=[
  {nameJa:'FIFAワールドカップ',codes:['fifa.world']},
  {nameJa:'W杯欧州予選',codes:['fifa.worldq.uefa']},
  {nameJa:'W杯南米予選',codes:['fifa.worldq.conmebol']},
  {nameJa:'W杯北中米予選',codes:['fifa.worldq.concacaf']},
  {nameJa:'W杯アジア予選',codes:['fifa.worldq.afc']},
  {nameJa:'W杯アフリカ予選',codes:['fifa.worldq.caf']},
  {nameJa:'W杯オセアニア予選',codes:['fifa.worldq.ofc']},
  {nameJa:'UEFA欧州選手権',codes:['uefa.euro']},
  {nameJa:'UEFAネーションズリーグ',codes:['uefa.nations']},
  {nameJa:'コパ・アメリカ',codes:['conmebol.copa_america','conmebol.america']},
  {nameJa:'CONCACAFゴールドカップ',codes:['concacaf.gold']},
  {nameJa:'AFCアジアカップ',codes:['afc.asian.cup','afc.asian']},
  {nameJa:'アフリカネーションズカップ',codes:['caf.nations']},
  {nameJa:'国際親善試合',codes:['fifa.friendly']},
  {nameJa:'オリンピック男子サッカー',codes:['fifa.olympics','olympics-mens-soccer']}
];

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

async function requestJson(url){
  const response=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0 match-hub/1.0','Accept':'application/json'}});
  if(!response.ok)throw new Error(`HTTP ${response.status}`);
  return response.json();
}

function statusOf(event={}){
  if(event.status?.type?.completed)return 'finished';
  const state=event.status?.type?.state;
  if(state==='in')return 'in_play';
  if(state==='pre')return 'scheduled';
  return String(state||'scheduled').toLowerCase();
}

function monthRanges(year){
  return Array.from({length:12},(_,index)=>{
    const month=String(index+1).padStart(2,'0');
    const lastDay=new Date(Date.UTC(year,index+1,0)).getUTCDate();
    return `${year}${month}01-${year}${month}${String(lastDay).padStart(2,'0')}`;
  });
}

function normalizeEvent(event,competition,code){
  const contest=event.competitions?.[0];
  if(!contest)return null;
  const homeCompetitor=(contest.competitors||[]).find(item=>item.homeAway==='home');
  const awayCompetitor=(contest.competitors||[]).find(item=>item.homeAway==='away');
  const homeName=homeCompetitor?.team?.displayName||homeCompetitor?.team?.name||homeCompetitor?.team?.shortDisplayName||'';
  const awayName=awayCompetitor?.team?.displayName||awayCompetitor?.team?.name||awayCompetitor?.team?.shortDisplayName||'';
  if(!homeName||!awayName)return null;
  return {
    id:`${code}-${event.id}`,
    kickoff:event.date,
    status:statusOf(event),
    competition:event.league?.name||competition.nameJa,
    competitionCode:code,
    stage:event.season?.type?.name||event.season?.slug||'',
    round:contest.type?.text||event.week?.text||'',
    home:teamId(homeName),away:teamId(awayName),homeName,awayName,
    homeScore:homeCompetitor?.score===''||homeCompetitor?.score==null?null:Number(homeCompetitor.score),
    awayScore:awayCompetitor?.score===''||awayCompetitor?.score==null?null:Number(awayCompetitor.score),
    venue:contest.venue?.fullName||'',
    source:'ESPN'
  };
}

const matches=[];
const loaded=[];
const skipped=[];

for(const competition of competitions){
  let selectedCode='';
  let competitionCount=0;
  for(const code of competition.codes){
    let codeCount=0;
    for(const year of years){
      for(const dates of monthRanges(year)){
        const url=`${ESPN}/${code}/scoreboard?dates=${dates}&limit=1000`;
        try{
          const payload=await requestJson(url);
          const events=payload.events||[];
          for(const event of events){
            const normalizedEvent=normalizeEvent(event,competition,code);
            if(normalizedEvent)matches.push(normalizedEvent);
          }
          codeCount+=events.length;
        }catch(error){
          skipped.push({code,dates,reason:error.message});
        }
      }
    }
    if(codeCount>0){
      selectedCode=code;
      competitionCount=codeCount;
      break;
    }
  }
  if(competitionCount>0)loaded.push({code:selectedCode,name:competition.nameJa,count:competitionCount});
  else console.warn(`No ESPN events found for ${competition.nameJa}`);
}

const unique=[...new Map(matches.map(match=>[match.id,match])).values()]
  .sort((a,b)=>new Date(a.kickoff)-new Date(b.kickoff));

const output={
  updatedAt:new Date().toISOString(),
  source:'ESPN multi-competition monthly adapter',
  competitionCount:loaded.length,
  competitions:loaded,
  skippedCompetitions:skipped,
  dateYears:years,
  requestCount:competitions.reduce((sum,item)=>sum+item.codes.length*years.length*12,0),
  matches:unique
};

await fs.mkdir('data',{recursive:true});
await fs.writeFile('data/national-matches.json',`${JSON.stringify(output,null,2)}\n`);
console.log(`Saved ${unique.length} national matches from ${loaded.length} ESPN competitions.`);
console.log(loaded);
