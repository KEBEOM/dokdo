// Rebuild only code-native monster art; preserve the three supplied starter PNGs.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {MONSTERS,STARTERS} from '../dist/data.js';
import {drawMonsterDefault} from '../dist/sprites.js';
const require=createRequire(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/package.json');
const {createCanvas,loadImage}=require('@napi-rs/canvas');
const out=path.resolve('dist/assets');
for(const m of MONSTERS){
  if(STARTERS.includes(m.id))continue;
  for(const back of [false,true]){
    const c=createCanvas(128,128);c.getContext('2d').imageSmoothingEnabled=false;
    drawMonsterDefault(c.getContext('2d'),m.id,0,0,128,0,back);
    fs.writeFileSync(path.join(out,'monsters',back?'back':'',String(m.id).padStart(3,'0')+'.png'),c.toBuffer('image/png'));
  }
}
const sheet=createCanvas(1000,1400),ctx=sheet.getContext('2d');
ctx.fillStyle='#edf1df';ctx.fillRect(0,0,1000,1400);ctx.imageSmoothingEnabled=false;
for(const m of MONSTERS){
 const key=String(m.id).padStart(3,'0'),im=await loadImage(path.join(out,'monsters',key+'.png'));
 const x=((m.id-1)%10)*100,y=Math.floor((m.id-1)/10)*140;
 ctx.drawImage(im,x+2,y+3,96,96);ctx.fillStyle='#244b50';ctx.font='bold 13px sans-serif';ctx.textAlign='center';ctx.fillText('NO. '+key,x+50,y+118,96);
}
fs.writeFileSync(path.join(out,'monster-contact-sheet.png'),sheet.toBuffer('image/png'));
console.log('Rebuilt 97 code-native species and 100-species contact sheet. Starter art preserved.');
