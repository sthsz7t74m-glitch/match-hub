window.SportsHubRegistry = window.SportsHubRegistry || {};

(function initializeSportsRegistry(namespace) {
  if (namespace.registry) return;

  const cloneNavigation = navigation => ({
    attribute: navigation?.attribute || 'page',
    items: (Array.isArray(navigation?.items) ? navigation.items : []).map(item => ({ ...item }))
  });

  const normalizeConfig = (id, config = {}) => Object.freeze({
    id: String(id),
    sport: String(config.sport || 'generic'),
    eyebrow: String(config.eyebrow || ''),
    title: String(config.title || id),
    version: String(config.version || ''),
    back: String(config.back || './sports-home.html'),
    backLabel: String(config.backLabel || 'Sports Hubへ戻る'),
    favoriteStorageKey: String(config.favoriteStorageKey || ''),
    calendar: Object.freeze({
      filterStorageKey: String(config.calendar?.filterStorageKey || `footballCalendarFavoriteOnly:${id}`),
      defaultFavoriteOnly: config.calendar?.defaultFavoriteOnly !== false
    }),
    navigation: Object.freeze(cloneNavigation(config.navigation))
  });

  class SportsRegistry {
    constructor() { this.records = new Map(); }

    register(id, config, { replace = true } = {}) {
      const key = String(id || '').trim();
      if (!key) throw new Error('Sports registry id is required');
      if (!replace && this.records.has(key)) return this.records.get(key);
      const normalized = normalizeConfig(key, config);
      this.records.set(key, normalized);
      return normalized;
    }

    get(id) { return this.records.get(String(id || '')) || null; }
    has(id) { return this.records.has(String(id || '')); }
    list() { return [...this.records.values()]; }
    toObject() { return Object.fromEntries(this.list().map(config => [config.id, config])); }
  }

  const navItem = (target, icon, label, badgeId = '') => Object.freeze({
    target: String(target), icon: String(icon), label: String(label), badgeId: String(badgeId || '')
  });

  const sharedBack = { back: './sports-home.html', backLabel: 'Sports Hubへ戻る' };
  const registry = new SportsRegistry();

  registry.register('five', {
    ...sharedBack,
    sport: 'soccer', eyebrow: 'FOOTBALL SCHEDULE', title: 'Match Hub', version: 'v1.1.10',
    favoriteStorageKey: 'matchHubFavorites',
    calendar: { filterStorageKey: 'footballCalendarFavoriteOnly:five', defaultFavoriteOnly: true },
    navigation: {
      attribute: 'view',
      items: [
        navItem('home', 'home', 'ホーム'), navItem('schedule', 'calendar', '日程'),
        navItem('standings', 'ranking', '順位表'), navItem('search', 'search', '検索'),
        navItem('transfers', 'transfer', '移籍'), navItem('settings', 'settings', '設定')
      ]
    }
  });

  registry.register('jleague', {
    ...sharedBack,
    sport: 'soccer', eyebrow: 'JAPAN PROFESSIONAL FOOTBALL', title: 'Jリーグ', version: 'v3.3.0',
    favoriteStorageKey: 'sportsHubFavoriteJClubs',
    calendar: { filterStorageKey: 'footballCalendarFavoriteOnly:jleague', defaultFavoriteOnly: true },
    navigation: {
      attribute: 'page',
      items: [
        navItem('home', 'home', 'ホーム'), navItem('schedule', 'calendar', '日程'),
        navItem('standings', 'ranking', '順位'), navItem('clubs', 'teams', 'クラブ'),
        navItem('favorites', 'star', '推し', 'favoriteCountBadge')
      ]
    }
  });

  registry.register('national', {
    ...sharedBack,
    sport: 'soccer', eyebrow: 'NATIONAL TEAMS', title: '各国代表', version: 'v3.3.2',
    favoriteStorageKey: 'sportsHubFavoriteNationals',
    calendar: { filterStorageKey: 'footballCalendarFavoriteOnly:national', defaultFavoriteOnly: true },
    navigation: {
      attribute: 'page',
      items: [
        navItem('home', 'home', 'ホーム'), navItem('schedule', 'calendar', '日程'),
        navItem('teams', 'teams', '代表'), navItem('competitions', 'trophy', '大会'),
        navItem('favorites', 'star', '推し', 'favoriteCountBadge')
      ]
    }
  });

  registry.register('mlb', {
    ...sharedBack,
    sport: 'baseball', eyebrow: 'MAJOR LEAGUE BASEBALL', title: 'MLB', version: 'v1.0.11',
    favoriteStorageKey: 'sportsHubFavoriteMlbTeams',
    calendar: { filterStorageKey: 'footballCalendarFavoriteOnly:mlb', defaultFavoriteOnly: false },
    navigation: {
      attribute: 'page',
      items: [
        navItem('home', 'home', 'ホーム'), navItem('schedule', 'calendar', '日程'),
        navItem('standings', 'ranking', '順位'), navItem('teams', 'teams', '球団'),
        navItem('players', 'player', '日本人'), navItem('favorites', 'star', '推し', 'favoriteCountBadge')
      ]
    }
  });

  Object.assign(namespace, {
    SportsRegistry,
    registry,
    navItem,
    register: (...args) => registry.register(...args),
    get: id => registry.get(id),
    has: id => registry.has(id),
    list: () => registry.list(),
    toObject: () => registry.toObject()
  });
})(window.SportsHubRegistry);
