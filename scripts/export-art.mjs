// Developer utility: export the built-in Canvas art. Do not run over custom art.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {MONSTERS} from '../dist/data.js';
import {drawMonsterDefault,drawHumanDefault} from '../dist/sprites.js';
import {npcs,BUILDINGS,drawHouseDefault,drawTreeDefault} from '../dist/world.js';
const require=createRequire(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/package.json');
const {createCanvas}=require('@napi-rs/canvas');
const out=path.resolve('dist/assets');
const rows=[['파일','이름','용도','권장 가로','권장 세로','모티브 또는 비고']];
function write(key,w,h,label,usage,note,draw){
  const canvas=createCanvas(w,h),ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;draw(ctx);
  const dest=path.join(out,key+'.png');fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,canvas.toBuffer('image/png'));
  rows.push(['assets/'+key+'.png',label,usage,w,h,note]);return canvas;
}
const sheet=createCanvas(1000,1400),sc=sheet.getContext('2d');sc.fillStyle='#edf1df';sc.fillRect(0,0,1000,1400);sc.imageSmoothingEnabled=false;
for(const m of MONSTERS){
  const key=String(m.id).padStart(3,'0');
  const canvas=write('monsters/'+key,128,128,m.name,'정면 · 도감 / 상대 / 필드',m.motif,c=>drawMonsterDefault(c,m.id,0,0,128));
  write('monsters/back/'+key,128,128,m.name,'내 동료 · 전투',m.motif+' · 기본 파일은 정면 좌우 반전',c=>drawMonsterDefault(c,m.id,0,0,128,0,true));
  const x=((m.id-1)%10)*100,y=Math.floor((m.id-1)/10)*140;sc.drawImage(canvas,x+2,y+3,96,96);sc.fillStyle='#244b50';sc.font='bold 13px sans-serif';sc.textAlign='center';sc.fillText('NO. '+key,x+50,y+118,96);
}
for(const dir of ['down','up','left','right'])for(let step=0;step<2;step++)write(`player/${dir}-${step}`,64,64,'주인공',`${dir} · 걷기 ${step}`,'투명 정사각형. 발은 아래쪽에 맞춰요.',c=>{c.scale(2,2);drawHumanDefault(c,0,0,'#418e91',dir,step);});
for(let zone=0;zone<8;zone++)for(const n of npcs(zone,{enemy:false}))if(!['board','wild'].includes(n.kind))write(n.sprite,64,64,n.name,`${zone+1}지역 NPC`,n.kind||'normal',c=>{c.scale(2,2);drawHumanDefault(c,0,0,n.color,'down',0,n.kind);});
for(const b of BUILDINGS)write('scenery/'+b.kind,b.w*32+32,b.h*32+64,b.name,'마을 건물','출입 위치와 충돌 범위는 기존 지도 유지',c=>{c.translate(8,24);drawHouseDefault(c,{...b,x:0,y:0,name:''});});
write('scenery/tree',48,64,'나무','지도 장식','투명 배경',c=>drawTreeDefault(c,16,32));
fs.writeFileSync(path.join(out,'monster-contact-sheet.png'),sheet.toBuffer('image/png'));
const quote=x=>'"'+String(x).replaceAll('"','""')+'"';
fs.writeFileSync(path.join(out,'image-list.csv'),'\ufeff'+rows.map(r=>r.map(quote).join(',')).join('\r\n'));
const esc=x=>String(x).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('\"','&quot;');
fs.writeFileSync(path.join(out,'image-catalog.html'),'<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>우산몬 이미지 목록</title><style>body{font:15px system-ui;background:#eef1e7;color:#244b50;margin:24px}main{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px}article{background:white;border-radius:12px;padding:14px;overflow-wrap:anywhere}img{display:block;width:128px;height:128px;object-fit:contain;image-rendering:pixelated;margin:auto}small{display:block;margin-top:8px;color:#637d70}a{color:inherit}</style><h1>우산몬 이미지 목록</h1><p>교체용 PNG 273장 · 그림을 누르면 원본 파일이 열립니다. 같은 이름으로 바꾸고 게임을 새로고침하세요.</p><main>'+rows.slice(1).map(([file,name,use,w,h,note])=>`<article><a href="${file.slice(7)}"><img src="${file.slice(7)}" alt="${esc(name)}"></a><strong>${esc(name)}</strong><small>${esc(use)} · ${w}×${h}</small><small>${file}</small><small>${esc(note)}</small></article>`).join('')+'</main></html>');
console.log(`Exported ${rows.length-1} replaceable PNGs + 100-species contact sheet.`);
