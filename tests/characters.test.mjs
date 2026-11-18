import assert from 'node:assert/strict';
import fs from 'node:fs';
import {explorerFrame,drawExplorer,EXPLORERS,NPC_ATLASES,PROFESSOR_PICTURE,CHARACTER_SIZE,EXPLORER_V2,walk5Frame,WALK5_PIXELS} from '../dist/characters.js';
import {V2_CHARACTERS} from '../dist/tileset-v2.js';
import {MOVE_DURATION,moveView,strideFrame,stepProgress} from '../dist/movement.js';
import {ACTOR_IDS,MAP_PALETTE,createActorFrame,cleanSourceFrame} from '../dist/pixel-art.js';
assert.equal(CHARACTER_SIZE,48);
// v0.72: 캐릭터마다 걷기 시트 1장 + 큰 그림 1장
const pngSize=key=>{const b=fs.readFileSync(new URL('../dist/assets/'+key+'.png',import.meta.url));assert.equal(b.subarray(1,4).toString(),'PNG',key);return [b.readUInt32BE(16),b.readUInt32BE(20)];};
assert.deepEqual(EXPLORERS.map(e=>e.sheet),['characters/explorers-v2-64x72','characters/explorers-v2-64x72'],'주인공 걷기 시트는 한 장');for(const e of EXPLORERS)assert.deepEqual(pngSize(e.sheet).length,2);assert.deepEqual(pngSize('characters/explorers-v2-64x72'),[320,432]);for(const k of [...EXPLORERS.map(e=>e.picture),PROFESSOR_PICTURE])pngSize(k);assert.ok(!fs.existsSync(new URL('../dist/assets/characters/sheets',import.meta.url)),'고쳐 쓰는 시트 폴더는 없어요');
assert.equal(NPC_ATLASES.professor.key,'characters/professor-atlas-v33');
assert.equal(stepProgress(473.638213,693.6382129999999),1);
for(const id of ['girl','boy'])for(const dir of ['down','left','right','up']){
 // v0.67 타일셋 v2: 걷기는 5장(0→4)을 16픽셀마다 한 장씩, 80픽셀마다 처음으로
 const poses=[0,16,32,48,64].map(d=>explorerFrame(id,dir,true,d));
 assert.deepEqual(poses.map(p=>p.col),[0,1,2,3,4]);assert.equal(explorerFrame(id,dir,false,48).col,0);
 assert.deepEqual(explorerFrame(id,dir,false,48),explorerFrame(id,dir,false,0),'stopped pose must not depend on the last walking frame');
 assert.deepEqual(explorerFrame(id,dir,true,8),explorerFrame(id,dir,true,8+WALK5_PIXELS*5));
 assert.equal(poses[0].row,V2_CHARACTERS.rows[id][dir==='left'?'right':dir]-(id==='girl'?3:0),'남학생 0~2행, 여학생 3~5행(각자의 아틀라스에서 아래·오른쪽·위)');
 assert.equal(poses[0].flip,dir==='left');
 for(const f of [...poses,explorerFrame(id,dir,false)]){
  const [x,y,w,h]=f.rect,[ax,ay]=f.anchor;
  const A=EXPLORER_V2[id];assert.ok(w===64&&h===72&&x%64===0&&y%72===0&&x+w<=A.width&&y+h<=A.height,'64×72 정규화 칸 하나');
  assert.deepEqual([ax-x,ay-y],V2_CHARACTERS.foot,'발끝 기준점(32, 68)');
 }
}

// The actual renderer samples one complete artwork frame; there is no procedural arm/leg patching.
globalThis.Image=class {set src(v){this.naturalWidth=320;this.naturalHeight=432;this.onload();}};
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
console.log('PASS: 30 sprite frames, atlas bounds, aligned anchors, 5-frame walk (tileset v2 64×72), full-frame mirroring, idle, resident rendering and movement sync.');

// v0.67: 5장 걷기 순서와 정규화 아틀라스의 실제 그림 크기
assert.deepEqual([0,15,16,31,32,63,64,79,80,-1].map(walk5Frame),[0,0,1,1,2,3,4,4,0,4]);
assert.equal(EXPLORER_V2.boy.width,320);assert.equal(EXPLORER_V2.girl.height,432);assert.notDeepEqual(EXPLORER_V2.boy.frames[0][0].rect,EXPLORER_V2.girl.frames[0][0].rect);
console.log('PASS: tileset v2 explorers — 5 frames per direction, feet at (32, 68), boy rows 0–2, girl rows 3–5.');
