import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const PDF_UPDATED_AT = '2026-07-01';
const PDF_SOURCES = Object.freeze({
  j2: 'https://www.jleague.jp/img/pdf/2026_0701_j2.pdf',
  j3: 'https://www.jleague.jp/img/pdf/2026_0701_j3.pdf'
});
const EXPECTED_MATCHES = 380;
const MATCHES_PER_ROUND = 10;

const normalizeText = value => String(value ?? '')
  .normalize('NFKC')
  .replace(/\u00a0/g, ' ')
  .replace(/[ \t]+/g, ' ')
  .trim();

const normalizeKey = value => normalizeText(value)
  .toLocaleLowerCase('ja')
  .replace(/f\.c\.|fc/g, '')
  .replace(/[・･.．\-ー_\s]/g, '')
  .replace(/ユナイテッド/g, '')
  .replace(/1969/g, '');

const unique = values => [...new Set(values.filter(Boolean))];
const pad = value => String(value).padStart(2, '0');
const toDateKey = ({ year, month, day }) => `${year}-${pad(month)}-${pad(day)}`;
const toJstIso = ({ year, month, day }, time = null) => {
  const hour = time?.hour ?? 12;
  const minute = time?.minute ?? 0;
  return new Date(Date.UTC(year, month - 1, day, hour - 9, minute)).toISOString();
};

class HttpClient {
  constructor({ retries = 2, timeoutMs = 30000 } = {}) {
    Object.assign(this, { retries, timeoutMs });
  }

  async getBuffer(url) {
    let lastError = null;
    for (let attempt = 0; attempt <= this.retries; attempt += 1) {
      try {
        const response = await fetch(url, {
          redirect: 'follow',
          cache: 'no-store',
          headers: {
            'User-Agent': 'match-hub/3.0 (+https://github.com/sthsz7t74m-glitch/match-hub)',
            Accept: 'application/pdf,*/*;q=0.8',
            'Accept-Language': 'ja-JP,ja;q=0.9,en;q=0.5'
          },
          signal: AbortSignal.timeout(this.timeoutMs)
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        return Buffer.from(await response.arrayBuffer());
      } catch (error) {
        lastError = error;
        if (attempt < this.retries) await new Promise(resolve => setTimeout(resolve, 800 * (attempt + 1)));
      }
    }
    throw new Error(`${url}: ${lastError?.message || 'download failed'}`);
  }
}

class ClubCatalog {
  static async load(file = 'assets/js/jleague-data.js') {
    const source = await fs.readFile(file, 'utf8');
    const sandbox = { window: {}, console };
    vm.runInNewContext(source, sandbox, { filename: file });
    return new ClubCatalog(sandbox.window.SportsHubJLeague);
  }

  constructor(source) {
    this.source = source;
    this.clubs = [...source.clubs];
    this.aliases = new Map(['j2', 'j3'].map(league => [league, this.clubs
      .filter(club => club.league === league)
      .flatMap(club => (club.aliases || [club.name]).map(alias => ({
        club,
        alias: normalizeText(alias),
        key: normalizeKey(alias)
      })))
      .filter(item => item.key)
      .sort((left, right) => right.key.length - left.key.length)]));
  }

  findInSegment(segment, league, side) {
    const value = normalizeKey(segment);
    const candidates = [];
    for (const item of this.aliases.get(league) || []) {
      const index = side === 'home' ? value.lastIndexOf(item.key) : value.indexOf(item.key);
      if (index >= 0) candidates.push({ ...item, index });
    }
    candidates.sort((left, right) => side === 'home'
      ? right.index - left.index || right.key.length - left.key.length
      : left.index - right.index || right.key.length - left.key.length);
    return candidates[0] || null;
  }
}

class TeamStore {
  constructor({ data, catalog }) {
    this.catalog = catalog;
    this.byClub = new Map((data.teams || []).map(team => [String(team.appId || team.id), team]));
  }

  get(club) {
    return { ...(this.byClub.get(club.id) || {
      id: club.id,
      appId: club.id,
      league: club.league,
      name: club.name,
      shortName: club.shortName || club.name,
      tla: '',
      logo: '',
      venue: '',
      area: club.area,
      officialSlug: club.officialSlugs?.[0] || ''
    }) };
  }
}

class PdfTextExtractor {
  constructor({ client = new HttpClient() } = {}) {
    this.client = client;
  }

  async extract(url, label) {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'match-hub-jleague-'));
    const pdfPath = path.join(directory, `${label}.pdf`);
    const textPath = path.join(directory, `${label}.txt`);
    try {
      await fs.writeFile(pdfPath, await this.client.getBuffer(url));
      await execFileAsync('pdftotext', ['-layout', '-nopgbrk', '-enc', 'UTF-8', pdfPath, textPath], {
        maxBuffer: 16 * 1024 * 1024
      });
      return await fs.readFile(textPath, 'utf8');
    } finally {
      await fs.rm(directory, { recursive: true, force: true });
    }
  }
}

