window.MLBApp = window.MLBApp || {};

(function initializeMlbController(namespace) {
  const Core = window.FootballCore;
  const Data = window.MLBData;
  const Api = window.MLBService;
  const UI = window.SportsUI || window.FootballUI;
  const View = window.MLBView;

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

  const createState = () => ({
    season: Api.currentSeason(),
    teams: [...Data.FALLBACK_TEAMS],
    games: [],
    standings: [],
    players: null,
    playersLoading: false,
    selectedDate: '',
    teamFilter: 'all',
    standingFilter: 'all',
    teamQuery: '',
    errors: [],
    loaded: false
  });

  const collectNodes = root => Object.fromEntries(
    Object.entries(NODE_SELECTORS).map(([key, selector]) => [key, root.querySelector(selector)])
  );

  class MLBController {
    constructor({ root = document } = {}) {
      this.root = root;
      this.state = createState();
      this.nodes = collectNodes(root);
      this.favoriteService = new Core.FavoriteService({ key: 'sportsHubFavoriteMlbTeams' });
      this.pageTabs = new Core.PageTabs({ root: root.querySelector('#pageTabs') });
      this.bound = false;
      this.view = null;
      this.calendar = this.createCalendar();
      this.view = new View.MLBHubView({
        state: this.state,
        nodes: this.nodes,
        favoriteService: this.favoriteService,
        getCalendar: () => this.calendar
      });
    }

    favoriteIds() {
      return this.favoriteService.list();
    }

    teamById(id) {
      return this.state.teams.find(team => String(team.id) === String(id));
    }

    createCalendar() {
      const filterStorageKey = 'footballCalendarFavoriteOnly:mlb';
      if (localStorage.getItem(filterStorageKey) === null) {
        localStorage.setItem(filterStorageKey, 'false');
      }

      const CalendarClass = UI.SportsCalendar || UI.FootballCalendar;
      if (!CalendarClass) throw new Error('Shared sports calendar is unavailable');

      const calendar = new CalendarClass({
        page: 'mlb',
        filterStorageKey,
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
        onSelect: date => {
          this.state.selectedDate = date;
          this.view?.renderSchedule();
        }
      });

      UI.calendars = UI.calendars || {};
      UI.calendars.mlb = calendar;
      return calendar;
    }

    handlePageChange(page) {
      if (page === 'players') this.loadPlayers();
      window.scrollTo({ top: 0, behavior: 'smooth' });
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
      if (!button) return;
      this.state.teamFilter = button.dataset.teamFilter;
      this.view.renderTeams();
    }

    handleStandingFilter(event) {
      const button = event.target.closest('[data-standing-filter]');
      if (!button) return;
      this.state.standingFilter = button.dataset.standingFilter;
      this.view.renderStandings();
    }

    bind() {
      if (this.bound) return this;
      this.bound = true;

      this.pageTabs.bind(page => this.handlePageChange(page));
      document.addEventListener('click', event => this.handleDocumentClick(event));
      this.nodes.teamFilters?.addEventListener('click', event => this.handleTeamFilter(event));
      this.nodes.standingFilters?.addEventListener('click', event => this.handleStandingFilter(event));
      this.nodes.teamSearch?.addEventListener('input', () => {
        this.state.teamQuery = this.nodes.teamSearch.value;
        this.view.renderTeams();
      });
      this.nodes.clearDate?.addEventListener('click', () => this.calendar.clearSelection());
      this.nodes.refresh?.addEventListener('click', async () => {
        await this.loadHub({ fresh: true });
        if (this.state.players) await this.loadPlayers({ fresh: true });
      });

      return this;
    }

    async loadPlayers({ fresh = false } = {}) {
      if (this.state.playersLoading || this.state.players && !fresh) return;

      this.state.playersLoading = true;
      this.view.renderPlayers();

      try {
        this.state.players = await Api.loadJapanesePlayers({
          season: this.state.season,
          fresh
        });
      } catch (error) {
        console.warn('Japanese MLB players unavailable:', error);
        this.state.players = [];
        window.SportsHub?.toast?.('日本人選手データを取得できませんでした', 2600);
      } finally {
        this.state.playersLoading = false;
        this.view.renderPlayers();
      }
    }

    async loadHub({ fresh = false } = {}) {
      if (this.nodes.updated) {
        this.nodes.updated.textContent = fresh
          ? 'MLBデータを更新しています…'
          : 'MLBデータを読み込んでいます…';
      }
      if (this.nodes.refresh) this.nodes.refresh.disabled = true;
      if (fresh) Api.clearCache();

      try {
        const payload = await Api.loadHub({
          season: this.state.season,
          fresh
        });

        this.state.season = payload.season;
        this.state.teams = Array.isArray(payload.teams) && payload.teams.length
          ? payload.teams
          : [...Data.FALLBACK_TEAMS];
        this.state.games = Array.isArray(payload.games) ? payload.games : [];
        this.state.standings = Array.isArray(payload.standings) ? payload.standings : [];
        this.state.errors = Array.isArray(payload.errors) ? payload.errors : [];
        this.state.loaded = true;

        const updated = new Date(payload.updatedAt).toLocaleString('ja-JP', {
          month: 'numeric',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });

        if (this.nodes.updated) {
          this.nodes.updated.textContent = this.state.errors.length
            ? `最終更新 ${updated}・一部データ取得待ち`
            : `最終更新 ${updated}`;
        }

        this.view.renderAll();
      } catch (error) {
        console.warn('MLB Hub data unavailable:', error);
        if (this.nodes.updated) this.nodes.updated.textContent = 'MLBデータを取得できませんでした';
        window.SportsHub?.toast?.('MLBデータを取得できませんでした', 2600);
        this.view.renderAll();
      } finally {
        if (this.nodes.refresh) this.nodes.refresh.disabled = false;
      }
    }

    start() {
      this.bind();
      window.SportsHub?.applyTheme?.();
      this.pageTabs.show('home');
      this.view.renderAll();
      this.loadHub();
      return this;
    }
  }

  Object.assign(namespace, {
    NODE_SELECTORS,
    createState,
    collectNodes,
    MLBController,
    start(options) {
      if (namespace.instance) return namespace.instance;
      namespace.instance = new MLBController(options).start();
      return namespace.instance;
    }
  });
})(window.MLBApp);
