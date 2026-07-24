import fs from 'node:fs/promises';

const FEED_URL = 'https://feeds.bbci.co.uk/sport/football/rss.xml';
const transferWords = /(transfer|signs?|signed|signing|joins?|joined|deal|move|loan|bid|target|linked|contract|medical|fee|talks)/i;
const confirmedWords = /(has signed|have signed|signs for|signed by|joins |joined |completes? (a )?move|confirmed|announces?|agrees? (a )?deal|seal(?:s|ed)? .* move|loan move completed)/i;
const rumourWords = /(linked with|interested in|targeting|considering|could sign|set to|close to|in talks|bid for|wants to sign|eyeing|rumour)/i;

const clubJa = {
  Arsenal:'アーセナル', Chelsea:'チェルシー', Liverpool:'リヴァプール', Newcastle:'ニューカッスル',
  'Manchester City':'マンチェスター・シティ', 'Manchester United':'マンチェスター・ユナイテッド',
  Tottenham:'トッテナム', Everton:'エヴァートン', 'Aston Villa':'アストン・ヴィラ',
  'Crystal Palace':'クリスタル・パレス', Palace:'クリスタル・パレス', Brighton:'ブライトン',
  Bournemouth:'ボーンマス', Fulham:'フラム', Brentford:'ブレントフォード', Wolves:'ウルブス',
  Barcelona:'バルセロナ', 'Real Madrid':'レアル・マドリード', Atletico:'アトレティコ・マドリード',
  Juventus:'ユヴェントス', Milan:'ミラン', Inter:'インテル', Napoli:'ナポリ', Roma:'ローマ',
  Bayern:'バイエルン', Dortmund:'ドルトムント', Leipzig:'ライプツィヒ',
  PSG:'パリ・サンジェルマン', Marseille:'マルセイユ', Monaco:'モナコ', Lyon:'リヨン'
};

function decode(value='') {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/&amp;/g,'&').replace(/&quot;/g,'"')
    .replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/<[^>]+>/g,'').trim();
}
function tag(block,name){const match=block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`,'i'));return decode(match?.[1]||'');}
function jaClub(name=''){const clean=name.trim().replace(/ FC$/i,'');return clubJa[clean]||clean;}
function cleanPlayer(value=''){
  return value.trim().replace(/^(?:defender|striker|forward|midfielder|winger|goalkeeper|captain|star|teenager|international)\s+/i,'')
    .replace(/^\w+'s\s+/,'').replace(/[.!?]$/,'').trim();
}
function parseHeadline(title){
  let m;
  if((m=title.match(/^(.+?) agree(?:s)? deal to sign (.+?) (?:defender|striker|forward|midfielder|winger|goalkeeper) (.+)$/i))){
    return {to:m[1],from:m[2],player:cleanPlayer(m[3]),ja:`${jaClub(m[1])}、${jaClub(m[2])}の${cleanPlayer(m[3])}獲得で合意`};
  }
  if((m=title.match(/^(.+?) seal(?:s|ed)? (?:£[\d.]+m |€[\d.]+m )?move for (.+?)'s (.+)$/i))){
    return {to:m[1],from:m[2],player:cleanPlayer(m[3]),ja:`${jaClub(m[1])}、${jaClub(m[2])}から${cleanPlayer(m[3])}を獲得`};
  }
  if((m=title.match(/^(.+?) sign(?:s|ed)? (.+?) from (.+)$/i))){
    return {to:m[1],player:cleanPlayer(m[2]),from:m[3],ja:`${jaClub(m[1])}、${jaClub(m[3])}から${cleanPlayer(m[2])}を獲得`};
  }
  if((m=title.match(/^(.+?) join(?:s|ed)? (.+?)(?: from (.+))?$/i))){
    return {player:cleanPlayer(m[1]),to:m[2],from:m[3]||'',ja:`${cleanPlayer(m[1])}、${jaClub(m[2])}へ加入${m[3]?`（${jaClub(m[3])}から）`:''}`};
  }
  if((m=title.match(/^(.+?) complete(?:s|d)? signing of (.+)$/i))){
    return {to:m[1],player:cleanPlayer(m[2]),from:'',ja:`${jaClub(m[1])}、${cleanPlayer(m[2])}の獲得を完了`};
  }
  if((m=title.match(/^(.+?) in talks to sign (.+)$/i))){
    return {to:m[1],player:cleanPlayer(m[2]),from:'',ja:`${jaClub(m[1])}、${cleanPlayer(m[2])}獲得へ交渉中`};
  }
  if((m=title.match(/^(.+?) linked with (.+)$/i))){
    return {player:cleanPlayer(m[1]),to:m[2],from:'',ja:`${cleanPlayer(m[1])}に${jaClub(m[2])}移籍の可能性`};
  }
  return {player:title,from:'',to:'',ja:`移籍情報：${title}`};
}
function jaSummary(status,parsed){
  const route=parsed.from&&parsed.to?`${jaClub(parsed.from)}から${jaClub(parsed.to)}への移籍`:parsed.to?`${jaClub(parsed.to)}への移籍`:'';
  return status==='confirmed'?`${parsed.player}${route?`の${route}`:''}について、合意・獲得に関する報道です。`:`${parsed.player}${route?`の${route}`:''}について、交渉や関心が報じられています。`;
}

const response=await fetch(FEED_URL,{headers:{'User-Agent':'MatchHub/1.0'}});
if(!response.ok)throw new Error(`BBC RSS HTTP ${response.status}`);
const xml=await response.text();
const blocks=[...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map(match=>match[1]);
const items=blocks.map(block=>{
  const title=tag(block,'title'),summary=tag(block,'description'),url=tag(block,'link'),published=tag(block,'pubDate');
  const text=`${title} ${summary}`;if(!transferWords.test(text))return null;
  const status=confirmedWords.test(text)&&!rumourWords.test(text)?'confirmed':'rumour';
  const parsed=parseHeadline(title);
  return {id:url||title,status,player:parsed.player,titleJa:parsed.ja,from:jaClub(parsed.from),to:jaClub(parsed.to),summaryJa:jaSummary(status,parsed),originalTitle:title,summary,source:'BBC Sport',url,date:published?new Date(published).toISOString():null};
}).filter(Boolean).slice(0,30);
const output={updatedAt:new Date().toISOString(),source:'BBC Sport Football RSS',sourceUrl:FEED_URL,translationMode:'free-rule-based',items};
await fs.mkdir('data',{recursive:true});
await fs.writeFile('data/transfers.json',`${JSON.stringify(output,null,2)}\n`);
console.log(`Saved ${items.length} transfer stories with free Japanese parsing.`);