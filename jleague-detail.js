const params = new URLSearchParams(location.search);
const Core = window.SportsCore || window.FootballCore;
const Components = window.SportsHubComponents;
const favoriteService = new Core.FavoriteService({
  key: 'sportsHubFavoriteJClubs',
  legacyKey: 'sportsHubFavoriteJClub'
});
const fallbackClubId = favoriteService.list()[0] || 'urawa';
const selectedClub = SportsHubJLeague.find(params.get('club') || fallbackClubId) || SportsHubJLeague.clubs[0];
const dataAdapter = new FootballAdapters.JLeagueAdapter();
const teamMapper = FootballTeamMapper.create({
  teams: SportsHubJLeague.clubs,
  nameMap: {
    '21361': '京都サンガF.C.',
    '7477': 'ヴィッセル神戸',
    '19001': 'V・ファーレン長崎',
    '7114': 'サンフレッチェ広島',
    '7116': '横浜F・マリノス',
    '22167': 'FC町田ゼルビア',
    '7111': 'ジェフユナイテッド千葉',
    '3385': '浦和レッズ',
    '3384': 'FC東京',
    '7115': '鹿島アントラーズ',
    '7109': 'セレッソ大阪',
    '7102': 'ガンバ大阪',
    '7107': 'アビスパ福岡',
    '22522': 'ファジアーノ岡山',
    '7108': '名古屋グランパス',
    '7104': '清水エスパルス',
    '7112': '川崎フロンターレ',
    '7476': '柏レイソル',
    '3393': '東京ヴェルディ',
    '131701': '水戸ホーリーホック'
  },
  idMap: {
    'fc-tokyo': '3384',
    'tokyo-verdy': '3393',
    machida: '22167',
    'yokohama-fm': '7116',
    kashima: '7115',
    mito: '131701',
    urawa: '3385',
    chiba: '7111',
    kashiwa: '7476',
    kawasaki: '7112',
    shimizu: '7104',
    nagoya: '7108',
    kyoto: '21361',
    gamba: '7102',
    cerezo: '7109',
    kobe: '7477',
    okayama: '22522',
    hiroshima: '7114',
    fukuoka: '7107',
    nagasaki: '19001'
  }
});
const eventDialog = Components?.createEventDialog?.({ id: 'jleagueDetailEventDialog' }) || null;

let liveData = { matches: [], teams: [], standings: [] };
let metadata = null;
let clubMatches = [];
let leagueStandings = [];
let matchIndex = new Map();
let activeMatchFilter = 'all';
let dataLoaded = false;

const node = selector => document.querySelector(selector);
const escapeHtml = value => Components?.escapeHtml ? Components.escapeHtml(value) : String(value ?? '');
const leagueName = SportsHubJLeague.leagueNames[selectedClub.league] || selectedClub.league.toUpperCase();

function displayTeamName(team) {
  return teamMapper.getName(team);
}

function clubForTeam(team) {
  return teamMapper.findClubByTeam(team);
}

function isSelectedTeam(team) {
  const mappedClub = clubForTeam(team);
  if (mappedClub) return mappedClub.id === selectedClub.id;
  const id = String(team?.id ?? team?.uid ?? team ?? '');
  return id === teamMapper.getEspnId(selectedClub.id) || id === selectedClub.id;
}

function involvesSelectedClub(match) {
  return [match?.home, match?.away].some(isSelectedTeam);
}

function modelFor(match) {
  return new Core.MatchModel(match);
}

function statusKind(match) {
  const model = modelFor(match);
  if (model.isFinished) return 'finished';
  if (model.isLive) return 'in_play';
  const status = String(match?.status || '').toLowerCase().replace(/[\s-]+/g, '_');
  if (['postponed', 'suspended', 'cancelled'].includes(status)) return status;
  return 'scheduled';
}

function isFinished(match) {
  return modelFor(match).isFinished;
}

function isLive(match) {
  return modelFor(match).isLive;
}

function isUnavailable(match) {
  return ['postponed', 'suspended', 'cancelled'].includes(statusKind(match));
}

function scoreText(match) {
  return isFinished(match) || isLive(match)
    ? `${match?.score?.home ?? '-'} - ${match?.score?.away ?? '-'}`
    : 'VS';
}

function statusText(match) {
  if (isLive(match)) return 'LIVE';
  if (isFinished(match)) return '試合終了';
  return { postponed: '延期', suspended: '中断', cancelled: '中止' }[statusKind(match)] || '試合前';
}

