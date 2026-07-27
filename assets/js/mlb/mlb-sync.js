window.MLBSync = window.MLBSync || {};

(function initializeMlbSync(namespace) {
  const DEFAULT_INTERVAL = 10 * 60 * 1000;
  const DEFAULT_VISIBILITY_STALE = 2 * 60 * 1000;
  const DEFAULT_RETRY_DELAYS = Object.freeze([5000, 15000, 45000]);
  const FULL_SCHEDULE_INTERVAL = 6 * 60 * 60 * 1000;
  const DEFAULT_STARTUP_WATCHDOG = 3000;

  class MLBHubSync {
    constructor({
      repository,
      store,
      getSeason,
      onStatus = () => {},
      onError = () => {},
      intervalMs = DEFAULT_INTERVAL,
      visibilityStaleMs = DEFAULT_VISIBILITY_STALE,
      retryDelays = DEFAULT_RETRY_DELAYS,
      startupWatchdogMs = DEFAULT_STARTUP_WATCHDOG,
      initialFresh = true
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
      this.startupWatchdogMs = startupWatchdogMs;
      this.initialFresh = initialFresh;
      this.pending = null;
      this.fullSchedulePending = null;
      this.retryTimer = null;
      this.intervalTimer = null;
      this.watchdogTimer = null;
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
      this.lastSuccessAt = Date.now();
      this.emit('snapshot', { payload: snapshot });
      return snapshot;
    }

    scheduleRetry() {
      if (!this.started) return;
      clearTimeout(this.retryTimer);

      if (this.retryIndex >= this.retryDelays.length) {
        this.emit('retry-exhausted', { intervalMs: this.intervalMs });
        return;
      }

      const delay = this.retryDelays[this.retryIndex];
      this.retryIndex += 1;
      this.emit('retry-scheduled', { delay, attempt: this.retryIndex });
      this.retryTimer = setTimeout(() => {
        void this.refresh({ fresh: true, reason: 'retry' });
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

          void this.hydrateFullSchedule();
          return payload;
        } catch (error) {
          this.emit('error', { error, reason });
          this.onError(error);
          this.scheduleRetry();
          return null;
        } finally {
          this.pending = null;
        }
      })();

      return this.pending;
    }

    ensureInitialLoad({ fresh = true, reason = 'startup-watchdog' } = {}) {
      if (!this.started) this.start();
      if (this.pending) return this.pending;

      const state = this.store.state || {};
      const hasDisplayData = Boolean(state.loaded)
        && ((state.games?.length || 0) > 0 || (state.standings?.length || 0) > 0);
      if (hasDisplayData) return Promise.resolve(null);

      return this.refresh({ fresh, reason });
    }

    armStartupWatchdog() {
      clearTimeout(this.watchdogTimer);
      this.watchdogTimer = setTimeout(() => {
        if (!this.started) return;
        void this.ensureInitialLoad({ fresh: true, reason: 'startup-watchdog' });
      }, this.startupWatchdogMs);
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
            if (typeof this.store.mergeGames === 'function') {
              this.store.mergeGames(games, 'season-games-loaded');
            } else {
              this.store.setGames(games, 'season-games-loaded');
            }
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
      this.clearRetry();
      void this.refresh({ fresh: true, reason: 'online' });
    }

    handleVisibility() {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - this.lastSuccessAt < this.visibilityStaleMs) return;
      void this.refresh({ fresh: true, reason: 'visible' });
    }

    start() {
      if (this.started) return this;
      this.started = true;
      this.restoreSnapshot();
      window.addEventListener('online', this.handleOnline);
      document.addEventListener('visibilitychange', this.handleVisibility);
      this.intervalTimer = setInterval(() => {
        this.clearRetry();
        void this.refresh({ fresh: true, reason: 'interval' });
      }, this.intervalMs);

      // The first automatic request intentionally matches the manual Update button:
      // bypass stale browser/CDN responses and request the latest published dataset.
      void this.refresh({ fresh: this.initialFresh, reason: 'initial' });
      this.armStartupWatchdog();
      return this;
    }

    stop() {
      if (!this.started) return;
      this.started = false;
      clearInterval(this.intervalTimer);
      clearTimeout(this.retryTimer);
      clearTimeout(this.watchdogTimer);
      this.intervalTimer = null;
      this.retryTimer = null;
      this.watchdogTimer = null;
      window.removeEventListener('online', this.handleOnline);
      document.removeEventListener('visibilitychange', this.handleVisibility);
    }
  }

  Object.assign(namespace, {
    MLBHubSync,
    DEFAULT_INTERVAL,
    DEFAULT_VISIBILITY_STALE,
    DEFAULT_RETRY_DELAYS,
    FULL_SCHEDULE_INTERVAL,
    DEFAULT_STARTUP_WATCHDOG
  });
})(window.MLBSync);