import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const OUTPUT_PATH = process.env.FIFA_RANKING_OUTPUT || 'data/fifa-rankings.json';
const PAGE_URLS = [
  'https://vod.fifa.com/en/fifa-world-ranking/men',
  'https://inside.fifa.com/fifa-world-ranking/men',
  'https://football-technology.fifa.com/fifa-world-ranking'
];
const API_BASES = [
  'https://vod.fifa.com/api/ranking-overview',
  'https://inside.fifa.com/api/ranking-overview',
  'https://rusecure.fifa.com/api/ranking-overview'
];
const HEADERS = {
  Accept: 'application/json,text/html;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'User-Agent': 'Mozilla/5.0 (compatible; MatchHubRankingBot/2.0; +https://github.com/sthsz7t74m-glitch/match-hub)'
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

function flagCodeFrom(value) {
  const match = text(value).match(/\/([A-Z]{3})(?:\?|$)/i);
  return match ? match[1].toUpperCase() : '';
}

function normalizeRankingRow(row) {
  const item = row?.rankingItem || row?.ranking || row?.team || row || {};
  const rank = number(item.rank ?? row?.rank);
  const name = text(item.name ?? item.teamName ?? item.countryName ?? row?.name);
  if (!rank || !name) return null;

  const previousRank = number(
    item.previousRank
      ?? item.previousRanking
      ?? item.lastRank
      ?? row?.previousRank
      ?? row?.previous_rank
  );
  const points = number(item.totalPoints ?? item.points ?? row?.totalPoints ?? row?.points);
  const flag = text(item.flag?.src ?? item.flagUrl ?? row?.flag?.src ?? row?.flagUrl);
  const code = text(
    item.countryCode
      ?? item.country?.code
      ?? item.code
      ?? item.teamCode
      ?? item.abbreviation
      ?? row?.countryCode
      ?? flagCodeFrom(flag)
  ).toUpperCase();
  const confederation = text(
    row?.tag?.text
      ?? row?.confederation
      ?? item.confederation
      ?? item.confederationName
  );

  return {
    rank,
    previousRank,
    movement: previousRank ? previousRank - rank : 0,
    points,
    code,
    name,
    confederation,
    flag
  };
}

function rankingRowsFrom(payload) {
  const rowCandidates = [
    payload?.rankings,
    payload?.items,
    payload?.data?.rankings,
    payload?.data?.items,
    payload?.ranking?.rankings,
    payload?.pageData?.ranking?.rankings
  ];

  for (const rows of rowCandidates) {
    const normalized = asArray(rows).map(normalizeRankingRow).filter(Boolean);
    if (normalized.length >= 50) return normalized.sort((left, right) => left.rank - right.rank);
  }
  return [];
}

async function fetchRanking(dateId) {
  const errors = [];
  for (const base of API_BASES) {
    const url = `${base}?locale=en&dateId=${encodeURIComponent(dateId)}`;
    try {
      const { body } = await fetchText(url, 25000);
      const payload = JSON.parse(body);
      const rankings = rankingRowsFrom(payload);
      if (rankings.length < 50) throw new Error(`Only ${rankings.length} ranking rows`);
      return { url, rankings };
    } catch (error) {
      errors.push(`${url}: ${error.message}`);
    }
  }
  throw new Error(`Current FIFA ranking payload unavailable: ${errors.join(' | ')}`);
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
    page = { url: result.response.url || url, body: result.body };
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