class OfficialPdfScheduleParser {
  constructor({ catalog, teams, league, sourceUrl }) {
    Object.assign(this, { catalog, teams, league, sourceUrl });
    this.context = {
      prospectiveRound: 1,
      exactDate: null,
      candidateDates: []
    };
    this.rows = [];
  }

  datesFromLine(line) {
    return [...line.matchAll(/(\d{2})\/(\d{1,2})\/(\d{1,2})\([^)]+\)/g)].map(match => ({
      year: 2000 + Number(match[1]),
      month: Number(match[2]),
      day: Number(match[3])
    }));
  }

  kickoffFromSegment(segment) {
    const match = segment.match(/(?:^|\s)([01]?\d|2[0-3]):([0-5]\d)(?:\s|$)/);
    return match ? { hour: Number(match[1]), minute: Number(match[2]) } : null;
  }

  splitMatch(line) {
    const match = line.match(/^(.*?)\s+vs\.\s+(.*)$/i);
    if (!match) return null;
    const home = this.catalog.findInSegment(match[1], this.league, 'home');
    const away = this.catalog.findInSegment(match[2], this.league, 'away');
    if (!home || !away || home.club.id === away.club.id) return null;
    return { home, away, homeSegment: match[1], awaySegment: match[2] };
  }

  extractStadiumAndBroadcast(awaySegment, away) {
    const normalized = normalizeText(awaySegment);
    const aliasIndex = normalizeKey(normalized).indexOf(away.key);
    let tail = normalized;
    if (aliasIndex >= 0) {
      const aliases = (away.club.aliases || [away.club.name]).map(normalizeText).sort((a, b) => b.length - a.length);
      const literalAlias = aliases.find(alias => normalizeKey(normalized).includes(normalizeKey(alias))) || away.alias;
      const literalIndex = normalized.indexOf(literalAlias);
      if (literalIndex >= 0) tail = normalized.slice(literalIndex + literalAlias.length).trim();
    }
    const broadcastMatch = tail.match(/(?:^|\s)(DAZN|NHK|BS\d*|テレビ|TV|ABEMA|Lemino|YouTube|地上波)(?:\s|\/|$)/i);
    const stadium = (broadcastMatch ? tail.slice(0, broadcastMatch.index).trim() : tail).replace(/^[-・\s]+|[-・\s]+$/g, '');
    const broadcast = broadcastMatch ? tail.slice(broadcastMatch.index).trim() : '';
    return { stadium: stadium || '未定', broadcast };
  }

  updateDateContext(line, kickoff, matchIndex) {
    const prospectiveRound = Math.floor(matchIndex / MATCHES_PER_ROUND) + 1;
    if (prospectiveRound !== this.context.prospectiveRound) {
      this.context = { prospectiveRound, exactDate: null, candidateDates: [] };
    }
    const dates = this.datesFromLine(line);
    if (kickoff) {
      if (dates.length) this.context.exactDate = dates.at(-1);
      return dates;
    }
    if (dates.length) this.context.candidateDates = unique([
      ...this.context.candidateDates.map(toDateKey),
      ...dates.map(toDateKey)
    ]).map(value => {
      const [year, month, day] = value.split('-').map(Number);
      return { year, month, day };
    });
    return dates;
  }

  ingestLine(rawLine) {
    let line = normalizeText(rawLine.replace(/\f/g, ' '));
    if (!line) return;
    const possibleRound = line.match(/^(\d{1,2})\s+(?=(?:\d{2}\/\d{1,2}\/\d{1,2}|or\b|未定\b|\d{1,2}:\d{2}\b|.*?\bvs\.))/i);
    if (possibleRound && Number(possibleRound[1]) >= 1 && Number(possibleRound[1]) <= 38) {
      line = line.slice(possibleRound[0].length - (possibleRound[0].match(/\s+$/)?.[0].length || 0)).trim();
    }
    const split = this.splitMatch(line);
    const kickoff = split ? this.kickoffFromSegment(split.homeSegment) : null;
    this.updateDateContext(line, kickoff, this.rows.length);
    if (!split) return;

    const round = Math.floor(this.rows.length / MATCHES_PER_ROUND) + 1;
    const date = kickoff ? this.context.exactDate : null;
    const details = this.extractStadiumAndBroadcast(split.awaySegment, split.away);
    this.rows.push({
      round,
      homeClub: split.home.club,
      awayClub: split.away.club,
      kickoff,
      exactDate: date,
      candidateDates: this.context.candidateDates.map(toDateKey),
      ...details
    });
  }

  finalizeRoundDates() {
    const groups = new Map();
    this.rows.forEach(row => {
      const values = groups.get(row.round) || [];
      values.push(...row.candidateDates);
      if (row.exactDate) values.push(toDateKey(row.exactDate));
      groups.set(row.round, unique(values).sort());
    });
    this.rows.forEach(row => {
      if (!row.kickoff) row.candidateDates = groups.get(row.round) || row.candidateDates;
    });
  }

  validate() {
    if (this.rows.length !== EXPECTED_MATCHES) {
      throw new Error(`${this.league} PDF parser expected ${EXPECTED_MATCHES} matches, parsed ${this.rows.length}`);
    }
    for (let round = 1; round <= 38; round += 1) {
      const matches = this.rows.filter(row => row.round === round);
      if (matches.length !== MATCHES_PER_ROUND) throw new Error(`${this.league} round ${round} parsed ${matches.length} matches`);
      const appearances = new Set(matches.flatMap(row => [row.homeClub.id, row.awayClub.id]));
      if (appearances.size !== 20) throw new Error(`${this.league} round ${round} contains ${appearances.size} unique clubs`);
    }
  }

  toMatch(row, index) {
    const candidateDates = row.candidateDates.length
      ? row.candidateDates
      : row.exactDate ? [toDateKey(row.exactDate)] : [];
    if (!candidateDates.length) throw new Error(`${this.league} round ${row.round} match ${index + 1} has no date`);
    const selectedDate = row.exactDate || (() => {
      const [year, month, day] = candidateDates[0].split('-').map(Number);
      return { year, month, day };
    })();
    return {
      id: `jleague-pdf-${this.league}-r${pad(row.round)}-m${pad((index % MATCHES_PER_ROUND) + 1)}`,
      sourceId: `${this.league}-${row.round}-${(index % MATCHES_PER_ROUND) + 1}`,
      sourceUrl: this.sourceUrl,
      source: 'jleague-official-pdf',
      sourceUpdatedAt: PDF_UPDATED_AT,
      league: this.league,
      date: toJstIso(selectedDate, row.kickoff),
      dateCandidates: candidateDates,
      datePrecision: row.kickoff ? 'exact' : candidateDates.length > 1 ? 'candidate' : 'date',
      timeTbd: !row.kickoff,
      status: 'SCHEDULED',
      matchday: row.round,
      stage: `2026/27-${this.league}`,
      competition: this.league === 'j2' ? '明治安田J2リーグ' : '明治安田J3リーグ',
      home: this.teams.get(row.homeClub),
      away: this.teams.get(row.awayClub),
      score: { home: null, away: null },
      venue: row.stadium,
      broadcast: row.broadcast,
      round: `第${row.round}節`
    };
  }

  parse(text) {
    text.split(/\r?\n/).forEach(line => this.ingestLine(line));
    this.finalizeRoundDates();
    this.validate();
    return this.rows.map((row, index) => this.toMatch(row, index));
  }
}

