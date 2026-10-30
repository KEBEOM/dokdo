import assert from 'node:assert/strict';
import test from 'node:test';
import {MONSTERS,ZONES,getSpecies,starterPool,pickStarterField,STARTER_LEVEL} from '../dist/data.js';
import {CONCEPTS,QUESTIONS} from '../dist/learning.js';
import {newState,createMonster,addMonster,healAll,gainXP,damage,enemyHit,ENEMY_POWER,attackHit,SOFTEN_RATE,PIERCE_CHANCE,LEGEND_CAPTURE,captureChance,recordAnswer,validateSave,advantage,PP_MAX,skills,knownSkills,learnedBetween} from '../dist/engine.js';
import {createMap,npcs,pathfind,blocked,cameraFor,TILE,W,H} from '../dist/world.js';
import {MAPS} from '../dist/maps.js';
import {selectBattleQuestion,shuffledChoices} from '../dist/battle-quiz.js';

test('100 collectible species and real-name roster',()=>{
  for(const zone of ZONES){assert.ok(zone.wild.length>0,'every region has encounters');for(const id of [...zone.wild,...zone.bossTeam])assert.ok(MONSTERS.some(m=>m.id===id&&!m.legendary));}
  assert.equal(MONSTERS.length,100);assert.equal(new Set(MONSTERS.map(m=>m.id)).size,100);assert.equal(new Set(MONSTERS.map(m=>m.name)).size,100);
  assert.equal(starterPool().length,92);assert.ok(starterPool().every(id=>!getSpecies(id).legendary));assert.equal(STARTER_LEVEL,6);for(let k=0;k<20;k++){const f=pickStarterField();assert.equal(f.length,30);assert.equal(new Set(f).size,30);assert.ok(f.every(id=>starterPool().includes(id)));}assert.equal(getSpecies(100).legendary,true);
  for(const m of MONSTERS){assert.ok(m.zone>=0&&m.zone<8);if(m.source)assert.match(m.source,/^https:/);assert.equal(m.evolvesTo,null);if(m.evolvesTo){const to=getSpecies(m.evolvesTo);assert.equal(to.family,m.family);assert.equal(to.stage,m.stage+1);}}
  const obtainable=new Set(MONSTERS.filter(m=>m.stage===1).map(m=>m.id));for(const m of MONSTERS)if(m.evolvesTo&&obtainable.has(m.id))obtainable.add(m.evolvesTo);assert.equal(obtainable.size,100);
});
test('108 sourced learning questions across 12 concepts',()=>{
  assert.equal(CONCEPTS.length,12);assert.equal(QUESTIONS.length,108);assert.equal(new Set(QUESTIONS.map(q=>q.id)).size,108);assert.equal(new Set(QUESTIONS.map(q=>q.prompt)).size,108);
  for(const c of CONCEPTS){const cq=QUESTIONS.filter(q=>q.concept===c.id);assert.equal(cq.length,9);assert.ok(new Set(cq.map(q=>q.zone)).size>=4,'questions spread over the journey');}
  for(const q of QUESTIONS){assert.equal(q.options.length,4,'four choices: one answer and three tempting wrong answers');assert.ok(q.answer>=0&&q.answer<4);assert.equal(new Set(q.options).size,4);assert.ok(CONCEPTS.some(c=>c.id===q.concept));assert.match(q.source,/^https:/);assert.ok(q.zone>=0&&q.zone<8);}
});
test('every map: people on land, arrivals free, everyone and every exit reachable',()=>{
  const sides=[[1,0],[-1,0],[0,1],[0,-1]];
  for(const def of MAPS)for(const won of [false,true]){
    const map=createMap(def.id),people=npcs(map,{enemy:won},{});
    assert.equal(map.length,H);assert.ok(map.every(r=>r.length===W));
    for(const key of ['a','z']){const p=map.spawns[key];assert.ok(!blocked(map,p.x,p.y,people),`${def.id}: arrival ${key} is blocked`);}
    assert.equal(new Set(people.map(n=>`${n.x},${n.y}`)).size,people.length,'nobody overlaps');
    for(const n of people)assert.ok(!blocked(map,n.x,n.y,[],true),`${def.id}: ${n.name} must stand on land`);
    const s=map.spawns.a;
    for(const n of people){
      const paths=sides.map(([dx,dy])=>pathfind(map,s.x,s.y,n.x+dx,n.y+dy,people));
      assert.ok(paths.some(p=>p.length)||sides.some(([dx,dy])=>n.x+dx===s.x&&n.y+dy===s.y),`${def.id}: ${n.name} is unreachable`);
      for(const p of paths){let last=[s.x,s.y];for(const [x,y] of p){assert.equal(Math.abs(x-last[0])+Math.abs(y-last[1]),1);assert.ok(!blocked(map,x,y,people));last=[x,y];}}
    }
    for(const [k] of map.exits){const [x,y]=k.split(',').map(Number);assert.ok(pathfind(map,s.x,s.y,x,y,people).length,`${def.id}: exit ${k} unreachable`);}
    assert.deepEqual(pathfind(map,s.x,s.y,0,0,people),[]);
  }
});
test('a correct answer to the opponent question still hurts, but much less',()=>{
  const me=createMonster(1,8),foe=createMonster(34,9),rng=()=>.5;
  const full=enemyHit(foe,me,{correct:false},rng),soft=enemyHit(foe,me,{correct:true},rng);
  assert.equal(full,damage(foe,me,ENEMY_POWER,rng).amount);assert.ok(soft>=1&&soft<full,'correct answers soften the blow');assert.equal(soft,Math.max(1,Math.round(full*SOFTEN_RATE)));
  assert.equal(SOFTEN_RATE,.6,'a correct answer takes 40% off');assert.equal(enemyHit(foe,me,{correct:true,pierce:true},rng),full,'boss pierce: full damage even when correct');assert.ok(PIERCE_CHANCE>0&&PIERCE_CHANCE<1);
  // my attack: type advantage x1.5 when correct, half of the plain hit when wrong; neutral/weak wrong answers miss
  const leaf=createMonster(1,10),light=createMonster(28,10),rock=createMonster(55,10);const fixed=()=>.5;
  const good=attackHit(leaf,light,true,1.3,fixed),plain=attackHit(leaf,rock,true,1.3,fixed),miss=attackHit(leaf,rock,false,1.3,fixed),half=attackHit(leaf,light,false,1.3,fixed);
  assert.equal(good.mult,1.5);assert.equal(miss.amount,0);assert.ok(half.amount>0&&half.amount<good.amount);assert.equal(half.amount,Math.max(1,Math.round(good.amount/1.5*.5)));
});
test('damage, type advantage, capture and recovery remain finite',()=>{
  const s=newState();addMonster(s,createMonster(21,5));const foe=createMonster(47,5);assert.equal(advantage('wave','rock'),1.5);assert.equal(advantage('rock','wave'),.75);assert.ok(damage(s.party[0],foe,1,()=>.5).amount>0);
  const full=captureChance(foe);foe.hp=1;assert.ok(captureChance(foe)>full);assert.equal(captureChance(createMonster(100)),.1,'legendaries: fixed 10%');assert.equal(captureChance({...createMonster(68),hp:1}),LEGEND_CAPTURE);
  s.party[0].hp=0;s.party[0].pp=[0,0,0,0];healAll(s);assert.equal(s.party[0].hp,s.party[0].maxHp);assert.deepEqual(s.party[0].pp,PP_MAX);
});
test('starter keeps its biological name as it levels and party overflows to storage',()=>{
  const m=createMonster(1,7);gainXP(m,91);assert.equal(m.level,8);assert.equal(m.id,1);while(m.level<16)gainXP(m,m.level*13);assert.equal(m.id,1);
  const s=newState();for(let i=1;i<=7;i++)addMonster(s,createMonster(i));assert.equal(s.party.length,6);assert.equal(s.storage.length,1);assert.equal(s.caught.length,7);
});
test('learning logs separate incorrect, assisted and independent responses',()=>{
  const s=newState(),q=QUESTIONS[0];recordAnswer(s,q,false,false);recordAnswer(s,q,true,true);assert.equal(s.learning[q.concept].independent,0);assert.equal(s.answerLog.length,2);s.sessionId='second';recordAnswer(s,q,true,false);const r=s.learning[q.concept];assert.equal(r.independent,1);assert.equal(r.sessions.length,2);assert.equal(r.attempts,3);
});
test('v0.22 saves keep the map, the visited towns and one-time objects; older saves are placed safely',()=>{
  const s=newState();s.started=true;addMonster(s,createMonster(67,5));s.zone=2;s.map='route2';s.visited=[0,1,2];s.flags={'route1:5':true};s.x=20;s.y=14;
  const v=validateSave(JSON.parse(JSON.stringify(s)));assert.equal(v.map,'route2');assert.deepEqual(v.visited,[0,1,2]);assert.equal(v.flags['route1:5'],true);assert.equal(v.x,20);
  const mismatch=validateSave({...JSON.parse(JSON.stringify(s)),map:'route5'});assert.equal(mismatch.map,'town2','a route from another chapter falls back to that chapter town');
  const old=JSON.parse(JSON.stringify(s));delete old.map;delete old.visited;delete old.flags;old.badges=[0,1];old.x=9;old.y=21;
  const m=validateSave(old);assert.equal(m.map,'town2');assert.deepEqual(m.visited,[0,1,2]);assert.deepEqual(m.flags,{});
  const sp=createMap('town2').spawns.a;assert.deepEqual([m.x,m.y],[sp.x,sp.y],'legacy positions move to the arrival point');
  for(const mutate of [v=>v.visited=[9],v=>v.flags=[],v=>v.flags={x:'yes'}]){const bad=JSON.parse(JSON.stringify(s));mutate(bad);assert.throws(()=>validateSave(bad));}
});
test('save roundtrip and malformed import rejection',()=>{
  const s=newState();s.started=true;addMonster(s,createMonster(67,5));recordAnswer(s,QUESTIONS[0],true);const clone=()=>JSON.parse(JSON.stringify(s));const loaded=validateSave(clone());assert.equal(loaded.party[0].id,67);assert.equal(loaded.learning.G1.correct,1);
  for(const mutate of [v=>v.zone=9,v=>v.party=[],v=>v.party[0].id=101,v=>v.coins='<img>',v=>v.items.heal=-3,v=>v.learning.G1.sessions=null,v=>v.progress[0].met='yes',v=>v.answerLog[0].time=1e20]){const bad=clone();mutate(bad);assert.throws(()=>validateSave(bad));}
});
test('combat question selection spaces repeats and revisits missed concepts',()=>{
  const s=newState();s.zone=3;
  const missed=QUESTIONS.find(q=>q.concept==='H3'&&q.zone<=3);
  recordAnswer(s,missed,false,false,{mode:'battle',phase:'attack',opponent:21});
  recordAnswer(s,QUESTIONS.find(q=>q.concept==='G1'),true);
  recordAnswer(s,QUESTIONS.find(q=>q.concept==='G2'),true);
  recordAnswer(s,QUESTIONS.find(q=>q.concept==='N3'),true);
  const next=selectBattleQuestion(s,()=>.5);assert.equal(next.concept,'H3');assert.ok(next.zone<=s.zone);
  recordAnswer(s,next,true);assert.notEqual(selectBattleQuestion(s,()=>.5).id,next.id);
  const order=shuffledChoices(next,()=>.5);assert.deepEqual([...order].sort(),[0,1,2,3]);
  assert.equal(s.answerLog[0].mode,'battle');assert.equal(s.answerLog[0].phase,'attack');
});

 test('explorer selection survives saves and legacy saves keep progress',()=>{
  const s=newState();s.started=true;s.avatar='boy';addMonster(s,createMonster(1,5));s.badges=[0,1];const loaded=validateSave(JSON.parse(JSON.stringify(s)));assert.equal(loaded.avatar,'boy');
  delete s.avatar;const legacy=validateSave(JSON.parse(JSON.stringify(s)));assert.equal(legacy.avatar,null);assert.deepEqual(legacy.badges,[0,1]);
  s.avatar='other';assert.equal(validateSave(s).avatar,null);
 });

