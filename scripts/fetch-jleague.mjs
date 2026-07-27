import fs from 'node:fs/promises';
import vm from 'node:vm';

const LEAGUES = [
  { id: 'j1', code: 'jpn.1', label: 'J1', competition: 'Japanese J.League' },
  { id: 'j2', code: 'j2', label: 'J2', competition: '明治安田J2リーグ' },
  { id: 'j3', code: 'j3', label: 'J3', competition: '明治安田J3リーグ' }
];
const OFFICIAL_SEASON = '2026/27';
const ESPN_SEASON = 2026;
const ESPN_DATE_RANGE = '20260101-20261231';

const decodeEntities = value => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
  .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>');

const stripTags = html => decodeEntities(String(html ?? '')
  .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
  .replace(/<br\s*\/?\s*>/gi, ' ')
  .replace(/<[^>]+>/g, ' '))
  .replace(/\s+/g, ' ')
  .trim();

const normalize = value => String(value ?? '')
  .normalize('NFKC')
  .toLocaleLowerCase('ja')
  .replace(/f\.c\.|fc/g, '')
  .replace(/[・･.．\-ー_\s]/g, '')
  .replace(/ユナイテッド/g, '')
  .replace(/1969/g, '');

const absoluteUrl = (value, base = 'https://www.jleague.jp') => {
  try { return new URL(value, base).href; } catch { return ''; }
};

const toNumber = value => {
  const normalized = String(value ?? '').normalize('NFKC').replace(/[^\d+\-.]/g, '');
  if (!normalized || normalized === '-' || normalized === '—') return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
};

const parallelMap = async (items, limit, worker) => {
  const results = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(runners);
  return results;
};

class HttpClient {
  constructor({ retries = 2, timeoutMs = 25000 } = {}) {
    this.retries = retries;
    this.timeoutMs = timeoutMs;
  }

