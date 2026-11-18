import {blocked,TILE} from './world.js';
export const NPC_RADIUS=1,NPC_MOVE_MS=560;
const directions=[[0,1,'down'],[1,0,'right'],[0,-1,'up'],[-1,0,'left']];
// Doors, exits and arrival tiles (map.keepClear) stay free so nobody blocks the way.
export function createNPCMotion(random=Math.random){
 let zone=null,records=new Map(),frozen=false;
 const delay=()=>2400+random()*3200;
 function sync(nextZone,people){
  if(zone!==nextZone){zone=nextZone;records.clear();}
  const ids=new Set(people.map(n=>n.uid));
  for(const id of records.keys())if(!ids.has(id))records.delete(id);
  for(const n of people)if(n.actor&&!records.has(n.uid))records.set(n.uid,{x:n.x,y:n.y,homeX:n.x,homeY:n.y,dir:'down',step:null,distance:0,wait:delay()});
 }
 function snapshot(people){return people.map(n=>{
  const r=records.get(n.uid);if(!r)return {...n,drawX:n.x,drawY:n.y};
  const t=r.step?r.step.elapsed/NPC_MOVE_MS:1;
  return {...n,x:r.x,y:r.y,homeX:r.homeX,homeY:r.homeY,drawX:r.step?r.step.x+(r.x-r.step.x)*t:r.x,drawY:r.step?r.step.y+(r.y-r.step.y)*t:r.y,dir:r.dir,walking:!!r.step&&!frozen,walkDistance:r.distance+(r.step?t*TILE:0),occupied:r.step?[{x:r.x,y:r.y},{x:r.step.x,y:r.step.y}]:[{x:r.x,y:r.y}]};
 });}
 function update(people,map,{dt=0,player,paused=false,holdKey=null,route=[]}={}){
  frozen=paused;if(paused)return snapshot(people);
  const elapsed=Math.max(0,Math.min(dt,100));
  for(const r of records.values())if(r.step){
   r.step.elapsed=Math.min(NPC_MOVE_MS,r.step.elapsed+elapsed);
   if(r.step.elapsed===NPC_MOVE_MS){r.step=null;r.distance+=TILE;r.wait=delay();}
  }
  const reserved=new Set(route.map(p=>p.join(',')));
  if(player){reserved.add([player.x,player.y].join(','));if(player.toX!==undefined)reserved.add([player.toX,player.toY].join(','));}
  for(const n of people){
   const r=records.get(n.uid);if(!r||r.step)continue;
   // Keep the whole crowd settled during an automatic route; the target cannot walk away.
   if(route.length||n.uid===holdKey||(player&&Math.abs(r.x-player.x)+Math.abs(r.y-player.y)<=2))continue;
   r.wait-=elapsed;if(r.wait>0)continue;
   const others=snapshot(people).filter(p=>p.uid!==n.uid);
   const candidates=directions.filter(([dx,dy])=>{
    const x=r.x+dx,y=r.y+dy;
    return Math.abs(x-r.homeX)+Math.abs(y-r.homeY)<=NPC_RADIUS&&!map.keepClear?.has([x,y].join(','))&&!reserved.has([x,y].join(','))&&!blocked(map,x,y,others,false,false); // v0.71 마을 사람은 물에 안 들어가요
   });
   r.wait=delay();if(!candidates.length)continue;
   const [dx,dy,dir]=candidates[Math.min(candidates.length-1,Math.floor(random()*candidates.length))];
   r.step={x:r.x,y:r.y,elapsed:0};r.x+=dx;r.y+=dy;r.dir=dir;
  }
  return snapshot(people);
 }
 function face(uid,player){const r=records.get(uid);if(!r||!player)return;const dx=player.x-r.x,dy=player.y-r.y;r.dir=Math.abs(dx)>Math.abs(dy)?(dx<0?'left':'right'):(dy<0?'up':'down');}
 return {sync,snapshot,update,face,reset(){zone=null;records.clear();frozen=false;}};
}
