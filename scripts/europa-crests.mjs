// Verified club crests from the 2026/27 Europa League 36-club directory.
// Source: https://www.footylogos.com/competition/europa-league
// Keep this mapping keyed by UEFA snapshot names, not display names or club IDs.
export const europaCrests = {
  "Milan": "https://assets.footylogos.com/previews/ac-milan/ac-milan-logo-footylogos-320.webp",
  "Lyon": "https://assets.footylogos.com/previews/olympique-lyonnais/olympique-lyonnais-logo-footylogos-320.webp",
  "Salzburg": "https://assets.footylogos.com/previews/red-bull-salzburg/red-bull-salzburg-logo-footylogos-320.webp",
  "Sunderland": "https://assets.footylogos.com/previews/sunderland/sunderland-logo-footylogos-320.webp",
  "Hoffenheim": "https://assets.footylogos.com/previews/tsg-hoffenheim/tsg-hoffenheim-logo-footylogos-320.webp",
  "Marseille": "https://assets.footylogos.com/previews/olympique-de-marseille-om/olympique-de-marseille-om-logo-footylogos-320.webp",
  "GNK Dinamo": "https://assets.footylogos.com/previews/gnk-dinamo-zagreb/gnk-dinamo-zagreb-logo-footylogos-320.webp",
  "Jagiellonia": "https://assets.footylogos.com/previews/jagiellonia-bialystok/jagiellonia-bialystok-logo-footylogos-320.webp",
  "OFI Crete": "https://assets.footylogos.com/previews/ofi-crete/ofi-crete-logo-footylogos-320.webp",
  "AZ Alkmaar": "https://assets.footylogos.com/previews/az-alkmaar/az-alkmaar-logo-footylogos-320.webp",
  "Sparta Praha": "https://assets.footylogos.com/previews/sparta-praha/sparta-praha-logo-footylogos-320.webp",
  "Celje": "https://assets.footylogos.com/previews/nk-celje/nk-celje-logo-footylogos-320.webp",
  "N.E.C. Nijmegen": "https://assets.footylogos.com/previews/nec-nijmegen/nec-nijmegen-logo-footylogos-320.webp",
  "Torreense": "https://assets.footylogos.com/previews/scu-torreense/scu-torreense-logo-footylogos-320.webp",
  "Juventus": "https://assets.footylogos.com/previews/juventus/juventus-logo-footylogos-320.webp",
  "Sturm Graz": "https://assets.footylogos.com/previews/sk-sturm-graz/sk-sturm-graz-logo-footylogos-320.webp",
  "Hapoel Beer-Sheva": "https://assets.footylogos.com/previews/hapoel-beer-sheva/hapoel-beer-sheva-logo-footylogos-320.webp",
  "Benfica": "https://assets.footylogos.com/previews/sl-benfica/sl-benfica-logo-footylogos-320.webp",
  "Ararat-Armenia": "https://assets.footylogos.com/previews/fc-ararat-armenia/fc-ararat-armenia-logo-footylogos-320.webp",
  "Celtic": "https://assets.footylogos.com/previews/celtic/celtic-logo-footylogos-320.webp",
  "Lech Poznań": "https://assets.footylogos.com/previews/lech-poznan/lech-poznan-logo-footylogos-320.webp",
  "Viktoria Plzeň": "https://assets.footylogos.com/previews/viktoria-plzen/viktoria-plzen-logo-footylogos-320.webp",
  "Omonia": "https://assets.footylogos.com/previews/ac-omonia-nicosia/ac-omonia-nicosia-logo-footylogos-320.webp",
  "Union SG": "https://assets.footylogos.com/previews/union-saint-gilloise/union-saint-gilloise-logo-footylogos-320.webp",
  "Crystal Palace": "https://assets.footylogos.com/previews/crystal-palace/crystal-palace-logo-footylogos-320.webp",
  "Leverkusen": "https://assets.footylogos.com/previews/bayer-leverkusen/bayer-leverkusen-logo-footylogos-320.webp",
  "Real Sociedad": "https://assets.footylogos.com/previews/real-sociedad/real-sociedad-logo-footylogos-320.webp",
  "Celta": "https://assets.footylogos.com/previews/celta-vigo/celta-vigo-logo-footylogos-320.webp",
  "Lillestrøm": "https://assets.footylogos.com/previews/lillestrom-sk/lillestrom-sk-logo-footylogos-320.webp",
  "Olympiacos": "https://assets.footylogos.com/previews/olympiacos/olympiacos-logo-footylogos-320.webp",
  "Ferencváros": "https://assets.footylogos.com/previews/ferencvaros-tc/ferencvaros-tc-logo-footylogos-320.webp",
  "Bournemouth": "https://assets.footylogos.com/previews/afc-bournemouth/afc-bournemouth-logo-footylogos-320.webp",
  "Beşiktaş": "https://assets.footylogos.com/previews/besiktas/besiktas-logo-footylogos-320.webp",
  "Anderlecht": "https://assets.footylogos.com/previews/rsc-anderlecht/rsc-anderlecht-logo-footylogos-320.webp",
  "Rennes": "https://assets.footylogos.com/previews/stade-rennais/stade-rennais-logo-footylogos-320.webp",
  "Levski Sofia": "https://assets.footylogos.com/previews/levski-sofia/levski-sofia-logo-footylogos-320.webp"
};

export function applyEuropaCrests(data) {
  if (!data?.teams || !data?.fixtures) return data;
  const elFixtures = data.fixtures.filter(f => f.leagueId === 2146);
  if (!elFixtures.length) return data;
  const byId = new Map(data.teams.map(t => [t.id, t]));
  const aliases = new Map();
  for (const f of elFixtures) {
    for (const side of ['home', 'away']) {
      const team = f[side];
      if (!team) continue;
      const logo = europaCrests[team.name] || europaCrests[team.snapshotName];
      if (logo) aliases.set(team.id, logo);
    }
  }
  // The provider may already have authoritative logos. Only fill gaps.
  for (const team of data.teams) {
    if (!team.logo && aliases.has(team.id)) team.logo = aliases.get(team.id);
  }
  for (const f of data.fixtures) {
    for (const side of ['home', 'away']) {
      const team = f[side];
      if (team && !team.logo) team.logo = byId.get(team.id)?.logo || aliases.get(team.id) || '';
    }
  }
  for (const standing of data.standings || []) {
    for (const row of standing.rows || []) {
      if (row.team && !row.team.logo) row.team.logo = byId.get(row.team.id)?.logo || aliases.get(row.team.id) || '';
    }
  }
  return data;
}
