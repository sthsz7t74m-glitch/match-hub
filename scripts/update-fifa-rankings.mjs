import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const OUTPUT_PATH = process.env.FIFA_RANKING_OUTPUT || 'data/fifa-rankings.json';
const OVERRIDE_DATE_ID = process.env.FIFA_DATE_ID || '';
const PAGE_URLS = [
  'https://inside.fifa.com/fifa-world-ranking/men',
  'https://www.fifa.com/fifa-world-ranking/men',
  'https://rusecure.fifa.com/fifa-world-ranking/men'
];
const API_BASES = [
  'https://www.fifa.com/api/ranking-overview',
  'https://inside.fifa.com/api/ranking-overview',
  'https://rusecure.fifa.com/api/ranking-overview'
];
const REQUEST_HEADERS = {
  Accept: 'application/json,text/html;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'User-Agent': 'Mozilla/5.0 (compatible; MatchHubRankingBot/1.0; +https://github.com/sthsz7t74m-glitch/match-hub)'
};

const asArray = value => (Array.isArray(value) ? value : []);
const text = value => String(value ?? '').trim();
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

async function fetchResponse(url, timeout = 20_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      headers: REQUEST_HEADERS,
      redirect: 'follow',
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
    return response;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchPage() {
  const errors = [];
  for (const url of PAGE_URLS) {
    try {
      const response = await fetchResponse(url);
      return { html: await response.text(), url: response.url || url };
    } catch (error) {
      errors.push(error.message);
    }
  }
  throw new Error(`FIFA ranking page unavailable: ${errors.join(' | ')}`);
}

function walkJson(value, visit) {
  if (!value || typeof value !== 'object') return;
  visit(value);
  if (Array.isArray(value)) value.forEach(item => walkJson(item, visit));
  else Object.values(value).forEach(item => walkJson(item, visit));
}

function parseDateLabel(label) {
  const normalized = text(label).replace(/Sept\b/i, 'Sep');
  const timestamp = Date.parse(normalized);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function extractPageMetadata(html) {
  const decoded = html
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/\\u0022/g, '"')
    .replace(/\\u0026/g, '&')
    .replace(/\\\"/g, '"');
  const candidates = new Map();
  const addCandidate = (id, label = '') => {
    if (!/^id\d+$/.test(text(id))) return;
    const current = candidates.get(id);
    const timestamp = parseDateLabel(label);
    if (!current || timestamp > current.timestamp) {
      candidates.set(id, { id, label: text(label), timestamp });
    }
  };

  const pairPatterns = [
    /"id"\s*:\s*"(id\d+)"[^{}]{0,300}?"text"\s*:\s*"([^"]+)"/g,
    /"text"\s*:\s*"([^"]+)"[^{}]{0,300}?"id"\s*:\s*"(id\d+)"/g,
    /dateId(?:=|%3D)(id\d+)/gi,
    /"dateId"\s*:\s*"(id\d+)"/g
  ];

  let match;
  while ((match = pairPatterns[0].exec(decoded))) addCandidate(match[1], match[2]);
  while ((match = pairPatterns[1].exec(decoded))) addCandidate(match[2], match[1]);
  while ((match = pairPatterns[2].exec(decoded))) addCandidate(match[1]);
  while ((match = pairPatterns[3].exec(decoded))) addCandidate(match[1]);

  const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)].map(result => result[1].trim());
  scripts.forEach(script => {
    if (!script || !['{', '['].includes(script[0])) return;
    try {
      const parsed = JSON.parse(script);
      walkJson(parsed, node => {
        if (/^id\d+$/.test(text(node.id))) {
          addCandidate(node.id, node.text || node.label || node.date || node.name || '');
        }
      });
    } catch {
      // The page contains several non-JSON script blocks. They are ignored.
    }
  });

  for (const id of decoded.match(/id\d+/g) || []) addCandidate(id);

  const officialDateMatch = decoded.match(/Last official update:\s*([^<\n]+)/i)
    || decoded.match(/lastOfficialUpdate["']?\s*[:=]\s*["']([^"']+)/i);
  const officialDate = text(officialDateMatch?.[1]).replace(/\s+/g, ' ');

  return {
    officialDate,
    candidates: [...candidates.values()].sort((left, right) =>
      right.timestamp - left.timestamp || Number(right.id.slice(2)) - Number(left.id.slice(2))
    )
  };
}

function flagCodeFrom(value) {
  const url = text(value);
  const match = url.match(/\/([A-Z]{3})(?:\?|$)/i);
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
  const candidates = [
    payload?.rankings,
    payload?.items,
    payload?.data?.rankings,
    payload?.data?.items,
    payload?.ranking?.rankings,
    payload?.pageData?.ranking?.rankings
  ];

  for (const rows of candidates) {
    const normalized = asArray(rows).map(normalizeRankingRow).filter(Boolean);
    if (normalized.length >= 50) return normalized.sort((a, b) => a.rank - b.rank);
  }
  return [];
}

async function fetchRankingPayload(dateCandidates) {
  const attempts = [];
  const queries = [];
  if (OVERRIDE_DATE_ID) queries.push({ id: OVERRIDE_DATE_ID, label: '' });
  queries.push({ id: '', label: '' });
  queries.push(...dateCandidates.slice(0, 20));

  const seen = new Set();
  for (const candidate of queries) {
    for (const base of API_BASES) {
      const key = `${base}:${candidate.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const url = `${base}?locale=en${candidate.id ? `&dateId=${encodeURIComponent(candidate.id)}` : ''}`;

      try {
        const response = await fetchResponse(url);
        const payload = await response.json();
        const rankings = rankingRowsFrom(payload);
        if (rankings.length >= 50) {
          return { payload, rankings, dateId: candidate.id, dateLabel: candidate.label, url };
        }
        attempts.push(`${url}: ${rankings.length} rows`);
      } catch (error) {
        attempts.push(`${url}: ${error.message}`);
      }
    }
  }

  throw new Error(`FIFA ranking API unavailable: ${attempts.slice(-12).join(' | ')}`);
}

function payloadDate(payload, fallback = '') {
  return text(
    payload?.rankingDate?.text
      ?? payload?.rankingDate
      ?? payload?.date?.text
      ?? payload?.date
      ?? payload?.lastUpdated
      ?? payload?.lastOfficialUpdate
      ?? fallback
  );
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

try {
  const page = await fetchPage();
  const metadata = extractPageMetadata(page.html);
  const result = await fetchRankingPayload(metadata.candidates);
  const officialDate = payloadDate(result.payload, result.dateLabel || metadata.officialDate) || null;
  const output = {
    schemaVersion: 1,
    source: "FIFA/Coca-Cola Men's World Ranking",
    sourceUrl: 'https://inside.fifa.com/fifa-world-ranking/men',
    apiUrl: result.url,
    officialDate,
    dateId: result.dateId || '',
    rankingCount: result.rankings.length,
    rankings: result.rankings
  };

  if (signature(existing) === signature(output)) {
    console.log(`FIFA ranking unchanged (${result.rankings.length} teams).`);
  } else {
    await writeFile(path.resolve(OUTPUT_PATH), `${JSON.stringify(output, null, 2)}\n`, 'utf8');
    console.log(`Updated ${result.rankings.length} FIFA rankings at ${OUTPUT_PATH}.`);
  }
} catch (error) {
  if (asArray(existing?.rankings).length >= 50) {
    console.warn(`Keeping previous FIFA ranking data: ${error.message}`);
  } else {
    throw error;
  }
}
