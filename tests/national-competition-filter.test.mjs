import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import vm from 'node:vm';
const source=await fs.readFile(new URL('../national-detail.js',import.meta.url),'utf8');
const functions=source.slice(source.indexOf('function nationalCompetitionKey'),source.indexOf('function renderMatches'));
test('Competition and time filters combine without changing schedule order',()=>{
 const future=[{id:1,competitionCode:'fifa.friendly'},{id:2,competitionCode:'afc.asian.cup'},{id:3,competitionCode:'fifa.worldq.afc'}],past=[{id:4,competitionCode:'fifa.friendly'},{id:5,competitionCode:'afc.asian.cup'}];
 const context=vm.createContext({activeMatchFilter:'all',activeCompetitionFilter:'all',sortedUpcoming:()=>future,sortedFinished:()=>past});vm.runInContext(functions,context);
 const ids=()=>Array.from(vm.runInContext('matchesForFilter().map(m=>m.id)',context));
 assert.deepEqual(ids(),[1,2,3,4,5]);context.activeCompetitionFilter='friendly';assert.deepEqual(ids(),[1,4]);context.activeMatchFilter='finished';assert.deepEqual(ids(),[4]);context.activeCompetitionFilter='afc.asian.cup';assert.deepEqual(ids(),[5]);context.activeMatchFilter='upcoming';assert.deepEqual(ids(),[2]);context.activeCompetitionFilter='official';assert.deepEqual(ids(),[2,3]);
 assert.equal(vm.runInContext("isNationalFriendly({competition:'国際親善試合'})",context),true);
 context.activeCompetitionFilter='uefa.nations';assert.deepEqual(ids(),[]);
});
