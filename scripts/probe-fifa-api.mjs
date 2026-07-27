import { mkdir, writeFile } from 'node:fs/promises';

const apiUrls = [
  'https://vod.fifa.com/api/ranking-overview?locale=en',
  'https://inside.fifa.com/api/ranking-overview?locale=en',
  'https://www.fifa.com/api/ranking-overview?locale=en',
  'https://rusecure.fifa.com/api/ranking-overview?locale=en'
];
const pageUrls = [
  'https://vod.fifa.com/en/fifa-world-ranking/men',
  'https://football-technology.fifa.com/fifa-world-ranking'
];
const headers = {
  Accept: 'application/json,text/html;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'User-Agent': 'Mozilla/5.0 (compatible; MatchHubFifaProbe/1.1)'
};

const text = value => String(value ?? '').trim();
const asArray = value => Array.isArray(value) ? value : [];
const rowsFrom = payload => asArray(payload?.rankings || payload?.items || payload?.data?.rankings || payload?.data?.items);
const dateFrom = payload => text(payload?.rankingDate?.text || payload?.rankingDate || payload?.date?.text || payload?.date || payload?.lastUpdated || payload?.lastOfficialUpdate);
const nameFrom = row => text(row?.rankingItem?.name || row?.ranking?.name || row?.team?.name || row?.name);
const rankFrom = row => Number(row?.rankingItem?.rank || row?.ranking?.rank || row?.team?.rank || row?.rank) || null;

async function get(url, timeout = 25000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { headers, redirect: 'follow', signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function contextAround(source, index, radius = 160) {
  return source.slice(Math.max(0, index - radius), Math.min(source.length, index + radius))
    .replace(/\s+/g, ' ');
}

function walk(value, visit, path = '$') {
  if (!value || typeof value !== 'object') return;
  visit(value, path);
  if (Array.isArray(value)) value.forEach((item, index) => walk(item, visit, `${path}[${index}]`));
  else Object.entries(value).forEach(([key, item]) => walk(item, visit, `${path}.${key}`));
}

function inspectPage(raw) {
  const decoded = raw
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/\\u0022/g, '"')
    .replace(/\\u0026/g, '&')
    .replace(/\\\"/g, '"');
  const ids = [];
  const seen = new Set();
  for (const match of decoded.matchAll(/id\d+/g)) {
    if (seen.has(match[0])) continue;
    seen.add(match[0]);
    ids.push({ id: match[0], context: contextAround(decoded, match.index) });
  }

  const apiContexts = [...decoded.matchAll(/ranking-overview/gi)].slice(0, 10).map(match => contextAround(decoded, match.index, 240));
  const officialMatches = [
    ...decoded.matchAll(/(?:Last official update|Just updated)\s*:\s*([^<\n]{1,100})/gi),
    ...decoded.matchAll(/lastOfficialUpdate.{0,120}/gi)
  ].slice(0, 20).map(match => match[0].replace(/\s+/g, ' '));
  const scripts = [...raw.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)];
  const jsonFindings = [];

  for (let index = 0; index < scripts.length; index += 1) {
    const body = scripts[index][2].trim();
    if (!body || !['{', '['].includes(body[0])) continue;
    try {
      const parsed = JSON.parse(body);
      walk(parsed, (node, nodePath) => {
        if (jsonFindings.length >= 100) return;
        const nodeId = text(node?.id || node?.dateId);
        const nodeLabel = text(node?.text || node?.label || node?.date || node?.name);
        if (/^id\d+$/.test(nodeId)) {
          jsonFindings.push({ script: index, path: nodePath, id: nodeId, label: nodeLabel, keys: Object.keys(node).slice(0, 20) });
        }
        if (Array.isArray(node) && node.length >= 50) {
          const sample = node[0];
          if (sample && typeof sample === 'object') {
            const keys = Object.keys(sample);
            if (keys.some(key => /rank|team|country|point/i.test(key))) {
              jsonFindings.push({ script: index, path: nodePath, arrayLength: node.length, sampleKeys: keys.slice(0, 30), sample });
            }
          }
        }
      });
    } catch {
      // Ignore JavaScript script blocks.
    }
  }

  return {
    bytes: raw.length,
    idCount: ids.length,
    ids: ids.slice(0, 100),
    apiContexts,
    officialMatches,
    scriptCount: scripts.length,
    jsonFindings
  };
}

const apiResults = [];
for (const url of apiUrls) {
  try {
    const response = await get(url, 15000);
    const raw = await response.text();
    let payload = null;
    try { payload = JSON.parse(raw); } catch {}
    const rows = rowsFrom(payload);
    apiResults.push({
      url,
      finalUrl: response.url,
      status: response.status,
      contentType: response.headers.get('content-type'),
      bytes: raw.length,
      officialDate: dateFrom(payload),
      count: rows.length,
      top: rows.slice(0, 5).map(row => ({ rank: rankFrom(row), name: nameFrom(row) })),
      preview: raw.slice(0, 500)
    });
  } catch (error) {
    apiResults.push({ url, error: error.message });
  }
}

const pageResults = [];
for (const url of pageUrls) {
  try {
    const response = await get(url);
    const raw = await response.text();
    pageResults.push({
      url,
      finalUrl: response.url,
      status: response.status,
      contentType: response.headers.get('content-type'),
      ...inspectPage(raw)
    });
  } catch (error) {
    pageResults.push({ url, error: error.message });
  }
}

await mkdir('data', { recursive: true });
await writeFile('data/fifa-probe.json', `${JSON.stringify({
  probedAt: new Date().toISOString(),
  apiResults,
  pageResults
}, null, 2)}\n`, 'utf8');