function formatKickoff(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '日時未定';
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

function formatStage(match) {
  if (match?.matchday) return `第${match.matchday}節`;
  return {
    'regular-season': 'リーグ戦',
    championship: '優勝決定戦',
    'placement-playoffs': '順位決定戦',
    '2026-j1-100-year-vision-league': '百年構想リーグ'
  }[match?.stage] || match?.round || '';
}

function competitionLabel(match) {
  const matchLeague = SportsHubJLeague.leagueNames[match?.league] || leagueName;
  const competition = String(match?.competition || '');
  if (!competition || /Japanese J\.League/i.test(competition)) return matchLeague;
  return competition;
}

function teamTarget(team) {
  const mappedClub = clubForTeam(team);
  const name = displayTeamName(team);
  const target = {
    id: mappedClub?.id || team?.id || team?.uid || '',
    name,
    logo: team?.logo || teamMapper.getLogo(team),
    fallback: mappedClub?.mark || '●'
  };
  if (mappedClub) {
    target.href = `./jleague-detail.html?club=${encodeURIComponent(mappedClub.id)}`;
    target.ariaLabel = `${mappedClub.name}の詳細を見る`;
  }
  return target;
}

function matchKey(match, index = 0) {
  return String(match?.id || match?.uid || `${match?.home?.id || 'home'}-${match?.away?.id || 'away'}-${match?.date || index}`);
}

function indexMatches(matches) {
  matchIndex = new Map();
  clubMatches = (Array.isArray(matches) ? matches : []).map((match, index) => {
    const key = matchKey(match, index);
    const normalized = { ...match, __detailKey: key };
    matchIndex.set(key, normalized);
    return normalized;
  });
}

const matchRenderer = Components.createMatchCardRenderer({
  normalize: match => {
    const model = modelFor(match);
    const normalizedStatus = statusKind(match);
    const home = teamTarget(match.home);
    const away = teamTarget(match.away);
    return {
      match: { ...match, status: normalizedStatus },
      date: model.date,
      timeText: isFinished(match) ? '試合終了' : isLive(match) ? 'LIVE' : '',
      scoreText: scoreText(match),
      competition: competitionLabel(match),
      stage: formatStage(match),
      venue: match.venue || '',
      attributes: { 'data-detail-match-key': match.__detailKey },
      center: {
        id: match.__detailKey,
        interactive: true,
        attributes: { 'data-open-jleague-detail-match': match.__detailKey },
        ariaLabel: `${home.name}対${away.name}の試合情報を見る`
      },
      home,
      away
    };
  }
});

function sortedUpcoming() {
  const threshold = Date.now() - 4 * 60 * 60 * 1000;
  return clubMatches
    .filter(match => !isFinished(match) && !isUnavailable(match) && modelFor(match).timestamp >= threshold)
    .sort((left, right) => modelFor(left).timestamp - modelFor(right).timestamp);
}

function sortedFinished() {
  return clubMatches
    .filter(isFinished)
    .sort((left, right) => modelFor(right).timestamp - modelFor(left).timestamp);
}

function sortedAll() {
  const upcoming = sortedUpcoming();
  const upcomingIds = new Set(upcoming.map(match => match.__detailKey));
  const finished = sortedFinished();
  const finishedIds = new Set(finished.map(match => match.__detailKey));
  const other = clubMatches
    .filter(match => !upcomingIds.has(match.__detailKey) && !finishedIds.has(match.__detailKey))
    .sort((left, right) => modelFor(right).timestamp - modelFor(left).timestamp);
  return [...upcoming, ...other, ...finished];
}

function selectedStanding() {
  return leagueStandings.find(row => isSelectedTeam(row.team)) || null;
}

function mostCommonHomeVenue() {
  const counts = new Map();
  clubMatches.forEach(match => {
    if (!isSelectedTeam(match.home) || !match.venue) return;
    counts.set(match.venue, (counts.get(match.venue) || 0) + 1);
  });
  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] || '';
}

function renderClubProfile() {
  const live = teamMapper.findLiveTeam(selectedClub);
  const providerName = live?.name || live?.displayName || live?.shortName || '';
  const stadium = selectedClub.stadium || live?.venue || mostCommonHomeVenue();
  document.title = `${selectedClub.name} | Sports Hub`;
  node('#headerClubName').textContent = selectedClub.name;
  node('#clubLeague').textContent = `${leagueName} CLUB`;
  node('#clubName').textContent = selectedClub.name;
  node('#clubEnglish').textContent = providerName && providerName !== selectedClub.name
    ? providerName
    : `${selectedClub.area}をホームタウンとする${leagueName}クラブ`;
  node('#clubArea').textContent = `${selectedClub.area}・${leagueName}`;
  node('#clubStadium').textContent = stadium ? `🏟 ${stadium}` : '🏟 ホーム会場情報未登録';

  const logo = live?.logo || '';
  node('#clubEmblem').innerHTML = logo
    ? `<img src="${escapeHtml(logo)}" alt="" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden>${escapeHtml(selectedClub.mark)}</span>`
    : `<span>${escapeHtml(selectedClub.mark)}</span>`;
  syncFavorite();
}