  async request(url, { type = 'text', headers = {} } = {}) {
    let lastError = null;
    for (let attempt = 0; attempt <= this.retries; attempt += 1) {
      try {
        const response = await fetch(url, {
          redirect: 'follow',
          cache: 'no-store',
          headers: {
            'User-Agent': 'match-hub/2.0 (+https://github.com/sthsz7t74m-glitch/match-hub)',
            'Accept-Language': 'ja,en;q=0.8',
            ...headers
          },
          signal: AbortSignal.timeout(this.timeoutMs)
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        if (type === 'json') return response.json();
        if (type === 'buffer') return Buffer.from(await response.arrayBuffer());
        return response.text();
      } catch (error) {
        lastError = error;
        if (attempt < this.retries) await new Promise(resolve => setTimeout(resolve, 700 * (attempt + 1)));
      }
    }
    throw new Error(`${url}: ${lastError?.message || 'request failed'}`);
  }

  getJson(url) { return this.request(url, { type: 'json' }); }
  getText(url) { return this.request(url, { type: 'text' }); }
}

class ClubCatalog {
  static async load(path = 'assets/js/jleague-data.js') {
    const source = await fs.readFile(path, 'utf8');
    const sandbox = { window: {}, console };
    vm.runInNewContext(source, sandbox, { filename: path });
    return new ClubCatalog(sandbox.window.SportsHubJLeague);
  }

  constructor(source) {
    this.source = source;
    this.clubs = [...source.clubs];
    this.byId = new Map(this.clubs.map(club => [club.id, club]));
    this.bySlug = new Map(this.clubs.flatMap(club => (club.officialSlugs || []).map(slug => [slug, club])));
    this.aliasesByLeague = new Map();
    for (const league of ['j1', 'j2', 'j3']) {
      const aliases = this.clubs
        .filter(club => club.league === league)
        .flatMap(club => (club.aliases || [club.name]).map(alias => ({ club, alias, normalized: normalize(alias) })))
        .filter(item => item.normalized)
        .sort((left, right) => right.normalized.length - left.normalized.length);
      this.aliasesByLeague.set(league, aliases);
    }
  }

  find(value) {
    return this.source.find(value);
  }

  forLeague(league) {
    return this.clubs.filter(club => club.league === league);
  }

  findOrdered(text, league) {
    const normalizedText = normalize(text);
    const occurrences = [];
    for (const item of this.aliasesByLeague.get(league) || []) {
      let from = 0;
      while (from < normalizedText.length) {
        const index = normalizedText.indexOf(item.normalized, from);
        if (index < 0) break;
        occurrences.push({ ...item, index });
        from = index + Math.max(1, item.normalized.length);
      }
    }
    occurrences.sort((left, right) => left.index - right.index || right.normalized.length - left.normalized.length);
    const seen = new Set();
    return occurrences.filter(item => {
      if (seen.has(item.club.id)) return false;
      seen.add(item.club.id);
      return true;
    });
  }
}

class TeamStore {
  constructor(catalog) {
    this.catalog = catalog;
    this.records = new Map();
    catalog.clubs.forEach(club => this.merge(club, {
      id: club.providerId || club.id,
      appId: club.id,
      league: club.league,
      name: club.name,
      shortName: club.shortName || club.name,
      tla: '',
      logo: '',
      venue: '',
      area: club.area,
      officialSlug: club.officialSlugs?.[0] || ''
    }));
  }

  merge(clubOrId, patch = {}) {
    const club = typeof clubOrId === 'string' ? this.catalog.find(clubOrId) : clubOrId;
    if (!club) return null;
    const current = this.records.get(club.id) || {};
    const value = {
      ...current,
      ...Object.fromEntries(Object.entries(patch).filter(([, entry]) => entry !== undefined && entry !== null && entry !== '')),
      appId: club.id,
      league: club.league,
      area: patch.area || current.area || club.area,
      name: patch.name || current.name || club.name,
      shortName: patch.shortName || current.shortName || club.shortName || club.name,
      officialSlug: patch.officialSlug || current.officialSlug || club.officialSlugs?.[0] || ''
    };
    this.records.set(club.id, value);
    return value;
  }

  team(clubOrId) {
    const club = typeof clubOrId === 'string' ? this.catalog.find(clubOrId) : clubOrId;
    return club ? this.records.get(club.id) : null;
  }

  list() {
    return this.catalog.clubs.map(club => ({ ...this.team(club) }));
  }
}

class EspnJ1Source {
  constructor({ client, catalog, teams }) {
    Object.assign(this, { client, catalog, teams });
  }

  normalizeTeam(team = {}) {
    const providerId = String(team.id || team.uid || team.slug || team.abbreviation || team.displayName || '');
    const club = this.catalog.clubs.find(item => item.providerId === providerId)
      || this.catalog.find(team.displayName)
      || this.catalog.find(team.shortDisplayName);
    if (!club) return null;
    return this.teams.merge(club, {
      id: providerId || club.providerId || club.id,
      name: team.displayName || team.name || club.name,
      shortName: team.shortDisplayName || team.name || club.shortName,
      tla: team.abbreviation || '',
      logo: team.logo || team.logos?.[0]?.href || '',
      venue: team.venue?.fullName || ''
    });
  }

  async load() {
    const errors = [];
    const matches = [];
    const standings = [];
    try {
      const scoreboardUrl = `https://site.api.espn.com/apis/site/v2/sports/soccer/jpn.1/scoreboard?dates=${ESPN_DATE_RANGE}&limit=1000`;
      const payload = await this.client.getJson(scoreboardUrl);
      for (const event of payload.events || []) {
        const competition = event.competitions?.[0];
        const homeCompetitor = competition?.competitors?.find(item => item.homeAway === 'home');
        const awayCompetitor = competition?.competitors?.find(item => item.homeAway === 'away');
        const home = this.normalizeTeam(homeCompetitor?.team);
        const away = this.normalizeTeam(awayCompetitor?.team);
        if (!home || !away) continue;
        const completed = Boolean(event.status?.type?.completed);
        matches.push({
          id: String(event.id),
          sourceId: String(event.id),
          source: 'espn',
          league: 'j1',
          date: event.date,
          status: completed ? 'FINISHED' : event.status?.type?.state === 'in' ? 'IN_PLAY' : 'SCHEDULED',
          matchday: event.week?.number || null,
          stage: event.season?.type?.name || event.season?.slug || '',
          competition: event.league?.name || payload.leagues?.[0]?.name || 'Japanese J.League',
          home: { ...home },
          away: { ...away },
          score: {
            home: homeCompetitor?.score === '' || homeCompetitor?.score == null ? null : Number(homeCompetitor.score),
            away: awayCompetitor?.score === '' || awayCompetitor?.score == null ? null : Number(awayCompetitor.score)
          },
          venue: competition?.venue?.fullName || '',
          round: competition?.type?.text || event.week?.text || ''
        });
      }
    } catch (error) {
      errors.push(`j1 scoreboard: ${error.message}`);
    }

    try {
      const payload = await this.client.getJson('https://site.api.espn.com/apis/v2/sports/soccer/jpn.1/standings');
      const entries = payload.children?.[0]?.standings?.entries || payload.standings?.entries || [];
      entries.forEach((entry, index) => {
        const team = this.normalizeTeam(entry.team);
        if (!team) return;
        const stats = Object.fromEntries((entry.stats || []).map(stat => [stat.name, stat.value ?? stat.displayValue]));
        standings.push({
          league: 'j1',
          rank: Number(stats.rank || entry.rank || index + 1),
          team: { ...team },
          played: Number(stats.gamesPlayed || stats.games || 0),
          win: Number(stats.wins || 0),
          draw: Number(stats.ties || stats.draws || 0),
          lose: Number(stats.losses || 0),
          goalsFor: Number(stats.pointsFor || stats.goalsFor || 0),
          goalsAgainst: Number(stats.pointsAgainst || stats.goalsAgainst || 0),
          goalsDiff: Number(stats.pointDifferential || stats.goalDifference || 0),
          points: Number(stats.points || 0),
          form: ''
        });
      });
    } catch (error) {
      errors.push(`j1 standings: ${error.message}`);
    }
    return { matches, standings, errors };
  }
}

class OfficialProfileSource {
  constructor({ client, catalog, teams }) {
    Object.assign(this, { client, catalog, teams });
  }

  imageFromHtml(html, club) {
    const candidates = [...html.matchAll(/<img\b[^>]*>/gi)].map(match => match[0]);
    let best = null;
    for (const tag of candidates) {
      const src = tag.match(/\bsrc=["']([^"']+)["']/i)?.[1] || tag.match(/\bdata-src=["']([^"']+)["']/i)?.[1];
      if (!src) continue;
      const alt = decodeEntities(tag.match(/\balt=["']([^"']*)["']/i)?.[1] || '');
      const score = (alt.includes('エンブレム') ? 6 : 0)
        + (normalize(alt).includes(normalize(club.name)) ? 4 : 0)
        + (/club|team|emblem|logo/i.test(src) ? 2 : 0)
        - (/common|league|partner|sponsor/i.test(src) ? 5 : 0);
      if (!best || score > best.score) best = { score, src };
    }
    return best?.score > 0 ? absoluteUrl(best.src) : '';
  }

  stadiumFromHtml(html) {
    const row = html.match(/<t[hd][^>]*>\s*ホームスタジアム\s*<\/t[hd]>\s*<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/i);
    if (row) return stripTags(row[1]);
    const text = stripTags(html);
    const match = text.match(/ホームスタジアム\s+(.+?)(?=クラブプロフィール|アクセス|ホームタウン|$)/);
    return match?.[1]?.trim().slice(0, 120) || '';
  }

  async loadClub(club) {
    const errors = [];
    for (const slug of club.officialSlugs || []) {
      try {
        const url = `https://www.jleague.jp/club/${slug}/profile/?v=${Date.now()}`;
        const html = await this.client.getText(url);
        const logo = this.imageFromHtml(html, club);
        const venue = this.stadiumFromHtml(html);
        if (!logo && !venue && club.officialSlugs.length > 1) continue;
        this.teams.merge(club, { logo, venue, officialSlug: slug });
        return { club: club.id, logo: Boolean(logo), venue: Boolean(venue), errors };
      } catch (error) {
        errors.push(`${club.id} profile(${slug}): ${error.message}`);
      }
    }
    return { club: club.id, logo: false, venue: false, errors };
  }

  async load(leagues = ['j2', 'j3']) {
    const clubs = this.catalog.clubs.filter(club => leagues.includes(club.league));
    const results = await parallelMap(clubs, 5, club => this.loadClub(club));
    return {
      errors: results.flatMap(result => result.errors),
      logoCount: results.filter(result => result.logo).length,
      venueCount: results.filter(result => result.venue).length
    };
  }
}

class OfficialScheduleSource {
  constructor({ client, catalog, teams }) {
    Object.assign(this, { client, catalog, teams });
  }

  orderedTeams(text, league) {
    return this.catalog.findOrdered(text, league).slice(0, 2);
  }

  teamPayload(club) {
    return { ...this.teams.team(club) };
  }

  extractVenue(text, home, away) {
    let value = String(text || '');
    const timeMatch = value.match(/(?:[01]?\d|2[0-3]):[0-5]\d/);
    if (timeMatch) value = value.slice((timeMatch.index || 0) + timeMatch[0].length);
    const aliases = [...(home.aliases || []), ...(away.aliases || [])]
      .sort((left, right) => right.length - left.length);
    for (const alias of aliases) value = value.replaceAll(alias, ' ');
    return value
      .replace(/ＶＳ|VS|試合終了|前半|後半|延長|PK/gi, ' ')
      .replace(/\b\d{1,2}\s*[-－]\s*\d{1,2}\b/g, ' ')
      .replace(/DAZN[\s\S]*$/i, ' ')
      .replace(/チケット[\s\S]*$/i, ' ')
      .replace(/対戦データ[\s\S]*$/i, ' ')
      .replace(/テレビ放送[\s\S]*$/i, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 140);
  }

  parseAnchor({ href, inner, league, round }) {
    const route = href.match(/\/match\/(j2|j3)\/(2026|2027)\/(\d{6})\/?/i);
    if (!route || route[1].toLowerCase() !== league) return null;
    const text = stripTags(inner);
    const teams = this.orderedTeams(text, league);
    if (teams.length < 2 || teams[0].club.id === teams[1].club.id) return null;
    const [homeEntry, awayEntry] = teams;
    const home = homeEntry.club;
    const away = awayEntry.club;
    const year = Number(route[2]);
    const code = route[3];
    const month = Number(code.slice(0, 2));
    const day = Number(code.slice(2, 4));
    if (!month || !day) return null;
    const time = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
    const hour = time ? Number(time[1]) : 12;
    const minute = time ? Number(time[2]) : 0;
    const date = new Date(Date.UTC(year, month - 1, day, hour - 9, minute)).toISOString();
    const scoreMatch = text.match(/(?:^|\D)(\d{1,2})\s*[-－]\s*(\d{1,2})(?:\D|$)/);
    const live = /LIVE|前半|後半|ハーフタイム/i.test(text);
    const unavailable = /延期|中止|中断/.test(text);
    const status = unavailable ? (/中止/.test(text) ? 'CANCELLED' : /中断/.test(text) ? 'SUSPENDED' : 'POSTPONED')
      : scoreMatch ? (live ? 'IN_PLAY' : 'FINISHED')
        : 'SCHEDULED';
    return {
      id: `jleague-${league}-${route[2]}-${code}`,
      sourceId: code,
      sourceUrl: absoluteUrl(href),
      source: 'jleague-official',
      league,
      date,
      datePrecision: time ? 'exact' : 'date',
      timeTbd: !time,
      status,
      matchday: round,
      stage: `${OFFICIAL_SEASON}-${league}`,
      competition: league === 'j2' ? '明治安田J2リーグ' : '明治安田J3リーグ',
      home: this.teamPayload(home),
      away: this.teamPayload(away),
      score: {
        home: scoreMatch ? Number(scoreMatch[1]) : null,
        away: scoreMatch ? Number(scoreMatch[2]) : null
      },
      venue: this.extractVenue(text, home, away),
      round: `第${round}節`
    };
  }

  parsePage(html, league, round) {
    const anchors = [...html.matchAll(/<a\b[^>]*href=["']([^"']*\/match\/(?:j2|j3)\/(?:2026|2027)\/\d{6}\/?[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi)];
    const matches = anchors
      .map(match => this.parseAnchor({ href: match[1], inner: match[2], league, round }))
      .filter(Boolean);
    return [...new Map(matches.map(match => [match.id, match])).values()];
  }

  async loadRound(league, round) {
    const url = `https://www.jleague.jp/sp/match/section/${league}/${round}/?v=${Date.now()}-${round}`;
    const html = await this.client.getText(url);
    const matches = this.parsePage(html, league, round);
    if (!matches.length) throw new Error(`no ${league} round ${round} matches parsed`);
    return matches;
  }

  async loadLeague(league) {
    const rounds = Array.from({ length: 38 }, (_, index) => index + 1);
    const errors = [];
    const results = await parallelMap(rounds, 4, async round => {
      try {
        return await this.loadRound(league, round);
      } catch (error) {
        errors.push(`${league} round ${round}: ${error.message}`);
        return [];
      }
    });
    const matches = [...new Map(results.flat().map(match => [match.id, match])).values()];
    if (matches.length < 300) errors.push(`${league} schedule validation: expected near 380 matches, parsed ${matches.length}`);
    return { matches, errors };
  }

  async load() {
    const [j2, j3] = await Promise.all([this.loadLeague('j2'), this.loadLeague('j3')]);
    return { matches: [...j2.matches, ...j3.matches], errors: [...j2.errors, ...j3.errors] };
  }
}

class OfficialStandingsSource {
  constructor({ client, catalog, teams }) {
    Object.assign(this, { client, catalog, teams });
  }

  parseRows(html, league) {
    const rows = [];
    for (const row of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const inner = row[1];
      const slug = inner.match(/\/club\/([^/"'?]+)\//i)?.[1] || '';
      const club = this.catalog.bySlug.get(slug)
        || this.catalog.findOrdered(stripTags(inner), league)[0]?.club;
      if (!club || club.league !== league) continue;
      const cells = [...inner.matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)].map(match => stripTags(match[1]));
      if (cells.length < 2) continue;
      const numeric = cells.filter(cell => /^[-—+\d\s]+$/.test(cell.normalize('NFKC').trim()));
      const rank = toNumber(cells[0]);
      const points = toNumber(cells[2] ?? numeric[1]);
      const played = toNumber(cells[3] ?? numeric[2]);
      const win = toNumber(cells[4] ?? numeric[3]);
      const draw = toNumber(cells[5] ?? numeric[4]);
      const lose = toNumber(cells[6] ?? numeric[5]);
      const goalsFor = toNumber(cells[7] ?? numeric[6]);
      const goalsAgainst = toNumber(cells[8] ?? numeric[7]);
      const goalsDiff = toNumber(cells[9] ?? numeric[8]);
      rows.push({
        league,
        rank: rank ?? rows.length + 1,
        team: { ...this.teams.team(club) },
        played: played ?? 0,
        win: win ?? 0,
        draw: draw ?? 0,
        lose: lose ?? 0,
        goalsFor: goalsFor ?? 0,
        goalsAgainst: goalsAgainst ?? 0,
        goalsDiff: goalsDiff ?? 0,
        points: points ?? 0,
        form: '',
        provisional: rank == null || points == null || played == null
      });
    }
    return [...new Map(rows.map(row => [row.team.appId || row.team.id, row])).values()];
  }

  fallback(league) {
    return this.catalog.forLeague(league).map((club, index) => ({
      league,
      rank: index + 1,
      team: { ...this.teams.team(club) },
      played: 0,
      win: 0,
      draw: 0,
      lose: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalsDiff: 0,
      points: 0,
      form: '',
      provisional: true
    }));
  }

  async loadLeague(league) {
    try {
      const html = await this.client.getText(`https://www.jleague.jp/${league}/standings/?v=${Date.now()}`);
      const rows = this.parseRows(html, league);
      if (rows.length >= 18) return { rows, errors: [] };
      return { rows: this.fallback(league), errors: [`${league} standings validation: parsed ${rows.length}, used catalog fallback`] };
    } catch (error) {
      return { rows: this.fallback(league), errors: [`${league} standings: ${error.message}`] };
    }
  }

  async load() {
    const [j2, j3] = await Promise.all([this.loadLeague('j2'), this.loadLeague('j3')]);
    return { standings: [...j2.rows, ...j3.rows], errors: [...j2.errors, ...j3.errors] };
  }
}

class JLeagueDataPipeline {
  constructor({ client, catalog, teams }) {
    Object.assign(this, { client, catalog, teams });
    this.errors = [];
  }

  availabilityFor(league, matches, standings) {
    return {
      teams: this.teams.list().some(team => team.league === league),
      matches: matches.some(match => match.league === league),
      standings: standings.some(row => row.league === league)
    };
  }

  async run() {
    const espn = new EspnJ1Source(this);
    const profiles = new OfficialProfileSource(this);
    const schedules = new OfficialScheduleSource(this);
    const officialStandings = new OfficialStandingsSource(this);

    const [j1, profileResult, scheduleResult] = await Promise.all([
      espn.load(),
      profiles.load(),
      schedules.load()
    ]);
    this.errors.push(...j1.errors, ...profileResult.errors, ...scheduleResult.errors);

    const j23Matches = scheduleResult.matches.map(match => ({
      ...match,
      home: { ...this.teams.team(match.home.appId || match.home.id) },
      away: { ...this.teams.team(match.away.appId || match.away.id) }
    }));
    const standingsResult = await officialStandings.load();
    this.errors.push(...standingsResult.errors);

    const matches = [...j1.matches, ...j23Matches]
      .sort((left, right) => new Date(left.date) - new Date(right.date));
    const standings = [...j1.standings, ...standingsResult.standings]
      .sort((left, right) => left.league.localeCompare(right.league) || Number(left.rank || 999) - Number(right.rank || 999));
    const teams = this.teams.list();
    const leaguesAvailability = Object.fromEntries(LEAGUES.map(league => [
      league.id,
      this.availabilityFor(league.id, matches, standings)
    ]));
    const output = {
      updatedAt: new Date().toISOString(),
      dataSource: 'ESPN (J1) + J.LEAGUE official site (J2/J3)',
      sourceDetails: {
        j1: 'ESPN scoreboard / standings',
        j2: 'J.LEAGUE official section pages / standings / club profiles',
        j3: 'J.LEAGUE official section pages / standings / club profiles'
      },
      competitionCode: 'jpn.1,j2,j3',
      season: OFFICIAL_SEASON,
      espnSeason: ESPN_SEASON,
      availability: {
        teams: teams.length > 0,
        matches: matches.length > 0,
        standings: standings.length > 0
      },
      leaguesAvailability,
      counts: {
        teams: Object.fromEntries(LEAGUES.map(league => [league.id, teams.filter(team => team.league === league.id).length])),
        matches: Object.fromEntries(LEAGUES.map(league => [league.id, matches.filter(match => match.league === league.id).length])),
        standings: Object.fromEntries(LEAGUES.map(league => [league.id, standings.filter(row => row.league === league.id).length])),
        officialLogos: profileResult.logoCount,
        officialVenues: profileResult.venueCount
      },
      errors: this.errors,
      teams,
      matches,
      standings
    };
    await fs.mkdir('data', { recursive: true });
    await fs.writeFile('data/jleague.json', `${JSON.stringify(output, null, 2)}\n`);
    console.log('Saved J League data:', JSON.stringify(output.counts));
    if (this.errors.length) console.warn(this.errors.join('\n'));
    return output;
  }
}

const catalog = await ClubCatalog.load('assets/js/jleague-data.js');
const client = new HttpClient();
const teams = new TeamStore(catalog);
await new JLeagueDataPipeline({ client, catalog, teams }).run();
