import { mkdir, writeFile } from 'node:fs/promises';

const PAGE_URL = 'https://vod.fifa.com/en/fifa-world-ranking/men';
const MODULE_IDS = ['14019', '86834', '2219', '2226', '73355'];
const HEADERS = {
  Accept: '*/*',
  'Accept-Language': 'en-US,en;q=0.9',
  'User-Agent': 'Mozilla/5.0 (compatible; MatchHubFifaProbe/6.0)'
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

function absoluteUrl(value, base) {
  try { return new URL(value, base).href; } catch { return ''; }
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

const page = await get(PAGE_URL);
const scriptUrls = [...new Set([...page.body.matchAll(/<script[^>]+src=["']([^"']+)["'][^>]*>/gi)]
  .map(match => absoluteUrl(match[1], page.response.url))
  .filter(Boolean))];
const modules = {};
const foundIn = {};
const errors = [];
let cursor = 0;

async function worker() {
  while (cursor < scriptUrls.length && Object.keys(modules).length < MODULE_IDS.length) {
    const index = cursor++;
    const url = scriptUrls[index];
    try {
      const result = await get(url, 25000);
      for (const id of MODULE_IDS) {
        if (modules[id]) continue;
        const source = moduleSource(result.body, id);
        if (source) {
          modules[id] = source;
          foundIn[id] = url;
        }
      }
    } catch (error) {
      errors.push({ url, error: error.message });
    }
  }
}

await Promise.all(Array.from({ length: Math.min(10, scriptUrls.length) }, () => worker()));

await mkdir('data', { recursive: true });
await writeFile('data/fifa-probe.json', `${JSON.stringify({
  probedAt: new Date().toISOString(),
  page: page.response.url,
  scriptCount: scriptUrls.length,
  foundIn,
  modules,
  missing: MODULE_IDS.filter(id => !modules[id]),
  errors
}, null, 2)}\n`, 'utf8');
