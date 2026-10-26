// Shared map palette and integer-pixel sprite recipe. Used only when baking PNGs.
// Runtime characters use the resulting small atlas directly.
export const MAP_PALETTE={
  outline:'#344d50',hairDark:'#615847',hair:'#897553',hairLight:'#ad9369',
  skinShade:'#bc956c',skin:'#dcba8b',skinLight:'#ebcf9e',
  orangeShade:'#a77854',orange:'#c39865',orangeLight:'#d4b17b',
  blueShade:'#486a70',blue:'#688b91',blueLight:'#94afa7',
  tealShade:'#426e65',teal:'#668f7b',tealLight:'#95b193',
  redShade:'#996e59',red:'#bc8b70',yellow:'#d5bc7e',
  pants:'#627064',pantsShade:'#4d6159',shoe:'#45615b',cream:'#e5d9b0'
};
const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
const colors=Object.values(MAP_PALETTE).map(rgb),cache=new Map();
export function mapColor(r,g,b){
  const key=(r<<16)|(g<<8)|b;if(cache.has(key))return cache.get(key);
  let best=colors[0],score=Infinity;
  for(const c of colors){const d=(r-c[0])**2*.3+(g-c[1])**2*.5+(b-c[2])**2*.2;if(d<score){best=c;score=d;}}
  cache.set(key,best);return best;
}
export function cleanSourceFrame(pixels){
  const out=new Uint8ClampedArray(pixels),seen=new Uint8Array(1024),queue=[];
  const visit=(x,y)=>{if(x<0||x>=32||y<0||y>=32)return;const n=y*32+x;if(seen[n])return;seen[n]=1;const i=n*4,r=out[i],g=out[i+1],b=out[i+2];if(!out[i+3]||(Math.min(r,g,b)>=180&&Math.max(r,g,b)-Math.min(r,g,b)<30)){out[i+3]=0;queue.push(n);}};
  for(let i=0;i<32;i++){visit(i,0);visit(i,31);visit(0,i);visit(31,i);}
  for(let h=0;h<queue.length;h++){const n=queue[h],x=n%32,y=Math.floor(n/32);visit(x-1,y);visit(x+1,y);visit(x,y-1);visit(x,y+1);}
  for(let i=0;i<out.length;i+=4)if(out[i+3]){
    const [r,g,b]=out.subarray(i,i+3),warm=r>=g+3&&g>=b+3;
    const hair=warm&&r<130&&g<110;
    out.set(hair?rgb(r<72?MAP_PALETTE.hairDark:r<108?MAP_PALETTE.hair:MAP_PALETTE.hairLight):mapColor(r,g,b),i);out[i+3]=255;
  }
  return out;
}
export const ACTOR_IDS=['girl','boy','child-boy','child-girl','child-girl-ribbon','man','woman'];
export function actorPose(pose){
  // 0 rest, 1/3 opposite foot contacts, 2/4 opposite passing poses.
  return {passing:pose===2||pose===4,sign:pose===1||pose===2?1:pose? -1:0};
}
export function createActorFrame(heads,id,direction,pose=0,blink=false){
  const P=MAP_PALETTE,out=new Uint8ClampedArray(32*32*4),{passing,sign}=actorPose(pose),bob=passing?-1:0;
  const rgba=Object.fromEntries(Object.entries(P).map(([k,v])=>[k,[...rgb(v),255]]));
  const pixel=(x,y,color)=>{if(x>=0&&x<32&&y>=0&&y<32)out.set(rgba[color],(y*32+x)*4);};
  const rect=(x,y,w,h,color)=>{for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)pixel(i,j,color);};
  const box=(x,y,w,h,color)=>{rect(x,y,w,h,'outline');if(w>2&&h>2)rect(x+1,y+1,w-2,h-2,color);};
  const line=(a,b,width,color)=>{let [x,y]=a,[tx,ty]=b;const dx=Math.abs(tx-x),sx=x<tx?1:-1,dy=-Math.abs(ty-y),sy=y<ty?1:-1;let err=dx+dy;
    while(true){rect(x-Math.floor(width/2),y-Math.floor(width/2),width,width,color);if(x===tx&&y===ty)break;const e=2*err;if(e>=dy){err+=dy;x+=sx;}if(e<=dx){err+=dx;y+=sy;}}
  };
  const outfit=id==='child-boy'?'blue':id==='child-girl'||id==='child-girl-ribbon'?'red':id==='man'?'cream':'orange';
  const skirt=id==='child-girl'||id==='child-girl-ribbon'||id==='woman';
  const student=id==='girl'||id==='boy';
  const side=direction==='right'||direction==='left',back=direction==='up';
  if(side){
    // Explicit hip/knee/ankle poses: no stretching or shearing strips from the source.
    const legs=pose===0?[[[15,23],[15,26],[15,29]],[[18,23],[18,26],[18,29]]]:passing?
      (sign>0?[[[15,23],[16,25],[16,27]],[[18,23],[18,26],[18,29]]]:[[[15,23],[15,26],[15,29]],[[18,23],[17,25],[17,27]]]):
      (sign>0?[[[15,23],[13,25],[12,28]],[[18,23],[19,26],[21,29]]]:[[[15,23],[17,26],[20,29]],[[18,23],[16,25],[14,28]]]);
    legs.forEach((points,near)=>{
      for(let n=0;n<2;n++)line(points[n],points[n+1],3,'outline');
      for(let n=0;n<2;n++)line(points[n],points[n+1],1,near?'pants':'pantsShade');
      const [fx,fy]=points[2];rect(fx-1,fy-1,4,2,'shoe');pixel(fx+1,fy-1,near?'pants':'pantsShade');
    });
    const swing=passing?0:sign*2;
    const arm=(near)=>{const sx=near?17:16,hand=sx+(near?-swing:swing);line([sx,18+bob],[hand,22+bob],3,'outline');line([sx,18+bob],[hand,21+bob],1,outfit);rect(hand,22+bob,2,2,'skin');};
    arm(false);box(13,15+bob,8,10,outfit);
    if(student||id==='child-boy'){box(10,16+bob,4,8,'teal');rect(11,18+bob,2,3,'tealLight');}
    rect(18,16+bob,2,5,id==='boy'?'blue':id==='girl'?'tealShade':outfit);
    if(skirt)box(13,22+bob,9,4,id==='child-girl-ribbon'?'red':'blueShade');
    arm(true);
  }else{
    const leftLift=pose===0?0:(sign<0?2:0),rightLift=pose===0?0:(sign>0?2:0);
    for(const [x,lift] of [[12,leftLift],[17,rightLift]]){
      box(x,23,4,7-lift,'pants');rect(x,28-lift,4,2,'shoe');rect(x+1,28-lift,2,1,'pants');
    }
    const adult=id==='man'||id==='woman';
    box(adult?10:11,15+bob,adult?12:10,10,outfit);
    rect(12,16+bob,2,6,outfit==='orange'?'orangeLight':outfit);
    rect(15,16+bob,2,7,student?(id==='girl'?'tealShade':'blueShade'):outfit);
    if(student&&!back){rect(12,16+bob,1,6,'tealShade');rect(19,16+bob,1,6,'tealShade');rect(13,21+bob,1,2,'orangeShade');rect(18,21+bob,1,2,'orangeShade');}
    if(id==='child-boy'){rect(12,17+bob,2,6,'blueShade');rect(18,17+bob,2,6,'blueShade');rect(14,19+bob,4,3,'blueShade');}
    if(id==='child-girl')rect(11,21+bob,10,2,'yellow');
    if(skirt)box(10,23+bob,12,3,id==='child-girl-ribbon'?'red':'blueShade');
    if(id==='child-girl-ribbon'&&!back)rect(12,20+bob,8,3,'cream');
    if(id==='woman'&&!back){rect(12,18+bob,8,2,'yellow');rect(13,22+bob,2,1,'yellow');rect(18,22+bob,2,1,'yellow');}
    if(back&&(student||id==='child-boy')){box(12,16+bob,8,7,'teal');rect(14,18+bob,4,1,'tealLight');rect(14,21+bob,4,1,'tealShade');}
    for(const [x,s] of [[adult?8:9,-1],[adult?21:20,1]]){
      const dy=passing?0:sign*s;box(x,17+bob+dy,3,6,outfit);rect(x+1,21+bob+dy,2,2,'skin');
    }
  }
  // Head silhouette from the supplied drawing, fitted to the same map-sized body.
  const head=heads[back?'up':side?'right':'down'];
  for(let y=0;y<16;y++)for(let x=0;x<28;x++){
    const sx=Math.min(31,Math.floor((x+.5)*32/28)),sy=Math.min(17,Math.floor((y+.5)*18/16));
    let from=(sy*32+sx)*4,source=head;
    if(blink&&!side&&!back&&sy>=10&&sy<=14&&sx>=9&&sx<=22)source=heads.blink;
    if(source[from+3])out.set(source.subarray(from,from+4),((y+bob+1)*32+x+2)*4);
  }
  // One shared contact line for every direction, including thick diagonal leg pixels.
  out.fill(0,30*32*4);
  if(direction==='left'){
    const flipped=new Uint8ClampedArray(out.length);
    for(let y=0;y<32;y++)for(let x=0;x<32;x++)flipped.set(out.subarray((y*32+x)*4,(y*32+x)*4+4),(y*32+31-x)*4);
    return flipped;
  }
  return out;
}
