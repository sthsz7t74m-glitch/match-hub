window.MLBRepository = window.MLBRepository || {};

(function initializeMlbRepository(namespace) {
  const SNAPSHOT_KEY = 'mlb-hub:snapshot:v1';
  const SNAPSHOT_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
  const asArray = value => (Array.isArray(value) ? value : []);
  const errorMessage = error => error?.message || String(error || 'Unknown MLB data error');

  class MLBHubRepository {
    constructor({
      service = window.MLBService,
      data = window.MLBData,
      storage = window.localStorage
    } = {}) {
      if (!service) throw new Error('MLBService is unavailable');
      if (!data) throw new Error('MLBData is unavailable');

      this.service = service;
      this.data = data;
      this.storage = storage;
    }

    currentSeason() {
      return Number(this.service.currentSeason?.() || new Date().getFullYear());
    }

    fallbackTeams() {
      return asArray(this.data.FALLBACK_TEAMS).map(team => ({ ...team }));
    }

    normalizeHub(payload = {}, season = this.currentSeason(), source = 'network') {
      const teams = asArray(payload.teams);
      const errors = asArray(payload.errors).map(errorMessage);

      return {
        season: Number(payload.season || season),
        updatedAt: payload.updatedAt || new Date().toISOString(),
        teams: teams.length ? teams : this.fallbackTeams(),
        games: asArray(payload.games),
        standings: asArray(payload.standings),
        errors,
        degraded: Boolean(payload.degraded) || errors.length > 0,
        source
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
        degraded: true,
        source: 'fallback'
      };
    }

    readSnapshot({ season = this.currentSeason(), maxAge = SNAPSHOT_MAX_AGE } = {}) {
      try {
        const raw = this.storage?.getItem(SNAPSHOT_KEY);
        if (!raw) return null;

        const saved = JSON.parse(raw);
        if (!saved || typeof saved.savedAt !== 'number' || !saved.payload) return null;
        if (Number(saved.payload.season) !== Number(season)) return null;
        if (Number.isFinite(maxAge) && Date.now() - saved.savedAt > maxAge) return null;

        return {
          ...this.normalizeHub(saved.payload, season, 'snapshot'),
          snapshotAt: new Date(saved.savedAt).toISOString(),
          degraded: true
        };
      } catch {
        return null;
      }
    }

    writeSnapshot(payload) {
      try {
        this.storage?.setItem(SNAPSHOT_KEY, JSON.stringify({
          savedAt: Date.now(),
          payload: {
            season: payload.season,
            updatedAt: payload.updatedAt,
            teams: payload.teams,
            games: payload.games,
            standings: payload.standings,
            errors: []
          }
        }));
        return true;
      } catch (error) {
        console.warn('MLB snapshot could not be stored:', error);
        return false;
      }
    }

    clearSnapshot() {
      try {
        this.storage?.removeItem(SNAPSHOT_KEY);
      } catch {
        // Ignore unavailable storage.
      }
    }

    async loadHub({ season = this.currentSeason(), fresh = false } = {}) {
      if (fresh) this.clear();
      const snapshot = this.readSnapshot({ season, maxAge: Number.POSITIVE_INFINITY });

      try {
        const payload = this.normalizeHub(
          await this.service.loadHub({ season, fresh }),
          season,
          'network'
        );
        const hasDynamicData = payload.games.length > 0 || payload.standings.length > 0;

        if (hasDynamicData || !payload.degraded) {
          this.writeSnapshot(payload);
          return payload;
        }

        if (snapshot) {
          return {
            ...snapshot,
            errors: [...snapshot.errors, ...payload.errors],
            degraded: true,
            source: 'snapshot'
          };
        }

        return payload;
      } catch (error) {
        console.warn('MLB repository network load failed:', error);
        if (snapshot) {
          return {
            ...snapshot,
            errors: [...snapshot.errors, errorMessage(error)],
            degraded: true,
            source: 'snapshot'
          };
        }
        return this.fallbackHub(season, error);
      }
    }

    async loadSeasonGames({ season = this.currentSeason(), fresh = false } = {}) {
      const games = await this.service.loadSeasonSchedule({ season, fresh });
      return asArray(games);
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
    SNAPSHOT_KEY,
    SNAPSHOT_MAX_AGE,
    asArray,
    errorMessage
  });
})(window.MLBRepository);