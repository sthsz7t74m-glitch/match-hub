window.SportsHubNational={
  regions:[['all','すべて'],['asia','アジア'],['europe','欧州'],['south-america','南米'],['north-america','北中米'],['africa','アフリカ']],
  regionNames:{asia:'アジア',europe:'欧州','south-america':'南米','north-america':'北中米',africa:'アフリカ'},
  teams:[
    {id:'japan',name:'日本',en:'Japan',flag:'🇯🇵',region:'asia'},
    {id:'korea',name:'韓国',en:'South Korea',flag:'🇰🇷',region:'asia'},
    {id:'australia',name:'オーストラリア',en:'Australia',flag:'🇦🇺',region:'asia'},
    {id:'argentina',name:'アルゼンチン',en:'Argentina',flag:'🇦🇷',region:'south-america'},
    {id:'brazil',name:'ブラジル',en:'Brazil',flag:'🇧🇷',region:'south-america'},
    {id:'uruguay',name:'ウルグアイ',en:'Uruguay',flag:'🇺🇾',region:'south-america'},
    {id:'england',name:'イングランド',en:'England',flag:'🏴',region:'europe'},
    {id:'france',name:'フランス',en:'France',flag:'🇫🇷',region:'europe'},
    {id:'germany',name:'ドイツ',en:'Germany',flag:'🇩🇪',region:'europe'},
    {id:'spain',name:'スペイン',en:'Spain',flag:'🇪🇸',region:'europe'},
    {id:'italy',name:'イタリア',en:'Italy',flag:'🇮🇹',region:'europe'},
    {id:'portugal',name:'ポルトガル',en:'Portugal',flag:'🇵🇹',region:'europe'},
    {id:'netherlands',name:'オランダ',en:'Netherlands',flag:'🇳🇱',region:'europe'},
    {id:'usa',name:'アメリカ',en:'United States',flag:'🇺🇸',region:'north-america'},
    {id:'mexico',name:'メキシコ',en:'Mexico',flag:'🇲🇽',region:'north-america'},
    {id:'canada',name:'カナダ',en:'Canada',flag:'🇨🇦',region:'north-america'},
    {id:'morocco',name:'モロッコ',en:'Morocco',flag:'🇲🇦',region:'africa'},
    {id:'senegal',name:'セネガル',en:'Senegal',flag:'🇸🇳',region:'africa'},
    {id:'nigeria',name:'ナイジェリア',en:'Nigeria',flag:'🇳🇬',region:'africa'}
  ],
  find(id){return this.teams.find(team=>team.id===id);}
};