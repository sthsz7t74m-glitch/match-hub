window.MLBService = window.MLBService || {};

(function initializeMlbService(namespace) {
  const Data = window.MLBData || {};
  const API_ROOT = 'https://statsapi.mlb.com/api/v1';
  const memoryCache = new Map();
  const DEFAULT_TTL = 15 * 60 * 1000;

  const asArray = value => (Array.isArray(value) ? value : []);
  const currentSeason = () => new Date().getFullYear();
  const dateText = (season, month, day) => `${season}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const createUrl = (path, params = {}) => {
    const url = new URL(`${API_ROOT}${path}`);
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      url.searchParams.set(key, String(value));
    });
    return url;
  };

  const readSessionCache = key => {
    try {
      const raw = sessionStorage.getItem(`mlb-api:${key}`);
      if (!raw) return null;
      const cached = JSON.parse(raw);
      return cached && typeof cached.savedAt === 'number' ? cached : null;
    } catch {
      return null;
    }
  };

  const writeSessionCache = (key, value) => {
    try {
      sessionStorage.setItem(`mlb-api:${key}`, JSON.stringify({ savedAt: Date.now(), value }));
    } catch {
      // Large schedule responses can exceed the browser quota. Memory cache remains available.
    }
  };

  async function request(path, params = {}, options = {}) {
    const { fresh = false, ttl = DEFAULT_TTL, timeout = 18000 } = options;
    const url = createUrl(path, params);
    const key = url.toString();
    const memory = memoryCache.get(key);

    if (!fresh && memory && Date.now() - memory.savedAt < ttl) return memory.value;

    if (!fresh) {
      const stored = readSessionCache(key);
      if (stored && Date.now() - stored.savedAt < ttl) {
        memoryCache.set(key, stored);
        return stored.value;
      }
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        cache: fresh ? 'no-store' : 'default',
        signal: controller.signal
      });

      if (!response.ok) throw new Error(`MLB Stats API HTTP ${response.status}`);
      const value = await response.json();
      const cached = { savedAt: Date.now(), value };
      memoryCache.set(key, cached);
      writeSessionCache(key, value);
      return value;
    } finally {
      clearTimeout(timer);
    }
  }

  const normalizeTeam = team => {
    const id = String(team.id);
    const leagueId = Number(team.league?.id || 0);
    const divisionId = Number(team.division?.id || 0);
    const en = team.name || team.clubName || `Team ${id}`;

    return {
      id,
      name: Data.teamName?.(id, en) || en,
      en,
      abbreviation: team.abbreviation || team.teamCode?.toUpperCase() || '',
      leagueId,
      divisionId,
      league: Data.LEAGUES?.[leagueId] || { id: leagueId, code: '', name: team.league?.name || '' },
      division: Data.DIVISIONS?.[divisionId] || { id: divisionId, leagueId, code: '', name: team.division?.name || '' },
      venue: team.venue?.name || '',
      logo: Data.teamLogo?.(id) || ''
    };
  };

  const normalizeGameTeam = value => {
    const team = value?.team || {};
    const id = String(team.id || '');
    const en = team.name || '';
    return {
      id,
      name: Data.teamName?.(id, en) || en,
      en,
      logo: Data.teamLogo?.(id) || '',
      score: Number.isFinite(value?.score) ? value.score : value?.score ?? null,
      winner: Boolean(value?.isWinner)
    };
  };

  const normalizeGame = game => ({
    id: String(game.gamePk || game.calendarEventID || `${game.gameDate}-${game.gameNumber || 1}`),
    date: game.gameDate,
    gameType: game.gameType || 'R',
    gameTypeName: Data.gameTypeName?.(game.gameType) || 'MLB',
    gameNumber: game.gameNumber || 1,
    doubleHeader: game.doubleHeader || 'N',
    status: game.status?.abstractGameState || '',
    detailedStatus: game.status?.detailedState || '',
    statusCode: game.status?.statusCode || '',
    home: normalizeGameTeam(game.teams?.home),
    away: normalizeGameTeam(game.teams?.away),
    venue: game.venue?.name || '',
    series: game.seriesDescription || game.description || '',
    inning: game.linescore?.currentInning || null,
    inningOrdinal: game.linescore?.currentInningOrdinal || '',
    inningState: game.linescore?.inningState || '',
    probablePitchers: {
      home: game.teams?.home?.probablePitcher?.fullName || '',
      away: game.teams?.away?.probablePitcher?.fullName || ''
    }
  });

  const normalizeStandingRow = row => {
    const id = String(row.team?.id || '');
    const en = row.team?.name || '';
    return {
      rank: Number(row.divisionRank || row.leagueRank || 0),
      team: {
        id,
        name: Data.teamName?.(id, en) || en,
        en,
        logo: Data.teamLogo?.(id) || ''
      },
      gamesPlayed: Number(row.gamesPlayed || 0),
      wins: Number(row.wins || 0),
      losses: Number(row.losses || 0),
      pct: row.winningPercentage || '.000',
      gamesBack: row.gamesBack || '-',
      wildCardGamesBack: row.wildCardGamesBack || '-',
      runDifferential: Number(row.runDifferential || 0),
      streak: row.streak?.streakCode || ''
    };
  };

  const normalizeStandings = payload => asArray(payload.records).map(record => {
    const divisionId = Number(record.division?.id || 0);
    const leagueId = Number(record.league?.id || Data.DIVISIONS?.[divisionId]?.leagueId || 0);
    return {
      divisionId,
      leagueId,
      division: Data.DIVISIONS?.[divisionId] || {
        id: divisionId,
        leagueId,
        code: record.division?.nameShort || record.division?.name || '',
        name: record.division?.name || ''
      },
      league: Data.LEAGUES?.[leagueId] || { id: leagueId, code: '', name: record.league?.name || '' },
      rows: asArray(record.teamRecords)
        .map(normalizeStandingRow)
        .sort((a, b) => a.rank - b.rank || b.pct.localeCompare(a.pct))
    };
  });

  const normalizePlayer = person => {
    const teamId = String(person.currentTeam?.id || '');
    const positionCode = person.primaryPosition?.abbreviation || person.primaryPosition?.code || '';
    return {
      id: String(person.id),
      name: person.fullName || `${person.firstName || ''} ${person.lastName || ''}`.trim(),
      positionCode,
      position: Data.positionName?.(positionCode) || person.primaryPosition?.name || '',
      teamId,
      teamName: Data.teamName?.(teamId, person.currentTeam?.name || '') || person.currentTeam?.name || '所属未取得',
      teamLogo: teamId ? Data.teamLogo?.(teamId) || '' : '',
      headshot: Data.playerHeadshot?.(person.id) || '',
      birthCountry: person.birthCountry || '',
      active: person.active !== false,
      debut: person.mlbDebutDate || ''
    };
  };

  async function loadTeams(options = {}) {
    try {
      const payload = await request('/teams', {
        sportId: 1,
        season: options.season || currentSeason(),
        hydrate: 'venue,league,division'
      }, options);
      const teams = asArray(payload.teams).map(normalizeTeam).filter(team => team.id);
      return teams.length ? teams : [...(Data.FALLBACK_TEAMS || [])];
    } catch (error) {
      console.warn('MLB teams unavailable, using fallback list:', error);
      return [...(Data.FALLBACK_TEAMS || [])];
    }
  }

  async function loadSchedule(options = {}) {
    const season = options.season || currentSeason();
    const payload = await request('/schedule', {
      sportId: 1,
      startDate: dateText(season, 2, 1),
      endDate: dateText(season, 11, 30),
      hydrate: 'linescore,probablePitcher'
    }, { ...options, ttl: options.ttl ?? 10 * 60 * 1000, timeout: options.timeout || 25000 });

    return asArray(payload.dates)
      .flatMap(date => asArray(date.games))
      .map(normalizeGame)
      .filter(game => game.date && game.home.id && game.away.id)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }

  async function loadStandings(options = {}) {
    const season = options.season || currentSeason();
    const payload = await request('/standings', {
      leagueId: '103,104',
      season,
      standingsTypes: 'regularSeason',
      hydrate: 'team,division'
    }, options);
    return normalizeStandings(payload);
  }

  async function loadJapanesePlayers(options = {}) {
    const season = options.season || currentSeason();
    const payload = await request('/sports/1/players', {
      season,
      hydrate: 'currentTeam'
    }, { ...options, ttl: options.ttl ?? 60 * 60 * 1000, timeout: options.timeout || 25000 });

    return asArray(payload.people)
      .filter(person => String(person.birthCountry || '').toLowerCase() === 'japan')
      .map(normalizePlayer)
      .filter(player => player.name)
      .sort((a, b) => a.teamName.localeCompare(b.teamName, 'ja') || a.name.localeCompare(b.name, 'ja'));
  }

  async function loadHub(options = {}) {
    const season = options.season || currentSeason();
    const results = await Promise.allSettled([
      loadTeams({ ...options, season }),
      loadSchedule({ ...options, season }),
      loadStandings({ ...options, season })
    ]);

    const [teamsResult, gamesResult, standingsResult] = results;
    const errors = results
      .filter(result => result.status === 'rejected')
      .map(result => result.reason?.message || String(result.reason));

    return {
      season,
      updatedAt: new Date().toISOString(),
      teams: teamsResult.status === 'fulfilled' ? teamsResult.value : [...(Data.FALLBACK_TEAMS || [])],
      games: gamesResult.status === 'fulfilled' ? gamesResult.value : [],
      standings: standingsResult.status === 'fulfilled' ? standingsResult.value : [],
      errors
    };
  }

  Object.assign(namespace, {
    API_ROOT,
    currentSeason,
    request,
    loadTeams,
    loadSchedule,
    loadStandings,
    loadJapanesePlayers,
    loadHub,
    normalizeTeam,
    normalizeGame,
    normalizeStandings,
    normalizePlayer,
    clearCache() {
      memoryCache.clear();
      try {
        Object.keys(sessionStorage)
          .filter(key => key.startsWith('mlb-api:'))
          .forEach(key => sessionStorage.removeItem(key));
      } catch {
        // Ignore unavailable storage.
      }
    }
  });
})(window.MLBService);