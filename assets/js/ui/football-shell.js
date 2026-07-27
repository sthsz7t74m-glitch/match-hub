window.FootballUI = window.FootballUI || {};

(function initializeFootballShell(namespace) {
  if (namespace.FootballShell) return;

  const shellConfigs = {
    five: {
      eyebrow: 'FOOTBALL SCHEDULE',
      title: 'Match Hub',
      version: 'v1.1.0',
      back: './sports-home.html',
      navAttribute: 'view',
      nav: [
        ['home', '⌂', 'ホーム'],
        ['schedule', '▤', '日程'],
        ['standings', '≡', '順位表'],
        ['search', '⌕', '検索'],
        ['transfers', '↔', '移籍'],
        ['settings', '⚙', '設定']
      ]
    },
    jleague: {
      eyebrow: 'JAPAN PROFESSIONAL FOOTBALL',
      title: 'Jリーグ',
      version: 'v3.1.2',
      back: './sports-home.html',
      navAttribute: 'page',
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
      version: 'v3.2.0',
      back: './sports-home.html',
      navAttribute: 'page',
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
    }
  }

  class FootballShell {
    constructor(page = document.body.dataset.hub) {
      this.page = page;
      this.config = shellConfigs[page];
    }

    renderHeader() {
      const root = document.querySelector('.topbar');
      if (!root || !this.config) return;

      root.innerHTML = `
        <div class="football-header__identity">
          <a class="back-link" href="${this.config.back}" aria-label="Sports Hubへ戻る">←</a>
          <div class="football-header__copy">
            <p class="eyebrow">${this.config.eyebrow}</p>
            <div class="football-header__title-row">
              <h1>${this.config.title}</h1>
              <span class="version">${this.config.version}</span>
            </div>
          </div>
        </div>
        <div class="topbar__actions">
          <button id="themeButton" class="icon-button" type="button" aria-label="テーマ切替">◐</button>
        </div>`;

      root.dataset.shellPage = this.page;
    }

    renderNavigation() {
      const root = document.querySelector('#pageTabs');
      if (!root || !this.config) return;

      const attribute = this.config.navAttribute || 'page';
      root.innerHTML = this.config.nav
        .map(([target, icon, label, badge], index) => `
          <button class="nav-item hub-nav__item${index === 0 ? ' active' : ''}" data-${attribute}="${target}" type="button">
            ${icon}<span>${label}${badge ? ` <b id="${badge}">0</b>` : ''}</span>
          </button>`)
        .join('');

      root.setAttribute('aria-label', `${this.config.title}メニュー`);
      root.dataset.navigationType = attribute;
      new BottomNavigation(root).normalize();
    }

    render() {
      if (!this.config) return this;
      this.renderHeader();
      this.renderNavigation();
      return this;
    }
  }

  Object.assign(namespace, {
    BottomNavigation,
    FootballShell,
    shellConfigs,
    renderShell(page = document.body.dataset.hub) {
      const shell = new FootballShell(page).render();
      namespace.shell = shell;
      return shell;
    }
  });

  namespace.renderShell(document.body.dataset.hub);
})(window.FootballUI);
