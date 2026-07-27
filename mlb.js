const MlbCore = window.FootballCore;
const MlbData = window.MLBData;
const MlbApi = window.MLBService;
const MlbUI = window.SportsUI || window.FootballUI;

const $ = selector => document.querySelector(selector);
const escapeHtml = value => MlbCore.escapeHtml(value);
const empty = (title, description = '') => MlbCore.EmptyState.render(title, description);

const favoriteService = new MlbCore.FavoriteService({ key: 'sportsHubFavoriteMlbTeams' });
const pageTabs = new MlbCore.PageTabs({ root: $('#pageTabs') });

const state = {
  season: MlbApi.currentSeason(),
  teams: [...MlbData.FALLBACK_TEAMS],
  games: [],
  standings: [],
  players: null,
  playersLoading: false,
  selectedDate: '',
  teamFilter: 'all',
  standingFilter: 'all',
  teamQuery: '',
  errors: [],
  loaded: false
};

const nodes = {
  updated: $('#mlbUpdated'),
  refresh: $('#mlbRefresh'),
  todayCount: $('#todayGameCount'),
  todayGames: $('#todayGames'),
  homeFavoriteStatus: $('#homeFavoriteStatus'),
  favoriteNextGames: $('#favoriteNextGames'),
  summary: $('#mlbSummary'),
  homeStandings: $('#homeStandings'),
  scheduleTitle: $('#scheduleTitle'),
  scheduleGames: $('#scheduleGames'),
  clearDate: $('#clearDateFilter'),
  standingFilters: $('#standingLeagueFilters'),
  standings: $('#mlbStandings'),
  teamSearch: $('#teamSearch'),
  teamFilters: $('#teamFilters'),
  teamCount: $('#teamCount'),
  teamGrid: $('#teamGrid'),
  playerStatus: $('#playerStatus'),
  players: $('#japanesePlayers'),
  favoriteBadge: $('#favoriteCountBadge'),
  favoriteTeamCount: $('#favoriteTeamCount'),
  favoriteTeamGrid: $('#favoriteTeamGrid'),
  favoriteGames: $('#favoriteGames')
};

const dayKey = value => MlbUI.dayKey(value);
const favoriteIds = () => favoriteService.list();
const isFavorite = id => favoriteService.has(String(id));
const teamById = id => state.teams.find(team => String(team.id) === String(id));
const now = () => Date.now();

const isFinal = game => String(game.status).toLowerCase() === 'final' || ['F', 'O'].includes(game.statusCode);
const isLive = game => String(game.status).toLowerCase() === 'live' || ['I', 'M'].includes(game.statusCode);
const isUpcoming = game => !isFinal(game) && new Date(game.date).getTime() >= now() - 4 * 60 * 60 * 1000;

const logoMarkup = (team, className = '') => {
  const abbreviation = escapeHtml(team?.abbreviation || team?.name?.slice(0, 2) || 'MLB');
  return `<img class="${className}" src="${escapeHtml(team?.logo || '')}" alt="" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span class="mlb-team-logo-fallback" hidden>${abbreviation}</span>`;
};

const formatDate = value => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '日時未定';
  return `${date.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' })} ${date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}`;
};

const liveStatus = game => {
  const inningNumber = game.inningOrdinal || (game.inning ? `${game.inning}回` : '');
  const side = { Top: '表', Bottom: '裏', Middle: '回間', End: '終了' }[game.inningState] || game.inningState || '';
  return [inningNumber, side].filter(Boolean).join(' ') || game.detailedStatus || 'LIVE';
};

const statusText = game => {
  if (isLive(game)) return liveStatus(game);
  if (isFinal(game)) return '試合終了';
  if (/postponed/i.test(game.detailedStatus)) return '延期';
  if (/cancelled/i.test(game.detailedStatus)) return '中止';
  return game.detailedStatus || '試合前';
};

