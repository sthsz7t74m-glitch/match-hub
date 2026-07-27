class JLeagueDetailController {
  constructor({ catalog = window.SportsHubJLeague, core = window.SportsCore || window.FootballCore, ui = window.SportsUI || window.FootballUI } = {}) {
    this.catalog = catalog;
    this.core = core;
    this.ui = ui;
    this.params = new URLSearchParams(location.search);
    this.favoriteService = new core.FavoriteService({
      key: 'sportsHubFavoriteJClubs',
      legacyKey: 'sportsHubFavoriteJClub'
    });
    const fallbackClubId = this.favoriteService.list()[0] || 'urawa';
    this.club = catalog.find(this.params.get('club') || fallbackClubId) || catalog.clubs[0];
    this.leagueName = catalog.leagueNames[this.club.league] || this.club.league.toUpperCase();
    this.dataAdapter = new FootballAdapters.JLeagueAdapter();
    this.teamMapper = FootballTeamMapper.create(catalog.createTeamMapperOptions());
    this.eventDialog = SportsHubComponents?.createEventDialog?.({ id: 'jleagueDetailEventDialog' }) || null;
    this.state = {
      data: { matches: [], teams: [], standings: [] },
      metadata: null,
      matches: [],
      standings: [],
      matchIndex: new Map(),
      activeMatchFilter: 'all',
      loaded: false
    };
    this.nodes = this.collectNodes();
    this.matchRenderer = this.createMatchRenderer();
    this.handleMatchFilter = this.handleMatchFilter.bind(this);
    this.handleDocumentClick = this.handleDocumentClick.bind(this);
  }

  collectNodes() {
    const select = selector => document.querySelector(selector);
    return {
      headerName: select('#headerClubName'),
      league: select('#clubLeague'),
      clubName: select('#clubName'),
      english: select('#clubEnglish'),
      area: select('#clubArea'),
      stadium: select('#clubStadium'),
      updated: select('#dataUpdated'),
      emblem: select('#clubEmblem'),
      nextStatus: select('#nextMatchStatus'),
      nextContent: select('#nextMatchContent'),
      rankLabel: select('#rankLabel'),
      rankSummary: select('#rankSummary'),
      rankNote: select('#rankNote'),
      upcomingCount: select('#upcomingCount'),
      finishedCount: select('#finishedCount'),
      formSummary: select('#formSummary'),
      formStrip: select('#formStrip'),
      recentMatches: select('#recentMatchesContent'),
      matchFilters: select('#matchFilters'),
      matchesCount: select('#matchesCount'),
      matchList: select('#matchList'),
      standingsTitle: select('#standingsTitle'),
      standingsDescription: select('#standingsDescription'),
      standingsStatus: select('#standingsStatus'),
      standingsList: select('#standingsList'),
      favoriteButton: select('#favoriteButton')
    };
  }

  get metadata() {
    return this.state.metadata || {};
  }

  escape(value) {
    return SportsHubComponents?.escapeHtml ? SportsHubComponents.escapeHtml(value) : String(value ?? '');
  }

  displayTeamName(team) {
    return this.teamMapper.getName(team);
  }

  findClubByTeam(team) {
    return this.teamMapper.findClubByTeam(team);
  }

  isSelectedTeam(team) {
    const mapped = this.findClubByTeam(team);
    if (mapped) return mapped.id === this.club.id;
    const id = String(team?.id ?? team?.uid ?? team ?? '');
    return id === this.teamMapper.getEspnId(this.club.id) || id === this.club.id;
  }

  involvesSelectedClub(match) {
    return [match?.home, match?.away].some(team => this.isSelectedTeam(team));
  }

  modelFor(match) {
    return new this.core.MatchModel(match);
  }

  statusKind(match) {
    const model = this.modelFor(match);
    if (model.isFinished) return 'finished';
    if (model.isLive) return 'in_play';
    const status = String(match?.status || '').toLowerCase().replace(/[\s-]+/g, '_');
    return ['postponed', 'suspended', 'cancelled'].includes(status) ? status : 'scheduled';
  }

  isFinished(match) {
    return this.modelFor(match).isFinished;
  }

  isLive(match) {
    return this.modelFor(match).isLive;
  }

  isUnavailable(match) {
    return ['postponed', 'suspended', 'cancelled'].includes(this.statusKind(match));
  }

  scoreText(match) {
    return this.isFinished(match) || this.isLive(match)
      ? `${match?.score?.home ?? '-'} - ${match?.score?.away ?? '-'}`
      : 'VS';
  }

  statusText(match) {
    if (this.isLive(match)) return 'LIVE';
    if (this.isFinished(match)) return '試合終了';
    return { postponed: '延期', suspended: '中断', cancelled: '中止' }[this.statusKind(match)] || '試合前';
  }

  formatKickoff(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '日時未定';
    return new Intl.DateTimeFormat('ja-JP', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }

  formatStage(match) {
    if (match?.matchday) return `第${match.matchday}節`;
    return {
      'regular-season': 'リーグ戦',
      championship: '優勝決定戦',
      'placement-playoffs': '順位決定戦',
      '2026-j1-100-year-vision-league': '百年構想リーグ'
    }[match?.stage] || match?.round || '';
  }

  competitionLabel(match) {
    const matchLeague = this.catalog.leagueNames[match?.league] || this.leagueName;
    const competition = String(match?.competition || '');
    if (!competition || /Japanese J\.League/i.test(competition)) return matchLeague;
    return competition;
  }

  teamTarget(team) {
    const mapped = this.findClubByTeam(team);
    const target = {
      id: mapped?.id || team?.id || team?.uid || '',
      name: this.displayTeamName(team),
      logo: team?.logo || this.teamMapper.getLogo(team),
      fallback: mapped?.mark || '●'
    };
    if (mapped) {
      target.href = `./jleague-detail.html?club=${encodeURIComponent(mapped.id)}`;
      target.ariaLabel = `${mapped.name}の詳細を見る`;
    }
    return target;
  }

  matchKey(match, index = 0) {
    return String(match?.id || match?.uid || `${match?.home?.id || 'home'}-${match?.away?.id || 'away'}-${match?.date || index}`);
  }

  indexMatches(matches) {
    this.state.matchIndex = new Map();
    this.state.matches = (Array.isArray(matches) ? matches : []).map((match, index) => {
      const key = this.matchKey(match, index);
      const normalized = { ...match, __detailKey: key };
      this.state.matchIndex.set(key, normalized);
      return normalized;
    });
  }

  createMatchRenderer() {
    return SportsHubComponents.createMatchCardRenderer({
      normalize: match => {
        const model = this.modelFor(match);
        const status = this.statusKind(match);
        const home = this.teamTarget(match.home);
        const away = this.teamTarget(match.away);
        return {
          match: { ...match, status },
          date: model.date,
          timeText: this.isFinished(match) ? '試合終了' : this.isLive(match) ? 'LIVE' : match.timeTbd ? '時間未定' : '',
          scoreText: this.scoreText(match),
          competition: this.competitionLabel(match),
          stage: this.formatStage(match),
          venue: match.venue || '',
          attributes: { 'data-detail-match-key': match.__detailKey },
          center: {
            id: match.__detailKey,
            interactive: true,
            attributes: { 'data-open-jleague-detail-match': match.__detailKey },
            ariaLabel: `${home.name}対${away.name}の試合情報を見る`
          },
          home,
          away
        };
      }
    });
  }

  sortedUpcoming() {
    const threshold = Date.now() - 4 * 60 * 60 * 1000;
    return this.state.matches
      .filter(match => !this.isFinished(match) && !this.isUnavailable(match) && this.modelFor(match).timestamp >= threshold)
      .sort((left, right) => this.modelFor(left).timestamp - this.modelFor(right).timestamp);
  }

  sortedFinished() {
    return this.state.matches
      .filter(match => this.isFinished(match))
      .sort((left, right) => this.modelFor(right).timestamp - this.modelFor(left).timestamp);
  }

  sortedAll() {
    const upcoming = this.sortedUpcoming();
    const upcomingIds = new Set(upcoming.map(match => match.__detailKey));
    const finished = this.sortedFinished();
    const finishedIds = new Set(finished.map(match => match.__detailKey));
    const other = this.state.matches
      .filter(match => !upcomingIds.has(match.__detailKey) && !finishedIds.has(match.__detailKey))
      .sort((left, right) => this.modelFor(right).timestamp - this.modelFor(left).timestamp);
    return [...upcoming, ...other, ...finished];
  }

  selectedStanding() {
    return this.state.standings.find(row => this.isSelectedTeam(row.team)) || null;
  }

  mostCommonHomeVenue() {
    const counts = new Map();
    this.state.matches.forEach(match => {
      if (!this.isSelectedTeam(match.home) || !match.venue) return;
      counts.set(match.venue, (counts.get(match.venue) || 0) + 1);
    });
    return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] || '';
  }

  renderClubProfile() {
    const live = this.teamMapper.findLiveTeam(this.club);
    const providerName = live?.name || live?.displayName || live?.shortName || this.club.en || '';
    const stadium = this.club.stadium || live?.venue || this.mostCommonHomeVenue();
    document.title = `${this.club.name} | Sports Hub`;
    this.nodes.headerName.textContent = this.club.name;
    this.nodes.league.textContent = `${this.leagueName} CLUB`;
    this.nodes.clubName.textContent = this.club.name;
    this.nodes.english.textContent = providerName && providerName !== this.club.name
      ? providerName
      : `${this.club.area}をホームタウンとする${this.leagueName}クラブ`;
    this.nodes.area.textContent = `${this.club.area}・${this.leagueName}`;
    this.nodes.stadium.textContent = stadium ? `🏟 ${stadium}` : '🏟 ホーム会場情報未登録';
    const logo = live?.logo || '';
    this.nodes.emblem.innerHTML = logo
      ? `<img src="${this.escape(logo)}" alt="" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden>${this.escape(this.club.mark)}</span>`
      : `<span>${this.escape(this.club.mark)}</span>`;
    this.syncFavorite();
  }

  renderDataStatus() {
    const badge = this.nodes.updated;
    if (!this.state.loaded) {
      badge.textContent = 'データ読込中';
      badge.className = 'detail-badge is-loading';
      return;
    }
    const updated = new Date(this.metadata.updatedAt || '');
    const availability = this.metadata.leaguesAvailability?.[this.club.league];
    const availabilityLabel = availability?.matches === false ? '順位データ接続' : '試合データ接続';
    badge.textContent = Number.isNaN(updated.getTime())
      ? availabilityLabel
      : `${updated.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}更新・${availabilityLabel}`;
    badge.title = this.metadata.dataSource || 'Jリーグ共通データ';
    badge.className = `detail-badge ${availability?.matches === false ? 'is-limited' : 'is-connected'}`;
  }

  emptyState(icon, title, description) {
    return `<div class="empty-state"><span>${this.escape(icon)}</span><strong>${this.escape(title)}</strong><p>${this.escape(description)}</p></div>`;
  }

  renderOverview() {
    const upcoming = this.sortedUpcoming();
    const finished = this.sortedFinished();
    const next = upcoming[0];
    const standing = this.selectedStanding();
    this.nodes.nextStatus.textContent = !this.state.loaded ? '取得中' : next ? '日程確定' : '次戦未定';
    this.nodes.nextContent.innerHTML = next
      ? this.matchRenderer.render(next)
      : this.emptyState('📅', '今後の試合データはありません', this.metadata.leaguesAvailability?.[this.club.league]?.matches === false
        ? `${this.leagueName}の日程データは現在取得待ちです。`
        : '次の試合が決まると自動表示されます。');
    this.nodes.rankLabel.textContent = `${this.leagueName}順位`;
    this.nodes.rankSummary.textContent = standing && !standing.provisional ? String(standing.rank ?? '—') : '—';
    this.nodes.rankNote.textContent = standing?.provisional ? '開幕前' : standing?.rank ? '位' : 'データ待ち';
    this.nodes.upcomingCount.textContent = String(upcoming.length);
    this.nodes.finishedCount.textContent = String(finished.length);
  }

  matchesForFilter() {
    if (this.state.activeMatchFilter === 'upcoming') return this.sortedUpcoming();
    if (this.state.activeMatchFilter === 'finished') return this.sortedFinished();
    return this.sortedAll();
  }

  renderMatches() {
    const visible = this.matchesForFilter();
    this.nodes.matchesCount.textContent = `${visible.length}試合`;
    this.nodes.matchList.innerHTML = visible.length
      ? this.matchRenderer.renderMany(visible)
      : this.emptyState('⚽', '該当する試合がありません', this.metadata.leaguesAvailability?.[this.club.league]?.matches === false
        ? `${this.leagueName}の日程データは現在取得待ちです。`
        : '別の絞り込みを選択してください。');
    document.querySelectorAll('[data-match-filter]').forEach(button => {
      button.classList.toggle('active', button.dataset.matchFilter === this.state.activeMatchFilter);
    });
  }

  standingRow(row) {
    const mapped = this.findClubByTeam(row.team);
    const selected = mapped?.id === this.club.id || this.isSelectedTeam(row.team);
    const played = row.played ?? row.gamesPlayed ?? '-';
    const points = row.points ?? '-';
    const diff = row.goalsDiff ?? row.goalDifference ?? 0;
    const rank = row.provisional ? '—' : row.rank ?? '—';
    const name = this.displayTeamName(row.team);
    const logo = row.team?.logo || this.teamMapper.getLogo(row.team);
    const fallback = mapped?.mark || '●';
    const badge = logo
      ? `<span class="standing-team__badge"><img src="${this.escape(logo)}" alt="" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><i hidden>${this.escape(fallback)}</i></span>`
      : `<span class="standing-team__badge"><i>${this.escape(fallback)}</i></span>`;
    const teamMarkup = mapped
      ? `<a class="standing-team" href="./jleague-detail.html?club=${encodeURIComponent(mapped.id)}" aria-label="${this.escape(mapped.name)}の詳細を見る">${badge}<strong>${this.escape(name)}</strong></a>`
      : `<span class="standing-team">${badge}<strong>${this.escape(name)}</strong></span>`;
    return `<div class="club-standing-row${selected ? ' is-selected' : ''}"><b class="standing-rank">${this.escape(rank)}</b>${teamMarkup}<span>${this.escape(played)}</span><strong>${this.escape(points)}</strong><small>${Number(diff) > 0 ? '+' : ''}${this.escape(diff)}</small></div>`;
  }

  renderStandings() {
    const rows = new this.core.StandingService(this.state.standings).all();
    const standing = this.selectedStanding();
    this.nodes.standingsTitle.textContent = `${this.leagueName} 順位表`;
    this.nodes.standingsDescription.textContent = standing?.provisional
      ? '開幕前・取得待ちのクラブは暫定表示です'
      : `${this.club.name}を強調して表示`;
    this.nodes.standingsStatus.textContent = rows.length ? `${rows.length}クラブ` : 'データ待ち';
    this.nodes.standingsList.innerHTML = rows.length
      ? rows.map(row => this.standingRow(row)).join('')
      : this.emptyState('📊', '順位データがありません', '順位データが更新されると自動表示されます。');
  }

  resultFor(match) {
    if (!this.isFinished(match)) return '';
    const home = this.isSelectedTeam(match.home);
    const own = Number(home ? match?.score?.home : match?.score?.away);
    const opponent = Number(home ? match?.score?.away : match?.score?.home);
    if (!Number.isFinite(own) || !Number.isFinite(opponent)) return '';
    return own > opponent ? 'win' : own < opponent ? 'loss' : 'draw';
  }

  renderForm() {
    const recent = this.sortedFinished().slice(0, 5);
    const results = recent.map(match => this.resultFor(match)).filter(Boolean);
    const wins = results.filter(result => result === 'win').length;
    const draws = results.filter(result => result === 'draw').length;
    const losses = results.filter(result => result === 'loss').length;
    this.nodes.formSummary.textContent = recent.length ? `${wins}勝${draws}分${losses}敗` : 'データ待ち';
    this.nodes.formStrip.innerHTML = results.map(result => `<span class="form-result is-${result}">${result === 'win' ? '勝' : result === 'draw' ? '分' : '敗'}</span>`).join('');
    this.nodes.recentMatches.innerHTML = recent.length
      ? this.matchRenderer.renderMany(recent.slice(0, 3))
      : this.emptyState('📊', '終了済み試合がありません', '試合終了後に自動集計します。');
  }

  renderAll() {
    this.renderClubProfile();
    this.renderDataStatus();
    this.renderOverview();
    this.renderMatches();
    this.renderStandings();
    this.renderForm();
  }

  syncFavorite() {
    const active = this.favoriteService.has(this.club.id);
    this.nodes.favoriteButton.classList.toggle('is-favorite', active);
    this.nodes.favoriteButton.textContent = active ? '★ お気に入り登録中' : '☆ お気に入りに登録';
  }

  toggleFavorite() {
    const added = this.favoriteService.toggle(this.club.id);
    SportsHub.toast(`${this.club.name}をお気に入りから${added ? '追加' : '解除'}しました`);
    this.syncFavorite();
  }

  openMatchDialog(key) {
    const match = this.state.matchIndex.get(String(key));
    if (!match || !this.eventDialog) return;
    const home = this.teamTarget(match.home);
    const away = this.teamTarget(match.away);
    this.eventDialog.open({
      eyebrow: 'J LEAGUE MATCH',
      title: [this.competitionLabel(match), this.formatStage(match)].filter(Boolean).join('・') || 'Jリーグ',
      dateText: this.formatKickoff(this.modelFor(match).date),
      leftTeam: home,
      rightTeam: away,
      scoreText: this.scoreText(match),
      statusText: this.statusText(match),
      facts: [
        ['ステージ', this.formatStage(match) || '—'],
        ['会場', match.venue || '未定'],
        ['ホーム', home.name],
        ['アウェイ', away.name]
      ],
      note: this.isFinished(match) || this.isLive(match)
        ? 'スコアはJリーグ共通データに保存された結果を表示しています。'
        : '試合前のためスコアは未確定です。日程と対戦情報を表示しています。'
    });
  }

  async loadData() {
    try {
      this.state.data = await this.dataAdapter.load();
      this.teamMapper.setLiveData(this.state.data);
      this.state.metadata = await this.dataAdapter.loadMetadata();
      this.indexMatches((this.state.data.matches || []).filter(match => this.involvesSelectedClub(match)));
      this.state.standings = (this.state.data.standings || []).filter(row => (row.league || 'j1') === this.club.league);
    } catch (error) {
      console.warn('J League detail data unavailable:', error);
      this.state.data = { matches: [], teams: [], standings: [] };
      this.state.metadata = { leaguesAvailability: {}, errors: [String(error?.message || error)] };
      this.indexMatches([]);
      this.state.standings = [];
    }
    this.state.loaded = true;
    this.renderAll();
  }

  handleMatchFilter(event) {
    const button = event.target.closest('[data-match-filter]');
    if (!button) return;
    this.state.activeMatchFilter = button.dataset.matchFilter;
    this.renderMatches();
  }

  handleDocumentClick(event) {
    const matchButton = event.target.closest('[data-open-jleague-detail-match]');
    if (!matchButton) return;
    event.preventDefault();
    event.stopPropagation();
    this.openMatchDialog(matchButton.dataset.openJleagueDetailMatch);
  }

  bindEvents() {
    this.nodes.matchFilters.addEventListener('click', this.handleMatchFilter);
    document.addEventListener('click', this.handleDocumentClick);
    this.nodes.favoriteButton.addEventListener('click', () => this.toggleFavorite());
  }

  init() {
    this.detailShell = this.ui.createDetailShell({
      initialTab: 'overview',
      onTabChange: () => window.scrollTo({ top: 0, behavior: 'smooth' })
    }).render();
    this.bindEvents();
    SportsHub.applyTheme();
    this.renderAll();
    void this.loadData();
    return this;
  }
}

window.JLeagueDetailController = JLeagueDetailController;
window.jLeagueDetail = new JLeagueDetailController().init();
