const sharedSportsCore = window.SportsCore || window.FootballCore || {};
window.SportsCore = sharedSportsCore;
window.FootballCore = sharedSportsCore;

(function initializeSportsCore(namespace) {
  const Repositories = window.SportsRepositories || window.FootballRepositories || {};
  const Services = window.SportsServices || window.FootballServices || {};

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[character]));

  const classNames = (...values) => values
    .flatMap(value => String(value || '').split(/\s+/))
    .filter(Boolean)
    .join(' ');

  const renderAttributes = attributes => Object.entries(attributes || {})
    .filter(([, value]) => value !== undefined && value !== null && value !== false)
    .map(([key, value]) => ` ${escapeHtml(key)}="${escapeHtml(value === true ? '' : value)}"`)
    .join('');

  class SportsComponent {
    constructor({ root = null } = {}) {
      this.root = root;
      this.mounted = false;
    }

    attach(root) {
      this.root = root;
      return this;
    }

    mount(root = this.root) {
      if (root) this.root = root;
      this.mounted = Boolean(this.root);
      return this;
    }

    render() {
      return this;
    }

    destroy() {
      this.mounted = false;
      this.root = null;
    }
  }

  class SportsView extends SportsComponent {
    constructor({ root = null, state = {} } = {}) {
      super({ root });
      this.state = state;
    }

    setState(patch = {}) {
      Object.assign(this.state, typeof patch === 'function' ? patch(this.state) : patch);
      return this.render();
    }
  }

  class SportsPageTabs extends SportsComponent {
    constructor({
      root,
      pageSelector = '.page-view',
      activeClass = 'active',
      attribute = 'page',
      initial = 'home',
      scope = document
    } = {}) {
      super({ root });
      Object.assign(this, { pageSelector, activeClass, attribute, scope });
      this.current = initial;
      this.bound = false;
      this.onChange = null;
      this.handleClick = this.handleClick.bind(this);
    }

    show(page) {
      this.current = page;
      this.scope.querySelectorAll(this.pageSelector).forEach(node => {
        node.classList.toggle(this.activeClass, node.id === `page-${page}`);
      });
      this.root?.querySelectorAll(`[data-${this.attribute}]`).forEach(button => {
        button.classList.toggle(this.activeClass, button.dataset[this.attribute] === page);
      });

      const detail = { page, tabs: this };
      document.dispatchEvent(new CustomEvent('sports:page-change', { detail }));
      document.dispatchEvent(new CustomEvent('football:page-change', { detail }));
      return page;
    }

    handleClick(event) {
      const button = event.target.closest(`[data-${this.attribute}]`);
      if (!button || !this.root?.contains(button)) return;
      this.show(button.dataset[this.attribute]);
      this.onChange?.(this.current, { button, event, tabs: this });
    }

    bind(onChange) {
      if (this.bound) return this;
      this.bound = true;
      this.onChange = onChange || null;
      this.root?.addEventListener('click', this.handleClick);
      return this;
    }

    destroy() {
      this.root?.removeEventListener('click', this.handleClick);
      this.bound = false;
      this.onChange = null;
      super.destroy();
    }
  }

  class SportsEmptyState extends SportsComponent {
    constructor({
      root = null,
      title = '',
      description = '',
      icon = '',
      actions = [],
      className = '',
      attributes = {}
    } = {}) {
      super({ root });
      Object.assign(this, { title, description, icon, actions, className, attributes });
    }

    renderAction(action = {}) {
      const label = action.label || '';
      if (!label) return '';
      const classes = classNames('sports-empty-state__action', action.className || 'text-button');
      const attributes = {
        ...(action.attributes || {}),
        ...(action.action ? { 'data-sports-empty-action': action.action } : {})
      };

      if (action.href) {
        return `<a class="${classes}" href="${escapeHtml(action.href)}"${renderAttributes(attributes)}>${escapeHtml(label)}</a>`;
      }
      return `<button class="${classes}" type="button"${renderAttributes(attributes)}>${escapeHtml(label)}</button>`;
    }

    toHTML() {
      const classes = classNames('empty-state', 'sports-empty-state', this.className);
      const actions = (Array.isArray(this.actions) ? this.actions : [])
        .map(action => this.renderAction(action))
        .filter(Boolean)
        .join('');

      return `<div class="${classes}"${renderAttributes(this.attributes)}>
        ${this.icon ? `<span class="sports-empty-state__icon" aria-hidden="true">${escapeHtml(this.icon)}</span>` : ''}
        ${this.title ? `<strong>${escapeHtml(this.title)}</strong>` : ''}
        ${this.description ? `<p>${escapeHtml(this.description)}</p>` : ''}
        ${actions ? `<div class="sports-empty-state__actions">${actions}</div>` : ''}
      </div>`;
    }

    render() {
      if (this.root) this.root.innerHTML = this.toHTML();
      return this;
    }

    static normalizeArguments(title, description = '', options = {}) {
      if (title && typeof title === 'object') return { ...title };
      return { ...options, title, description };
    }

    static render(title, description = '', options = {}) {
      return new this(this.normalizeArguments(title, description, options)).toHTML();
    }

    static set(root, title, description = '', options = {}) {
      return new this({
        ...this.normalizeArguments(title, description, options),
        root
      }).render();
    }
  }

  class SportsScheduleEmptyState extends SportsEmptyState {
    constructor(options = {}) {
      super({
        title: 'この期間の試合はありません',
        description: '期間を広げるか、お気に入りを追加してみよう',
        className: 'empty-action sports-empty-state--schedule',
        ...options,
        className: classNames('empty-action sports-empty-state--schedule', options.className)
      });
    }
  }

  class SportsFavoritesEmptyState extends SportsEmptyState {
    constructor(options = {}) {
      super({
        title: 'お気に入りはまだありません',
        description: '一覧から追加すると、関連情報をまとめて表示できます。',
        className: 'empty-action sports-empty-state--favorites',
        ...options,
        className: classNames('empty-action sports-empty-state--favorites', options.className)
      });
    }
  }

  class SportsDataEmptyState extends SportsEmptyState {
    constructor(options = {}) {
      super({
        title: '表示できるデータがありません',
        description: '次回更新後に自動表示されます。',
        className: 'sports-empty-state--data',
        ...options,
        className: classNames('sports-empty-state--data', options.className)
      });
    }
  }

  class FavoriteService extends (Services.FavoriteService || class {}) {}

  Object.assign(namespace, {
    SportsComponent,
    SportsView,
    SportsPageTabs,
    SportsEmptyState,
    SportsScheduleEmptyState,
    SportsFavoritesEmptyState,
    SportsDataEmptyState,
    PageTabs: SportsPageTabs,
    EmptyState: SportsEmptyState,
    ScheduleEmptyState: SportsScheduleEmptyState,
    FavoritesEmptyState: SportsFavoritesEmptyState,
    DataEmptyState: SportsDataEmptyState,
    SportsRepository: Repositories.SportsRepository,
    SportsCollectionRepository: Repositories.SportsCollectionRepository,
    JsonRepository: Repositories.JsonRepository,
    StorageRepository: Repositories.StorageRepository,
    FavoriteRepository: Repositories.FavoriteRepository,
    SettingsRepository: Repositories.SettingsRepository,
    FavoriteService,
    SportsService: Services.SportsService,
    SportsEventModel: Services.SportsEventModel,
    SoccerMatchModel: Services.SoccerMatchModel,
    BaseballGameModel: Services.BaseballGameModel,
    MatchModel: Services.SoccerMatchModel || Services.MatchModel,
    SportsCollectionService: Services.SportsCollectionService,
    SportsEventService: Services.SportsEventService,
    MatchService: Services.MatchService,
    BaseballGameService: Services.BaseballGameService,
    SearchService: Services.SearchService,
    StandingService: Services.StandingService,
    escapeHtml,
    classNames,
    renderAttributes,
    COMPONENT_VERSION: 2
  });
})(sharedSportsCore);
