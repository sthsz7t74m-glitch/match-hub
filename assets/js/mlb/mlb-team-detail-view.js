window.MLBView = window.MLBView || {};

(function initializeMlbTeamDetailView(namespace) {
  const BaseView = namespace.MLBHubView;
  const Core = window.SportsCore || window.FootballCore;
  const Domain = window.MLBDomain;

  if (!BaseView || !Core || !Domain) {
    throw new Error('MLB team detail dependencies are unavailable');
  }

  const escapeHtml = value => Core.escapeHtml(value);

  class MLBTeamDetailView extends BaseView {
    teamCard(team) {
      const favorite = this.isFavorite(team.id);
      const teamId = escapeHtml(team.id);
      const teamName = escapeHtml(team.name || '球団');
      return `<article class="mlb-team-card${favorite ? ' is-favorite' : ''}" data-team-card="${teamId}">
        <button class="mlb-team-open" type="button" data-open-mlb-team="${teamId}" aria-label="${teamName}の詳細を見る">
          <span class="mlb-team-logo-wrap">${this.logoMarkup(team, 'mlb-team-logo')}</span>
          <span class="mlb-team-copy"><strong>${teamName}</strong><small>${escapeHtml(team.en)}・${escapeHtml(team.division?.code || '')}</small></span>
        </button>
        <button class="mlb-favorite-button${favorite ? ' is-active' : ''}" type="button" data-favorite-team="${teamId}" aria-label="${teamName}を推し球団に登録">${favorite ? '★' : '☆'}</button>
      </article>`;
    }

    standingForTeam(id) {
      for (const group of this.state.standings || []) {
        const row = (group.rows || []).find(item => String(item.team?.id) === String(id));
        if (row) return { group, row };
      }
      return { group: null, row: null };
    }

    gamesForTeam(id) {
      return (this.state.games || []).filter(game =>
        String(game.home?.id) === String(id) || String(game.away?.id) === String(id)
      );
    }

    teamDetailMarkup(team) {
      const { group, row } = this.standingForTeam(team.id);
      const games = this.gamesForTeam(team.id);
      const upcoming = games
        .filter(game => Domain.isUpcoming(game, this.now()))
        .sort((left, right) => Domain.gameTime(left) - Domain.gameTime(right))
        .slice(0, 5);
      const recent = games
        .filter(Domain.isFinal)
        .sort((left, right) => Domain.gameTime(right) - Domain.gameTime(left))
        .slice(0, 5);
      const record = row ? `${row.wins ?? '-'}勝 ${row.losses ?? '-'}敗` : '順位データ待ち';
      const rank = row?.rank ? `${row.rank}位` : '-';
      const pct = row?.pct || '-';
      const gamesBack = row?.gamesBack ?? '-';
      const leagueName = team.league?.name || group?.league?.name || '';
      const divisionName = team.division?.name || group?.division?.name || '';

      return `<section class="mlb-team-detail">
        <header class="mlb-team-detail__header">
          <span class="mlb-team-detail__logo">${this.logoMarkup(team, 'mlb-team-logo')}</span>
          <span class="mlb-team-detail__copy">
            <p class="eyebrow">TEAM DETAIL</p>
            <h2>${escapeHtml(team.name || '球団')}</h2>
            <span>${escapeHtml(team.en || '')}</span>
            <small>${escapeHtml([leagueName, divisionName].filter(Boolean).join('・'))}</small>
          </span>
        </header>
        <div class="mlb-team-detail__stats">
          <article><span>地区順位</span><strong>${escapeHtml(rank)}</strong></article>
          <article><span>勝敗</span><strong>${escapeHtml(record)}</strong></article>
          <article><span>勝率</span><strong>${escapeHtml(pct)}</strong></article>
          <article><span>ゲーム差</span><strong>${escapeHtml(gamesBack)}</strong></article>
        </div>
        ${team.venue ? `<p class="mlb-team-detail__venue">🏟 ${escapeHtml(team.venue)}</p>` : ''}
        <section class="mlb-team-detail__section">
          <div class="section-heading compact"><div><p class="eyebrow">UPCOMING</p><h3>今後の試合</h3></div><span class="status">${upcoming.length}試合</span></div>
          <div class="mlb-game-list">${upcoming.length ? upcoming.map(game => this.gameCard(game)).join('') : Core.SportsScheduleEmptyState.render({ title: '今後の試合はありません', description: '日程が決まると自動表示されます。' })}</div>
        </section>
        <section class="mlb-team-detail__section">
          <div class="section-heading compact"><div><p class="eyebrow">RECENT</p><h3>直近の結果</h3></div><span class="status">${recent.length}試合</span></div>
          <div class="mlb-game-list">${recent.length ? recent.map(game => this.gameCard(game)).join('') : Core.SportsDataEmptyState.render({ title: '試合結果がありません', description: '試合終了後に表示されます。' })}</div>
        </section>
      </section>`;
    }

    openTeamDetail(id) {
      const team = this.teamById(id);
      const dialog = this.nodes.teamDialog;
      const body = this.nodes.teamDialogBody;
      if (!team || !dialog || !body) return false;

      body.innerHTML = this.teamDetailMarkup(team);
      if (dialog.open) dialog.close();
      dialog.showModal();
      return true;
    }

    closeTeamDetail() {
      if (this.nodes.teamDialog?.open) this.nodes.teamDialog.close();
    }
  }

  Object.assign(namespace, {
    MLBHubViewBaseWithCards: BaseView,
    MLBTeamDetailView,
    MLBHubView: MLBTeamDetailView
  });
})(window.MLBView);
