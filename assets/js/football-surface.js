window.FootballSurface = window.FootballSurface || {};

(function initializeFootballSurface(namespace) {
  const PAGE_CONFIGS = {
    five: {
      title: 'Match Hub',
      eyebrow: 'FOOTBALL SCHEDULE',
      version: 'v1.0.9',
      backLabel: 'Sports Hubへ戻る'
    },
    jleague: {
      title: 'Jリーグ',
      eyebrow: 'JAPAN PROFESSIONAL FOOTBALL'
    },
    national: {
      title: '各国代表',
      eyebrow: 'NATIONAL TEAMS'
    }
  };

  const loadScript = source => new Promise((resolve, reject) => {
    const path = source.split('?')[0];
    const existing = [...document.scripts].find(script => script.src.includes(path));

    if (existing) {
      if (existing.dataset.loaded === 'true' || existing.readyState === 'complete') {
        resolve(existing);
      } else {
        existing.addEventListener('load', () => resolve(existing), { once: true });
      }
      return;
    }

    const script = document.createElement('script');
    script.src = source;
    script.dataset.loaded = 'false';
    script.addEventListener('load', () => {
      script.dataset.loaded = 'true';
      resolve(script);
    }, { once: true });
    script.addEventListener('error', () => reject(new Error(`Failed to load ${source}`)), { once: true });
    document.head.appendChild(script);
  });

  class FootballSurfaceEnhancer {
    constructor(page = document.body.dataset.hub) {
      this.page = page;
      this.config = PAGE_CONFIGS[page] || {};
    }

    enhanceBody() {
      document.body.classList.add('football-hub');
      document.querySelector('main')?.classList.add('hub-main');
    }

    enhanceHeader() {
      const header = document.querySelector('.topbar');
      if (!header) return;

      header.classList.add('football-hub__header');
      if (this.page !== 'five') return;

      const titleGroup = header.firstElementChild;
      if (!titleGroup) return;

      titleGroup.classList.add('football-title-group');
      if (!titleGroup.querySelector('.back-link')) {
        const back = document.createElement('a');
        back.className = 'back-link';
        back.href = './sports-home.html';
        back.setAttribute('aria-label', this.config.backLabel || 'Sports Hubへ戻る');
        back.textContent = '←';
        titleGroup.prepend(back);
      }

      const eyebrow = titleGroup.querySelector('.eyebrow');
      if (eyebrow && this.config.eyebrow) eyebrow.textContent = this.config.eyebrow;

      const heading = titleGroup.querySelector('h1');
      if (!heading) return;

      const version = heading.querySelector('.version');
      heading.childNodes[0].textContent = `${this.config.title || 'Match Hub'} `;
      if (version && this.config.version) version.textContent = this.config.version;
    }

    enhanceNavigation() {
      const nav = document.querySelector('.bottom-nav');
      if (!nav) return;

      if (!nav.id) nav.id = 'pageTabs';
      const items = [...nav.querySelectorAll('.nav-item')];
      nav.style.setProperty('--nav-count', items.length);
      items.forEach(item => item.classList.add('hub-nav__item'));
      window.FootballUI?.BottomNavigation && new window.FootballUI.BottomNavigation(nav).normalize();
    }

    async connectSharedBehavior() {
      await loadScript('./assets/js/ui/football-navigation.js?v=2');
      if (this.page !== 'five') return;

      await loadScript('./assets/js/ui/football-calendar.js?v=4');
      await loadScript('./assets/js/ui/match-hub-calendar.js?v=1');
    }

    async start() {
      this.enhanceBody();
      this.enhanceHeader();
      this.enhanceNavigation();
      await this.connectSharedBehavior();
      return this;
    }
  }

  Object.assign(namespace, {
    PAGE_CONFIGS,
    FootballSurfaceEnhancer,
    loadScript,
    start(page) {
      return new FootballSurfaceEnhancer(page).start();
    }
  });

  document.addEventListener('DOMContentLoaded', () => {
    namespace.start(document.body.dataset.hub)
      .catch(error => console.warn('Football surface unavailable', error));
  });
})(window.FootballSurface);
