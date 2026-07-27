window.FootballAdapters = window.FootballAdapters || {};

(function initializeFootballAdapters(adapters) {
  if (adapters.FootballDataAdapter) return;

  const Core = window.FootballCore || {};
  const asArray = value => (Array.isArray(value) ? value : []);

  class FootballDataAdapter {
    constructor({ repository = null, loader = null, normalize = payload => payload || {} } = {}) {
      this.repository = repository;
      this.loader = loader;
      this.normalize = normalize;
      this.payload = null;
      this.pending = null;
    }

    async load({ fresh = false } = {}) {
      if (this.payload && !fresh) return this.payload;
      if (this.pending && !fresh) return this.pending;

      this.pending = Promise.resolve()
        .then(() => (this.loader ? this.loader({ fresh }) : this.repository?.get({ fresh })))
        .then(payload => this.normalize(payload || {}))
        .then(payload => {
          this.payload = payload;
          return payload;
        })
        .finally(() => {
          this.pending = null;
        });

      return this.pending;
    }

    clear() {
      this.payload = null;
      this.pending = null;
      this.repository?.clear?.();
    }

    async loadMatches(options) {
      const payload = await this.load(options);
      return asArray(payload.matches || payload.fixtures);
    }

    async loadStandings(options) {
      return asArray((await this.load(options)).standings);
    }

    async loadTeams(options) {
      return asArray((await this.load(options)).teams);
    }

    async loadMetadata(options) {
      const payload = await this.load(options);
      return {
        updatedAt: payload.updatedAt || '',
        dataSource: payload.dataSource || '',
        season: payload.season || null,
        availability: payload.availability || {},
        leaguesAvailability: payload.leaguesAvailability || {},
        errors: asArray(payload.errors)
      };
    }
  }

  class FiveLeagueAdapter extends FootballDataAdapter {
    constructor(options = {}) {
      super({
        repository: options.repository || new Core.JsonRepository(options.path || './data/football.json'),
        normalize: payload => ({
          ...payload,
          matches: asArray(payload.matches || payload.fixtures),
          teams: asArray(payload.teams),
          standings: asArray(payload.standings)
        })
      });
    }
  }

  class JLeagueAdapter extends FootballDataAdapter {
    constructor(options = {}) {
      super({
        repository: options.repository || new Core.JsonRepository(options.path || './data/jleague.json'),
        normalize: payload => ({
          ...payload,
          matches: asArray(payload.matches),
          teams: asArray(payload.teams),
          standings: asArray(payload.standings)
        })
      });
    }

    async loadLeague(league = 'j1', options) {
      const payload = await this.load(options);
      const belongsToLeague = item => (item.league || 'j1') === league;

      return {
        ...payload,
        matches: payload.matches.filter(belongsToLeague),
        teams: payload.teams.filter(belongsToLeague),
        standings: payload.standings.filter(belongsToLeague)
      };
    }
  }

  class NationalAdapter extends FootballDataAdapter {
    constructor(options = {}) {
      super({
        loader: options.loader || (() => window.SportsHubNationalService?.loadPayload?.()),
        normalize: payload => ({
          ...payload,
          matches: asArray(payload.matches),
          teams: asArray(payload.teams),
          standings: asArray(payload.standings)
        })
      });
    }
  }

  Object.assign(adapters, {
    FootballDataAdapter,
    FiveLeagueAdapter,
    JLeagueAdapter,
    NationalAdapter,
    create(type) {
      if (type === 'five') return new FiveLeagueAdapter();
      if (type === 'national') return new NationalAdapter();
      return new JLeagueAdapter();
    }
  });
})(window.FootballAdapters);

window.FootballUI = window.FootballUI || {};

