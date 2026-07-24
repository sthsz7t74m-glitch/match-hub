import fs from 'node:fs/promises';

const API = 'https://api.football-data.org/v4';
const token = process.env.FOOTBALL_DATA_TOKEN;
if (!token) throw new Error('FOOTBALL_DATA_TOKEN is not configured');

const leagues = [
  { code: 'PL', id: 39, name: 'Premier League', ja: 'プレミアリーグ', color: '#7c3aed' },
  { code: 'PD', id: 140, name: 'Primera Division', ja: 'ラ・リーガ', color: '#f97316' },
  { code: 'SA', id: 135, name: 'Serie A', ja: 'セリエA', color: '#2563eb' },
  { code: 'BL1', id: 78, name: 'Bundesliga', ja: 'ブンデスリーガ', color: '#dc2626' },
  { code: 'FL1', id: 61, name: 'Ligue 1', ja: 'リーグ・アン', color: '#0891b2' }
];

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function request(path, attempt = 0) {
  const response = await fetch(`${API}${path}`, {
    headers: { 'X-Auth-Token': token }
  });

  if (response.status === 429 && attempt < 2) {
    const waitMs = Number(response.headers.get('retry-after') || 60) * 1000;
    console.log(`Rate limited. Waiting ${Math.ceil(waitMs / 1000)} seconds...`);
    await sleep(waitMs);
    return request(path, attempt + 1);
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${path}: HTTP ${response.status} ${body}`);
  }

  const json = await response.json();
  await sleep(6500);
  return json;
}

const teams = [];
const fixtures = [];
const standings = [];
let season = null;

for (const league of leagues) {
  console.log(`Fetching ${league.name}`);

  const teamResponse = await request(`/competitions/${league.code}/teams`);
  const matchResponse = await request(`/competitions/${league.code}/matches`);
  const standingResponse = await request(`/competitions/${league.code}/standings`);

  season ||= teamResponse.season?.startDate?.slice(0, 4) || null;

  for (const team of teamResponse.teams || []) {
    teams.push({
      id: team.id,
      name: team.name,
      shortName: team.shortName || team.name,
      tla: team.tla || '',
      logo: team.crest || '',
      leagueId: league.id,
      leagueCode: league.code,
      color: league.color,
      venue: team.venue || ''
    });
  }

  for (const match of matchResponse.matches || []) {
    fixtures.push({
      id: match.id,
      date: match.utcDate,
      status: match.status,
      elapsed: null,
      competition: match.competition?.name || league.name,
      competitionJa: league.ja,
      leagueId: league.id,
      leagueCode: league.code,
      round: match.matchday ? `第${match.matchday}節` : (match.stage || ''),
      venue: '',
      home: {
        id: match.homeTeam.id,
        name: match.homeTeam.name,
        logo: match.homeTeam.crest || ''
      },
      away: {
        id: match.awayTeam.id,
        name: match.awayTeam.name,
        logo: match.awayTeam.crest || ''
      },
      goals: {
        home: match.score?.fullTime?.home ?? null,
        away: match.score?.fullTime?.away ?? null
      },
      score: match.score || {},
      events: []
    });
  }

  const total = (standingResponse.standings || []).find(item => item.type === 'TOTAL');
  standings.push({
    leagueId: league.id,
    leagueCode: league.code,
    leagueName: league.name,
    leagueNameJa: league.ja,
    rows: (total?.table || []).map(row => ({
      rank: row.position,
      team: {
        id: row.team.id,
        name: row.team.name,
        logo: row.team.crest || ''
      },
      played: row.playedGames,
      win: row.won,
      draw: row.draw,
      lose: row.lost,
      goalsDiff: row.goalDifference,
      points: row.points,
      form: row.form || ''
    }))
  });
}

const output = {
  updatedAt: new Date().toISOString(),
  season,
  dataSource: 'football-data.org',
  dataMode: 'current-free-plan',
  leagues,
  teams,
  fixtures: fixtures.sort((a, b) => new Date(a.date) - new Date(b.date)),
  standings
};

await fs.mkdir('data', { recursive: true });
await fs.writeFile('data/football.json', `${JSON.stringify(output, null, 2)}\n`);
console.log(`Saved ${teams.length} teams and ${fixtures.length} fixtures.`);