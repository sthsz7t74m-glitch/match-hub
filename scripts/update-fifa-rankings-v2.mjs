import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const OUTPUT_PATH = process.env.FIFA_RANKING_OUTPUT || 'data/fifa-rankings.json';
const PAGE_URLS = [
  'https://vod.fifa.com/en/fifa-world-ranking/men',
  'https://inside.fifa.com/fifa-world-ranking/men',
  'https://football-technology.fifa.com/fifa-world-ranking'
];
const FDCP_BASE = 'https://api.fifa.com/api/v3';
const HEADERS = {
  Accept: 'application/json,text/html;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'User-Agent': 'Mozilla/5.0 (compatible; MatchHubRankingBot/2.1; +https://github.com/sthsz7t74m-glitch/match-hub)'
};

const text = value => String(value ?? '').trim();
const asArray = value => Array.isArray(value) ? value : [];
const number = value => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

async function readJson(file, fallback = null) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    return fallback;
  }
}

async function fetchText(url, timeout = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      headers: HEADERS,
      redirect: 'follow',
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
    return { response, body: await response.text() };
  } finally {
    clearTimeout(timer);
  }
}

function walk(value, visit, pathName = '$') {
  if (!value || typeof value !== 'object') return;
  visit(value, pathName);
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, visit, `${pathName}[${index}]`));
  } else {
    Object.entries(value).forEach(([key, item]) => walk(item, visit, `${pathName}.${key}`));
  }
}

function findRankingConfig(html) {
  const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)];
  const candidates = [];

  for (const match of scripts) {
    const body = match[1].trim();
    if (!body || !['{', '['].includes(body[0])) continue;
    try {
      const parsed = JSON.parse(body);
      walk(parsed, (node, nodePath) => {
        if (Array.isArray(node)) return;
        const dates = asArray(node?.dates);
        const dateCount = dates.reduce((sum, group) => sum + asArray(group?.dates).length, 0);
        if (dateCount < 10) return;
        if (!node?.rankingListLabels && !node?.lastUpdateDate && !/ranking/i.test(nodePath)) return;
        candidates.push({ node, nodePath, dateCount });
      });
    } catch {
      // Ignore non-JSON JavaScript blocks.
    }
  }

  if (!candidates.length) throw new Error('FIFA ranking date configuration was not found');
  return candidates.sort((left, right) => right.dateCount - left.dateCount)[0].node;
}

function latestRankingDate(config) {
  const entries = asArray(config?.dates)
    .flatMap(group => asArray(group?.dates))
    .filter(entry => text(entry?.id) && text(entry?.iso || entry?.matchWindowEndDate));

  if (!entries.length) throw new Error('FIFA ranking date list is empty');
  entries.sort((left, right) => {
    const leftTime = Date.parse(left.iso || left.matchWindowEndDate || '') || 0;
    const rightTime = Date.parse(right.iso || right.matchWindowEndDate || '') || 0;
    return rightTime - leftTime;
  });
  return entries[0];
}

function normalizeFdcpRow(row) {
  const rank = number(row?.Rank);
  const name = text(row?.TeamName);
  const code = text(row?.IdCountry).toUpperCase();
  if (!rank || !name || !code) return null;

  const previousRank = number(row?.PrevRank);
  const points = number(row?.TotalPoints);
  return {
    rank,
    previousRank,
    movement: previousRank ? previousRank - rank : 0,
    points,
    previousPoints: number(row?.PrevPoints),
    code,
    name,
    confederation: text(row?.ConfederationName),
    flag: `${FDCP_BASE}/picture/flags-sq-2/${encodeURIComponent(code)}`,
    teamId: text(row?.IdTeam)
  };
}

async function fetchRanking(scheduleId) {
  const parameters = new URLSearchParams({
    rankingScheduleId: scheduleId,
    count: '500',
    language: 'en'
  });
  const url = `${FDCP_BASE}/fifarankings/rankings/rankingsbyschedule?${parameters}`;
  const { body } = await fetchText(url, 30000);
  const payload = JSON.parse(body);
  const rankings = asArray(payload?.Results)
    .map(normalizeFdcpRow)
    .filter(Boolean)
    .sort((left, right) => left.rank - right.rank);

  if (rankings.length < 50) {
    throw new Error(`Official FDCP returned only ${rankings.length} ranking rows`);
  }
  return { url, rankings };
}

function signature(value) {
  return JSON.stringify({
    officialDate: value?.officialDate || null,
    dateId: value?.dateId || '',
    rankings: asArray(value?.rankings).map(entry => [
      entry.rank,
      entry.previousRank,
      entry.points,
      entry.code,
      entry.name,
      entry.confederation
    ])
  });
}

const existing = await readJson(OUTPUT_PATH, { rankings: [] });
const pageErrors = [];
let page = null;
let rankingConfig = null;

for (const url of PAGE_URLS) {
  try {
    const result = await fetchText(url);
    const config = findRankingConfig(result.body);
    page = { url: result.response.url || url };
    rankingConfig = config;
    break;
  } catch (error) {
    pageErrors.push(`${url}: ${error.message}`);
  }
}

if (!page || !rankingConfig) {
  if (asArray(existing?.rankings).length >= 50) {
    console.warn(`Keeping previous FIFA ranking data: ${pageErrors.join(' | ')}`);
    process.exit(0);
  }
  throw new Error(`FIFA ranking page unavailable: ${pageErrors.join(' | ')}`);
}

const currentDate = latestRankingDate(rankingConfig);
const officialDate = text(currentDate.matchWindowEndDate || currentDate.iso).slice(0, 10);
const dateId = text(currentDate.id);
const rankingResult = await fetchRanking(dateId);
const output = {
  schemaVersion: 1,
  source: "FIFA/Coca-Cola Men's World Ranking",
  sourceUrl: page.url,
  apiUrl: rankingResult.url,
  fetchedAt: new Date().toISOString(),
  officialDate,
  nextOfficialDate: text(rankingConfig.nextUpdateDate).slice(0, 10) || null,
  dateId,
  rankingCount: rankingResult.rankings.length,
  rankings: rankingResult.rankings
};

if (signature(existing) === signature(output)) {
  console.log(`FIFA ranking unchanged (${output.rankingCount} teams, ${officialDate}).`);
} else {
  await writeFile(path.resolve(OUTPUT_PATH), `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(`Updated ${output.rankingCount} FIFA rankings for ${officialDate} at ${OUTPUT_PATH}.`);
}
