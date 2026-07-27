const sharedMatchHubUI = window.SportsUI || window.FootballUI || {};
window.SportsUI = sharedMatchHubUI;
window.FootballUI = sharedMatchHubUI;

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

  let calendar;
  const matchesOnDate = date => {
    if (!date) return [];
    return calendar
      ? calendar.matchesOnDate(date)
      : matches().filter(match => namespace.dayKey(match.date) === date);
  };

  const renderSelectedMatches = date => {
    if (!selectedMatchesRoot) return;
    if (!date) {
      selectedMatchesRoot.innerHTML = '<p class="calendar-hint">試合がある日付をタップすると詳細を表示</p>';
      return;
    }

    const selected = matchesOnDate(date);
    selectedMatchesRoot.innerHTML = selected.length
      ? selected.map(match => matchCard(match, { rich: true })).join('')
      : Core?.SportsScheduleEmptyState?.render({
          title: calendar?.favoriteOnly ? 'この日に推しの試合はありません' : 'この日の試合はありません',
          description: '別の日付を選択してください。',
          className: 'compact-empty'
        }) || `<p class="empty compact-empty">${calendar?.favoriteOnly ? 'この日に推しの試合はありません' : 'この日の試合はありません'}</p>`;
  };

  const options = {
    page: 'five',
    root,
    title: document.querySelector('#calendarTitle'),
    ...controls,
    getMatches: matches,
    getFavorites: () => state.favorites,
    getPrimary: () => state.primary,
    getDate: match => match.date,
    getTeamVisual: id => {
      const team = teamById(id);
      return { logo: team?.logo, label: '★' };
    },
    onSelect: date => {
      state.calendarSelected = date || null;
      renderSelectedMatches(date);
    }
  };

  calendar = namespace.createCalendar
    ? namespace.createCalendar(options)
    : new (namespace.SoccerCalendar || namespace.FootballCalendar || namespace.SportsCalendar)(options);

  const renderSharedCalendar = () => {
    calendar.selected = state.calendarSelected || '';
    calendar.render();
    renderSelectedMatches(calendar.selected);
  };

  renderCalendar = renderSharedCalendar;
  changeCalendarMonth = delta => calendar.shift(delta);

  namespace.calendars = namespace.calendars || {};
  namespace.calendars.five = calendar;
  window.MatchHubUsesLegacyCalendar = false;
  renderSharedCalendar();
})(sharedMatchHubUI);
