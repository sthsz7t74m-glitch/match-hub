window.FootballAdapters=window.FootballAdapters||{};
(function(ns){
  const Core=window.FootballCore||{};
  const asArray=value=>Array.isArray(value)?value:[];

  class FootballDataAdapter{
    constructor({repository=null,loader=null,normalize=payload=>payload||{}}={}){
      this.repository=repository;
      this.loader=loader;
      this.normalize=normalize;
      this.payload=null;
      this.pending=null;
    }
    async load({fresh=false}={}){
      if(this.payload&&!fresh)return this.payload;
      if(this.pending&&!fresh)return this.pending;
      this.pending=Promise.resolve()
        .then(()=>this.loader?this.loader({fresh}):this.repository?.get({fresh}))
        .then(payload=>this.normalize(payload||{}))
        .then(payload=>{this.payload=payload;return payload;})
        .finally(()=>{this.pending=null;});
      return this.pending;
    }
    clear(){this.payload=null;this.pending=null;this.repository?.clear?.();}
    async loadMatches(options){return asArray((await this.load(options)).matches||(await this.load(options)).fixtures);}
    async loadStandings(options){return asArray((await this.load(options)).standings);}
    async loadTeams(options){return asArray((await this.load(options)).teams);}
    async loadMetadata(options){const payload=await this.load(options);return{updatedAt:payload.updatedAt||'',dataSource:payload.dataSource||'',season:payload.season||null,availability:payload.availability||{},leaguesAvailability:payload.leaguesAvailability||{},errors:asArray(payload.errors)};}
  }

  class FiveLeagueAdapter extends FootballDataAdapter{
    constructor(options={}){super({repository:options.repository||new Core.JsonRepository(options.path||'./data/football.json'),normalize:payload=>({...payload,matches:asArray(payload.matches||payload.fixtures),teams:asArray(payload.teams),standings:asArray(payload.standings)})});}
  }

  class JLeagueAdapter extends FootballDataAdapter{
    constructor(options={}){super({repository:options.repository||new Core.JsonRepository(options.path||'./data/jleague.json'),normalize:payload=>({...payload,matches:asArray(payload.matches),teams:asArray(payload.teams),standings:asArray(payload.standings)})});}
    async loadLeague(league='j1',options){const payload=await this.load(options);return{...payload,matches:asArray(payload.matches).filter(item=>(item.league||'j1')===league),teams:asArray(payload.teams).filter(item=>(item.league||'j1')===league),standings:asArray(payload.standings).filter(item=>(item.league||'j1')===league)};}
  }

  class NationalAdapter extends FootballDataAdapter{
    constructor(options={}){super({loader:options.loader||(()=>window.SportsHubNationalService?.loadPayload?.()),normalize:payload=>({...payload,matches:asArray(payload.matches),teams:asArray(payload.teams),standings:asArray(payload.standings)})});}
  }

  const create=type=>{if(type==='five')return new FiveLeagueAdapter();if(type==='national')return new NationalAdapter();return new JLeagueAdapter();};
  Object.assign(ns,{FootballDataAdapter,FiveLeagueAdapter,JLeagueAdapter,NationalAdapter,create});
})(window.FootballAdapters);