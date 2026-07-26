window.FootballCore=window.FootballCore||{};
(function(ns){
  const asArray=value=>Array.isArray(value)?value:[];
  const unique=values=>[...new Set(asArray(values).map(String).filter(Boolean))];
  const escapeHtml=value=>String(value??'').replace(/[&<>"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[char]));

  class JsonRepository{
    constructor(path){this.path=path;this.cache=null;this.pending=null;}
    async get({fresh=false}={}){
      if(this.cache&&!fresh)return this.cache;
      if(this.pending&&!fresh)return this.pending;
      const separator=this.path.includes('?')?'&':'?';
      this.pending=fetch(`${this.path}${separator}v=${Date.now()}`,{cache:'no-store'})
        .then(response=>{if(!response.ok)throw new Error(`HTTP ${response.status}: ${this.path}`);return response.json();})
        .then(data=>(this.cache=data,data))
        .finally(()=>{this.pending=null;});
      return this.pending;
    }
    clear(){this.cache=null;this.pending=null;}
  }

  class StorageRepository{
    constructor(storage=window.localStorage){this.storage=storage;}
    get(key,fallback=null){try{const value=this.storage.getItem(key);return value===null?fallback:JSON.parse(value);}catch{return fallback;}}
    set(key,value){this.storage.setItem(key,JSON.stringify(value));return value;}
    remove(key){this.storage.removeItem(key);}
  }

  class FavoriteService{
    constructor({key,legacyKey=null,storage=new StorageRepository()}={}){this.key=key;this.legacyKey=legacyKey;this.storage=storage;}
    list(){
      const stored=this.storage.get(this.key,null);
      if(Array.isArray(stored))return unique(stored);
      if(this.legacyKey){const legacy=this.storage.get(this.legacyKey,null);if(legacy){const migrated=[String(legacy)];this.replace(migrated);this.storage.remove(this.legacyKey);return migrated;}}
      return [];
    }
    replace(ids){return this.storage.set(this.key,unique(ids));}
    has(id){return this.list().includes(String(id));}
    add(id){return this.replace([...this.list(),String(id)]);}
    remove(id){return this.replace(this.list().filter(value=>value!==String(id)));}
    toggle(id){const added=!this.has(id);added?this.add(id):this.remove(id);return added;}
    clear(){this.storage.remove(this.key);}
  }

  class PageTabs{
    constructor({root,pageSelector='.page-view',activeClass='active',attribute='page',initial='home'}={}){Object.assign(this,{root,pageSelector,activeClass,attribute});this.current=initial;this.bound=false;}
    show(page){this.current=page;document.querySelectorAll(this.pageSelector).forEach(node=>node.classList.toggle(this.activeClass,node.id===`page-${page}`));this.root?.querySelectorAll(`[data-${this.attribute}]`).forEach(button=>button.classList.toggle(this.activeClass,button.dataset[this.attribute]===page));return page;}
    bind(onChange){if(this.bound)return;this.bound=true;this.root?.addEventListener('click',event=>{const button=event.target.closest(`[data-${this.attribute}]`);if(!button)return;this.show(button.dataset[this.attribute]);onChange?.(this.current);});}
  }

  class EmptyState{
    static render(title,description=''){return `<div class="empty-state"><strong>${escapeHtml(title)}</strong>${description?`<p>${escapeHtml(description)}</p>`:''}</div>`;}
    static set(root,title,description=''){if(root)root.innerHTML=this.render(title,description);}
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
  }

  class SearchService{
    constructor(items=[],fields=[]){this.items=asArray(items);this.fields=fields;}
    search(query){const needle=String(query??'').trim().toLocaleLowerCase('ja');if(!needle)return [...this.items];return this.items.filter(item=>this.fields.some(field=>String(typeof field==='function'?field(item):item?.[field]??'').toLocaleLowerCase('ja').includes(needle)));}
  }

  class StandingService{
    constructor(rows=[]){this.rows=asArray(rows);}
    all(){return [...this.rows].sort((a,b)=>(a.rank??999)-(b.rank??999));}
    top(limit=5){return this.all().slice(0,limit);}
    byCompetition(id){return this.all().filter(row=>String(row.league??row.competition??'')===String(id));}
  }

  Object.assign(ns,{JsonRepository,StorageRepository,FavoriteService,PageTabs,EmptyState,MatchModel,MatchService,SearchService,StandingService,escapeHtml});
})(window.FootballCore);