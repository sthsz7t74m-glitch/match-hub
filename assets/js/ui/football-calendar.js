const sharedCalendarUI = window.SportsUI || window.FootballUI || {};
window.SportsUI = sharedCalendarUI;
window.FootballUI = sharedCalendarUI;

(function initializeSportsCalendar(namespace) {
  if (namespace.SportsCalendar) return;

  const Core = window.FootballCore || {};
  const registry = window.SportsHubRegistry;
  const pad = value => String(value).padStart(2, '0');

  const dayKey = value => {
    const model = Core.MatchModel ? new Core.MatchModel({ date: value }) : null;
    if (model?.dateKey) return model.dateKey;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  };

  const teamId = team => String(team?.id ?? team ?? '');
  const isFavoriteMatch = (match, favorites) => favorites.has(teamId(match.home)) || favorites.has(teamId(match.away));
  const favoriteMatches = (matches, favorites) => matches.filter(match => isFavoriteMatch(match, favorites));

  const collectFavoriteTeamIds = (matches, favorites) => {
    const ids = [];
    favoriteMatches(matches, favorites).forEach(match => {
      [match.home, match.away].forEach(team => {
        const id = teamId(team);
        if (favorites.has(id) && !ids.includes(id)) ids.push(id);
      });
    });
    return ids;
  };

  class SportsCalendar {
    constructor(options = {}) {
      Object.assign(this, options);
      this.today = options.today || null;
      this.page = options.page || document.body.dataset.hub || 'sports';

      const pageConfig = registry?.get?.(this.page);
      this.filterStorageKey = options.filterStorageKey
        || pageConfig?.calendar?.filterStorageKey
        || `footballCalendarFavoriteOnly:${this.page}`;
      const defaultFavoriteOnly = options.defaultFavoriteOnly
        ?? pageConfig?.calendar?.defaultFavoriteOnly
        ?? true;
      const storedFavoriteOnly = localStorage.getItem(this.filterStorageKey);
      this.favoriteOnly = storedFavoriteOnly === null
        ? Boolean(defaultFavoriteOnly)
        : storedFavoriteOnly !== 'false';

      this.cursor = new Date();
      this.selected = '';
      this.bound = false;
      this.controlsMounted = false;
    }

    getFavoritesSet() {
      return new Set((this.getFavorites?.() || []).map(String));
    }

    getVisibleMatches(matches = this.getMatches?.() || []) {
      if (!this.favoriteOnly) return matches;
      return favoriteMatches(matches, this.getFavoritesSet());
    }

    matchesOnDate(date) {
      return this.getVisibleMatches().filter(match => dayKey(this.getDate(match)) === date);
    }

    mountControls() {
      if (this.controlsMounted || !this.root) return;
      this.controlsMounted = true;

      const panel = this.root.closest('.calendar-panel') || this.root.parentElement;
      const head = panel?.querySelector('.calendar-head');
      if (!head) return;

      const existingToday = this.today || head.querySelector('#calendarToday');
      existingToday?.remove();

      const controls = document.createElement('div');
      controls.className = 'football-calendar__controls';
      controls.innerHTML = `
        <button class="football-calendar__today" type="button" data-calendar-today>今日へ戻る</button>
        <button class="football-calendar__favorite-toggle${this.favoriteOnly ? ' is-active' : ''}" type="button" data-calendar-favorite-only aria-pressed="${this.favoriteOnly}">
          <span>★</span><b>推しのみ</b><i aria-hidden="true"></i>
        </button>`;
      head.insertAdjacentElement('afterend', controls);

      this.today = controls.querySelector('[data-calendar-today]');
      this.favoriteToggle = controls.querySelector('[data-calendar-favorite-only]');
    }

    bind() {
      if (this.bound) return;
      this.mountControls();
      this.bound = true;

      this.prev?.addEventListener('click', () => this.shift(-1));
      this.next?.addEventListener('click', () => this.shift(1));
      this.today?.addEventListener('click', () => this.goToday());
      this.favoriteToggle?.addEventListener('click', () => this.toggleFavoriteOnly());
      this.root?.addEventListener('click', event => {
        const button = event.target.closest('[data-calendar-day]');
        if (!button || !this.root.contains(button)) return;
        event.stopPropagation();
        this.select(this.selected === button.dataset.calendarDay ? '' : button.dataset.calendarDay);
      });
    }

    updateToggle() {
      if (!this.favoriteToggle) return;
      this.favoriteToggle.classList.toggle('is-active', this.favoriteOnly);
      this.favoriteToggle.setAttribute('aria-pressed', String(this.favoriteOnly));
    }

    toggleFavoriteOnly() {
      this.favoriteOnly = !this.favoriteOnly;
      localStorage.setItem(this.filterStorageKey, String(this.favoriteOnly));
      this.updateToggle();
      this.emit('filter');
      this.render();
    }

    emit(reason = 'select') {
      const detail = {
        date: this.selected,
        favoriteOnly: this.favoriteOnly,
        reason,
        calendar: this
      };

      this.onSelect?.(this.selected, detail);
      document.dispatchEvent(new CustomEvent('sports:calendar-select', { detail }));
      document.dispatchEvent(new CustomEvent('football:calendar-select', { detail }));
    }

    select(date = '') {
      this.selected = date;
      this.emit('select');
      this.render();
    }

    clearSelection() {
      this.select('');
    }

    goToday() {
      this.cursor = new Date();
      this.select(dayKey(new Date()));
    }

    shift(delta) {
      this.cursor = new Date(this.cursor.getFullYear(), this.cursor.getMonth() + delta, 1);
      this.select('');
    }

    setCursor(value) {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) {
        this.cursor = new Date(date.getFullYear(), date.getMonth(), 1);
      }
      this.render();
    }

    buildTeamMarks(ids) {
      return ids.slice(0, 2).map(id => {
        const visual = this.getTeamVisual?.(id) || {};
        return visual.logo ? `<img src="${visual.logo}" alt="">` : `<span>${visual.label || '★'}</span>`;
      }).join('');
    }

    buildDayCell({ day, key, matches, favorites, primary, todayKey }) {
      const visibleMatches = this.favoriteOnly ? favoriteMatches(matches, favorites) : matches;
      const favoriteIds = collectFavoriteTeamIds(matches, favorites);
      const marks = this.buildTeamMarks(favoriteIds);
      const classes = [
        'football-calendar__day',
        visibleMatches.length && 'has-match',
        favoriteIds.length && 'has-favorite',
        primary && favoriteIds.includes(primary) && 'has-primary',
        this.selected === key && 'is-selected',
        todayKey === key && 'is-today'
      ].filter(Boolean).join(' ');

      return `<button class="${classes}" data-calendar-day="${key}" data-date="${key}" type="button">
        <span class="football-calendar__date">${day}</span>
        <small class="football-calendar__marks">${marks}</small>
        ${visibleMatches.length ? `<b class="football-calendar__count" aria-label="${visibleMatches.length}試合">${visibleMatches.length}</b>` : ''}
      </button>`;
    }

    render() {
      if (!this.root) return;
      this.bind();

      const year = this.cursor.getFullYear();
      const month = this.cursor.getMonth();
      const favorites = this.getFavoritesSet();
      const primary = String(this.getPrimary?.() || '');
      const matchesByDate = new Map();
      if (this.title) this.title.textContent = `${year}年${month + 1}月`;

      (this.getMatches?.() || []).forEach(match => {
        const key = dayKey(this.getDate(match));
        if (!key) return;
        if (!matchesByDate.has(key)) matchesByDate.set(key, []);
        matchesByDate.get(key).push(match);
      });

      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const todayKey = dayKey(new Date());
      const cells = Array.from(
        { length: firstDay.getDay() },
        () => '<button class="football-calendar__day is-blank" type="button" disabled></button>'
      );

      for (let day = 1; day <= lastDay.getDate(); day += 1) {
        const key = `${year}-${pad(month + 1)}-${pad(day)}`;
        cells.push(this.buildDayCell({
          day,
          key,
          matches: matchesByDate.get(key) || [],
          favorites,
          primary,
          todayKey
        }));
      }

      this.root.innerHTML = cells.join('');
    }
  }

  Object.assign(namespace, {
    SportsCalendar,
    FootballCalendar: SportsCalendar,
    dayKey,
    teamId,
    isFavoriteMatch,
    favoriteMatches,
    collectFavoriteTeamIds
  });
})(sharedCalendarUI);