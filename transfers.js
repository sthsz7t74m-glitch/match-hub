let transferData={updatedAt:null,items:[]},transferFilter='all';

async function loadTransfers(){
  try{
    const response=await fetch(`./data/transfers.json?${Date.now()}`,{cache:'no-store'});
    if(!response.ok)throw new Error('transfer data');
    transferData=await response.json();
  }catch(error){
    transferData={updatedAt:null,items:[]};
  }
  renderTransfers();
}

function renderTransfers(){
  const list=document.querySelector('#transferList');
  const updated=document.querySelector('#transferUpdated');
  if(!list||!updated)return;
  updated.textContent=transferData.updatedAt?`更新 ${new Date(transferData.updatedAt).toLocaleString('ja-JP',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}`:'';
  const items=(transferData.items||[]).filter(item=>transferFilter==='all'||item.status===transferFilter);
  list.innerHTML=items.length?items.map(item=>`<article class="transfer-card"><div class="transfer-card-head"><span class="transfer-status ${item.status}">${item.status==='confirmed'?'移籍確定':'移籍の噂'}</span><span class="transfer-date">${item.date||''}</span></div><div class="transfer-player">${item.player}</div><div class="transfer-route"><div class="transfer-club">${item.from||'未定'}</div><div class="transfer-arrow">→</div><div class="transfer-club">${item.to||'未定'}</div></div>${item.source?`<div class="transfer-source">情報源：${item.source}</div>`:''}</article>`).join(''):'<div class="transfer-empty"><strong>現在表示できる移籍情報はありません</strong><p>情報源を接続後、確定情報と噂を分けて表示します。</p></div>';
}

function openTransferView(){
  ['#homeView','#teamDetailView','#standingsView','#searchView','#settingsView','#onboarding'].forEach(selector=>document.querySelector(selector)?.classList.add('hidden'));
  document.querySelector('#transfersView')?.classList.remove('hidden');
  document.querySelectorAll('.nav-item').forEach(item=>item.classList.toggle('active',item.dataset.view==='transfers'));
  renderTransfers();
  window.scrollTo({top:0,behavior:'smooth'});
}

document.addEventListener('click',event=>{
  const nav=event.target.closest('[data-view="transfers"]');
  if(nav){event.preventDefault();event.stopImmediatePropagation();openTransferView();return;}
  const filter=event.target.closest('[data-transfer-filter]');
  if(filter){transferFilter=filter.dataset.transferFilter;document.querySelectorAll('[data-transfer-filter]').forEach(button=>button.classList.toggle('active',button===filter));renderTransfers();}
},true);

loadTransfers();