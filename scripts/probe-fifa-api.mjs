import { mkdir, writeFile } from 'node:fs/promises';

const CHUNK_URL = 'https://vod.fifa.com/_next/static/chunks/4170.0d6f0f095bdc7828.js';
const HEADERS = {
  Accept: '*/*',
  'Accept-Language': 'en-US,en;q=0.9',
  'User-Agent': 'Mozilla/5.0 (compatible; MatchHubFifaProbe/7.0)'
};

async function get(url, timeout = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { headers: HEADERS, redirect: 'follow', signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
    return { response, body: await response.text() };
  } finally {
    clearTimeout(timer);
  }
}

function moduleSource(source, moduleId, maxLength = 60000) {
  const marker = `${moduleId}:function`;
  const start = source.indexOf(marker);
  if (start < 0) return '';
  const tail = source.slice(start + marker.length);
  const next = tail.search(/},\d+:function\(/);
  const end = next < 0 ? start + maxLength : start + marker.length + next + 1;
  return source.slice(start, Math.min(source.length, end, start + maxLength));
}

function contexts(source, needle, radius = 1300) {
  const results = [];
  let offset = 0;
  while (results.length < 10) {
    const index = source.indexOf(needle, offset);
    if (index < 0) break;
    results.push(source.slice(Math.max(0, index - radius), Math.min(source.length, index + needle.length + radius)));
    offset = index + needle.length;
  }
  return results;
}

function stringLiterals(source) {
  const values = [];
  const seen = new Set();
  const pattern = /(["'`])((?:\\.|(?!\1)[^\\]){1,500})\1/g;
  let match;
  while ((match = pattern.exec(source))) {
    const value = match[2].replace(/\\\//g, '/').replace(/\\"/g, '"');
    if (!/(?:\/|ranking|football|futsal|men|women|schedule|live)/i.test(value)) continue;
    if (seen.has(value)) continue;
    seen.add(value);
    values.push(value);
  }
  return values;
}

const result = await get(CHUNK_URL);
const module14019 = moduleSource(result.body, '14019');
if (!module14019) throw new Error('FIFA service module 14019 not found');
const needles = [
  'constructor()',
  'fdcpUrl',
  'callFdcp',
  'getAllCountriesRankingByScheduleNew',
  'getAllCountriesRankingLive',
  'getRankingMatchesByTeam',
  'getRankingMatchesLive',
  'scheduleIdForEndDate',
  'rankingType',
  'Results'
];

await mkdir('data', { recursive: true });
await writeFile('data/fifa-probe.json', `${JSON.stringify({
  probedAt: new Date().toISOString(),
  chunkUrl: result.response.url,
  moduleBytes: module14019.length,
  strings: stringLiterals(module14019),
  contexts: Object.fromEntries(needles.map(needle => [needle, contexts(module14019, needle)]))
}, null, 2)}\n`, 'utf8');