(function initializeFootballUI(namespace) {
  const Core = window.FootballCore || {};
  const pad = value => String(value).padStart(2, '0');

  const jClubTeamIds = {
    'fc-tokyo': '3384',
    'tokyo-verdy': '3393',
    machida: '22167',
    'yokohama-fm': '7116',
    kashima: '7115',
    mito: '131701',
    urawa: '3385',
    chiba: '7111',
    kashiwa: '7476',
    kawasaki: '7112',
    shimizu: '7104',
    nagoya: '7108',
    kyoto: '21361',
    gamba: '7102',
    cerezo: '7109',
    kobe: '7477',
    okayama: '22522',
    hiroshima: '7114',
    fukuoka: '7107',
    nagasaki: '19001'
  };

  const shellConfigs = {
    jleague: {
      eyebrow: 'JAPAN PROFESSIONAL FOOTBALL',
      title: 'Jリーグ',
      version: 'v3.0.8',
      back: './sports-home.html',
      nav: [
        ['home', '⌂', 'ホーム'],
        ['schedule', '▤', '日程'],
        ['standings', '≡', '順位'],
        ['clubs', '⌕', 'クラブ'],
        ['favorites', '★', '推し', 'favoriteCountBadge']
      ]
    },
    national: {
      eyebrow: 'NATIONAL TEAMS',
      title: '各国代表',
      version: 'v3.1.6',
      back: './sports-home.html',
      nav: [
        ['home', '⌂', 'ホーム'],
        ['schedule', '▤', '日程'],
        ['teams', '⌕', '代表'],
        ['competitions', '🏆', '大会'],
        ['favorites', '★', '推し', 'favoriteCountBadge']
      ]
    }
  };

  const favoriteList = key => {
    if (Core.FavoriteService) return new Core.FavoriteService({ key }).list();

    try {
      return JSON.parse(localStorage.getItem(key) || '[]');
    } catch {
      return [];
    }
  };

  const dayKey = value => {
    const model = Core.MatchModel ? new Core.MatchModel({ date: value }) : null;
    if (model?.dateKey) return model.dateKey;

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  };

  class BottomNavigation {
    constructor(root) {
      this.root = root;
    }

    normalize() {
      if (!this.root) return;

      const items = [...this.root.querySelectorAll('.nav-item')];
      this.root.style.setProperty('--nav-count', items.length);

      items.forEach(item => {
        const label = item.querySelector('span');
        if (label) item.setAttribute('aria-label', label.textContent.trim());
      });
    }
  }

  class FootballShell {
    constructor(page = document.body.dataset.hub) {
      this.config = shellConfigs[page];
    }

    renderHeader() {
      const root = document.querySelector('.topbar');
      if (!root || !this.config) return;

      root.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px">
          <a class="back-link" href="${this.config.back}" aria-label="Sports Hubへ戻る">←</a>
          <div>
            <p class="eyebrow">${this.config.eyebrow}</p>
            <h1>${this.config.title} <span class="version">${this.config.version}</span></h1>
          </div>
        </div>
        <div class="topbar__actions">
          <button id="themeButton" class="icon-button" type="button" aria-label="テーマ切替">◐</button>
        </div>`;
    }

    renderNavigation() {
      const root = document.querySelector('#pageTabs');
      if (!root || !this.config) return;

      root.innerHTML = this.config.nav
        .map(([page, icon, label, badge], index) => `
          <button class="nav-item hub-nav__item${index === 0 ? ' active' : ''}" data-page="${page}" type="button">
            ${icon}<span>${label}${badge ? ` <b id="${badge}">0</b>` : ''}</span>
          </button>`)
        .join('');

      root.setAttribute('aria-label', `${this.config.title}メニュー`);
      new BottomNavigation(root).normalize();
    }

    render() {
      this.renderHeader();
      this.renderNavigation();
    }
  }

  class FootballCalendar {
    constructor({ root, title, prev, next, today = null, getMatches, getFavorites, getPrimary, getDate, getTeamVisual, onSelect }) {
      Object.assign(this, {
        root,
        title,
        prev,
        next,
        today,
        getMatches,
        getFavorites,
        getPrimary,
        getDate,
        getTeamVisual,
        onSelect
      });

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
        if (!button) return;
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

    render() {
      if (!this.root) return;
      this.bind();

      const year = this.cursor.getFullYear();
      const month = this.cursor.getMonth();
      const favorites = new Set((this.getFavorites?.() || []).map(String));
      const primary = String(this.getPrimary?.() || '');
      const matches = this.getMatches?.() || [];
      const matchesByDate = new Map();

      if (this.title) this.title.textContent = `${year}年${month + 1}月`;

      matches.forEach(match => {
        const key = dayKey(this.getDate(match));
        if (!key) return;
        if (!matchesByDate.has(key)) matchesByDate.set(key, []);
        matchesByDate.get(key).push(match);
      });

      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const todayKey = dayKey(new Date());
      const cells = [];

      for (let index = 0; index < firstDay.getDay(); index += 1) {
        cells.push('<button class="football-calendar__day is-blank" type="button" disabled></button>');
      }

      for (let day = 1; day <= lastDay.getDate(); day += 1) {
        const key = `${year}-${pad(month + 1)}-${pad(day)}`;
        const items = matchesByDate.get(key) || [];
        const favoriteIds = [];

        items.forEach(item => {
          [item.home, item.away].forEach(team => {
            const id = String(team?.id ?? team ?? '');
            if (favorites.has(id) && !favoriteIds.includes(id)) favoriteIds.push(id);
          });
        });

        const marks = favoriteIds
          .slice(0, 2)
          .map(id => {
            const visual = this.getTeamVisual?.(id) || {};
            return visual.logo
              ? `<img src="${visual.logo}" alt="">`
              : `<span>${visual.label || '★'}</span>`;
          })
          .join('');

        const classes = [
          'football-calendar__day',
          items.length ? 'has-match' : '',
          favoriteIds.length ? 'has-favorite' : '',
          primary && favoriteIds.includes(primary) ? 'has-primary' : '',
          this.selected === key ? 'is-selected' : '',
          todayKey === key ? 'is-today' : ''
        ].filter(Boolean).join(' ');

        cells.push(`
          <button class="${classes}" data-calendar-day="${key}" data-date="${key}" type="button">
            <span>${day}</span>
            ${items.length ? `<b>${items.length}</b>` : ''}
            ${marks ? `<small>${marks}</small>` : ''}
          </button>`);
      }

      this.root.innerHTML = cells.join('');
    }
  }

  class FootballPageAdapter {
    constructor() {
      this.page = document.body.dataset.hub || this.detect();
      this.adapters = {
        five: new window.FootballAdapters.FiveLeagueAdapter(),
        jleague: new window.FootballAdapters.JLeagueAdapter(),
        national: new window.FootballAdapters.NationalAdapter()
      };
    }

    detect() {
      if (document.querySelector('#calendarGrid')) return 'five';
      if (document.querySelector('#jUpdated')) return 'jleague';
      return 'national';
    }

    getCalendarConfig(data) {
      const common = {
        title: document.querySelector('#calendarTitle'),
        prev: document.querySelector('#calendarPrev'),
        next: document.querySelector('#calendarNext'),
        getMatches: () => data.matches || []
      };

      if (this.page === 'five') {
        return {
          ...common,
          root: document.querySelector('#calendarGrid'),
          today: document.querySelector('#calendarToday'),
          getFavorites: () => favoriteList('matchHubFavorites'),
          getPrimary: () => localStorage.getItem('matchHubPrimary') || '',
          getDate: match => match.date,
          getTeamVisual: id => {
            const team = (data.teams || []).find(item => String(item.id) === String(id));
            return { logo: team?.logo, label: '★' };
          }
        };
      }

      if (this.page === 'jleague') {
        return {
          ...common,
          root: document.querySelector('#matchCalendar'),
          getFavorites: () => favoriteList('sportsHubFavoriteJClubs').map(id => jClubTeamIds[id] || id),
          getPrimary: () => '',
          getDate: match => match.date,
          getTeamVisual: id => {
            const team = (data.teams || []).find(item => String(item.id) === String(id));
            const clubId = Object.keys(jClubTeamIds).find(key => jClubTeamIds[key] === String(id)) || String(id);
            return {
              logo: team?.logo,
              label: window.SportsHubJLeague?.find?.(clubId)?.mark || '●'
            };
          }
        };
      }

      return {
        ...common,
        root: document.querySelector('#matchCalendar'),
        getFavorites: () => favoriteList('sportsHubFavoriteNationals'),
        getPrimary: () => '',
        getDate: match => match.kickoff,
        getTeamVisual: id => ({
          label: window.SportsHubNational?.find?.(id)?.flag || '●'
        })
      };
    }

    register(calendar) {
      namespace.calendars = namespace.calendars || {};
      namespace.calendars[this.page] = calendar;
      calendar.render();
      return calendar;
    }

    async start() {
      const adapter = this.adapters[this.page];
      if (!adapter) throw new Error(`Unknown football page: ${this.page}`);

      const data = await adapter.load();
      return this.register(new FootballCalendar(this.getCalendarConfig(data)));
    }
  }

  Object.assign(namespace, {
    FootballCalendar,
    BottomNavigation,
    FootballShell,
    FootballPageAdapter
  });

  new FootballShell(document.body.dataset.hub).render();

  document.addEventListener('DOMContentLoaded', () => {
    new FootballPageAdapter()
      .start()
      .catch(error => console.warn('Shared football UI unavailable', error));
  });
})(window.FootballUI);
