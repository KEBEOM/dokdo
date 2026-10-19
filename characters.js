import {assetImage,drawAsset} from './assets.js';
export const EXPLORERS=[{id:'girl',label:'여학생',portrait:'characters/girl-portrait',sheet:'characters/girl-sheet'},{id:'boy',label:'남학생',portrait:'characters/boy-portrait',sheet:'characters/boy-sheet'}];
const prepared=new Map();
export function explorerInfo(id){return EXPLORERS.find(p=>p.id===id)||EXPLORERS[0];}
// Supplied 4×4 layout: idle/front, front walk, right walk, back walk.
// Left uses the right-facing row mirrored. Omit the decorative final back frame.
export function explorerFrame(id,direction,walking,time=0){
  const dir=['up','down','left','right'].includes(direction)?direction:'down';
  if(walking)return {row:dir==='down'?1:dir==='up'?3:2,col:dir==='up'?[0,1,2,1][Math.floor(time/120)%4]:Math.floor(time/120)%4,flip:dir==='left'};
  const blink=Math.floor(time/180)%25===23;
  return {row:dir==='down'?0:dir==='up'?3:2,col:dir==='down'&&blink?(id==='boy'?1:2):0,flip:dir==='left'};
}
// Remove only pale background pixels connected to frame edges, keeping eye highlights.
// This runs on a temporary render canvas; original uploaded PNGs remain unchanged.
export function clearFrameBackground(pixels,width,height){
  const seen=new Uint8Array(width*height),queue=[];
  const visit=(x,y)=>{if(x<0||y<0||x>=width||y>=height)return;const n=y*width+x;if(seen[n])return;seen[n]=1;const i=n*4,r=pixels[i],g=pixels[i+1],b=pixels[i+2];if(pixels[i+3]===0||(Math.min(r,g,b)>=180&&Math.max(r,g,b)-Math.min(r,g,b)<30)){pixels[i+3]=0;queue.push(n);}};
  for(let x=0;x<width;x++){visit(x,0);visit(x,height-1);}for(let y=0;y<height;y++){visit(0,y);visit(width-1,y);}
  for(let head=0;head<queue.length;head++){const n=queue[head],x=n%width,y=Math.floor(n/width);visit(x-1,y);visit(x+1,y);visit(x,y-1);visit(x,y+1);}
  return pixels;
}
function preparedSheet(id){
  const info=explorerInfo(id),image=assetImage(info.sheet);if(!image)return null;
  if(prepared.has(info.id))return prepared.get(info.id);
  if(typeof document==='undefined')return null;
  const atlas=document.createElement('canvas');atlas.width=128;atlas.height=128;const ctx=atlas.getContext('2d');
  const cell=document.createElement('canvas');cell.width=32;cell.height=32;const c=cell.getContext('2d');
  const width=image.naturalWidth||image.width,height=image.naturalHeight||image.height;
  ctx.imageSmoothingEnabled=false;c.imageSmoothingEnabled=false;
  for(let row=0;row<4;row++)for(let col=0;col<4;col++){
    c.clearRect(0,0,32,32);c.drawImage(image,col*width/4,row*height/4,width/4,height/4,0,0,32,32);
    const frame=c.getImageData(0,0,32,32);clearFrameBackground(frame.data,32,32);ctx.putImageData(frame,col*32,row*32);
  }
  prepared.set(info.id,atlas);return atlas;
}
export function drawExplorer(ctx,id,x,y,size=32,dir='down',walking=false,time=0){
  const sheet=preparedSheet(id);if(!sheet)return false;
  const f=explorerFrame(id,dir,walking,time);ctx.save();ctx.imageSmoothingEnabled=false;
  ctx.translate(Math.round(x),Math.round(y));if(f.flip){ctx.translate(size,0);ctx.scale(-1,1);}
  ctx.drawImage(sheet,f.col*32,f.row*32,32,32,0,0,size,size);ctx.restore();return true;
}
export function paintExplorerCard(canvas,id,time=0,walking=false){
  const c=canvas.getContext('2d');c.clearRect(0,0,canvas.width,canvas.height);c.imageSmoothingEnabled=false;
  return drawExplorer(c,id,0,0,canvas.width,'down',walking,time);
}
export function paintExplorerPortrait(canvas,id){
  const c=canvas.getContext('2d');c.clearRect(0,0,canvas.width,canvas.height);
  drawAsset(c,explorerInfo(id).portrait,0,0,canvas.width,canvas.height);
}
