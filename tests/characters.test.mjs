import assert from 'node:assert/strict';
import fs from 'node:fs';
import {explorerFrame,drawExplorer,EXPLORERS,EXPLORER_ATLASES,NPC_ATLASES,PROFESSOR_PICTURE,CHARACTER_SIZE} from '../dist/characters.js';
import {SHEET,SHEET_KEYS,PICTURE_KEYS,PICTURE_SIZE} from '../dist/character-sheets.js';
import {MOVE_DURATION,moveView,strideFrame,stepProgress} from '../dist/movement.js';
import {ACTOR_IDS,MAP_PALETTE,createActorFrame,cleanSourceFrame} from '../dist/pixel-art.js';
assert.equal(CHARACTER_SIZE,48);
assert.equal(Object.values(EXPLORER_ATLASES).flatMap(a=>a.frames.flat()).length,30);
// v0.54 Aseprite 시트: 파일 크기가 칸 규칙(32×40 × 5칸 × 3줄, 큰 그림 128×128)과 맞아야 해요.
const pngSize=key=>{const b=fs.readFileSync(new URL('../dist/assets/'+key+'.png',import.meta.url));assert.equal(b.subarray(1,4).toString(),'PNG',key);return [b.readUInt32BE(16),b.readUInt32BE(20)];};
for(const [id,key] of Object.entries(SHEET_KEYS))assert.deepEqual(pngSize(key),[SHEET.cell[0]*SHEET.cols,SHEET.cell[1]*SHEET.rows.length],`${id}: 시트는 160×120`);
for(const [id,key] of Object.entries(PICTURE_KEYS))assert.deepEqual(pngSize(key),[PICTURE_SIZE,PICTURE_SIZE],`${id}: 큰 그림은 128×128`);
assert.deepEqual(EXPLORERS.map(e=>e.sheet).sort(),[SHEET_KEYS.boy,SHEET_KEYS.girl].sort());assert.equal(NPC_ATLASES.professor.key,SHEET_KEYS.professor);assert.equal(PROFESSOR_PICTURE,PICTURE_KEYS.professor);
assert.equal(stepProgress(473.638213,693.6382129999999),1);
for(const id of ['girl','boy'])for(const dir of ['down','left','right','up']){
 const poses=[0,16,32,48].map(d=>explorerFrame(id,dir,true,d));
 assert.deepEqual(poses.map(p=>p.col),[1,2,3,4]);assert.equal(explorerFrame(id,dir,false,48).col,0);
 assert.deepEqual(explorerFrame(id,dir,false,48),explorerFrame(id,dir,false,0),'stopped pose must not depend on the last walking frame');
 assert.deepEqual(explorerFrame(id,dir,true,0),explorerFrame(id,dir,true,64));
 assert.equal(poses[0].flip,dir==='left');
 for(const f of [...poses,explorerFrame(id,dir,false)]){
  const [x,y,w,h]=f.rect,[ax,ay]=f.anchor;
  const A=EXPLORER_ATLASES[id];assert.ok(w>0&&h>0&&x>=0&&y>=0&&x+w<=A.width&&y+h<=A.height);
  assert.ok(ax>=x&&ax<=x+w&&ay>=y&&ay<=y+h,'anchor belongs to its own frame');
 }
}
assert.notEqual(EXPLORER_ATLASES.boy.key,EXPLORER_ATLASES.girl.key,'남학생과 여학생은 각자 시트');
// The actual renderer samples one complete artwork frame; there is no procedural arm/leg patching.
globalThis.Image=class {set src(v){this.naturalWidth=160;this.naturalHeight=120;this.onload();}};
const calls=[];const ctx=new Proxy({},{get:(o,k)=>o[k]||((...args)=>calls.push([k,...args])),set:(o,k,v)=>(o[k]=v,true)});
for(const dir of ['left','right','up','down']){
 calls.length=0;assert.equal(drawExplorer(ctx,'girl',0,0,256,dir,true,32),true);
 const samples=calls.filter(c=>c[0]==='drawImage');assert.equal(samples.length,1);
 assert.deepEqual(samples[0].slice(2,6),explorerFrame('girl',dir,true,32).rect);
 assert.equal(calls.some(c=>c[0]==='scale'&&c[1]===-1),dir==='left');
}
for(const interval of [1000/30,1000/60,1000/144]){
 const v={x:9,y:21},step={fromX:9,fromY:21,toX:10,toY:21,start:0};let distance=0;
 for(let t=0;t<MOVE_DURATION;t+=interval)distance+=moveView(v,step,t).distance;
 distance+=moveView(v,step,MOVE_DURATION).distance;assert.ok(Math.abs(distance-32)<1e-9);assert.equal(strideFrame(distance),2);
 assert.equal(moveView(v,step,MOVE_DURATION+100).distance,0);
}
const heads=Object.fromEntries(['down','up','right','blink'].map(d=>[d,new Uint8ClampedArray(4096)]));
const palette=new Set(Object.values(MAP_PALETTE).map(h=>h.toLowerCase()));
for(const id of ACTOR_IDS.filter(id=>!['girl','boy'].includes(id)))for(const dir of ['down','left','right','up']){
 const poses=Array.from({length:5},(_,p)=>createActorFrame(heads,id,dir,p));
 for(const f of poses){
  let bottom=-1;
  for(let n=0;n<1024;n++)if(f[n*4+3]){bottom=Math.max(bottom,Math.floor(n/32));assert.equal(f[n*4+3],255);assert.ok(palette.has('#'+[...f.slice(n*4,n*4+3)].map(v=>v.toString(16).padStart(2,'0')).join('')));}
  assert.equal(bottom,29,`${id}/${dir}: a planted foot must stay at baseline 29`);
 }
 assert.notDeepEqual(poses[1],poses[3],`${id}/${dir}: two opposite steps`);
 assert.notDeepEqual(poses[2],poses[4],`${id}/${dir}: separate passing poses`);
}
const white=new Uint8ClampedArray(4096).fill(255);for(let y=5;y<15;y++)for(let x=5;x<15;x++)white.set([20,20,20,255],(y*32+x)*4);
white.set([255,255,255,255],(10*32+10)*4);const clean=cleanSourceFrame(white);
assert.equal(clean[3],0);assert.equal(clean[(10*32+10)*4+3],255,'interior eye whites survive');
console.log('PASS: 30 sprite frames, atlas bounds, aligned anchors, 4-step playback, full-frame mirroring, idle, resident rendering and movement sync.');
