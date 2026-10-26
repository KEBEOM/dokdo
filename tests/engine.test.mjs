import assert from 'node:assert/strict';
import test from 'node:test';
import {MONSTERS,STARTERS,ZONES,getSpecies} from '../dist/data.js';
import {CONCEPTS,QUESTIONS} from '../dist/learning.js';
import {newState,createMonster,addMonster,healAll,gainXP,damage,enemyHit,SOFTEN_RATE,captureChance,recordAnswer,validateSave,advantage,PP_MAX,skills,knownSkills,learnedBetween} from '../dist/engine.js';
import {createMap,npcs,pathfind,blocked,cameraFor,TILE,W,H} from '../dist/world.js';
import {MAPS} from '../dist/maps.js';
import {selectBattleQuestion,shuffledChoices} from '../dist/battle-quiz.js';

test('100 collectible species and real-name roster',()=>{
  for(const zone of ZONES){assert.ok(zone.wild.length>0,'every region has encounters');for(const id of [...zone.wild,...zone.bossTeam])assert.ok(MONSTERS.some(m=>m.id===id&&!m.legendary));}
  assert.equal(MONSTERS.length,100);assert.equal(new Set(MONSTERS.map(m=>m.id)).size,100);assert.equal(new Set(MONSTERS.map(m=>m.name)).size,100);
  assert.deepEqual(STARTERS.map(id=>getSpecies(id).stage),[1,1,1]);assert.equal(getSpecies(100).legendary,true);
  for(const m of MONSTERS){assert.ok(m.zone>=0&&m.zone<8);if(m.source)assert.match(m.source,/^https:/);assert.equal(m.evolvesTo,null);if(m.evolvesTo){const to=getSpecies(m.evolvesTo);assert.equal(to.family,m.family);assert.equal(to.stage,m.stage+1);}}
  const obtainable=new Set(MONSTERS.filter(m=>m.stage===1).map(m=>m.id));for(const m of MONSTERS)if(m.evolvesTo&&obtainable.has(m.id))obtainable.add(m.evolvesTo);assert.equal(obtainable.size,100);
});
test('36 sourced learning questions across 12 concepts',()=>{
  assert.equal(CONCEPTS.length,12);assert.equal(QUESTIONS.length,36);assert.equal(new Set(QUESTIONS.map(q=>q.id)).size,36);
  for(const c of CONCEPTS)assert.equal(QUESTIONS.filter(q=>q.concept===c.id).length,3);
  for(const q of QUESTIONS){assert.equal(q.options.length,3);assert.ok(q.answer>=0&&q.answer<3);assert.ok(CONCEPTS.some(c=>c.id===q.concept));assert.match(q.source,/^https:/);assert.ok(q.zone>=0&&q.zone<8);}
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
  assert.equal(full,damage(foe,me,1,rng).amount);assert.ok(soft>=1&&soft<full,'correct answers soften the blow');assert.equal(soft,Math.max(1,Math.round(full*SOFTEN_RATE)));
  assert.ok(enemyHit(foe,me,{correct:true,guard:true},rng)<=soft,'the guard skill softens it further');
});
test('damage, type advantage, capture and recovery remain finite',()=>{
  const s=newState();addMonster(s,createMonster(21,5));const foe=createMonster(47,5);assert.equal(advantage('wave','rock'),1.5);assert.equal(advantage('rock','wave'),.75);assert.ok(damage(s.party[0],foe,1,()=>.5).amount>0);
  const full=captureChance(foe);foe.hp=1;assert.ok(captureChance(foe)>full);assert.equal(captureChance(createMonster(100)),0);
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
  const order=shuffledChoices(next,()=>.5);assert.deepEqual([...order].sort(),[0,1,2]);
  assert.equal(s.answerLog[0].mode,'battle');assert.equal(s.answerLog[0].phase,'attack');
});

 test('explorer selection survives saves and legacy saves keep progress',()=>{
  const s=newState();s.started=true;s.avatar='boy';addMonster(s,createMonster(1,5));s.badges=[0,1];const loaded=validateSave(JSON.parse(JSON.stringify(s)));assert.equal(loaded.avatar,'boy');
  delete s.avatar;const legacy=validateSave(JSON.parse(JSON.stringify(s)));assert.equal(legacy.avatar,null);assert.deepEqual(legacy.badges,[0,1]);
  s.avatar='other';assert.equal(validateSave(s).avatar,null);
 });

test('requested starters, exact spreadsheet names and NO.100',()=>{
 assert.deepEqual(STARTERS.map(id=>getSpecies(id).name),['해국','괭이갈매기','독도새우']);
 assert.equal(getSpecies(3).name,'섬기린초');assert.equal(getSpecies(100).name,'강치');
 assert.deepEqual(MONSTERS.filter(m=>m.legendary).map(m=>m.name),['사철나무','강치'],'two legendary 독도몬');
 // legendary and starter 독도몬 exist once in the whole game: never in the grass, a 관장 team or a 백무단 team
 const reachable=new Set(ZONES.flatMap(z=>[...z.wild,...z.bossTeam]));assert.equal(new Set(ZONES.flatMap(z=>z.wild)).size,95);
 for(const id of [1,66,67,18,100])assert.ok(!reachable.has(id),`${id} is unique`);
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

test('skills: two at first, more as the 독도몬 grows; 정화 skills only', () => {
  const m = createMonster(1, 5);
  assert.deepEqual(knownSkills(m).map(s => s.kind), ['attack', 'guard'], 'Lv5: an attack skill and a guard skill');
  assert.equal(knownSkills(createMonster(1, 1)).length, 2, 'Lv1 starts with two');
  assert.equal(knownSkills(createMonster(1, 8)).length, 3); assert.equal(knownSkills(createMonster(1, 12)).length, 4);
  assert.deepEqual(learnedBetween(m, 7, 12).map(s => s.index).sort(), [1, 2]);
  assert.equal(skills(m).length, 4); assert.deepEqual(m.pp, PP_MAX);
  const grown = createMonster(1, 7); let before = grown.level; gainXP(grown, 7 * 13); assert.equal(grown.level, 8); assert.equal(learnedBetween(grown, before, grown.level).length, 1);
});
test('no wild 독도몬 stand on the grass; the legendary tree waits on 천장굴', () => {
  const p = { met: true, studied: 2, enemy: false, boss: false };
  for (const def of MAPS) for (const n of npcs(createMap(def.id), p, {})) assert.notEqual(n.kind, 'wild', `${def.id}: no monster standing on the grass`);
  const legends = MAPS.flatMap(def => npcs(createMap(def.id), p, {}).filter(n => n.kind === 'legend').map(n => [def.id, n.species]));
  assert.deepEqual(legends, [['route1', 18]]);
});
