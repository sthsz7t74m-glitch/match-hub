window.MLBView = window.MLBView || {};

(function initializeMlbView(namespace) {
  const Core = window.FootballCore;
  const Domain = window.MLBDomain;

  const TEAM_FILTERS = Object.freeze([
    ['all', 'すべて'],
    ['103', 'ア・リーグ'],
    ['104', 'ナ・リーグ'],
    ['favorites', '推しのみ']
  ]);

  const STANDING_FILTERS = Object.freeze([
    ['all', 'すべて'],
    ['103', 'ア・リーグ'],
    ['104', 'ナ・リーグ']
  ]);

  const escapeHtml = value => Core.escapeHtml(value);
  const empty = (title, description = '') => Core.EmptyState.render(title, description);

  class MLBHubView {
    constructor({ state, nodes, favoriteService, getCalendar, now = () => Date.now() }) {
      this.state = state;
      this.nodes = nodes;
      this.favoriteService = favoriteService;
      this.getCalendar = getCalendar;
      this.now = now;
    }

    get calendar() {
      return this.getCalendar?.() || null;
    }

    favoriteIds() {
      return this.favoriteService.list();
    }

    favoriteSet() {
      return Domain.favoriteSet(this.favoriteIds());
    }

    isFavorite(id) {
      return this.favoriteService.has(String(id));
    }

    teamById(id) {
      return this.state.teams.find(team => String(team.id) === String(id));
    }

    favoriteTeams(ids = this.favoriteIds()) {
      return ids.map(id => this.teamById(id)).filter(Boolean);
    }

    logoMarkup(team, className = '') {
      const abbreviation = escapeHtml(team?.abbreviation || team?.name?.slice(0, 2) || 'MLB');
      const fallback = `<span class="mlb-team-logo-fallback">${abbreviation}</span>`;
      if (!team?.logo) return fallback;

      return `<img class="${className}" src="${escapeHtml(team.logo)}" alt="" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span class="mlb-team-logo-fallback" hidden>${abbreviation}</span>`;
    }

    formatDate(value) {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return '日時未定';

      const dateText = date.toLocaleDateString('ja-JP', {
        month: 'numeric',
        day: 'numeric',
        weekday: 'short'
      });
      const timeText = date.toLocaleTimeString('ja-JP', {
        hour: '2-digit',
        minute: '2-digit'
      });

      return `${dateText} ${timeText}`;
    }

    liveStatus(game) {
      const inningNumber = game.inningOrdinal || (game.inning ? `${game.inning}回` : '');
      const side = {
        Top: '表',
        Bottom: '裏',
        Middle: '回間',
        End: '終了'
      }[game.inningState] || game.inningState || '';

      return [inningNumber, side].filter(Boolean).join(' ') || game.detailedStatus || 'LIVE';
    }

    statusText(game) {
      if (Domain.isLive(game)) return this.liveStatus(game);
      if (Domain.isFinal(game)) return '試合終了';
      if (/postponed/i.test(game.detailedStatus || '')) return '延期';
      if (/cancelled/i.test(game.detailedStatus || '')) return '中止';
      return game.detailedStatus || '試合前';
    }

    gameCard(game, favorites = this.favoriteSet()) {
      const home = game.home || {};
      const away = game.away || {};
      const final = Domain.isFinal(game);
      const live = Domain.isLive(game);
      const favorite = Domain.involvesFavorite(game, favorites);
      const showScore = final || live || home.score !== null || away.score !== null;
      const score = showScore ? `${away.score ?? '-'} - ${home.score ?? '-'}` : 'VS';
      const probable = [
        game.probablePitchers?.away ? `A: ${game.probablePitchers.away}` : '',
        game.probablePitchers?.home ? `H: ${game.probablePitchers.home}` : ''
      ].filter(Boolean).join(' / ');
      const classes = [
        'mlb-game-card',
        live && 'is-live',
        final && 'is-final',
        favorite && 'is-favorite'
      ].filter(Boolean).join(' ');

      return `<article class="${classes}" data-game-id="${escapeHtml(game.id)}">
        <div class="mlb-game-meta">
          <span>${escapeHtml(this.formatDate(game.date))}</span>
          <span class="mlb-game-meta__right">
            ${favorite ? '<b class="mlb-favorite-game-badge">推し</b>' : ''}
            <span>${escapeHtml(game.gameTypeName || 'MLB')}${game.gameNumber > 1 ? `・第${game.gameNumber}試合` : ''}</span>
          </span>
        </div>
        <div class="mlb-matchup">
          <div class="mlb-game-team is-away">
            <div><strong>${escapeHtml(away.name || '未定')}</strong><small>${escapeHtml(away.en || '')}</small></div>
            ${this.logoMarkup(away)}
          </div>
          <div class="mlb-score"><strong>${escapeHtml(score)}</strong><small>${escapeHtml(this.statusText(game))}</small></div>
          <div class="mlb-game-team is-home">
            ${this.logoMarkup(home)}
            <div><strong>${escapeHtml(home.name || '未定')}</strong><small>${escapeHtml(home.en || '')}</small></div>
          </div>
        </div>
        <div class="mlb-game-footer">
          <span>${game.venue ? `🏟 ${escapeHtml(game.venue)}` : escapeHtml(game.series || 'MLB')}</span>
          <span>${probable ? `予告先発 ${escapeHtml(probable)}` : escapeHtml(game.series || '')}</span>
        </div>
      </article>`;
    }

    renderGameList(root, games, options = {}) {
      if (!root) return;

      const {
        emptyTitle = '表示できる試合がありません',
        emptyDescription = '',
        prioritizeFavorites = false,
        limit = null
      } = options;
      const favorites = this.favoriteSet();
      let visible = [...games];

      if (prioritizeFavorites) visible = Domain.prioritizeFavorites(visible, favorites);
      if (typeof limit === 'number') visible = visible.slice(0, limit);

      root.innerHTML = visible.length
        ? visible.map(game => this.gameCard(game, favorites)).join('')
        : empty(emptyTitle, emptyDescription);
    }

    renderToday() {
      const games = Domain.todayGames(this.state.games);
      const favorites = this.favoriteSet();
      const favoriteCount = games.filter(game => Domain.involvesFavorite(game, favorites)).length;

      if (this.nodes.todayCount) {
        this.nodes.todayCount.textContent = favoriteCount
          ? `${games.length}試合・推し${favoriteCount}`
          : `${games.length}試合`;
      }

      this.renderGameList(this.nodes.todayGames, games, {
        prioritizeFavorites: true,
        emptyTitle: '今日の試合はありません',
        emptyDescription: '日程がある日は自動で表示されます。'
      });
    }

    renderFavorites() {
      const ids = this.favoriteIds();
      const teams = this.favoriteTeams(ids);
      const upcoming = Domain.upcomingFavoriteGames(this.state.games, ids, this.now());
      const hasTeams = teams.length > 0;

      if (this.nodes.homeFavoriteStatus) this.nodes.homeFavoriteStatus.textContent = `${teams.length}球団`;
      if (this.nodes.favoriteBadge) this.nodes.favoriteBadge.textContent = teams.length;
      if (this.nodes.favoriteTeamCount) this.nodes.favoriteTeamCount.textContent = `${teams.length}球団`;

      this.renderGameList(this.nodes.favoriteNextGames, upcoming, {
        limit: 5,
        emptyTitle: hasTeams ? '推し球団の次戦はありません' : '推し球団が未登録です',
        emptyDescription: hasTeams ? '次の試合が決まると自動表示されます。' : '球団一覧の☆から登録できます。'
      });

      this.renderGameList(this.nodes.favoriteGames, upcoming, {
        limit: 30,
        emptyTitle: hasTeams ? '今後の試合はありません' : '推し球団がありません',
        emptyDescription: hasTeams ? '次の試合が決まると自動表示されます。' : '球団一覧から複数登録できます。'
      });

      if (this.nodes.favoriteTeamGrid) {
        this.nodes.favoriteTeamGrid.innerHTML = hasTeams
          ? teams.map(team => this.teamCard(team)).join('')
          : empty('推し球団がありません', '球団一覧から複数登録できます。');
      }
    }

    renderSummary() {
      const cards = [
        ['シーズン', this.state.season, '年度'],
        ['登録球団', this.state.teams.length, '球団'],
        ['LIVE', this.state.games.filter(Domain.isLive).length, '試合'],
        ['終了', this.state.games.filter(Domain.isFinal).length, '試合'],
        ['今後', this.state.games.filter(game => Domain.isUpcoming(game, this.now())).length, '試合'],
        ['推し', this.favoriteIds().length, '球団']
      ];

      if (this.nodes.summary) {
        this.nodes.summary.innerHTML = cards
          .map(([label, value, suffix]) => `<article class="mlb-summary-card"><span>${label}</span><strong>${value}</strong><small>${suffix}</small></article>`)
          .join('');
      }
    }

    standingSection(group, options = {}) {
      const { limit = null, compact = false, favorites = this.favoriteSet() } = options;
      const rows = typeof limit === 'number' ? (group.rows || []).slice(0, limit) : (group.rows || []);
      const body = rows.map(row => `<div class="mlb-standing-row${favorites.has(String(row.team?.id)) ? ' is-favorite' : ''}">
        <strong>${row.rank || '-'}</strong>
        <span class="mlb-standing-team">${this.logoMarkup(row.team || {})}<span>${escapeHtml(row.team?.name || '未定')}</span></span>
        <span>${row.wins ?? '-'}</span><span>${row.losses ?? '-'}</span><span>${escapeHtml(row.pct ?? '-')}</span><span>${escapeHtml(row.gamesBack ?? '-')}</span>
      </div>`).join('');

      return `<section class="mlb-standing-section${compact ? ' is-compact' : ''}">
        <div class="mlb-standing-title"><h3>${escapeHtml(group.division?.name || '地区')}</h3><span>${escapeHtml(group.league?.code || '')}</span></div>
        <div class="mlb-standing-head"><span>順</span><span>球団</span><span>勝</span><span>敗</span><span>率</span><span>差</span></div>
        ${body || empty('順位データがありません')}
      </section>`;
    }

    renderStandings() {
      if (this.nodes.standingFilters) {
        this.nodes.standingFilters.innerHTML = STANDING_FILTERS
          .map(([id, label]) => `<button class="mlb-filter-button${this.state.standingFilter === id ? ' active' : ''}" type="button" data-standing-filter="${id}">${label}</button>`)
          .join('');
      }

      const favorites = this.favoriteSet();
      const groups = this.state.standings.filter(group =>
        this.state.standingFilter === 'all' || String(group.leagueId) === this.state.standingFilter
      );

      if (this.nodes.standings) {
        this.nodes.standings.innerHTML = groups.length
          ? groups.map(group => this.standingSection(group, { favorites })).join('')
          : empty('順位データを取得できません', 'シーズン開始後に表示されます。');
      }

      if (this.nodes.homeStandings) {
        this.nodes.homeStandings.innerHTML = this.state.standings.length
          ? this.state.standings.map(group => this.standingSection(group, {
            limit: 1,
            compact: true,
            favorites
          })).join('')
          : empty('順位データを準備中です');
      }
    }

    renderTeamFilters() {
      if (!this.nodes.teamFilters) return;
      this.nodes.teamFilters.innerHTML = TEAM_FILTERS
        .map(([id, label]) => `<button class="mlb-filter-button${this.state.teamFilter === id ? ' active' : ''}" type="button" data-team-filter="${id}">${label}</button>`)
        .join('');
    }

    teamCard(team) {
      const favorite = this.isFavorite(team.id);
      return `<article class="mlb-team-card${favorite ? ' is-favorite' : ''}" data-team-card="${escapeHtml(team.id)}">
        <div class="mlb-team-logo-wrap">${this.logoMarkup(team, 'mlb-team-logo')}</div>
        <div class="mlb-team-copy"><strong>${escapeHtml(team.name)}</strong><small>${escapeHtml(team.en)}・${escapeHtml(team.division?.code || '')}</small></div>
        <button class="mlb-favorite-button${favorite ? ' is-active' : ''}" type="button" data-favorite-team="${escapeHtml(team.id)}" aria-label="${escapeHtml(team.name)}を推し球団に登録">${favorite ? '★' : '☆'}</button>
      </article>`;
    }

    visibleTeams() {
      const query = this.state.teamQuery.trim().toLocaleLowerCase('ja');
      const favorites = this.favoriteSet();

      return this.state.teams.filter(team => {
        const filterMatch = this.state.teamFilter === 'all'
          || this.state.teamFilter === 'favorites' && favorites.has(String(team.id))
          || String(team.leagueId) === this.state.teamFilter;

        if (!filterMatch) return false;
        if (!query) return true;

        return [team.name, team.en, team.abbreviation]
          .filter(Boolean)
          .some(value => String(value).toLocaleLowerCase('ja').includes(query));
      });
    }

    renderTeams() {
      this.renderTeamFilters();
      const teams = this.visibleTeams();

      if (this.nodes.teamCount) this.nodes.teamCount.textContent = `${teams.length}球団`;
      if (this.nodes.teamGrid) {
        this.nodes.teamGrid.innerHTML = teams.length
          ? teams.map(team => this.teamCard(team)).join('')
          : empty('該当する球団がありません', '検索条件を変更してください。');
      }
    }

    playerCard(player) {
      const initial = escapeHtml(player.name?.slice(0, 1) || '日');
      const photo = player.headshot
        ? `<img src="${escapeHtml(player.headshot)}" alt="" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span class="mlb-player-fallback" hidden>${initial}</span>`
        : `<span class="mlb-player-fallback">${initial}</span>`;
      const teamLogo = player.teamLogo ? `<img src="${escapeHtml(player.teamLogo)}" alt="">` : '';

      return `<article class="mlb-player-card">
        <div class="mlb-player-photo">${photo}</div>
        <div class="mlb-player-copy"><strong>${escapeHtml(player.name)}</strong><span>${escapeHtml(player.position)}</span><small class="mlb-player-team">${teamLogo}${escapeHtml(player.teamName)}</small></div>
      </article>`;
    }

    renderPlayers() {
      if (this.state.playersLoading) {
        if (this.nodes.playerStatus) this.nodes.playerStatus.textContent = '取得中';
        if (this.nodes.players) this.nodes.players.innerHTML = '<div class="mlb-loading">日本人選手データを取得しています。</div>';
        return;
      }

      if (!this.state.players) return;

      if (this.nodes.playerStatus) this.nodes.playerStatus.textContent = `${this.state.players.length}選手`;
      if (this.nodes.players) {
        this.nodes.players.innerHTML = this.state.players.length
          ? this.state.players.map(player => this.playerCard(player)).join('')
          : empty('日本人選手を取得できませんでした', 'MLBの登録情報が更新されると自動反映されます。');
      }
    }

    renderSchedule() {
      const calendar = this.calendar;
      if (!calendar) return;

      const visible = this.state.selectedDate
        ? calendar.matchesOnDate(this.state.selectedDate)
        : calendar.getVisibleMatches(this.state.games)
          .filter(game => Domain.gameTime(game) >= this.now() - 12 * 60 * 60 * 1000)
          .slice(0, 40);

      if (this.nodes.scheduleTitle) {
        this.nodes.scheduleTitle.textContent = this.state.selectedDate
          ? `${Number(this.state.selectedDate.slice(5, 7))}月${Number(this.state.selectedDate.slice(8, 10))}日の試合`
          : calendar.favoriteOnly ? '推し球団の今後の日程' : '今後の試合日程';
      }

      this.renderGameList(this.nodes.scheduleGames, visible, {
        emptyTitle: calendar.favoriteOnly ? '推し球団の試合がありません' : '表示できる試合がありません',
        emptyDescription: calendar.favoriteOnly
          ? '推しのみをOFFにするか、球団を登録してください。'
          : '別の日付を選択してください。'
      });
    }

    renderHome() {
      this.renderFavorites();
      this.renderToday();
      this.renderSummary();
    }

    renderAll() {
      this.renderHome();
      this.renderStandings();
      this.renderTeams();
      this.renderPlayers();
      this.calendar?.render();
      this.renderSchedule();
    }

    renderFavoriteDependentViews() {
      this.renderFavorites();
      this.renderToday();
      this.renderSummary();
      this.renderStandings();
      this.renderTeams();
      this.calendar?.render();
      this.renderSchedule();
    }
  }

  Object.assign(namespace, {
    TEAM_FILTERS,
    STANDING_FILTERS,
    MLBHubView
  });
})(window.MLBView);
