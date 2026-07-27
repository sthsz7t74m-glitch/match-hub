window.MLBView = window.MLBView || {};

(function initializeMlbCardView(namespace) {
  const BaseView = namespace.MLBHubView;
  const Components = window.SportsHubComponents;
  const Domain = window.MLBDomain;

  if (!BaseView || !Components?.createBaseballGameCardRenderer || !Domain) {
    throw new Error('Shared baseball card dependencies are unavailable');
  }

  class MLBHubCardView extends BaseView {
    constructor(options) {
      super(options);
      this.baseballCardRenderer = Components.createBaseballGameCardRenderer({
        normalize: (game, context = {}) => this.baseballCardOptions(
          game,
          context.favorites || this.favoriteSet()
        )
      });
    }

    teamInteraction(team = {}) {
      if (team.id === undefined || team.id === null) return {};
      return {
        id: String(team.id),
        attributes: { 'data-open-mlb-team': String(team.id) },
        ariaLabel: `${team.name || team.en || '球団'}の詳細を見る`
      };
    }

    baseballCardOptions(game, favorites = this.favoriteSet()) {
      const home = game.home || {};
      const away = game.away || {};
      const final = Domain.isFinal(game);
      const live = Domain.isLive(game);
      const favorite = Domain.involvesFavorite(game, favorites);
      const showScore = final || live || home.score !== null || away.score !== null;
      const probable = [
        game.probablePitchers?.away ? `A: ${game.probablePitchers.away}` : '',
        game.probablePitchers?.home ? `H: ${game.probablePitchers.home}` : ''
      ].filter(Boolean).join(' / ');
      const unavailable = /postponed|cancelled|suspended/i.test(game.detailedStatus || '');

      return {
        game,
        live,
        final,
        favorite,
        unavailable,
        dateText: this.formatDate(game.date),
        competition: game.gameTypeName || 'MLB',
        gameNumber: game.gameNumber,
        scoreText: showScore ? `${away.score ?? '-'} - ${home.score ?? '-'}` : 'VS',
        statusText: this.statusText(game),
        away: {
          ...away,
          ...this.teamInteraction(away),
          subtitle: away.en || '',
          fallback: away.abbreviation || 'A'
        },
        home: {
          ...home,
          ...this.teamInteraction(home),
          subtitle: home.en || '',
          fallback: home.abbreviation || 'H'
        },
        venue: game.venue ? `🏟 ${game.venue}` : game.series || 'MLB',
        detail: probable
          ? `予告先発 ${probable}`
          : game.venue ? game.series || '' : '',
        attributes: {
          'data-game-id': game.id
        }
      };
    }

    gameCard(game, favorites = this.favoriteSet()) {
      return this.baseballCardRenderer.render(game, { favorites });
    }
  }

  Object.assign(namespace, {
    MLBHubViewBase: BaseView,
    MLBHubCardView,
    MLBHubView: MLBHubCardView
  });
})(window.MLBView);
