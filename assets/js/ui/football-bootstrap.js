const sharedBootstrapUI = window.SportsUI || window.FootballUI || {};
window.SportsUI = sharedBootstrapUI;
window.FootballUI = sharedBootstrapUI;

(function initializeSportsBootstrap(namespace) {
  if (namespace.SportsPageAdapter) return;

  const Core = window.FootballCore || {};
  const registry = window.SportsHubRegistry;
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

  const favoriteList = key => {
    if (Core.FavoriteService) return new Core.FavoriteService({ key }).list();
    try {
      return JSON.parse(localStorage.getItem(key) || '[]');
    } catch {
      return [];
    }
  };

  const favoriteKey = page => registry?.get?.(page)?.favoriteStorageKey || '';
  const commonElements = () => ({
    title: document.querySelector('#calendarTitle'),
    prev: document.querySelector('#calendarPrev'),
    next: document.querySelector('#calendarNext')
  });

  const CALENDAR_PAGE_CONFIGS = {
    five: {
      root: '#calendarGrid',
      today: '#calendarToday',
      favorites: () => favoriteList(favoriteKey('five') || 'matchHubFavorites'),
      primary: () => localStorage.getItem('matchHubPrimary') || '',
      date: match => match.date,
      visual(data, id) {
        const team = (data.teams || []).find(item => String(item.id) === String(id));
        return { logo: team?.logo, label: '★' };
      }
    },
    jleague: {
      root: '#matchCalendar',
      favorites: () => favoriteList(favoriteKey('jleague') || 'sportsHubFavoriteJClubs')
        .map(id => jClubTeamIds[id] || id),
      primary: () => '',
      date: match => match.date,
      visual(data, id) {
        const team = (data.teams || []).find(item => String(item.id) === String(id));
        const clubId = Object.keys(jClubTeamIds).find(key => jClubTeamIds[key] === String(id)) || String(id);
        return {
          logo: team?.logo,
          label: window.SportsHubJLeague?.find?.(clubId)?.mark || '●'
        };
      }
    },
    national: {
      root: '#matchCalendar',
      favorites: () => favoriteList(favoriteKey('national') || 'sportsHubFavoriteNationals'),
      primary: () => '',
      date: match => match.kickoff,
      visual(data, id) {
        const team = window.SportsHubNational?.resolveTeam?.(id) || window.SportsHubNational?.find?.(id);
        return { label: team?.flag || '●' };
      }
    }
  };

  class SportsPageAdapter {
    constructor(page = document.body.dataset.hub) {
      this.page = page || this.detect();
      this.pageConfig = CALENDAR_PAGE_CONFIGS[this.page];
      this.registryConfig = registry?.get?.(this.page) || null;
    }

    detect() {
      if (document.querySelector('#calendarGrid')) return 'five';
      if (document.querySelector('#jUpdated')) return 'jleague';
      return 'national';
    }

    getCalendarConfig(data) {
      if (!this.pageConfig) throw new Error(`Unknown sports page: ${this.page}`);

      return {
        ...commonElements(),
        page: this.page,
        filterStorageKey: this.registryConfig?.calendar?.filterStorageKey,
        defaultFavoriteOnly: this.registryConfig?.calendar?.defaultFavoriteOnly,
        root: document.querySelector(this.pageConfig.root),
        today: this.pageConfig.today ? document.querySelector(this.pageConfig.today) : null,
        getMatches: () => data.matches || [],
        getFavorites: this.pageConfig.favorites,
        getPrimary: this.pageConfig.primary,
        getDate: this.pageConfig.date,
        getTeamVisual: id => this.pageConfig.visual(data, id)
      };
    }

    register(calendar) {
      namespace.calendars = namespace.calendars || {};
      namespace.calendars[this.page] = calendar;
      calendar.render();
      return calendar;
    }

    async start() {
      if (!this.pageConfig) throw new Error(`Unknown sports page: ${this.page}`);
      const adapter = window.FootballAdapters.create(this.page);
      const data = await adapter.load();
      const CalendarClass = namespace.SportsCalendar || namespace.FootballCalendar;
      return this.register(new CalendarClass(this.getCalendarConfig(data)));
    }
  }

  const startAdapters = () => {
    new SportsPageAdapter()
      .start()
      .catch(error => console.warn('Shared sports UI unavailable', error));
  };

  Object.assign(namespace, {
    SportsPageAdapter,
    FootballPageAdapter: SportsPageAdapter,
    CALENDAR_PAGE_CONFIGS,
    PAGE_REGISTRY: CALENDAR_PAGE_CONFIGS,
    favoriteList,
    jClubTeamIds
  });

  namespace.bootstrap = function bootstrapSportsUI() {
    const ShellClass = namespace.SportsShell || namespace.FootballShell;
    new ShellClass(document.body.dataset.hub).render();

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', startAdapters, { once: true });
    } else {
      startAdapters();
    }
  };
})(sharedBootstrapUI);