test('former starters, exact spreadsheet names and NO.100',()=>{
 assert.deepEqual([1,67,66].map(id=>getSpecies(id).name),['해국','괭이갈매기','독도새우']);
 assert.equal(getSpecies(3).name,'섬기린초');assert.equal(getSpecies(100).name,'강치');
 assert.deepEqual(MONSTERS.filter(m=>m.legendary).map(m=>m.name),['사철나무','소쩍새','뿔쇠오리','매','황조롱이','고니','흑두루미','강치'],'천연기념물 7종 + 강치 are legendary');
 assert.deepEqual(MONSTERS.filter(m=>m.forms===2).map(m=>m.id),[18,68,70,71,72,75,76],'seven legendaries have a 변환폼 (v0.47: 사철나무 too)');
 // legendary 우산몬 exist once in the whole game: never in the grass, a 관장 team or a 백무단 team
 const reachable=new Set(ZONES.flatMap(z=>[...z.wild,...z.bossTeam]));assert.equal(new Set(ZONES.flatMap(z=>z.wild)).size,92,"100 - 8 legendaries (the old starters now live in the wild too)");
 for(const id of [18,68,70,71,72,75,76,100])assert.ok(!reachable.has(id),`${id} is unique`);
});
test('v0.8 saves retain progress and migrate species once',()=>{
 const s=newState();delete s.rosterVersion;s.started=true;s.party=[createMonster(1,12),createMonster(69,16),createMonster(21,8)];s.storage=[createMonster(100,34)];s.seen=[1,2,3,67,69,100];s.caught=[1,3,69,100];s.badges=[0,1];s.progress[0].boss=true;
 recordAnswer(s,QUESTIONS[0],true,false,{opponent:59});
 const migrated=validateSave(s);assert.deepEqual(migrated.party.map(m=>m.id),[67,1,49]);assert.equal(migrated.storage[0].id,100);assert.deepEqual(migrated.seen,[67,1,100]);assert.deepEqual(migrated.badges,[0,1]);assert.equal(migrated.answerLog[0].opponent,66);assert.equal(migrated.party[0].level,12);assert.equal(s.party[0].id,1);
 assert.deepEqual(validateSave(migrated).party.map(m=>m.id),[67,1,49]);
});


