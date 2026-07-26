window.SportsHubNational={
  regions:[['all','すべて'],['asia','アジア'],['europe','欧州'],['south-america','南米'],['north-america','北中米'],['africa','アフリカ']],
  regionNames:{asia:'アジア',europe:'欧州','south-america':'南米','north-america':'北中米',africa:'アフリカ'},
  teams:[
    {id:'japan',name:'日本',en:'Japan',flag:'🇯🇵',region:'asia',ranking:17},
    {id:'korea',name:'韓国',en:'South Korea',flag:'🇰🇷',region:'asia',ranking:23},
    {id:'australia',name:'オーストラリア',en:'Australia',flag:'🇦🇺',region:'asia',ranking:26},
    {id:'argentina',name:'アルゼンチン',en:'Argentina',flag:'🇦🇷',region:'south-america',ranking:1},
    {id:'brazil',name:'ブラジル',en:'Brazil',flag:'🇧🇷',region:'south-america',ranking:5},
    {id:'uruguay',name:'ウルグアイ',en:'Uruguay',flag:'🇺🇾',region:'south-america',ranking:11},
    {id:'england',name:'イングランド',en:'England',flag:'🏴',region:'europe',ranking:4},
    {id:'france',name:'フランス',en:'France',flag:'🇫🇷',region:'europe',ranking:2},
    {id:'germany',name:'ドイツ',en:'Germany',flag:'🇩🇪',region:'europe',ranking:10},
    {id:'spain',name:'スペイン',en:'Spain',flag:'🇪🇸',region:'europe',ranking:3},
    {id:'italy',name:'イタリア',en:'Italy',flag:'🇮🇹',region:'europe',ranking:9},
    {id:'portugal',name:'ポルトガル',en:'Portugal',flag:'🇵🇹',region:'europe',ranking:6},
    {id:'netherlands',name:'オランダ',en:'Netherlands',flag:'🇳🇱',region:'europe',ranking:7},
    {id:'usa',name:'アメリカ',en:'United States',flag:'🇺🇸',region:'north-america',ranking:16},
    {id:'mexico',name:'メキシコ',en:'Mexico',flag:'🇲🇽',region:'north-america',ranking:15},
    {id:'canada',name:'カナダ',en:'Canada',flag:'🇨🇦',region:'north-america',ranking:30},
    {id:'morocco',name:'モロッコ',en:'Morocco',flag:'🇲🇦',region:'africa',ranking:12},
    {id:'senegal',name:'セネガル',en:'Senegal',flag:'🇸🇳',region:'africa',ranking:18},
    {id:'nigeria',name:'ナイジェリア',en:'Nigeria',flag:'🇳🇬',region:'africa',ranking:43}
  ],
  find(id){return this.teams.find(team=>team.id===id);}
};