window.FootballAdapters = window.FootballAdapters || {};

(function initializeFootballAdapters(namespace) {
  if (namespace.FootballDataAdapter) return;

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
        sourceDetails: payload.sourceDetails || {},
        season: payload.season || null,
        availability: payload.availability || {},
        leaguesAvailability: payload.leaguesAvailability || {},
        counts: payload.counts || {},
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

  const factories = {
    five: () => new FiveLeagueAdapter(),
    jleague: () => new JLeagueAdapter(),
    national: () => new NationalAdapter()
  };

  Object.assign(namespace, {
    FootballDataAdapter,
    FiveLeagueAdapter,
    JLeagueAdapter,
    NationalAdapter,
    create(type) {
      const factory = factories[type];
      if (!factory) throw new Error(`Unknown football adapter: ${type}`);
      return factory();
    }
  });
})(window.FootballAdapters);
