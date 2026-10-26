import {assetImage} from './assets.js';
import {SCENERY_ATLAS} from './scenery-atlas.js';
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
