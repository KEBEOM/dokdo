import {assetImage} from './assets.js';
import {TERRAIN_ATLAS} from './terrain-atlas.js';

const TILE=32;
// v0.45: 3번 칸은 풀숲이 아니라 독도의 ‘바위 들판’(응회암 땅·자갈·이끼·해국). 풀숲 그림(tall)은 컷신에서만 써요.
const kinds={0:'water',1:'grass',2:'path',3:'rocky',4:'sand',5:'grass',6:'dock',7:'grass'};
const colors={water:'#4aa9d8',grass:'#8fd16a',path:'#e2c88f',tall:'#4d9a43',rocky:'#bfad8c',sand:'#f4e2ae',dock:'#c28b54'};
let cachedMap=null,cachedSheet=null,ground=null;
const at=(map,x,y)=>map[y]?.[x];

// Texture coordinates continue across adjacent tiles. Mirrored repeat boundaries
// join identical edge pixels; grass keeps its upward-growing orientation.
export function terrainSample(kind,x,y){
 const frame=TERRAIN_ATLAS.frames[kind]||TERRAIN_ATLAS.frames.grass;
 const [sx,sy,sw,sh]=frame,flipX=Math.floor(x/2)%2===1;
 const flipY=!['grass','tall'].includes(kind)&&Math.floor(y/4)%2===1;
 const col=flipX?1-x%2:x%2,row=flipY?3-y%4:y%4;
 return {rect:[sx+col*sw/2,sy+row*sh/4,sw/2,sh/4],flipX,flipY};
}

function tile(ctx,sheet,kind,x,y){
 const px=x*TILE,py=y*TILE;
 if(!sheet){ctx.fillStyle=colors[kind];ctx.fillRect(px,py,TILE,TILE);return;}
 const f=terrainSample(kind,x,y);
 ctx.save();ctx.translate(px+(f.flipX?TILE:0),py+(f.flipY?TILE:0));
 ctx.scale(f.flipX?-1:1,f.flipY?-1:1);ctx.drawImage(sheet,...f.rect,0,0,TILE,TILE);ctx.restore();
}

// v0.39 선명한 외곽선 도트 느낌의 경계: 흙길·모래 칸에 옆 풀밭이 살짝 덮이고(들쭉날쭉한 풀 끝 + 진한 선), 부두는 양옆이 진하게.
const GRASSY=n=>n===1||n===5||n===7;
function edging(ctx,map,x,y){
 const k=at(map,x,y),px=x*TILE,py=y*TILE;
 if(k===2||k===3||k===4){
  for(const [dx,dy] of [[0,-1],[1,0],[0,1],[-1,0]]){
   const n=at(map,x+dx,y+dy);if(!GRASSY(n)||map.rockTiles?.has(`${x+dx},${y+dy}`))continue; // 바위 덩어리 옆에는 풀이 덮이지 않아요
   for(let i=0;i<16;i++){
    const h=((x*7+y*13+i*5)%3)+2;          // overhang 2–4 dots
    const a=i*2;
    if(dy){const yy=dy<0?py:py+32-h;ctx.fillStyle='#8fd16a';ctx.fillRect(px+a,yy,2,h);ctx.fillStyle='#5f9e47';ctx.fillRect(px+a,dy<0?py+h:py+32-h-1,2,1);if(dy<0){ctx.fillStyle=k===2?'#c9aa6d':k===3?'#9c8768':'#e6cd92';ctx.fillRect(px+a,py+h+1,2,1);}}
    else{const xx=dx<0?px:px+32-h;ctx.fillStyle='#8fd16a';ctx.fillRect(xx,py+a,h,2);ctx.fillStyle='#5f9e47';ctx.fillRect(dx<0?px+h:px+32-h-1,py+a,1,2);}
   }
  }
 }
 if(k===6){
  ctx.fillStyle='#5e3c22';
  if(at(map,x-1,y)!==6)ctx.fillRect(px,py,2,32);
  if(at(map,x+1,y)!==6)ctx.fillRect(px+30,py,2,32);
  if(at(map,x,y+1)!==6){ctx.fillRect(px,py+30,32,2);ctx.fillStyle='#00000030';ctx.fillRect(px,py+32,32,3);}
 }
}