function renderDataStatus() {
  const badge = node('#dataUpdated');
  if (!dataLoaded) {
    badge.textContent = 'データ読込中';
    badge.className = 'detail-badge is-loading';
    return;
  }
  const updated = new Date(metadata?.updatedAt || '');
  const availability = metadata?.leaguesAvailability?.[selectedClub.league];
  const availabilityLabel = availability?.matches === false ? '順位データ接続' : '試合データ接続';
  const updatedLabel = Number.isNaN(updated.getTime())
    ? availabilityLabel
    : `${updated.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}更新・${availabilityLabel}`;
  badge.textContent = updatedLabel;
  badge.title = metadata?.dataSource || 'Jリーグ共通データ';
  badge.className = `detail-badge ${availability?.matches === false ? 'is-limited' : 'is-connected'}`;
}

function emptyState(icon, title, description) {
  return `<div class="empty-state"><span>${escapeHtml(icon)}</span><strong>${escapeHtml(title)}</strong><p>${escapeHtml(description)}</p></div>`;
}

function renderOverview() {
  const upcoming = sortedUpcoming();
  const finished = sortedFinished();
  const next = upcoming[0];
  const standing = selectedStanding();
  node('#nextMatchStatus').textContent = !dataLoaded ? '取得中' : next ? '日程確定' : '次戦未定';
  node('#nextMatchContent').innerHTML = next
    ? matchRenderer.render(next)
    : emptyState('📅', '今後の試合データはありません', metadata?.leaguesAvailability?.[selectedClub.league]?.matches === false
      ? `${leagueName}の日程データは現在取得待ちです。`
      : '次の試合が決まると自動表示されます。');
  node('#rankLabel').textContent = `${leagueName}順位`;
  node('#rankSummary').textContent = standing && !standing.provisional ? String(standing.rank ?? '—') : '—';
  node('#rankNote').textContent = standing?.provisional ? '暫定名簿' : standing?.rank ? '位' : 'データ待ち';
  node('#upcomingCount').textContent = String(upcoming.length);
  node('#finishedCount').textContent = String(finished.length);
}

function matchesForFilter() {
  if (activeMatchFilter === 'upcoming') return sortedUpcoming();
  if (activeMatchFilter === 'finished') return sortedFinished();
  return sortedAll();
}

function renderMatches() {
  const visible = matchesForFilter();
  node('#matchesCount').textContent = `${visible.length}試合`;
  node('#matchList').innerHTML = visible.length
    ? matchRenderer.renderMany(visible)
    : emptyState('⚽', '該当する試合がありません', metadata?.leaguesAvailability?.[selectedClub.league]?.matches === false
      ? `${leagueName}の日程データは現在取得待ちです。`
      : '別の絞り込みを選択してください。');
  document.querySelectorAll('[data-match-filter]').forEach(button => {
    button.classList.toggle('active', button.dataset.matchFilter === activeMatchFilter);
  });
}

function standingRow(row) {
  const mappedClub = clubForTeam(row.team);
  const selected = mappedClub?.id === selectedClub.id || isSelectedTeam(row.team);
  const played = row.played ?? row.gamesPlayed ?? '-';
  const points = row.points ?? '-';
  const diff = row.goalsDiff ?? row.goalDifference ?? 0;
  const rank = row.provisional ? '—' : row.rank ?? '—';
  const name = displayTeamName(row.team);
  const logo = row.team?.logo || teamMapper.getLogo(row.team);
  const fallback = mappedClub?.mark || '●';
  const badge = logo
    ? `<span class="standing-team__badge"><img src="${escapeHtml(logo)}" alt="" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><i hidden>${escapeHtml(fallback)}</i></span>`
    : `<span class="standing-team__badge"><i>${escapeHtml(fallback)}</i></span>`;
  const teamMarkup = mappedClub
    ? `<a class="standing-team" href="./jleague-detail.html?club=${encodeURIComponent(mappedClub.id)}" aria-label="${escapeHtml(mappedClub.name)}の詳細を見る">${badge}<strong>${escapeHtml(name)}</strong></a>`
    : `<span class="standing-team">${badge}<strong>${escapeHtml(name)}</strong></span>`;
  return `<div class="club-standing-row${selected ? ' is-selected' : ''}"><b class="standing-rank">${escapeHtml(rank)}</b>${teamMarkup}<span>${escapeHtml(played)}</span><strong>${escapeHtml(points)}</strong><small>${Number(diff) > 0 ? '+' : ''}${escapeHtml(diff)}</small></div>`;
}

