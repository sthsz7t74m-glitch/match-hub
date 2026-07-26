window.FootballCore=window.FootballCore||{};
(function(ns){
  const asArray=value=>Array.isArray(value)?value:[];
  const unique=values=>[...new Set(asArray(values).map(String).filter(Boolean))];

  class JsonRepository{
    constructor(path){this.path=path;this.cache=null;}
    async get({fresh=false}={}){
      if(this.cache&&!fresh)return this.cache;
      const separator=this.path.includes('?')?'&':'?';
      const response=await fetch(`${this.path}${separator}v=${Date.now()}`,{cache:'no-store'});
      if(!response.ok)throw new Error(`HTTP ${response.status}: ${this.path}`);
      this.cache=await response.json();
      return this.cache;
    }
    clear(){this.cache=null;}
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
    toggle(id){return this.has(id)?(this.remove(id),false):(this.add(id),true);}
    clear(){this.storage.remove(this.key);}
  }

  class PageTabs{
    constructor({root,pageSelector='.page-view',activeClass='active',attribute='page'}={}){Object.assign(this,{root,pageSelector,activeClass,attribute});this.current='home';}
    show(page){this.current=page;document.querySelectorAll(this.pageSelector).forEach(node=>node.classList.toggle(this.activeClass,node.id===`page-${page}`));this.root?.querySelectorAll(`[data-${this.attribute}]`).forEach(button=>button.classList.toggle(this.activeClass,button.dataset[this.attribute]===page));}
    bind(onChange){this.root?.addEventListener('click',event=>{const button=event.target.closest(`[data-${this.attribute}]`);if(!button)return;this.show(button.dataset[this.attribute]);onChange?.(this.current);});}
  }

  class EmptyState{
    static render(title,description=''){return `<div class="empty-state"><strong>${title}</strong>${description?`<p>${description}</p>`:''}</div>`;}
  }

  class MatchModel{
    constructor(raw={}){Object.assign(this,raw);this.id=String(raw.id??raw.uid??'');this.date=raw.date??raw.kickoff??raw.startTime??null;this.home=raw.home??raw.homeTeam??null;this.away=raw.away??raw.awayTeam??null;}
    get dateKey(){if(!this.date)return'';const date=new Date(this.date);if(Number.isNaN(date.getTime()))return'';const pad=value=>String(value).padStart(2,'0');return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;}
  }

  ns.JsonRepository=JsonRepository;
  ns.StorageRepository=StorageRepository;
  ns.FavoriteService=FavoriteService;
  ns.PageTabs=PageTabs;
  ns.EmptyState=EmptyState;
  ns.MatchModel=MatchModel;
})(window.FootballCore);