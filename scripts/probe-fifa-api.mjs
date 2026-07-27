import { mkdir, writeFile } from 'node:fs/promises';

const PAGE_URL = 'https://vod.fifa.com/en/fifa-world-ranking/men';
const HEADERS = {
  Accept: '*/*',
  'Accept-Language': 'en-US,en;q=0.9',
  'User-Agent': 'Mozilla/5.0 (compatible; MatchHubFifaProbe/3.0)'
};
const PATTERNS = [
  'ranking-overview',
  'FRS_Male_Football',
  'rankingItem',
  'liveRanking',
  'live-ranking',
  'fifa-world-ranking',
  'ranking-overview-template',
  'lastUpdateDate'
];

async function get(url, timeout = 25000) {
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

function absoluteUrl(value, base) {
  try { return new URL(value, base).href; } catch { return ''; }
}

function contexts(source, pattern, limit = 8, radius = 280) {
  const result = [];
  let start = 0;
  const lower = source.toLowerCase();
  const needle = pattern.toLowerCase();
  while (result.length < limit) {
    const index = lower.indexOf(needle, start);
    if (index < 0) break;
    result.push(source.slice(Math.max(0, index - radius), Math.min(source.length, index + needle.length + radius)).replace(/\s+/g, ' '));
    start = index + needle.length;
  }
  return result;
}

const page = await get(PAGE_URL);
const scriptUrls = [...page.body.matchAll(/<script[^>]+src=["']([^"']+)["'][^>]*>/gi)]
  .map(match => absoluteUrl(match[1], page.response.url))
  .filter(Boolean);
const uniqueScripts = [...new Set(scriptUrls)];
const findings = [];
const errors = [];
let cursor = 0;

async function worker() {
  while (cursor < uniqueScripts.length) {
    const index = cursor++;
    const url = uniqueScripts[index];
    try {
      const result = await get(url, 20000);
      const matched = {};
      for (const pattern of PATTERNS) {
        const snippets = contexts(result.body, pattern);
        if (snippets.length) matched[pattern] = snippets;
      }
      if (Object.keys(matched).length) {
        findings.push({ url, bytes: result.body.length, matched });
      }
    } catch (error) {
      errors.push({ url, error: error.message });
    }
  }
}

await Promise.all(Array.from({ length: Math.min(8, uniqueScripts.length) }, () => worker()));

const htmlUrls = [...page.body.matchAll(/https?:\\?\/\\?\/[^"'<>\s]+/g)]
  .map(match => match[0].replace(/\\\//g, '/'))
  .filter(url => /rank|api|football/i.test(url))
  .slice(0, 100);

await mkdir('data', { recursive: true });
await writeFile('data/fifa-probe.json', `${JSON.stringify({
  probedAt: new Date().toISOString(),
  page: page.response.url,
  pageBytes: page.body.length,
  scriptCount: uniqueScripts.length,
  scriptUrls: uniqueScripts,
  htmlUrls,
  findings,
  errors
}, null, 2)}\n`, 'utf8');