test('responsive cameras stay in bounds and preserve tile positions',()=>{
 for(const [width,height] of [[682,468],[390,844],[844,390],[640,400]])for(const view of [{x:0,y:0},{x:21,y:15},{x:41,y:29}]){
  const c=cameraFor(view,width,height);assert.ok(c.x>=0&&c.y>=0);assert.ok(c.x<=Math.max(0,W*TILE-width));assert.ok(c.y<=Math.max(0,H*TILE-height));assert.equal(c.x,Math.floor(c.x));assert.equal(c.y,Math.floor(c.y));
  const centerX=view.x*TILE+16-c.x,centerY=view.y*TILE+16-c.y;assert.equal(Math.floor((centerX+c.x)/TILE),view.x);assert.equal(Math.floor((centerY+c.y)/TILE),view.y);
 }
});

test('skills: two at first, more as the 우산몬 grows; 정화 skills only', () => {
  const m = createMonster(1, 5);
  assert.deepEqual(knownSkills(m).map(s => s.kind), ['attack', 'guard'], 'Lv5: an attack skill and a guard skill');
  assert.equal(knownSkills(createMonster(1, 1)).length, 2, 'Lv1 starts with two');
  assert.equal(knownSkills(createMonster(1, 8)).length, 3); assert.equal(knownSkills(createMonster(1, 12)).length, 4);
  assert.deepEqual(learnedBetween(m, 7, 12).map(s => s.index).sort(), [1, 2]);
  assert.equal(skills(m).length, 4); assert.deepEqual(m.pp, PP_MAX);
  const grown = createMonster(1, 7); let before = grown.level; gainXP(grown, 7 * 13); assert.equal(grown.level, 8); assert.equal(learnedBetween(grown, before, grown.level).length, 1);
});
test('no wild 우산몬 stand on the grass; the legendary tree is only seen on 천장굴 and joins from 백무 사장', () => {
  const p = { met: true, studied: 2, enemy: false, boss: false };
  for (const def of MAPS) for (const n of npcs(createMap(def.id), p, {})) assert.notEqual(n.kind, 'wild', `${def.id}: no monster standing on the grass`);
  const legends = MAPS.flatMap(def => npcs(createMap(def.id), p, {}).filter(n => n.kind === 'legend').map(n => [def.id, n.species]));
  assert.deepEqual(legends, [], 'no legend waits on the map: 사철나무 is in 백무 사장\'s team');
  const tree = MAPS.flatMap(def => npcs(createMap(def.id), p, {}).filter(n => n.kind === 'observe' && n.species === 18).map(() => def.id));
  assert.deepEqual(tree, ['route1'], 'the real tree can be observed from afar on 천장굴 길');
});
test('v0.42: every 우산몬 has its own 체력·공격·방어·스피드, legends are stronger, faster friends run away more easily',async()=>{
  const {MONSTERS}=await import('../dist/data.js');const {stats,runChance}=await import('../dist/engine.js');
  const total=m=>m.base.hp+m.base.attack+m.base.defense+m.base.speed;
  for(const m of MONSTERS){assert.deepEqual(Object.keys(m.base),['hp','attack','defense','speed'],m.name);for(const v of Object.values(m.base))assert.ok(v>=30&&v<=140,m.name);}
  const normal=MONSTERS.filter(m=>!m.legendary).map(total),legend=MONSTERS.filter(m=>m.legendary).map(total);
  assert.ok(Math.min(...legend)>Math.max(...normal),'legends beat every normal 우산몬 in total');
  assert.ok(new Set(MONSTERS.map(m=>JSON.stringify(m.base))).size>=40,'stats really differ');
  assert.ok(stats(56,10).defense>stats(94,10).defense&&stats(94,10).speed>stats(56,10).speed,'거북손 is tough, 칼새 is fast');
  const a=stats(10,20);assert.ok(a.maxHp>stats(10,5).maxHp&&a.attack>stats(10,5).attack,'stats grow with level');
  assert.ok(runChance({speed:30},{speed:10})>runChance({speed:10},{speed:30}));
});
test('v0.44: XP per purified or befriended foe — a share of my next level, more for stronger foes',async()=>{
  const {xpForDefeat,XP_RATE,XP_CAP,BENCH_RATE}=await import('../dist/engine.js');
  assert.equal(xpForDefeat(10,10),Math.round(10*13*XP_RATE),'same level: 35% of a level');
  assert.ok(xpForDefeat(10,15)>xpForDefeat(10,10)&&xpForDefeat(10,5)<xpForDefeat(10,10),'stronger foes give more');
  assert.equal(xpForDefeat(5,50),Math.round(5*13*XP_CAP),'capped at 150% of a level');
  assert.equal(xpForDefeat(10,10,BENCH_RATE),Math.round(10*13*XP_RATE*BENCH_RATE),'friends on the bench get half');
  assert.ok(xpForDefeat(30,30)>xpForDefeat(5,5),'measured against my own level');
});
test('v0.47: you can save in 나리분지 초원 before picking your first friend, and nowhere else without one',()=>{
 const s=newState();s.started=true;s.map='meadow0';s.starterField=[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,19,20,21,22,23,24,25,26,27,28,29,30,31];
 const v=validateSave(JSON.parse(JSON.stringify(s)));assert.equal(v.map,'meadow0');assert.equal(v.party.length,0);assert.equal(v.starterField.length,30);
 assert.throws(()=>validateSave({...JSON.parse(JSON.stringify(s)),map:'town0'}),'no friend outside the meadow');
 assert.throws(()=>validateSave({...JSON.parse(JSON.stringify(s)),starterField:[]}),'the meadow needs its friends');
 const done=JSON.parse(JSON.stringify(s));done.party=[createMonster(1,6)];const d=validateSave(done);assert.equal(d.map,'town0');assert.equal(d.starterField,undefined,'after picking you are never sent back to the meadow');
});
test('v0.47 다섯 속성 고리: 파도→바위→바람→풀→빛→파도, and every gym team matches its gym',async()=>{
 const {TYPES,GYM_TEAMS}=await import('../dist/data.js');const {TYPE_RING,TYPE_REASON}=await import('../dist/engine.js');
 assert.deepEqual(Object.keys(TYPES).sort(),['leaf','light','rock','wave','wind']);
 assert.deepEqual(['wave','rock','wind','leaf','light'].map(t=>TYPES[t].name),['파도','바위','바람','풀','빛']);
 let t='wave';const seen=[];for(let i=0;i<5;i++){seen.push(t);t=TYPE_RING[t];}assert.equal(t,'wave','one single loop');assert.equal(new Set(seen).size,5,'through all five');
 for(const a of seen){assert.ok(TYPE_REASON[a]);for(const b of seen){const v=advantage(a,b);assert.equal(v,TYPE_RING[a]===b?1.5:TYPE_RING[b]===a?.75:1);}}
 assert.ok(MONSTERS.every(m=>m.type in TYPES),'every 우산몬 has one of the five');
 GYM_TEAMS.forEach((team,i)=>team.forEach(id=>assert.equal(getSpecies(id).type,ZONES[i].type,`${ZONES[i].boss}: ${getSpecies(id).name}`)));
});
