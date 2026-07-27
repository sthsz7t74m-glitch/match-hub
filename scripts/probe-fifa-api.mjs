import { mkdir, writeFile } from 'node:fs/promises';

const urls = [
  'https://vod.fifa.com/api/ranking-overview?locale=en',
  'https://inside.fifa.com/api/ranking-overview?locale=en',
  'https://www.fifa.com/api/ranking-overview?locale=en',
  'https://rusecure.fifa.com/api/ranking-overview?locale=en'
];

const text = value => String(value ?? '').trim();
const asArray = value => Array.isArray(value) ? value : [];
const rowsFrom = payload => asArray(payload?.rankings || payload?.items || payload?.data?.rankings || payload?.data?.items);
const dateFrom = payload => text(payload?.rankingDate?.text || payload?.rankingDate || payload?.date?.text || payload?.date || payload?.lastUpdated || payload?.lastOfficialUpdate);
const nameFrom = row => text(row?.rankingItem?.name || row?.ranking?.name || row?.team?.name || row?.name);
const rankFrom = row => Number(row?.rankingItem?.rank || row?.ranking?.rank || row?.team?.rank || row?.rank) || null;

const results = [];
for (const url of urls) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'User-Agent': 'Mozilla/5.0 (compatible; MatchHubFifaProbe/1.0)'
      },
      redirect: 'follow',
      signal: controller.signal
    });
    const raw = await response.text();
    let payload = null;
    try { payload = JSON.parse(raw); } catch {}
    const rows = rowsFrom(payload);
    results.push({
      url,
      finalUrl: response.url,
      status: response.status,
      contentType: response.headers.get('content-type'),
      bytes: raw.length,
      officialDate: dateFrom(payload),
      count: rows.length,
      top: rows.slice(0, 5).map(row => ({ rank: rankFrom(row), name: nameFrom(row) })),
      preview: payload ? '' : raw.slice(0, 500)
    });
  } catch (error) {
    results.push({ url, error: error.message });
  } finally {
    clearTimeout(timer);
  }
}

await mkdir('data', { recursive: true });
await writeFile('data/fifa-probe.json', `${JSON.stringify({ probedAt: new Date().toISOString(), results }, null, 2)}\n`, 'utf8');
