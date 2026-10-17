import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {championsLeague,roundLabel,mergeCompetitionTeams,totalStanding} from '../scripts/competition-data.mjs';

test('Domestic and CL memberships share one club without changing its domestic identity',()=>{
  const teams=mergeCompetitionTeams([{id:1,leagueId:39,name:'Arsenal'},{id:1,leagueId:2,name:'Arsenal'},{id:2,leagueId:2,name:'Porto'}]);
  assert.equal(teams.length,2);assert.equal(teams[0].leagueId,39);assert.deepEqual(teams[0].competitionIds,[39,2]);assert.equal(teams[1].leagueId,2);
});
test('CL rounds do not label knockout ties as domestic matchdays',()=>{
  assert.equal(roundLabel({stage:'LEAGUE_STAGE',matchday:3},championsLeague),'リーグフェーズ 第3節');
  assert.equal(roundLabel({stage:'FINAL',matchday:13},championsLeague),'決勝');
  assert.equal(roundLabel({stage:'LAST_16',matchday:9},championsLeague),'ラウンド16');
  assert.equal(totalStanding({standings:[{type:'HOME',table:[1]},{type:'TOTAL',stage:'LEAGUE_STAGE',table:[2]}]}).table[0],2);
});

async function fetchRun(fail=false){
  let output=null;let calls=0;
  const source=(await fs.readFile(new URL('../scripts/fetch-data.mjs',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'');
  const context=vm.createContext({championsLeague,roundLabel,mergeCompetitionTeams,totalStanding,
    fs:{mkdir:async()=>{},writeFile:async(_path,text)=>{output=JSON.parse(text);}},
    process:{env:{FOOTBALL_DATA_TOKEN:'test-only'}},console:{log(){}},setTimeout:cb=>cb(),
    fetch:async url=>{calls++;const cl=url.includes('/CL/');const id=cl?2:39;
      if(cl&&fail)return {ok:false,status:403,text:async()=> 'Forbidden'};
      let data={};if(url.endsWith('/teams'))data={season:{startDate:'2026-08-01'},teams:[{id:1,name:'Arsenal FC'},...(cl?[{id:2,name:'Porto'}]:[])]};
      if(url.endsWith('/matches'))data={matches:[{id:cl?200:100+calls,utcDate:'2026-10-20T19:00:00Z',status:'TIMED',stage:cl?'LAST_16':'REGULAR_SEASON',matchday:9,homeTeam:{id:1,name:'Arsenal FC'},awayTeam:{id:2,name:'Porto'},score:{fullTime:{home:null,away:null}}}]};
      if(url.endsWith('/standings'))data={standings:[{type:'TOTAL',stage:'LEAGUE_STAGE',table:[{position:1,team:{id:1,name:'Arsenal FC'},playedGames:2,won:2,draw:0,lost:0,goalsFor:6,goalsAgainst:0,goalDifference:6,points:6}]}]};
      return {ok:true,status:200,json:async()=>data};
    }});
  try{await vm.runInContext(`(async()=>{${source}})()`,context);}catch(error){return {output,error};}
  return {output,calls};
}
test('Full data job adds CL, preserves unknown scores and emits one club per ID',async()=>{
  const {output,calls,error}=await fetchRun();assert.ifError(error);assert.equal(calls,18);
  assert.equal(output.teams.filter(t=>t.id===1).length,1);
  assert.ok(output.teams[0].competitionIds.includes(2));
  const cl=output.fixtures.find(f=>f.leagueId===2);assert.equal(cl.round,'ラウンド16');assert.equal(cl.goals.home,null);
  assert.equal(output.standings.find(s=>s.leagueId===2).rows[0].goalsFor,6);
});
test('API failure never overwrites the last published data',async()=>{
  const {output,error}=await fetchRun(true);assert.match(error.message,/403/);assert.equal(output,null);
});
test('CL screen filters favorites/results, uses JST, and separates qualification bands',async()=>{
  const source=await fs.readFile(new URL('../assets/js/ui/champions-league.js',import.meta.url),'utf8');
  const root={querySelector:()=>({value:''}),innerHTML:''};
  const context=vm.createContext({document:{querySelector:s=>s==='#championsView'?{addEventListener(){}}:null,addEventListener(){}},window:{},location:{search:''},URLSearchParams,
    state:{view:'home',data:null,favorites:[1]},render(){},renderStandingsV100(){},setActiveNav(){},teamName:t=>t.name,
    isFinished:f=>f.status==='FINISHED'});
  vm.runInContext(source,context);
  vm.runInContext(`state.data={fixtures:[{id:1,leagueId:2,status:'FINISHED',round:'リーグフェーズ 第1節',date:'2026-10-13T19:00:00Z',home:{id:1},away:{id:2}},{id:2,leagueId:2,status:'TIMED',round:'決勝',date:'2026-10-20T19:00:00Z',home:{id:3},away:{id:4}},{id:3,leagueId:39,status:'FINISHED',date:'2026-10-12T19:00:00Z',home:{id:1},away:{id:2}}]}`,context);
  assert.equal(vm.runInContext(`championsMatches(state.data,{round:'all',status:'finished',favorites:true}).length`,context),1);
  assert.equal(vm.runInContext(`championsMatches(state.data,{round:'決勝',status:'upcoming',favorites:false})[0].id`,context),2);
  assert.match(vm.runInContext(`clDate('2026-10-13T19:00:00Z')`,context),/10\/14.*04:00/);
  const table=vm.runInContext(`championsTable({standings:[{leagueId:2,rows:[1,8,9,24,25,36].map(rank=>({rank,team:{id:rank,name:'Club'},played:2,points:6}))}]})`,context);
  assert.equal((table.match(/cl-zone-direct/g)||[]).length,2);assert.equal((table.match(/cl-zone-playoff/g)||[]).length,2);assert.equal((table.match(/cl-zone-out/g)||[]).length,2);
  assert.doesNotMatch(table,/降格/);
});
