window.FootballUI = window.FootballUI || {};

(function initializeFootballBootstrap(namespace) {
  if (namespace.FootballPageAdapter) return;

  const Core = window.FootballCore || {};
  const jClubTeamIds = {'fc-tokyo':'3384','tokyo-verdy':'3393',machida:'22167','yokohama-fm':'7116',kashima:'7115',mito:'131701',urawa:'3385',chiba:'7111',kashiwa:'7476',kawasaki:'7112',shimizu:'7104',nagoya:'7108',kyoto:'21361',gamba:'7102',cerezo:'7109',kobe:'7477',okayama:'22522',hiroshima:'7114',fukuoka:'7107',nagasaki:'19001'};

  const favoriteList = key => {
    if (Core.FavoriteService) return new Core.FavoriteService({ key }).list();
    try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
  };

  class FootballPageAdapter {
    constructor() {
      this.page = document.body.dataset.hub || this.detect();
    }

    detect() {
      if (document.querySelector('#calendarGrid')) return 'five';
      if (document.querySelector('#jUpdated')) return 'jleague';
      return 'national';
    }

    getCalendarConfig(data) {
      const common = { title: document.querySelector('#calendarTitle'), prev: document.querySelector('#calendarPrev'), next: document.querySelector('#calendarNext'), getMatches: () => data.matches || [] };
      if (this.page === 'five') return { ...common, root: document.querySelector('#calendarGrid'), today: document.querySelector('#calendarToday'), getFavorites: () => favoriteList('matchHubFavorites'), getPrimary: () => localStorage.getItem('matchHubPrimary') || '', getDate: match => match.date, getTeamVisual: id => { const team = (data.teams || []).find(item => String(item.id) === String(id)); return { logo: team?.logo, label: '★' }; } };
      if (this.page === 'jleague') return { ...common, root: document.querySelector('#matchCalendar'), getFavorites: () => favoriteList('sportsHubFavoriteJClubs').map(id => jClubTeamIds[id] || id), getPrimary: () => '', getDate: match => match.date, getTeamVisual: id => { const team = (data.teams || []).find(item => String(item.id) === String(id)); const clubId = Object.keys(jClubTeamIds).find(key => jClubTeamIds[key] === String(id)) || String(id); return { logo: team?.logo, label: window.SportsHubJLeague?.find?.(clubId)?.mark || '●' }; } };
      return { ...common, root: document.querySelector('#matchCalendar'), getFavorites: () => favoriteList('sportsHubFavoriteNationals'), getPrimary: () => '', getDate: match => match.kickoff, getTeamVisual: id => ({ label: window.SportsHubNational?.find?.(id)?.flag || '●' }) };
    }

    register(calendar) {
      namespace.calendars = namespace.calendars || {};
      namespace.calendars[this.page] = calendar;
      calendar.render();
      return calendar;
    }

    async start() {
      if (this.page === 'five' && window.MatchHubUsesLegacyCalendar) return null;
      const adapter = window.FootballAdapters.create(this.page);
      const data = await adapter.load();
      return this.register(new namespace.FootballCalendar(this.getCalendarConfig(data)));
    }
  }

  Object.assign(namespace, { FootballPageAdapter, favoriteList, jClubTeamIds });

  namespace.bootstrap = function bootstrapFootballUI() {
    new namespace.FootballShell(document.body.dataset.hub).render();
    document.addEventListener('DOMContentLoaded', () => {
      new FootballPageAdapter().start().catch(error => console.warn('Shared football UI unavailable', error));
    });
  };
})(window.FootballUI);
