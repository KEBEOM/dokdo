import {PLAYER_SHEETS} from './player-art.js';
// Replace PNGs at these paths to customize the game. No fetch(), so file:// works.
const cache=new Map(),listeners=new Set();
export function onAssetReady(callback){listeners.add(callback);return ()=>listeners.delete(callback);}
export function assetImage(key){
  if(typeof Image==='undefined')return null;
  if(!cache.has(key)){
    const entry={image:new Image(),ready:false,failed:false};cache.set(key,entry);
    entry.image.onload=()=>{entry.ready=true;entry.failed=false;for(const fn of listeners)fn(key);};
    entry.image.onerror=()=>{entry.ready=false;entry.failed=true;for(const fn of listeners)fn(key);};
    entry.image.src=globalThis.DOKDOMON_EMBEDDED_ASSETS?.[key]||PLAYER_SHEETS[key]||`assets/${key}${/\.(png|jpe?g|webp)$/i.test(key)?'':'.png'}`;
  }
  const entry=cache.get(key);return entry.ready?entry.image:null;
}
export function drawAsset(ctx,key,x,y,width,height=width){
  const image=assetImage(key);if(!image)return false;
  const iw=image.naturalWidth||image.width,ih=image.naturalHeight||image.height;
  if(!iw||!ih)return false;
  const scale=Math.min(width/iw,height/ih),w=iw*scale,h=ih*scale;
  ctx.save();ctx.imageSmoothingEnabled=false;
  ctx.drawImage(image,Math.round(x+(width-w)/2),Math.round(y+(height-h)/2),w,h);ctx.restore();return true;
}
export function monsterAssetKey(id,back=false){return `monsters/${back?'back/':''}${String(id).padStart(3,'0')}`;}

export function assetStatus(key){return cache.get(key)?.failed?'failed':cache.get(key)?.ready?'ready':'loading';}
export function preloadMonsters(ids){for(const id of new Set(ids))for(const back of [false,true])assetImage(monsterAssetKey(id,back));}
