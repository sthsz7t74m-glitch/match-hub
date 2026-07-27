const { teams: countries, regions } = SportsHubNational;
const Core = window.SportsCore || window.FootballCore;
const UI = window.SportsUI || window.FootballUI;
const favoriteService = new Core.FavoriteService({ key: 'sportsHubFavoriteNationals', legacyKey: 'sportsHubFavoriteNational' });
const pageTabs = new Core.PageTabs({ root: document.querySelector('#pageTabs') });
const dataAdapter = new FootballAdapters.NationalAdapter();

let activeRegion = 'all';
let query = '';
let nationalMatches = [];
let selectedDate = '';

const filters = document.querySelector('#regionFilters');
const search = document.querySelector('#countrySearch');
const grid = document.querySelector('#countryGrid');
const favoriteGrid = document.querySelector('#favoriteCountryGrid');
const empty = (title, text = '') => Core.EmptyState.render(title, text);
const scheduleEmpty = (title, description = '') => Core.SportsScheduleEmptyState.render({ title, description, className: 'national-empty-state' });
const favoritesEmpty = (title, description = '') => Core.SportsFavoritesEmptyState.render({ title, description, className: 'national-empty-state' });
const dataEmpty = (title, description = '') => Core.SportsDataEmptyState.render({ title, description, className: 'national-empty-state' });
const favoriteIds = () => favoriteService.list();
const isFavorite = id => favoriteService.has(id);
const openDetail = id => { location.href = `./national-detail.html?team=${encodeURIComponent(id)}`; };
const resolveTeam = (id, name = '') => SportsHubNational.find(id) || SportsHubNational.find(name);
const teamName = (id, fallback = '') => resolveTeam(id, fallback)?.name || fallback || id;
const teamFlag = (id, fallback = '') => resolveTeam(id, fallback)?.flag || '🏳️';
const dateKey = value => new Core.MatchModel({ kickoff: value }).dateKey;

const matchRenderer = SportsHubComponents.createMatchCardRenderer({
  normalize: match => {
    const finished = match.status === 'finished';
    const live = match.status === 'in_play';
    return {
      match,
      date: match.kickoff,
      timeText: finished ? '試合終了' : live ? 'LIVE' : '',
      scoreText: finished || live ? `${match.homeScore ?? '-'} - ${match.awayScore ?? '-'}` : 'VS',
      competition: match.competition || '代表戦',
      stage: match.round || match.stage || '',
      venue: match.venue || '',
      home: { name: teamName(match.home, match.homeName), flag: teamFlag(match.home, match.homeName) },
      away: { name: teamName(match.away, match.awayName), flag: teamFlag(match.away, match.awayName) }
    };
  }
});

function teamCard(country) {
  const selected = isFavorite(country.id);
  return `<article class="country-card${selected ? ' selected' : ''}"><span class="flag" aria-hidden="true">${country.flag}</span><button class="country-copy" type="button" data-open-country="${country.id}"><strong>${country.name}</strong><small>${country.en}</small></button><button class="favorite-button${selected ? ' active' : ''}" type="button" data-favorite-country="${country.id}" aria-label="${country.name}代表をお気に入り登録">${selected ? '★' : '☆'}</button></article>`;
}

function renderFilters() {
  filters.innerHTML = regions.map(([id, label]) => `<button class="chip${activeRegion === id ? ' active' : ''}" type="button" data-region="${id}">${label}</button>`).join('');
}

function renderCountries() {
  const rawQuery = query.trim();
  const normalized = rawQuery.toLowerCase();
  const visible = countries.filter(country =>
    (activeRegion === 'all' || country.region === activeRegion) &&
    (!normalized || country.name.includes(rawQuery) || country.en.toLowerCase().includes(normalized))
  );
  document.querySelector('#countryCount').textContent = `${visible.length}代表`;
  grid.innerHTML = visible.map(teamCard).join('') || empty('該当する代表がありません', '検索条件を変えてみてください。');
}

function favoriteMatchList() {
  const ids = new Set(favoriteIds().map(String));
  return nationalMatches.filter(match => ids.has(String(match.home)) || ids.has(String(match.away)));
}

function renderFavorites() {
  const ids = favoriteIds();
  const teams = ids.map(id => SportsHubNational.find(id)).filter(Boolean);
  document.querySelector('#favoriteCountBadge').textContent = teams.length;
  document.querySelector('#homeFavoriteStatus').textContent = `${teams.length}代表`;
  document.querySelector('#favoriteTeamCount').textContent = `${teams.length}代表`;
  favoriteGrid.innerHTML = teams.map(teamCard).join('') || favoritesEmpty('お気に入りがありません', '代表一覧の☆から複数登録できます。');

  const upcoming = new Core.MatchService(favoriteMatchList()).upcoming();
  document.querySelector('#favoriteNextMatches').innerHTML = matchRenderer.renderMany(upcoming.slice(0, 5)) || scheduleEmpty('次戦データがありません', 'お気に入りを登録するか、次回更新をお待ちください。');
  document.querySelector('#favoriteMatches').innerHTML = matchRenderer.renderMany(upcoming.slice(0, 20)) || scheduleEmpty('今後の試合がありません', '更新後に自動表示されます。');
}

