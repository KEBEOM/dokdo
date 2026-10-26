import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {ACTOR_IDS,cleanSourceFrame,createActorFrame,mapColor} from '../dist/pixel-art.js';
const req=createRequire(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/package.json':import.meta.url);
const {createCanvas,loadImage}=req('@napi-rs/canvas');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../dist'),sheets={};
// Explorer artwork is used directly from the uploaded JPGs, never reconstructed.
for(const id of ACTOR_IDS.filter(id=>!['girl','boy'].includes(id))){
  const image=await loadImage(path.join(root,'assets/characters/'+id+'-sheet.png'));
  const cell=createCanvas(32,32),ctx=cell.getContext('2d');ctx.imageSmoothingEnabled=false;
  const heads={};
  for(const [direction,col,row] of [['down',0,0],['right',0,2],['up',0,3],['blink',2,0]]){
    ctx.clearRect(0,0,32,32);ctx.drawImage(image,col*image.width/4,row*image.height/4,image.width/4,image.height/4,0,0,32,32);
    heads[direction]=cleanSourceFrame(ctx.getImageData(0,0,32,32).data);
  }
  const atlas=createCanvas(160,160),a=atlas.getContext('2d');
  for(const [row,dir] of ['down','left','right','up'].entries())for(let pose=0;pose<5;pose++){
    const f=a.createImageData(32,32);f.data.set(createActorFrame(heads,id,dir,pose));a.putImageData(f,pose*32,row*32);
  }
  const blink=a.createImageData(32,32);blink.data.set(createActorFrame(heads,id,'down',0,true));a.putImageData(blink,0,128);
  const bytes=atlas.toBuffer('image/png'),key='characters/'+id+'-game';fs.writeFileSync(path.join(root,'assets/'+key+'.png'),bytes);sheets[key]='data:image/png;base64,'+bytes.toString('base64');
  console.log(id,bytes.length+' bytes');
}
for(const id of ['girl','boy']){
  const key='characters/'+id+'-original.jpg';
  sheets[key]='data:image/jpeg;base64,'+fs.readFileSync(path.join(root,'assets',key)).toString('base64');
}
fs.writeFileSync(path.join(root,'player-art.js'),'// Original explorer JPGs and compact resident atlases.\nexport const PLAYER_SHEETS='+JSON.stringify(sheets)+';\n');
// Existing story NPCs use the same palette; retain their hats, uniforms and file keys.
if(process.argv.includes('--match-npcs'))for(const region of fs.readdirSync(path.join(root,'assets/npc'))){
  const dir=path.join(root,'assets/npc',region);
  for(const name of fs.readdirSync(dir))if(name.endsWith('.png')){
    const p=path.join(dir,name),img=await loadImage(p),canvas=createCanvas(img.width,img.height),c=canvas.getContext('2d');c.drawImage(img,0,0);
    const frame=c.getImageData(0,0,img.width,img.height);
    for(let i=0;i<frame.data.length;i+=4)if(frame.data[i+3]>180)frame.data.set(mapColor(frame.data[i],frame.data[i+1],frame.data[i+2]),i);
    c.putImageData(frame,0,0);fs.writeFileSync(p,canvas.toBuffer('image/png'));
  }
}
