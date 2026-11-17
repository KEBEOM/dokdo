import {assetImage} from './assets.js';
import {strideFrame,MOVE_DURATION} from './movement.js';
import {SHEET_KEYS,PICTURE_KEYS,BASELINE,pixelPrint,sheetAtlas} from './character-sheets.js';
import {EXPLORER_ATLAS} from './explorer-atlas.js';
import {V2_CHARACTERS} from './tileset-v2.js';
import {NPC_ATLASES as RESIDENT_ATLASES} from './npc-atlases.js';
import {VILLAIN_ATLASES} from './villain-atlases.js';
// v0.54: 주인공과 김박사는 Aseprite로 고치는 도트 시트(character-sheets.js)에서 그려요.
export const EXPLORER_ATLASES={boy:sheetAtlas(SHEET_KEYS.boy,{dot:1}),girl:sheetAtlas(SHEET_KEYS.girl,{dot:1})};
// 고치기 전에 쓰는 원본 그림(예전 큰 그림)
const splitExplorer=who=>({key:EXPLORER_ATLAS.key,width:EXPLORER_ATLAS.width,height:EXPLORER_ATLAS.height,unit:EXPLORER_ATLAS.unit,rows:{down:0,right:1,up:2},frames:['down','right','up'].map(d=>EXPLORER_ATLAS.frames[EXPLORER_ATLAS.rows[who][d]])});
// v0.67 타일셋 v2: 같은 원본 그림(explorers-atlas-v17)을 64×72칸에 발끝(32, 68)을 맞춰 정리한 그림. 한 방향에 5장을 모두 걷기에 써요.
// unit 64: 캐릭터 상자(48)에 그리면 0.75배 — 예전 원본 그림과 키가 같아서 김박사·마을 사람들과 나란히 서도 어색하지 않아요.
const normalizedExplorer=who=>{const C=V2_CHARACTERS,W=C.frameWidth,H=C.frameHeight,R=C.rows[who];
 return {key:C.key,width:W*C.columns,height:H*6,unit:64,dot:1,walk:5,rows:{down:0,right:1,up:2},
  frames:['down','right','up'].map(d=>Array.from({length:C.columns},(_,c)=>({rect:[c*W,R[d]*H,W,H],anchor:[c*W+C.foot[0],R[d]*H+C.foot[1]]})))};};
