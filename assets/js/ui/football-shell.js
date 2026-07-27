window.FootballUI = window.FootballUI || {};

(function initializeFootballShell(namespace) {
  if (namespace.FootballShell) return;

  const shellConfigs = {
    jleague: {
      eyebrow: 'JAPAN PROFESSIONAL FOOTBALL',
      title: 'Jリーグ',
      version: 'v3.1.1',
      back: './sports-home.html',
      nav: [
        ['home', '⌂', 'ホーム'],
        ['schedule', '▤', '日程'],
        ['standings', '≡', '順位'],
        ['clubs', '⌕', 'クラブ'],
        ['favorites', '★', '推し', 'favoriteCountBadge']
      ]
    },
    national: {
      eyebrow: 'NATIONAL TEAMS',
      title: '各国代表',
      version: 'v3.1.9',
      back: './sports-home.html',
      nav: [
        ['home', '⌂', 'ホーム'],
        ['schedule', '▤', '日程'],
        ['teams', '⌕', '代表'],
        ['competitions', '🏆', '大会'],
        ['favorites', '★', '推し', 'favoriteCountBadge']
      ]
    }
  };

  class BottomNavigation {
    constructor(root) {
      this.root = root;
    }

    normalize() {
      if (!this.root) return;

      const items = [...this.root.querySelectorAll('.nav-item')];
      this.root.style.setProperty('--nav-count', items.length);

      items.forEach(item => {
        const label = item.querySelector('span');
        if (label) item.setAttribute('aria-label', label.textContent.trim());
      });

      if (this.root.dataset.repeatTapBound === 'true') return;
      this.root.dataset.repeatTapBound = 'true';
      this.root.addEventListener('click', event => {
        const item = event.target.closest('.nav-item');
        if (!item || !this.root.contains(item) || !item.classList.contains('active')) return;

        event.preventDefault();
        event.stopImmediatePropagation();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, true);
    }
  }

  class FootballShell {
    constructor(page = document.body.dataset.hub) {
      this.config = shellConfigs[page];
    }

    renderHeader() {
      const root = document.querySelector('.topbar');
      if (!root || !this.config) return;

      root.innerHTML = `<div style="display:flex;align-items:center;gap:10px"><a class="back-link" href="${this.config.back}" aria-label="Sports Hubへ戻る">←</a><div><p class="eyebrow">${this.config.eyebrow}</p><h1>${this.config.title} <span class="version">${this.config.version}</span></h1></div></div><div class="topbar__actions"><button id="themeButton" class="icon-button" type="button" aria-label="テーマ切替">◐</button></div>`;
    }

    renderNavigation() {
      const root = document.querySelector('#pageTabs');
      if (!root || !this.config) return;

      root.innerHTML = this.config.nav
        .map(([page, icon, label, badge], index) => `<button class="nav-item hub-nav__item${index === 0 ? ' active' : ''}" data-page="${page}" type="button">${icon}<span>${label}${badge ? ` <b id="${badge}">0</b>` : ''}</span></button>`)
        .join('');

      root.setAttribute('aria-label', `${this.config.title}メニュー`);
      new BottomNavigation(root).normalize();
    }

    render() {
      this.renderHeader();
      this.renderNavigation();
    }
  }

  Object.assign(namespace, {
    BottomNavigation,
    FootballShell,
    shellConfigs
  });
})(window.FootballUI);
