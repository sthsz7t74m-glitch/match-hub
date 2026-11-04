/* Shared pinned table headers for football standings.
 * A horizontal overflow ancestor prevents CSS sticky from following page scroll on iOS.
 * This shared viewport overlay tracks header, columns and horizontal scroll instead.
 */
(function initializeStickyStandings(){
  const selectors=['#championsView .cl-table','#standingsTable table'];
  const overlay=document.createElement('div');
  overlay.className='sports-sticky-table-heading';
  overlay.setAttribute('aria-hidden','true');
  overlay.hidden=true;
  document.body.appendChild(overlay);
  let activeTable=null,activeHead=null;
  let frame=0;
  function schedule(){
    if(frame)return;
    frame=requestAnimationFrame(()=>{frame=0;update();});
  }
  function visible(table){
    if(!table||!table.isConnected||!table.tHead||!table.tHead.rows.length)return false;
    if(table.closest('.hidden,[hidden]'))return false;
    if(getComputedStyle(table).display==='none')return false;
    const rect=table.getBoundingClientRect();
    return rect.width>0&&rect.height>0;
  }
  function horizontalContainer(table){
    let el=table.parentElement;
    while(el&&el!==document.body){
      const overflow=getComputedStyle(el).overflowX;
      if((overflow==='auto'||overflow==='scroll')&&el.scrollWidth>el.clientWidth+1)return el;
      el=el.parentElement;
    }
    return table.parentElement;
  }
  function hide(){overlay.hidden=true;activeTable=null;activeHead=null;}
  function update(){
    const topbar=document.querySelector('.football-hub .topbar,.football-hub .sports-header');
    const top=Math.max(0,topbar?.getBoundingClientRect().bottom||0);
    const table=selectors.flatMap(selector=>[...document.querySelectorAll(selector)])
      .find(candidate=>{
        if(!visible(candidate))return false;
        const r=candidate.getBoundingClientRect(),head=candidate.tHead.getBoundingClientRect();
        return head.bottom<=top+1&&r.bottom>top+head.height+1;
      });
    if(!table){hide();return;}
    const wrap=horizontalContainer(table);
    const wr=wrap.getBoundingClientRect(),tr=table.getBoundingClientRect();
    const head=table.tHead,headHeight=head.getBoundingClientRect().height;
    if(table!==activeTable||head!==activeHead){
      overlay.replaceChildren();
      const mirror=document.createElement('table');
      mirror.className=table.className;
      mirror.appendChild(head.cloneNode(true));
      overlay.appendChild(mirror);
      activeTable=table;activeHead=head;
    }
    const mirror=overlay.firstElementChild;
    const originalCells=[...head.rows[0].cells],mirrorCells=[...mirror.tHead.rows[0].cells];
    originalCells.forEach((cell,i)=>{
      if(!mirrorCells[i])return;
      const w=cell.getBoundingClientRect().width;
      mirrorCells[i].style.width=w+'px';
      mirrorCells[i].style.minWidth=w+'px';
      mirrorCells[i].style.maxWidth=w+'px';
      mirrorCells[i].style.boxSizing='border-box';
    });
    overlay.style.top=top+'px';
    overlay.style.left=Math.max(0,wr.left)+'px';
    overlay.style.width=Math.min(wr.width,window.innerWidth-Math.max(0,wr.left))+'px';
    overlay.style.height=headHeight+'px';
    mirror.style.width=tr.width+'px';
    mirror.style.minWidth=tr.width+'px';
    mirror.style.marginLeft=(tr.left-Math.max(0,wr.left))+'px';
    overlay.hidden=false;
  }
  const observer=new MutationObserver(schedule);
  ['#championsView','#standingsTable'].forEach(selector=>{
    const root=document.querySelector(selector);
    if(root)observer.observe(root,{subtree:true,childList:true,attributes:true,attributeFilter:['class','hidden']});
  });
  window.addEventListener('scroll',schedule,{passive:true});
  window.addEventListener('resize',schedule,{passive:true});
  document.addEventListener('scroll',schedule,{capture:true,passive:true});
  document.addEventListener('click',schedule);
  if(document.fonts?.ready)document.fonts.ready.then(schedule);
  schedule();
})();