export const EXPLORER_V2={boy:normalizedExplorer('boy'),girl:normalizedExplorer('girl')};
const ORIGINAL={boy:EXPLORER_V2.boy,girl:EXPLORER_V2.girl,professor:RESIDENT_ATLASES.professor};
export const EXPLORER_V17={boy:splitExplorer('boy'),girl:splitExplorer('girl')}; // 예전 방식(원본을 그대로 잘라 쓰기) — 비교·되돌리기용
const ORIGINAL_PICTURE={[PICTURE_KEYS.boy]:'characters/explorer-boy-portrait-v33',[PICTURE_KEYS.girl]:'characters/explorer-girl-portrait-v33',[PICTURE_KEYS.professor]:'characters/professor-portrait-v33'};
// 시트를 고쳤는지: 'edited'(고침) · 'same'(처음 그대로) · null(아직 그림을 읽는 중)
const sheetState=new Map();
export function sheetEdited(key){
 if(!BASELINE[key])return true;
 if(sheetState.has(key))return sheetState.get(key)==='edited';
 const img=assetImage(key);if(!img)return null;
 let st='edited';
 try{const w=img.naturalWidth||img.width,h=img.naturalHeight||img.height,c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');g.drawImage(img,0,0);st=pixelPrint(w,h,g.getImageData(0,0,w,h).data)===BASELINE[key]?'same':'edited';}catch{st='edited';}
 sheetState.set(key,st);return st==='edited';
}
// 지금 그릴 걷기 그림: 고친 시트가 있으면 시트, 아니면 원본
function liveAtlas(id){const sheet=id==='professor'?SHEET_PROFESSOR:EXPLORER_ATLASES[id];return sheet&&sheetEdited(sheet.key)===true?sheet:ORIGINAL[id]||sheet;}
// 큰 그림도 같은 규칙(cutscene.js · paintPicture)
export function pictureKey(key){return ORIGINAL_PICTURE[key]&&sheetEdited(key)!==true?ORIGINAL_PICTURE[key]:key;}
// 몽땅랜드 시트도 8픽셀 = 1도트인 도트 그림이에요.
for(const a of Object.values(VILLAIN_ATLASES))a.dot??=8;
// Residents plus the 몽땅랜드 designs; every NPC sheet shares one format.
const SHEET_PROFESSOR=sheetAtlas(SHEET_KEYS.professor,{dot:1});
export const NPC_ATLASES={...RESIDENT_ATLASES,...VILLAIN_ATLASES};
// picture: the large drawing shown in the character choice window (scripts/import-heroes.py)
export const EXPLORERS=[{id:'girl',label:'여학생',picture:PICTURE_KEYS.girl,sheet:SHEET_KEYS.girl},{id:'boy',label:'남학생',picture:PICTURE_KEYS.boy,sheet:SHEET_KEYS.boy}];
export const PROFESSOR_PICTURE=PICTURE_KEYS.professor;
export const RESIDENTS=[
 {id:'child-boy',label:'남자아이',sheet:'characters/child-boy-atlas-v18'},
 {id:'child-girl',label:'여자아이 · 양갈래 머리',sheet:'characters/child-girl-atlas-v18'},
 {id:'child-girl-ribbon',label:'여자아이 · 리본',sheet:'characters/child-girl-ribbon-atlas-v18'},
 {id:'man',label:'아저씨',sheet:'characters/man-atlas-v18'},
 {id:'woman',label:'아줌마',sheet:'characters/woman-atlas-v18'},
 {id:'professor',label:'김박사',sheet:SHEET_KEYS.professor},
 ...Object.entries(VILLAIN_ATLASES).map(([id,a])=>({id,label:a.label,sheet:a.key,villain:true}))
];
export const CHARACTER_SIZE=48;
export function explorerInfo(id){return EXPLORERS.find(p=>p.id===id)||EXPLORERS[0];}
// 서 있을 때는 0번 그림. 걸을 때: v2 그림은 5장(0→1→2→3→4, 16픽셀마다 한 장 = 한 칸에 2장),
// Aseprite 시트는 걷기 4장(1→4). 왼쪽은 오른쪽 그림을 통째로 뒤집어요.
export const WALK5_PIXELS=16;
export const walk5Frame=distance=>Math.floor((((distance%(WALK5_PIXELS*5))+WALK5_PIXELS*5)%(WALK5_PIXELS*5))/WALK5_PIXELS);
export function explorerFrame(id,direction,walking,distance=0){
 const atlas=liveAtlas(explorerInfo(id).id),dir=['up','left','right'].includes(direction)?direction:'down';
 const row=atlas.rows[dir==='left'?'right':dir];
 const col=!walking?0:atlas.walk===5?walk5Frame(distance):1+strideFrame(distance);
 return {row,col,flip:dir==='left',...atlas.frames[row][col]};
}
const residentAtlas=id=>id==='professor'?liveAtlas('professor'):NPC_ATLASES[id];
export function residentFrame(id,direction='down',walking=false,distance=0){
 const atlas=residentAtlas(id);if(!atlas)return null;
 const dir=['up','left','right'].includes(direction)?direction:'down',row=atlas.rows[dir==='left'?'right':dir],col=walking?1+strideFrame(distance):0;
 return {row,col,flip:dir==='left',...atlas.frames[row][col]};
}
// v0.57 도트를 고르게: 도트 시트(atlas.dot = 원본에서 한 도트의 픽셀 수)는 화면의 실제 픽셀에 맞춰
// 한 도트 = 정수 k 픽셀로 그려요. 1.5배처럼 어중간한 배율이면 어떤 도트는 1칸, 어떤 도트는 2칸이 되어 깨져 보여요.
// 발끝(기준점)을 화면 픽셀에 맞추고, k는 원래 크기에 가장 가까운 정수예요(키가 몇 % 달라질 수 있어요).
// 배율이 정수에서 멀면(예: 2.5) 정수로 맞추면 키가 20%나 달라져요. 그때는 시트를 정수 배로 또렷하게 키운 그림을
// 부드럽게 줄여 그려서, 크기는 그대로 두고 도트 굵기만 고르게 해요.
const upscaled=new Map();
function upscale(img,n){
 if(typeof document==='undefined')return null;
 const key=img.src+'@'+n;if(upscaled.has(key))return upscaled.get(key);
 const c=document.createElement('canvas');c.width=(img.naturalWidth||img.width)*n;c.height=(img.naturalHeight||img.height)*n;
 const g=c.getContext('2d');g.imageSmoothingEnabled=false;g.drawImage(img,0,0,c.width,c.height);upscaled.set(key,c);return c;
}
// 입체 시점에서는 깊이에 따라 크기가 계속 바뀌어서, 정수 배로 맞추지 않고 늘 부드럽게 줄여 그려요(크기가 툭툭 바뀌지 않게).
let pixelSnap=true;
export function setPixelSnap(on){pixelSnap=!!on;}
function drawCrisp(ctx,img,atlas,f,x,y,size){
 const m=typeof ctx.getTransform==='function'?ctx.getTransform():null;
 if(!atlas.dot||!m||typeof m.a!=='number'||!(m.a>0)||m.b||m.c||Math.abs(m.a-m.d)>1e-6)return false;
 const [sx,sy,sw,sh]=f.rect,[ax,ay]=f.anchor,dot=atlas.dot,want=size/atlas.unit*dot*m.a,k=Math.max(1,Math.round(want));
 const px=Math.round(m.a*(x+size/2)+m.e),py=Math.round(m.d*(y+size*.9375)+m.f);
 const exact=pixelSnap&&Math.abs(want-k)<=.2*Math.max(1,want/4);
 ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.translate(px,py);if(f.flip)ctx.scale(-1,1);
 if(exact){ctx.imageSmoothingEnabled=false;ctx.drawImage(img,sx,sy,sw,sh,Math.round((sx-ax)/dot)*k,Math.round((sy-ay)/dot)*k,sw/dot*k,sh/dot*k);}
 else{
  const n=Math.max(2,Math.ceil(want)),big=atlas.dot===1?upscale(img,n):null,src=big||img,r=big?n:1;
  ctx.imageSmoothingEnabled=true;if('imageSmoothingQuality' in ctx)ctx.imageSmoothingQuality='high';
  ctx.drawImage(src,sx*r,sy*r,sw*r,sh*r,(sx-ax)/dot*want,(sy-ay)/dot*want,sw/dot*want,sh/dot*want);
 }
 ctx.restore();return true;
}
export function drawResident(ctx,id,x,y,size=CHARACTER_SIZE,time=0,dir='down',walking=false,distance=0){
 const atlas=residentAtlas(id),f=residentFrame(id,dir,walking,distance);if(!atlas||!f)return false;
 const sheet=assetImage(atlas.key);if(!sheet)return true;
 const [sx,sy,sw,sh]=f.rect,[ax,ay]=f.anchor,scale=size/atlas.unit;
 ctx.save();ctx.imageSmoothingEnabled=false;ctx.fillStyle='#244b5028';ctx.fillRect(Math.round(x+size*.28),Math.round(y+size*.91),Math.round(size*.44),Math.max(1,Math.round(size*.04)));ctx.restore();
 if(drawCrisp(ctx,sheet,atlas,f,x,y,size))return true;
 ctx.save();ctx.imageSmoothingEnabled=false;ctx.translate(Math.round(x+(f.flip?size:0)),Math.round(y));if(f.flip)ctx.scale(-1,1);
 ctx.drawImage(sheet,sx,sy,sw,sh,Math.round(size/2+(sx-ax)*scale),Math.round(size*.9375+(sy-ay)*scale),sw*scale,sh*scale);ctx.restore();return true;
}
export function drawExplorer(ctx,id,x,y,size=CHARACTER_SIZE,dir='down',walking=false,distance=0,shadow=true){
 const atlas=liveAtlas(explorerInfo(id).id),sheet=assetImage(atlas.key);if(!sheet)return true;
 const f=explorerFrame(id,dir,walking,distance),[sx,sy,sw,sh]=f.rect,[ax,ay]=f.anchor;
 const scale=size/atlas.unit;
 const dx=size/2+(sx-ax)*scale,dy=size*.9375+(sy-ay)*scale;
 if(shadow){ctx.save();ctx.fillStyle='#244b5028';ctx.fillRect(Math.round(x+size*.28),Math.round(y+size*.91),Math.round(size*.44),Math.max(1,Math.round(size*.04)));ctx.restore();}
 if(drawCrisp(ctx,sheet,atlas,f,x,y,size))return true;
 ctx.save();ctx.imageSmoothingEnabled=false;
 ctx.translate(Math.round(x+(f.flip?size:0)),Math.round(y));if(f.flip)ctx.scale(-1,1);
 // Exactly one PNG frame per draw. Anchors align the body and ground without stretching limbs.
 ctx.drawImage(sheet,sx,sy,sw,sh,Math.round(dx),Math.round(dy),sw*scale,sh*scale);
 ctx.restore();return true;
}
export function paintExplorerCard(canvas,id,time=0,walking=false){
 const c=canvas.getContext('2d');c.clearRect(0,0,canvas.width,canvas.height);
 return drawExplorer(c,id,0,0,canvas.width,'down',walking,time/MOVE_DURATION*32);
}
// Large pictures (512×512, feet on the same line): the explorer drawings and 김박사.
export function paintPicture(canvas,key){
 const c=canvas.getContext('2d'),img=assetImage(pictureKey(key));c.clearRect(0,0,canvas.width,canvas.height);if(!img)return false;
 c.imageSmoothingEnabled=false;const s=Math.min(canvas.width/img.width,canvas.height/img.height);
 c.drawImage(img,Math.round((canvas.width-img.width*s)/2),Math.round(canvas.height-img.height*s),Math.round(img.width*s),Math.round(img.height*s));return true;
}
export function paintExplorerPortrait(canvas,id){
 if(paintPicture(canvas,explorerInfo(id).picture))return true;
 const c=canvas.getContext('2d');c.clearRect(0,0,canvas.width,canvas.height); // until the picture loads: the walking sprite
 return drawExplorer(c,id,0,0,canvas.width,'down',false,0,false);
}
