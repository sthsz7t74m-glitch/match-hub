window.SportsHubComponents = window.SportsHubComponents || {};

(function initializeSportsComponents(components) {
  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[character]));

  const classNames = (...values) => values
    .flatMap(value => String(value || '').split(/\s+/))
    .filter(Boolean)
    .join(' ');

  const renderAttributes = attributes => Object.entries(attributes || {})
    .filter(([, value]) => value !== undefined && value !== null && value !== false)
    .map(([key, value]) => ` ${escapeHtml(key)}="${escapeHtml(value === true ? '' : value)}"`)
    .join('');

  const statusLabel = match => {
    const status = String(match?.status || '').toLowerCase();
    if (['finished', 'final'].includes(status)) return '試合終了';
    if (['in_play', 'in-play', 'live', 'paused'].includes(status)) return 'LIVE';
    if (status === 'postponed') return '延期';
    if (status === 'suspended') return '中断';
    if (status === 'cancelled') return '中止';
    return match?.timeLabel || '';
  };

  const decisionLabel = match => {
    if (match?.decisionLabel) return match.decisionLabel;
    const homePens = match?.penalties?.home;
    const awayPens = match?.penalties?.away;
    if (Number.isFinite(homePens) && Number.isFinite(awayPens)) return `PK ${homePens}-${awayPens}`;
    if (match?.decision === 'penalties') return 'PK戦決着';
    if (match?.decision === 'extra_time') return '延長戦決着';
    if (String(match?.status || '').toLowerCase() === 'finished') return '通常決着';
    return '';
  };

  class SportsEventCard {
    constructor({ sport = 'generic', fallback = '●', legacy = {} } = {}) {
      this.sport = sport;
      this.fallback = fallback;
      this.legacy = legacy;
    }

    normalize(options = {}) {
      return options;
    }

    slotClass(slot, ...extra) {
      return classNames(`sports-event-card__${slot}`, this.legacy[slot], ...extra);
    }

    renderBadge(team = {}) {
      const fallbackText = team.fallback || team.badge || team.flag || team.abbreviation || this.fallback;
      const fallback = `<span class="${this.slotClass('fallback')}" aria-hidden="true"${team.logo ? ' hidden' : ''}>${escapeHtml(fallbackText)}</span>`;
      if (!team.logo) return fallback;
      return `<img class="${this.slotClass('badge')}" src="${escapeHtml(team.logo)}" alt="" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false">${fallback}`;
    }

    normalizeInteraction(source = {}, { kind = 'element', id = null, side = '', defaultLabel = '詳細を見る' } = {}) {
      const detail = source.detail && typeof source.detail === 'object' ? source.detail : {};
      const attributes = { ...(source.attributes || {}), ...(detail.attributes || {}) };
      const href = detail.href || source.href || '';
      const action = detail.action || source.action || '';
      const explicitInteractive = detail.interactive ?? source.interactive;
      const hasDataAction = Object.keys(attributes).some(key => key.startsWith('data-'));
      const interactive = explicitInteractive !== false && Boolean(href || action || explicitInteractive || hasDataAction);

      if (action && !attributes[`data-sports-${kind}-action`]) attributes[`data-sports-${kind}-action`] = action;
      if (interactive && id !== undefined && id !== null && id !== '' && !attributes[`data-sports-${kind}-id`]) attributes[`data-sports-${kind}-id`] = String(id);
      if (interactive && side && !attributes[`data-sports-${kind}-side`]) attributes[`data-sports-${kind}-side`] = side;
      if (interactive && !attributes['aria-label']) attributes['aria-label'] = detail.ariaLabel || source.ariaLabel || defaultLabel;

      if (href) {
        attributes.href = href;
        if (detail.target || source.target) attributes.target = detail.target || source.target;
        if (attributes.target === '_blank' && !attributes.rel) attributes.rel = 'noopener noreferrer';
        return { tag: 'a', attributes, interactive: true };
      }
      if (interactive) {
        attributes.type = attributes.type || 'button';
        return { tag: 'button', attributes, interactive: true };
      }
      return { tag: 'div', attributes: {}, interactive: false };
    }

    normalizeTeamInteraction(team = {}, side = 'left', name = '') {
      return this.normalizeInteraction(team, { kind: 'team', id: team.id, side, defaultLabel: `${name}の詳細を見る` });
    }

    renderTeam(team = {}, side = 'left') {
      const subtitle = team.subtitle || team.en || '';
      const sideLegacy = side === 'left' ? this.legacy.teamLeft : this.legacy.teamRight;
      const name = team.name || '未定';
      const interaction = this.normalizeTeamInteraction(team, side, name);
      const customClass = interaction.attributes.class || '';
      delete interaction.attributes.class;
      const classes = this.slotClass('team', `sports-event-card__team--${side}`, interaction.interactive && 'sports-event-card__team--interactive', this.legacy.team, sideLegacy, customClass);
      const tag = interaction.interactive ? interaction.tag : 'span';
      return `<${tag} class="${classes}"${renderAttributes(interaction.attributes)}>
        ${this.renderBadge(team)}
        <span class="${this.slotClass('team-copy')}">
          <strong class="${this.slotClass('team-name')}" title="${escapeHtml(name)}">${escapeHtml(name)}</strong>
          ${subtitle ? `<small class="${this.slotClass('team-subtitle')}">${escapeHtml(subtitle)}</small>` : ''}
        </span>
      </${tag}>`;
    }

    renderMeta(meta = {}) {
      if (!meta.left && !meta.right && !meta.badges?.length) return '';
      const badges = (meta.badges || []).map(badge => `<b class="${this.slotClass('meta-badge', badge.className)}">${escapeHtml(badge.label)}</b>`).join('');
      return `<div class="${this.slotClass('meta', this.legacy.meta)}">
        <span>${escapeHtml(meta.left || '')}</span>
        <span class="${this.slotClass('meta-right')}">${badges}<span>${escapeHtml(meta.right || '')}</span></span>
      </div>`;
    }

    renderCenter(center = {}) {
      const secondaryClass = center.variant ? `sports-event-card__secondary--${center.variant}` : '';
      const interaction = this.normalizeInteraction(center, { kind: 'center', id: center.id, defaultLabel: center.ariaLabel || '試合情報を見る' });
      const customClass = interaction.attributes.class || '';
      delete interaction.attributes.class;
      const classes = this.slotClass('center', this.legacy.center, interaction.interactive && 'sports-event-card__center--interactive', customClass);
      const tag = interaction.interactive ? interaction.tag : 'div';
      return `<${tag} class="${classes}"${renderAttributes(interaction.attributes)}>
        <strong>${escapeHtml(center.primary ?? 'VS')}</strong>
        ${center.secondary ? `<small class="${this.slotClass('secondary', this.legacy.secondary, secondaryClass)}">${escapeHtml(center.secondary)}</small>` : ''}
      </${tag}>`;
    }

    renderFooter(items = []) {
      const visible = (Array.isArray(items) ? items : [items]).filter(Boolean);
      if (!visible.length) return '';
      return `<div class="${this.slotClass('footer', this.legacy.footer)}">${visible.map(item => `<span>${escapeHtml(item)}</span>`).join('')}</div>`;
    }

    render(options = {}) {
      const model = this.normalize(options) || {};
      const classes = classNames('sports-event-card', `sports-event-card--${this.sport}`, this.legacy.root, model.className, model.classes);
      return `<article class="${classes}"${renderAttributes(model.attributes)}>
        ${this.renderMeta(model.meta)}
        <div class="${this.slotClass('body', this.legacy.body)}">
          ${this.renderTeam(model.leftTeam, 'left')}
          ${this.renderCenter(model.center)}
          ${this.renderTeam(model.rightTeam, 'right')}
        </div>
        ${this.renderFooter(model.footer)}
      </article>`;
    }
  }

  const SOCCER_LEGACY_CLASSES = Object.freeze({
    root: 'match-card', meta: 'match-card__meta', body: 'match-card__body', team: 'match-card__team',
    teamLeft: 'match-card__team--home match-card__team--left', teamRight: 'match-card__team--away match-card__team--right',
    badge: 'match-card__badge', fallback: 'match-card__fallback', center: 'match-card__score',
    secondary: 'match-card__decision', footer: 'match-card__footer'
  });

  class SoccerMatchCard extends SportsEventCard {
    constructor() { super({ sport: 'soccer', fallback: '⚽', legacy: SOCCER_LEGACY_CLASSES }); }

    normalize(options = {}) {
      const match = options.match || {};
      const date = new Date(options.date || match.kickoff || match.date);
      const validDate = !Number.isNaN(date.getTime());
      const dateText = options.dateText || (validDate ? date.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' }) : '日時未定');
      const timeText = options.timeText || statusLabel(match) || (validDate ? date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : '');
      const decision = options.decisionText === false ? '' : options.decisionText ?? decisionLabel(match);
      const status = String(match.status || '').toLowerCase();
      const live = ['in_play', 'in-play', 'live', 'paused'].includes(status);
      const final = ['finished', 'final'].includes(status);
      const unavailable = ['postponed', 'suspended', 'cancelled'].includes(status);
      const competition = options.competition || match.competition || '';
      const stage = options.stage || match.round || match.stage || '';
      const venue = options.venue || match.venue || '';
      const centerOptions = options.center || {};
      return {
        className: classNames(options.className, live && 'is-live match-card--live', final && 'is-final', unavailable && 'is-unavailable match-card--unavailable', decision.includes('PK') && 'sports-event-card--penalties match-card--penalties'),
        attributes: options.attributes,
        meta: { left: [dateText, timeText].filter(Boolean).join(' '), right: competition || stage },
        leftTeam: options.home || match.home || {},
        rightTeam: options.away || match.away || {},
        center: {
          ...centerOptions,
          primary: centerOptions.primary ?? options.scoreText ?? match.scoreText ?? 'VS',
          secondary: centerOptions.secondary ?? decision,
          variant: centerOptions.variant ?? (decision ? 'decision' : '')
        },
        footer: [stage, venue]
      };
    }
  }

  class BaseballGameCard extends SportsEventCard {
    constructor() { super({ sport: 'baseball', fallback: '⚾' }); }

    normalize(options = {}) {
      const game = options.game || {};
      const live = Boolean(options.live);
      const final = Boolean(options.final);
      const favorite = Boolean(options.favorite);
      const unavailable = Boolean(options.unavailable);
      const competition = options.competition || game.gameTypeName || 'MLB';
      const gameNumber = Number(options.gameNumber ?? game.gameNumber ?? 1);
      const centerOptions = options.center || {};
      return {
        className: classNames(options.className, live && 'is-live', final && 'is-final', favorite && 'is-favorite', unavailable && 'is-unavailable'),
        attributes: options.attributes,
        meta: {
          left: options.dateText || '',
          right: `${competition}${gameNumber > 1 ? `・第${gameNumber}試合` : ''}`,
          badges: favorite ? [{ label: '推し', className: 'sports-event-card__meta-badge--favorite' }] : []
        },
        leftTeam: options.away || game.away || {},
        rightTeam: options.home || game.home || {},
        center: {
          ...centerOptions,
          primary: centerOptions.primary ?? options.scoreText ?? 'VS',
          secondary: (centerOptions.secondary ?? options.statusText) || '',
          variant: centerOptions.variant ?? 'status'
        },
        footer: [options.venue || '', options.detail || options.series || '']
      };
    }
  }

  class SportsEventCardRenderer {
    constructor({ card, normalize = event => event, decorate = () => ({}) } = {}) {
      if (!card?.render) throw new Error('Sports event card renderer requires a card instance');
      this.card = card;
      this.normalize = normalize;
      this.decorate = decorate;
    }
    render(event, context = {}) {
      const normalized = this.normalize(event, context) || {};
      return this.card.render({ ...normalized, ...this.decorate(event, normalized, context) });
    }
    renderMany(events = [], context = {}) { return events.map(event => this.render(event, context)).join(''); }
  }

  class SoccerMatchCardRenderer extends SportsEventCardRenderer {
    constructor(options = {}) { super({ ...options, card: options.card || new SoccerMatchCard() }); }
  }

  class BaseballGameCardRenderer extends SportsEventCardRenderer {
    constructor(options = {}) { super({ ...options, card: options.card || new BaseballGameCard() }); }
  }

  class SportsEventDialog {
    constructor({ id = 'sportsEventDialog', className = '' } = {}) {
      this.id = id;
      this.className = className;
      this.root = null;
      this.body = null;
      this.bound = false;
      this.ensure();
      this.bind();
    }

    ensure() {
      this.root = document.getElementById(this.id);
      if (!this.root) {
        this.root = document.createElement('dialog');
        this.root.id = this.id;
        this.root.className = classNames('sports-event-dialog', this.className);
        this.root.innerHTML = `<section class="sports-event-dialog__panel">
          <button class="sports-event-dialog__close" type="button" data-sports-event-dialog-close aria-label="閉じる">×</button>
          <div class="sports-event-dialog__body"></div>
        </section>`;
        document.body.appendChild(this.root);
      }
      this.body = this.root.querySelector('.sports-event-dialog__body');
      return this;
    }

    bind() {
      if (!this.root || this.bound) return this;
      this.bound = true;
      this.root.addEventListener('click', event => {
        if (event.target === this.root || event.target.closest('[data-sports-event-dialog-close]')) this.close();
      });
      return this;
    }

    teamMarkup(team = {}, side = 'left') {
      const fallback = team.flag || team.fallback || team.abbreviation || '●';
      const badge = team.logo
        ? `<img src="${escapeHtml(team.logo)}" alt="" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden>${escapeHtml(fallback)}</span>`
        : `<span>${escapeHtml(fallback)}</span>`;
      return `<div class="sports-event-dialog__team sports-event-dialog__team--${side}">
        <span class="sports-event-dialog__team-badge">${badge}</span>
        <strong>${escapeHtml(team.name || '未定')}</strong>
        ${team.subtitle ? `<small>${escapeHtml(team.subtitle)}</small>` : ''}
      </div>`;
    }

    render(data = {}) {
      const facts = (data.facts || [])
        .filter(item => item && (Array.isArray(item) ? item[1] : item.value))
        .map(item => {
          const label = Array.isArray(item) ? item[0] : item.label;
          const value = Array.isArray(item) ? item[1] : item.value;
          return `<article><span>${escapeHtml(label || '')}</span><strong>${escapeHtml(value || '')}</strong></article>`;
        })
        .join('');
      return `<header class="sports-event-dialog__header">
          <p class="eyebrow">${escapeHtml(data.eyebrow || 'MATCH DETAIL')}</p>
          <h2>${escapeHtml(data.title || '試合情報')}</h2>
          ${data.dateText ? `<p>${escapeHtml(data.dateText)}</p>` : ''}
        </header>
        <div class="sports-event-dialog__matchup">
          ${this.teamMarkup(data.leftTeam, 'left')}
          <div class="sports-event-dialog__score">
            <strong>${escapeHtml(data.scoreText || 'VS')}</strong>
            ${data.statusText ? `<span>${escapeHtml(data.statusText)}</span>` : ''}
          </div>
          ${this.teamMarkup(data.rightTeam, 'right')}
        </div>
        ${facts ? `<div class="sports-event-dialog__facts">${facts}</div>` : ''}
        ${data.note ? `<p class="sports-event-dialog__note">${escapeHtml(data.note)}</p>` : ''}`;
    }

    open(data = {}) {
      this.ensure();
      if (!this.body) return false;
      this.body.innerHTML = this.render(data);
      if (this.root.open) this.root.close();
      this.root.showModal();
      return true;
    }
    close() { if (this.root?.open) this.root.close(); }
  }

  const soccerCard = new SoccerMatchCard();
  const baseballCard = new BaseballGameCard();

  Object.assign(components, {
    SportsEventCard,
    SoccerMatchCard,
    BaseballGameCard,
    SportsEventCardRenderer,
    SoccerMatchCardRenderer,
    BaseballGameCardRenderer,
    SportsEventDialog,
    MatchCardRenderer: SoccerMatchCardRenderer,
    escapeHtml,
    statusLabel,
    decisionLabel,
    matchCard: options => soccerCard.render(options),
    baseballGameCard: options => baseballCard.render(options),
    createMatchCardRenderer: options => new SoccerMatchCardRenderer(options),
    createBaseballGameCardRenderer: options => new BaseballGameCardRenderer(options),
    createEventDialog: options => new SportsEventDialog(options),
    calendarDay(options = {}) {
      const classes = classNames('calendar-day', options.hasMatch && 'has-match', options.favorite && 'calendar-day--favorite', options.primary && 'calendar-day--primary', options.selected && 'selected', options.today && 'today');
      const marks = (options.marks || []).slice(0, 3).map(mark => mark.logo
        ? `<img src="${escapeHtml(mark.logo)}" alt="">`
        : `<span>${escapeHtml(mark.label || '★')}</span>`
      ).join('');
      return `<button class="${classes}" data-calendar-day="${escapeHtml(options.dateKey || '')}" type="button"${options.disabled ? ' disabled' : ''}><span>${escapeHtml(options.day || '')}</span>${options.count ? `<i>${escapeHtml(options.count)}</i>` : ''}${marks ? `<small class="calendar-favorite-marks">${marks}</small>` : ''}</button>`;
    },
    MATCH_CARD_VERSION: 5
  });
})(window.SportsHubComponents);
