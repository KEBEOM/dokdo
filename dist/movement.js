// One tile is one footstep. A complete left/right stride spans two tiles.
export const MOVE_DURATION=220;
export const STRIDE_PIXELS=64;
export function stepProgress(start,now){const elapsed=now-start;return elapsed>=MOVE_DURATION-1e-6?1:Math.max(0,elapsed/MOVE_DURATION);}
export function strideFrame(distance){return Math.floor(((distance%STRIDE_PIXELS)+STRIDE_PIXELS)%STRIDE_PIXELS/16);}
export function moveView(view,step,now){
  const t=stepProgress(step.start,now),x=step.fromX+(step.toX-step.fromX)*t,y=step.fromY+(step.toY-step.fromY)*t;
  const distance=(Math.abs(x-view.x)+Math.abs(y-view.y))*32;
  view.x=x;view.y=y;return {complete:t===1,distance};
}
