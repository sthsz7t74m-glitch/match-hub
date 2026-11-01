const sharedMatchHubUI = window.SportsUI || window.FootballUI || {};
window.SportsUI = sharedMatchHubUI;
window.FootballUI = sharedMatchHubUI;

// Keep this feature self-contained: load its CSS without adding another legacy override to index.html.
if (!document.querySelector('link[data-calendar-league-filter]')) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = './assets/css/calendar-league-filter.css?v=114';
  link.dataset.calendarLeagueFilter = 'true';
  document.head.appendChild(link);
}
const releaseBadge = document.querySelector('.version');
if (releaseBadge) releaseBadge.textContent = 'v1.1.28';

(function initializeMatchHubCalendar(namespace) {
  if (document.body.dataset.hub !== 'five' || namespace.calendars?.five) return;
  const Core = window.SportsCore || window.FootballCore;
  if (!namespace.SportsCalendar && !namespace.FootballCalendar) {
    console.warn('Shared SportsCalendar is not available');
    return;
  }

  const replaceControl = selector => {
    const current = document.querySelector(selector);
    if (!current?.parentNode) return current;
    const replacement = current.cloneNode(true);
    current.parentNode.replaceChild(replacement, current);
    return replacement;
  };

  const root = document.querySelector('#calendarGrid');
  if (!root) return;

  const controls = {
    prev: replaceControl('#calendarPrev'),
    next: replaceControl('#calendarNext'),
    today: replaceControl('#calendarToday')
  };
  const selectedMatchesRoot = document.querySelector('#calendarMatches');
  const currentData = () => state.data || { fixtures: [], teams: [] };
  const matches = () => currentData().fixtures || [];
  const teamById = id => (currentData().teams || []).find(team => String(team.id) === String(id));
  const leagueLabels = {
    '39': 'プレミアリーグ',
    '140': 'ラ・リーガ',
    '135': 'セリエA',
    '78': 'ブンデスリーガ',
    '61': 'リーグ・アン'
  };
  let selectedLeague = 'all';
  let matchScope = 'day';

  let calendar;
  const matchesOnDate = date => {
    if (!date) return [];
    return calendar
      ? calendar.matchesOnDate(date)
      : matches().filter(match => namespace.dayKey(match.date) === date);
  };

  const leagueIdOf = match => String(match?.leagueId ?? match?.competitionId ?? 'other');
  const leagueLabelOf = match => match?.competitionJa || leagueLabels[leagueIdOf(match)] || match?.competition || 'その他';

  const renderLeagueFilters = selected => {
    const groups = new Map();
    selected.forEach(match => {
      const id = leagueIdOf(match);
      if (!groups.has(id)) groups.set(id, { id, label: leagueLabelOf(match), count: 0 });
      groups.get(id).count += 1;
    });
    if (groups.size <= 1) return '';
    const filters = [...groups.values()]
      .sort((a, b) => a.label.localeCompare(b.label, 'ja'))
      .map(group => `<button class="chip${selectedLeague === group.id ? ' active' : ''}" type="button" data-calendar-league="${group.id}">${group.label}<small>${group.count}</small></button>`)
      .join('');
    return `<div class="calendar-league-filter"><p class="muted">リーグで絞り込み</p><div class="chips"><button class="chip${selectedLeague === 'all' ? ' active' : ''}" type="button" data-calendar-league="all">すべて<small>${selected.length}</small></button>${filters}</div></div>`;
  };

  const renderScopeFilters = () => `
    <div class="calendar-league-filter" aria-label="試合の期間で絞り込み">
      <p class="muted">表示する試合</p>
      <div class="chips">
        <button type="button" class="chip${matchScope === 'day' ? ' active' : ''}" data-calendar-scope="day" aria-pressed="${matchScope === 'day'}">すべて</button>
        <button type="button" class="chip${matchScope === 'upcoming' ? ' active' : ''}" data-calendar-scope="upcoming" aria-pressed="${matchScope === 'upcoming'}">今後</button>
      </div>
    </div>`;

  const renderSelectedMatches = date => {
    if (!selectedMatchesRoot) return;
    if (!date) {
      selectedLeague = 'all';
      selectedMatchesRoot.innerHTML = renderScopeFilters() + '<p class="calendar-hint">試合がある日付をタップすると詳細を表示</p>';
      return;
    }

    // First constrain to the selected calendar day, respecting favorite-only.
    // "今後" further excludes games whose kickoff has already passed.
    const dayMatches = matchesOnDate(date);
    const selected = matchScope === 'upcoming'
      ? dayMatches.filter(match => Number.isFinite(Date.parse(match.date)) && Date.parse(match.date) > Date.now())
      : dayMatches;
    const availableLeagues = new Set(selected.map(leagueIdOf));
    if (selectedLeague !== 'all' && !availableLeagues.has(selectedLeague)) selectedLeague = 'all';
    const visible = selectedLeague === 'all' ? selected : selected.filter(match => leagueIdOf(match) === selectedLeague);
    const filters = renderScopeFilters() + renderLeagueFilters(selected);
    const cards = visible.length
      ? visible.map(match => matchCard(match, { rich: true })).join('')
      : Core?.SportsScheduleEmptyState?.render({ title: '該当する試合はありません', description: 'リーグや表示期間を変更してください。', className: 'compact-empty' }) || '<p class="empty compact-empty">このリーグの試合はありません</p>';

    const emptyTitle = matchScope === 'upcoming'
      ? '今後の試合はありません'
      : calendar?.favoriteOnly ? 'この日に推しの試合はありません' : 'この日の試合はありません';
    selectedMatchesRoot.innerHTML = `${filters}${selected.length
      ? cards
      : (Core?.SportsScheduleEmptyState?.render({ title: emptyTitle, description: matchScope === 'upcoming' ? '選択した日にこれから始まる試合はありません。' : '別の日付を選択してください。', className: 'compact-empty' }) || `<p class="empty compact-empty">${emptyTitle}</p>`)}`;
  };

  selectedMatchesRoot?.addEventListener('click', event => {
    const scopeButton = event.target.closest('[data-calendar-scope]');
    if (scopeButton) {
      matchScope = scopeButton.dataset.calendarScope === 'upcoming' ? 'upcoming' : 'day';
      selectedLeague = 'all';
      renderSelectedMatches(state.calendarSelected);
      return;
    }
    const button = event.target.closest('[data-calendar-league]');
    if (!button) return;
    selectedLeague = button.dataset.calendarLeague || 'all';
    renderSelectedMatches(state.calendarSelected);
  });

  const options = {
    page: 'five', root, title: document.querySelector('#calendarTitle'), ...controls,
    getMatches: matches,
    getFavorites: () => state.favorites,
    getPrimary: () => state.primary,
    getDate: match => match.date,
    getTeamVisual: id => { const team = teamById(id); return { logo: team?.logo, label: '★' }; },
    onSelect: date => {
      if ((date || null) !== state.calendarSelected) {
        selectedLeague = 'all';
      }
      state.calendarSelected = date || null;
      renderSelectedMatches(date);
    }
  };

  calendar = namespace.createCalendar ? namespace.createCalendar(options) : new (namespace.SoccerCalendar || namespace.FootballCalendar || namespace.SportsCalendar)(options);
  const renderSharedCalendar = () => {
    calendar.selected = state.calendarSelected || '';
    calendar.render();
    renderSelectedMatches(calendar.selected);
  };
  renderCalendar = renderSharedCalendar;
  changeCalendarMonth = delta => { selectedLeague = 'all'; calendar.shift(delta); };
  namespace.calendars = namespace.calendars || {};
  namespace.calendars.five = calendar;
  window.MatchHubUsesLegacyCalendar = false;
  renderSharedCalendar();
})(sharedMatchHubUI);
