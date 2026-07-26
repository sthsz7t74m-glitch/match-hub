import fs from 'node:fs/promises';

const cssFiles=[
  'styles.css','detail.css','transfers.css',
  'v05.css','v051.css','v064.css','v065.css','v070.css','v072.css',
  'v080.css','v090.css','v100.css','v101.css','v102.css','v103.css'
];
const jsFiles=[
  'app.js','jp-teams.js','transfers.js',
  'v064.js','v065.js','v072.js','v074.js','v080.js','v081.js',
  'v090.js','v100.js','v101.js'
];
const cssTarget='assets/css/five-league-page.css';
const jsTarget='assets/js/five-league-page.js';

async function existing(paths){
  const result=[];
  for(const path of paths){
    try{await fs.access(path);result.push(path);}catch{}
  }
  return result;
}

async function bundle(paths,target,type){
  const files=await existing(paths);
  const chunks=[];
  for(const path of files){
    const content=await fs.readFile(path,'utf8');
    const marker=type==='css'?`/* ===== ${path} ===== */`:`// ===== ${path} =====`;
    chunks.push(`${marker}\n${content.trim()}\n`);
  }
  await fs.mkdir(target.slice(0,target.lastIndexOf('/')),{recursive:true});
  await fs.writeFile(target,`${chunks.join('\n')}\n`);
  return files;
}

const bundledCss=await bundle(cssFiles,cssTarget,'css');
const bundledJs=await bundle(jsFiles,jsTarget,'js');
let html=await fs.readFile('index.html','utf8');

for(const file of cssFiles){
  const escaped=file.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  html=html.replace(new RegExp(`\\s*<link[^>]+href=["']\\./${escaped}(?:\\?[^"']*)?["'][^>]*>`,`g'),'');
}
for(const file of jsFiles){
  const escaped=file.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  html=html.replace(new RegExp(`\\s*<script[^>]+src=["']\\./${escaped}(?:\\?[^"']*)?["'][^>]*><\\/script>`,`g'),'');
}

const cssAnchor='<link rel="stylesheet" href="./assets/css/match-components.css';
const cssIndex=html.indexOf(cssAnchor);
if(cssIndex>=0){
  html=`${html.slice(0,cssIndex)}  <link rel="stylesheet" href="./assets/css/five-league-page.css?v=108">\n${html.slice(cssIndex)}`;
}

const jsAnchor='<script src="./assets/js/match-components.js';
const jsIndex=html.indexOf(jsAnchor);
if(jsIndex>=0){
  const end=html.indexOf('</script>',jsIndex)+9;
  html=`${html.slice(0,end)}\n  <script src="./assets/js/five-league-page.js?v=108" defer></script>${html.slice(end)}`;
}

html=html
  .replace(/v1\.0\.\d+/g,'v1.0.8')
  .replace(/\?v=10\d/g,'?v=108');

await fs.writeFile('index.html',html);
for(const path of [...bundledCss,...bundledJs])await fs.unlink(path);

console.log(`Bundled ${bundledCss.length} CSS files into ${cssTarget}.`);
console.log(`Bundled ${bundledJs.length} JS files into ${jsTarget}.`);
