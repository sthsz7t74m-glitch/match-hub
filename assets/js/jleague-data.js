window.SportsHubJLeague={
 leagues:[['j1','J1'],['j2','J2'],['j3','J3']],
 leagueNames:{j1:'J1',j2:'J2',j3:'J3'},
 clubs:[
  {id:'urawa',name:'浦和レッズ',area:'埼玉',league:'j1',mark:'浦',stadium:'埼玉スタジアム2002'},
  {id:'fc-tokyo',name:'FC東京',area:'東京',league:'j1',mark:'東',stadium:'味の素スタジアム'},
  {id:'yokohama-fm',name:'横浜F・マリノス',area:'神奈川',league:'j1',mark:'横',stadium:'日産スタジアム'},
  {id:'kashima',name:'鹿島アントラーズ',area:'茨城',league:'j1',mark:'鹿',stadium:'県立カシマサッカースタジアム'},
  {id:'gamba',name:'ガンバ大阪',area:'大阪',league:'j1',mark:'脚',stadium:'パナソニックスタジアム吹田'},
  {id:'chiba',name:'ジェフユナイテッド千葉',area:'千葉',league:'j2',mark:'千',stadium:'フクダ電子アリーナ'},
  {id:'omiya',name:'RB大宮アルディージャ',area:'埼玉',league:'j2',mark:'宮',stadium:'NACK5スタジアム大宮'},
  {id:'iwata',name:'ジュビロ磐田',area:'静岡',league:'j2',mark:'磐',stadium:'ヤマハスタジアム'},
  {id:'matsumoto',name:'松本山雅FC',area:'長野',league:'j3',mark:'松',stadium:'サンプロ アルウィン'},
  {id:'gifu',name:'FC岐阜',area:'岐阜',league:'j3',mark:'岐',stadium:'岐阜メモリアルセンター長良川競技場'},
  {id:'ryukyu',name:'FC琉球',area:'沖縄',league:'j3',mark:'琉',stadium:'沖縄県総合運動公園陸上競技場'}
 ],
 find(id){return this.clubs.find(club=>club.id===id);}
};