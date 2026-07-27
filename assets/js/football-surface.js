window.FootballSurface = window.FootballSurface || {};

(function initializeFootballSurface(namespace) {
  const PAGE_CONFIGS = {
    five: {
      title: 'Match Hub',
      eyebrow: 'FOOTBALL SCHEDULE',
      version: 'v1.0.7',
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

  const normalizeCalendarDay = element => {
    if (!element?.classList?.contains('calendar-day')) return;

    element.classList.add('football-calendar__day');
    element.classList.toggle('is-blank', element.classList.contains('blank'));
    element.classList.toggle('is-selected', element.classList.contains('selected'));
    element.classList.toggle('is-today', element.classList.contains('today'));
  };

  class FootballSurfaceEnhancer {
    constructor(page = document.body.dataset.hub) {
      this.page = page;
      this.config = PAGE_CONFIGS[page] || {};
      this.calendarObserver = null;
    }

    enhanceBody() {
      document.body.classList.add('football-hub');
      document.querySelector('main')?.classList.add('hub-main');
    }

    enhanceHeader() {
      const header = document.querySelector('.topbar');
      if (!header) return;

      header.classList.add('football-hub__header');

      if (this.page === 'five') {
        const titleGroup = header.firstElementChild;
        if (titleGroup) {
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
          if (heading) {
            const version = heading.querySelector('.version');
            heading.childNodes[0].textContent = `${this.config.title || 'Match Hub'} `;
            if (version && this.config.version) version.textContent = this.config.version;
          }
        }
      }
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

    enhanceCalendar() {
      const root = document.querySelector('#calendarGrid, #matchCalendar');
      if (!root) return;

      root.classList.add('football-calendar');
      [...root.children].forEach(normalizeCalendarDay);

      this.calendarObserver?.disconnect();
      this.calendarObserver = new MutationObserver(() => {
        [...root.children].forEach(normalizeCalendarDay);
      });
      this.calendarObserver.observe(root, { childList: true, subtree: false });
    }

    start() {
      this.enhanceBody();
      this.enhanceHeader();
      this.enhanceNavigation();
      this.enhanceCalendar();
      return this;
    }
  }

  Object.assign(namespace, {
    PAGE_CONFIGS,
    FootballSurfaceEnhancer,
    start(page) {
      return new FootballSurfaceEnhancer(page).start();
    }
  });

  document.addEventListener('DOMContentLoaded', () => {
    namespace.start(document.body.dataset.hub);
  });
})(window.FootballSurface);