function renderStandings() {
  const rows = new Core.StandingService(leagueStandings).all();
  const standing = selectedStanding();
  node('#standingsTitle').textContent = `${leagueName} 順位表`;
  node('#standingsDescription').textContent = standing?.provisional
    ? '開幕前・取得待ちのクラブは暫定表示です'
    : `${selectedClub.name}を強調して表示`;
  node('#standingsStatus').textContent = rows.length ? `${rows.length}クラブ` : 'データ待ち';
  node('#standingsList').innerHTML = rows.length
    ? rows.map(standingRow).join('')
    : emptyState('📊', '順位データがありません', '順位データが更新されると自動表示されます。');
}

function resultFor(match) {
  if (!isFinished(match)) return '';
  const home = isSelectedTeam(match.home);
  const own = Number(home ? match?.score?.home : match?.score?.away);
  const opponent = Number(home ? match?.score?.away : match?.score?.home);
  if (!Number.isFinite(own) || !Number.isFinite(opponent)) return '';
  return own > opponent ? 'win' : own < opponent ? 'loss' : 'draw';
}

function renderForm() {
  const recent = sortedFinished().slice(0, 5);
  const results = recent.map(resultFor).filter(Boolean);
  const wins = results.filter(result => result === 'win').length;
  const draws = results.filter(result => result === 'draw').length;
  const losses = results.filter(result => result === 'loss').length;
  node('#formSummary').textContent = recent.length ? `${wins}勝${draws}分${losses}敗` : 'データ待ち';
  node('#formStrip').innerHTML = results.map(result => `<span class="form-result is-${result}">${result === 'win' ? '勝' : result === 'draw' ? '分' : '敗'}</span>`).join('');
  node('#recentMatchesContent').innerHTML = recent.length
    ? matchRenderer.renderMany(recent.slice(0, 3))
    : emptyState('📊', '終了済み試合がありません', '試合終了後に自動集計します。');
}

function renderAll() {
  renderClubProfile();
  renderDataStatus();
  renderOverview();
  renderMatches();
  renderStandings();
  renderForm();
}

function syncFavorite() {
  const button = node('#favoriteButton');
  const active = favoriteService.has(selectedClub.id);
  button.classList.toggle('is-favorite', active);
  button.textContent = active ? '★ お気に入り登録中' : '☆ お気に入りに登録';
}

function toggleFavorite() {
  const added = favoriteService.toggle(selectedClub.id);
  SportsHub.toast(`${selectedClub.name}をお気に入りから${added ? '追加' : '解除'}しました`);
  syncFavorite();
}

function openMatchDialog(key) {
  const match = matchIndex.get(String(key));
  if (!match || !eventDialog) return;
  const home = teamTarget(match.home);
  const away = teamTarget(match.away);
  eventDialog.open({
    eyebrow: 'J LEAGUE MATCH',
    title: [competitionLabel(match), formatStage(match)].filter(Boolean).join('・') || 'Jリーグ',
    dateText: formatKickoff(modelFor(match).date),
    leftTeam: home,
    rightTeam: away,
    scoreText: scoreText(match),
    statusText: statusText(match),
    facts: [
      ['ステージ', formatStage(match) || '—'],
      ['会場', match.venue || '未定'],
      ['ホーム', home.name],
      ['アウェイ', away.name]
    ],
    note: isFinished(match) || isLive(match)
      ? 'スコアはJリーグ共通データに保存された結果を表示しています。'
      : '試合前のためスコアは未確定です。日程と対戦情報を表示しています。'
  });
}

async function loadData() {
  try {
    liveData = await dataAdapter.load();
    teamMapper.setLiveData(liveData);
    metadata = await dataAdapter.loadMetadata();
    indexMatches((liveData.matches || []).filter(involvesSelectedClub));
    leagueStandings = (liveData.standings || []).filter(row => (row.league || 'j1') === selectedClub.league);
    dataLoaded = true;
  } catch (error) {
    console.warn('J League detail data unavailable:', error);
    liveData = { matches: [], teams: [], standings: [] };
    metadata = { leaguesAvailability: {} };
    indexMatches([]);
    leagueStandings = [];
    dataLoaded = true;
  }
  renderAll();
}

node('.detail-tabs').addEventListener('click', event => {
  const button = event.target.closest('[data-tab]');
  if (!button) return;
  document.querySelectorAll('.detail-tab').forEach(tab => tab.classList.toggle('active', tab === button));
  document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.add('hidden'));
  node(`#${button.dataset.tab}Panel`)?.classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

node('#matchFilters').addEventListener('click', event => {
  const button = event.target.closest('[data-match-filter]');
  if (!button) return;
  activeMatchFilter = button.dataset.matchFilter;
  renderMatches();
});

document.addEventListener('click', event => {
  const matchButton = event.target.closest('[data-open-jleague-detail-match]');
  if (!matchButton) return;
  event.preventDefault();
  event.stopPropagation();
  openMatchDialog(matchButton.dataset.openJleagueDetailMatch);
});

node('#favoriteButton').addEventListener('click', toggleFavorite);
SportsHub.applyTheme();
renderAll();
void loadData();
