import {assetImage} from './assets.js';
import {strideFrame,MOVE_DURATION} from './movement.js';
import {EXPLORER_ATLAS} from './explorer-atlas.js';
import {NPC_ATLASES as RESIDENT_ATLASES} from './npc-atlases.js';
import {VILLAIN_ATLASES} from './villain-atlases.js';
// Residents plus the 몽땅랜드 designs; every NPC sheet shares one format.
export const NPC_ATLASES={...RESIDENT_ATLASES,...VILLAIN_ATLASES};
export const EXPLORERS=[{id:'girl',label:'여학생',portrait:EXPLORER_ATLAS.key,sheet:EXPLORER_ATLAS.key},{id:'boy',label:'남학생',portrait:EXPLORER_ATLAS.key,sheet:EXPLORER_ATLAS.key}];
export const RESIDENTS=[
 {id:'child-boy',label:'남자아이',sheet:'characters/child-boy-atlas-v18'},
 {id:'child-girl',label:'여자아이 · 양갈래 머리',sheet:'characters/child-girl-atlas-v18'},
 {id:'child-girl-ribbon',label:'여자아이 · 리본',sheet:'characters/child-girl-ribbon-atlas-v18'},
 {id:'man',label:'아저씨',sheet:'characters/man-atlas-v18'},
 {id:'woman',label:'아줌마',sheet:'characters/woman-atlas-v18'},
 {id:'professor',label:'김박사',sheet:'characters/professor-atlas-v19'},
 ...Object.entries(VILLAIN_ATLASES).map(([id,a])=>({id,label:a.label,sheet:a.key,villain:true}))
];
export const CHARACTER_SIZE=48;
export function explorerInfo(id){return EXPLORERS.find(p=>p.id===id)||EXPLORERS[0];}
// One drawn idle pose + four drawn walk poses; left is a whole-frame mirror.
export function explorerFrame(id,direction,walking,distance=0){
 const avatar=explorerInfo(id).id,dir=['up','left','right'].includes(direction)?direction:'down';
 const row=EXPLORER_ATLAS.rows[avatar][dir==='left'?'right':dir];
 const col=walking?1+strideFrame(distance):0;
 return {row,col,flip:dir==='left',...EXPLORER_ATLAS.frames[row][col]};
}
export function residentFrame(id,direction='down',walking=false,distance=0){
 const atlas=NPC_ATLASES[id];if(!atlas)return null;
 const dir=['up','left','right'].includes(direction)?direction:'down',row=atlas.rows[dir==='left'?'right':dir],col=walking?1+strideFrame(distance):0;
 return {row,col,flip:dir==='left',...atlas.frames[row][col]};
}
export function drawResident(ctx,id,x,y,size=CHARACTER_SIZE,time=0,dir='down',walking=false,distance=0){
 const atlas=NPC_ATLASES[id],f=residentFrame(id,dir,walking,distance);if(!atlas||!f)return false;
 const sheet=assetImage(atlas.key);if(!sheet)return true;
 const [sx,sy,sw,sh]=f.rect,[ax,ay]=f.anchor,scale=size/atlas.unit;
 ctx.save();ctx.imageSmoothingEnabled=false;ctx.fillStyle='#244b5028';ctx.fillRect(Math.round(x+size*.28),Math.round(y+size*.91),Math.round(size*.44),Math.max(1,Math.round(size*.04)));
 ctx.translate(Math.round(x+(f.flip?size:0)),Math.round(y));if(f.flip)ctx.scale(-1,1);
 ctx.drawImage(sheet,sx,sy,sw,sh,Math.round(size/2+(sx-ax)*scale),Math.round(size*.9375+(sy-ay)*scale),sw*scale,sh*scale);ctx.restore();return true;
}
export function drawExplorer(ctx,id,x,y,size=CHARACTER_SIZE,dir='down',walking=false,distance=0,shadow=true){
 const sheet=assetImage(EXPLORER_ATLAS.key);if(!sheet)return true;
 const f=explorerFrame(id,dir,walking,distance),[sx,sy,sw,sh]=f.rect,[ax,ay]=f.anchor;
 const scale=size/EXPLORER_ATLAS.unit;
 const dx=size/2+(sx-ax)*scale,dy=size*.9375+(sy-ay)*scale;
 ctx.save();ctx.imageSmoothingEnabled=false;
 if(shadow){ctx.fillStyle='#244b5028';ctx.fillRect(Math.round(x+size*.28),Math.round(y+size*.91),Math.round(size*.44),Math.max(1,Math.round(size*.04)));}
 ctx.translate(Math.round(x+(f.flip?size:0)),Math.round(y));if(f.flip)ctx.scale(-1,1);
 // Exactly one PNG frame per draw. Anchors align the body and ground without stretching limbs.
 ctx.drawImage(sheet,sx,sy,sw,sh,Math.round(dx),Math.round(dy),sw*scale,sh*scale);
 ctx.restore();return true;
}
export function paintExplorerCard(canvas,id,time=0,walking=false){
 const c=canvas.getContext('2d');c.clearRect(0,0,canvas.width,canvas.height);
 return drawExplorer(c,id,0,0,canvas.width,'down',walking,time/MOVE_DURATION*32);
}
export function paintExplorerPortrait(canvas,id){
 const c=canvas.getContext('2d');c.clearRect(0,0,canvas.width,canvas.height);
 return drawExplorer(c,id,0,0,canvas.width,'down',false,0,false);
}
