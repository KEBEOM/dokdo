import {assetImage} from './assets.js';
import {SCENERY_ATLAS} from './scenery-atlas.js';
import {ISLAND_ATLAS} from './island-atlas.js';
// Crop the original transparent atlas; fit without stretching and align the feet.
export function drawScenery(ctx,kind,x,y,width,height){
 const monument=kind==='monument',frame=monument?SCENERY_ATLAS.monument.rect:SCENERY_ATLAS.frames[kind];
 const sheet=assetImage(monument?SCENERY_ATLAS.monument.key:SCENERY_ATLAS.key);
 if(!frame)return false;
 if(!sheet)return true;
 const [sx,sy,sw,sh]=frame,scale=Math.min(width/sw,height/sh);
 const w=Math.round(sw*scale),h=Math.round(sh*scale);
 ctx.save();ctx.imageSmoothingEnabled=false;
 ctx.drawImage(sheet,sx,sy,sw,sh,Math.round(x+(width-w)/2),Math.round(y+height-h),w,h);
 ctx.restore();return true;
}
// 울릉도·독도 그림(scripts/draw-island-art.py): 게임 1픽셀 그대로, 발끝(아래)을 맞춰 그려요. cropW로 왼쪽 일부만 그릴 수 있어요.
export function drawIslandArt(ctx,key,x,y,width,height,cropW=null){
 const frame=ISLAND_ATLAS.frames[key],sheet=assetImage(ISLAND_ATLAS.key);
 if(!frame)return false;
 if(!sheet)return true;
 const [sx,sy,sw,sh]=frame,w=Math.min(sw,cropW??sw);
 ctx.save();ctx.imageSmoothingEnabled=false;
 ctx.drawImage(sheet,sx,sy,w,sh,Math.round(x+(width-sw)/2),Math.round(y+height-sh),w,sh);
 ctx.restore();return true;
}
