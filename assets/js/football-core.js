window.FootballCore=window.FootballCore||{};
(function(ns){
  const Repositories=window.FootballRepositories||{};
  const Services=window.FootballServices||{};
  const escapeHtml=value=>String(value??'').replace(/[&<>"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[char]));

  class PageTabs{
    constructor({root,pageSelector='.page-view',activeClass='active',attribute='page',initial='home'}={}){Object.assign(this,{root,pageSelector,activeClass,attribute});this.current=initial;this.bound=false;}
    show(page){this.current=page;document.querySelectorAll(this.pageSelector).forEach(node=>node.classList.toggle(this.activeClass,node.id===`page-${page}`));this.root?.querySelectorAll(`[data-${this.attribute}]`).forEach(button=>button.classList.toggle(this.activeClass,button.dataset[this.attribute]===page));document.dispatchEvent(new CustomEvent('football:page-change',{detail:{page}}));return page;}
    bind(onChange){if(this.bound)return;this.bound=true;this.root?.addEventListener('click',event=>{const button=event.target.closest(`[data-${this.attribute}]`);if(!button)return;this.show(button.dataset[this.attribute]);onChange?.(this.current);});}
  }

  class EmptyState{
    static render(title,description=''){return `<div class="empty-state"><strong>${escapeHtml(title)}</strong>${description?`<p>${escapeHtml(description)}</p>`:''}</div>`;}
    static set(root,title,description=''){if(root)root.innerHTML=this.render(title,description);}
  }

  const required={
    JsonRepository:Repositories.JsonRepository,
    StorageRepository:Repositories.StorageRepository,
    FavoriteRepository:Repositories.FavoriteRepository,
    SettingsRepository:Repositories.SettingsRepository,
    FavoriteService:Services.FavoriteService,
    MatchModel:Services.MatchModel,
    MatchService:Services.MatchService,
    SearchService:Services.SearchService,
    StandingService:Services.StandingService
  };

  Object.entries(required).forEach(([name,value])=>{if(value)ns[name]=value;});
  Object.assign(ns,{PageTabs,EmptyState,escapeHtml});

  if(!ns.FavoriteService&&ns.FavoriteRepository){
    ns.FavoriteService=class{
      constructor(options={}){this.repository=options instanceof ns.FavoriteRepository?options:new ns.FavoriteRepository(options);}
      list(){return this.repository.list();}
      has(id){return this.repository.has(id);}
      add(id){this.repository.add(id);return true;}
      remove(id){this.repository.remove(id);return false;}
      toggle(id){return this.has(id)?this.remove(id):this.add(id);}
      clear(){this.repository.clear();}
    };
  }
})(window.FootballCore);