import fs from 'node:fs/promises';
import vm from 'node:vm';

const LEAGUES = ['j2', 'j3'];
const ROUND_COUNT = 38;
const USER_AGENTS = [
  {
    id: 'googlebot-mobile',
    value: 'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2272.96 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
  },
  {
    id: 'bingbot',
    value: 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)'
  },
  {
    id: 'browser',
    value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36'
  }
];

const decodeEntities = value => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
  .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>');

const decodeSerializedPage = html => decodeEntities(String(html ?? ''))
  .replace(/\\u([0-9a-f]{4})/gi, (_, code) => String.fromCharCode(Number.parseInt(code, 16)))
  .replace(/\\x([0-9a-f]{2})/gi, (_, code) => String.fromCharCode(Number.parseInt(code, 16)))
  .replace(/\\\//g, '/')
  .replace(/\\"/g, '"')
  .replace(/\\n|\\r|\\t/g, ' ');

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

const absoluteUrl = value => {
  try { return new URL(value, 'https://www.jleague.jp').href; } catch { return ''; }
};

const parallelMap = async (items, limit, worker) => {
  const results = new Array(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index], index);
    }
  }));
  return results;
};

class OfficialPageClient {
  constructor({ retries = 1, timeoutMs = 25000 } = {}) {
    Object.assign(this, { retries, timeoutMs });
  }

