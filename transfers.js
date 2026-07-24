let transferData={updatedAt:null,items:[]},transferFilter='all';
async function loadTransfers(){try{const response=await fetch(`./data/transfers.json?${Date.now()}`,{cache:'no-store'});if(!response.ok)throw new Error('transfer data');transferData=await response.json();}catch(error){transferData={updatedAt:null,items:[]};}renderTransfers();}
function escapeTransferText(value=''){return String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));}
function transferDate(value){if(!value)return'';const date=new Date(value);return Number.isNaN(date.getTime())?'':date.toLocaleString('ja-JP',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});}
function renderTransfers(){
  const list=document.querySelector('#transferList'),updated=document.querySelector('#transferUpdated');if(!list||!updated)return;
  updated.textContent=transferData.updatedAt?`更新 ${transferDate(transferData.updatedAt)}`:'';
  const items=(transferData.items||[]).filter(item=>transferFilter==='all'||item.status===transferFilter);
  list.innerHTML=items.length?items.map(item=>{
    const title=escapeTransferText(item.titleJa||item.player||item.originalTitle||'移籍ニュース');
    const original=escapeTransferText(item.originalTitle||'');
    const summary=escapeTransferText(item.summaryJa||item.summary||'');
    const source=escapeTransferText(item.source||'情報源');
    const url=/^https?:\/\//.test(item.url||'')?item.url:'';
    return `<article class="transfer-card"><div class="transfer-card-head"><span class="transfer-status ${item.status}">${item.status==='confirmed'?'確定報道':'移籍の噂'}</span><span class="transfer-date">${transferDate(item.date)}</span></div><div class="transfer-player">${title}</div>${original&&original!==title?`<div class="transfer-original">${original}</div>`:''}${item.from||item.to?`<div class="transfer-route"><div class="transfer-club">${escapeTransferText(item.from||'移籍元不明')}</div><div class="transfer-arrow">→</div><div class="transfer-club">${escapeTransferText(item.to||'移籍先不明')}</div></div>`:''}${summary?`<p class="transfer-summary">${summary}</p>`:''}<div class="transfer-source">${url?`<a href="${url}" target="_blank" rel="noopener noreferrer">${source}で元記事を開く ↗</a>`:`情報源：${source}`}</div></article>`;
  }).join(''):'<div class="transfer-empty"><strong>現在表示できる移籍情報はありません</strong><p>ニュースの自動更新後に表示されます。</p></div>';
}
function openTransferView(){['#homeView','#teamDetailView','#standingsView','#searchView','#settingsView','#onboarding'].forEach(selector=>document.querySelector(selector)?.classList.add('hidden'));document.querySelector('#transfersView')?.classList.remove('hidden');document.querySelectorAll('.nav-item').forEach(item=>item.classList.toggle('active',item.dataset.view==='transfers'));renderTransfers();window.scrollTo({top:0,behavior:'smooth'});}
document.addEventListener('click',event=>{const nav=event.target.closest('[data-view="transfers"]');if(nav){event.preventDefault();event.stopImmediatePropagation();openTransferView();return;}const filter=event.target.closest('[data-transfer-filter]');if(filter){transferFilter=filter.dataset.transferFilter;document.querySelectorAll('[data-transfer-filter]').forEach(button=>button.classList.toggle('active',button===filter));renderTransfers();}},true);
loadTransfers();