function competitionCards(limit) {
  const counts = nationalMatches.reduce((result, match) => {
    const name = match.competition || '代表戦';
    result[name] = (result[name] || 0) + 1;
    return result;
  }, {});
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const visible = typeof limit === 'number' ? entries.slice(0, limit) : entries;
  return visible.map(([name, count]) => `<article><span>🏆</span><h3>${name}</h3><p>${count}試合</p></article>`).join('') || '<article><span>📡</span><h3>データ待機中</h3><p>利用可能な大会を取得します</p></article>';
}

function renderMatches() {
  const ordered = [...nationalMatches].sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff));
  const recent = ordered.filter(match => new Date(match.kickoff).getTime() >= Date.now() - 259200000).slice(0, 12);
  document.querySelector('#nationalMatchCount').textContent = `${recent.length}試合`;
  document.querySelector('#nationalMatches').innerHTML = matchRenderer.renderMany(recent) || dataEmpty('表示できる代表戦がありません', '次回更新後に自動表示されます。');
  document.querySelector('#homeCompetitionSummary').innerHTML = competitionCards(4);
  document.querySelector('#competitionSummary').innerHTML = competitionCards();
}

function calendarMatches() {
  const calendar = UI?.calendars?.national;
  return calendar?.favoriteOnly ? favoriteMatchList() : nationalMatches;
}

function renderSchedule() {
  const ordered = [...calendarMatches()].sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff));
  const visible = selectedDate ? ordered.filter(match => dateKey(match.kickoff) === selectedDate) : ordered;
  document.querySelector('#scheduleTitle').textContent = selectedDate ? `${Number(selectedDate.slice(5, 7))}月${Number(selectedDate.slice(8, 10))}日の試合` : '試合日程';
  const favoriteOnly = UI?.calendars?.national?.favoriteOnly;
  document.querySelector('#scheduleMatches').innerHTML = matchRenderer.renderMany(visible.slice(0, 40)) || scheduleEmpty(favoriteOnly ? 'この日に推しの試合はありません' : 'この日の試合はありません', '別の日付を選択してください。');
}

function renderAll() {
  renderFilters();
  renderCountries();
  renderFavorites();
  renderMatches();
  renderSchedule();
}

async function loadMatchData() {
  try {
    const payload = await dataAdapter.load();
    nationalMatches = payload.matches || [];
    const metadata = await dataAdapter.loadMetadata();
    document.querySelector('#nationalUpdatedAt').textContent = metadata.updatedAt ? `最終更新 ${new Date(metadata.updatedAt).toLocaleString('ja-JP')}` : '更新データ未生成';
    renderAll();
  } catch (error) {
    document.querySelector('#nationalUpdatedAt').textContent = '代表戦データを準備中';
    console.warn('National data unavailable', error);
  }
}

pageTabs.bind();
document.addEventListener('click', event => {
  const jump = event.target.closest('[data-page-jump]');
  if (jump) {
    pageTabs.show(jump.dataset.pageJump);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
});
filters.addEventListener('click', event => {
  const button = event.target.closest('[data-region]');
  if (!button) return;
  activeRegion = button.dataset.region;
  renderFilters();
  renderCountries();
});
function handleTeamGridClick(event) {
  const favoriteButton = event.target.closest('[data-favorite-country]');
  if (favoriteButton) {
    const country = SportsHubNational.find(favoriteButton.dataset.favoriteCountry);
    const added = favoriteService.toggle(country.id);
    SportsHub.toast(`${country.name}代表を${added ? '登録' : '解除'}しました`);
    renderCountries();
    renderFavorites();
    UI?.calendars?.national?.render();
    return;
  }
  const openButton = event.target.closest('[data-open-country]');
  if (openButton) openDetail(openButton.dataset.openCountry);
}
grid.addEventListener('click', handleTeamGridClick);
favoriteGrid.addEventListener('click', handleTeamGridClick);
search.addEventListener('input', () => { query = search.value; renderCountries(); });
document.addEventListener('sports:calendar-select', event => {
  if (event.detail.calendar !== UI?.calendars?.national) return;
  selectedDate = event.detail.date;
  renderSchedule();
});
document.querySelector('#clearDateFilter').addEventListener('click', () => UI?.calendars?.national?.clearSelection());
SportsHub.applyTheme();
pageTabs.show('home');
renderAll();
loadMatchData();
