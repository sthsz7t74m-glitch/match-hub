window.SportsHeadToHead = window.SportsHeadToHead || {};

(function initializeHeadToHead(namespace) {
  const normalize = value => String(value || '')
    .normalize('NFKC')
    .toLocaleLowerCase('ja')
    .replace(/[\s・.\-_()（）]/g, '');

  const dateOf = event => new Date(event?.kickoff || event?.date || event?.startDate || 0);
  const teamName = (event, side) => String(
    event?.[`${side}Name`] || event?.[side]?.name || event?.competitions?.[0]?.competitors?.find(item =>
      side === 'home' ? item.homeAway === 'home' : item.homeAway === 'away'
    )?.team?.displayName || event?.[side] || ''
  );
  const scoreOf = (event, side) => {
    const value = event?.[`${side}Score`] ?? event?.score?.[side] ?? event?.[side]?.score;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  };
  const finished = event => ['finished', 'final', 'post'].includes(String(event?.status || event?.state || '').toLowerCase()) ||
    (scoreOf(event, 'home') !== null && scoreOf(event, 'away') !== null && dateOf(event).getTime() < Date.now());

  class SportsHeadToHead {
    constructor(events = []) {
      this.events = Array.isArray(events) ? events : [];
    }

    between(leftName, rightName, { before = Infinity, limit = 10 } = {}) {
      const left = normalize(leftName);
      const right = normalize(rightName);
      if (!left || !right || left === right) return [];

      return this.events.filter(event => {
        if (!finished(event)) return false;
        const time = dateOf(event).getTime();
        if (!Number.isFinite(time) || time >= before) return false;
        const home = normalize(teamName(event, 'home'));
        const away = normalize(teamName(event, 'away'));
        return (home === left && away === right) || (home === right && away === left);
      }).sort((a, b) => dateOf(b) - dateOf(a)).slice(0, limit);
    }

    summarize(leftName, rightName, options = {}) {
      const matches = this.between(leftName, rightName, options);
      let leftWins = 0;
      let rightWins = 0;
      let draws = 0;
      const left = normalize(leftName);

      const history = matches.map(event => {
        const homeName = teamName(event, 'home');
        const awayName = teamName(event, 'away');
        const homeScore = scoreOf(event, 'home');
        const awayScore = scoreOf(event, 'away');
        const leftIsHome = normalize(homeName) === left;
        const leftScore = leftIsHome ? homeScore : awayScore;
        const rightScore = leftIsHome ? awayScore : homeScore;
        if (leftScore > rightScore) leftWins += 1;
        else if (leftScore < rightScore) rightWins += 1;
        else draws += 1;
        return {
          date: dateOf(event), homeName, awayName, homeScore, awayScore,
          competition: event.competition || event.league || event.name || ''
        };
      });

      return { leftName, rightName, total: matches.length, leftWins, rightWins, draws, history };
    }
  }

  class SoccerHeadToHead extends SportsHeadToHead {}
  class BaseballHeadToHead extends SportsHeadToHead {}

  const summaryMarkup = summary => {
    if (!summary?.total) return '';
    return `<button class="sports-h2h" type="button" aria-label="${summary.leftName}と${summary.rightName}の過去対戦を見る">
      <span class="sports-h2h__label">H2H <b>過去${summary.total}試合</b></span>
      <span class="sports-h2h__record"><b>${summary.leftWins}勝</b><i>${summary.draws}分</i><b>${summary.rightWins}勝</b></span>
    </button>`;
  };

  const historyMarkup = summary => `<section class="sports-h2h-dialog">
    <p class="eyebrow">HEAD TO HEAD</p>
    <h2>${summary.leftName} vs ${summary.rightName}</h2>
    <div class="sports-h2h-dialog__summary"><strong>${summary.leftWins}勝</strong><span>${summary.draws}分</span><strong>${summary.rightWins}勝</strong></div>
    <div class="sports-h2h-dialog__history">${summary.history.map(item => `<article>
      <time>${item.date.toLocaleDateString('ja-JP', { year: 'numeric', month: 'numeric', day: 'numeric' })}</time>
      <strong>${item.homeName} ${item.homeScore}-${item.awayScore} ${item.awayName}</strong>
      ${item.competition ? `<small>${item.competition}</small>` : ''}
    </article>`).join('')}</div>
  </section>`;

  async function enhancePage() {
    const page = document.body.dataset.hub;
    if (!['five', 'jleague', 'national'].includes(page)) return;
    try {
      const adapter = window.FootballAdapters?.create?.(page);
      if (!adapter) return;
      const data = await adapter.load();
      const events = data?.matches || [];
      const service = new SoccerHeadToHead(events);
      const dialog = document.createElement('dialog');
      dialog.className = 'sports-h2h-modal';
      dialog.innerHTML = '<button type="button" class="sports-h2h-modal__close" aria-label="閉じる">×</button><div class="sports-h2h-modal__body"></div>';
      document.body.appendChild(dialog);
      dialog.addEventListener('click', event => {
        if (event.target === dialog || event.target.closest('.sports-h2h-modal__close')) dialog.close();
      });

      const enhance = root => {
        root.querySelectorAll?.('.sports-event-card--soccer:not([data-h2h-ready])').forEach(card => {
          card.dataset.h2hReady = 'true';
          const names = [...card.querySelectorAll('.sports-event-card__team-name')].map(node => node.textContent.trim());
          if (names.length < 2) return;
          const meta = card.querySelector('.sports-event-card__meta span')?.textContent || '';
          const eventTime = events.find(event => {
            const home = normalize(teamName(event, 'home'));
            const away = normalize(teamName(event, 'away'));
            return home === normalize(names[0]) && away === normalize(names[1]);
          });
          const summary = service.summarize(names[0], names[1], {
            before: eventTime ? dateOf(eventTime).getTime() : Infinity,
            limit: 10
          });
          const markup = summaryMarkup(summary);
          if (!markup) return;
          card.insertAdjacentHTML('beforeend', markup);
          card.querySelector('.sports-h2h')?.addEventListener('click', event => {
            event.stopPropagation();
            dialog.querySelector('.sports-h2h-modal__body').innerHTML = historyMarkup(summary);
            dialog.showModal();
          });
        });
      };

      enhance(document);
      new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => {
        if (node.nodeType === 1) enhance(node.matches?.('.sports-event-card--soccer') ? node.parentElement : node);
      }))).observe(document.body, { childList: true, subtree: true });
    } catch (error) {
      console.warn('Head-to-head data unavailable:', error);
    }
  }

  Object.assign(namespace, { SportsHeadToHead, SoccerHeadToHead, BaseballHeadToHead, enhancePage });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', enhancePage, { once: true });
  else enhancePage();
})(window.SportsHeadToHead);