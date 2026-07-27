window.MLBApp = window.MLBApp || {};

(function initializeMlbController(namespace) {
  const Core = window.FootballCore;
  const Data = window.MLBData;
  const UI = window.SportsUI || window.FootballUI;
  const View = window.MLBView;
  const StoreModule = window.MLBStore;
  const RepositoryModule = window.MLBRepository;
  const SyncModule = window.MLBSync;
  const Registry = window.SportsHubRegistry;

  const NODE_SELECTORS = Object.freeze({
    updated: '#mlbUpdated',
    refresh: '#mlbRefresh',
    todayCount: '#todayGameCount',
    todayGames: '#todayGames',
    homeFavoriteStatus: '#homeFavoriteStatus',
    favoriteNextGames: '#favoriteNextGames',
    summary: '#mlbSummary',
    homeStandings: '#homeStandings',
    scheduleTitle: '#scheduleTitle',
    scheduleGames: '#scheduleGames',
    clearDate: '#clearDateFilter',
    standingFilters: '#standingLeagueFilters',
    standings: '#mlbStandings',
    teamSearch: '#teamSearch',
    teamFilters: '#teamFilters',
    teamCount: '#teamCount',
    teamGrid: '#teamGrid',
    playerStatus: '#playerStatus',
    players: '#japanesePlayers',
    favoriteBadge: '#favoriteCountBadge',
    favoriteTeamCount: '#favoriteTeamCount',
    favoriteTeamGrid: '#favoriteTeamGrid',
    favoriteGames: '#favoriteGames'
  });

  const collectNodes = root => Object.fromEntries(
    Object.entries(NODE_SELECTORS).map(([key, selector]) => [key, root.querySelector(selector)])
  );

  const createStateFacade = store => new Proxy({}, {
    get: (_, property) => store.state[property],
    has: (_, property) => property in store.state,
    ownKeys: () => Reflect.ownKeys(store.state),
    getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true })
  });

  class MLBController {
    constructor({ root = document, repository = null, store = null, sync = null } = {}) {
      if (!Core || !Data || !UI || !View || !StoreModule || !RepositoryModule || !SyncModule) {
        throw new Error('MLB application dependencies are unavailable');
      }

      this.root = root;
      this.pageConfig = Registry?.get?.('mlb') || null;
      this.repository = repository || new RepositoryModule.MLBHubRepository();
      this.store = store || new StoreModule.MLBHubStore({
        season: this.repository.currentSeason(),
        teams: this.repository.fallbackTeams()
      });
      this.state = createStateFacade(this.store);
      this.nodes = collectNodes(root);
      this.favoriteService = new Core.FavoriteService({
        key: this.pageConfig?.favoriteStorageKey || 'sportsHubFavoriteMlbTeams'
      });
      this.pageTabs = new Core.PageTabs({ root: root.querySelector('#pageTabs') });
      this.bound = false;
      this.calendar = null;
      this.view = new View.MLBHubView({
        state: this.state,
        nodes: this.nodes,
        favoriteService: this.favoriteService,
        getCalendar: () => this.calendar
      });
      this.calendar = this.createCalendar();
      this.unsubscribeStore = this.store.subscribe(change => this.handleStoreChange(change));
      this.sync = sync || new SyncModule.MLBHubSync({
        repository: this.repository,
        store: this.store,
        getSeason: () => this.state.season,
        initialFresh: true,
        onStatus: event => this.handleSyncStatus(event),
        onError: error => console.warn('MLB automatic synchronization failed:', error)
      });
      this.handlers = {
        documentClick: event => this.handleDocumentClick(event),
        teamFilter: event => this.handleTeamFilter(event),
        standingFilter: event => this.handleStandingFilter(event),
        teamSearch: () => this.store.setTeamQuery(this.nodes.teamSearch?.value || ''),
        clearDate: () => this.calendar.clearSelection(),
        refresh: () => this.refresh(),
        pageShow: event => this.handlePageShow(event)
      };
    }

    favoriteIds() {
      return this.favoriteService.list();
    }

    teamById(id) {
      return this.state.teams.find(team => String(team.id) === String(id));
    }

    createCalendar() {
      const calendarConfig = this.pageConfig?.calendar || {};
      const filterStorageKey = calendarConfig.filterStorageKey || 'footballCalendarFavoriteOnly:mlb';
      if (localStorage.getItem(filterStorageKey) === null) {
        localStorage.setItem(filterStorageKey, String(calendarConfig.defaultFavoriteOnly ?? false));
      }

      const CalendarClass = UI.SportsCalendar || UI.FootballCalendar;
      if (!CalendarClass) throw new Error('Shared sports calendar is unavailable');

      const calendar = new CalendarClass({
        page: 'mlb',
        filterStorageKey,
        defaultFavoriteOnly: calendarConfig.defaultFavoriteOnly ?? false,
        root: this.root.querySelector('#matchCalendar'),
        title: this.root.querySelector('#calendarTitle'),
        prev: this.root.querySelector('#calendarPrev'),
        next: this.root.querySelector('#calendarNext'),
        getMatches: () => this.state.games,
        getFavorites: () => this.favoriteIds(),
        getPrimary: () => '',
        getDate: game => game.date,
        getTeamVisual: id => {
          const team = this.teamById(id);
          return {
            logo: team?.logo || Data.teamLogo(id),
            label: team?.abbreviation || '⚾'
          };
        },
        onSelect: date => this.store.setSelectedDate(date)
      });

      UI.calendars = UI.calendars || {};
      UI.calendars.mlb = calendar;
      return calendar;
    }

    handleStoreChange(change) {
      if (!this.view) return;

      switch (change.reason) {
        case 'selected-date':
          this.view.renderSchedule();
          break;
        case 'team-filter':
        case 'team-query':
          this.view.renderTeams();
          break;
        case 'standing-filter':
          this.view.renderStandings();
          break;
        case 'players-loading':
        case 'players-loaded':
        case 'players-error':
          this.view.renderPlayers();
          break;
        case 'hub-loaded':
        case 'season-games-loaded':
        default:
          this.view.renderAll();
          break;
      }
    }

    formatUpdatedAt(value) {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return '';
      return date.toLocaleString('ja-JP', {
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }

    handleSyncStatus(event) {
      if (!this.nodes.updated) return;

      const updated = this.formatUpdatedAt(event.payload?.updatedAt);
      switch (event.type) {
        case 'snapshot':
          this.nodes.updated.textContent = '保存済みデータを表示・最新情報を自動取得中';
          break;
        case 'loading': {
          const automaticStartup = ['initial', 'startup-watchdog', 'pageshow'].includes(event.reason);
          this.nodes.updated.textContent = event.reason === 'retry'
            ? 'MLBデータを自動再取得しています…'
            : event.reason === 'manual'
              ? '最新データを取得しています…'
              : automaticStartup
                ? '最新データを自動取得しています…'
                : 'MLBデータを自動取得しています…';
          if (this.nodes.refresh) this.nodes.refresh.disabled = true;
          break;
        }
        case 'ready':
          this.nodes.updated.textContent = updated
            ? `最終更新 ${updated}・自動更新ON`
            : 'MLBデータ取得済み・自動更新ON';
          if (this.nodes.refresh) this.nodes.refresh.disabled = false;
          break;
        case 'degraded':
          this.nodes.updated.textContent = event.payload?.source === 'snapshot'
            ? '保存済みデータを表示・自動再取得中'
            : '一部データ取得待ち・自動再取得中';
          if (this.nodes.refresh) this.nodes.refresh.disabled = false;
          break;
        case 'retry-scheduled':
          this.nodes.updated.textContent = '通信待機中・自動で再取得します';
          break;
        case 'retry-exhausted':
          this.nodes.updated.textContent = '自動更新待機中・次回も自動取得します';
          if (this.nodes.refresh) this.nodes.refresh.disabled = false;
          break;
        case 'season-ready':
          if (updated) this.nodes.updated.textContent = `最終更新 ${updated}・全日程取得済み`;
          break;
        case 'error':
          this.nodes.updated.textContent = '取得に失敗・自動で再試行します';
          if (this.nodes.refresh) this.nodes.refresh.disabled = false;
          break;
        default:
          break;
      }
    }

    handlePageChange(page) {
      if (page === 'players') this.loadPlayers();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    handlePageShow(event) {
      // Safari can restore the page from its back-forward cache without rerunning scripts.
      // Re-check the automatic loader whenever the page becomes active again.
      void this.ensureInitialLoad({
        fresh: Boolean(event?.persisted),
        reason: 'pageshow'
      });
    }

    handleDocumentClick(event) {
      const jump = event.target.closest('[data-page-jump]');
      if (jump) {
        this.pageTabs.show(jump.dataset.pageJump);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      const favoriteButton = event.target.closest('[data-favorite-team]');
      if (!favoriteButton) return;

      const id = favoriteButton.dataset.favoriteTeam;
      const team = this.teamById(id);
      const added = this.favoriteService.toggle(id);
      window.SportsHub?.toast?.(`${team?.name || '球団'}を推し球団から${added ? '追加' : '解除'}しました`);
      this.view.renderFavoriteDependentViews();
    }

    handleTeamFilter(event) {
      const button = event.target.closest('[data-team-filter]');
      if (button) this.store.setTeamFilter(button.dataset.teamFilter);
    }

    handleStandingFilter(event) {
      const button = event.target.closest('[data-standing-filter]');
      if (button) this.store.setStandingFilter(button.dataset.standingFilter);
    }

    bind() {
      if (this.bound) return this;
      this.bound = true;

      this.pageTabs.bind(page => this.handlePageChange(page));
      document.addEventListener('click', this.handlers.documentClick);
      window.addEventListener('pageshow', this.handlers.pageShow);
      this.nodes.teamFilters?.addEventListener('click', this.handlers.teamFilter);
      this.nodes.standingFilters?.addEventListener('click', this.handlers.standingFilter);
      this.nodes.teamSearch?.addEventListener('input', this.handlers.teamSearch);
      this.nodes.clearDate?.addEventListener('click', this.handlers.clearDate);
      this.nodes.refresh?.addEventListener('click', this.handlers.refresh);
      return this;
    }

    destroy() {
      if (!this.bound) return;
      document.removeEventListener('click', this.handlers.documentClick);
      window.removeEventListener('pageshow', this.handlers.pageShow);
      this.nodes.teamFilters?.removeEventListener('click', this.handlers.teamFilter);
      this.nodes.standingFilters?.removeEventListener('click', this.handlers.standingFilter);
      this.nodes.teamSearch?.removeEventListener('input', this.handlers.teamSearch);
      this.nodes.clearDate?.removeEventListener('click', this.handlers.clearDate);
      this.nodes.refresh?.removeEventListener('click', this.handlers.refresh);
      this.sync?.stop?.();
      this.unsubscribeStore?.();
      this.bound = false;
    }

    async loadPlayers({ fresh = false } = {}) {
      if (this.state.playersLoading || this.state.players && !fresh) return;

      this.store.setPlayersLoading(true);
      try {
        const players = await this.repository.loadPlayers({
          season: this.state.season,
          fresh
        });
        this.store.setPlayers(players);
      } catch (error) {
        console.warn('Japanese MLB players unavailable:', error);
        this.store.setPlayers([], 'players-error');
        window.SportsHub?.toast?.('日本人選手データを取得できませんでした', 2600);
      }
    }

    ensureInitialLoad(options = {}) {
      if (typeof this.sync.ensureInitialLoad === 'function') {
        return this.sync.ensureInitialLoad(options);
      }
      return this.sync.refresh({
        fresh: options.fresh !== false,
        reason: options.reason || 'startup-watchdog'
      });
    }

    refresh() {
      return this.sync.refresh({ fresh: true, reason: 'manual' });
    }

    start() {
      this.bind();
      window.SportsHub?.applyTheme?.();
      this.pageTabs.show('home');

      // Start data synchronization first. A rendering problem must never prevent
      // the automatic request that the Update button performs successfully.
      this.sync.start();

      try {
        this.view.renderAll();
      } catch (error) {
        console.error('Initial MLB rendering failed; synchronization will continue:', error);
      }

      queueMicrotask(() => {
        void this.ensureInitialLoad({ fresh: true, reason: 'startup-watchdog' });
      });
      return this;
    }
  }

  Object.assign(namespace, {
    NODE_SELECTORS,
    collectNodes,
    createStateFacade,
    MLBController,
    start(options) {
      if (namespace.instance) {
        void namespace.instance.ensureInitialLoad?.({ fresh: true, reason: 'startup-watchdog' });
        return namespace.instance;
      }
      namespace.instance = new MLBController(options).start();
      return namespace.instance;
    }
  });
})(window.MLBApp);