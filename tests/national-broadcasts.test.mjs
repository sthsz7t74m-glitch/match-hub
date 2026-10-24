import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import vm from 'node:vm';
const source=await fs.readFile(new URL('../assets/js/national-broadcasts.js',import.meta.url),'utf8');const context=vm.createContext({window:{}});vm.runInContext(source,context);const api=context.window.NationalBroadcasts;
test('Match media use Japan date, team pair and explicit official sources',()=>{
 const match={kickoff:'2026-11-14T10:15Z',home:'japan',away:'brazil'};
 assert.match(api.lookup(match).media.join('/'),/テレビ朝日.*無料/);
 assert.match(api.lookup({kickoff:'2026-11-17T13:10Z',home:'paraguay',away:'japan'}).media.join('/'),/日本テレビ.*TVer/);
 assert.equal(api.lookup({...match,kickoff:'2025-11-14T10:15Z'}),null);
 assert.equal(api.lookup({...match,away:'uruguay'}),null);
});
test('League rights are restricted to the verified competition and season',()=>{
 assert.equal(api.lookup({kickoff:'2026-11-12T19:45Z',competitionCode:'uefa.nations'}).media[0],'DAZN');
 assert.equal(api.lookup({kickoff:'2025-11-12T19:45Z',competitionCode:'uefa.nations'}),null);
 assert.equal(api.lookup({kickoff:'2026-11-12T19:45Z',competitionCode:'fifa.friendly'}),null);
 assert.match(api.render({kickoff:'2027-01-01'}),/未確認/);
});
test('Renderer adds media while preserving card interactions and context',()=>{
 const renderer={render:(match,context)=>`<button data-id="${match.id}">${context.text}</button>`};api.decorate(renderer);
 const html=renderer.render({id:12,kickoff:'2026-11-14T10:15Z',home:'japan',away:'brazil'},{text:'VS'});
 assert.match(html,/data-id="12"/);assert.match(html,/テレビ朝日/);assert.match(html,/rel="noopener noreferrer"/);
});
