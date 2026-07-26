import fs from 'node:fs/promises';

const cssFiles=[
  'v05.css','v051.css','v064.css','v065.css','v070.css','v072.css',
  'v080.css','v090.css','v100.css','v101.css','v102.css','v103.css'
];
const jsFiles=[
  'v064.js','v065.js','v072.js','v074.js','v080.js','v081.js',
  'v090.js','v100.js','v101.js'
];

async function existing(paths){
  const result=[];
  for(const path of paths){
    try{await fs.access(path);result.push(path);}catch{}
  }
  return result;
}

async function bundle(paths,target,commentStyle){
  const files=await existing(paths);
  const chunks=[];
  for(const path of files){
    const content=await fs.readFile(path,'utf8');
    const marker=commentStyle==='css'?`/* ===== ${path} ===== */`:`// ===== ${path} =====`;
    chunks.push(`${marker}\n${content.trim()}\n`);
  }
  await fs.writeFile(target,`${chunks.join('\n')}\n`);
  return files;
}

const bundledCss=await bundle(cssFiles,'legacy-features.css','css');
const bundledJs=await bundle(jsFiles,'legacy-features.js','js');

let html=await fs.readFile('index.html','utf8');
for(const file of cssFiles){
  html=html.replace(new RegExp(`\\s*<link[^>]+href=["']\\./${file.replace('.','\\.')}[^"']*["'][^>]*>`,`g'),'');
}
for(const file of jsFiles){
  html=html.replace(new RegExp(`\\s*<script[^>]+src=["']\\./${file.replace('.','\\.')}[^"']*["'][^>]*><\\/script>`,`g'),'');
}

const cssAnchor='<link rel="stylesheet" href="./transfers.css';
const cssIndex=html.indexOf(cssAnchor);
if(cssIndex>=0){
  const end=html.indexOf('>',cssIndex)+1;
  html=`${html.slice(0,end)}\n  <link rel="stylesheet" href="./legacy-features.css?v=106">${html.slice(end)}`;
}

const jsAnchor='<script src="./transfers.js';
const jsIndex=html.indexOf(jsAnchor);
if(jsIndex>=0){
  const end=html.indexOf('</script>',jsIndex)+9;
  html=`${html.slice(0,end)}\n  <script src="./legacy-features.js?v=106" defer></script>${html.slice(end)}`;
}

html=html
  .replace(/v1\.0\.6/g,'v1.0.7')
  .replace(/\?v=106/g,'?v=107');

await fs.writeFile('index.html',html);
for(const path of [...bundledCss,...bundledJs])await fs.unlink(path);

// One-shot migration: remove its own workflow and script after successful generation.
await fs.unlink('.github/workflows/consolidate-legacy-assets.yml').catch(()=>{});
await fs.unlink('scripts/consolidate-legacy-assets.mjs').catch(()=>{});

console.log(`Bundled ${bundledCss.length} CSS files and ${bundledJs.length} JS files.`);
