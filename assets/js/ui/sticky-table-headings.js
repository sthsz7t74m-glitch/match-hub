/* Shared viewport-fixed headings for every Match Hub standings table.
 * Do not use position:sticky inside an overflow-x:auto table wrapper: on iOS
 * that wrapper becomes the sticky scroll container even when only page scrolls.
 * Align each floating heading cell directly to its live column coordinates.
 */
(() => {
  const selector = '#championsView .cl-table, #standingsTable table';
  const layer = document.createElement('div');
  layer.className = 'sports-sticky-table-heading';
  layer.setAttribute('aria-hidden', 'true');
  layer.hidden = true;
  document.body.appendChild(layer);
  let tableShown = null;
  let raf = 0;
  const topOfHeader = () => {
    const header = document.querySelector('.football-hub .topbar, .football-hub .sports-header');
    return Math.max(0, header?.getBoundingClientRect().bottom || 0);
  };
  const isVisible = element => {
    for (let el = element; el && el !== document.body; el = el.parentElement) {
      if (el.hidden || el.classList.contains('hidden')) return false;
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
    }
    return true;
  };
  const horizontalBounds = table => {
    let box = table.parentElement;
    while (box && box !== document.body) {
      if (/(auto|scroll)/.test(getComputedStyle(box).overflowX)) break;
      box = box.parentElement;
    }
    return (box && box !== document.body ? box : table.parentElement).getBoundingClientRect();
  };
  const hide = () => { layer.hidden = true; tableShown = null; };
  function update() {
    const top = topOfHeader();
    const table = [...document.querySelectorAll(selector)].find(t => {
      if (!isVisible(t) || !t.tHead?.rows?.length) return false;
      const rect = t.getBoundingClientRect();
      // Switch on as soon as the first table header would pass under the topbar.
      return rect.width > 0 && rect.height > 0 && rect.top < top && rect.bottom > top + 30;
    });
    if (!table) return hide();
    const firstRow = table.tHead.rows[0];
    const cells = [...firstRow.cells];
    const rowRect = firstRow.getBoundingClientRect();
    if (cells.length === 0 || rowRect.height <= 0) return hide();

    if (tableShown !== table || layer.childElementCount !== cells.length) {
      layer.replaceChildren(...cells.map(cell => {
        const label = document.createElement('span');
        label.className = 'sports-sticky-table-heading__cell';
        label.textContent = cell.textContent.trim();
        return label;
      }));
      tableShown = table;
    }
    const bounds = horizontalBounds(table);
    const left = Math.max(0, bounds.left);
    const right = Math.min(window.innerWidth, bounds.right);
    if (right <= left) return hide();
    Object.assign(layer.style, {
      top: top + 'px', left: left + 'px', width: (right - left) + 'px',
      height: Math.ceil(rowRect.height) + 'px'
    });
    cells.forEach((cell, i) => {
      const rect = cell.getBoundingClientRect();
      const target = layer.children[i];
      // Follow both horizontal scrolling and table column widths exactly.
      target.style.left = (rect.left - left) + 'px';
      target.style.width = rect.width + 'px';
      target.style.height = Math.ceil(rowRect.height) + 'px';
      target.textContent = cell.textContent.trim();
    });
    layer.hidden = false;
  }
  const schedule = () => {
    if (raf) return;
    raf = requestAnimationFrame(() => { raf = 0; update(); });
  };
  const observer = new MutationObserver(schedule);
  for (const id of ['championsView', 'standingsView']) {
    const root = document.getElementById(id);
    if (root) observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'hidden'] });
  }
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule, { passive: true });
  document.addEventListener('scroll', schedule, { capture: true, passive: true });
  document.addEventListener('click', schedule, true);
  document.addEventListener('change', schedule);
  if (window.visualViewport) {
    window.visualViewport.addEventListener('scroll', schedule, { passive: true });
    window.visualViewport.addEventListener('resize', schedule, { passive: true });
  }
  document.fonts?.ready.then(schedule);
  schedule();
})();
