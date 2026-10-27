import assert from 'node:assert/strict';
import fs from 'node:fs';
import {npcs,BUILDINGS,PROP_KINDS} from '../dist/world.js';
import {MAPS} from '../dist/maps.js';
import {EXPLORERS,RESIDENTS,PROFESSOR_PICTURE} from '../dist/characters.js';
import {ISLAND_ATLAS} from '../dist/island-atlas.js';
import {drawMonster} from '../dist/sprites.js';
import {drawAsset,onAssetReady,monsterAssetKey,assetStatus,preloadMonsters} from '../dist/assets.js';
import {TERRAIN_ATLAS} from '../dist/terrain-atlas.js';
import {SCENERY_ATLAS} from '../dist/scenery-atlas.js';
import {drawScenery} from '../dist/scenery.js';
const images=[];
globalThis.Image=class {constructor(){images.push(this);}set src(v){this.url=v;}get src(){return this.url;}};
let notices=0;onAssetReady(()=>notices++);
const calls=[];const ctx=new Proxy({},{get:(o,k)=>o[k]||((...args)=>calls.push([k,...args])),set:(o,k,v)=>(o[k]=v,true)});
drawMonster(ctx,1,0,0,128);assert.equal(calls.filter(c=>c[0]==='fillRect').length,3,'pending image only draws three neutral dots');assert.ok(!calls.some(c=>c[0]==='translate'),'retired art is never drawn while pending');assert.equal(assetStatus(monsterAssetKey(1)),'loading');
assert.equal(images[0].src,'assets/monsters/001.png');
images[0].naturalWidth=256;images[0].naturalHeight=128;images[0].onload();calls.length=0;
drawMonster(ctx,1,0,0,128);assert.equal(notices,1);assert.ok(calls.some(c=>c[0]==='drawImage'&&c[1]===images[0]&&c[2]===0&&c[3]===32&&c[4]===128&&c[5]===64),'custom PNG is rendered with aspect ratio preserved');assert.ok(!calls.some(c=>c[0]==='fillRect'));
drawMonster(ctx,2,0,0,128);images.at(-1).onerror();calls.length=0;drawMonster(ctx,2,0,0,128);assert.equal(calls.filter(c=>c[0]==='fillRect').length,3,'missing image shows a neutral status marker');assert.ok(!calls.some(c=>c[0]==='translate'));assert.equal(assetStatus(monsterAssetKey(2)),'failed');assert.equal(notices,2,'failure also repaints static portraits');
globalThis.DOKDOMON_EMBEDDED_ASSETS={'monsters/003':'data:image/png;base64,example'};drawAsset(ctx,'monsters/003',0,0,128);assert.equal(images.at(-1).src,globalThis.DOKDOMON_EMBEDDED_ASSETS['monsters/003']);
const keys=[];for(let id=1;id<=100;id++)keys.push(monsterAssetKey(id),monsterAssetKey(id,true));
for(const dir of ['down','up','left','right'])for(let step=0;step<2;step++)keys.push(`player/${dir}-${step}`);
for(const def of MAPS)for(const n of npcs(def.id,{enemy:false}))if(!['board','wild',...PROP_KINDS].includes(n.kind)&&!n.actor)keys.push(n.sprite);
keys.push(TERRAIN_ATLAS.key,SCENERY_ATLAS.key,SCENERY_ATLAS.monument.key);keys.push(...EXPLORERS.flatMap(p=>[p.sheet,p.picture]),PROFESSOR_PICTURE,ISLAND_ATLAS.key,...RESIDENTS.map(p=>p.sheet));assert.equal(new Set(keys).size,228);
for(const k of ['lab','gym','shop','home'])for(const isl of ['ulleung','dokdo']){const [,,w,h]=ISLAND_ATLAS.frames[`${isl}-${k}`];assert.equal(w,(k==='gym'?7:5)*32+16,`${isl} ${k}: plot + eaves wide`);assert.equal(h,(k==='gym'?5:4)*32+40);}
for(const f of Object.values(ISLAND_ATLAS.frames)){const [x,y,w,h]=f;assert.ok(x>=0&&y>=0&&x+w<=ISLAND_ATLAS.width&&y+h<=ISLAND_ATLAS.height);}
for(const key of keys){const jpg=key.endsWith('.jpg');const bytes=fs.readFileSync(new URL('../dist/assets/'+key+(jpg?'':'.png'),import.meta.url));if(jpg){assert.equal(bytes.readUInt16BE(0),0xffd8);}else{assert.equal(bytes.subarray(1,4).toString(),'PNG');assert.ok(bytes.readUInt32BE(16)>0);assert.ok(bytes.readUInt32BE(20)>0);}}
const count=images.length;preloadMonsters([1,1,4]);assert.equal(images.length,count+3,'preload reuses cached front and deduplicates IDs');
assert.ok(images.some(i=>i.src==='assets/monsters/back/004.png'));
for(const rect of Object.values(SCENERY_ATLAS.frames)){const [x,y,w,h]=rect;assert.ok(x>=0&&y>=0&&w>0&&h>0&&x+w<=SCENERY_ATLAS.width&&y+h<=SCENERY_ATLAS.height);}
calls.length=0;drawScenery(ctx,'lab',0,0,200,150);const scenery=images.at(-1);scenery.naturalWidth=SCENERY_ATLAS.width;scenery.naturalHeight=SCENERY_ATLAS.height;scenery.onload();calls.length=0;drawScenery(ctx,'lab',0,0,200,150);assert.equal(calls.filter(c=>c[0]==='drawImage').length,1);assert.deepEqual(calls.find(c=>c[0]==='drawImage').slice(2,6),SCENERY_ATLAS.frames.lab);
console.log('PASS: 224 active assets (6 new 백무단 sheets); no old-art flash while loading or failed; load/error repaint; front/back preload cache; embedded images; scenery crops.');
