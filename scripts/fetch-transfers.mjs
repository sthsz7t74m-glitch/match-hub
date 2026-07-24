import fs from 'node:fs/promises';

const FEED_URL = 'https://feeds.bbci.co.uk/sport/football/rss.xml';
const transferWords = /(transfer|signs?|signed|signing|joins?|joined|deal|move|loan|bid|target|linked|contract|medical|fee)/i;
const confirmedWords = /(has signed|have signed|signs for|signed by|joins |joined |completes? (a )?move|confirmed|announces?|agrees? (a )?deal|loan move completed)/i;
const rumourWords = /(linked with|interested in|targeting|considering|could sign|set to|close to|in talks|bid for|wants to sign|eyeing|rumour)/i;

function decode(value='') {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/<[^>]+>/g, '')
    .trim();
}

function tag(block, name) {
  const match = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i'));
  return decode(match?.[1] || '');
}

const response = await fetch(FEED_URL, { headers: { 'User-Agent': 'MatchHub/1.0' } });
if (!response.ok) throw new Error(`BBC RSS HTTP ${response.status}`);
const xml = await response.text();
const blocks = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map(match => match[1]);

const items = blocks.map(block => {
  const title = tag(block, 'title');
  const summary = tag(block, 'description');
  const url = tag(block, 'link');
  const published = tag(block, 'pubDate');
  const text = `${title} ${summary}`;
  if (!transferWords.test(text)) return null;
  const status = confirmedWords.test(text) && !rumourWords.test(text) ? 'confirmed' : 'rumour';
  return {
    id: url || title,
    status,
    player: title,
    from: '',
    to: '',
    summary,
    source: 'BBC Sport',
    url,
    date: published ? new Date(published).toISOString() : null
  };
}).filter(Boolean).slice(0, 30);

const output = {
  updatedAt: new Date().toISOString(),
  source: 'BBC Sport Football RSS',
  sourceUrl: FEED_URL,
  items
};

await fs.mkdir('data', { recursive: true });
await fs.writeFile('data/transfers.json', `${JSON.stringify(output, null, 2)}\n`);
console.log(`Saved ${items.length} transfer stories.`);
