window.FootballServices=window.FootballServices||{};
(function(ns){
  const asArray=value=>Array.isArray(value)?value:[];
  const unique=values=>[...new Set(asArray(values).map(String).filter(Boolean))];

  class FavoriteService{
    constructor(repositoryOrOptions={}){
      const FavoriteRepository=window.FootballRepositories?.FavoriteRepository;
      this.repository=repositoryOrOptions?.list&&repositoryOrOptions?.replace
        ?repositoryOrOptions
        :new FavoriteRepository(repositoryOrOptions);
    }
    list(){return this.repository.list();}
    has(id){return this.repository.has(id);}
    add(id){this.repository.add(id);this.emit(id,true);return true;}
    remove(id){this.repository.remove(id);this.emit(id,false);return false;}
    toggle(id){return this.has(id)?this.remove(id):this.add(id);}
    clear(){this.repository.clear();this.emit('',false);}
    emit(id,added){document.dispatchEvent(new CustomEvent('football:favorite-change',{detail:{id:String(id),added,ids:this.list()}}));}
  }

  class MatchModel{
    constructor(raw={}){
      this.raw=raw;
      this.id=String(raw.id??raw.uid??'');
      this.date=raw.date??raw.kickoff??raw.startTime??null;
      this.home=raw.home??raw.homeTeam??null;
      this.away=raw.away??raw.awayTeam??null;
      this.status=String(raw.status??'scheduled').toLowerCase();
      this.score=raw.score??null;
      this.competition=raw.competition??raw.league??'';
      this.stage=raw.stage??raw.round??'';
      this.venue=raw.venue??'';
    }
    get timestamp(){const value=new Date(this.date).getTime();return Number.isNaN(value)?0:value;}
    get dateKey(){if(!this.date)return'';const date=new Date(this.date);if(Number.isNaN(date.getTime()))return'';const pad=value=>String(value).padStart(2,'0');return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;}
    get isFinished(){return ['finished','full_time','ft'].includes(this.status);}
    get isLive(){return ['in_play','live','paused','halftime'].includes(this.status);}
    hasTeam(id){const target=String(id);return [this.home,this.away].some(team=>String(team?.id??team?.uid??team??'')===target);}
  }

  class MatchService{
    constructor(matches=[]){this.set(matches);}
    set(matches=[]){this.matches=asArray(matches).map(match=>match instanceof MatchModel?match:new MatchModel(match));return this;}
    all(){return [...this.matches].sort((a,b)=>a.timestamp-b.timestamp);}
    byDate(dateKey){return this.all().filter(match=>match.dateKey===dateKey);}
    upcoming(now=Date.now()){return this.all().filter(match=>!match.isFinished&&match.timestamp>=now);}
    finished(now=Date.now()){return this.all().filter(match=>match.isFinished&&match.timestamp<=now);}
    live(){return this.all().filter(match=>match.isLive);}
    involving(teamIds=[]){const ids=new Set(unique(teamIds));return this.all().filter(match=>[match.home,match.away].some(team=>ids.has(String(team?.id??team?.uid??team??''))));}
    byCompetition(id){return this.all().filter(match=>String(match.competition)===String(id));}
  }

  class SearchService{
    constructor(items=[],fields=[]){this.items=asArray(items);this.fields=fields;}
    set(items=[]){this.items=asArray(items);return this;}
    search(query){const needle=String(query??'').trim().toLocaleLowerCase('ja');if(!needle)return [...this.items];return this.items.filter(item=>this.fields.some(field=>String(typeof field==='function'?field(item):item?.[field]??'').toLocaleLowerCase('ja').includes(needle)));}
  }

  class StandingService{
    constructor(rows=[]){this.rows=asArray(rows);}
    set(rows=[]){this.rows=asArray(rows);return this;}
    all(){return [...this.rows].sort((a,b)=>(a.rank??999)-(b.rank??999));}
    top(limit=5){return this.all().slice(0,limit);}
    byCompetition(id){return this.all().filter(row=>String(row.league??row.competition??'')===String(id));}
  }

  Object.assign(ns,{FavoriteService,MatchModel,MatchService,SearchService,StandingService});
})(window.FootballServices);