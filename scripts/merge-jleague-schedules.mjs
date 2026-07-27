import fs from 'node:fs/promises';
import vm from 'node:vm';

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

class HttpClient {
  constructor({ retries = 2, timeoutMs = 25000 } = {}) {
    Object.assign(this, { retries, timeoutMs });
  }

  async getText(url) {
    let lastError = null;
    for (let attempt = 0; attempt <= this.retries; attempt += 1) {
      try {
        const response = await fetch(url, {
          redirect: 'follow',
          cache: 'no-store',
          headers: {
            'User-Agent': 'match-hub/2.1 (+https://github.com/sthsz7t74m-glitch/match-hub)',
            'Accept-Language': 'ja,en;q=0.8'
          },
          signal: AbortSignal.timeout(this.timeoutMs)
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        return response.text();
      } catch (error) {
        lastError = error;
        if (attempt < this.retries) await new Promise(resolve => setTimeout(resolve, 700 * (attempt + 1)));
      }
    }
    throw new Error(`${url}: ${lastError?.message || 'request failed'}`);
  }
}

class Catalog {
  static async load() {
    const source = await fs.readFile('assets/js/jleague-data.js', 'utf8');
    const sandbox = { window: {}, console };
    vm.runInNewContext(source, sandbox, { filename: 'assets/js/jleague-data.js' });
    return new Catalog(sandbox.window.SportsHubJLeague);
  }

  constructor(source) {
    this.source = source;
    this.clubs = [...source.clubs];
    this.aliases = new Map(['j2', 'j3'].map(league => [league, this.clubs
      .filter(club => club.league === league)
      .flatMap(club => (club.aliases || [club.name]).map(alias => ({ club, alias, key: normalize(alias) })))
      .filter(item => item.key)
      .sort((left, right) => right.key.length - left.key.length)]));
  }

  forLeague(league) {
    return this.clubs.filter(club => club.league === league);
  }

  ordered(text, league) {
    const value = normalize(text);
    const matches = [];
    for (const item of this.aliases.get(league) || []) {
      let offset = 0;
      while (offset < value.length) {
        const index = value.indexOf(item.key, offset);
        if (index < 0) break;
        matches.push({ ...item, index });
        offset = index + Math.max(item.key.length, 1);
      }
    }
    matches.sort((left, right) => left.index - right.index || right.key.length - left.key.length);
    const seen = new Set();
    return matches.filter(item => {
      if (seen.has(item.club.id)) return false;
      seen.add(item.club.id);
      return true;
    });
  }
}

class OfficialScheduleMerger {
  constructor({ client, catalog, data }) {
    Object.assign(this, { client, catalog, data });
    this.teamByClub = new Map((data.teams || []).map(team => [team.appId || team.id, team]));
    this.errors = [];
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

  extractVenue(text, home, away) {
    let value = String(text || '');
    const time = value.match(/(?:[01]?\d|2[0-3]):[0-5]\d/);
    if (time) value = value.slice((time.index || 0) + time[0].length);
    for (const alias of [...home.aliases, ...away.aliases].sort((left, right) => right.length - left.length)) {
      value = value.replaceAll(alias, ' ');
    }
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

  parseMatch({ href, body, league, round }) {
    const route = String(href).match(/\/match\/(j2|j3)\/(2026|2027)\/(\d{6})\/?/i);
    if (!route || route[1].toLowerCase() !== league) return null;
    const text = stripTags(body).replace(/[{}[\]",:]/g, ' ').replace(/\s+/g, ' ');
    const ordered = this.catalog.ordered(text, league).slice(0, 2);
    if (ordered.length < 2 || ordered[0].club.id === ordered[1].club.id) return null;
    const home = ordered[0].club;
    const away = ordered[1].club;
    const year = Number(route[2]);
    const code = route[3];
    const month = Number(code.slice(0, 2));
    const day = Number(code.slice(2, 4));
    if (!month || !day) return null;
    const time = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
    const hour = time ? Number(time[1]) : 12;
    const minute = time ? Number(time[2]) : 0;
    const date = new Date(Date.UTC(year, month - 1, day, hour - 9, minute)).toISOString();
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
    const decoded = decodeSerializedPage(html);
    const matches = [];
    for (const source of [html, decoded]) {
      const anchors = [...source.matchAll(/<a\b[^>]*href=["']([^"']*\/match\/(?:j2|j3)\/(?:2026|2027)\/\d{6}\/?[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi)];
      matches.push(...anchors.map(anchor => this.parseMatch({ href: anchor[1], body: anchor[2], league, round })).filter(Boolean));
    }
    if (matches.length) return [...new Map(matches.map(match => [match.id, match])).values()];

    const routePattern = new RegExp(`(?:https?:\\/\\/www\\.jleague\\.jp)?\\/match\\/${league}\\/(2026|2027)\\/(\\d{6})\\/?`, 'gi');
    const routes = [...decoded.matchAll(routePattern)];
    const uniqueRoutes = [...new Map(routes.map(route => [`${route[1]}-${route[2]}`, route])).values()];
    uniqueRoutes.forEach((route, index) => {
      const previous = uniqueRoutes[index - 1]?.index ?? 0;
      const next = uniqueRoutes[index + 1]?.index ?? decoded.length;
      const start = Math.max(previous, (route.index || 0) - 2200);
      const end = Math.min(next, (route.index || 0) + 3200);
      const parsed = this.parseMatch({
        href: `/match/${league}/${route[1]}/${route[2]}/`,
        body: decoded.slice(start, end),
        league,
        round
      });
      if (parsed) matches.push(parsed);
    });
    return [...new Map(matches.map(match => [match.id, match])).values()];
  }

  async loadRound(league, round) {
    const url = `https://www.jleague.jp/sp/match/section/${league}/${round}/?v=${Date.now()}-${round}`;
    const html = await this.client.getText(url);
    const matches = this.parsePage(html, league, round);
    if (!matches.length) {
      const decoded = decodeSerializedPage(html);
      const routeCount = (decoded.match(new RegExp(`/match/${league}/(?:2026|2027)/`, 'gi')) || []).length;
      const clubHits = this.catalog.forLeague(league).filter(club => normalize(decoded).includes(normalize(club.shortName || club.name))).length;
      throw new Error(`no matches parsed (html=${html.length}, routes=${routeCount}, clubs=${clubHits})`);
    }
    return matches;
  }

  async loadLeague(league) {
    const rounds = Array.from({ length: 38 }, (_, index) => index + 1);
    const results = await parallelMap(rounds, 4, async round => {
      try {
        return await this.loadRound(league, round);
      } catch (error) {
        this.errors.push(`${league} round ${round}: ${error.message}`);
        return [];
      }
    });
    const matches = [...new Map(results.flat().map(match => [match.id, match])).values()];
    if (matches.length < 300) this.errors.push(`${league} schedule validation: parsed ${matches.length}`);
    return matches;
  }

  async run() {
    const [j2, j3] = await Promise.all([this.loadLeague('j2'), this.loadLeague('j3')]);
    const retained = (this.data.matches || []).filter(match => !['j2', 'j3'].includes(match.league));
    this.data.matches = [...retained, ...j2, ...j3].sort((left, right) => new Date(left.date) - new Date(right.date));
    this.data.errors = (this.data.errors || [])
      .filter(error => !/^j[23] (?:round|schedule validation)/.test(error))
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
    this.data.updatedAt = new Date().toISOString();
    await fs.writeFile('data/jleague.json', `${JSON.stringify(this.data, null, 2)}\n`);
    console.log('Merged official schedules:', this.data.counts.matches);
    if (this.errors.length) console.warn(this.errors.join('\n'));
  }
}

const catalog = await Catalog.load();
const data = JSON.parse(await fs.readFile('data/jleague.json', 'utf8'));
await new OfficialScheduleMerger({ client: new HttpClient(), catalog, data }).run();