function gameCard(game) {
  const showScore = isFinal(game) || isLive(game) || game.home.score !== null || game.away.score !== null;
  const score = showScore ? `${game.away.score ?? '-'} - ${game.home.score ?? '-'}` : 'VS';
  const probable = [
    game.probablePitchers?.away ? `A: ${game.probablePitchers.away}` : '',
    game.probablePitchers?.home ? `H: ${game.probablePitchers.home}` : ''
  ].filter(Boolean).join(' / ');
  const classes = ['mlb-game-card', isLive(game) && 'is-live', isFinal(game) && 'is-final'].filter(Boolean).join(' ');

  return `<article class="${classes}" data-game-id="${escapeHtml(game.id)}">
    <div class="mlb-game-meta">
      <span>${escapeHtml(formatDate(game.date))}</span>
      <span>${escapeHtml(game.gameTypeName)}${game.gameNumber > 1 ? `・第${game.gameNumber}試合` : ''}</span>
    </div>
    <div class="mlb-matchup">
      <div class="mlb-game-team is-away">
        <div><strong>${escapeHtml(game.away.name)}</strong><small>${escapeHtml(game.away.en)}</small></div>
        ${logoMarkup(game.away)}
      </div>
      <div class="mlb-score"><strong>${escapeHtml(score)}</strong><small>${escapeHtml(statusText(game))}</small></div>
      <div class="mlb-game-team is-home">
        ${logoMarkup(game.home)}
        <div><strong>${escapeHtml(game.home.name)}</strong><small>${escapeHtml(game.home.en)}</small></div>
      </div>
    </div>
    <div class="mlb-game-footer">
      <span>${game.venue ? `🏟 ${escapeHtml(game.venue)}` : escapeHtml(game.series || 'MLB')}</span>
      <span>${probable ? `予告先発 ${escapeHtml(probable)}` : escapeHtml(game.series || '')}</span>
    </div>
  </article>`;
}

function renderGameList(root, games, title, description = '') {
  if (!root) return;
  root.innerHTML = games.length ? games.map(gameCard).join('') : empty(title, description);
}

function favoriteGames() {
  const ids = new Set(favoriteIds());
  return state.games.filter(game => ids.has(String(game.home.id)) || ids.has(String(game.away.id)));
}

function renderToday() {
  const today = dayKey(new Date());
  const games = state.games.filter(game => dayKey(game.date) === today);
  nodes.todayCount.textContent = `${games.length}試合`;
  renderGameList(nodes.todayGames, games, '今日の試合はありません', '日程がある日は自動で表示されます。');
}

function renderFavoriteGames() {
  const ids = favoriteIds();
  const teams = ids.map(teamById).filter(Boolean);
  const upcoming = favoriteGames().filter(isUpcoming).sort((a, b) => new Date(a.date) - new Date(b.date));

  nodes.homeFavoriteStatus.textContent = `${teams.length}球団`;
  nodes.favoriteBadge.textContent = teams.length;
  nodes.favoriteTeamCount.textContent = `${teams.length}球団`;
  renderGameList(nodes.favoriteNextGames, upcoming.slice(0, 5), '推し球団が未登録です', '球団一覧の☆から登録できます。');
  renderGameList(nodes.favoriteGames, upcoming.slice(0, 30), '今後の試合はありません', '次の試合が決まると自動表示されます。');
  nodes.favoriteTeamGrid.innerHTML = teams.length ? teams.map(teamCard).join('') : empty('推し球団がありません', '球団一覧から複数登録できます。');
}

function renderSummary() {
  const live = state.games.filter(isLive).length;
  const final = state.games.filter(isFinal).length;
  const upcoming = state.games.filter(isUpcoming).length;
  const cards = [
    ['シーズン', state.season, '年度'],
    ['登録球団', state.teams.length, '球団'],
    ['LIVE', live, '試合'],
    ['終了', final, '試合'],
    ['今後', upcoming, '試合'],
    ['推し', favoriteIds().length, '球団']
  ];

  nodes.summary.innerHTML = cards.map(([label, value, suffix]) => `<article class="mlb-summary-card"><span>${label}</span><strong>${value}</strong><small>${suffix}</small></article>`).join('');
}

function standingSection(group, { limit = null, compact = false } = {}) {
  const rows = typeof limit === 'number' ? group.rows.slice(0, limit) : group.rows;
  const favorites = new Set(favoriteIds());
  const body = rows.map(row => `<div class="mlb-standing-row${favorites.has(String(row.team.id)) ? ' is-favorite' : ''}">
    <strong>${row.rank || '-'}</strong>
    <span class="mlb-standing-team">${logoMarkup(row.team)}<span>${escapeHtml(row.team.name)}</span></span>
    <span>${row.wins}</span><span>${row.losses}</span><span>${escapeHtml(row.pct)}</span><span>${escapeHtml(row.gamesBack)}</span>
  </div>`).join('');

  return `<section class="mlb-standing-section${compact ? ' is-compact' : ''}">
    <div class="mlb-standing-title"><h3>${escapeHtml(group.division.name)}</h3><span>${escapeHtml(group.league.code)}</span></div>
    <div class="mlb-standing-head"><span>順</span><span>球団</span><span>勝</span><span>敗</span><span>率</span><span>差</span></div>
    ${body || empty('順位データがありません')}
  </section>`;
}

