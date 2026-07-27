import { mkdir, writeFile } from 'node:fs/promises';

const PAGE_URL = 'https://vod.fifa.com/en/fifa-world-ranking/men';
const API_BASES = [
  'https://vod.fifa.com/api/ranking-overview',
  'https://inside.fifa.com/api/ranking-overview',
  'https://rusecure.fifa.com/api/ranking-overview'
];
const HEADERS = {
  Accept: 'application/json,text/html;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'User-Agent': 'Mozilla/5.0 (compatible; MatchHubFifaProbe/2.0)'
};
const asArray = value => Array.isArray(value) ? value : [];
const text = value => String(value ?? '').trim();

async function get(url, timeout = 25000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { headers: HEADERS, redirect: 'follow', signal: controller.signal });
    const body = await response.text();
    return { response, body };
  } finally {
    clearTimeout(timer);
  }
}

function walk(value, visit, path = '$') {
  if (!value || typeof value !== 'object') return;
  visit(value, path);
  if (Array.isArray(value)) value.forEach((item, index) => walk(item, visit, `${path}[${index}]`));
  else Object.entries(value).forEach(([key, item]) => walk(item, visit, `${path}.${key}`));
}

function findConfig(html) {
  const findings = [];
  for (const match of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)) {
    const body = match[1].trim();
    if (!body || !['{', '['].includes(body[0])) continue;
    try {
      const parsed = JSON.parse(body);
      walk(parsed, (node, path) => {
        if (Array.isArray(node)) return;
        const count = asArray(node?.dates).reduce((sum, group) => sum + asArray(group?.dates).length, 0);
        if (count >= 10 && (node?.lastUpdateDate || node?.rankingListLabels)) findings.push({ node, path, count });
      });
    } catch {}
  }
  if (!findings.length) throw new Error('ranking config not found');
  return findings.sort((a, b) => b.count - a.count)[0];
}

function rowsFrom(payload) {
  for (const rows of [payload?.rankings, payload?.items, payload?.data?.rankings, payload?.data?.items]) {
    if (Array.isArray(rows)) return rows;
  }
  return [];
}

function rowPreview(row) {
  const item = row?.rankingItem || row?.ranking || row?.team || row || {};
  return {
    rank: Number(item.rank ?? row?.rank) || null,
    name: text(item.name ?? item.teamName ?? item.countryName ?? row?.name),
    points: Number(item.totalPoints ?? item.points ?? row?.points) || null
  };
}

const pageResult = await get(PAGE_URL);
const configFinding = findConfig(pageResult.body);
const dates = asArray(configFinding.node.dates).flatMap(group => asArray(group?.dates));
dates.sort((a, b) => (Date.parse(b.iso || b.matchWindowEndDate || '') || 0) - (Date.parse(a.iso || a.matchWindowEndDate || '') || 0));
const currentDates = dates.slice(0, 8).map(entry => ({ ...entry }));
const apiResults = [];

for (const date of currentDates.slice(0, 4)) {
  for (const base of API_BASES) {
    const url = `${base}?locale=en&dateId=${encodeURIComponent(date.id)}`;
    try {
      const result = await get(url, 20000);
      let payload = null;
      try { payload = JSON.parse(result.body); } catch {}
      const rows = rowsFrom(payload);
      apiResults.push({
        dateId: date.id,
        iso: date.iso,
        dateText: date.dateText,
        url,
        status: result.response.status,
        contentType: result.response.headers.get('content-type'),
        bytes: result.body.length,
        count: rows.length,
        top: rows.slice(0, 5).map(rowPreview),
        preview: result.body.slice(0, 300)
      });
      if (rows.length >= 50) break;
    } catch (error) {
      apiResults.push({ dateId: date.id, url, error: error.message });
    }
  }
}

await mkdir('data', { recursive: true });
await writeFile('data/fifa-probe.json', `${JSON.stringify({
  probedAt: new Date().toISOString(),
  page: {
    url: pageResult.response.url,
    bytes: pageResult.body.length,
    configPath: configFinding.path,
    lastUpdateDate: configFinding.node.lastUpdateDate,
    nextUpdateDate: configFinding.node.nextUpdateDate,
    currentDates
  },
  apiResults
}, null, 2)}\n`, 'utf8');
