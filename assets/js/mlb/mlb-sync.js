window.MLBSync = window.MLBSync || {};

(function initializeMlbSync(namespace) {
  const DEFAULT_INTERVAL = 10 * 60 * 1000;
  const DEFAULT_VISIBILITY_STALE = 2 * 60 * 1000;
  const DEFAULT_RETRY_DELAYS = Object.freeze([5000, 15000, 45000]);
  const FULL_SCHEDULE_INTERVAL = 6 * 60 * 60 * 1000;

  class MLBHubSync {
    constructor({
      repository,
      store,
      getSeason,
      onStatus = () => {},
      onError = () => {},
      intervalMs = DEFAULT_INTERVAL,
      visibilityStaleMs = DEFAULT_VISIBILITY_STALE,
      retryDelays = DEFAULT_RETRY_DELAYS
    } = {}) {
      if (!repository) throw new Error('MLB repository is required');
      if (!store) throw new Error('MLB store is required');

      this.repository = repository;
      this.store = store;
      this.getSeason = getSeason || (() => new Date().getFullYear());
      this.onStatus = onStatus;
      this.onError = onError;
      this.intervalMs = intervalMs;
      this.visibilityStaleMs = visibilityStaleMs;
      this.retryDelays = [...retryDelays];
      this.pending = null;
      this.fullSchedulePending = null;
      this.retryTimer = null;
      this.intervalTimer = null;
      this.retryIndex = 0;
      this.lastSuccessAt = 0;
      this.lastFullScheduleAt = 0;
      this.started = false;
      this.handleOnline = this.handleOnline.bind(this);
      this.handleVisibility = this.handleVisibility.bind(this);
    }

    emit(type, detail = {}) {
      this.onStatus({ type, at: Date.now(), sync: this, ...detail });
    }

    restoreSnapshot() {
      const snapshot = this.repository.readSnapshot?.({ season: this.getSeason() });
      if (!snapshot) return null;

      this.store.replaceHubData(snapshot, {
        fallbackTeams: this.repository.fallbackTeams()
      });
      this.emit('snapshot', { payload: snapshot });
      return snapshot;
    }

    scheduleRetry() {
      clearTimeout(this.retryTimer);
      const delay = this.retryDelays[Math.min(this.retryIndex, this.retryDelays.length - 1)];
      this.retryIndex += 1;
      this.emit('retry-scheduled', { delay });
      this.retryTimer = setTimeout(() => {
        this.refresh({ fresh: true, reason: 'retry' });
      }, delay);
    }

    clearRetry() {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
      this.retryIndex = 0;
    }

    async refresh({ fresh = false, reason = 'manual' } = {}) {
      if (this.pending) return this.pending;

      this.emit('loading', { fresh, reason });
      this.pending = (async () => {
        try {
          const payload = await this.repository.loadHub({
            season: this.getSeason(),
            fresh
          });

          this.store.replaceHubData(payload, {
            fallbackTeams: this.repository.fallbackTeams()
          });
          this.lastSuccessAt = Date.now();

          if (payload.degraded) {
            this.emit('degraded', { payload, reason });
            this.scheduleRetry();
          } else {
            this.clearRetry();
            this.emit('ready', { payload, reason });
          }

          this.hydrateFullSchedule();
          return payload;
        } catch (error) {
          this.emit('error', { error, reason });
          this.onError(error);
          this.scheduleRetry();
          throw error;
        } finally {
          this.pending = null;
        }
      })();

      return this.pending;
    }

    async hydrateFullSchedule({ fresh = false } = {}) {
      if (this.fullSchedulePending) return this.fullSchedulePending;
      if (!fresh && Date.now() - this.lastFullScheduleAt < FULL_SCHEDULE_INTERVAL) return null;

      this.fullSchedulePending = (async () => {
        try {
          const games = await this.repository.loadSeasonGames({
            season: this.getSeason(),
            fresh
          });
          if (games.length) {
            this.store.setGames(games, 'season-games-loaded');
            this.lastFullScheduleAt = Date.now();
            this.emit('season-ready', { games });
          }
          return games;
        } catch (error) {
          console.warn('Full MLB schedule hydration failed:', error);
          return [];
        } finally {
          this.fullSchedulePending = null;
        }
      })();

      return this.fullSchedulePending;
    }

    handleOnline() {
      this.refresh({ fresh: true, reason: 'online' });
    }

    handleVisibility() {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - this.lastSuccessAt < this.visibilityStaleMs) return;
      this.refresh({ fresh: false, reason: 'visible' });
    }

    start() {
      if (this.started) return this;
      this.started = true;
      this.restoreSnapshot();
      window.addEventListener('online', this.handleOnline);
      document.addEventListener('visibilitychange', this.handleVisibility);
      this.intervalTimer = setInterval(() => {
        this.refresh({ fresh: false, reason: 'interval' });
      }, this.intervalMs);
      this.refresh({ fresh: false, reason: 'initial' });
      return this;
    }

    stop() {
      if (!this.started) return;
      this.started = false;
      clearInterval(this.intervalTimer);
      clearTimeout(this.retryTimer);
      window.removeEventListener('online', this.handleOnline);
      document.removeEventListener('visibilitychange', this.handleVisibility);
    }
  }

  Object.assign(namespace, {
    MLBHubSync,
    DEFAULT_INTERVAL,
    DEFAULT_VISIBILITY_STALE,
    DEFAULT_RETRY_DELAYS,
    FULL_SCHEDULE_INTERVAL
  });
})(window.MLBSync);