function renderStandings() {
  const filters = [
    ['all', 'すべて'],
    ['103', 'ア・リーグ'],
    ['104', 'ナ・リーグ']
  ];
  nodes.standingFilters.innerHTML = filters.map(([id, label]) => `<button class="mlb-filter-button${state.standingFilter === id ? ' active' : ''}" type="button" data-standing-filter="${id}">${label}</button>`).join('');

  const groups = state.standings.filter(group => state.standingFilter === 'all' || String(group.leagueId) === state.standingFilter);
  nodes.standings.innerHTML = groups.length ? groups.map(group => standingSection(group)).join('') : empty('順位データを取得できません', 'シーズン開始後に表示されます。');
  nodes.homeStandings.innerHTML = state.standings.length ? state.standings.map(group => standingSection(group, { limit: 1, compact: true })).join('') : empty('順位データを準備中です');
}

function renderTeamFilters() {
  const filters = [
    ['all', 'すべて'],
    ['103', 'ア・リーグ'],
    ['104', 'ナ・リーグ'],
    ['favorites', '推しのみ']
  ];
  nodes.teamFilters.innerHTML = filters.map(([id, label]) => `<button class="mlb-filter-button${state.teamFilter === id ? ' active' : ''}" type="button" data-team-filter="${id}">${label}</button>`).join('');
}

function teamCard(team) {
  const favorite = isFavorite(team.id);
  return `<article class="mlb-team-card${favorite ? ' is-favorite' : ''}" data-team-card="${escapeHtml(team.id)}">
    <div class="mlb-team-logo-wrap">${logoMarkup(team, 'mlb-team-logo')}</div>
    <div class="mlb-team-copy"><strong>${escapeHtml(team.name)}</strong><small>${escapeHtml(team.en)}・${escapeHtml(team.division?.code || '')}</small></div>
    <button class="mlb-favorite-button${favorite ? ' is-active' : ''}" type="button" data-favorite-team="${escapeHtml(team.id)}" aria-label="${escapeHtml(team.name)}を推し球団に登録">${favorite ? '★' : '☆'}</button>
  </article>`;
}

function visibleTeams() {
  const query = state.teamQuery.trim().toLocaleLowerCase('ja');
  return state.teams.filter(team => {
    const filterMatch = state.teamFilter === 'all'
      || state.teamFilter === 'favorites' && isFavorite(team.id)
      || String(team.leagueId) === state.teamFilter;
    if (!filterMatch) return false;
    if (!query) return true;
    return [team.name, team.en, team.abbreviation]
      .filter(Boolean)
      .some(value => String(value).toLocaleLowerCase('ja').includes(query));
  });
}

function renderTeams() {
  renderTeamFilters();
  const teams = visibleTeams();
  nodes.teamCount.textContent = `${teams.length}球団`;
  nodes.teamGrid.innerHTML = teams.length ? teams.map(teamCard).join('') : empty('該当する球団がありません', '検索条件を変更してください。');
}

function playerCard(player) {
  const initial = escapeHtml(player.name?.slice(0, 1) || '日');
  return `<article class="mlb-player-card">
    <div class="mlb-player-photo"><img src="${escapeHtml(player.headshot)}" alt="" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span class="mlb-player-fallback" hidden>${initial}</span></div>
    <div class="mlb-player-copy"><strong>${escapeHtml(player.name)}</strong><span>${escapeHtml(player.position)}</span><small class="mlb-player-team">${player.teamLogo ? `<img src="${escapeHtml(player.teamLogo)}" alt="">` : ''}${escapeHtml(player.teamName)}</small></div>
  </article>`;
}

function renderPlayers() {
  if (state.playersLoading) {
    nodes.playerStatus.textContent = '取得中';
    nodes.players.innerHTML = '<div class="mlb-loading">日本人選手データを取得しています。</div>';
    return;
  }

  if (!state.players) return;
  nodes.playerStatus.textContent = `${state.players.length}選手`;
  nodes.players.innerHTML = state.players.length ? state.players.map(playerCard).join('') : empty('日本人選手を取得できませんでした', 'MLBの登録情報が更新されると自動反映されます。');
}

function renderSchedule() {
  const visible = state.selectedDate
    ? calendar.matchesOnDate(state.selectedDate)
    : calendar.getVisibleMatches(state.games)
      .filter(game => new Date(game.date).getTime() >= now() - 12 * 60 * 60 * 1000)
      .slice(0, 40);

  nodes.scheduleTitle.textContent = state.selectedDate
    ? `${Number(state.selectedDate.slice(5, 7))}月${Number(state.selectedDate.slice(8, 10))}日の試合`
    : calendar.favoriteOnly ? '推し球団の今後の日程' : '今後の試合日程';

  renderGameList(
    nodes.scheduleGames,
    visible,
    calendar.favoriteOnly ? '推し球団の試合がありません' : '表示できる試合がありません',
    calendar.favoriteOnly ? '推しのみをOFFにするか、球団を登録してください。' : '別の日付を選択してください。'
  );
}

