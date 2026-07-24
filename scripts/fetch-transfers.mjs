import fs from 'node:fs/promises';

const FEED_URL='https://feeds.bbci.co.uk/sport/football/rss.xml';
const transferWords=/(transfer|signs?|signed|signing|joins?|joined|deal|move|loan|bid|target|linked|contract|medical|fee|talks|agree|announc)/i;
const officialWords=/(officially|announces?|confirmed|completes? (?:the |a )?(?:signing|move)|has signed|have signed|signs for|joined on a permanent|loan move completed)/i;
const agreementWords=/(agree(?:s|d)? (?:a )?deal|agreement reached|set to sign|medical|personal terms agreed|deal agreed)/i;
const talksWords=/(in talks|negotiations?|bid for|offer for|close to|advanced talks|wants to sign)/i;

const clubJa={Arsenal:'アーセナル',Chelsea:'チェルシー',Liverpool:'リヴァプール',Newcastle:'ニューカッスル','Manchester City':'マンチェスター・シティ','Man City':'マンチェスター・シティ','Manchester United':'マンチェスター・ユナイテッド','Man Utd':'マンチェスター・ユナイテッド',Tottenham:'トッテナム',Spurs:'トッテナム',Everton:'エヴァートン','Aston Villa':'アストン・ヴィラ','Crystal Palace':'クリスタル・パレス',Palace:'クリスタル・パレス',Brighton:'ブライトン',Bournemouth:'ボーンマス',Fulham:'フラム',Brentford:'ブレントフォード',Wolves:'ウルブス','West Ham':'ウェストハム',Barcelona:'バルセロナ','Real Madrid':'レアル・マドリード',Atletico:'アトレティコ・マドリード',Juventus:'ユヴェントス',Milan:'ミラン',Inter:'インテル',Napoli:'ナポリ',Roma:'ローマ',Bayern:'バイエルン',Dortmund:'ドルトムント',Leipzig:'ライプツィヒ',PSG:'パリ・サンジェルマン',Marseille:'マルセイユ',Monaco:'モナコ',Lyon:'リヨン'};
function decode(v=''){return v.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/<[^>]+>/g,'').trim();}
function tag(block,name){const m=block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`,'i'));return decode(m?.[1]||'');}
function jaClub(name=''){const clean=name.trim().replace(/ FC$/i,'');return clubJa[clean]||clean;}
function cleanPlayer(v=''){return v.trim().replace(/^(?:defender|striker|forward|midfielder|winger|goalkeeper|captain|star|teenager|international)\s+/i,'').replace(/^\w+'s\s+/,'').replace(/[.!?]$/,'').trim();}
function statusOf(text){if(officialWords.test(text))return'official';if(agreementWords.test(text))return'agreed';if(talksWords.test(text))return'talks';return'rumour';}
function parseHeadline(title){let m;
 if((m=title.match(/^(.+?) agree(?:s|d)? (?:a )?deal to sign (.+?) (?:defender|striker|forward|midfielder|winger|goalkeeper) (.+)$/i)))return{to:m[1],from:m[2],player:cleanPlayer(m[3]),ja:`${jaClub(m[1])}、${jaClub(m[2])}の${cleanPlayer(m[3])}獲得で合意`};
 if((m=title.match(/^(.+?) sign(?:s|ed)? (.+?) from (.+)$/i)))return{to:m[1],player:cleanPlayer(m[2]),from:m[3],ja:`${jaClub(m[1])}、${jaClub(m[3])}から${cleanPlayer(m[2])}を獲得`};
 if((m=title.match(/^(.+?) join(?:s|ed)? (.+?)(?: from (.+))?$/i)))return{player:cleanPlayer(m[1]),to:m[2],from:m[3]||'',ja:`${cleanPlayer(m[1])}、${jaClub(m[2])}へ加入${m[3]?`（${jaClub(m[3])}から）`:''}`};
 if((m=title.match(/^(.+?) complete(?:s|d)? signing of (.+)$/i)))return{to:m[1],player:cleanPlayer(m[2]),from:'',ja:`${jaClub(m[1])}、${cleanPlayer(m[2])}の獲得を正式発表`};
 if((m=title.match(/^(.+?) in talks to sign (.+)$/i)))return{to:m[1],player:cleanPlayer(m[2]),from:'',ja:`${jaClub(m[1])}、${cleanPlayer(m[2])}獲得へ交渉中`};
 if((m=title.match(/^(.+?) linked with (.+)$/i)))return{player:cleanPlayer(m[1]),to:m[2],from:'',ja:`${cleanPlayer(m[1])}に${jaClub(m[2])}移籍の可能性`};
 return{player:title,from:'',to:'',ja:`移籍情報：${title}`,parsed:false};}
function jaSummary(status,p){const label={official:'正式発表',agreed:'合意',talks:'交渉',rumour:'関心・噂'}[status];const route=p.from&&p.to?`${jaClub(p.from)}から${jaClub(p.to)}へ`:p.to?`${jaClub(p.to)}へ`:'';return`${p.player}${route?`が${route}`:''}移る可能性について、${label}段階の報道です。`;}
const response=await fetch(FEED_URL,{headers:{'User-Agent':'MatchHub/1.0'}});if(!response.ok)throw new Error(`BBC RSS HTTP ${response.status}`);
const xml=await response.text();const blocks=[...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map(m=>m[1]);
const seen=new Set();const items=[];
for(const block of blocks){const title=tag(block,'title'),summary=tag(block,'description'),url=tag(block,'link'),published=tag(block,'pubDate');const text=`${title} ${summary}`;if(!transferWords.test(text))continue;const parsed=parseHeadline(title);const key=`${parsed.player}|${parsed.to}|${parsed.from}`.toLowerCase().replace(/[^a-z0-9|]/g,'');if(seen.has(key))continue;seen.add(key);const status=statusOf(text);items.push({id:url||title,status,player:parsed.player,titleJa:parsed.ja,from:jaClub(parsed.from),to:jaClub(parsed.to),summaryJa:jaSummary(status,parsed),originalTitle:title,summary,parsed:parsed.parsed!==false,source:'BBC Sport',url,date:published?new Date(published).toISOString():null});if(items.length>=30)break;}
const output={updatedAt:new Date().toISOString(),source:'BBC Sport Football RSS',sourceUrl:FEED_URL,translationMode:'free-rule-based',items};await fs.mkdir('data',{recursive:true});await fs.writeFile('data/transfers.json',`${JSON.stringify(output,null,2)}\n`);console.log(`Saved ${items.length} deduplicated transfer stories.`);