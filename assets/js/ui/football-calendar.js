window.FootballUI = window.FootballUI || {};

(function initializeFootballCalendar(namespace) {
  if (namespace.FootballCalendar) return;

  const Core = window.FootballCore || {};
  const pad = value => String(value).padStart(2, '0');

  const dayKey = value => {
    const model = Core.MatchModel ? new Core.MatchModel({ date: value }) : null;
    if (model?.dateKey) return model.dateKey;

    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? ''
      : `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  };

  const collectFavoriteTeamIds = (matches, favorites) => {
    const ids = [];

    matches.forEach(match => {
      [match.home, match.away].forEach(team => {
        const id = String(team?.id ?? team ?? '');
        if (favorites.has(id) && !ids.includes(id)) ids.push(id);
      });
    });

    return ids;
  };

  class FootballCalendar {
    constructor(options) {
      Object.assign(this, options);
      this.today = options.today || null;
      this.cursor = new Date();
      this.selected = '';
      this.bound = false;
    }

    bind() {
      if (this.bound) return;
      this.bound = true;

      this.prev?.addEventListener('click', () => this.shift(-1));
      this.next?.addEventListener('click', () => this.shift(1));
      this.today?.addEventListener('click', () => this.goToday());
      this.root?.addEventListener('click', event => {
        const button = event.target.closest('[data-calendar-day]');
        if (!button || !this.root.contains(button)) return;

        event.stopPropagation();
        this.select(this.selected === button.dataset.calendarDay ? '' : button.dataset.calendarDay);
      });
    }

    emit() {
      this.onSelect?.(this.selected);
      document.dispatchEvent(new CustomEvent('football:calendar-select', {
        detail: { date: this.selected, calendar: this }
      }));
    }

    select(date = '') {
      this.selected = date;
      this.emit();
      this.render();
    }

    clearSelection() {
      this.select('');
    }

    goToday() {
      this.cursor = new Date();
      this.select('');
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
        return visual.logo
          ? `<img src="${visual.logo}" alt="">`
          : `<span>${visual.label || '★'}</span>`;
      }).join('');
    }

    buildDayCell({ day, key, matches, favorites, primary, todayKey }) {
      const favoriteIds = collectFavoriteTeamIds(matches, favorites);
      const marks = this.buildTeamMarks(favoriteIds);
      const classes = [
        'football-calendar__day',
        matches.length && 'has-match',
        favoriteIds.length && 'has-favorite',
        primary && favoriteIds.includes(primary) && 'has-primary',
        this.selected === key && 'is-selected',
        todayKey === key && 'is-today'
      ].filter(Boolean).join(' ');

      return `
        <button class="${classes}" data-calendar-day="${key}" data-date="${key}" type="button">
          <span class="football-calendar__date">${day}</span>
          <small class="football-calendar__marks">${marks}</small>
          ${matches.length ? `<b class="football-calendar__count" aria-label="${matches.length}試合">${matches.length}</b>` : ''}
        </button>`;
    }

    render() {
      if (!this.root) return;
      this.bind();

      const year = this.cursor.getFullYear();
      const month = this.cursor.getMonth();
      const favorites = new Set((this.getFavorites?.() || []).map(String));
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
    FootballCalendar,
    dayKey,
    collectFavoriteTeamIds
  });
})(window.FootballUI);
