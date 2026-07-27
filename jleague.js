class JLeagueHubController {
  constructor({ catalog = window.SportsHubJLeague, core = window.SportsCore || window.FootballCore, ui = window.SportsUI || window.FootballUI } = {}) {
    this.catalog = catalog;
    this.core = core;
    this.ui = ui;
    this.state = {
      activeLeague: 'j1',
      query: '',
      selectedDate: '',
      data: null,
      metadata: null
    };
    this.favoriteService = new core.FavoriteService({
      key: 'sportsHubFavoriteJClubs',
      legacyKey: 'sportsHubFavoriteJClub'
    });
    this.pageTabs = new core.PageTabs({ root: document.querySelector('#pageTabs') });
    this.searchService = new core.SearchService(catalog.clubs, [club => club.name, club => club.area, club => club.en, club => club.shortName]);
    this.dataAdapter = new FootballAdapters.JLeagueAdapter();
    this.teamMapper = FootballTeamMapper.create(catalog.createTeamMapperOptions());
    this.nodes = this.collectNodes();
    this.matchRenderer = this.createMatchRenderer();
    this.handleDocumentClick = this.handleDocumentClick.bind(this);
    this.handleLeagueClick = this.handleLeagueClick.bind(this);
    this.handleSearch = this.handleSearch.bind(this);
    this.handleCalendarSelect = this.handleCalendarSelect.bind(this);
  }

  collectNodes() {
    const select = selector => document.querySelector(selector);
    return {
      tabs: select('#leagueTabs'),
      grid: select('#clubGrid'),
      search: select('#clubSearch'),
      count: select('#clubCount'),
      matches: select('#jleagueMatches'),
      standings: select('#jleagueStandings'),
      homeStandings: select('#homeStandings'),
      matchCount: select('#matchCount'),
      updated: select('#jUpdated'),
      source: select('#jSourceStatus'),
      schedule: select('#scheduleMatches'),
      scheduleTitle: select('#scheduleTitle'),
      favoriteMatches: select('#favoriteMatches'),
      favoriteNext: select('#favoriteNextMatches'),
      favoriteGrid: select('#favoriteClubGrid'),
      favoriteBadge: select('#favoriteCountBadge'),
      favoriteCount: select('#favoriteClubCount'),
      homeFavorite: select('#homeFavoriteStatus'),
      clearDate: select('#clearDateFilter')
    };
  }

  get activeLeague() {
    return this.state.activeLeague;
  }

  get data() {
    return this.state.data || { matches: [], standings: [], teams: [] };
  }

  get metadata() {
    return this.state.metadata || {};
  }

  displayTeamName(team) {
    return this.teamMapper.getName(team);
  }

  findClubByTeam(team) {
    return this.teamMapper.findClubByTeam(team);
  }

  findLiveTeam(club) {
    return this.teamMapper.findLiveTeam(club);
  }

  detailTarget(team) {
    const club = this.findClubByTeam(team);
    if (!club) return {};
    return {
      id: club.id,
      href: `./jleague-detail.html?club=${encodeURIComponent(club.id)}`,
      ariaLabel: `${club.name}の詳細を見る`,
      fallback: club.mark
    };
  }

  normalizeStatus(match) {
    const model = new this.core.MatchModel(match);
    if (model.isFinished) return 'finished';
    if (model.isLive) return 'in_play';
    const status = String(match?.status || '').toLowerCase().replace(/[\s-]+/g, '_');
    return ['postponed', 'suspended', 'cancelled'].includes(status) ? status : 'scheduled';
  }

  formatStage(match) {
    if (match.matchday) return `第${match.matchday}節`;
    return {
      'regular-season': 'リーグ戦',
      championship: '優勝決定戦',
      'placement-playoffs': '順位決定戦',
      '2026-j1-100-year-vision-league': '百年構想リーグ'
    }[match.stage] || match.round || '';
  }

  createMatchRenderer() {
    return SportsHubComponents.createMatchCardRenderer({
      normalize: match => {
        const model = new this.core.MatchModel(match);
        const status = this.normalizeStatus(match);
        const done = status === 'finished';
        const live = status === 'in_play';
        const homeClub = this.findClubByTeam(match.home);
        const awayClub = this.findClubByTeam(match.away);
        return {
          match: { ...match, status },
          date: model.date,
          timeText: done ? '試合終了' : live ? 'LIVE' : match.timeTbd ? '時間未定' : '',
          scoreText: done || live ? `${match.score?.home ?? '-'} - ${match.score?.away ?? '-'}` : status === 'postponed' ? '延期' : status === 'cancelled' ? '中止' : 'VS',
          competition: match.competition || this.catalog.leagueNames[match.league] || this.activeLeague.toUpperCase(),
          stage: this.formatStage(match),
          venue: match.venue || '',
          home: {
            ...this.detailTarget(match.home),
            name: this.displayTeamName(match.home),
            logo: match.home?.logo || this.teamMapper.getLogo(match.home),
            fallback: homeClub?.mark || '●'
          },
          away: {
            ...this.detailTarget(match.away),
            name: this.displayTeamName(match.away),
            logo: match.away?.logo || this.teamMapper.getLogo(match.away),
            fallback: awayClub?.mark || '●'
          }
        };
      }
    });
  }

  empty(title, description = '') {
    return this.core.EmptyState.render(title, description);
  }

  scheduleEmpty(title, description = '') {
    return this.core.SportsScheduleEmptyState.render({ title, description, className: 'jleague-empty-state' });
  }

  favoritesEmpty(title, description = '') {
    return this.core.SportsFavoritesEmptyState.render({ title, description, className: 'jleague-empty-state' });
  }

  leagueAvailability(league = this.activeLeague) {
    return this.metadata.leaguesAvailability?.[league] || {};
  }

  leagueMatches(league = this.activeLeague) {
    return (this.data.matches || []).filter(match => (match.league || 'j1') === league);
  }

  matchService(league = this.activeLeague) {
    return new this.core.MatchService(this.leagueMatches(league));
  }

  leagueStandings(league = this.activeLeague) {
    return (this.data.standings || []).filter(row => (row.league || 'j1') === league);
  }

  renderStatus() {
    if (!this.state.data) {
      this.nodes.updated.textContent = 'J1・J2・J3データを確認中…';
      if (this.nodes.source) this.nodes.source.textContent = 'ESPN + J.LEAGUE';
      return;
    }
    const updated = new Date(this.metadata.updatedAt || '');
    const dateText = Number.isNaN(updated.getTime())
      ? '更新時刻不明'
      : updated.toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const count = this.metadata.counts?.matches?.[this.activeLeague] ?? this.leagueMatches().length;
    const available = this.leagueAvailability();
    this.nodes.updated.textContent = `最終更新 ${dateText}・${this.activeLeague.toUpperCase()} ${count}試合`;
    if (this.nodes.source) {
      this.nodes.source.textContent = available.matches === false ? '日程取得待ち' : this.activeLeague === 'j1' ? 'ESPN' : 'J.LEAGUE公式';
      this.nodes.source.classList.toggle('is-limited', available.matches === false);
    }
  }

  emblem(club) {
    const live = this.findLiveTeam(club);
    return live?.logo
      ? `<span class="club-badge"><img class="club-emblem" src="${live.logo}" alt="${club.name}のエンブレム" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span class="club-mark-fallback" hidden>${club.mark}</span></span>`
      : `<span class="club-badge"><span class="club-mark-fallback">${club.mark}</span></span>`;
  }

  clubCard(club) {
    const selected = this.favoriteService.has(club.id);
    return `<article class="club-card${selected ? ' selected' : ''}">${this.emblem(club)}<button class="club-copy" type="button" data-open-club="${club.id}"><strong>${club.name}</strong><small>${club.area}・${club.league.toUpperCase()}</small></button><button class="club-favorite" type="button" data-favorite-club="${club.id}" aria-label="${club.name}をお気に入り登録">${selected ? '★' : '☆'}</button></article>`;
  }

  renderLeagueTabs() {
    this.nodes.tabs.innerHTML = this.catalog.leagues
      .map(([id, label]) => `<button class="chip${this.activeLeague === id ? ' active' : ''}" type="button" data-league="${id}">${label}</button>`)
      .join('');
  }

  renderClubs() {
    const visible = this.searchService.search(this.state.query).filter(club => club.league === this.activeLeague);
    this.nodes.count.textContent = `${visible.length}クラブ`;
    this.nodes.grid.innerHTML = visible.map(club => this.clubCard(club)).join('')
      || this.empty('該当するクラブがありません', '検索条件を変えてみてください。');
  }

  renderHomeMatches() {
    const service = this.matchService();
    const finished = service.finished().slice(-3).map(model => model.raw).reverse();
    const upcoming = service.upcoming().slice(0, 5).map(model => model.raw);
    const blocks = [];
    this.nodes.matchCount.textContent = `${finished.length + upcoming.length}試合`;
    if (finished.length) blocks.push(`<div class="j-match-section"><p class="eyebrow">直近結果</p><div class="j-match-cards">${this.matchRenderer.renderMany(finished)}</div></div>`);
    if (upcoming.length) blocks.push(`<div class="j-match-section"><p class="eyebrow">今後の日程</p><div class="j-match-cards">${this.matchRenderer.renderMany(upcoming)}</div></div>`);
    const available = this.leagueAvailability();
    this.nodes.matches.innerHTML = blocks.join('') || this.core.DataEmptyState.render(
      available.matches === false ? `${this.activeLeague.toUpperCase()}の日程取得待ちです` : '表示できる試合がありません',
      available.matches === false ? '公式サイトの次回取得時に自動反映します。' : '次回更新後に自動表示されます。'
    );
  }

  favoriteMatchList() {
    const ids = this.favoriteService.list();
    const favoriteNames = new Set(ids.map(id => this.catalog.find(id)?.name).filter(Boolean).map(FootballTeamMapper.normalizeName));
    return this.leagueMatches().filter(match => [match.home, match.away].some(team => {
      const club = this.findClubByTeam(team);
      return club ? ids.includes(club.id) : this.teamMapper.aliases(team).some(alias => favoriteNames.has(alias));
    }));
  }

  renderFavorites() {
    const ids = this.favoriteService.list();
    const selected = ids.map(id => this.catalog.find(id)).filter(Boolean);
    const future = new this.core.MatchService(this.favoriteMatchList()).upcoming().map(model => model.raw);
    this.nodes.favoriteBadge.textContent = ids.length;
    this.nodes.favoriteCount.textContent = `${ids.length}クラブ`;
    this.nodes.homeFavorite.textContent = `${ids.length}クラブ`;
    this.nodes.favoriteGrid.innerHTML = selected.map(club => this.clubCard(club)).join('')
      || this.favoritesEmpty('お気に入りはまだありません', 'クラブ一覧の☆を押して追加できます。');
    this.nodes.favoriteMatches.innerHTML = this.matchRenderer.renderMany(future.slice(0, 20))
      || this.scheduleEmpty('今後の試合がありません', '次の試合が決まると自動表示されます。');
    this.nodes.favoriteNext.innerHTML = this.matchRenderer.renderMany(future.slice(0, 5))
      || this.scheduleEmpty('お気に入りクラブの次戦がありません', 'お気に入りを登録するか、次回更新をお待ちください。');
  }

  standingRow(row) {
    const played = row.played ?? row.gamesPlayed ?? '-';
    const points = row.points ?? '-';
    const diff = row.goalsDiff ?? row.goalDifference ?? 0;
    const club = this.findClubByTeam(row.team);
    const logo = row.team?.logo || this.teamMapper.getLogo(row.team);
    const badge = logo ? `<img src="${logo}" alt="" loading="lazy" onerror="this.hidden=true">` : '';
    const name = this.displayTeamName(row.team);
    const team = club
      ? `<a class="j-standing-team" href="./jleague-detail.html?club=${encodeURIComponent(club.id)}" aria-label="${club.name}の詳細を見る">${badge}${name}</a>`
      : `<span class="j-standing-team">${badge}${name}</span>`;
    return `<div class="j-standing-row"><strong>${row.provisional ? '-' : row.rank ?? '-'}</strong>${team}<span>${played}</span><b>${points}</b><small>${Number(diff) > 0 ? '+' : ''}${diff}</small></div>`;
  }

  renderStandings() {
    const service = new this.core.StandingService(this.leagueStandings());
    const rows = service.all();
    this.nodes.standings.innerHTML = rows.map(row => this.standingRow(row)).join('')
      || this.core.DataEmptyState.render('順位データがありません', 'シーズン開始後に表示されます。');
    this.nodes.homeStandings.innerHTML = service.top(5).map(row => this.standingRow(row)).join('')
      || this.core.DataEmptyState.render('順位データがありません');
  }

  calendarMatches() {
    const calendar = this.ui.calendars?.jleague;
    return calendar?.favoriteOnly ? this.favoriteMatchList() : this.leagueMatches();
  }

  renderSchedule() {
    const service = new this.core.MatchService(this.calendarMatches());
    const matches = (this.state.selectedDate ? service.byDate(this.state.selectedDate) : service.all()).map(model => model.raw);
    this.nodes.scheduleTitle.textContent = this.state.selectedDate
      ? `${new Date(`${this.state.selectedDate}T00:00:00`).toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' })}の試合`
      : `${this.activeLeague.toUpperCase()} 試合日程`;
    this.nodes.schedule.innerHTML = this.matchRenderer.renderMany(matches)
      || this.scheduleEmpty(this.ui.calendars?.jleague?.favoriteOnly ? 'この日に推しの試合はありません' : 'この日の試合はありません', 'クラブと順位情報は表示できます。');
  }

  calendarFavoriteIds() {
    return this.teamMapper.favoriteTeamIds(this.favoriteService.list());
  }

  syncCalendar() {
    const calendar = this.ui.calendars?.jleague;
    if (!calendar) return;
    calendar.getMatches = () => this.leagueMatches();
    calendar.getFavorites = () => this.calendarFavoriteIds();
    calendar.getTeamVisual = id => ({
      logo: this.teamMapper.getLogo(id),
      label: this.teamMapper.getClub(id)?.mark || '●'
    });
    calendar.clearSelection();
    const first = this.matchService().upcoming()[0];
    if (first) calendar.setCursor(first.date);
    else calendar.render();
  }

  renderAll() {
    this.renderStatus();
    this.renderLeagueTabs();
    this.renderClubs();
    if (this.state.data) {
      this.renderHomeMatches();
      this.renderStandings();
      this.renderSchedule();
      this.syncCalendar();
    }
    this.renderFavorites();
  }

  async loadData() {
    try {
      this.state.data = await this.dataAdapter.load();
      this.teamMapper.setLiveData(this.state.data);
      this.state.metadata = await this.dataAdapter.loadMetadata();
    } catch (error) {
      console.warn('J League data unavailable', error);
      this.state.data = { matches: [], standings: [], teams: [] };
      this.state.metadata = { leaguesAvailability: {}, errors: [String(error?.message || error)] };
    }
    this.renderAll();
  }

  setLeague(league) {
    if (!this.catalog.leagueNames[league]) return;
    this.state.activeLeague = league;
    this.state.selectedDate = '';
    this.renderAll();
  }

  toggleFavorite(id) {
    const club = this.catalog.find(id);
    if (!club) return;
    const added = this.favoriteService.toggle(club.id);
    SportsHub.toast(`${club.name}をお気に入りから${added ? '追加' : '解除'}しました`);
    this.renderAll();
  }

  handleDocumentClick(event) {
    const jump = event.target.closest('[data-page-jump]');
    if (jump) {
      this.pageTabs.show(jump.dataset.pageJump);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const favoriteButton = event.target.closest('[data-favorite-club]');
    if (favoriteButton) {
      this.toggleFavorite(favoriteButton.dataset.favoriteClub);
      return;
    }
    const openButton = event.target.closest('[data-open-club]');
    if (openButton) location.href = `./jleague-detail.html?club=${encodeURIComponent(openButton.dataset.openClub)}`;
  }

  handleLeagueClick(event) {
    const button = event.target.closest('[data-league]');
    if (button) this.setLeague(button.dataset.league);
  }

  handleSearch() {
    this.state.query = this.nodes.search.value;
    this.renderClubs();
  }

  handleCalendarSelect(event) {
    if (event.detail.calendar !== this.ui.calendars?.jleague) return;
    this.state.selectedDate = event.detail.date;
    this.renderSchedule();
  }

  bindEvents() {
    this.pageTabs.bind();
    document.addEventListener('click', this.handleDocumentClick);
    this.nodes.tabs.addEventListener('click', this.handleLeagueClick);
    this.nodes.search.addEventListener('input', this.handleSearch);
    document.addEventListener('sports:calendar-select', this.handleCalendarSelect);
    this.nodes.clearDate.addEventListener('click', () => {
      this.state.selectedDate = '';
      this.ui.calendars?.jleague?.clearSelection();
      this.renderSchedule();
    });
  }

  init() {
    this.bindEvents();
    SportsHub.applyTheme();
    this.pageTabs.show('home');
    this.renderAll();
    void this.loadData();
    return this;
  }
}

window.JLeagueHubController = JLeagueHubController;
window.jLeagueHub = new JLeagueHubController().init();
