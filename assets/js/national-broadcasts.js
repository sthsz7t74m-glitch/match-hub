(function(){
  const jfa='https://www.jfa.jp/samuraiblue_2026/news/00036769/';
  const unext='https://www.unext.co.jp/en/press-room/soccer-2026-09-18';
  const dazn='https://www.dazn.com/ja-JP/news/サッカー/uefa-nations-league-2026-27-how-to-watch/17qygsatbfnv71k2o7sw81yzcv';
  // Japan viewing rights; explicit match records override season-scoped rules.
  const records=[
    {date:'2026-11-13',teams:['singapore','paraguay'],media:['U-NEXT（有料）'],source:unext},
    {date:'2026-11-14',teams:['japan','brazil'],media:['テレビ朝日系','U-NEXT（ライブ無料）'],source:jfa},
    {date:'2026-11-17',teams:['singapore','brazil'],media:['U-NEXT（有料）'],source:unext},
    {date:'2026-11-17',teams:['japan','paraguay'],media:['日本テレビ系','TVer','U-NEXT（有料）'],source:jfa}
  ];
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function lookup(match){
    const date=new Date(match.kickoff||match.date);
    if(!Number.isFinite(date.getTime()))return null;
    const key=new Date(date.getTime()+9*3600000).toISOString().slice(0,10);
    const teams=[String(match.home),String(match.away)].sort().join('|');
    const exact=records.find(r=>r.date===key&&[...r.teams].sort().join('|')===teams);
    if(exact)return exact;
    if(match.competitionCode==='uefa.nations'&&key>='2026-09-24'&&key<'2027-07-01')return {media:['DAZN'],source:dazn};
    return null;
  }
  function render(match){
    const record=lookup(match);
    const past=new Date(match.kickoff||match.date)<new Date()&&['finished','FINISHED'].includes(match.status);
    const label=past?'放送当時の予定':'放送・配信（日本）';
    return `<div class="national-broadcasts" aria-label="${label}"><span class="national-broadcasts__label">${label}</span>${record?record.media.map(name=>`<span class="national-broadcasts__badge">${escape(name)}</span>`).join('')+`<a href="${escape(record.source)}" target="_blank" rel="noopener noreferrer">公式情報 ↗</a>`:'<span class="national-broadcasts__unknown">未確認</span>'}</div>`;
  }
  function decorate(renderer){
    const original=renderer.render.bind(renderer);
    renderer.render=function(match,context){return `<div class="national-broadcast-match">${original(match,context)}${render(match.raw||match)}</div>`;};
    return renderer;
  }
  window.NationalBroadcasts={lookup,render,decorate,records,checkedAt:'2026-10-24'};
})();
