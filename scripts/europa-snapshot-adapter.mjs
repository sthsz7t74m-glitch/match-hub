import {uefaEuropaSnapshot,uefaEuropaSource} from './europa-snapshot.mjs';
import {europaLeague} from './competition-data.mjs';
const aliases = {
  'Milan':'AC Milan','Leverkusen':'Bayer 04 Leverkusen','Lyon':'Olympique Lyonnais','Marseille':'Olympique de Marseille',
  'Celta':'RC Celta de Vigo','Real Sociedad':'Real Sociedad de Fútbol','Bournemouth':'AFC Bournemouth',
  'Crystal Palace':'Crystal Palace FC','Juventus':'Juventus FC','Sunderland':'Sunderland AFC',
  'Hoffenheim':'TSG 1899 Hoffenheim','Rennes':'Stade Rennais FC','Benfica':'SL Benfica'
};
const key = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
export function addUefaEuropaSnapshot(output) {
  // Don't overwrite the API data when the provider has supplied the EL competition.
  if(output.fixtures.some(f=>f.leagueId===europaLeague.id)) return output;
  const names=[...new Set(uefaEuropaSnapshot.flatMap(r=>[r[1],r[4]]))];
  const used=new Set(output.teams.map(t=>t.id));
  const map=new Map();
  for(const [index,name] of names.entries()){
    const match=output.teams.find(t=>[t.name,t.shortName,t.englishShortName].some(s=>s&&key(s)===key(aliases[name]||name)));
    const id=match?.id??(900000+index);
    const team=match || {id,name,shortName:name,englishShortName:name,logo:'',leagueId:europaLeague.id,leagueCode:'EL',color:europaLeague.color,venue:''};
    if(!match)output.teams.push({...team,competitionIds:[europaLeague.id]});
    else team.competitionIds=[...new Set([...(team.competitionIds||[team.leagueId]),europaLeague.id])];
    map.set(name,{id:team.id,name:team.name,shortName:team.shortName,logo:team.logo||''});
    used.add(id);
  }
  const timezone = (day) => day<'2026-10-25'?2:1;
  const fixtures=uefaEuropaSnapshot.map((r,i)=>{
    const [day,home,hs,as,away,time]=r;
    const played=hs!==''&&as!=='';
    const kickoffKnown=Boolean(time);
    const utcHour=time?Number(time.split(':')[0])-timezone(day):12;
    const utcMinute=time?Number(time.split(':')[1]):0;
    const date=`${day}T${String(utcHour).padStart(2,'0')}:${String(utcMinute).padStart(2,'0')}:00Z`;
    return {id:950000+i,date,kickoffKnown,status:played?'FINISHED':'SCHEDULED',elapsed:null,
      competition:europaLeague.name,competitionJa:europaLeague.ja,leagueId:europaLeague.id,leagueCode:'EL',round:'リーグフェーズ',stage:'LEAGUE_STAGE',venue:'',
      home:{...map.get(home)},away:{...map.get(away)},goals:{home:played?Number(hs):null,away:played?Number(as):null},score:{},events:[],
      source:uefaEuropaSource};
  });
  const table=new Map([...map.values()].map(team=>[team.id,{team,played:0,win:0,draw:0,lose:0,goalsFor:0,goalsAgainst:0,goalsDiff:0,points:0,form:''}]));
  for(const f of fixtures.filter(f=>f.status==='FINISHED')){
    const h=table.get(f.home.id),a=table.get(f.away.id),hg=f.goals.home,ag=f.goals.away;
    h.played++;a.played++;h.goalsFor+=hg;h.goalsAgainst+=ag;a.goalsFor+=ag;a.goalsAgainst+=hg;
    if(hg>ag){h.win++;a.lose++;h.points+=3;}
    else if(hg<ag){a.win++;h.lose++;a.points+=3;}
    else{h.draw++;a.draw++;h.points++;a.points++;}
  }
  const rows=[...table.values()].map(r=>({...r,goalsDiff:r.goalsFor-r.goalsAgainst}))
    .sort((a,b)=>b.points-a.points||b.goalsDiff-a.goalsDiff||b.goalsFor-a.goalsFor||a.team.name.localeCompare(b.team.name))
    .map((r,i)=>({...r,rank:i+1}));
  output.leagues.push(europaLeague);
  output.fixtures.push(...fixtures);
  output.fixtures.sort((a,b)=>new Date(a.date)-new Date(b.date));
  output.standings.push({leagueId:europaLeague.id,leagueCode:'EL',leagueName:europaLeague.name,leagueNameJa:europaLeague.ja,stage:'LEAGUE_STAGE',provisional:true,rows});
  output.europaSource=uefaEuropaSource;
  return output;
}