// Textured rock outcrop tile (2px dots): highlight on top, cliff face below, outline where the outcrop ends.
const ROCK=['#9b7d65','#a98a70','#8e705a','#a08068','#b3937a']; // 독도 바위 색(선명한 외곽선 도트 느낌으로 평평하게)
function rockTile(ctx,map,x,y){
 const has=(dx,dy)=>map.rockTiles.has(`${x+dx},${y+dy}`),px=x*TILE,py=y*TILE,up=has(0,-1),down=has(0,1),left=has(-1,0),right=has(1,0);
 for(let cy=0;cy<16;cy++)for(let cx=0;cx<16;cx++){
  const h=((x*16+cx)*73856093^(y*16+cy)*19349663)>>>0;let c=ROCK[h%5];
  if(!up&&cy<3)c=cy===0?'#3a2e2a':'#d1b590';
  else if(!down&&cy>=11)c=cy===15?'#3a2e2a':(cx+h)%5===0?'#5a463b':'#6c5547';
  if((!left&&cx===0)||(!right&&cx===15))c='#3a2e2a';
  if(up&&!down&&cy===10&&h%3===0)c='#7fb05a';
  if(!up&&cy===3&&h%4===0)c='#8fd16a';
  ctx.fillStyle=c;ctx.fillRect(px+cx*2,py+cy*2,2,2);
 }
}

function paintGround(ctx,map,sheet){
 ctx.imageSmoothingEnabled=false;
 for(let y=0;y<map.length;y++)for(let x=0;x<map[y].length;x++)tile(ctx,sheet,kinds[map[y][x]]||'grass',x,y);
 if(map.rockTiles?.size)for(const k of map.rockTiles){const [x,y]=k.split(',').map(Number);rockTile(ctx,map,x,y);}
 for(let y=0;y<map.length;y++)for(let x=0;x<map[y].length;x++)edging(ctx,map,x,y);
}

export function drawTerrain(ctx,map,time,{x=0,y=0,width=768,height=480}={}){
 const sheet=assetImage(TERRAIN_ATLAS.key);
 if(typeof document!=='undefined'){
  if(!ground||cachedMap!==map||cachedSheet!==sheet){
   ground=document.createElement('canvas');ground.width=map[0].length*TILE;ground.height=map.length*TILE;
   paintGround(ground.getContext('2d'),map,sheet);cachedMap=map;cachedSheet=sheet;
  }
  ctx.drawImage(ground,0,0);
 }else paintGround(ctx,map,sheet);
 // Four-sided shoreline. Never paint foam where a pier joins the water.
 const sx=Math.max(0,Math.floor(x/TILE)-1),sy=Math.max(0,Math.floor(y/TILE)-1);
 const ex=Math.min(map[0].length,Math.ceil((x+width)/TILE)+1),ey=Math.min(map.length,Math.ceil((y+height)/TILE)+1);
 const phase=Math.floor(time/420)%4;
 for(let yy=sy;yy<ey;yy++)for(let xx=sx;xx<ex;xx++){
  if(map[yy][xx]!==0)continue;
  const px=xx*TILE,py=yy*TILE;
  for(const [dx,dy] of [[0,-1],[1,0],[0,1],[-1,0]]){
   const n=at(map,xx+dx,yy+dy);if(n===undefined||n===0||n===6)continue;
   ctx.fillStyle='#8ed4ef';
   if(dx)ctx.fillRect(px+(dx<0?0:27),py,5,32);else ctx.fillRect(px,py+(dy<0?0:27),32,5);
   ctx.fillStyle='#ffffff';
   for(let i=0;i<8;i++){const bend=(i+xx+yy+phase)%4===0?2:0;
    if(dx)ctx.fillRect(px+(dx<0?1+bend:28-bend),py+i*4,2,4);
    else ctx.fillRect(px+i*4,py+(dy<0?1+bend:28-bend),4,2);
   }
  }
 }
}
