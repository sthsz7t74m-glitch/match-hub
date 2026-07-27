window.MLBData = window.MLBData || {};

(function initializeMlbData(namespace) {
  const LEAGUES = {
    103: { id: 103, code: 'AL', name: 'アメリカン・リーグ' },
    104: { id: 104, code: 'NL', name: 'ナショナル・リーグ' }
  };

  const DIVISIONS = {
    200: { id: 200, leagueId: 103, code: 'AL West', name: 'ア・リーグ西地区' },
    201: { id: 201, leagueId: 103, code: 'AL East', name: 'ア・リーグ東地区' },
    202: { id: 202, leagueId: 103, code: 'AL Central', name: 'ア・リーグ中地区' },
    203: { id: 203, leagueId: 104, code: 'NL West', name: 'ナ・リーグ西地区' },
    204: { id: 204, leagueId: 104, code: 'NL East', name: 'ナ・リーグ東地区' },
    205: { id: 205, leagueId: 104, code: 'NL Central', name: 'ナ・リーグ中地区' }
  };

  const TEAM_NAMES = {
    108: 'ロサンゼルス・エンゼルス',
    109: 'アリゾナ・ダイヤモンドバックス',
    110: 'ボルチモア・オリオールズ',
    111: 'ボストン・レッドソックス',
    112: 'シカゴ・カブス',
    113: 'シンシナティ・レッズ',
    114: 'クリーブランド・ガーディアンズ',
    115: 'コロラド・ロッキーズ',
    116: 'デトロイト・タイガース',
    117: 'ヒューストン・アストロズ',
    118: 'カンザスシティ・ロイヤルズ',
    119: 'ロサンゼルス・ドジャース',
    120: 'ワシントン・ナショナルズ',
    121: 'ニューヨーク・メッツ',
    133: 'アスレチックス',
    134: 'ピッツバーグ・パイレーツ',
    135: 'サンディエゴ・パドレス',
    136: 'シアトル・マリナーズ',
    137: 'サンフランシスコ・ジャイアンツ',
    138: 'セントルイス・カージナルス',
    139: 'タンパベイ・レイズ',
    140: 'テキサス・レンジャーズ',
    141: 'トロント・ブルージェイズ',
    142: 'ミネソタ・ツインズ',
    143: 'フィラデルフィア・フィリーズ',
    144: 'アトランタ・ブレーブス',
    145: 'シカゴ・ホワイトソックス',
    146: 'マイアミ・マーリンズ',
    147: 'ニューヨーク・ヤンキース',
    158: 'ミルウォーキー・ブルワーズ'
  };

  const FALLBACK_TEAMS = [
    [108, 'Los Angeles Angels', 'LAA', 103, 200],
    [109, 'Arizona Diamondbacks', 'ARI', 104, 203],
    [110, 'Baltimore Orioles', 'BAL', 103, 201],
    [111, 'Boston Red Sox', 'BOS', 103, 201],
    [112, 'Chicago Cubs', 'CHC', 104, 205],
    [113, 'Cincinnati Reds', 'CIN', 104, 205],
    [114, 'Cleveland Guardians', 'CLE', 103, 202],
    [115, 'Colorado Rockies', 'COL', 104, 203],
    [116, 'Detroit Tigers', 'DET', 103, 202],
    [117, 'Houston Astros', 'HOU', 103, 200],
    [118, 'Kansas City Royals', 'KC', 103, 202],
    [119, 'Los Angeles Dodgers', 'LAD', 104, 203],
    [120, 'Washington Nationals', 'WSH', 104, 204],
    [121, 'New York Mets', 'NYM', 104, 204],
    [133, 'Athletics', 'ATH', 103, 200],
    [134, 'Pittsburgh Pirates', 'PIT', 104, 205],
    [135, 'San Diego Padres', 'SD', 104, 203],
    [136, 'Seattle Mariners', 'SEA', 103, 200],
    [137, 'San Francisco Giants', 'SF', 104, 203],
    [138, 'St. Louis Cardinals', 'STL', 104, 205],
    [139, 'Tampa Bay Rays', 'TB', 103, 201],
    [140, 'Texas Rangers', 'TEX', 103, 200],
    [141, 'Toronto Blue Jays', 'TOR', 103, 201],
    [142, 'Minnesota Twins', 'MIN', 103, 202],
    [143, 'Philadelphia Phillies', 'PHI', 104, 204],
    [144, 'Atlanta Braves', 'ATL', 104, 204],
    [145, 'Chicago White Sox', 'CWS', 103, 202],
    [146, 'Miami Marlins', 'MIA', 104, 204],
    [147, 'New York Yankees', 'NYY', 103, 201],
    [158, 'Milwaukee Brewers', 'MIL', 104, 205]
  ].map(([id, en, abbreviation, leagueId, divisionId]) => ({
    id: String(id),
    name: TEAM_NAMES[id] || en,
    en,
    abbreviation,
    leagueId,
    divisionId,
    league: LEAGUES[leagueId],
    division: DIVISIONS[divisionId],
    venue: '',
    logo: `https://www.mlbstatic.com/team-logos/${id}.svg`
  }));

  const POSITION_NAMES = {
    P: '投手',
    SP: '先発投手',
    RP: '救援投手',
    C: '捕手',
    '1B': '一塁手',
    '2B': '二塁手',
    '3B': '三塁手',
    SS: '遊撃手',
    LF: '左翼手',
    CF: '中堅手',
    RF: '右翼手',
    OF: '外野手',
    IF: '内野手',
    DH: '指名打者',
    TWP: '二刀流',
    UT: 'ユーティリティ'
  };

  const GAME_TYPE_NAMES = {
    S: 'スプリングトレーニング',
    R: 'レギュラーシーズン',
    F: 'ワイルドカード',
    D: 'ディビジョンシリーズ',
    L: 'リーグ優勝決定シリーズ',
    W: 'ワールドシリーズ',
    A: 'オールスター'
  };

  const teamLogo = id => `https://www.mlbstatic.com/team-logos/${id}.svg`;
  const playerHeadshot = id => `https://img.mlbstatic.com/mlb-photos/image/upload/w_180,q_auto:best/v1/people/${id}/headshot/67/current`;
  const teamName = (id, fallback = '') => TEAM_NAMES[Number(id)] || fallback || `Team ${id}`;
  const positionName = code => POSITION_NAMES[code] || code || '選手';
  const gameTypeName = code => GAME_TYPE_NAMES[code] || 'MLB';

  Object.assign(namespace, {
    LEAGUES,
    DIVISIONS,
    TEAM_NAMES,
    FALLBACK_TEAMS,
    POSITION_NAMES,
    GAME_TYPE_NAMES,
    teamLogo,
    playerHeadshot,
    teamName,
    positionName,
    gameTypeName
  });
})(window.MLBData);