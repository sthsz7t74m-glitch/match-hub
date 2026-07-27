const { leagues, clubs } = SportsHubJLeague;
const Core = window.SportsCore || window.FootballCore;
const UI = window.SportsUI || window.FootballUI;
const $ = selector => document.querySelector(selector);
const favoriteService = new Core.FavoriteService({ key: 'sportsHubFavoriteJClubs', legacyKey: 'sportsHubFavoriteJClub' });
const pageTabs = new Core.PageTabs({ root: $('#pageTabs') });
const searchService = new Core.SearchService(clubs, [club => club.name, club => club.area]);
const dataAdapter = new FootballAdapters.JLeagueAdapter();
const teamMapper = FootballTeamMapper.create({
  teams: clubs,
  nameMap: { '21361': '京都サンガF.C.', '7477': 'ヴィッセル神戸', '19001': 'V・ファーレン長崎', '7114': 'サンフレッチェ広島', '7116': '横浜F・マリノス', '22167': 'FC町田ゼルビア', '7111': 'ジェフユナイテッド千葉', '3385': '浦和レッズ', '3384': 'FC東京', '7115': '鹿島アントラーズ', '7109': 'セレッソ大阪', '7102': 'ガンバ大阪', '7107': 'アビスパ福岡', '22522': 'ファジアーノ岡山', '7108': '名古屋グランパス', '7104': '清水エスパルス', '7112': '川崎フロンターレ', '7476': '柏レイソル', '3393': '東京ヴェルディ', '131701': '水戸ホーリーホック' },
  idMap: { 'fc-tokyo': '3384', 'tokyo-verdy': '3393', machida: '22167', 'yokohama-fm': '7116', kashima: '7115', mito: '131701', urawa: '3385', chiba: '7111', kashiwa: '7476', kawasaki: '7112', shimizu: '7104', nagoya: '7108', kyoto: '21361', gamba: '7102', cerezo: '7109', kobe: '7477', okayama: '22522', hiroshima: '7114', fukuoka: '7107', nagasaki: '19001' }
});
const normalizeName = FootballTeamMapper.normalizeName;
let activeLeague = 'j1';
let query = '';
let liveData = null;
let selectedDate = '';
const nodes = {
  tabs: $('#leagueTabs'),
  grid: $('#clubGrid'),
  search: $('#clubSearch'),
  count: $('#clubCount'),
  matches: $('#jleagueMatches'),
  standings: $('#jleagueStandings'),
  homeStandings: $('#homeStandings'),
  matchCount: $('#matchCount'),
  updated: $('#jUpdated'),
  schedule: $('#scheduleMatches'),
  scheduleTitle: $('#scheduleTitle'),
  favoriteMatches: $('#favoriteMatches'),
  favoriteNext: $('#favoriteNextMatches'),
  favoriteGrid: $('#favoriteClubGrid'),
  favoriteBadge: $('#favoriteCountBadge'),
  favoriteCount: $('#favoriteClubCount'),
  homeFavorite: $('#homeFavoriteStatus')
};
const empty = (title, description = '') => Core.EmptyState.render(title, description);
const scheduleEmpty = (title, description = '') => Core.SportsScheduleEmptyState.render({ title, description, className: 'jleague-empty-state' });
const favoritesEmpty = (title, description = '') => Core.SportsFavoritesEmptyState.render({ title, description, className: 'jleague-empty-state' });

function displayTeamName(team) { return teamMapper.getName(team); }
function aliases(team) { return teamMapper.aliases(team); }
function findLiveTeam(club) { return teamMapper.findLiveTeam(club); }
function findClubByTeam(team) { return teamMapper.findClubByTeam(team); }
function detailTarget(team) {
  const club = findClubByTeam(team);
  if (!club) return {};
  return {
    id: club.id,
    href: `./jleague-detail.html?club=${encodeURIComponent(club.id)}`,
    ariaLabel: `${club.name}の詳細を見る`
  };
}
function emblem(club) {
  const live = findLiveTeam(club);
  return live?.logo
    ? `<span class="club-badge"><img class="club-emblem" src="${live.logo}" alt="${club.name}のエンブレム" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span class="club-mark-fallback" hidden>${club.mark}</span></span>`
    : `<span class="club-badge"><span class="club-mark-fallback">${club.mark}</span></span>`;
}
function clubCard(club) {
  const selected = favoriteService.has(club.id);
  return `<article class="club-card${selected ? ' selected' : ''}">${emblem(club)}<button class="club-copy" type="button" data-open-club="${club.id}"><strong>${club.name}</strong><small>${club.area}・${club.league.toUpperCase()}</small></button><button class="club-favorite" type="button" data-favorite-club="${club.id}" aria-label="${club.name}をお気に入り登録">${selected ? '★' : '☆'}</button></article>`;
}
function renderLeagueTabs() {
  nodes.tabs.innerHTML = leagues.map(([id, label]) => `<button class="chip${activeLeague === id ? ' active' : ''}" type="button" data-league="${id}">${label}</button>`).join('');
}
function renderClubs() {
  const visible = searchService.search(query).filter(club => club.league === activeLeague);
  nodes.count.textContent = `${visible.length}クラブ`;
  nodes.grid.innerHTML = visible.map(clubCard).join('') || empty('該当するクラブがありません', '検索条件を変えてみてください。');
}
function formatStage(match) {
  if (match.matchday) return `第${match.matchday}節`;
  return { 'regular-season': 'リーグ戦', championship: '優勝決定戦', 'placement-playoffs': '順位決定戦', '2026-j1-100-year-vision-league': '百年構想リーグ' }[match.stage] || match.round || '';
}