  async request(url, userAgent) {
    let lastError = null;
    for (let attempt = 0; attempt <= this.retries; attempt += 1) {
      try {
        const response = await fetch(url, {
          redirect: 'follow',
          cache: 'no-store',
          headers: {
            'User-Agent': userAgent,
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'ja-JP,ja;q=0.9,en;q=0.6',
            'Cache-Control': 'no-cache',
            Pragma: 'no-cache'
          },
          signal: AbortSignal.timeout(this.timeoutMs)
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        return response.text();
      } catch (error) {
        lastError = error;
        if (attempt < this.retries) await new Promise(resolve => setTimeout(resolve, 650 * (attempt + 1)));
      }
    }
    throw lastError || new Error('request failed');
  }

  routeCount(html, league) {
    return (decodeSerializedPage(html).match(new RegExp(`/match/${league}/(?:2026|2027)/\\d{6}`, 'gi')) || []).length;
  }

  async getPrerendered(url, league) {
    const attempts = [];
    for (const agent of USER_AGENTS) {
      try {
        const html = await this.request(url, agent.value);
        const routes = this.routeCount(html, league);
        attempts.push(`${agent.id}:${html.length}/${routes}`);
        if (routes > 0) return { html, agent: agent.id, attempts };
      } catch (error) {
        attempts.push(`${agent.id}:error:${error.message}`);
      }
    }
    return { html: '', agent: '', attempts };
  }
}

class ClubCatalog {
  static async load() {
    const source = await fs.readFile('assets/js/jleague-data.js', 'utf8');
    const sandbox = { window: {}, console };
    vm.runInNewContext(source, sandbox, { filename: 'assets/js/jleague-data.js' });
    return new ClubCatalog(sandbox.window.SportsHubJLeague);
  }

  constructor(source) {
    this.source = source;
    this.clubs = [...source.clubs];
    this.aliases = new Map(LEAGUES.map(league => [league, this.clubs
      .filter(club => club.league === league)
      .flatMap(club => (club.aliases || [club.name]).map(alias => ({ club, key: normalize(alias) })))
      .filter(item => item.key)
      .sort((left, right) => right.key.length - left.key.length)]));
  }

  ordered(text, league) {
    const value = normalize(text);
    const found = [];
    for (const item of this.aliases.get(league) || []) {
      let offset = 0;
      while (offset < value.length) {
        const index = value.indexOf(item.key, offset);
        if (index < 0) break;
        found.push({ ...item, index });
        offset = index + Math.max(item.key.length, 1);
      }
    }
    found.sort((left, right) => left.index - right.index || right.key.length - left.key.length);
    const seen = new Set();
    return found.filter(item => {
      if (seen.has(item.club.id)) return false;
      seen.add(item.club.id);
      return true;
    });
  }
}

class OfficialSectionScheduleSource {
  constructor({ client, catalog, data }) {
    Object.assign(this, { client, catalog, data });
    this.teamByClub = new Map((data.teams || []).map(team => [team.appId || team.id, team]));
    this.errors = [];
    this.agentCounts = new Map();
  }

  team(club) {
    return { ...(this.teamByClub.get(club.id) || {
      id: club.id,
      appId: club.id,
      league: club.league,
      name: club.name,
      shortName: club.shortName,
      logo: '',
      venue: '',
      area: club.area
    }) };
  }

  blockAround(source, index) {
    const candidates = [
      ['<tr', '</tr>', 25000],
      ['<li', '</li>', 25000],
      ['<article', '</article>', 30000],
      ['<a', '</a>', 12000]
    ];
    for (const [opening, closing, limit] of candidates) {
      const start = source.lastIndexOf(opening, index);
      const end = source.indexOf(closing, index);
      if (start >= 0 && end >= index && end - start < limit) return source.slice(start, end + closing.length);
    }
    return source.slice(Math.max(0, index - 1800), Math.min(source.length, index + 2800));
  }

  extractVenue(text, home, away) {
    let value = String(text || '');
    const time = value.match(/(?:[01]?\d|2[0-3]):[0-5]\d/);
    if (time) value = value.slice((time.index || 0) + time[0].length);
    for (const alias of [...home.aliases, ...away.aliases].sort((left, right) => right.length - left.length)) value = value.replaceAll(alias, ' ');
    return value
      .replace(/ＶＳ|VS|試合終了|前半|後半|延長|PK/gi, ' ')
      .replace(/\b\d{1,2}\s*[-－]\s*\d{1,2}\b/g, ' ')
      .replace(/DAZN[\s\S]*$/i, ' ')
      .replace(/チケット[\s\S]*$/i, ' ')
      .replace(/対戦データ[\s\S]*$/i, ' ')
      .replace(/試合詳細[\s\S]*$/i, ' ')
      .replace(/観戦情報[\s\S]*$/i, ' ')
      .replace(/見どころ[\s\S]*$/i, ' ')
      .replace(/テレビ放送[\s\S]*$/i, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 140);
  }

  parseMatch({ href, body, league, round }) {
    const route = String(href).match(/\/match\/(j2|j3)\/(2026|2027)\/(\d{6})\/?/i);
    if (!route || route[1].toLowerCase() !== league) return null;
    const text = stripTags(body).replace(/[{}[\]",:]/g, ' ').replace(/\s+/g, ' ');
    const ordered = this.catalog.ordered(text, league).slice(0, 2);
    if (ordered.length < 2 || ordered[0].club.id === ordered[1].club.id) return null;
    const home = ordered[0].club;
    const away = ordered[1].club;
    const code = route[3];
    const month = Number(code.slice(0, 2));
    const day = Number(code.slice(2, 4));
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const time = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
    const hour = time ? Number(time[1]) : 12;
    const minute = time ? Number(time[2]) : 0;
    const date = new Date(Date.UTC(Number(route[2]), month - 1, day, hour - 9, minute)).toISOString();
    const score = text.match(/(?:^|\D)(\d{1,2})\s*[-－]\s*(\d{1,2})(?:\D|$)/);
    const live = /LIVE|前半|後半|ハーフタイム/i.test(text);
    const unavailable = /延期|中止|中断/.test(text);
    const status = unavailable ? (/中止/.test(text) ? 'CANCELLED' : /中断/.test(text) ? 'SUSPENDED' : 'POSTPONED')
      : score ? (live ? 'IN_PLAY' : 'FINISHED')
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
      stage: `2026/27-${league}`,
      competition: league === 'j2' ? '明治安田J2リーグ' : '明治安田J3リーグ',
      home: this.team(home),
      away: this.team(away),
      score: { home: score ? Number(score[1]) : null, away: score ? Number(score[2]) : null },
      venue: this.extractVenue(text, home, away),
      round: `第${round}節`
    };
  }

  parsePage(html, league, round) {
    const source = decodeSerializedPage(html);
    const routePattern = new RegExp(`(?:https?:\\/\\/www\\.jleague\\.jp)?\\/match\\/${league}\\/(2026|2027)\\/(\\d{6})\\/?`, 'gi');
    const routes = [...source.matchAll(routePattern)];
    const uniqueRoutes = [...new Map(routes.map(route => [`${route[1]}-${route[2]}`, route])).values()];
    const matches = uniqueRoutes.map(route => this.parseMatch({
      href: `/match/${league}/${route[1]}/${route[2]}/`,
      body: this.blockAround(source, route.index || 0),
      league,
      round
    })).filter(Boolean);
    return [...new Map(matches.map(match => [match.id, match])).values()];
  }

  async loadRound(league, round) {
    const url = `https://www.jleague.jp/match/section/${league}/${round}/?v=${Date.now()}-${round}`;
    const response = await this.client.getPrerendered(url, league);
    if (!response.html) throw new Error(`pre-render unavailable (${response.attempts.join(', ')})`);
    this.agentCounts.set(response.agent, (this.agentCounts.get(response.agent) || 0) + 1);
    const matches = this.parsePage(response.html, league, round);
    if (!matches.length) throw new Error(`routes found but no matches parsed (${response.agent}; ${response.attempts.join(', ')})`);
    return matches;
  }

  async loadLeague(league) {
    const rounds = Array.from({ length: ROUND_COUNT }, (_, index) => index + 1);
    const results = await parallelMap(rounds, 4, async round => {
      try {
        return await this.loadRound(league, round);
      } catch (error) {
        this.errors.push(`${league} round ${round}: ${error.message}`);
        return [];
      }
    });
    const matches = [...new Map(results.flat().map(match => [match.id, match])).values()];
    if (matches.length < 300) this.errors.push(`${league} prerender schedule validation: parsed ${matches.length}`);
    return matches;
  }

  async run() {
    const [j2, j3] = await Promise.all(LEAGUES.map(league => this.loadLeague(league)));
    const retained = (this.data.matches || []).filter(match => !LEAGUES.includes(match.league));
    this.data.matches = [...retained, ...j2, ...j3].sort((left, right) => new Date(left.date) - new Date(right.date));
    this.data.errors = (this.data.errors || [])
      .filter(error => !/^j[23] (?:round|schedule validation|date schedule validation|section schedule validation|prerender schedule validation)/.test(error))
      .concat(this.errors);
    this.data.leaguesAvailability = this.data.leaguesAvailability || {};
    this.data.leaguesAvailability.j2 = { ...(this.data.leaguesAvailability.j2 || {}), matches: j2.length > 0 };
    this.data.leaguesAvailability.j3 = { ...(this.data.leaguesAvailability.j3 || {}), matches: j3.length > 0 };
    this.data.counts = this.data.counts || {};
    this.data.counts.matches = {
      j1: retained.filter(match => match.league === 'j1').length,
      j2: j2.length,
      j3: j3.length
    };
    this.data.sourceDetails = {
      ...(this.data.sourceDetails || {}),
      j2: 'J.LEAGUE official pre-rendered section pages / standings / club profiles',
      j3: 'J.LEAGUE official pre-rendered section pages / standings / club profiles'
    };
    this.data.fetchMetadata = {
      ...(this.data.fetchMetadata || {}),
      officialSectionAgents: Object.fromEntries(this.agentCounts)
    };
    this.data.updatedAt = new Date().toISOString();
    await fs.writeFile('data/jleague.json', `${JSON.stringify(this.data, null, 2)}\n`);
    console.log('Merged official schedules:', this.data.counts.matches, this.data.fetchMetadata.officialSectionAgents);
    if (this.errors.length) console.warn(this.errors.join('\n'));
  }
}

const catalog = await ClubCatalog.load();
const data = JSON.parse(await fs.readFile('data/jleague.json', 'utf8'));
await new OfficialSectionScheduleSource({ client: new OfficialPageClient(), catalog, data }).run();
