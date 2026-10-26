import assert from 'node:assert/strict';
import {sceneDrawOrder,createMap,blocked} from '../dist/world.js';
import {MAPS} from '../dist/maps.js';
for(const def of MAPS.filter(m=>m.kind==='town')){const map=createMap(def.id);for(const b of map.buildings){
 const behind={x:b.x+b.w/2,y:b.y-1};
 const front={x:b.x+b.w/2,y:b.y+b.h};
 for(const [view,isBehind] of [[behind,true],[front,false]]){
  const list=sceneDrawOrder([],view,map),house=list.findIndex(n=>n.building===b),player=list.findIndex(n=>n.player);
  assert.equal(player<house,isBehind,'whole house must cover the player behind, but not the player in front');
  assert.equal(list.filter(n=>n.building===b).length,1,'one whole sprite per house');
 }
 assert.ok(blocked(map,b.x,b.y,[],true),'building footprint stays blocked');
}}
const town=createMap(0),shop=town.buildings.find(b=>b.kind==='shop');
const list=sceneDrawOrder([{id:'test',x:shop.x,y:shop.y+shop.h+1,drawX:shop.x,drawY:shop.y+shop.h-1.5}],{x:2,y:2},town);
assert.ok(list.findIndex(n=>n.id==='test')<list.findIndex(n=>n.scenery==='shop'),'moving NPC uses interpolated feet');
console.log('PASS: 32 whole houses in 8 towns, player/NPC front-back depth, solid footprints.');
