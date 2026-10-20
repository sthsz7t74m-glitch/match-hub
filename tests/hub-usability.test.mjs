import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const app = await fs.readFile(new URL('../app.js', import.meta.url), 'utf8');
const detailCode = app.slice(app.indexOf('let detailOrigin'), app.indexOf('function detailCompetitionId'));

test('Detail returns to each source screen and scroll position without losing filters', () => {
  for (const view of ['home', 'schedule', 'search', 'standings', 'champions']) {
    const scrolls = [];
    const state = {view, range:'month', searchLeague:39, calendarSelected:'2026-10-21'};
    const context = vm.createContext({state, window:{scrollY:720,scrollTo:value=>scrolls.push(value)},
      $:()=>({setAttribute(){},querySelector:()=>({})}), setActiveNav(){}, render(){}});
    vm.runInContext(detailCode, context);
    vm.runInContext('openTeamDetail(50)', context);
    assert.equal(state.view, 'detail');
    context.window.scrollY = 300;
    vm.runInContext('openTeamDetail(42);returnFromTeamDetail()', context);
    assert.equal(state.view, view);
    assert.equal(scrolls.at(-1).top, 720);
    assert.equal(scrolls.at(-1).behavior, 'instant');
    assert.equal(state.range, 'month');
    assert.equal(state.searchLeague, 39);
    assert.equal(state.calendarSelected, '2026-10-21');
  }
});

test('Summary prioritizes next kickoff and keeps zero counts noninteractive', async () => {
  const source = await fs.readFile(new URL('../v090.js', import.meta.url), 'utf8');
  const root = {innerHTML:''};
  const fixture = {id:5,date:'2099-10-20T19:00:00Z',home:{id:50,name:'City'},away:{id:42,name:'Club'}};
  const context = vm.createContext({document:{querySelector:()=>root},state:{data:{fixtures:[]},favorites:[50],primary:50},
    fixturesFor:()=>[fixture],isFinished:()=>false,isLive:()=>false,teamName:t=>t.name,
    dayKey:()=>'',countdownText:()=> '2日 3時間',favoriteTransferCountV090:()=>0});
  vm.runInContext(source.slice(source.indexOf('function renderDailyOverviewV090'), source.indexOf('function renderFavoritesV090')), context);
  vm.runInContext('renderDailyOverviewV090()', context);
  assert.ok(root.innerHTML.indexOf('最推しの次戦') < root.innerHTML.indexOf('今日のサッカー'));
  assert.match(root.innerHTML, /10\/21.*04:00/);
  assert.match(root.innerHTML, /data-fixture="5"/);
  assert.doesNotMatch(root.innerHTML, /data-overview-target="(?:live|transfers)"/);
  assert.match(root.innerHTML, /data-overview-target="schedule"/);
});
