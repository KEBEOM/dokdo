import {assetImage,assetTintTag,monsterAssetKey} from './assets.js';
import {tintCanvas} from './season.js';
import {paintCliffs} from './heights.js';
import {TERRAIN_ATLAS} from './terrain-atlas.js';
import {V2_TERRAIN,V2_DETAILS,v2TileRect} from './tileset-v2.js';
import {UW_ATLAS,UW_FLOOR} from './uw-atlas.js';
import {seabedLayout} from './seabed.js';
import {MONSTER_DOTS} from './monster-dots.js';

const TILE=32;
// v0.45: 3번 칸은 풀숲이 아니라 독도의 ‘바위 들판’(응회암 땅·자갈·이끼·해국). 풀숲 그림(tall)은 컷신에서만 써요.
const kinds={0:'water',1:'grass',2:'path',3:'rocky',4:'sand',5:'grass',6:'dock',7:'grass'};
const colors={water:'#4aa9d8',grass:'#8fd16a',path:'#e2c88f',tall:'#4d9a43',rocky:'#bfad8c',sand:'#f4e2ae',dock:'#c28b54'};
let cachedMap=null,cachedSheet=null,ground=null,cachedTint=null; // cachedSheet: 어떤 그림으로 그려 둔 땅인지(v2 · v2d · 예전 그림)
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
 if(k===6){ // 콘크리트 부두 가장자리: 밝은 턱 + 물 쪽 그늘
  ctx.fillStyle='#6f7378';
  if(at(map,x-1,y)!==6)ctx.fillRect(px,py,2,32);
  if(at(map,x+1,y)!==6)ctx.fillRect(px+30,py,2,32);
  if(at(map,x,y+1)!==6){ctx.fillRect(px,py+30,32,2);ctx.fillStyle='#00000030';ctx.fillRect(px,py+32,32,3);}
 }
}

// Textured rock outcrop tile (2px dots): highlight on top, cliff face below, outline where the outcrop ends.
const ROCK=['#9b7d65','#a98a70','#8e705a','#a08068','#b3937a','#a98a70','#9b7d65','#b3937a']; // 독도 바위 색(선명한 외곽선 도트 느낌으로 평평하게)
function rockTile(ctx,map,x,y){
 const has=(dx,dy)=>map.rockTiles.has(`${x+dx},${y+dy}`),px=x*TILE,py=y*TILE,up=has(0,-1),down=has(0,1),left=has(-1,0),right=has(1,0);
 for(let cy=0;cy<16;cy++)for(let cx=0;cx<16;cx++){
  const h=((x*16+cx)*73856093^(y*16+cy)*19349663)>>>0;let c=ROCK[(h%8+((cx+cy*2)%7===0?3:0))%8];
  if(!up&&cy<3)c=cy===0?'#3a2e2a':'#d1b590';
  else if(!down&&cy>=11)c=cy===15?'#3a2e2a':cx%3===0?'#5a463b':cy===11?'#8a6a55':'#6c5547'; // 앞으로 보이는 바위벽: 세로 결
  if((!left&&cx===0)||(!right&&cx===15))c='#3a2e2a';
  if(up&&!down&&cy===10&&h%3===0)c='#7fb05a';
  if(!up&&cy===3&&h%4===0)c='#8fd16a';
  ctx.fillStyle=c;ctx.fillRect(px+cx*2,py+cy*2,2,2);
 }
}

