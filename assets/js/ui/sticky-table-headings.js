/* Shared fixed standings header for league and UEFA tables.
 * Render the floating header outside overflow-x containers, while mirroring
 * real cell widths and horizontal scroll offsets. Supports iOS Safari.
 */
(function initializeStickyStandings() {
  const SELECTOR = '#championsView .cl-table, #standingsTable table';
  const bar = document.createElement('div');
  bar.className = 'sports-sticky-table-heading';
  bar.setAttribute('aria-hidden', 'true');
  bar.hidden = true;
  document.body.appendChild(bar);
  let current = null, mirror = null, frame = 0;

  const headerBottom = () => {
    const header = document.querySelector('.football-hub .topbar, .football-hub .sports-header');
    return Math.max(0, header ? header.getBoundingClientRect().bottom : 0);
  };
  const active = element => {
    for (let node = element; node && node !== document.body; node = node.parentElement) {
      if (node.hidden || node.classList.contains('hidden')) return false;
      const style = getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
    }
    return true;
  };
  const scrollBox = table => {
    for (let node = table.parentElement; node && node !== document.body; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (/(auto|scroll)/.test(style.overflowX)) return node;
    }
    return table.parentElement;
  };
  function clear() {
    bar.hidden = true;
    current = null;
    mirror = null;
  }
  function paint() {
    const top = headerBottom();
    const tables = [...document.querySelectorAll(SELECTOR)].filter(t => t.tHead && t.tHead.rows.length && active(t));
    const table = tables.find(t => {
      const rect = t.getBoundingClientRect();
      const h = t.tHead.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && h.top < top && rect.bottom > top + h.height;
    });
    if (!table) return clear();

    const box = scrollBox(table);
    const boxRect = box.getBoundingClientRect();
    const rect = table.getBoundingClientRect();
    const head = table.tHead.getBoundingClientRect();
    if (current !== table || !mirror) {
      bar.replaceChildren();
      mirror = document.createElement('table');
      mirror.className = table.className + ' sports-sticky-table-heading__table';
      mirror.setAttribute('role', 'presentation');
      mirror.appendChild(table.tHead.cloneNode(true));
      bar.appendChild(mirror);
      current = table;
    }

    // Table headers can reflow when data, fonts or browser zoom change.
    const sourceCells = [...table.tHead.rows[0].cells];
    const targetCells = [...mirror.tHead.rows[0].cells];
    if (sourceCells.length !== targetCells.length) {
      current = null;
      return paint();
    }
    const widths = sourceCells.map(cell => cell.getBoundingClientRect().width);
    const total = widths.reduce((sum, width) => sum + width, 0);
    targetCells.forEach((cell, i) => {
      cell.style.boxSizing = 'border-box';
      cell.style.width = widths[i] + 'px';
      cell.style.minWidth = widths[i] + 'px';
      cell.style.maxWidth = widths[i] + 'px';
      cell.style.paddingLeft = getComputedStyle(sourceCells[i]).paddingLeft;
      cell.style.paddingRight = getComputedStyle(sourceCells[i]).paddingRight;
    });

    const left = Math.max(0, boxRect.left);
    const right = Math.min(window.innerWidth, boxRect.right);
    if (right <= left) return clear();
    Object.assign(bar.style, {
      top: top + 'px',
      left: left + 'px',
      width: (right - left) + 'px',
      height: head.height + 'px'
    });
    // Use source table's actual viewport position, including horizontal scrolling.
    mirror.style.width = Math.max(total, rect.width) + 'px';
    mirror.style.minWidth = Math.max(total, rect.width) + 'px';
    mirror.style.marginLeft = (rect.left - left) + 'px';
    bar.hidden = false;
  }
  function schedule() {
    if (frame) return;
    frame = requestAnimationFrame(() => { frame = 0; paint(); });
  }
  const observer = new MutationObserver(schedule);
  ['#championsView', '#standingsView'].forEach(selector => {
    const node = document.querySelector(selector);
    if (node) observer.observe(node, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'hidden'] });
  });
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule, { passive: true });
  window.addEventListener('orientationchange', schedule);
  document.addEventListener('scroll', schedule, { capture: true, passive: true });
  document.addEventListener('click', schedule, { capture: true });
  document.addEventListener('change', schedule);
  if (window.visualViewport) {
    visualViewport.addEventListener('scroll', schedule, { passive: true });
    visualViewport.addEventListener('resize', schedule, { passive: true });
  }
  if (document.fonts?.ready) document.fonts.ready.then(schedule);
  schedule();
})();
