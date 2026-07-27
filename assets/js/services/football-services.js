const sharedSportsServices = window.SportsServices || window.FootballServices || {};
window.SportsServices = sharedSportsServices;
window.FootballServices = sharedSportsServices;

(function initializeSportsServices(namespace) {
  const Repositories = window.SportsRepositories || window.FootballRepositories || {};
  const asArray = value => (Array.isArray(value) ? value : []);
  const unique = values => [...new Set(asArray(values).map(String).filter(Boolean))];

  class SportsService {
    emit(name, detail = {}) {
      document.dispatchEvent(new CustomEvent(`sports:${name}`, { detail }));
      document.dispatchEvent(new CustomEvent(`football:${name}`, { detail }));
    }
  }

  class FavoriteService extends SportsService {
    constructor(repositoryOrOptions = {}) {
      super();
      const FavoriteRepository = Repositories.FavoriteRepository;
      if (!FavoriteRepository) throw new Error('SportsRepositories.FavoriteRepository is unavailable');
      this.repository = repositoryOrOptions?.list && repositoryOrOptions?.replace
        ? repositoryOrOptions
        : new FavoriteRepository(repositoryOrOptions);
    }

    list() {
      return this.repository.list();
    }

    has(id) {
      return this.repository.has(id);
    }

    add(id) {
      this.repository.add(id);
      this.emit('favorite-change', { id: String(id), added: true, ids: this.list() });
      return true;
    }

    remove(id) {
      this.repository.remove(id);
      this.emit('favorite-change', { id: String(id), added: false, ids: this.list() });
      return false;
    }

    toggle(id) {
      return this.has(id) ? this.remove(id) : this.add(id);
    }

    clear() {
      this.repository.clear();
      this.emit('favorite-change', { id: '', added: false, ids: [] });
    }
  }

  class SportsEventModel {
    constructor(raw = {}) {
      this.raw = raw;
      this.id = String(raw.id ?? raw.uid ?? raw.gamePk ?? '');
      this.date = raw.date ?? raw.kickoff ?? raw.startTime ?? raw.gameDate ?? null;
      this.home = raw.home ?? raw.homeTeam ?? raw.teams?.home ?? null;
      this.away = raw.away ?? raw.awayTeam ?? raw.teams?.away ?? null;
      this.status = String(raw.status?.abstractGameState ?? raw.status ?? 'scheduled').toLowerCase();
      this.score = raw.score ?? null;
      this.competition = raw.competition ?? raw.league ?? raw.gameTypeName ?? '';
      this.stage = raw.stage ?? raw.round ?? raw.series ?? '';
      this.venue = raw.venue?.name ?? raw.venue ?? '';
    }

    get timestamp() {
      const value = new Date(this.date).getTime();
      return Number.isNaN(value) ? 0 : value;
    }

    get dateKey() {
      if (!this.date) return '';
      const date = new Date(this.date);
      if (Number.isNaN(date.getTime())) return '';
      const pad = value => String(value).padStart(2, '0');
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    }

    get isFinished() {
      return ['finished', 'final', 'full_time', 'ft', 'game over'].includes(this.status);
    }

    get isLive() {
      return ['in_play', 'in-progress', 'live', 'paused', 'halftime', 'manager challenge'].includes(this.status);
    }

    hasTeam(id) {
      const target = String(id);
      return [this.home, this.away].some(team => String(team?.id ?? team?.uid ?? team?.team?.id ?? team ?? '') === target);
    }
  }

  class SoccerMatchModel extends SportsEventModel {
    constructor(raw = {}) {
      super(raw);
      this.penalties = raw.penalties ?? null;
      this.decision = raw.decision ?? '';
    }
  }

  class BaseballGameModel extends SportsEventModel {
    constructor(raw = {}) {
      super(raw);
      this.inning = raw.inning ?? raw.linescore?.currentInning ?? null;
      this.inningState = raw.inningState ?? raw.linescore?.inningState ?? '';
      this.gameNumber = Number(raw.gameNumber || 1);
      this.probablePitchers = raw.probablePitchers ?? {};
    }
  }

  class SportsCollectionService extends SportsService {
    constructor(items = []) {
      super();
      this.set(items);
    }

    set(items = []) {
      this.items = asArray(items);
      return this;
    }

    all() {
      return [...this.items];
    }
  }

  class SportsEventService extends SportsCollectionService {
    constructor(events = [], { modelClass = SportsEventModel } = {}) {
      super([]);
      this.modelClass = modelClass;
      this.set(events);
    }

    set(events = []) {
      const Model = this.modelClass || SportsEventModel;
      this.items = asArray(events).map(event => event instanceof Model ? event : new Model(event));
      this.events = this.items;
      this.matches = this.items;
      return this;
    }

    all() {
      return [...this.items].sort((left, right) => left.timestamp - right.timestamp);
    }

    byDate(dateKey) {
      return this.all().filter(event => event.dateKey === dateKey);
    }

    upcoming(now = Date.now()) {
      return this.all().filter(event => !event.isFinished && event.timestamp >= now);
    }

    finished(now = Date.now()) {
      return this.all().filter(event => event.isFinished && event.timestamp <= now);
    }

    live() {
      return this.all().filter(event => event.isLive);
    }

    involving(teamIds = []) {
      const ids = new Set(unique(teamIds));
      return this.all().filter(event => [event.home, event.away].some(team => ids.has(String(team?.id ?? team?.uid ?? team?.team?.id ?? team ?? ''))));
    }

    byCompetition(id) {
      return this.all().filter(event => String(event.competition) === String(id));
    }
  }

  class MatchService extends SportsEventService {
    constructor(matches = []) {
      super(matches, { modelClass: SoccerMatchModel });
    }
  }

  class BaseballGameService extends SportsEventService {
    constructor(games = []) {
      super(games, { modelClass: BaseballGameModel });
    }
  }

  class SearchService extends SportsCollectionService {
    constructor(items = [], fields = []) {
      super(items);
      this.fields = fields;
    }

    search(query) {
      const needle = String(query ?? '').trim().toLocaleLowerCase('ja');
      if (!needle) return this.all();
      return this.items.filter(item => this.fields.some(field => String(
        typeof field === 'function' ? field(item) : item?.[field] ?? ''
      ).toLocaleLowerCase('ja').includes(needle)));
    }
  }

  class StandingService extends SportsCollectionService {
    all() {
      return [...this.items].sort((left, right) => (left.rank ?? 999) - (right.rank ?? 999));
    }

    top(limit = 5) {
      return this.all().slice(0, limit);
    }

    byCompetition(id) {
      return this.all().filter(row => String(row.league ?? row.competition ?? '') === String(id));
    }
  }

  Object.assign(namespace, {
    SportsService,
    FavoriteService,
    SportsEventModel,
    SoccerMatchModel,
    BaseballGameModel,
    MatchModel: SoccerMatchModel,
    SportsCollectionService,
    SportsEventService,
    MatchService,
    BaseballGameService,
    SearchService,
    StandingService,
    asArray,
    unique
  });
})(sharedSportsServices);
