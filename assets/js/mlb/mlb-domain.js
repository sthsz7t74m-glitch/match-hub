window.MLBDomain = window.MLBDomain || {};

(function initializeMlbDomain(namespace) {
  const FOUR_HOURS = 4 * 60 * 60 * 1000;
  const pad = value => String(value).padStart(2, '0');
  const asArray = value => (Array.isArray(value) ? value : []);

  const teamId = team => String(team?.id ?? team?.uid ?? team ?? '');

  const gameTime = game => {
    const value = new Date(game?.date ?? game?.startTime ?? game?.gameDate ?? '').getTime();
    return Number.isNaN(value) ? 0 : value;
  };

  const dayKey = value => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  };

  const normalizedStatus = game => String(game?.status ?? '').toLowerCase();
  const normalizedStatusCode = game => String(game?.statusCode ?? '').toUpperCase();

  const isFinal = game =>
    ['final', 'finished', 'full_time', 'ft'].includes(normalizedStatus(game))
    || ['F', 'O'].includes(normalizedStatusCode(game));

  const isLive = game =>
    ['live', 'in_play', 'paused', 'halftime'].includes(normalizedStatus(game))
    || ['I', 'M'].includes(normalizedStatusCode(game));

  const isUpcoming = (game, now = Date.now(), graceMs = FOUR_HOURS) =>
    !isFinal(game) && gameTime(game) >= now - graceMs;

  const favoriteSet = ids => new Set(asArray(ids).map(String).filter(Boolean));

  const involvesFavorite = (game, favorites) => {
    const ids = favorites instanceof Set ? favorites : favoriteSet(favorites);
    return ids.has(teamId(game?.home)) || ids.has(teamId(game?.away));
  };

  const favoriteGames = (games, favorites) => {
    const ids = favorites instanceof Set ? favorites : favoriteSet(favorites);
    return asArray(games).filter(game => involvesFavorite(game, ids));
  };

  const gamesOnDate = (games, date) =>
    asArray(games).filter(game => dayKey(game?.date) === date);

  const todayGames = (games, today = new Date()) =>
    gamesOnDate(games, dayKey(today));

  const compareChronologically = (left, right) => gameTime(left) - gameTime(right);

  const statusPriority = game => {
    if (isLive(game)) return 0;
    if (!isFinal(game)) return 1;
    return 2;
  };

  const prioritizeFavorites = (games, favorites) => {
    const ids = favorites instanceof Set ? favorites : favoriteSet(favorites);
    return [...asArray(games)].sort((left, right) => {
      const favoriteDifference = Number(!involvesFavorite(left, ids)) - Number(!involvesFavorite(right, ids));
      if (favoriteDifference) return favoriteDifference;

      const statusDifference = statusPriority(left) - statusPriority(right);
      if (statusDifference) return statusDifference;

      return compareChronologically(left, right);
    });
  };

  const upcomingFavoriteGames = (games, favorites, now = Date.now()) =>
    favoriteGames(games, favorites)
      .filter(game => isUpcoming(game, now))
      .sort(compareChronologically);

  Object.assign(namespace, {
    FOUR_HOURS,
    asArray,
    teamId,
    gameTime,
    dayKey,
    isFinal,
    isLive,
    isUpcoming,
    favoriteSet,
    involvesFavorite,
    favoriteGames,
    gamesOnDate,
    todayGames,
    compareChronologically,
    prioritizeFavorites,
    upcomingFavoriteGames
  });
})(window.MLBDomain);
