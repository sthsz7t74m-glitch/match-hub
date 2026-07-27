window.MLBStore = window.MLBStore || {};

(function initializeMlbStore(namespace) {
  const asArray = value => (Array.isArray(value) ? value : []);
  const freezeArray = value => Object.freeze([...asArray(value)]);

  const createInitialState = (initial = {}) => Object.freeze({
    season: Number(initial.season || new Date().getFullYear()),
    teams: freezeArray(initial.teams),
    games: freezeArray(initial.games),
    standings: freezeArray(initial.standings),
    players: initial.players === null || initial.players === undefined
      ? null
      : freezeArray(initial.players),
    playersLoading: Boolean(initial.playersLoading),
    selectedDate: String(initial.selectedDate || ''),
    teamFilter: String(initial.teamFilter || 'all'),
    standingFilter: String(initial.standingFilter || 'all'),
    teamQuery: String(initial.teamQuery || ''),
    errors: freezeArray(initial.errors),
    loaded: Boolean(initial.loaded)
  });

  class MLBHubStore {
    constructor(initial = {}) {
      this.listeners = new Set();
      this._state = createInitialState(initial);
    }

    get state() {
      return this._state;
    }

    subscribe(listener) {
      if (typeof listener !== 'function') return () => {};
      this.listeners.add(listener);
      return () => this.listeners.delete(listener);
    }

    update(patch, reason = 'update') {
      const previous = this._state;
      const value = typeof patch === 'function' ? patch(previous) : patch;
      const next = createInitialState({ ...previous, ...(value || {}) });
      const changedKeys = Object.keys(next).filter(key => next[key] !== previous[key]);
      if (!changedKeys.length) return next;

      this._state = next;
      const change = Object.freeze({
        reason,
        changedKeys: Object.freeze(changedKeys),
        state: next,
        previous
      });

      this.listeners.forEach(listener => {
        try {
          listener(change);
        } catch (error) {
          console.warn('MLB store listener failed:', error);
        }
      });

      document.dispatchEvent(new CustomEvent('mlb:state-change', { detail: change }));
      return next;
    }

    replaceHubData(payload = {}, { fallbackTeams = [] } = {}) {
      const teams = asArray(payload.teams);
      return this.update({
        season: Number(payload.season || this.state.season),
        teams: teams.length ? teams : fallbackTeams,
        games: asArray(payload.games),
        standings: asArray(payload.standings),
        errors: asArray(payload.errors),
        loaded: true
      }, 'hub-loaded');
    }

    setPlayersLoading(loading) {
      return this.update({ playersLoading: Boolean(loading) }, 'players-loading');
    }

    setPlayers(players, reason = 'players-loaded') {
      return this.update({
        players: asArray(players),
        playersLoading: false
      }, reason);
    }

    setSelectedDate(date) {
      return this.update({ selectedDate: String(date || '') }, 'selected-date');
    }

    setTeamFilter(filter) {
      return this.update({ teamFilter: String(filter || 'all') }, 'team-filter');
    }

    setStandingFilter(filter) {
      return this.update({ standingFilter: String(filter || 'all') }, 'standing-filter');
    }

    setTeamQuery(query) {
      return this.update({ teamQuery: String(query || '') }, 'team-query');
    }
  }

  Object.assign(namespace, {
    MLBHubStore,
    createInitialState
  });
})(window.MLBStore);