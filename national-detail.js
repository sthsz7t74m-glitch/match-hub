const params = new URLSearchParams(location.search);
const Components = window.SportsHubComponents;
const Rankings = window.SportsRankings;
const favoriteKey = 'sportsHubFavoriteNationals';
const legacyFavoriteKey = 'sportsHubFavoriteNational';

function readFavoriteIds() {
  const stored = SportsHub.storage.get(favoriteKey, []);
  const ids = Array.isArray(stored) ? stored.map(String) : stored ? [String(stored)] : [];
  const legacy = SportsHub.storage.get(legacyFavoriteKey, null);
  if (legacy && !ids.includes(String(legacy))) ids.push(String(legacy));
  return [...new Set(ids)];
}

const fallbackTeam = readFavoriteIds()[0] || SportsHub.storage.get(legacyFavoriteKey, 'japan');
const selected = SportsHubNational.find(params.get('team') || fallbackTeam) || SportsHubNational.teams[0];
const fifaRankingService = Rankings?.FifaRankingService ? new Rankings.FifaRankingService() : null;
const eventDialog = Components?.createEventDialog?.({ id: 'nationalDetailEventDialog' }) || null;

let teamMatches = [];
let matchIndex = new Map();
let rankingLoaded = false;
let rankingPayload = null;
let activeMatchFilter = 'all';

const node = selector => document.querySelector(selector);
const escapeHtml = value => Components?.escapeHtml ? Components.escapeHtml(value) : String(value ?? '');
const resolveTeam = (id, name = '') => SportsHubNational.find(id) || SportsHubNational.find(name) || null;
const teamName = (id, fallback = '') => resolveTeam(id, fallback)?.name || fallback || String(id || '未定');
const teamFlag = (id, fallback = '') => resolveTeam(id, fallback)?.flag || '🏳️';
const teamDetailHref = (id, fallback = '') => {
  const team = resolveTeam(id, fallback);
  return team ? `./national-detail.html?team=${encodeURIComponent(team.id)}` : '';
};
const rankingFor = (id, fallbackName = '') => fifaRankingService?.findTeam(id, fallbackName) || null;
const rankingLabel = entry => rankingLoaded
  ? fifaRankingService?.formatRank(entry, 'FIFA順位外') || 'FIFA順位外'
  : '';

function isFinished(match) {
  return ['finished', 'final'].includes(String(match?.status || '').toLowerCase());
}

function isLive(match) {
  return ['in_play', 'in-play', 'live', 'paused'].includes(String(match?.status || '').toLowerCase());
}

function isUnavailable(match) {
  return ['postponed', 'suspended', 'cancelled'].includes(String(match?.status || '').toLowerCase());
}

function scoreValue(match, side) {
  return match?.[`${side}Score`] ?? match?.score?.[side] ?? null;
}

function scoreText(match) {
  if (!isFinished(match) && !isLive(match)) return 'VS';
  return `${scoreValue(match, 'home') ?? '-'} - ${scoreValue(match, 'away') ?? '-'}`;
}

function statusText(match) {
  if (isLive(match)) return 'LIVE';
  if (isFinished(match)) return '試合終了';
  const status = String(match?.status || '').toLowerCase();
  if (status === 'postponed') return '延期';
  if (status === 'suspended') return '中断';
  if (status === 'cancelled') return '中止';
  return '試合前';
}

