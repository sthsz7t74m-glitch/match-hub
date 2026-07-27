window.SportsHubComponents = window.SportsHubComponents || {};

(function initializeMatchComponents(components) {
  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[character]));

  function statusLabel(match) {
    const status = String(match.status || '').toLowerCase();
    if (['finished', 'final'].includes(status)) return '試合終了';
    if (['in_play', 'in-play', 'live', 'paused'].includes(status)) return 'LIVE';
    if (status === 'postponed') return '延期';
    if (status === 'suspended') return '中断';
    if (status === 'cancelled') return '中止';
    return match.timeLabel || '';
  }

  function decisionLabel(match) {
    if (match.decisionLabel) return match.decisionLabel;

    const homePens = match.penalties?.home;
    const awayPens = match.penalties?.away;
    if (Number.isFinite(homePens) && Number.isFinite(awayPens)) return `PK ${homePens}-${awayPens}`;
    if (match.decision === 'penalties') return 'PK戦決着';
    if (match.decision === 'extra_time') return '延長戦決着';
    if (String(match.status || '').toLowerCase() === 'finished') return '通常決着';
    return '';
  }

  function teamMarkup(team = {}, side = 'home') {
    const position = side === 'home' ? 'left' : 'right';
    const name = String(team.name || '未定');
    const badge = team.logo
      ? `<img class="match-card__badge" src="${escapeHtml(team.logo)}" alt="" loading="lazy" onerror="this.hidden=true">`
      : `<span class="match-card__fallback" aria-hidden="true">${escapeHtml(team.badge || team.flag || '⚽')}</span>`;

    return `<span class="match-card__team match-card__team--${side} match-card__team--${position}" data-match-side="${position}">
      ${badge}<strong title="${escapeHtml(name)}">${escapeHtml(name)}</strong>
    </span>`;
  }

  components.matchCard = function matchCard(options = {}) {
    const match = options.match || {};
    const date = new Date(options.date || match.kickoff || match.date);
    const validDate = !Number.isNaN(date.getTime());
    const dateText = options.dateText || (validDate
      ? date.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' })
      : '日時未定');
    const timeText = options.timeText || statusLabel(match) || (validDate
      ? date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
      : '');
    const score = options.scoreText ?? match.scoreText ?? 'VS';
    const decision = options.decisionText === false
      ? ''
      : options.decisionText ?? decisionLabel(match);
    const competition = options.competition || match.competition || '';
    const stage = options.stage || match.round || match.stage || '';
    const venue = options.venue || match.venue || '';
    const status = String(match.status || '').toLowerCase();
    const classes = [
      'match-card',
      ['in_play', 'in-play', 'live', 'paused'].includes(status) ? 'match-card--live' : '',
      ['postponed', 'suspended', 'cancelled'].includes(status) ? 'match-card--unavailable' : '',
      decision.includes('PK') ? 'match-card--penalties' : '',
      options.className || ''
    ].filter(Boolean).join(' ');
    const attributes = Object.entries(options.attributes || {})
      .map(([key, value]) => ` ${escapeHtml(key)}="${escapeHtml(value)}"`)
      .join('');

    return `<article class="${classes}"${attributes}>
      <div class="match-card__meta">
        <span>${escapeHtml([dateText, timeText].filter(Boolean).join(' '))}</span>
        <span>${escapeHtml(competition || stage)}</span>
      </div>
      <div class="match-card__body">
        ${teamMarkup(options.home || match.home, 'home')}
        <div class="match-card__score">
          <strong>${escapeHtml(score)}</strong>
          ${decision ? `<small class="match-card__decision">${escapeHtml(decision)}</small>` : ''}
        </div>
        ${teamMarkup(options.away || match.away, 'away')}
      </div>
      ${(stage || venue) ? `<div class="match-card__footer">
        ${stage ? `<span>${escapeHtml(stage)}</span>` : ''}
        ${venue ? `<span>${escapeHtml(venue)}</span>` : ''}
      </div>` : ''}
    </article>`;
  };

  class MatchCardRenderer {
    constructor({ normalize = match => match, decorate = () => ({}) } = {}) {
      this.normalize = normalize;
      this.decorate = decorate;
    }

    render(match) {
      const normalized = this.normalize(match) || {};
      return components.matchCard({
        ...normalized,
        ...this.decorate(match, normalized)
      });
    }

    renderMany(matches = []) {
      return matches.map(match => this.render(match)).join('');
    }
  }

  components.MatchCardRenderer = MatchCardRenderer;
  components.createMatchCardRenderer = options => new MatchCardRenderer(options);

  components.calendarDay = function calendarDay(options = {}) {
    const classes = [
      'calendar-day',
      options.hasMatch ? 'has-match' : '',
      options.favorite ? 'calendar-day--favorite' : '',
      options.primary ? 'calendar-day--primary' : '',
      options.selected ? 'selected' : '',
      options.today ? 'today' : ''
    ].filter(Boolean).join(' ');
    const marks = (options.marks || []).slice(0, 3).map(mark => mark.logo
      ? `<img src="${escapeHtml(mark.logo)}" alt="">`
      : `<span>${escapeHtml(mark.label || '★')}</span>`).join('');

    return `<button class="${classes}" data-calendar-day="${escapeHtml(options.dateKey || '')}" type="button"${options.disabled ? ' disabled' : ''}>
      <span>${escapeHtml(options.day || '')}</span>
      ${options.count ? `<i>${escapeHtml(options.count)}</i>` : ''}
      ${marks ? `<small class="calendar-favorite-marks">${marks}</small>` : ''}
    </button>`;
  };

  components.MATCH_CARD_VERSION = 2;
})(window.SportsHubComponents);
