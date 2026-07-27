window.MLBService = window.MLBService || {};

(function initializeMlbService(namespace) {
  const Data = window.MLBData || {};
  const API_ROOT = 'https://statsapi.mlb.com/api/v1';
  const DEFAULT_TTL = 15 * 60 * 1000;
  const DEFAULT_RETRIES = 0;
  const memoryCache = new Map();
  const pendingRequests = new Map();

  const asArray = value => (Array.isArray(value) ? value : []);
  const currentSeason = () => new Date().getFullYear();
  const pad = value => String(value).padStart(2, '0');
  const dateText = (season, month, day) => `${season}-${pad(month)}-${pad(day)}`;
  const dateTextFromDate = value => {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  };
  const addDays = (value, days) => {
    const date = value instanceof Date ? new Date(value) : new Date(value);
    date.setDate(date.getDate() + Number(days || 0));
    return date;
  };
  const wait = delay => new Promise(resolve => setTimeout(resolve, delay));

  const createUrl = (path, params = {}) => {
    const url = new URL(`${API_ROOT}${path}`);
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      url.searchParams.set(key, String(value));
    });
    return url;
  };

  const sessionKey = url => `mlb-api:${url}`;

  const readStored = url => {
    try {
      const raw = sessionStorage.getItem(sessionKey(url));
      if (!raw) return null;
      const value = JSON.parse(raw);
      return value && typeof value.savedAt === 'number' ? value : null;
    } catch {
      return null;
    }
  };

  const store = (url, cached) => {
    memoryCache.set(url, cached);
    try {
      sessionStorage.setItem(sessionKey(url), JSON.stringify(cached));
    } catch {
      // A full-season schedule can exceed storage quota; memory cache still works for this visit.
    }
  };

  const fetchJson = async (url, { timeout, cache }) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        cache,
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`MLB Stats API HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      if (error?.name === 'AbortError') throw new Error('MLB Stats API timeout');
      throw error;
    } finally {
      clearTimeout(timer);
    }
  };

  async function request(path, params = {}, options = {}) {
    const {
      fresh = false,
      ttl = DEFAULT_TTL,
      timeout = 10000,
      retries = DEFAULT_RETRIES,
      retryDelay = 700,
      allowStale = true
    } = options;

    const url = createUrl(path, params).toString();
    const pendingKey = `${fresh ? 'fresh' : 'cached'}:${url}`;
    if (pendingRequests.has(pendingKey)) return pendingRequests.get(pendingKey);

    const task = (async () => {
      const memory = memoryCache.get(url);
      const stored = readStored(url);
      const stale = memory || stored;

      if (!fresh && memory && Date.now() - memory.savedAt < ttl) return memory.value;
      if (!fresh && stored && Date.now() - stored.savedAt < ttl) {
        memoryCache.set(url, stored);
        return stored.value;
      }

      let lastError = null;
      for (let attempt = 0; attempt <= retries; attempt += 1) {
        try {
          const value = await fetchJson(url, {
            timeout,
            cache: fresh ? 'no-store' : 'default'
          });
          store(url, { savedAt: Date.now(), value });
          return value;
        } catch (error) {
          lastError = error;
          if (attempt < retries) await wait(retryDelay * (attempt + 1));
        }
      }

      if (allowStale && stale?.value) {
        console.warn('MLB Stats API unavailable; using stale response:', lastError);
        memoryCache.set(url, stale);
        return stale.value;
      }

      throw lastError || new Error('MLB Stats API request failed');
    })().finally(() => {
      pendingRequests.delete(pendingKey);
    });

    pendingRequests.set(pendingKey, task);
    return task;
  }

  const normalizeTeam = team => {
    const id = String(team.id || '');
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
      league: Data.LEAGUES?.[leagueId] || {
        id: leagueId,
        code: '',
        name: team.league?.name || ''
      },
      division: Data.DIVISIONS?.[divisionId] || {
        id: divisionId,
        leagueId,
        code: '',
        name: team.division?.name || ''
      },
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
      abbreviation: team.abbreviation || '',
      logo: Data.teamLogo?.(id) || '',
      score: value?.score ?? null,
      winner: Boolean(value?.isWinner)
    };
  };

  const normalizeGame = game => ({
    id: String(game.gamePk || game.calendarEventID || `${game.gameDate}-${game.gameNumber || 1}`),
    date: game.gameDate,
    gameType: game.gameType || 'R',
    gameTypeName: Data.gameTypeName?.(game.gameType) || 'MLB',
    gameNumber: Number(game.gameNumber || 1),
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
        abbreviation: '',
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
      league: Data.LEAGUES?.[leagueId] || {
        id: leagueId,
        code: '',
        name: record.league?.name || ''
      },
      rows: asArray(record.teamRecords)
        .map(normalizeStandingRow)
        .sort((a, b) => a.rank - b.rank || Number(b.pct) - Number(a.pct))
    };
  }).sort((a, b) => a.leagueId - b.leagueId || a.divisionId - b.divisionId);

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
        season: options.season || currentSeason()
      }, {
        ...options,
        timeout: options.timeout || 8000,
        retries: options.retries ?? 0
      });
      const teams = asArray(payload.teams).map(normalizeTeam).filter(team => team.id);
      return teams.length ? teams : [...(Data.FALLBACK_TEAMS || [])];
    } catch (error) {
      console.warn('MLB teams unavailable, using fallback list:', error);
      return [...(Data.FALLBACK_TEAMS || [])];
    }
  }

  const scheduleRange = options => {
    if (options.startDate && options.endDate) {
      return { startDate: options.startDate, endDate: options.endDate };
    }

    const today = new Date();
    return {
      startDate: dateTextFromDate(addDays(today, -(options.pastDays ?? 7))),
      endDate: dateTextFromDate(addDays(today, options.futureDays ?? 45))
    };
  };

  async function loadSchedule(options = {}) {
    const range = scheduleRange(options);
    const payload = await request('/schedule', {
      sportId: 1,
      startDate: range.startDate,
      endDate: range.endDate,
      hydrate: options.hydrate === false ? '' : 'linescore,probablePitcher'
    }, {
      ...options,
      ttl: options.ttl ?? 5 * 60 * 1000,
      timeout: options.timeout || 9000,
      retries: options.retries ?? 0
    });

    return asArray(payload.dates)
      .flatMap(date => asArray(date.games))
      .map(normalizeGame)
      .filter(game => game.date && game.home.id && game.away.id)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }

  async function loadSeasonSchedule(options = {}) {
    const season = options.season || currentSeason();
    return loadSchedule({
      ...options,
      season,
      startDate: options.startDate || dateText(season, 3, 1),
      endDate: options.endDate || dateText(season, 11, 30),
      hydrate: false,
      ttl: options.ttl ?? 6 * 60 * 60 * 1000,
      timeout: options.timeout || 20000,
      retries: options.retries ?? 1
    });
  }

  async function loadStandings(options = {}) {
    const season = options.season || currentSeason();
    const payload = await request('/standings', {
      leagueId: '103,104',
      season,
      standingsTypes: 'regularSeason'
    }, {
      ...options,
      timeout: options.timeout || 8000,
      retries: options.retries ?? 0
    });
    return normalizeStandings(payload);
  }

  async function loadJapanesePlayers(options = {}) {
    const season = options.season || currentSeason();
    const payload = await request('/sports/1/players', { season }, {
      ...options,
      ttl: options.ttl ?? 60 * 60 * 1000,
      timeout: options.timeout || 15000,
      retries: options.retries ?? 1
    });

    return asArray(payload.people || payload.players)
      .filter(person => String(person.birthCountry || '').toLowerCase() === 'japan')
      .filter(person => person.active !== false)
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
    return {
      season,
      updatedAt: new Date().toISOString(),
      teams: teamsResult.status === 'fulfilled' ? teamsResult.value : [...(Data.FALLBACK_TEAMS || [])],
      games: gamesResult.status === 'fulfilled' ? gamesResult.value : [],
      standings: standingsResult.status === 'fulfilled' ? standingsResult.value : [],
      errors: results
        .filter(result => result.status === 'rejected')
        .map(result => result.reason?.message || String(result.reason))
    };
  }

  Object.assign(namespace, {
    API_ROOT,
    DEFAULT_TTL,
    DEFAULT_RETRIES,
    currentSeason,
    request,
    loadTeams,
    loadSchedule,
    loadSeasonSchedule,
    loadStandings,
    loadJapanesePlayers,
    loadHub,
    normalizeTeam,
    normalizeGame,
    normalizeStandings,
    normalizePlayer,
    dateText,
    dateTextFromDate,
    addDays,
    clearCache() {
      memoryCache.clear();
      pendingRequests.clear();
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