// ── v0.66 자연 다시 그리기 ─────────────────────────────────────────────────────
// 칸 그림(타일) 위에 지도 전체를 한 번에 손봐요. 지도마다 한 번만 그려 두고(캐시) 다시 쓰니 느려지지 않아요.
//  · 풀밭: 넓게 번지는 밝은/짙은 얼룩 + 비스듬한 빛줄기(바람에 눕는 풀) — 칸과 칸의 이음매가 보이지 않아요
//  · 들꽃: 길가 풀밭에 흰 꽃 서너 송이씩
//  · 바위 들판: 넓게 번지는 밝은/짙은 얼룩
//  · 물가: 풀·바위 땅이 물과 만나면 흙 둔덕(앞쪽은 흙벽)이 생기고, 모래와 만나면 얕은 물빛 띠가 생겨요
const hash=(a,b,c=0)=>{let h=Math.imul(a|0,374761393)^Math.imul(b|0,668265263)^Math.imul(c|0,2147483647);h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967296;};
function vnoise(x,y,cell,seed){ // 부드러운 값 노이즈(0…1)
 const gx=x/cell,gy=y/cell,ix=Math.floor(gx),iy=Math.floor(gy),fx=gx-ix,fy=gy-iy,sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy);
 const a=hash(ix,iy,seed),b=hash(ix+1,iy,seed),c=hash(ix,iy+1,seed),d=hash(ix+1,iy+1,seed);
 return a+(b-a)*sx+(c-a)*sy+(a-b-c+d)*sx*sy;
}
const hex=c=>[parseInt(c.slice(1,3),16),parseInt(c.slice(3,5),16),parseInt(c.slice(5,7),16)];
const G_BASE=hex('#8fd16a'),G_LIGHT=hex('#9edb77'),G_LIGHTER=hex('#b2e68d'),G_DARK=hex('#84c661'),R_BASE=hex('#c2b08e'),R_LIGHT=hex('#cbbb9a'),R_DARK=hex('#b6a27f');
function texture(ctx,map){
 const w=map[0].length*TILE,h=map.length*TILE,img=ctx.getImageData(0,0,w,h),d=img.data,seed=String(map.id||'').length*31+(map.zone||0)*7;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const i=(y*w+x)*4,r=d[i],g=d[i+1],b=d[i+2];
  if(r===G_BASE[0]&&g===G_BASE[1]&&b===G_BASE[2]){
   const n=vnoise(x,y,72,seed);let c=n>.66?G_LIGHT:n<.3?G_DARK:null;
   // 빛줄기: 오른쪽 위로 비스듬히 누운 풀결(굵기 3, 길이 8) — 밝은 얼룩 안에서만 드문드문
   const u=Math.floor((x+y)/3),v=Math.floor((x-y+4096)/8),k=hash(u,v,seed+3);
   if(n>.52&&k<.05)c=n>.66?G_LIGHTER:G_LIGHT;
   if(c){d[i]=c[0];d[i+1]=c[1];d[i+2]=c[2];}
  }else if(r===R_BASE[0]&&g===R_BASE[1]&&b===R_BASE[2]){
   const n=vnoise(x,y,56,seed+9),c=n>.68?R_LIGHT:n<.32?R_DARK:null;
   if(c){d[i]=c[0];d[i+1]=c[1];d[i+2]=c[2];}
  }
 }
 ctx.putImageData(img,0,0);
}
// 꽃밭과 들꽃(칸 단위). 건물·물건·출입구 둘레는 비워 둬요.
function flowerSpots(map){
 const busy=new Set(map.keepClear||[]);for(const k of map.solid||[])busy.add(k);
 for(const b of map.buildings||[])for(let y=b.y-1;y<=b.y+b.h+1;y++)for(let x=b.x-1;x<=b.x+b.w;x++)busy.add(`${x},${y}`);
 for(const d of map.decor||[])busy.add(`${d.x},${d.y}`);
 const isGrass=(x,y)=>at(map,x,y)===1&&!map.rockTiles?.has(`${x},${y}`);
 const free=(x,y)=>isGrass(x,y)&&!busy.has(`${x},${y}`);
 const bed=new Set(),seed=String(map.id||'').length*13+(map.zone||0);
 if(map.kind==='room')return {bed,wild:[]};
 for(let y=1;y<map.length-1;y++)for(let x=1;x<map[0].length-1;x++){
  if(!free(x,y))continue;
  void vnoise; // 꽃밭 자리는 고르지 않아요(v0.66)
 }
 const wild=[];
 for(let y=1;y<map.length-1;y++)for(let x=1;x<map[0].length-1;x++){
  if(!free(x,y)||bed.has(`${x},${y}`))continue;
  const nearPath=[[1,0],[-1,0],[0,1],[0,-1]].some(([a,b])=>at(map,x+a,y+b)===2);
  if(hash(x,y,seed+5)<(nearPath?.16:.05))wild.push([x,y]);
 }
 return {bed,wild};
}
function flower(ctx,x,y,[petal,shade,mid]){ // 다섯 점 꽃(가운데 + 네 잎) + 아래 그늘
 ctx.fillStyle=petal;ctx.fillRect(x,y-1,1,1);ctx.fillRect(x-1,y,3,1);ctx.fillStyle=shade;ctx.fillRect(x,y+1,1,1);ctx.fillRect(x+1,y,1,1);
 ctx.fillStyle=mid;ctx.fillRect(x,y,1,1);
}
function paintFlowers(ctx,map){
 const {wild}=flowerSpots(map);
 // v0.66: 빽빽한 꽃밭(작은 알갱이 무늬)은 징그러워 보여서 그리지 않아요. 길가 들꽃만 남겨요.
 for(const [tx,ty] of wild){ // 들꽃: 흰 꽃 두세 송이
  const n=2+Math.floor(hash(tx,ty,11)*2);
  for(let i=0;i<n;i++){const x=tx*TILE+4+Math.floor(hash(tx,ty,20+i)*24),y=ty*TILE+5+Math.floor(hash(tx,ty,40+i)*22);flower(ctx,x,y,['#ffffff','#d9dbe6','#f6d44c']);ctx.fillStyle='#5fa84a';ctx.fillRect(x,y+2,1,1);}
 }
}
// 물가(움직이지 않는 부분): 풀·바위 땅 아래쪽 물에는 흙벽, 옆과 위쪽에는 흙 테두리, 모래 옆에는 얕은 물빛 띠
const BANKY=n=>n===1||n===5||n===7||n===3;
function banks(ctx,map){
 for(let y=0;y<map.length;y++)for(let x=0;x<map[0].length;x++){
  if(map[y][x]!==0)continue;const px=x*TILE,py=y*TILE;
  const up=at(map,x,y-1),dn=at(map,x,y+1),lf=at(map,x-1,y),rt=at(map,x+1,y);
  const shallow=n=>n===4||n===2;
  if(shallow(up)){ctx.fillStyle='#62b2ea';ctx.fillRect(px,py,32,7);ctx.fillStyle='#86c8f2';ctx.fillRect(px,py,32,3);}
  if(shallow(dn)){ctx.fillStyle='#62b2ea';ctx.fillRect(px,py+25,32,7);ctx.fillStyle='#86c8f2';ctx.fillRect(px,py+29,32,3);}
  if(shallow(lf)){ctx.fillStyle='#62b2ea';ctx.fillRect(px,py,7,32);ctx.fillStyle='#86c8f2';ctx.fillRect(px,py,3,32);}
  if(shallow(rt)){ctx.fillStyle='#62b2ea';ctx.fillRect(px+25,py,7,32);ctx.fillStyle='#86c8f2';ctx.fillRect(px+29,py,3,32);}
  if(BANKY(up)){ // 앞으로 보이는 흙벽: 밝은 윗턱, 세로 결, 짙은 아랫선
   ctx.fillStyle='#a8743f';ctx.fillRect(px,py,32,9);ctx.fillStyle='#c48d55';ctx.fillRect(px,py,32,2);
   for(let i=0;i<32;i+=4){const hgt=4+Math.floor(hash(x*8+i,y,3)*4);ctx.fillStyle='#8a5a30';ctx.fillRect(px+i+1,py+3,1,hgt);ctx.fillStyle='#bd8650';ctx.fillRect(px+i+2,py+3,1,Math.max(2,hgt-2));}
   ctx.fillStyle='#5e3c22';ctx.fillRect(px,py+9,32,1);ctx.fillStyle='#00000026';ctx.fillRect(px,py+10,32,2);
  }
  if(BANKY(lf)){ctx.fillStyle='#a8743f';ctx.fillRect(px,py,3,32);ctx.fillStyle='#5e3c22';ctx.fillRect(px+3,py,1,32);}
  if(BANKY(rt)){ctx.fillStyle='#a8743f';ctx.fillRect(px+29,py,3,32);ctx.fillStyle='#5e3c22';ctx.fillRect(px+28,py,1,32);}
  if(BANKY(dn)){ctx.fillStyle='#5e3c22';ctx.fillRect(px,py+29,32,1);ctx.fillStyle='#c48d55';ctx.fillRect(px,py+30,32,2);}
 }
}

