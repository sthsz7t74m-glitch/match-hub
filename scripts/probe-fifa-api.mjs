import { mkdir, writeFile } from 'node:fs/promises';

const CHUNK_URL = 'https://vod.fifa.com/_next/static/chunks/4170.0d6f0f095bdc7828.js';
const HEADERS = {
  Accept: '*/*',
  'Accept-Language': 'en-US,en;q=0.9',
  'User-Agent': 'Mozilla/5.0 (compatible; MatchHubFifaProbe/5.0)'
};

async function get(url, timeout = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { headers: HEADERS, redirect: 'follow', signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return { response, body: await response.text() };
  } finally {
    clearTimeout(timer);
  }
}

function moduleSource(source, moduleId, maxLength = 30000) {
  const marker = `${moduleId}:function`;
  const start = source.indexOf(marker);
  if (start < 0) return '';
  const next = source.slice(start + marker.length).search(/},\d+:function\(/);
  const end = next < 0 ? Math.min(source.length, start + maxLength) : start + marker.length + next + 1;
  return source.slice(start, Math.min(end, start + maxLength));
}

function context(source, needle, radius = 3500) {
  const index = source.indexOf(needle);
  if (index < 0) return '';
  return source.slice(Math.max(0, index - radius), Math.min(source.length, index + needle.length + radius));
}

const result = await get(CHUNK_URL);
const body = result.body;
const modules = Object.fromEntries(['14019', '2226', '2219', '73355', '13901'].map(id => [id, moduleSource(body, id)]));
const contexts = Object.fromEntries([
  'getAllCountriesRankingByScheduleNew',
  'getAllCountriesRankingLive',
  'get-international-ranking-window',
  'get-rankings',
  'scheduleIdForEndDate',
  'rankingType',
  'fdcpUrl'
].map(needle => [needle, context(body, needle)]));

await mkdir('data', { recursive: true });
await writeFile('data/fifa-probe.json', `${JSON.stringify({
  probedAt: new Date().toISOString(),
  chunkUrl: result.response.url,
  bytes: body.length,
  modules,
  contexts
}, null, 2)}\n`, 'utf8');
