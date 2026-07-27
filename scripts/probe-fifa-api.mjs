import { readFile, writeFile, mkdir } from 'node:fs/promises';

const current = JSON.parse(await readFile('data/fifa-rankings.json', 'utf8'));
const dateId = current.dateId || 'FRS_Male_Football_20260611';
const url = `https://api.fifa.com/api/v3/fifarankings/rankings/rankingsbyschedule?rankingScheduleId=${encodeURIComponent(dateId)}&count=10&language=en`;
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), 30000);
let response;
try {
  response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'Accept-Language': 'en-US,en;q=0.9',
      'User-Agent': 'Mozilla/5.0 (compatible; MatchHubFifaProbe/8.0)'
    },
    signal: controller.signal
  });
} finally {
  clearTimeout(timer);
}
if (!response.ok) throw new Error(`HTTP ${response.status}`);
const payload = await response.json();
await mkdir('data', { recursive: true });
await writeFile('data/fifa-probe.json', `${JSON.stringify({
  probedAt: new Date().toISOString(),
  url,
  keys: Object.keys(payload || {}),
  count: Array.isArray(payload?.Results) ? payload.Results.length : 0,
  rows: (payload?.Results || []).slice(0, 5)
}, null, 2)}\n`, 'utf8');
