window.SportsRankings = window.SportsRankings || {};

(function initializeSportsRankingServices(namespace) {
  if (namespace.FifaRankingService) return;

  const Core = window.SportsCore || window.FootballCore || {};
  const asArray = value => (Array.isArray(value) ? value : []);
  const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, Number(value) || 0));
  const normalizeKey = value => String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  const FIFA_NAME_ALIASES = Object.freeze({
    korea: 'Korea Republic',
    'south korea': 'Korea Republic',
    'north korea': 'DPR Korea',
    'korea dpr': 'DPR Korea',
    'dpr korea': 'DPR Korea',
    iran: 'IR Iran',
    china: 'China PR',
    taiwan: 'Chinese Taipei',
    'hong kong': 'Hong Kong, China',
    usa: 'USA',
    'united states': 'USA',
    'united states of america': 'USA',
    turkey: 'Türkiye',
    turkiye: 'Türkiye',
    'ivory coast': "Côte d'Ivoire",
    'cote divoire': "Côte d'Ivoire",
    'cape verde': 'Cabo Verde',
    curacao: 'Curaçao',
    'republic of ireland': 'Republic of Ireland',
    ireland: 'Republic of Ireland',
    'dr congo': 'Congo DR',
    'democratic republic of congo': 'Congo DR',
    'congo kinshasa': 'Congo DR',
    'congo brazzaville': 'Congo',
    bolivia: 'Bolivia',
    syria: 'Syria',
    vietnam: 'Vietnam',
    brunei: 'Brunei Darussalam',
    'brunei darussalam': 'Brunei Darussalam',
    'timor leste': 'Timor-Leste',
    'east timor': 'Timor-Leste',
    eswatini: 'Eswatini',
    swaziland: 'Eswatini',
    'the gambia': 'Gambia',
    gambia: 'Gambia'
  });

  class SportsRankingEntry {
    constructor(raw = {}) {
      this.rank = Number(raw.rank) || null;
      this.previousRank = Number(raw.previousRank ?? raw.previous_rank) || null;
      this.points = Number(raw.points ?? raw.totalPoints ?? raw.total_points) || null;
      this.code = String(raw.code ?? raw.countryCode ?? raw.country_code ?? '').trim().toUpperCase();
      this.name = String(raw.name ?? raw.team ?? '').trim();
      this.confederation = String(raw.confederation ?? raw.conf ?? '').trim();
      this.flag = String(raw.flag ?? raw.flagUrl ?? '').trim();
      this.movement = Number.isFinite(Number(raw.movement))
        ? Number(raw.movement)
        : this.previousRank && this.rank ? this.previousRank - this.rank : 0;
    }
  }

  class SportsRankingRepository {
    constructor({ path = './data/fifa-rankings.json', repository = null } = {}) {
      const Repository = Core.JsonRepository;
      this.repository = repository || (Repository ? new Repository(path) : null);
      this.path = path;
    }

    async load({ fresh = false } = {}) {
      if (this.repository?.get) return this.repository.get({ fresh });
      const separator = this.path.includes('?') ? '&' : '?';
      const response = await fetch(`${this.path}${separator}v=${fresh ? Date.now() : 'current'}`, {
        cache: fresh ? 'no-store' : 'default'
      });
      if (!response.ok) throw new Error(`Ranking HTTP ${response.status}`);
      return response.json();
    }

    clear() {
      this.repository?.clear?.();
    }
  }

  class SportsRankingService {
    constructor({ repository = new SportsRankingRepository(), aliases = {} } = {}) {
      this.repository = repository;
      this.aliases = { ...aliases };
      this.payload = null;
      this.entries = [];
      this.index = new Map();
      this.pending = null;
    }

    indexEntry(entry) {
      [entry.name, entry.code].filter(Boolean).forEach(value => {
        this.index.set(normalizeKey(value), entry);
      });
    }

    setPayload(payload = {}) {
      this.payload = {
        ...payload,
        rankings: asArray(payload.rankings).map(row => new SportsRankingEntry(row))
      };
      this.entries = this.payload.rankings.filter(entry => entry.rank && entry.name);
      this.index = new Map();
      this.entries.forEach(entry => this.indexEntry(entry));
      return this.payload;
    }

    async load({ fresh = false } = {}) {
      if (this.payload && !fresh) return this.payload;
      if (this.pending && !fresh) return this.pending;

      this.pending = this.repository.load({ fresh })
        .then(payload => this.setPayload(payload || {}))
        .finally(() => { this.pending = null; });
      return this.pending;
    }

    find(value) {
      const key = normalizeKey(value);
      if (!key) return null;
      const alias = this.aliases[key];
      return this.index.get(normalizeKey(alias || key)) || this.index.get(key) || null;
    }

    findAny(values = []) {
      for (const value of values) {
        const entry = this.find(value);
        if (entry) return entry;
      }
      return null;
    }

    formatRank(entry, fallback = '') {
      return entry?.rank ? `FIFA ${entry.rank}位` : fallback;
    }
  }

  class MatchInterestService {
    evaluate(leftEntry, rightEntry) {
      if (!leftEntry?.rank || !rightEntry?.rank) return null;

      const leftRank = Number(leftEntry.rank);
      const rightRank = Number(rightEntry.rank);
      const averageRank = (leftRank + rightRank) / 2;
      const rankGap = Math.abs(leftRank - rightRank);
      const quality = clamp(104 - averageRank * 1.55);
      const balance = clamp(100 - rankGap * 2.15);
      const eliteBonus = leftRank <= 10 && rightRank <= 10
        ? 10
        : Math.min(leftRank, rightRank) <= 10 && Math.max(leftRank, rightRank) <= 30 ? 5 : 0;
      const score = Math.round(clamp(quality * .66 + balance * .34 + eliteBonus));
      const grade = score >= 84 ? 'S'
        : score >= 70 ? 'A'
          : score >= 55 ? 'B'
            : score >= 40 ? 'C' : 'D';
      const label = {
        S: '必見',
        A: '注目',
        B: '好カード',
        C: '実力差あり',
        D: '挑戦'
      }[grade];

      return Object.freeze({
        score,
        grade,
        label,
        averageRank: Math.round(averageRank * 10) / 10,
        rankGap,
        leftRank,
        rightRank
      });
    }
  }

  class FifaRankingService extends SportsRankingService {
    constructor(options = {}) {
      super({
        ...options,
        aliases: { ...FIFA_NAME_ALIASES, ...(options.aliases || {}) }
      });
      this.interestService = options.interestService || new MatchInterestService();
    }

    teamCandidates(teamOrId, fallbackName = '') {
      const resolved = window.SportsHubNational?.find?.(teamOrId)
        || window.SportsHubNational?.find?.(fallbackName)
        || null;
      const values = [
        resolved?.id,
        resolved?.en,
        resolved?.name,
        teamOrId,
        fallbackName
      ].filter(Boolean);

      return values.flatMap(value => {
        const normalized = normalizeKey(value);
        return [value, this.aliases[normalized]].filter(Boolean);
      });
    }

    findTeam(teamOrId, fallbackName = '') {
      return this.findAny(this.teamCandidates(teamOrId, fallbackName));
    }

    matchup(leftTeamOrId, rightTeamOrId, leftName = '', rightName = '') {
      const left = this.findTeam(leftTeamOrId, leftName);
      const right = this.findTeam(rightTeamOrId, rightName);
      return {
        left,
        right,
        interest: this.interestService.evaluate(left, right)
      };
    }
  }

  Object.assign(namespace, {
    SportsRankingEntry,
    SportsRankingRepository,
    SportsRankingService,
    MatchInterestService,
    FifaRankingService,
    FIFA_NAME_ALIASES,
    normalizeKey,
    VERSION: 1
  });
})(window.SportsRankings);