import {PLAYER_SHEETS} from './player-art.js';
// Replace PNGs at these paths to customize the game. No fetch(), so file:// works.
const cache=new Map(),listeners=new Set();
// v0.68 그림 색 바꾸기 고리(계절, season.js): tint(key, image)가 돌려준 그림을 tag별로 기억해 써요
let tintFn=null,tintTag='';
export function setAssetTint(fn,tag){tintFn=fn;tintTag=String(tag||'');for(const fn2 of listeners)fn2('*tint');}
export const assetTintTag=()=>tintTag;
export function onAssetReady(callback){listeners.add(callback);return ()=>listeners.delete(callback);}
export function assetImage(key){
  if(typeof Image==='undefined')return null;
  if(!cache.has(key)){
    const entry={image:new Image(),ready:false,failed:false};cache.set(key,entry);
    entry.image.onload=()=>{entry.ready=true;entry.failed=false;for(const fn of listeners)fn(key);};
    entry.image.onerror=()=>{entry.ready=false;entry.failed=true;for(const fn of listeners)fn(key);};
    entry.image.src=globalThis.DOKDOMON_EMBEDDED_ASSETS?.[key]||PLAYER_SHEETS[key]||`assets/${key}${/\.(png|jpe?g|webp)$/i.test(key)?'':'.png'}`;
  }
  const entry=cache.get(key);if(!entry.ready)return null;
  if(!tintFn)return entry.image;
  if(entry.tag!==tintTag){entry.tag=tintTag;try{entry.tinted=tintFn(key,entry.image)||entry.image;}catch{entry.tinted=entry.image;}}
  return entry.tinted;
}
export function drawAsset(ctx,key,x,y,width,height=width){
  const image=assetImage(key);if(!image)return false;
  const iw=image.naturalWidth||image.width,ih=image.naturalHeight||image.height;
  if(!iw||!ih)return false;
  const scale=Math.min(width/iw,height/ih),w=iw*scale,h=ih*scale;
  ctx.save();ctx.imageSmoothingEnabled=false;
  ctx.drawImage(image,Math.round(x+(width-w)/2),Math.round(y+(height-h)/2),w,h);ctx.restore();return true;
}
// v0.41: 전설의 우산몬 변환폼은 '68-2'처럼 적어요 → monsters/068-2.png (노멀폼은 monsters/068.png)
export function monsterAssetKey(id){const [n,f]=String(id).split('-');return `monsters/${n.padStart(3,'0')}${f&&f!=='1'?'-'+f:''}`;}

// 그림 파일 주소 (한 파일 오프라인 판에서는 HTML 안에 넣은 그림)
export function assetURL(key){return globalThis.DOKDOMON_EMBEDDED_ASSETS?.[key]||PLAYER_SHEETS[key]||`assets/${key}${/\.(png|jpe?g|webp)$/i.test(key)?'':'.png'}`;}
export function assetStatus(key){return cache.get(key)?.failed?'failed':cache.get(key)?.ready?'ready':'loading';}
export function preloadMonsters(ids){for(const id of new Set(ids))assetImage(monsterAssetKey(id));}
