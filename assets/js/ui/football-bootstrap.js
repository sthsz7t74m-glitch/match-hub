window.FootballUI = window.FootballUI || {};

(function initializeFootballBootstrap(namespace) {
  if (namespace.FootballPageAdapter) return;

  const Core = window.FootballCore || {};
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

  const commonElements = () => ({
    title: document.querySelector('#calendarTitle'),
    prev: document.querySelector('#calendarPrev'),
    next: document.querySelector('#calendarNext')
  });

  const PAGE_REGISTRY = {
    five: {
      root: '#calendarGrid',
      today: '#calendarToday',
      favorites: () => favoriteList('matchHubFavorites'),
      primary: () => localStorage.getItem('matchHubPrimary') || '',
      date: match => match.date,
      visual(data, id) {
        const team = (data.teams || []).find(item => String(item.id) === String(id));
        return { logo: team?.logo, label: '★' };
      }
    },
    jleague: {
      root: '#matchCalendar',
      favorites: () => favoriteList('sportsHubFavoriteJClubs').map(id => jClubTeamIds[id] || id),
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
      favorites: () => favoriteList('sportsHubFavoriteNationals'),
      primary: () => '',
      date: match => match.kickoff,
      visual(data, id) {
        const team = window.SportsHubNational?.resolveTeam?.(id) || window.SportsHubNational?.find?.(id);
        return { label: team?.flag || '●' };
      }
    }
  };

  class FootballPageAdapter {
    constructor(page = document.body.dataset.hub) {
      this.page = page || this.detect();
      this.pageConfig = PAGE_REGISTRY[this.page];
    }

    detect() {
      if (document.querySelector('#calendarGrid')) return 'five';
      if (document.querySelector('#jUpdated')) return 'jleague';
      return 'national';
    }

    getCalendarConfig(data) {
      if (!this.pageConfig) throw new Error(`Unknown football page: ${this.page}`);

      return {
        ...commonElements(),
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
      if (!this.pageConfig) throw new Error(`Unknown football page: ${this.page}`);
      const adapter = window.FootballAdapters.create(this.page);
      const data = await adapter.load();
      return this.register(new namespace.FootballCalendar(this.getCalendarConfig(data)));
    }
  }

  Object.assign(namespace, {
    FootballPageAdapter,
    PAGE_REGISTRY,
    favoriteList,
    jClubTeamIds
  });

  namespace.bootstrap = function bootstrapFootballUI() {
    new namespace.FootballShell(document.body.dataset.hub).render();
    document.addEventListener('DOMContentLoaded', () => {
      new FootballPageAdapter()
        .start()
        .catch(error => console.warn('Shared football UI unavailable', error));
    });
  };
})(window.FootballUI);