// ── v0.67 타일셋 v2 ─────────────────────────────────────────────────────────────
// 지도 칸(물·풀·흙길·바위 들판·모래·부두)은 그대로 두고, 칸마다 그릴 그림만 타일셋 v2에서 골라요.
// 같은 종류도 칸 자리로 정한 무늬(변형)를 섞어 반복이 덜 보이게 하고, 물은 땅에서 멀수록 짙은 바다로 그려요.
// 충돌·길찾기·이벤트는 지도 칸(maps.js)으로 정해서, 그림이 바뀌어도 게임 규칙은 그대로예요.
const V=V2_TERRAIN.ids,pick=(list,x,y,salt=0)=>list[Math.floor(hash(x,y,salt)*list.length)];
const V2={
 deep:[V.deep_sea_0,V.deep_sea_1,V.deep_sea_2,V.deep_sea_3],sea:[V.sea_0,V.sea_1,V.sea_2,V.sea_3,V.sea_4,V.sea_5],shallow:[V.shallow_0,V.shallow_1,V.shallow_2,V.shallow_3],
 grass:[V.grass_0,V.grass_1,V.grass_2,V.grass_3,V.grass_4],sprouts:[V.grass_sprouts_0,V.grass_sprouts_1,V.grass_sprouts_2,V.grass_sprouts_3,V.grass_sprouts_4],flowers:[V.grass_flowers_0,V.grass_flowers_1,V.grass_flowers_2],
 sand:[V.sand_0,V.sand_1,V.sand_2,V.sand_3,V.sand_4,V.sand_5],sandPebble:[V.sand_pebble_0,V.sand_pebble_1],dirt:[V.dirt_0,V.dirt_1,V.dirt_2,V.dirt_3],dirtPebble:[V.dirt_pebble_0,V.dirt_pebble_1],
 basalt:[V.basalt_0,V.basalt_1,V.basalt_2,V.basalt_3,V.basalt_4,V.basalt_5],moss:[V.basalt_moss_0,V.basalt_moss_1,V.basalt_moss_2,V.basalt_moss_3],
 wood:[V.wood_0,V.wood_1,V.wood_2],rockface:[V.rockface_0,V.rockface_1,V.rockface_crack,V.rockface_moss,V.cliff_mid]
};
// 땅에서 몇 칸 떨어진 물인지(최대 4): 1칸은 얕은 물, 2~3칸은 바다, 4칸부터 깊은 바다
export function seaDepth(map){
 const H=map.length,W=map[0].length,d=Array.from({length:H},()=>new Array(W).fill(9)),q=[];
 for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(map[y][x]!==0){d[y][x]=0;q.push([x,y]);}
 for(let i=0;i<q.length;i++){const [x,y]=q[i];for(const [a,b] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]]){const nx=x+a,ny=y+b;if(nx<0||ny<0||nx>=W||ny>=H||d[ny][nx]<=d[y][x]+1)continue;d[ny][nx]=d[y][x]+1;q.push([nx,ny]);}}
 return d;
}
export function v2Tile(map,x,y,depth){
 const k=at(map,x,y),r=hash(x,y,17);
 if(k===0){const dd=depth[y][x],m=hash(x,y,41); // 띠 경계는 섞어서(디더) 계단처럼 보이지 않게
  const band=dd<=1?0:dd===2?(m<.35?0:1):dd===3?1:dd===4?(m<.45?1:2):2;
  return band===0?pick(V2.shallow,x,y):band===1?pick(V2.sea,x,y):(r<.04?V.sea_sparkle:pick(V2.deep,x,y));}
 if(k===2)return r<.14?pick(V2.dirtPebble,x,y,3):pick(V2.dirt,x,y);
 if(k===3)return r<.22?pick(V2.moss,x,y,3):pick(V2.basalt,x,y);
 if(k===4)return r<.12?pick(V2.sandPebble,x,y,3):pick(V2.sand,x,y);
 if(k===6)return pick([V.pavement_0,V.pavement_1,V.pavement_2],x,y); // v0.74+ 부두·선착장·보행교는 콘크리트(D41·D42·U01)
 return r<.2?pick(V2.sprouts,x,y,3):pick(V2.grass,x,y); // 풀밭(v0.68: 꽃은 땅에 그리지 않고 flowerTiles 자리에 세워요)
}
// v0.68 세워 그리는 들꽃 자리: 예전에 꽃 무늬 땅을 깔던 풀밭 칸(약 6%) 중 건물·물건·출입구 둘레를 뺀 곳
export function flowerTiles(map){
 if(map.kind==='room')return [];
 const busy=new Set(map.keepClear||[]);for(const k of map.solid||[])busy.add(k);
 for(const b of [...(map.buildings||[]),...(map.parsed?.structures||map.structures||[])])for(let y=b.y-1;y<=b.y+b.h;y++)for(let x=b.x-1;x<=b.x+b.w;x++)busy.add(`${x},${y}`);
 for(const d of map.decor||[])busy.add(`${d.x},${d.y}`);for(const g of map.ground||[])busy.add(`${g.x},${g.y}`);
 const out=[];
 for(let y=1;y<map.length-1;y++)for(let x=1;x<map[0].length-1;x++){const k=at(map,x,y);if([0,2,3,4,5,6,7].includes(k)||map.cliff?.face.has(`${x},${y}`)||map.rockTiles?.has(`${x},${y}`)||busy.has(`${x},${y}`))continue;const r=hash(x,y,17);if(r<.13)out.push([x,y,r<.06]);} // r<.06: 늘 피는 자리 · 나머지는 봄에만 더 피어요
 return out;
}
// 넘을 수 없는 바위 덩어리: 윗줄은 풀이 덮인 절벽 위, 아랫줄은 절벽 아래, 옆은 절벽 옆, 안쪽은 바위벽
export function v2Rock(map,x,y){
 const has=(a,b)=>map.rockTiles.has(`${x+a},${y+b}`);
 if(!has(0,-1))return V.cliff_top;if(!has(0,1))return V.cliff_bottom;if(!has(-1,0))return V.cliff_left;if(!has(1,0))return V.cliff_right;
 return pick(V2.rockface,x,y,5);
}
// 장식(충돌 없음): 바위 들판에 이끼·돌 부스러기, 풀밭에 풀포기, 물가 모래에 바닷풀 — 드문드문
const DT=V2_DETAILS.ids;
export function v2Detail(map,x,y){
 const k=at(map,x,y),r=hash(x,y,29);if(map.rockTiles?.has(`${x},${y}`))return null;
 if(k===3&&r<.18)return pick([DT.basalt_9,DT.basalt_10,DT.basalt_11,DT.basalt_12,DT.moss_13,DT.moss_14,DT.moss_15],x,y,7);
 if(k===1&&r<.05)return pick([DT.grass_19,DT.grass_20,DT.grass_21],x,y,7);
 if(k===4&&r<.08&&[[1,0],[-1,0],[0,1],[0,-1]].some(([a,b])=>at(map,x+a,y+b)===0))return DT.shore_weed;
 return null;
}
// 흙길·모래 가장자리에 덮이는 풀 끝(v2 풀 색)
const V2_GRASS='#6b9a42',V2_GRASS_DARK='#416f39';
function v2Edging(ctx,map,x,y){
 const k=at(map,x,y),px=x*TILE,py=y*TILE;if(k!==2&&k!==3&&k!==4)return;
 for(const [dx,dy] of [[0,-1],[1,0],[0,1],[-1,0]]){
  const n=at(map,x+dx,y+dy);if(!GRASSY(n)||map.rockTiles?.has(`${x+dx},${y+dy}`))continue;
  for(let i=0;i<16;i++){
   const h=((x*7+y*13+i*5)%3)+1,a=i*2;
   if(dy){ctx.fillStyle=V2_GRASS;ctx.fillRect(px+a,dy<0?py:py+32-h,2,h);ctx.fillStyle=V2_GRASS_DARK;ctx.fillRect(px+a,dy<0?py+h:py+32-h-1,2,1);}
   else{ctx.fillStyle=V2_GRASS;ctx.fillRect(dx<0?px:px+32-h,py+a,h,2);ctx.fillStyle=V2_GRASS_DARK;ctx.fillRect(dx<0?px+h:px+32-h-1,py+a,1,2);}
  }
 }
}
function paintGroundV2(ctx,map,v2,det){
 ctx.imageSmoothingEnabled=false;const depth=seaDepth(map);
 for(let y=0;y<map.length;y++)for(let x=0;x<map[y].length;x++){
  const id=map.rockTiles?.has(`${x},${y}`)?v2Rock(map,x,y):v2Tile(map,x,y,depth);
  ctx.drawImage(v2,...v2TileRect(id),x*TILE,y*TILE,TILE,TILE);
 }
 for(let y=0;y<map.length;y++)for(let x=0;x<map[y].length;x++)v2Edging(ctx,map,x,y);
 if(det)for(let y=0;y<map.length;y++)for(let x=0;x<map[y].length;x++){const id=v2Detail(map,x,y);if(id!=null)ctx.drawImage(det,...v2TileRect(id,V2_DETAILS.columns),x*TILE,y*TILE,TILE,TILE);}
}

