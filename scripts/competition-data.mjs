export const championsLeague = {code:'CL',id:2,name:'UEFA Champions League',ja:'チャンピオンズリーグ',color:'#2446a8'};
const stages = {LEAGUE_STAGE:'リーグフェーズ',LEAGUE_PHASE:'リーグフェーズ',GROUP_STAGE:'リーグフェーズ',REGULAR_SEASON:'リーグフェーズ',PLAYOFFS:'プレーオフ',PLAYOFF_ROUND_1:'プレーオフ 第1戦',PLAYOFF_ROUND_2:'プレーオフ 第2戦',LAST_16:'ラウンド16',QUARTER_FINALS:'準々決勝',SEMI_FINALS:'準決勝',FINAL:'決勝',QUALIFICATION:'予選',QUALIFICATION_ROUND_1:'予選1回戦',QUALIFICATION_ROUND_2:'予選2回戦',QUALIFICATION_ROUND_3:'予選3回戦'};
export function roundLabel(match, league) {
  if (league.code !== 'CL') return match.matchday ? `第${match.matchday}節` : (match.stage || '');
  const stage = stages[match.stage] || match.stage || 'ステージ未定';
  return ['LEAGUE_STAGE','LEAGUE_PHASE','GROUP_STAGE','REGULAR_SEASON'].includes(match.stage) && match.matchday ? `${stage} 第${match.matchday}節` : stage;
}
export function mergeCompetitionTeams(teams) {
  const merged = new Map();
  for (const team of teams) {
    const existing = merged.get(team.id);
    if (existing) existing.competitionIds = [...new Set([...existing.competitionIds, team.leagueId])];
    else merged.set(team.id, {...team, competitionIds:[team.leagueId]});
  }
  return [...merged.values()];
}
export function totalStanding(response) {
  return (response.standings || []).find(item => item.type === 'TOTAL' && (!item.stage || ['LEAGUE_STAGE','LEAGUE_PHASE','GROUP_STAGE','REGULAR_SEASON'].includes(item.stage)))
    || (response.standings || []).find(item => item.type === 'TOTAL');
}
