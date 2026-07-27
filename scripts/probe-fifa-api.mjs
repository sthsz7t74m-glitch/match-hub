import { mkdir, writeFile } from 'node:fs/promises';

const CHUNK_URL = 'https://vod.fifa.com/_next/static/chunks/4170.0d6f0f095bdc7828.js';
const HEADERS = {
  Accept: '*/*',
  'Accept-Language': 'en-US,en;q=0.9',
  'User-Agent': 'Mozilla/5.0 (compatible; MatchHubFifaProbe/4.0)'
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

function snippets(source, needle, { limit = 20, radius = 700 } = {}) {
  const results = [];
  const lower = source.toLowerCase();
  const search = needle.toLowerCase();
  let offset = 0;
  while (results.length < limit) {
    const index = lower.indexOf(search, offset);
    if (index < 0) break;
    results.push(source.slice(Math.max(0, index - radius), Math.min(source.length, index + search.length + radius)));
    offset = index + search.length;
  }
  return results;
}

function stringLiterals(source) {
  const values = [];
  const seen = new Set();
  const pattern = /(["'`])((?:\\.|(?!\1)[^\\]){1,300})\1/g;
  let match;
  while ((match = pattern.exec(source))) {
    const value = match[2];
    if (!/(?:\/api\/|https?:|ranking|fdcp|match-window|live)/i.test(value)) continue;
    const decoded = value.replace(/\\\//g, '/').replace(/\\"/g, '"');
    if (seen.has(decoded)) continue;
    seen.add(decoded);
    values.push(decoded);
  }
  return values.slice(0, 500);
}

const result = await get(CHUNK_URL);
const body = result.body;
const targets = [
  '13901:function',
  'p6:function',
  'p6:',
  'No rankings returned by fdcp',
  'fdcp',
  '/api/ranking-overview',
  '/api/get-match-window-matches',
  'FRS_Male_Football',
  'rankingMode',
  'rankingData',
  'Results',
  'IdCountry',
  'TotalPoints',
  'PrevRank',
  'pollingInterval',
  'useSWR',
  'fetch('
];

const contexts = Object.fromEntries(targets.map(target => [target, snippets(body, target)]).filter(([, values]) => values.length));
const moduleIds = [...body.matchAll(/(\d+):function\([^)]*\)\{"use strict";[^}]{0,800}?p6:function/g)].map(match => match[1]);
const apiStrings = stringLiterals(body);

await mkdir('data', { recursive: true });
await writeFile('data/fifa-probe.json', `${JSON.stringify({
  probedAt: new Date().toISOString(),
  chunkUrl: result.response.url,
  bytes: body.length,
  moduleIds,
  apiStrings,
  contexts
}, null, 2)}\n`, 'utf8');