const matchRenderer = SportsHubComponents.createMatchCardRenderer({
  normalize: match => {
    const model = new Core.MatchModel(match);
    const done = model.isFinished;
    const live = model.isLive;
    const homeName = displayTeamName(match.home);
    const awayName = displayTeamName(match.away);
    return {
      match: { ...match, status: done ? 'finished' : live ? 'in_play' : 'scheduled' },
      date: model.date,
      timeText: done ? '試合終了' : live ? 'LIVE' : '',
      scoreText: done || live ? `${match.score?.home ?? '-'} - ${match.score?.away ?? '-'}` : 'VS',
      competition: match.competition || activeLeague.toUpperCase(),
      stage: formatStage(match),
      venue: match.venue || '',
      home: {
        ...detailTarget(match.home),
        name: homeName,
        logo: match.home?.logo
      },
      away: {
        ...detailTarget(match.away),
        name: awayName,
        logo: match.away?.logo
      }
    };
  }
});

function leagueMatches() { return (liveData?.matches || []).filter(match => (match.league || 'j1') === activeLeague); }
function matchService() { return new Core.MatchService(leagueMatches()); }
function renderHomeMatches() {
  const service = matchService();
  const finished = service.finished().slice(-3).map(model => model.raw);
  const upcoming = service.upcoming().slice(0, 5).map(model => model.raw);
  const blocks = [];
  nodes.matchCount.textContent = `${finished.length + upcoming.length}試合`;
  if (finished.length) blocks.push(`<div class="j-match-section"><p class="eyebrow">直近結果</p><div class="j-match-cards">${matchRenderer.renderMany(finished)}</div></div>`);
  if (upcoming.length) blocks.push(`<div class="j-match-section"><p class="eyebrow">今後の日程</p><div class="j-match-cards">${matchRenderer.renderMany(upcoming)}</div></div>`);
  nodes.matches.innerHTML = blocks.join('') || Core.DataEmptyState.render('表示できる試合がありません', '次回更新後に自動表示されます。');
}
function favoriteMatchList() {
  const ids = favoriteService.list();
  const favoriteNames = new Set(ids.map(id => SportsHubJLeague.find(id)?.name).filter(Boolean).map(normalizeName));
  return leagueMatches().filter(match => [match.home, match.away].some(team => {
    const club = findClubByTeam(team);
    return club ? ids.includes(club.id) : aliases(team).some(alias => favoriteNames.has(alias));
  }));
}
function renderFavorites() {
  const ids = favoriteService.list();
  const selected = ids.map(id => SportsHubJLeague.find(id)).filter(Boolean);
  const future = new Core.MatchService(favoriteMatchList()).upcoming().map(model => model.raw);
  nodes.favoriteBadge.textContent = ids.length;
  nodes.favoriteCount.textContent = `${ids.length}クラブ`;
  nodes.homeFavorite.textContent = `${ids.length}クラブ`;
  nodes.favoriteGrid.innerHTML = selected.map(clubCard).join('') || favoritesEmpty('お気に入りはまだありません', 'クラブ一覧の☆を押して追加できます。');
  nodes.favoriteMatches.innerHTML = matchRenderer.renderMany(future.slice(0, 20)) || scheduleEmpty('今後の試合がありません', '次の試合が決まると自動表示されます。');
  nodes.favoriteNext.innerHTML = matchRenderer.renderMany(future.slice(0, 5)) || scheduleEmpty('お気に入りクラブの次戦がありません', 'お気に入りを登録するか、次回更新をお待ちください。');
}
function standingRows() { return new Core.StandingService((liveData?.standings || []).filter(row => (row.league || 'j1') === activeLeague)); }
function standingRow(row) {
  const played = row.played ?? row.gamesPlayed ?? '-';
  const points = row.points ?? '-';
  const diff = row.goalsDiff ?? row.goalDifference ?? 0;
  return `<div class="j-standing-row"><strong>${row.provisional ? '-' : row.rank ?? '-'}</strong><span class="j-standing-team">${row.team?.logo ? `<img src="${row.team.logo}" alt="" loading="lazy" onerror="this.hidden=true">` : ''}${displayTeamName(row.team)}</span><span>${played}</span><b>${points}</b><small>${Number(diff) > 0 ? '+' : ''}${diff}</small></div>`;
}
function renderStandings() {
  const service = standingRows();
  const rows = service.all();
  nodes.standings.innerHTML = rows.map(standingRow).join('') || Core.DataEmptyState.render('順位データがありません', 'シーズン開始後に表示されます。');
  nodes.homeStandings.innerHTML = service.top(5).map(standingRow).join('') || Core.DataEmptyState.render('順位データがありません');
}
function calendarMatches() {
  const calendar = UI.calendars?.jleague;
  return calendar?.favoriteOnly ? favoriteMatchList() : leagueMatches();
}
function renderSchedule() {
  const source = calendarMatches();
  const service = new Core.MatchService(source);
  const matches = (selectedDate ? service.byDate(selectedDate) : service.all()).map(model => model.raw);
  nodes.scheduleTitle.textContent = selectedDate ? `${new Date(`${selectedDate}T00:00:00`).toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' })}の試合` : '試合日程';
  nodes.schedule.innerHTML = matchRenderer.renderMany(matches) || scheduleEmpty(UI.calendars?.jleague?.favoriteOnly ? 'この日に推しの試合はありません' : 'この日の試合はありません', 'クラブと順位情報は表示できます。');
}
function calendarFavoriteIds() { return teamMapper.favoriteTeamIds(favoriteService.list()); }
function syncCalendar() {
  const calendar = UI.calendars?.jleague;
  if (!calendar) return;
  calendar.getMatches = () => leagueMatches();
  calendar.getFavorites = calendarFavoriteIds;
  calendar.getTeamVisual = id => ({ logo: teamMapper.getLogo(id), label: teamMapper.getClub(id)?.mark || '●' });
  calendar.clearSelection();
  calendar.render();
}
function renderAll() {
  renderLeagueTabs();
  renderClubs();
  if (liveData) {
    renderHomeMatches();
    renderStandings();
    renderSchedule();
    syncCalendar();
  }
  renderFavorites();
}
async function loadLiveData() {
  try {
    liveData = await dataAdapter.load();
    teamMapper.setLiveData(liveData);
    const metadata = await dataAdapter.loadMetadata();
    const updated = new Date(metadata.updatedAt);
    nodes.updated.textContent = `最終更新 ${updated.toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}・${metadata.dataSource || '公開データ'}`;
    renderAll();
    const first = matchService().upcoming()[0];
    if (first) UI.calendars?.jleague?.setCursor(first.date);
  } catch (error) {
    nodes.updated.textContent = '実データの初回取得を待っています';
    console.warn('J League data unavailable', error);
    renderAll();
  }
}

