const { teams: countries, regions } = SportsHubNational;
const Core = window.SportsCore || window.FootballCore;
const UI = window.SportsUI || window.FootballUI;
const Rankings = window.SportsRankings;
const favoriteService = new Core.FavoriteService({ key: 'sportsHubFavoriteNationals', legacyKey: 'sportsHubFavoriteNational' });
const pageTabs = new Core.PageTabs({ root: document.querySelector('#pageTabs') });
const dataAdapter = new FootballAdapters.NationalAdapter();
const fifaRankingService = Rankings?.FifaRankingService ? new Rankings.FifaRankingService() : null;

let activeRegion = 'all';
let query = '';
let nationalMatches = [];
let selectedDate = '';
let matchUpdatedAt = '';
let rankingOfficialDate = '';
let rankingLoaded = false;

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
const teamDetailHref = (id, fallbackName = '') => {
  const team = resolveTeam(id, fallbackName);
  return team?.id ? `./national-detail.html?team=${encodeURIComponent(team.id)}` : '';
};
const dateKey = value => new Core.MatchModel({ kickoff: value }).dateKey;
const rankingFor = (id, fallbackName = '') => fifaRankingService?.findTeam(id, fallbackName) || null;
const rankingLabel = entry => rankingLoaded
  ? fifaRankingService?.formatRank(entry, 'FIFA順位外') || 'FIFA順位外'
  : '';

function formatStatusDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' });
}

function syncUpdatedStatus() {
  const status = document.querySelector('#nationalUpdatedAt');
  if (!status) return;
  const parts = [];
  if (matchUpdatedAt) parts.push(`試合 ${formatStatusDate(matchUpdatedAt)}`);
  if (rankingOfficialDate) parts.push(`FIFA順位 ${formatStatusDate(rankingOfficialDate)}`);
  else if (rankingLoaded) parts.push('FIFA順位 更新日不明');
  status.textContent = parts.length ? `最終更新 ${parts.join('・')}` : '代表戦・FIFA順位データを読み込んでいます';
}

const matchRenderer = SportsHubComponents.createMatchCardRenderer({
  normalize: match => {
    const finished = match.status === 'finished';
    const live = match.status === 'in_play';
    const homeTeam = resolveTeam(match.home, match.homeName);
    const awayTeam = resolveTeam(match.away, match.awayName);
    const homeName = match.homeName || homeTeam?.name || teamName(match.home, match.homeName);
    const awayName = match.awayName || awayTeam?.name || teamName(match.away, match.awayName);
    const matchup = fifaRankingService?.matchup(match.home, match.away, homeName, awayName) || {};
    const interest = matchup.interest || null;
    const originalStage = match.round || match.stage || '';
    const interestText = interest
      ? `注目度 ${interest.grade}・${interest.label}・順位差${interest.rankGap}`
      : '';

    return {
      match,
      date: match.kickoff,
      timeText: finished ? '試合終了' : live ? 'LIVE' : '',
      scoreText: finished || live ? `${match.homeScore ?? '-'} - ${match.awayScore ?? '-'}` : 'VS',
      competition: match.competition || '代表戦',
      stage: [originalStage, interestText].filter(Boolean).join(' / '),
      venue: match.venue || '',
      className: interest ? `national-match-interest national-match-interest--${interest.grade.toLowerCase()}` : '',
      attributes: interest ? {
        'data-interest-grade': interest.grade,
        'data-interest-score': interest.score,
        'aria-label': `${homeName}対${awayName}、注目度${interest.grade}`
      } : {},
      home: {
        id: homeTeam?.id || match.home,
        name: teamName(match.home, match.homeName),
        flag: teamFlag(match.home, match.homeName),
        subtitle: rankingLabel(matchup.left),
        href: teamDetailHref(match.home, match.homeName),
        ariaLabel: `${homeName}代表の詳細を見る`
      },
      away: {
        id: awayTeam?.id || match.away,
        name: teamName(match.away, match.awayName),
        flag: teamFlag(match.away, match.awayName),
        subtitle: rankingLabel(matchup.right),
        href: teamDetailHref(match.away, match.awayName),
        ariaLabel: `${awayName}代表の詳細を見る`
      }
    };
  }
});

function teamCard(country) {
  const selected = isFavorite(country.id);
  const ranking = rankingFor(country.id, country.en);
  const rankingText = rankingLabel(ranking);
  return `<article class="country-card${selected ? ' selected' : ''}"><span class="flag" aria-hidden="true">${country.flag}</span><button class="country-copy" type="button" data-open-country="${country.id}"><strong>${country.name}</strong><small>${country.en}${rankingText ? `・${rankingText}` : ''}</small></button><button class="favorite-button${selected ? ' active' : ''}" type="button" data-favorite-country="${country.id}" aria-label="${country.name}代表をお気に入り登録">${selected ? '★' : '☆'}</button></article>`;
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
    matchUpdatedAt = metadata.updatedAt || '';
    syncUpdatedStatus();
    renderAll();
  } catch (error) {
    document.querySelector('#nationalUpdatedAt').textContent = '代表戦データを準備中';
    console.warn('National data unavailable', error);
  }
}

async function loadRankingData() {
  if (!fifaRankingService) return;
  try {
    const payload = await fifaRankingService.load();
    rankingLoaded = fifaRankingService.entries.length > 0;
    rankingOfficialDate = payload.officialDate || '';
    syncUpdatedStatus();
    renderAll();
  } catch (error) {
    rankingLoaded = false;
    syncUpdatedStatus();
    console.warn('FIFA ranking data unavailable', error);
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
loadRankingData();