function renderAll() {
  renderToday();
  renderFavoriteGames();
  renderSummary();
  renderStandings();
  renderTeams();
  renderPlayers();
  calendar.render();
  renderSchedule();
}

async function loadPlayers({ fresh = false } = {}) {
  if (state.playersLoading || state.players && !fresh) return;
  state.playersLoading = true;
  renderPlayers();
  try {
    state.players = await MlbApi.loadJapanesePlayers({ season: state.season, fresh });
  } catch (error) {
    console.warn('Japanese MLB players unavailable:', error);
    state.players = [];
    SportsHub.toast('日本人選手データを取得できませんでした', 2600);
  } finally {
    state.playersLoading = false;
    renderPlayers();
  }
}

async function loadHub({ fresh = false } = {}) {
  nodes.updated.textContent = fresh ? 'MLBデータを更新しています…' : 'MLBデータを読み込んでいます…';
  nodes.refresh.disabled = true;

  if (fresh) MlbApi.clearCache();

  try {
    const payload = await MlbApi.loadHub({ season: state.season, fresh });
    state.season = payload.season;
    state.teams = payload.teams.length ? payload.teams : [...MlbData.FALLBACK_TEAMS];
    state.games = payload.games;
    state.standings = payload.standings;
    state.errors = payload.errors;
    state.loaded = true;

    const updated = new Date(payload.updatedAt).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    nodes.updated.textContent = state.errors.length ? `最終更新 ${updated}・一部データ取得待ち` : `最終更新 ${updated}`;
    renderAll();
  } catch (error) {
    console.warn('MLB Hub data unavailable:', error);
    nodes.updated.textContent = 'MLBデータを取得できませんでした';
    SportsHub.toast('MLBデータを取得できませんでした', 2600);
    renderAll();
  } finally {
    nodes.refresh.disabled = false;
  }
}

const calendarFilterKey = 'footballCalendarFavoriteOnly:mlb';
if (localStorage.getItem(calendarFilterKey) === null) localStorage.setItem(calendarFilterKey, 'false');

const CalendarClass = MlbUI.SportsCalendar || MlbUI.FootballCalendar;
const calendar = new CalendarClass({
  page: 'mlb',
  filterStorageKey: calendarFilterKey,
  root: $('#matchCalendar'),
  title: $('#calendarTitle'),
  prev: $('#calendarPrev'),
  next: $('#calendarNext'),
  getMatches: () => state.games,
  getFavorites: favoriteIds,
  getPrimary: () => '',
  getDate: game => game.date,
  getTeamVisual: id => {
    const team = teamById(id);
    return { logo: team?.logo || MlbData.teamLogo(id), label: team?.abbreviation || '⚾' };
  },
  onSelect: date => {
    state.selectedDate = date;
    renderSchedule();
  }
});

MlbUI.calendars = MlbUI.calendars || {};
MlbUI.calendars.mlb = calendar;

pageTabs.bind(page => {
  if (page === 'players') loadPlayers();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

document.addEventListener('click', event => {
  const jump = event.target.closest('[data-page-jump]');
  if (jump) {
    pageTabs.show(jump.dataset.pageJump);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const favoriteButton = event.target.closest('[data-favorite-team]');
  if (favoriteButton) {
    const id = favoriteButton.dataset.favoriteTeam;
    const team = teamById(id);
    const added = favoriteService.toggle(id);
    SportsHub.toast(`${team?.name || '球団'}を推し球団から${added ? '追加' : '解除'}しました`);
    renderFavoriteGames();
    renderSummary();
    renderStandings();
    renderTeams();
    calendar.render();
    renderSchedule();
  }
});

nodes.teamFilters.addEventListener('click', event => {
  const button = event.target.closest('[data-team-filter]');
  if (!button) return;
  state.teamFilter = button.dataset.teamFilter;
  renderTeams();
});

nodes.standingFilters.addEventListener('click', event => {
  const button = event.target.closest('[data-standing-filter]');
  if (!button) return;
  state.standingFilter = button.dataset.standingFilter;
  renderStandings();
});

nodes.teamSearch.addEventListener('input', () => {
  state.teamQuery = nodes.teamSearch.value;
  renderTeams();
});

nodes.clearDate.addEventListener('click', () => {
  state.selectedDate = '';
  calendar.clearSelection();
  renderSchedule();
});

nodes.refresh.addEventListener('click', async () => {
  await loadHub({ fresh: true });
  if (state.players) await loadPlayers({ fresh: true });
});

document.addEventListener('football:calendar-select', event => {
  if (event.detail.calendar !== calendar) return;
  state.selectedDate = event.detail.date;
  renderSchedule();
});

SportsHub.applyTheme();
pageTabs.show('home');
calendar.render();
renderAll();
loadHub();