class OfficialPdfSchedulePipeline {
  constructor({ data, catalog, extractor = new PdfTextExtractor() }) {
    this.data = data;
    this.catalog = catalog;
    this.extractor = extractor;
    this.teams = new TeamStore({ data, catalog });
  }

  async loadLeague(league) {
    const sourceUrl = PDF_SOURCES[league];
    const text = await this.extractor.extract(sourceUrl, league);
    return new OfficialPdfScheduleParser({
      catalog: this.catalog,
      teams: this.teams,
      league,
      sourceUrl
    }).parse(text);
  }

  async run() {
    const [j2, j3] = await Promise.all(['j2', 'j3'].map(league => this.loadLeague(league)));
    const retained = (this.data.matches || []).filter(match => !['j2', 'j3'].includes(match.league));
    this.data.matches = [...retained, ...j2, ...j3].sort((left, right) => new Date(left.date) - new Date(right.date));
    this.data.errors = (this.data.errors || []).filter(error => !/^j[23] (?:round|schedule validation|date schedule validation|section schedule validation|prerender schedule validation)/.test(error));
    this.data.leaguesAvailability = this.data.leaguesAvailability || {};
    this.data.leaguesAvailability.j2 = { ...(this.data.leaguesAvailability.j2 || {}), matches: true };
    this.data.leaguesAvailability.j3 = { ...(this.data.leaguesAvailability.j3 || {}), matches: true };
    this.data.counts = this.data.counts || {};
    this.data.counts.matches = {
      j1: retained.filter(match => match.league === 'j1').length,
      j2: j2.length,
      j3: j3.length
    };
    this.data.sourceDetails = {
      ...(this.data.sourceDetails || {}),
      j2: 'J.LEAGUE official 2026/27 schedule PDF / standings / club profiles',
      j3: 'J.LEAGUE official 2026/27 schedule PDF / standings / club profiles'
    };
    this.data.fetchMetadata = {
      ...(this.data.fetchMetadata || {}),
      officialSchedulePdfUpdatedAt: PDF_UPDATED_AT,
      officialSchedulePdf: PDF_SOURCES
    };
    this.data.updatedAt = new Date().toISOString();
    await fs.writeFile('data/jleague.json', `${JSON.stringify(this.data, null, 2)}\n`);
    console.log('Merged full official PDF schedules:', this.data.counts.matches);
  }
}

const catalog = await ClubCatalog.load();
const data = JSON.parse(await fs.readFile('data/jleague.json', 'utf8'));
await new OfficialPdfSchedulePipeline({ data, catalog }).run();
