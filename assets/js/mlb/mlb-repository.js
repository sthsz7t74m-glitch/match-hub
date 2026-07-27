window.MLBRepository = window.MLBRepository || {};

(function initializeMlbRepository(namespace) {
  const asArray = value => (Array.isArray(value) ? value : []);
  const errorMessage = error => error?.message || String(error || 'Unknown MLB data error');

  class MLBHubRepository {
    constructor({ service = window.MLBService, data = window.MLBData } = {}) {
      if (!service) throw new Error('MLBService is unavailable');
      if (!data) throw new Error('MLBData is unavailable');

      this.service = service;
      this.data = data;
    }

    currentSeason() {
      return Number(this.service.currentSeason?.() || new Date().getFullYear());
    }

    fallbackTeams() {
      return asArray(this.data.FALLBACK_TEAMS).map(team => ({ ...team }));
    }

    normalizeHub(payload = {}, season = this.currentSeason()) {
      const teams = asArray(payload.teams);
      const errors = asArray(payload.errors).map(errorMessage);

      return {
        season: Number(payload.season || season),
        updatedAt: payload.updatedAt || new Date().toISOString(),
        teams: teams.length ? teams : this.fallbackTeams(),
        games: asArray(payload.games),
        standings: asArray(payload.standings),
        errors,
        degraded: errors.length > 0
      };
    }

    fallbackHub(season, error) {
      return {
        season: Number(season || this.currentSeason()),
        updatedAt: new Date().toISOString(),
        teams: this.fallbackTeams(),
        games: [],
        standings: [],
        errors: [errorMessage(error)],
        degraded: true
      };
    }

    async loadHub({ season = this.currentSeason(), fresh = false } = {}) {
      if (fresh) this.clear();

      try {
        const payload = await this.service.loadHub({ season, fresh });
        return this.normalizeHub(payload, season);
      } catch (error) {
        console.warn('MLB repository fell back to static teams:', error);
        return this.fallbackHub(season, error);
      }
    }

    async loadPlayers({ season = this.currentSeason(), fresh = false } = {}) {
      const players = await this.service.loadJapanesePlayers({ season, fresh });
      return asArray(players);
    }

    clear() {
      this.service.clearCache?.();
    }
  }

  Object.assign(namespace, {
    MLBHubRepository,
    asArray,
    errorMessage
  });
})(window.MLBRepository);