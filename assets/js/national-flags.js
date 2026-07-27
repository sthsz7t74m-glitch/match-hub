window.SportsHubNationalFlags = window.SportsHubNationalFlags || {};

(function initializeNationalFlags(registry) {
  const normalize = value => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  const flagFromCode = code => {
    const normalized = String(code || '').toUpperCase();
    if (!/^[A-Z]{2}$/.test(normalized)) return '🏳️';
    return [...normalized]
      .map(letter => String.fromCodePoint(127397 + letter.charCodeAt(0)))
      .join('');
  };

  const rows = `
myanmar|ミャンマー|Myanmar|MM|asia
bangladesh|バングラデシュ|Bangladesh|BD|asia
pakistan|パキスタン|Pakistan|PK|asia
sri-lanka|スリランカ|Sri Lanka|LK|asia
nepal|ネパール|Nepal|NP|asia
bhutan|ブータン|Bhutan|BT|asia
maldives|モルディブ|Maldives|MV|asia
afghanistan|アフガニスタン|Afghanistan|AF|asia
cambodia|カンボジア|Cambodia|KH|asia
laos|ラオス|Laos|LA|asia
brunei|ブルネイ|Brunei|BN|asia
timor-leste|東ティモール|Timor-Leste|TL|asia
mongolia|モンゴル|Mongolia|MN|asia
yemen|イエメン|Yemen|YE|asia
macau|マカオ|Macau|MO|asia
andorra|アンドラ|Andorra|AD|europe
cyprus|キプロス|Cyprus|CY|europe
faroe-islands|フェロー諸島|Faroe Islands|FO|europe
gibraltar|ジブラルタル|Gibraltar|GI|europe
liechtenstein|リヒテンシュタイン|Liechtenstein|LI|europe
luxembourg|ルクセンブルク|Luxembourg|LU|europe
malta|マルタ|Malta|MT|europe
san-marino|サンマリノ|San Marino|SM|europe
botswana|ボツワナ|Botswana|BW|africa
angola|アンゴラ|Angola|AO|africa
benin|ベナン|Benin|BJ|africa
burundi|ブルンジ|Burundi|BI|africa
cape-verde|カーボベルデ|Cape Verde|CV|africa
central-african-republic|中央アフリカ|Central African Republic|CF|africa
chad|チャド|Chad|TD|africa
comoros|コモロ|Comoros|KM|africa
congo|コンゴ共和国|Congo|CG|africa
djibouti|ジブチ|Djibouti|DJ|africa
equatorial-guinea|赤道ギニア|Equatorial Guinea|GQ|africa
eritrea|エリトリア|Eritrea|ER|africa
eswatini|エスワティニ|Eswatini|SZ|africa
ethiopia|エチオピア|Ethiopia|ET|africa
gabon|ガボン|Gabon|GA|africa
gambia|ガンビア|Gambia|GM|africa
guinea-bissau|ギニアビサウ|Guinea-Bissau|GW|africa
kenya|ケニア|Kenya|KE|africa
lesotho|レソト|Lesotho|LS|africa
liberia|リベリア|Liberia|LR|africa
libya|リビア|Libya|LY|africa
madagascar|マダガスカル|Madagascar|MG|africa
malawi|マラウイ|Malawi|MW|africa
mauritania|モーリタニア|Mauritania|MR|africa
mauritius|モーリシャス|Mauritius|MU|africa
mozambique|モザンビーク|Mozambique|MZ|africa
namibia|ナミビア|Namibia|NA|africa
niger|ニジェール|Niger|NE|africa
rwanda|ルワンダ|Rwanda|RW|africa
sao-tome-principe|サントメ・プリンシペ|Sao Tome and Principe|ST|africa
seychelles|セーシェル|Seychelles|SC|africa
sierra-leone|シエラレオネ|Sierra Leone|SL|africa
somalia|ソマリア|Somalia|SO|africa
south-sudan|南スーダン|South Sudan|SS|africa
sudan|スーダン|Sudan|SD|africa
tanzania|タンザニア|Tanzania|TZ|africa
togo|トーゴ|Togo|TG|africa
uganda|ウガンダ|Uganda|UG|africa
zambia|ザンビア|Zambia|ZM|africa
zimbabwe|ジンバブエ|Zimbabwe|ZW|africa
antigua-barbuda|アンティグア・バーブーダ|Antigua and Barbuda|AG|north-america
aruba|アルバ|Aruba|AW|north-america
bahamas|バハマ|Bahamas|BS|north-america
barbados|バルバドス|Barbados|BB|north-america
belize|ベリーズ|Belize|BZ|north-america
bermuda|バミューダ|Bermuda|BM|north-america
british-virgin-islands|英領ヴァージン諸島|British Virgin Islands|VG|north-america
cayman-islands|ケイマン諸島|Cayman Islands|KY|north-america
dominica|ドミニカ国|Dominica|DM|north-america
grenada|グレナダ|Grenada|GD|north-america
guyana|ガイアナ|Guyana|GY|north-america
montserrat|モントセラト|Montserrat|MS|north-america
nicaragua|ニカラグア|Nicaragua|NI|north-america
puerto-rico|プエルトリコ|Puerto Rico|PR|north-america
saint-kitts-nevis|セントクリストファー・ネービス|Saint Kitts and Nevis|KN|north-america
saint-lucia|セントルシア|Saint Lucia|LC|north-america
saint-vincent-grenadines|セントビンセント・グレナディーン|Saint Vincent and the Grenadines|VC|north-america
turks-caicos|タークス・カイコス諸島|Turks and Caicos Islands|TC|north-america
us-virgin-islands|米領ヴァージン諸島|US Virgin Islands|VI|north-america
american-samoa|米領サモア|American Samoa|AS|oceania
cook-islands|クック諸島|Cook Islands|CK|oceania
guam|グアム|Guam|GU|oceania
kiribati|キリバス|Kiribati|KI|oceania
northern-mariana-islands|北マリアナ諸島|Northern Mariana Islands|MP|oceania
papua-new-guinea|パプアニューギニア|Papua New Guinea|PG|oceania
samoa|サモア|Samoa|WS|oceania
tonga|トンガ|Tonga|TO|oceania
tuv​​alu|ツバル|Tuvalu|TV|oceania
vanuatu|バヌアツ|Vanuatu|VU|oceania
`.trim().split('\n').map(line => {
    const [id, name, en, code, region] = line.split('|');
    return { id, name, en, code, region, flag: flagFromCode(code) };
  });

  const aliases = {
    'korea republic': 'korea',
    'republic of korea': 'korea',
    'south korea': 'korea',
    'dpr korea': 'north-korea',
    'korea dpr': 'north-korea',
    'china pr': 'china',
    'chinese taipei': 'taiwan',
    'hong kong china': 'hong-kong',
    'united states of america': 'usa',
    'united states': 'usa',
    'usa': 'usa',
    'czech republic': 'czechia',
    'turkiye': 'turkey',
    'republic of ireland': 'ireland',
    'bosnia and herzegovina': 'bosnia',
    'north macedonia': 'north-macedonia',
    'cote divoire': 'ivory-coast',
    'cote d ivoire': 'ivory-coast',
    'democratic republic of congo': 'dr-congo',
    'congo dr': 'dr-congo',
    'dr congo': 'dr-congo',
    'congo republic': 'congo',
    'cape verde islands': 'cape-verde',
    'cabo verde': 'cape-verde',
    'swaziland': 'eswatini',
    'tanzania united republic': 'tanzania',
    'sao tome principe': 'sao-tome-principe',
    'curacao': 'curacao',
    'trinidad and tobago': 'trinidad-tobago',
    'new caledonia': 'new-caledonia',
    'solomon islands': 'solomon-islands',
    'papua new guinea': 'papua-new-guinea',
    'timor leste': 'timor-leste',
    'east timor': 'timor-leste',
    'faroe islands': 'faroe-islands'
  };

  const install = target => {
    if (!target?.teams) return;

    const existingIds = new Set(target.teams.map(team => team.id));
    rows.forEach(team => {
      if (!existingIds.has(team.id)) target.teams.push(team);
    });

    target.teams.forEach(team => {
      if (!team.flag && team.code) team.flag = flagFromCode(team.code);
    });

    const byNormalized = new Map();
    target.teams.forEach(team => {
      [team.id, team.name, team.en, team.code].filter(Boolean).forEach(value => {
        byNormalized.set(normalize(value), team);
      });
    });

    Object.entries(aliases).forEach(([alias, id]) => {
      const team = target.teams.find(item => item.id === id);
      if (team) byNormalized.set(normalize(alias), team);
    });

    const originalFind = target.find?.bind(target);
    target.find = value => {
      const direct = originalFind?.(value);
      if (direct) return direct;

      const normalized = normalize(value);
      const aliasId = aliases[normalized];
      if (aliasId) {
        const aliasTeam = target.teams.find(team => team.id === aliasId);
        if (aliasTeam) return aliasTeam;
      }

      if (/^[a-z]{2}$/.test(normalized)) {
        const codeTeam = target.teams.find(team => String(team.code || '').toLowerCase() === normalized);
        if (codeTeam) return codeTeam;
        return { id: normalized, name: String(value).toUpperCase(), en: String(value).toUpperCase(), code: normalized.toUpperCase(), flag: flagFromCode(normalized), region: 'other' };
      }

      return byNormalized.get(normalized);
    };

    target.flagFor = value => target.find(value)?.flag || '🏳️';
    target.resolve = value => target.find(value);
  };

  Object.assign(registry, { normalize, flagFromCode, rows, aliases, install });

  if (window.SportsHubNational) install(window.SportsHubNational);
})(window.SportsHubNationalFlags);
