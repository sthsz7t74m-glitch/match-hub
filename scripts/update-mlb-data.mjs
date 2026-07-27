import fs from 'node:fs/promises';
import path from 'node:path';

const API_ROOT = 'https://statsapi.mlb.com/api/v1';
const OUTPUT_PATH = process.env.MLB_OUTPUT || 'data/mlb-hub.json';
const EXISTING_PATH = process.env.MLB_EXISTING_FILE || '';
const FULL_REFRESH_MS = 6 * 60 * 60 * 1000;
const DEFAULT_TIMEOUT = 20_000;

const pad = value => String(value).padStart(2, '0');
const dateText = value => {
  const date = value instanceof Date ? value : new Date(value);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
};
const addDays = (value, days) => {
  const date = new Date(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
};
const asArray = value => (Array.isArray(value) ? value : []);

async function readJson(filePath) {
  if (!filePath) return null;
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function createUrl(route, params = {}) {
  const url = new URL(`${API_ROOT}${route}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    url.searchParams.set(key, String(value));
  });
  return url;
}

async function fetchJson(route, params, { timeout = DEFAULT_TIMEOUT, retries = 2 } = {}) {
  const url = createUrl(route, params);
  let lastError = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'User-Agent': 'match-hub-mlb-publisher/1.0'
        }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${url.pathname}`);
      return await response.json();
    } catch (error) {
      lastError = error?.name === 'AbortError'
        ? new Error(`Timeout: ${url.pathname}`)
        : error;
      if (attempt < retries) await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError || new Error(`Failed to fetch ${url.pathname}`);
}

const compactTeam = team => ({
  id: team?.id,
  name: team?.name,
  clubName: team?.clubName,
  abbreviation: team?.abbreviation,
  teamCode: team?.teamCode,
  league: team?.league ? { id: team.league.id, name: team.league.name } : null,
  division: team?.division ? { id: team.division.id, name: team.division.name } : null,
  venue: team?.venue ? { id: team.venue.id, name: team.venue.name } : null
});

const compactSide = side => ({
  score: side?.score ?? null,
  isWinner: Boolean(side?.isWinner),
  team: side?.team ? {
    id: side.team.id,
    name: side.team.name,
    abbreviation: side.team.abbreviation
  } : null,
  probablePitcher: side?.probablePitcher ? {
    id: side.probablePitcher.id,
    fullName: side.probablePitcher.fullName
  } : null
});

const compactGame = game => ({
  gamePk: game?.gamePk,
  calendarEventID: game?.calendarEventID,
  gameDate: game?.gameDate,
  gameType: game?.gameType,
  gameNumber: game?.gameNumber,
  doubleHeader: game?.doubleHeader,
  status: game?.status ? {
    abstractGameState: game.status.abstractGameState,
    detailedState: game.status.detailedState,
    statusCode: game.status.statusCode
  } : null,
  teams: {
    home: compactSide(game?.teams?.home),
    away: compactSide(game?.teams?.away)
  },
  venue: game?.venue ? { id: game.venue.id, name: game.venue.name } : null,
  seriesDescription: game?.seriesDescription,
  description: game?.description,
  linescore: game?.linescore ? {
    currentInning: game.linescore.currentInning,
    currentInningOrdinal: game.linescore.currentInningOrdinal,
    inningState: game.linescore.inningState
  } : null
});

const compactSchedule = payload => ({
  dates: asArray(payload?.dates).map(entry => ({
    date: entry?.date,
    games: asArray(entry?.games).map(compactGame)
  }))
});

const compactStandingRow = row => ({
  divisionRank: row?.divisionRank,
  leagueRank: row?.leagueRank,
  team: row?.team ? { id: row.team.id, name: row.team.name } : null,
  gamesPlayed: row?.gamesPlayed,
  wins: row?.wins,
  losses: row?.losses,
  winningPercentage: row?.winningPercentage,
  gamesBack: row?.gamesBack,
  wildCardGamesBack: row?.wildCardGamesBack,
  runDifferential: row?.runDifferential,
  streak: row?.streak ? { streakCode: row.streak.streakCode } : null
});

const compactStandings = payload => ({
  records: asArray(payload?.records).map(record => ({
    division: record?.division ? {
      id: record.division.id,
      name: record.division.name,
      nameShort: record.division.nameShort
    } : null,
    league: record?.league ? { id: record.league.id, name: record.league.name } : null,
    teamRecords: asArray(record?.teamRecords).map(compactStandingRow)
  }))
});

function comparable(payload) {
  if (!payload) return null;
  return JSON.stringify({
    schemaVersion: payload.schemaVersion,
    season: payload.season,
    fullScheduleAt: payload.fullScheduleAt,
    raw: payload.raw,
    errors: payload.errors
  });
}

const existing = await readJson(EXISTING_PATH);
const now = new Date();
const season = Number(process.env.MLB_SEASON || now.getUTCFullYear());
const errors = [];
let successfulRequests = 0;

async function settle(label, request, fallback) {
  try {
    const result = await request();
    successfulRequests += 1;
    return result;
  } catch (error) {
    errors.push(`${label}: ${error?.message || String(error)}`);
    return fallback;
  }
}

const liveStart = dateText(addDays(now, -10));
const liveEnd = dateText(addDays(now, 60));

const [teamsRaw, liveScheduleRaw, standingsRaw] = await Promise.all([
  settle('teams', () => fetchJson('/teams', { sportId: 1, season }), existing?.raw?.teams || null),
  settle('schedule', () => fetchJson('/schedule', {
    sportId: 1,
    startDate: liveStart,
    endDate: liveEnd,
    hydrate: 'linescore,probablePitcher'
  }), existing?.raw?.liveSchedule || null),
  settle('standings', () => fetchJson('/standings', {
    leagueId: '103,104',
    season,
    standingsTypes: 'regularSeason'
  }), existing?.raw?.standings || null)
]);

const previousFullAt = Date.parse(existing?.fullScheduleAt || '');
const needsFullSchedule = !existing?.raw?.seasonSchedule
  || !Number.isFinite(previousFullAt)
  || Date.now() - previousFullAt >= FULL_REFRESH_MS;

let seasonScheduleRaw = existing?.raw?.seasonSchedule || null;
let fullScheduleAt = existing?.fullScheduleAt || null;

if (needsFullSchedule) {
  const fetched = await settle('season schedule', () => fetchJson('/schedule', {
    sportId: 1,
    startDate: `${season}-03-01`,
    endDate: `${season}-11-30`
  }, { timeout: 30_000, retries: 2 }), null);

  if (fetched) {
    seasonScheduleRaw = fetched;
    fullScheduleAt = now.toISOString();
  }
}

const hasUsefulData = asArray(teamsRaw?.teams).length > 0
  || asArray(liveScheduleRaw?.dates).length > 0
  || asArray(seasonScheduleRaw?.dates).length > 0
  || asArray(standingsRaw?.records).length > 0;

if (!hasUsefulData) {
  throw new Error(`No MLB data could be generated. ${errors.join(' | ')}`);
}

const payload = {
  schemaVersion: 1,
  season,
  updatedAt: successfulRequests > 0 ? now.toISOString() : existing?.updatedAt || now.toISOString(),
  fullScheduleAt,
  source: 'github-actions',
  raw: {
    teams: teamsRaw ? { teams: asArray(teamsRaw.teams).map(compactTeam) } : null,
    liveSchedule: liveScheduleRaw ? compactSchedule(liveScheduleRaw) : null,
    seasonSchedule: seasonScheduleRaw ? compactSchedule(seasonScheduleRaw) : null,
    standings: standingsRaw ? compactStandings(standingsRaw) : null
  },
  errors
};

const finalPayload = comparable(existing) === comparable(payload) ? existing : payload;
await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
await fs.writeFile(OUTPUT_PATH, `${JSON.stringify(finalPayload)}\n`, 'utf8');
console.log(`MLB dataset written: ${OUTPUT_PATH}`);
console.log(`season=${season} successfulRequests=${successfulRequests} errors=${errors.length}`);