function formatKickoff(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '日時未定';
  return new Intl.DateTimeFormat('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });
}

function matchKey(match, index = 0) {
  return String(match?.id || match?.uid || `${match?.home || 'home'}-${match?.away || 'away'}-${match?.kickoff || index}`);
}

function indexMatches(matches) {
  matchIndex = new Map();
  teamMatches = (Array.isArray(matches) ? matches : []).map((match, index) => {
    const key = matchKey(match, index);
    const normalized = { ...match, __detailKey: key };
    matchIndex.set(key, normalized);
    return normalized;
  });
}

function interestFor(match) {
  const homeName = match.homeName || teamName(match.home, match.homeName);
  const awayName = match.awayName || teamName(match.away, match.awayName);
  return fifaRankingService?.matchup(match.home, match.away, homeName, awayName) || {};
}

const matchRenderer = Components.createMatchCardRenderer({
  normalize: match => {
    const homeTeam = resolveTeam(match.home, match.homeName);
    const awayTeam = resolveTeam(match.away, match.awayName);
    const homeName = homeTeam?.name || match.homeName || teamName(match.home, match.homeName);
    const awayName = awayTeam?.name || match.awayName || teamName(match.away, match.awayName);
    const matchup = interestFor(match);
    const interest = matchup.interest || null;
    const interestText = interest ? `注目度 ${interest.grade}・${interest.label}・順位差${interest.rankGap}` : '';
    const stage = [match.round || match.stage || '', interestText].filter(Boolean).join(' / ');

    return {
      match: {
        ...match,
        status: isFinished(match) ? 'finished' : isLive(match) ? 'in_play' : isUnavailable(match) ? String(match.status).toLowerCase() : 'scheduled'
      },
      date: match.kickoff,
      timeText: isFinished(match) ? '試合終了' : isLive(match) ? 'LIVE' : '',
      scoreText: scoreText(match),
      competition: match.competition || '代表戦',
      stage,
      venue: match.venue || '',
      className: interest ? `national-match-interest national-match-interest--${interest.grade.toLowerCase()}` : '',
      attributes: {
        'data-detail-match-key': match.__detailKey,
        ...(interest ? {
          'data-interest-grade': interest.grade,
          'data-interest-score': interest.score
        } : {})
      },
      center: {
        id: match.__detailKey,
        interactive: true,
        attributes: { 'data-open-national-detail-match': match.__detailKey },
        ariaLabel: `${homeName}対${awayName}の試合情報を見る`
      },
      home: {
        id: homeTeam?.id || match.home,
        name: homeName,
        flag: homeTeam?.flag || teamFlag(match.home, match.homeName),
        subtitle: rankingLabel(matchup.left),
        href: teamDetailHref(match.home, match.homeName),
        ariaLabel: `${homeName}代表の詳細を見る`
      },
      away: {
        id: awayTeam?.id || match.away,
        name: awayName,
        flag: awayTeam?.flag || teamFlag(match.away, match.awayName),
        subtitle: rankingLabel(matchup.right),
        href: teamDetailHref(match.away, match.awayName),
        ariaLabel: `${awayName}代表の詳細を見る`
      }
    };
  }
});

function renderTeam() {
  document.title = `${selected.name}代表 | Sports Hub`;
  node('#headerTeamName').textContent = `${selected.name}代表`;
  node('#teamName').textContent = `${selected.name}代表`;
  node('#teamEnglish').textContent = selected.en;
  node('#teamFlag').textContent = selected.flag;
  node('#teamRegion').textContent = SportsHubNational.regionNames[selected.region] || '代表';
  syncFavorite();
}

function syncFavorite() {
  const button = node('#favoriteButton');
  const active = readFavoriteIds().includes(String(selected.id));
  button.classList.toggle('is-favorite', active);
  button.textContent = active ? '★ 推し代表に登録中' : '☆ 推し代表に登録';
}

function toggleFavorite() {
  const ids = readFavoriteIds();
  const id = String(selected.id);
  const active = ids.includes(id);
  const next = active ? ids.filter(value => value !== id) : [...ids, id];
  SportsHub.storage.set(favoriteKey, next);
  SportsHub.storage.remove(legacyFavoriteKey);
  SportsHub.toast(active ? '推し代表を解除しました' : `${selected.name}代表を登録しました`);
  syncFavorite();
}

function renderRanking() {
  const entry = rankingFor(selected.id, selected.en);
  const hero = node('#heroRanking');
  const content = node('#rankingContent');
  const movementNode = node('#rankingMovement');
  const updated = node('#rankingUpdated');

  if (!rankingLoaded) {
    hero.textContent = 'FIFA順位 読込中';
    hero.className = 'ranking-badge is-loading';
    content.className = 'ranking-card is-loading';
    return;
  }

  const officialDate = rankingPayload?.officialDate ? formatDate(rankingPayload.officialDate) : '更新日不明';
  const nextDate = rankingPayload?.nextOfficialDate ? `・次回 ${formatDate(rankingPayload.nextOfficialDate)}` : '';
  updated.textContent = `公式 ${officialDate}${nextDate}`;

  if (!entry?.rank) {
    hero.textContent = 'FIFA順位外';
    hero.className = 'ranking-badge';
    movementNode.textContent = '—';
    movementNode.className = 'ranking-movement is-same';
    content.className = 'ranking-card';
    content.innerHTML = `<div class="ranking-card__position"><span>FIFA</span><strong>—<small>位</small></strong></div><div class="ranking-card__meta"><span>ランキング</span><strong>順位外</strong><small>公式データに順位がありません</small></div>`;
    return;
  }

  hero.textContent = `FIFA ${entry.rank}位`;
  hero.className = 'ranking-badge is-ranked';
  const movement = Number(entry.movement || 0);
  movementNode.textContent = movement > 0 ? `↑ ${movement}` : movement < 0 ? `↓ ${Math.abs(movement)}` : '→ 変動なし';
  movementNode.className = `ranking-movement ${movement > 0 ? 'is-up' : movement < 0 ? 'is-down' : 'is-same'}`;
  content.className = 'ranking-card';
  content.innerHTML = `<div class="ranking-card__position"><span>FIFA</span><strong>${entry.rank}<small>位</small></strong></div><div class="ranking-card__meta"><span>ランキングポイント</span><strong>${Number(entry.points || 0).toLocaleString('ja-JP', { maximumFractionDigits: 2 })}</strong><small>前回 ${entry.previousRank || '—'}位・${entry.confederation || ''}</small></div>`;
}

function sortedUpcoming() {
  return teamMatches
    .filter(match => !isFinished(match) && new Date(match.kickoff).getTime() >= Date.now() - 4 * 60 * 60 * 1000)
    .sort((left, right) => new Date(left.kickoff) - new Date(right.kickoff));
}

function sortedFinished() {
  return teamMatches
    .filter(isFinished)
    .sort((left, right) => new Date(right.kickoff) - new Date(left.kickoff));
}

function renderOverview() {
  const upcoming = sortedUpcoming();
  const finished = sortedFinished();
  const next = upcoming[0];
  node('#nextMatchStatus').textContent = next ? '日程確定' : '次戦未定';
  node('#nextMatchContent').innerHTML = next
    ? matchRenderer.render(next)
    : '<div class="empty-state"><span>📅</span><strong>今後の試合データはありません</strong><p>次の試合が決まると自動表示されます。</p></div>';
  node('#upcomingCount').textContent = String(upcoming.length);
  node('#finishedCount').textContent = String(finished.length);
  node('#totalCount').textContent = String(teamMatches.length);
}

function matchesForFilter() {
  if (activeMatchFilter === 'upcoming') return sortedUpcoming();
  if (activeMatchFilter === 'finished') return sortedFinished();
  return [...sortedUpcoming(), ...sortedFinished()];
}

function renderMatches() {
  const visible = matchesForFilter();
  node('#matchesCount').textContent = `${visible.length}試合`;
  node('#matchesList').innerHTML = visible.length
    ? matchRenderer.renderMany(visible)
    : '<div class="empty-state"><span>⚽</span><strong>該当する試合がありません</strong><p>別の絞り込みを選択してください。</p></div>';
  document.querySelectorAll('[data-match-filter]').forEach(button => {
    button.classList.toggle('active', button.dataset.matchFilter === activeMatchFilter);
  });
}

function renderCompetitions() {
  const groups = new Map();
  teamMatches.forEach(match => {
    const name = match.competition || '代表戦';
    const record = groups.get(name) || { name, total: 0, upcoming: 0, finished: 0 };
    record.total += 1;
    if (isFinished(match)) record.finished += 1;
    else record.upcoming += 1;
    groups.set(name, record);
  });
  const values = [...groups.values()].sort((left, right) => right.total - left.total || left.name.localeCompare(right.name, 'ja'));
  node('#competitionCount').textContent = `${values.length}大会`;
  node('#competitionList').innerHTML = values.length
    ? values.map(item => `<article class="competition-card"><div class="competition-card__top"><span>🏆</span><strong>${item.total}試合</strong></div><h3>${escapeHtml(item.name)}</h3><p>今後 ${item.upcoming}・終了 ${item.finished}</p></article>`).join('')
    : '<div class="empty-state"><span>🏆</span><strong>大会データがありません</strong><p>試合データから自動集計します。</p></div>';
}

function resultFor(match) {
  if (!isFinished(match)) return '';
  const isHome = String(match.home) === String(selected.id) || resolveTeam(match.home, match.homeName)?.id === selected.id;
  const own = Number(isHome ? scoreValue(match, 'home') : scoreValue(match, 'away'));
  const opponent = Number(isHome ? scoreValue(match, 'away') : scoreValue(match, 'home'));
  if (!Number.isFinite(own) || !Number.isFinite(opponent)) return '';
  return own > opponent ? 'win' : own < opponent ? 'loss' : 'draw';
}

function renderForm() {
  const recent = sortedFinished().slice(0, 5);
  const results = recent.map(match => resultFor(match)).filter(Boolean);
  const wins = results.filter(result => result === 'win').length;
  const draws = results.filter(result => result === 'draw').length;
  const losses = results.filter(result => result === 'loss').length;
  node('#formSummary').textContent = recent.length ? `${wins}勝${draws}分${losses}敗` : 'データ待ち';
  node('#formStrip').innerHTML = results.map(result => `<span class="form-result is-${result}">${result === 'win' ? '勝' : result === 'draw' ? '分' : '敗'}</span>`).join('');
  node('#formMatches').innerHTML = recent.length
    ? matchRenderer.renderMany(recent)
    : '<div class="empty-state"><span>📊</span><strong>終了済み試合がありません</strong><p>試合終了後に自動集計します。</p></div>';
}

function renderAll() {
  renderOverview();
  renderRanking();
  renderMatches();
  renderCompetitions();
  renderForm();
}

function openMatchDialog(key) {
  const match = matchIndex.get(String(key));
  if (!match || !eventDialog) return;
  const home = resolveTeam(match.home, match.homeName);
  const away = resolveTeam(match.away, match.awayName);
  const matchup = interestFor(match);
  const interest = matchup.interest;
  eventDialog.open({
    eyebrow: 'NATIONAL MATCH',
    title: match.competition || '代表戦',
    dateText: formatKickoff(match.kickoff),
    leftTeam: {
      name: home?.name || teamName(match.home, match.homeName),
      flag: home?.flag || teamFlag(match.home, match.homeName),
      subtitle: rankingLabel(matchup.left)
    },
    rightTeam: {
      name: away?.name || teamName(match.away, match.awayName),
      flag: away?.flag || teamFlag(match.away, match.awayName),
      subtitle: rankingLabel(matchup.right)
    },
    scoreText: scoreText(match),
    statusText: statusText(match),
    facts: [
      ['ステージ', match.round || match.stage || '—'],
      ['会場', match.venue || '未定'],
      ['注目度', interest ? `${interest.grade}・${interest.label}` : '算出待ち'],
      ['順位差', interest ? String(interest.rankGap) : '—']
    ],
    note: isFinished(match) || isLive(match)
      ? 'スコアは取得済みの試合データを表示しています。'
      : '試合前のためスコアは未確定です。日程と対戦情報を表示しています。'
  });
}

async function loadMatches() {
  try {
    const payload = await SportsHubNationalService.loadPayload();
    const matches = SportsHubNationalService.forTeam(payload.matches || [], selected.id);
    indexMatches(matches);
  } catch (error) {
    console.warn('National detail match data unavailable:', error);
    indexMatches([]);
  }
  renderAll();
}

async function loadRanking() {
  if (!fifaRankingService) {
    rankingLoaded = true;
    renderRanking();
    return;
  }
  try {
    rankingPayload = await fifaRankingService.load({ fresh: true });
    rankingLoaded = fifaRankingService.entries.length > 0;
  } catch (error) {
    rankingLoaded = true;
    console.warn('FIFA ranking unavailable on detail page:', error);
  }
  renderAll();
}

node('.detail-tabs').addEventListener('click', event => {
  const button = event.target.closest('[data-tab]');
  if (!button) return;
  document.querySelectorAll('.detail-tab').forEach(tab => tab.classList.toggle('active', tab === button));
  document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.add('hidden'));
  node(`#${button.dataset.tab}Panel`)?.classList.remove('hidden');
});

node('#matchFilters').addEventListener('click', event => {
  const button = event.target.closest('[data-match-filter]');
  if (!button) return;
  activeMatchFilter = button.dataset.matchFilter;
  renderMatches();
});

document.addEventListener('click', event => {
  const matchButton = event.target.closest('[data-open-national-detail-match]');
  if (matchButton) {
    event.preventDefault();
    event.stopPropagation();
    openMatchDialog(matchButton.dataset.openNationalDetailMatch);
  }
});

node('#favoriteButton').addEventListener('click', toggleFavorite);

SportsHub.applyTheme();
renderTeam();
renderAll();
void loadMatches();
void loadRanking();
