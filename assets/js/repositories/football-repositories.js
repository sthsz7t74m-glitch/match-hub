window.FootballRepositories=window.FootballRepositories||{};
(function(ns){
  const asArray=value=>Array.isArray(value)?value:[];
  const unique=values=>[...new Set(asArray(values).map(String).filter(Boolean))];

  class JsonRepository{
    constructor(path,{cache=true}={}){this.path=path;this.cacheEnabled=cache;this.cache=null;this.pending=null;}
    async get({fresh=false}={}){
      if(this.cacheEnabled&&this.cache&&!fresh)return this.cache;
      if(this.pending&&!fresh)return this.pending;
      const separator=this.path.includes('?')?'&':'?';
      this.pending=fetch(`${this.path}${separator}v=${Date.now()}`,{cache:'no-store'})
        .then(response=>{if(!response.ok)throw new Error(`HTTP ${response.status}: ${this.path}`);return response.json();})
        .then(data=>{if(this.cacheEnabled)this.cache=data;return data;})
        .finally(()=>{this.pending=null;});
      return this.pending;
    }
    clear(){this.cache=null;this.pending=null;}
  }

  class StorageRepository{
    constructor(storage=window.localStorage){this.storage=storage;}
    get(key,fallback=null){try{const raw=this.storage.getItem(key);return raw===null?fallback:JSON.parse(raw);}catch{return fallback;}}
    set(key,value){this.storage.setItem(key,JSON.stringify(value));return value;}
    remove(key){this.storage.removeItem(key);}
    has(key){return this.storage.getItem(key)!==null;}
  }

  class FavoriteRepository{
    constructor({key,legacyKey=null,storage=new StorageRepository()}={}){this.key=key;this.legacyKey=legacyKey;this.storage=storage;}
    list(){
      const stored=this.storage.get(this.key,null);
      if(Array.isArray(stored))return unique(stored);
      if(this.legacyKey){
        const legacy=this.storage.get(this.legacyKey,null);
        if(legacy){const migrated=[String(legacy)];this.replace(migrated);this.storage.remove(this.legacyKey);return migrated;}
      }
      return [];
    }
    replace(ids){return this.storage.set(this.key,unique(ids));}
    add(id){return this.replace([...this.list(),String(id)]);}
    remove(id){return this.replace(this.list().filter(value=>value!==String(id)));}
    has(id){return this.list().includes(String(id));}
    clear(){this.storage.remove(this.key);}
  }

  class SettingsRepository{
    constructor({prefix='football',storage=new StorageRepository()}={}){this.prefix=prefix;this.storage=storage;}
    key(name){return `${this.prefix}:${name}`;}
    get(name,fallback=null){return this.storage.get(this.key(name),fallback);}
    set(name,value){return this.storage.set(this.key(name),value);}
    remove(name){this.storage.remove(this.key(name));}
  }

  Object.assign(ns,{JsonRepository,StorageRepository,FavoriteRepository,SettingsRepository});
})(window.FootballRepositories);