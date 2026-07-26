window.SportsHub={
  storage:{
    get(key,fallback=null){try{const value=localStorage.getItem(key);return value===null?fallback:JSON.parse(value);}catch{return fallback;}},
    set(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{return false;}},
    remove(key){try{localStorage.removeItem(key);return true;}catch{return false;}}
  },
  applyTheme(buttonSelector='#themeButton'){
    const key='sportsHubTheme';
    const saved=localStorage.getItem(key);
    document.body.classList.toggle('light',saved==='light');
    const button=document.querySelector(buttonSelector);
    if(!button)return;
    const sync=()=>{button.textContent=document.body.classList.contains('light')?'☀':'◐';button.setAttribute('aria-pressed',String(document.body.classList.contains('light')));};
    sync();
    button.addEventListener('click',()=>{document.body.classList.toggle('light');localStorage.setItem(key,document.body.classList.contains('light')?'light':'dark');sync();});
  },
  toast(message,duration=1800){
    const node=document.querySelector('#toast');
    if(!node)return;
    node.textContent=message;
    node.classList.add('show');
    clearTimeout(window.SportsHub._toastTimer);
    window.SportsHub._toastTimer=setTimeout(()=>node.classList.remove('show'),duration);
  }
};