window.SportsHubJLeague = window.SportsHubJLeague || {};

(function initializeJLeagueCatalog(namespace) {
  const normalize = value => String(value ?? '')
    .normalize('NFKC')
    .toLocaleLowerCase('ja')
    .replace(/f\.c\.|fc/g, '')
    .replace(/[・･.．\-ー_\s]/g, '')
    .replace(/ユナイテッド/g, '')
    .replace(/1969/g, '');

  class JLeagueClub {
    constructor(definition = {}) {
      Object.assign(this, definition);
      this.id = String(definition.id || '');
      this.name = String(definition.name || '');
      this.area = String(definition.area || '');
      this.league = String(definition.league || '');
      this.mark = String(definition.mark || this.name.slice(0, 1) || 'J');
      this.en = String(definition.en || '');
      this.shortName = String(definition.shortName || this.name);
      this.providerId = definition.providerId ? String(definition.providerId) : '';
      this.officialSlugs = [...new Set([
        definition.officialSlug,
        ...(Array.isArray(definition.officialSlugs) ? definition.officialSlugs : [])
      ].filter(Boolean).map(String))];
      this.aliases = [...new Set([
        this.name,
        this.shortName,
        this.en,
        this.id,
        ...(Array.isArray(definition.aliases) ? definition.aliases : [])
      ].filter(Boolean).map(String))];
      Object.freeze(this.officialSlugs);
      Object.freeze(this.aliases);
      Object.freeze(this);
    }

    matches(value) {
      const target = normalize(value);
      return Boolean(target) && this.aliases.some(alias => normalize(alias) === target);
    }
  }

  class JLeagueCatalog {
    constructor({ leagues = [], clubs = [] } = {}) {
      this.leagues = Object.freeze(leagues.map(item => Object.freeze([...item])));
      this.leagueNames = Object.freeze(Object.fromEntries(this.leagues));
      this.clubs = Object.freeze(clubs.map(club => club instanceof JLeagueClub ? club : new JLeagueClub(club)));
      this.byId = new Map(this.clubs.map(club => [club.id, club]));
      this.bySlug = new Map(this.clubs.flatMap(club => club.officialSlugs.map(slug => [slug, club])));
      this.aliasIndex = new Map();
      this.clubs.forEach(club => club.aliases.forEach(alias => {
        const key = normalize(alias);
        if (key && !this.aliasIndex.has(key)) this.aliasIndex.set(key, club);
      }));
    }

    find(value) {
      if (!value) return null;
      const id = String(value);
      return this.byId.get(id) || this.bySlug.get(id) || this.aliasIndex.get(normalize(id)) || null;
    }

    findByOfficialSlug(slug) {
      return this.bySlug.get(String(slug || '')) || null;
    }

    forLeague(league) {
      return this.clubs.filter(club => club.league === league);
    }

    aliasesFor(clubOrId) {
      return this.find(clubOrId)?.aliases || [];
    }

    createTeamMapperOptions() {
      const idMap = {};
      const nameMap = {};
      this.clubs.forEach(club => {
        if (!club.providerId) return;
        idMap[club.id] = club.providerId;
        nameMap[club.providerId] = club.name;
      });
      return { teams: this.clubs, idMap, nameMap };
    }

    toJSON() {
      return {
        leagues: this.leagues,
        leagueNames: this.leagueNames,
        clubs: this.clubs
      };
    }
  }

  const definitions = [
    { id: 'kashima', name: '鹿島アントラーズ', shortName: '鹿島', en: 'Kashima Antlers', area: '茨城', league: 'j1', mark: '鹿', providerId: '7115', officialSlug: 'kashima' },
    { id: 'mito', name: '水戸ホーリーホック', shortName: '水戸', en: 'Mito HollyHock', area: '茨城', league: 'j1', mark: '水', providerId: '131701', officialSlug: 'mito' },
    { id: 'urawa', name: '浦和レッズ', shortName: '浦和', en: 'Urawa Red Diamonds', area: '埼玉', league: 'j1', mark: '浦', providerId: '3385', officialSlug: 'urawa' },
    { id: 'chiba', name: 'ジェフユナイテッド千葉', shortName: '千葉', en: 'JEF United Chiba', area: '千葉', league: 'j1', mark: '千', providerId: '7111', officialSlug: 'chiba', aliases: ['ジェフ千葉', 'JEF千葉'] },
    { id: 'kashiwa', name: '柏レイソル', shortName: '柏', en: 'Kashiwa Reysol', area: '千葉', league: 'j1', mark: '柏', providerId: '7476', officialSlug: 'kashiwa' },
    { id: 'fc-tokyo', name: 'FC東京', shortName: 'FC東京', en: 'FC Tokyo', area: '東京', league: 'j1', mark: '東', providerId: '3384', officialSlug: 'fctokyo', officialSlugs: ['fc-tokyo'], aliases: ['ＦＣ東京'] },
    { id: 'tokyo-verdy', name: '東京ヴェルディ', shortName: '東京V', en: 'Tokyo Verdy', area: '東京', league: 'j1', mark: '緑', providerId: '3393', officialSlug: 'verdy', officialSlugs: ['tokyo-verdy'], aliases: ['東京Ｖ'] },
    { id: 'machida', name: 'FC町田ゼルビア', shortName: '町田', en: 'Machida Zelvia', area: '東京', league: 'j1', mark: '町', providerId: '22167', officialSlug: 'machida', aliases: ['ＦＣ町田ゼルビア'] },
    { id: 'kawasaki', name: '川崎フロンターレ', shortName: '川崎F', en: 'Kawasaki Frontale', area: '神奈川', league: 'j1', mark: '川', providerId: '7112', officialSlug: 'kawasaki', aliases: ['川崎Ｆ'] },
    { id: 'yokohama-fm', name: '横浜F・マリノス', shortName: '横浜FM', en: 'Yokohama F. Marinos', area: '神奈川', league: 'j1', mark: '横', providerId: '7116', officialSlug: 'yokohamafm', officialSlugs: ['yokohama-fm'], aliases: ['横浜Ｆ・マリノス', '横浜ＦＭ'] },
    { id: 'shimizu', name: '清水エスパルス', shortName: '清水', en: 'Shimizu S-Pulse', area: '静岡', league: 'j1', mark: '清', providerId: '7104', officialSlug: 'shimizu' },
    { id: 'nagoya', name: '名古屋グランパス', shortName: '名古屋', en: 'Nagoya Grampus', area: '愛知', league: 'j1', mark: '名', providerId: '7108', officialSlug: 'nagoya' },
    { id: 'kyoto', name: '京都サンガF.C.', shortName: '京都', en: 'Kyoto Sanga F.C.', area: '京都', league: 'j1', mark: '京', providerId: '21361', officialSlug: 'kyoto', aliases: ['京都サンガＦ.Ｃ.'] },
    { id: 'gamba', name: 'ガンバ大阪', shortName: 'G大阪', en: 'Gamba Osaka', area: '大阪', league: 'j1', mark: '脚', providerId: '7102', officialSlug: 'gamba', aliases: ['Ｇ大阪'] },
    { id: 'cerezo', name: 'セレッソ大阪', shortName: 'C大阪', en: 'Cerezo Osaka', area: '大阪', league: 'j1', mark: '桜', providerId: '7109', officialSlug: 'cerezo', aliases: ['Ｃ大阪'] },
    { id: 'kobe', name: 'ヴィッセル神戸', shortName: '神戸', en: 'Vissel Kobe', area: '兵庫', league: 'j1', mark: '神', providerId: '7477', officialSlug: 'kobe' },
    { id: 'okayama', name: 'ファジアーノ岡山', shortName: '岡山', en: 'Fagiano Okayama', area: '岡山', league: 'j1', mark: '岡', providerId: '22522', officialSlug: 'okayama' },
    { id: 'hiroshima', name: 'サンフレッチェ広島', shortName: '広島', en: 'Sanfrecce Hiroshima', area: '広島', league: 'j1', mark: '広', providerId: '7114', officialSlug: 'hiroshima' },
    { id: 'fukuoka', name: 'アビスパ福岡', shortName: '福岡', en: 'Avispa Fukuoka', area: '福岡', league: 'j1', mark: '福', providerId: '7107', officialSlug: 'fukuoka' },
    { id: 'nagasaki', name: 'V・ファーレン長崎', shortName: '長崎', en: 'V-Varen Nagasaki', area: '長崎', league: 'j1', mark: '長', providerId: '19001', officialSlug: 'nagasaki', aliases: ['Ｖ・ファーレン長崎'] },

    { id: 'sapporo', name: '北海道コンサドーレ札幌', shortName: '札幌', en: 'Hokkaido Consadole Sapporo', area: '北海道', league: 'j2', mark: '札', officialSlug: 'sapporo', aliases: ['コンサドーレ札幌'] },
    { id: 'hachinohe', name: 'ヴァンラーレ八戸', shortName: '八戸', en: 'Vanraure Hachinohe', area: '青森', league: 'j2', mark: '八', officialSlug: 'hachinohe' },
    { id: 'sendai', name: 'ベガルタ仙台', shortName: '仙台', en: 'Vegalta Sendai', area: '宮城', league: 'j2', mark: '仙', officialSlug: 'sendai' },
    { id: 'akita', name: 'ブラウブリッツ秋田', shortName: '秋田', en: 'Blaublitz Akita', area: '秋田', league: 'j2', mark: '秋', officialSlug: 'akita' },
    { id: 'yamagata', name: 'モンテディオ山形', shortName: '山形', en: 'Montedio Yamagata', area: '山形', league: 'j2', mark: '山', officialSlug: 'yamagata' },
    { id: 'iwaki', name: 'いわきFC', shortName: 'いわき', en: 'Iwaki FC', area: '福島', league: 'j2', mark: 'い', officialSlug: 'iwaki', aliases: ['いわきＦＣ'] },
    { id: 'tochigi-city', name: '栃木シティ', shortName: '栃木C', en: 'Tochigi City', area: '栃木', league: 'j2', mark: '栃', officialSlug: 'tochigic', officialSlugs: ['tochigi-city'], aliases: ['栃木Ｃ'] },
    { id: 'omiya', name: 'RB大宮アルディージャ', shortName: '大宮', en: 'RB Omiya Ardija', area: '埼玉', league: 'j2', mark: '宮', officialSlug: 'omiya', aliases: ['ＲＢ大宮アルディージャ', '大宮アルディージャ'] },
    { id: 'yokohama-fc', name: '横浜FC', shortName: '横浜FC', en: 'Yokohama FC', area: '神奈川', league: 'j2', mark: '横', officialSlug: 'yokohamafc', officialSlugs: ['yokohama-fc'], aliases: ['横浜ＦＣ'] },
    { id: 'shonan', name: '湘南ベルマーレ', shortName: '湘南', en: 'Shonan Bellmare', area: '神奈川', league: 'j2', mark: '湘', officialSlug: 'shonan' },
    { id: 'kofu', name: 'ヴァンフォーレ甲府', shortName: '甲府', en: 'Ventforet Kofu', area: '山梨', league: 'j2', mark: '甲', officialSlug: 'kofu' },
    { id: 'niigata', name: 'アルビレックス新潟', shortName: '新潟', en: 'Albirex Niigata', area: '新潟', league: 'j2', mark: '新', officialSlug: 'niigata' },
    { id: 'toyama', name: 'カターレ富山', shortName: '富山', en: 'Kataller Toyama', area: '富山', league: 'j2', mark: '富', officialSlug: 'toyama' },
    { id: 'iwata', name: 'ジュビロ磐田', shortName: '磐田', en: 'Jubilo Iwata', area: '静岡', league: 'j2', mark: '磐', officialSlug: 'iwata' },
    { id: 'fujieda', name: '藤枝MYFC', shortName: '藤枝', en: 'Fujieda MYFC', area: '静岡', league: 'j2', mark: '藤', officialSlug: 'fujieda', aliases: ['藤枝ＭＹＦＣ'] },
    { id: 'tokushima', name: '徳島ヴォルティス', shortName: '徳島', en: 'Tokushima Vortis', area: '徳島', league: 'j2', mark: '徳', officialSlug: 'tokushima' },
    { id: 'imabari', name: 'FC今治', shortName: '今治', en: 'FC Imabari', area: '愛媛', league: 'j2', mark: '今', officialSlug: 'imabari', aliases: ['ＦＣ今治'] },
    { id: 'tosu', name: 'サガン鳥栖', shortName: '鳥栖', en: 'Sagan Tosu', area: '佐賀', league: 'j2', mark: '鳥', officialSlug: 'tosu' },
    { id: 'oita', name: '大分トリニータ', shortName: '大分', en: 'Oita Trinita', area: '大分', league: 'j2', mark: '大', officialSlug: 'oita' },
    { id: 'miyazaki', name: 'テゲバジャーロ宮崎', shortName: '宮崎', en: 'Tegevajaro Miyazaki', area: '宮崎', league: 'j2', mark: '宮', officialSlug: 'miyazaki' },

    { id: 'fukushima', name: '福島ユナイテッドFC', shortName: '福島', en: 'Fukushima United FC', area: '福島', league: 'j3', mark: '福', officialSlug: 'fukushima', aliases: ['福島ユナイテッドＦＣ'] },
    { id: 'tochigi-sc', name: '栃木SC', shortName: '栃木SC', en: 'Tochigi SC', area: '栃木', league: 'j3', mark: '栃', officialSlug: 'tochigi', officialSlugs: ['tochigi-sc'], aliases: ['栃木ＳＣ'] },
    { id: 'gunma', name: 'ザスパ群馬', shortName: '群馬', en: 'Thespa Gunma', area: '群馬', league: 'j3', mark: '群', officialSlug: 'gunma' },
    { id: 'sagamihara', name: 'SC相模原', shortName: '相模原', en: 'SC Sagamihara', area: '神奈川', league: 'j3', mark: '相', officialSlug: 'sagamihara', aliases: ['ＳＣ相模原'] },
    { id: 'matsumoto', name: '松本山雅FC', shortName: '松本', en: 'Matsumoto Yamaga FC', area: '長野', league: 'j3', mark: '松', officialSlug: 'matsumoto', aliases: ['松本山雅ＦＣ'] },
    { id: 'nagano', name: 'AC長野パルセイロ', shortName: '長野', en: 'AC Nagano Parceiro', area: '長野', league: 'j3', mark: '長', officialSlug: 'nagano', aliases: ['ＡＣ長野パルセイロ'] },
    { id: 'kanazawa', name: 'ツエーゲン金沢', shortName: '金沢', en: 'Zweigen Kanazawa', area: '石川', league: 'j3', mark: '金', officialSlug: 'kanazawa' },
    { id: 'gifu', name: 'FC岐阜', shortName: '岐阜', en: 'FC Gifu', area: '岐阜', league: 'j3', mark: '岐', officialSlug: 'gifu', aliases: ['ＦＣ岐阜'] },
    { id: 'shiga', name: 'レイラック滋賀FC', shortName: '滋賀', en: 'Reilac Shiga FC', area: '滋賀', league: 'j3', mark: '滋', officialSlug: 'shiga', aliases: ['レイラック滋賀ＦＣ'] },
    { id: 'fc-osaka', name: 'FC大阪', shortName: 'FC大阪', en: 'FC Osaka', area: '大阪', league: 'j3', mark: '阪', officialSlug: 'osaka', officialSlugs: ['fc-osaka'], aliases: ['ＦＣ大阪'] },
    { id: 'nara', name: '奈良クラブ', shortName: '奈良', en: 'Nara Club', area: '奈良', league: 'j3', mark: '奈', officialSlug: 'nara' },
    { id: 'tottori', name: 'ガイナーレ鳥取', shortName: '鳥取', en: 'Gainare Tottori', area: '鳥取', league: 'j3', mark: '鳥', officialSlug: 'tottori' },
    { id: 'yamaguchi', name: 'レノファ山口FC', shortName: '山口', en: 'Renofa Yamaguchi FC', area: '山口', league: 'j3', mark: '山', officialSlug: 'yamaguchi', aliases: ['レノファ山口ＦＣ'] },
    { id: 'sanuki', name: 'カマタマーレ讃岐', shortName: '讃岐', en: 'Kamatamare Sanuki', area: '香川', league: 'j3', mark: '讃', officialSlug: 'sanuki' },
    { id: 'ehime', name: '愛媛FC', shortName: '愛媛', en: 'Ehime FC', area: '愛媛', league: 'j3', mark: '愛', officialSlug: 'ehime', aliases: ['愛媛ＦＣ'] },
    { id: 'kochi', name: '高知ユナイテッドSC', shortName: '高知', en: 'Kochi United SC', area: '高知', league: 'j3', mark: '高', officialSlug: 'kochi', aliases: ['高知ユナイテッドＳＣ'] },
    { id: 'kitakyushu', name: 'ギラヴァンツ北九州', shortName: '北九州', en: 'Giravanz Kitakyushu', area: '福岡', league: 'j3', mark: '北', officialSlug: 'kitakyushu' },
    { id: 'kumamoto', name: 'ロアッソ熊本', shortName: '熊本', en: 'Roasso Kumamoto', area: '熊本', league: 'j3', mark: '熊', officialSlug: 'kumamoto' },
    { id: 'kagoshima', name: '鹿児島ユナイテッドFC', shortName: '鹿児島', en: 'Kagoshima United FC', area: '鹿児島', league: 'j3', mark: '鹿', officialSlug: 'kagoshima', aliases: ['鹿児島ユナイテッドＦＣ'] },
    { id: 'ryukyu', name: 'FC琉球', shortName: '琉球', en: 'FC Ryukyu', area: '沖縄', league: 'j3', mark: '琉', officialSlug: 'ryukyu', aliases: ['ＦＣ琉球'] }
  ];

  const catalog = new JLeagueCatalog({
    leagues: [['j1', 'J1'], ['j2', 'J2'], ['j3', 'J3']],
    clubs: definitions
  });

  Object.assign(namespace, catalog, {
    JLeagueClub,
    JLeagueCatalog,
    normalize,
    catalog,
    leagues: catalog.leagues,
    leagueNames: catalog.leagueNames,
    clubs: catalog.clubs,
    find: value => catalog.find(value),
    findByOfficialSlug: slug => catalog.findByOfficialSlug(slug),
    forLeague: league => catalog.forLeague(league),
    aliasesFor: clubOrId => catalog.aliasesFor(clubOrId),
    createTeamMapperOptions: () => catalog.createTeamMapperOptions()
  });
})(window.SportsHubJLeague);
