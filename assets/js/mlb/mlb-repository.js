window.MLBRepository = window.MLBRepository || {};

(function initializeMlbRepository(namespace) {
  const SNAPSHOT_KEY = 'mlb-hub:snapshot:v2';
  const SNAPSHOT_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
  const SOURCE_TIMEOUT = 6000;
  const PUBLISHED_URLS = Object.freeze([
    'https://raw.githubusercontent.com/sthsz7t74m-glitch/match-hub/mlb-data/mlb-hub.json',
    'https://cdn.jsdelivr.net/gh/sthsz7t74m-glitch/match-hub@mlb-data/mlb-hub.json'
  ]);

  const asArray = value => (Array.isArray(value) ? value : []);
  const errorMessage = error => error?.message || String(error || 'Unknown MLB data error');
  const gameTime = game => {
    const value = new Date(game?.date || '').getTime();
    return Number.isNaN(value) ? 0 : value;
  };

  const withTimeout = (promise, timeout, message) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), timeout);
    Promise.resolve(promise).then(
      value => {
        clearTimeout(timer);
        resolve(value);
      },
      error => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });

  const mergeGame = (base = {}, detail = {}) => ({
    ...base,
    ...detail,
    home: { ...(base.home || {}), ...(detail.home || {}) },
    away: { ...(base.away || {}), ...(detail.away || {}) },
    probablePitchers: {
      ...(base.probablePitchers || {}),
      ...(detail.probablePitchers || {})
    }
  });

  class MLBHubRepository {
    constructor({
      service = window.MLBService,
      data = window.MLBData,
      storage = window.localStorage,
      publishedUrls = PUBLISHED_URLS
    } = {}) {
      if (!service) throw new Error('MLBService is unavailable');
      if (!data) throw new Error('MLBData is unavailable');

      this.service = service;
      this.data = data;
      this.storage = storage;
      this.publishedUrls = [...publishedUrls];
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
        fullScheduleAt: payload.fullScheduleAt || null,
        teams: teams.length ? teams : this.fallbackTeams(),
        games: asArray(payload.games),
        standings: asArray(payload.standings),
        errors,
        degraded: Boolean(payload.degraded) || errors.length > 0,
        source
      };
    }

    normalizeSchedule(payload) {
      return asArray(payload?.dates)
        .flatMap(entry => asArray(entry?.games))
        .map(game => this.service.normalizeGame(game))
        .filter(game => game.date && game.home?.id && game.away?.id);
    }

    normalizePublished(payload = {}, season = this.currentSeason(), source = 'published') {
      if (asArray(payload.teams).length || asArray(payload.games).length || asArray(payload.standings).length) {
        return this.normalizeHub(payload, season, source);
      }

      const raw = payload.raw || {};
      const teams = asArray(raw.teams?.teams)
        .map(team => this.service.normalizeTeam(team))
        .filter(team => team.id);
      const seasonGames = this.normalizeSchedule(raw.seasonSchedule);
      const liveGames = this.normalizeSchedule(raw.liveSchedule);
      const gamesById = new Map(seasonGames.map(game => [String(game.id), game]));
      liveGames.forEach(game => {
        const id = String(game.id);
        gamesById.set(id, mergeGame(gamesById.get(id), game));
      });

      return this.normalizeHub({
        season: payload.season || season,
        updatedAt: payload.updatedAt,
        fullScheduleAt: payload.fullScheduleAt,
        teams,
        games: [...gamesById.values()].sort((left, right) => gameTime(left) - gameTime(right)),
        standings: this.service.normalizeStandings(raw.standings || {}),
        errors: payload.errors
      }, season, source);
    }

    hasDynamicData(payload) {
      return asArray(payload?.games).length > 0 || asArray(payload?.standings).length > 0;
    }

    fallbackHub(season, error) {
      return {
        season: Number(season || this.currentSeason()),
        updatedAt: new Date().toISOString(),
        fullScheduleAt: null,
        teams: this.fallbackTeams(),
        games: [],
        standings: [],
        errors: [errorMessage(error)],
        degraded: true,
        source: 'fallback'
      };
    }

    snapshotPayload(payload) {
      const now = Date.now();
      const pastLimit = now - 45 * 24 * 60 * 60 * 1000;
      const futureLimit = now + 120 * 24 * 60 * 60 * 1000;
      let games = asArray(payload.games).filter(game => {
        const timestamp = gameTime(game);
        return timestamp >= pastLimit && timestamp <= futureLimit;
      });
      if (!games.length) games = asArray(payload.games).slice(0, 500);

      return {
        season: payload.season,
        updatedAt: payload.updatedAt,
        fullScheduleAt: payload.fullScheduleAt,
        teams: asArray(payload.teams),
        games,
        standings: asArray(payload.standings),
        errors: []
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
      const save = value => this.storage?.setItem(SNAPSHOT_KEY, JSON.stringify({
        savedAt: Date.now(),
        payload: value
      }));

      try {
        save(this.snapshotPayload(payload));
        return true;
      } catch (error) {
        try {
          const compact = this.snapshotPayload(payload);
          compact.games = compact.games.slice(0, 180);
          save(compact);
          return true;
        } catch (compactError) {
          console.warn('MLB snapshot could not be stored:', compactError || error);
          return false;
        }
      }
    }

    clearSnapshot() {
      try {
        this.storage?.removeItem(SNAPSHOT_KEY);
      } catch {
        // Ignore unavailable storage.
      }
    }

    async fetchPublishedUrl(url, { fresh = false } = {}) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), SOURCE_TIMEOUT - 500);
      const requestUrl = new URL(url);
      if (fresh) requestUrl.searchParams.set('v', String(Date.now()));

      try {
        const response = await fetch(requestUrl, {
          cache: fresh ? 'no-store' : 'default',
          signal: controller.signal,
          headers: { Accept: 'application/json' }
        });
        if (!response.ok) throw new Error(`Published MLB data HTTP ${response.status}`);
        return await response.json();
      } catch (error) {
        if (error?.name === 'AbortError') throw new Error('Published MLB data timeout');
        throw error;
      } finally {
        clearTimeout(timer);
      }
    }

    async loadPublishedHub({ season = this.currentSeason(), fresh = false } = {}) {
      const attempts = this.publishedUrls.map(url => this.fetchPublishedUrl(url, { fresh }));
      const payload = await withTimeout(
        Promise.any(attempts),
        SOURCE_TIMEOUT,
        'Published MLB data source timeout'
      );
      return this.normalizePublished(payload, season, 'published');
    }

    async loadDirectHub({ season = this.currentSeason(), fresh = false } = {}) {
      const payload = await withTimeout(
        this.service.loadHub({ season, fresh }),
        SOURCE_TIMEOUT,
        'Direct MLB data source timeout'
      );
      return this.normalizeHub(payload, season, 'network');
    }

    async loadHub({ season = this.currentSeason(), fresh = false } = {}) {
      if (fresh) this.clear();
      const snapshot = this.readSnapshot({ season, maxAge: Number.POSITIVE_INFINITY });

      const [publishedResult, directResult] = await Promise.allSettled([
        this.loadPublishedHub({ season, fresh }),
        this.loadDirectHub({ season, fresh })
      ]);

      const candidates = [
        publishedResult.status === 'fulfilled' ? publishedResult.value : null,
        directResult.status === 'fulfilled' ? directResult.value : null
      ].filter(Boolean);
      const selected = candidates.find(payload => this.hasDynamicData(payload));

      if (selected) {
        this.writeSnapshot(selected);
        return selected;
      }

      const errors = [
        publishedResult.status === 'rejected' ? errorMessage(publishedResult.reason) : '',
        directResult.status === 'rejected' ? errorMessage(directResult.reason) : '',
        ...candidates.flatMap(payload => asArray(payload.errors))
      ].filter(Boolean);

      if (snapshot) {
        return {
          ...snapshot,
          errors: [...asArray(snapshot.errors), ...errors],
          degraded: true,
          source: 'snapshot'
        };
      }

      const fallback = candidates[0] || this.fallbackHub(season, errors[0] || 'MLB data unavailable');
      return {
        ...fallback,
        errors: errors.length ? errors : asArray(fallback.errors),
        degraded: true
      };
    }

    async loadSeasonGames({ season = this.currentSeason(), fresh = false } = {}) {
      try {
        const published = await this.loadPublishedHub({ season, fresh });
        if (published.games.length) return published.games;
      } catch {
        // Direct source is the final fallback below.
      }

      const games = await withTimeout(
        this.service.loadSeasonSchedule({ season, fresh }),
        12_000,
        'MLB season schedule timeout'
      );
      return asArray(games);
    }

    async loadPlayers({ season = this.currentSeason(), fresh = false } = {}) {
      const players = await withTimeout(
        this.service.loadJapanesePlayers({ season, fresh }),
        15_000,
        'MLB player data timeout'
      );
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
    SOURCE_TIMEOUT,
    PUBLISHED_URLS,
    asArray,
    errorMessage,
    withTimeout
  });
})(window.MLBRepository);