pageTabs.bind();
document.addEventListener('click', event => {
  const jump = event.target.closest('[data-page-jump]');
  if (jump) {
    pageTabs.show(jump.dataset.pageJump);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  const favoriteButton = event.target.closest('[data-favorite-club]');
  if (favoriteButton) {
    const club = SportsHubJLeague.find(favoriteButton.dataset.favoriteClub);
    const added = favoriteService.toggle(club.id);
    SportsHub.toast(`${club.name}をお気に入りから${added ? '追加' : '解除'}しました`);
    renderAll();
  }
  const openButton = event.target.closest('[data-open-club]');
  if (openButton) location.href = `./jleague-detail.html?club=${encodeURIComponent(openButton.dataset.openClub)}`;
});
nodes.tabs.addEventListener('click', event => {
  const button = event.target.closest('[data-league]');
  if (!button) return;
  activeLeague = button.dataset.league;
  selectedDate = '';
  renderAll();
});
nodes.search.addEventListener('input', () => { query = nodes.search.value; renderClubs(); });
document.addEventListener('sports:calendar-select', event => {
  if (event.detail.calendar !== UI.calendars?.jleague) return;
  selectedDate = event.detail.date;
  renderSchedule();
});
$('#clearDateFilter').addEventListener('click', () => {
  selectedDate = '';
  UI.calendars?.jleague?.clearSelection();
  renderSchedule();
});
SportsHub.applyTheme();
pageTabs.show('home');
renderAll();
loadLiveData();
