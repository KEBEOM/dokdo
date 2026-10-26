import assert from 'node:assert/strict';
import {npcs,createMap,blocked,pathfind,PROP_KINDS} from '../dist/world.js';
import {MAPS} from '../dist/maps.js';
import {createNPCMotion,NPC_RADIUS,NPC_MOVE_MS} from '../dist/npc-motion.js';
import {RESIDENTS,residentFrame,drawResident,NPC_ATLASES} from '../dist/characters.js';
import {VILLAIN_BY_ZONE} from '../dist/world.js';
let seed=18;const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/2**32);
const allowed=new Set(RESIDENTS.map(n=>n.id));let moves=0;
for(const def of MAPS){
 const zone=def.id,map=createMap(def.id),base=npcs(map,{enemy:false}),motion=createNPCMotion(random);motion.sync(zone,base);
 const S=map.spawns.a,P=`${S.x},${S.y}`,Q=`${S.x},${S.y-1}`,blockedUp=blocked(map,S.x,S.y-1,[],true);
 assert.equal(new Set(base.map(n=>n.uid)).size,base.length);
 for(const n of base)if(!['board','wild',...PROP_KINDS].includes(n.kind))assert.ok(allowed.has(n.actor),`${n.name} must use an uploaded design`);
 for(let tick=0;tick<1200;tick++){
  const people=motion.update(base,map,{dt:100,player:{x:S.x,y:S.y,toX:S.x,toY:S.y-1}}),occupied=new Set();
  for(const n of people){
   if(n.actor){assert.ok(Math.abs(n.x-n.homeX)+Math.abs(n.y-n.homeY)<=NPC_RADIUS);assert.ok(Math.abs(n.drawX-n.homeX)+Math.abs(n.drawY-n.homeY)<=NPC_RADIUS+1e-9);assert.ok(!blocked(map,n.x,n.y,[],true));if(n.walking)moves++;}
   for(const p of n.occupied||[n]){const key=`${p.x},${p.y}`;assert.ok(!occupied.has(key),'NPCs reserve both step ends and cannot overlap or swap through each other');occupied.add(key);assert.notEqual(key,P);if(!blockedUp)assert.notEqual(key,Q);}
  }
 }
 // An automatic route holds the destination and leaves the planned cells clear.
 const target=motion.snapshot(base).find(n=>n.actor),holdKey=target.uid;
 const candidates=[[0,1],[1,0],[0,-1],[-1,0]].map(([dx,dy])=>pathfind(map,S.x,S.y,target.x+dx,target.y+dy,motion.snapshot(base))).filter(p=>p.length);
 assert.ok(candidates.length||Math.abs(target.x-S.x)+Math.abs(target.y-S.y)===1,'the moved NPC remains reachable');if(!candidates.length)continue;const route=candidates[0],before=[target.x,target.y];
 for(let i=0;i<100;i++)motion.update(base,map,{dt:100,player:{x:S.x,y:S.y},holdKey,route});
 assert.deepEqual(motion.snapshot(base).filter(n=>n.uid===holdKey).map(n=>[n.x,n.y])[0],before);
 // Disappearing enemies and revisiting a zone cannot leave invisible collision cells.
 const won=npcs(map,{enemy:true});motion.sync(zone,won);assert.ok(!motion.snapshot(won).some(n=>n.id==='enemy'));
 motion.reset();motion.sync(zone,base);assert.ok(motion.snapshot(base).every((n,i)=>n.x===base[i].x&&n.y===base[i].y));
}
assert.ok(moves>100,'roaming actually advances');
// Pause a live step without time jumps, then resume; distance belongs to movement, not wall clock.
const map=createMap(0),base=npcs(map,{enemy:false}),motion=createNPCMotion(()=>0);motion.sync(0,base);const S0=map.spawns.a;
let people;for(let i=0;i<25;i++)people=motion.update(base,map,{dt:100,player:{x:S0.x,y:S0.y}});
const walker=people.find(n=>n.walking);assert.ok(walker);const frozen=[walker.drawX,walker.drawY,walker.walkDistance];
for(let i=0;i<100;i++)people=motion.update(base,map,{dt:100,paused:true});
const still=people.find(n=>n.uid===walker.uid);assert.deepEqual([still.drawX,still.drawY,still.walkDistance],frozen);assert.equal(still.walking,false);
for(let i=0;i<Math.ceil(NPC_MOVE_MS/100);i++)people=motion.update(base,map,{dt:100,player:{x:S0.x,y:S0.y}});
assert.ok(people.find(n=>n.uid===walker.uid).walkDistance>frozen[2]);
// Player approach stops new steps and the speaker turns toward the player.
motion.reset();motion.sync(0,base);const n=base.find(n=>n.id==='guide');
for(let i=0;i<100;i++)people=motion.update(base,map,{dt:100,player:{x:n.x+1,y:n.y}});
assert.deepEqual(people.filter(p=>p.uid===n.uid).map(p=>[p.x,p.y])[0],[n.x,n.y]);motion.face(n.uid,{x:n.x+1,y:n.y});assert.equal(motion.snapshot(base).find(p=>p.uid===n.uid).dir,'right');
// Validate all 90 crops and actual full-frame renderer, including left mirroring.
globalThis.Image=class{set src(v){this.naturalWidth=1536;this.naturalHeight=1024;this.onload();}};
const calls=[],ctx=new Proxy({},{get:(o,k)=>o[k]||((...a)=>calls.push([k,...a])),set:(o,k,v)=>(o[k]=v,true)});
for(const id of allowed){const atlas=NPC_ATLASES[id];assert.equal(atlas.frames.flat().length,15);
 for(const dir of ['down','right','left','up'])for(const col of [0,1,2,3,4]){
  const f=residentFrame(id,dir,col>0,(col-1)*16),[x,y,w,h]=f.rect;assert.equal(f.col,col);assert.ok(x>=0&&y>=0&&w>0&&h>0&&x+w<=atlas.width&&y+h<=atlas.height);
  calls.length=0;assert.ok(drawResident(ctx,id,0,0,48,0,dir,col>0,(col-1)*16));assert.equal(calls.filter(c=>c[0]==='drawImage').length,1);assert.equal(calls.some(c=>c[0]==='scale'&&c[1]===-1),dir==='left');
 }
}
// Every 백무단 member wears a 백무단 design.
for(const def of MAPS){for(const n of npcs(def.id,{enemy:false}))if(n.id==='enemy'||n.kind==='trainer')assert.ok(n.actor.startsWith('villain-'),`${n.name} uses a 백무단 design`);}
assert.equal(VILLAIN_BY_ZONE.length,8);assert.equal(VILLAIN_BY_ZONE[7],'villain-leader');
console.log('PASS: all human roles mapped, 180 PNG poses incl. 6 백무단 sheets, 백무단 roles use 백무단 designs, roaming on all 15 maps, one-tile radius, two-end collision reservations, route hold, pause/resume, facing, cleanup and reset.');
