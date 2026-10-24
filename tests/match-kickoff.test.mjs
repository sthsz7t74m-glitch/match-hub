import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import vm from 'node:vm';
const source=await fs.readFile(new URL('../assets/js/match-components.js',import.meta.url),'utf8');const context=vm.createContext({window:{}});vm.runInContext(source,context);const card=context.window.SportsHubComponents;
test('Finished card retains kickoff and displays final status exactly once',()=>{
 for(const timeText of ['試合終了','',undefined]){
 const html=card.matchCard({match:{status:'finished',kickoff:'2026-09-28T10:30Z'},timeText,home:{name:'日本'},away:{name:'ベネズエラ'}});
 assert.match(html,/19:30/);assert.equal((html.match(/試合終了/g)||[]).length,1);
 }
});
test('Unknown kickoff does not duplicate status and explicit times remain supported',()=>{
 const unknown=card.matchCard({match:{status:'finished'},timeText:'試合終了'});assert.equal((unknown.match(/試合終了/g)||[]).length,1);
 const explicit=card.matchCard({match:{status:'finished',kickoff:'2026-09-28T10:30Z'},timeText:'20:00'});assert.match(explicit,/20:00/);
});