function paintGround(ctx,map,sheet){
 ctx.imageSmoothingEnabled=false;
 for(let y=0;y<map.length;y++)for(let x=0;x<map[y].length;x++)tile(ctx,sheet,kinds[map[y][x]]||'grass',x,y);
 if(map.rockTiles?.size)for(const k of map.rockTiles){const [x,y]=k.split(',').map(Number);rockTile(ctx,map,x,y);}
 for(let y=0;y<map.length;y++)for(let x=0;x<map[y].length;x++)edging(ctx,map,x,y);
 if(typeof ctx.getImageData==='function'&&sheet){try{texture(ctx,map);}catch{/* 그림을 읽지 못하면 무늬 없이 */}}
 if(sheet){paintFlowers(ctx,map);banks(ctx,map);}
}

// v0.71 바닷속(잠수했을 때): 물 칸을 바다 밑바닥으로 — 깊을수록 푸르고 어두운 모래, 바위, 해초, 산호, 조개
let seaGround=null,seaKey='';
function paintSeabed(ctx,map,flat=true){
 // v0.87 「바닷속 HD-2D 에셋 v1」 바닥 타일(깊이별 무리, 칸마다 뒤집기를 섞어 반복이 덜 보여요). 그림이 아직이면 예전 색 칸
 const fl=assetImage(UW_FLOOR.key),L=seabedLayout(map);
 if(fl&&L.floor){ctx.save();ctx.imageSmoothingEnabled=false;
  const seam=!!UW_FLOOR.seamless; // v0.90 이음매 없는 타일은 뒤집지 않고 그대로(뒤집으면 가장자리가 안 맞아요)
  for(let y=0;y<map.length;y++)for(let x=0;x<map[0].length;x++){const id=L.floor[y][x];if(!id)continue;const i=UW_FLOOR.ids.indexOf(id),fx=!seam&&hash(x,y,97)<.5,fy=!seam&&hash(x,y,98)<.5;
   ctx.save();ctx.translate(x*TILE+(fx?TILE:0),y*TILE+(fy?TILE:0));ctx.scale(fx?-1:1,fy?-1:1);ctx.drawImage(fl,i*32,0,32,32,0,0,TILE,TILE);ctx.restore();}
  if(seam&&UW_FLOOR.band)for(let y=0;y<map.length;y++)for(let x=0;x<map[0].length;x++){const id=L.floor[y][x];if(!id)continue;const b=UW_FLOOR.band[id]; // 띠가 바뀌는 곳: 옆 띠의 색을 12px 안쪽까지 옅게 섞어요(양쪽에서 하니 가운데서 반반)
   for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const nid=L.floor[y+dy]?.[x+dx];if(!nid||UW_FLOOR.band[nid]===b)continue;const c=UW_FLOOR.bandColor[UW_FLOOR.band[nid]],X0=x*TILE+(dx>0?TILE:0),Y0=y*TILE+(dy>0?TILE:0),X1=X0-dx*14,Y1=Y0-dy*14;
    const g=ctx.createLinearGradient(X0,Y0,dx?X1:X0,dy?Y1:Y0);g.addColorStop(0,c+'99');g.addColorStop(1,c+'00');ctx.fillStyle=g;ctx.fillRect(dx>0?x*TILE+TILE-14:x*TILE,dy>0?y*TILE+TILE-14:y*TILE,dx?14:TILE,dy?14:TILE);}}
  if(flat)for(let y=0;y<map.length;y++)for(let x=0;x<map[0].length;x++){if(map[y][x]===0)continue;ctx.fillStyle=map[y][x]===6?'#6f7a80':(x+y)%3?'#2c3a42':'#33434b';ctx.fillRect(x*TILE,y*TILE,TILE,TILE);}
  const at=assetImage(UW_ATLAS.key);if(at&&flat)for(const it of L.items){const f=UW_ATLAS.frames[it.id];if(!f)continue;const w=f[2],h=f[3],cx=(it.x+(it.w||1)/2)*TILE,by=it.y*TILE+28;ctx.drawImage(at,f[0],f[1],w,h,Math.round(cx-w/2),Math.round(by-h),w,h);} // 2D 대체 화면: 납작하게
  const dots=assetImage(MONSTER_DOTS.key);if(flat&&dots)for(const it of L.items){if(!it.mon)continue;const f=MONSTER_DOTS.frames[String(it.mon).padStart(3,'0')];if(!f)continue;const cx=it.x*TILE+16,by=it.y*TILE+30;ctx.save();ctx.imageSmoothingEnabled=false;if(it.flip){ctx.translate(cx*2,0);ctx.scale(-1,1);}ctx.drawImage(dots,f[0],f[1],f[2],f[3],cx-Math.floor(f[2]/2),by-f[3],f[2],f[3]);ctx.restore();} // v0.89 바닥 우산몬(2D) · v0.91 원래 도트 1:1
  ctx.restore();return;}
 const depth=seaDepth(map);
 for(let y=0;y<map.length;y++)for(let x=0;x<map[0].length;x++){
  if(map[y][x]!==0)continue;const d=Math.min(4,depth[y][x]),px=x*TILE,py=y*TILE,r=hash(x,y,61);
  const base=['#c9b98e','#b2a98a','#93978a','#7a8888','#667a84'][d];ctx.fillStyle=base;ctx.fillRect(px,py,TILE,TILE);
  for(let i=0;i<6;i++){const a=hash(x,y,70+i);ctx.fillStyle=a<.5?'rgba(255,255,255,.12)':'rgba(0,0,0,.1)';ctx.fillRect(px+Math.floor(hash(x,y,80+i)*28),py+Math.floor(hash(x,y,90+i)*30),3,1);}
  if(r<.1){ctx.fillStyle='#5d6672';ctx.fillRect(px+8,py+14,14,9);ctx.fillStyle='#7c8794';ctx.fillRect(px+10,py+13,9,4);ctx.fillStyle='#46505b';ctx.fillRect(px+8,py+22,14,2);} // 바위
  else if(r<.3){const cx=px+6+Math.floor(hash(x,y,62)*18),h=10+Math.floor(hash(x,y,63)*14),c=hash(x,y,64)<.5?'#3f8f4a':'#5aa64b';ctx.fillStyle=c;for(let k=0;k<h;k++){const w=Math.round(Math.sin(k*.6+x)*1.5);ctx.fillRect(cx+w,py+28-k,2,1);ctx.fillRect(cx+4+Math.round(Math.sin(k*.6+y)*1.5),py+28-k*.8,2,1);}} // 해초
  else if(r<.38){const cx=px+10+Math.floor(hash(x,y,65)*12),c=hash(x,y,66)<.5?'#ef7f8f':'#f2a14a';ctx.fillStyle=c;ctx.fillRect(cx,py+18,2,10);ctx.fillRect(cx-4,py+20,2,6);ctx.fillRect(cx+4,py+19,2,7);ctx.fillRect(cx-4,py+24,10,2);ctx.fillStyle='#ffd0d6';ctx.fillRect(cx,py+17,2,2);} // 산호
  else if(r<.44){const cx=px+8+Math.floor(hash(x,y,67)*16);ctx.fillStyle='#f3e6d0';ctx.fillRect(cx,py+20,5,3);ctx.fillStyle='#d8b98e';ctx.fillRect(cx+1,py+21,3,1);} // 조개
 }
}
export function drawTerrain(ctx,map,time,{x=0,y=0,width=768,height=480,seabed=false}={}){
 // v0.67: 타일셋 v2 그림이 준비되면 v2로, 아직이면(또는 읽지 못하면) 예전 땅 그림으로 그려요
 const v2=assetImage(V2_TERRAIN.key),det=assetImage(V2_DETAILS.key),sheet=v2?null:assetImage(TERRAIN_ATLAS.key),tag=v2?(det?'v2d':'v2'):sheet;
 if(typeof document!=='undefined'){
  if(!ground||cachedMap!==map||cachedSheet!==tag||cachedTint!==assetTintTag()){cachedTint=assetTintTag();
   ground=document.createElement('canvas');ground.width=map[0].length*TILE;ground.height=map.length*TILE;
   if(v2)paintGroundV2(ground.getContext('2d'),map,v2,det);else paintGround(ground.getContext('2d'),map,sheet);cachedMap=map;cachedSheet=tag;
   paintCliffs(ground.getContext('2d'),map,v2); // v0.70 언덕·절벽·계단·사다리
   tintCanvas(ground,'ground'); // v0.68: 계절 색(풀 테두리까지 한 번에)
  }
  if(seabed){const k=map.id+'|'+cachedTint+'|'+cachedSheet+'|'+seabed+'|'+(assetImage(UW_FLOOR.key)?1:0)+(assetImage(UW_ATLAS.key)?1:0)+'|'+(assetImage(MONSTER_DOTS.key)?1:0);if(!seaGround||seaKey!==k){seaKey=k;seaGround=document.createElement('canvas');seaGround.width=ground.width;seaGround.height=ground.height;const g=seaGround.getContext('2d');g.drawImage(ground,0,0);paintSeabed(g,map,seabed!=='floor');}ctx.drawImage(seaGround,0,0);return;}
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
   // v0.66: 둔덕·얕은 물빛은 땅 그림에 미리 그려 두고, 여기서는 출렁이는 흰 거품만 그려요
   const off=v2?2:BANKY(n)?(dy<0?10:4):3;
   ctx.fillStyle='#ffffff';
   for(let i=0;i<8;i++){const bend=(i+xx+yy+phase)%4===0?1:(i+xx+yy+phase)%4===2?-1:0;
    if(dx)ctx.fillRect(px+(dx<0?off+bend:30-off-bend),py+i*4,2,4);
    else ctx.fillRect(px+i*4,py+(dy<0?off+bend:30-off-bend),4,2);
   }
   ctx.fillStyle='#d6f0ff';
   for(let i=0;i<8;i+=2){const k=(i+xx*3+yy+phase)%8;if(k>3)continue;
    if(dx)ctx.fillRect(px+(dx<0?off+3:27-off),py+i*4+1,1,2);else ctx.fillRect(px+i*4+1,py+(dy<0?off+3:27-off),2,1);}
  }
 }
}
