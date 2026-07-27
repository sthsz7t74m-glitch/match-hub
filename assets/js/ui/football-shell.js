const sharedSportsUI = window.SportsUI || window.FootballUI || {};
window.SportsUI = sharedSportsUI;
window.FootballUI = sharedSportsUI;

(function initializeSportsShell(namespace) {
  const Core = window.SportsCore || window.FootballCore || {};
  const ComponentBase = Core.SportsComponent || class {
    constructor({ root = null } = {}) { this.root = root; }
    destroy() { this.root = null; }
  };

  const installZoomLock = () => {
    if (document.documentElement.dataset.zoomLocked === 'true') return;
    document.documentElement.dataset.zoomLocked = 'true';

    let viewport = document.querySelector('meta[name="viewport"]');
    if (!viewport) {
      viewport = document.createElement('meta');
      viewport.name = 'viewport';
      document.head.prepend(viewport);
    }
    viewport.content = 'width=device-width,initial-scale=1,minimum-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover';

    const style = document.createElement('style');
    style.dataset.zoomLock = 'true';
    style.textContent = 'html,body{touch-action:pan-x pan-y!important;-webkit-text-size-adjust:100%!important;text-size-adjust:100%!important}button,a,input,select,textarea,[role="button"]{touch-action:manipulation!important}input,select,textarea{font-size:16px!important}';
    document.head.appendChild(style);

    const prevent = event => event.preventDefault();
    ['gesturestart', 'gesturechange', 'gestureend'].forEach(type => {
      document.addEventListener(type, prevent, { passive: false });
    });
    document.addEventListener('touchmove', event => {
      if (event.touches?.length > 1) event.preventDefault();
    }, { passive: false });
    document.addEventListener('dblclick', prevent, { passive: false });
    document.addEventListener('wheel', event => {
      if (event.ctrlKey || event.metaKey) event.preventDefault();
    }, { passive: false });
    document.addEventListener('keydown', event => {
      if ((event.ctrlKey || event.metaKey) && ['+', '=', '-', '_', '0'].includes(event.key)) event.preventDefault();
    });
  };

  installZoomLock();
  if (namespace.SportsShell?.SHELL_VERSION >= 2) return;

  const registry = window.SportsHubRegistry;
  const getPageConfig = page => registry?.get?.(page) || null;

  const iconPaths = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V21h13V9.5"/><path d="M9.5 21v-6h5v6"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/>',
    ranking: '<path d="M6 20V10M12 20V4M18 20v-7"/><path d="M3 20h18"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    transfer: '<path d="M7 7h11l-3-3M18 7l-3 3"/><path d="M17 17H6l3 3M6 17l3-3"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.1A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3v-4h.1A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.1A1.7 1.7 0 0 0 15.4 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.38.3.6.66.6 1.1v.1h1v4h-.1A1.7 1.7 0 0 0 19.4 15Z"/>',
    teams: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M14 15.2c.9-.8 2-1.2 3.2-1.2 2.7 0 4.8 2.2 4.8 4.8V20"/>',
    player: '<circle cx="12" cy="8" r="4"/><path d="M5 21c0-4 3.1-7 7-7s7 3 7 7"/><path d="M16.5 4.5 20 2M18.5 6.5 22 4"/>',
    star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z"/>',
    trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0V4Z"/><path d="M8 6H4v1a4 4 0 0 0 4 4M16 6h4v1a4 4 0 0 1-4 4M12 13v4M8 21h8M9 17h6"/>'
  };

  const renderIcon = name => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${iconPaths[name] || iconPaths.home}</svg>`;
  const renderNavigationItem = (item, index, attribute) => `
    <button class="nav-item football-nav__item${index === 0 ? ' active' : ''}" data-${attribute}="${item.target}" type="button">
      <span class="football-nav__indicator" aria-hidden="true"><span class="football-nav__icon">${renderIcon(item.icon)}</span></span>
      <span class="football-nav__label">${item.label}${item.badgeId ? ` <b class="football-nav__badge" id="${item.badgeId}">0</b>` : ''}</span>
    </button>`;

  class SportsHeader extends ComponentBase {
    constructor({ root, config, page } = {}) {
      super({ root });
      this.config = config;
      this.page = page;
      this.observer = null;
    }

    get sport() {
      return this.config?.sport || 'generic';
    }

    template() {
      return `
        <div class="football-header__identity">
          <a class="back-link" href="${this.config.back}" aria-label="Sports Hubへ戻る">←</a>
          <div class="football-header__copy">
            <p class="eyebrow">${this.config.eyebrow}</p>
            <div class="football-header__title-row"><h1>${this.config.title}</h1><span class="version">${this.config.version}</span></div>
          </div>
        </div>
        <div class="topbar__actions"><button id="themeButton" class="icon-button" type="button" aria-label="テーマ切替">◐</button></div>`;
    }

    syncHeight() {
      if (!this.root) return;
      const height = Math.ceil(this.root.getBoundingClientRect().height);
      if (height > 0) document.documentElement.style.setProperty('--sports-header-height', `${height}px`);
    }

    observe() {
      this.observer?.disconnect?.();
      if (typeof ResizeObserver === 'function' && this.root) {
        this.observer = new ResizeObserver(() => this.syncHeight());
        this.observer.observe(this.root);
      }
      requestAnimationFrame(() => this.syncHeight());
    }

    render() {
      if (!this.root || !this.config) return this;
      this.root.innerHTML = this.template();
      this.root.classList.add('sports-header', `sports-header--${this.sport}`);
      this.root.dataset.shellPage = this.page;
      this.root.dataset.sport = this.sport;
      this.observe();
      return this;
    }

    destroy() {
      this.observer?.disconnect?.();
      this.observer = null;
      super.destroy();
    }
  }

  class SoccerHeader extends SportsHeader {}
  class BaseballHeader extends SportsHeader {}

  class SportsBottomNavigation extends ComponentBase {
    normalize() {
      if (!this.root) return this;
      const items = [...this.root.querySelectorAll('.football-nav__item')];
      this.root.style.setProperty('--nav-count', items.length);
      items.forEach(item => {
        const label = item.querySelector('.football-nav__label');
        if (label) item.setAttribute('aria-label', label.textContent.trim());
      });
      return this;
    }
  }

  class SportsShell extends ComponentBase {
    static SHELL_VERSION = 2;

    constructor(page = document.body.dataset.hub) {
      super({ root: document.body });
      this.page = page;
      this.config = getPageConfig(page);
      this.header = null;
      this.navigation = null;
    }

    get HeaderClass() {
      return this.config?.sport === 'baseball' ? BaseballHeader : SoccerHeader;
    }

    renderHeader() {
      const root = document.querySelector('.topbar');
      if (!root || !this.config) return;
      this.header?.destroy?.();
      this.header = new this.HeaderClass({ root, config: this.config, page: this.page }).render();
    }

    renderNavigation() {
      const root = document.querySelector('#pageTabs');
      const navigation = this.config?.navigation;
      if (!root || !navigation) return;
      root.classList.add('football-nav', 'sports-navigation');
      root.innerHTML = navigation.items.map((item, index) => renderNavigationItem(item, index, navigation.attribute)).join('');
      root.setAttribute('aria-label', `${this.config.title}メニュー`);
      root.dataset.navigationType = navigation.attribute;
      this.navigation = new SportsBottomNavigation({ root }).normalize();
    }

    render() {
      if (!this.config) return this;
      document.body.dataset.sport = this.config.sport;
      this.renderHeader();
      this.renderNavigation();
      return this;
    }

    destroy() {
      this.header?.destroy?.();
      this.navigation?.destroy?.();
      super.destroy();
    }
  }

  class SoccerHubShell extends SportsShell {
    get HeaderClass() { return SoccerHeader; }
  }

  class BaseballHubShell extends SportsShell {
    get HeaderClass() { return BaseballHeader; }
  }

  const createShell = (page = document.body.dataset.hub) => {
    const config = getPageConfig(page);
    const ShellClass = config?.sport === 'baseball' ? BaseballHubShell : SoccerHubShell;
    return new ShellClass(page);
  };

  Object.assign(namespace, {
    installZoomLock,
    SportsHeader,
    SoccerHeader,
    BaseballHeader,
    SportsBottomNavigation,
    SportsShell,
    SoccerHubShell,
    BaseballHubShell,
    BottomNavigation: SportsBottomNavigation,
    FootballShell: SoccerHubShell,
    shellConfigs: registry?.toObject?.() || {},
    iconPaths,
    renderIcon,
    renderNavigationItem,
    createShell,
    renderShell(page = document.body.dataset.hub) {
      namespace.shell?.destroy?.();
      namespace.shell = createShell(page).render();
      return namespace.shell;
    }
  });

  namespace.renderShell(document.body.dataset.hub);
})(sharedSportsUI);
