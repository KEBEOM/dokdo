import {getSpecies,TYPES,ROSTER_VERSION,LEGACY_SPECIES_MAP} from './data.js';
import {MAP_BY_ID,parseMap,MAP_W,MAP_H} from './maps.js';
const START=parseMap('town0').spawns.a;
// v0.42 우산몬마다 다른 기본 능력치(data.js의 base: 체력·공격·방어·스피드, 보통 75). 레벨이 오르면 같이 커져요.
//   기본값 차이의 절반만 반영해요(차이는 살리되 너무 벌어지지 않게): 배율 = (기본값+75)/150
const DEFAULT_BASE={hp:75,attack:75,defense:75,speed:75};
// v0.83 하트: 체력(hp·maxHp)은 하트 반 칸 단위예요(2 = 하트 1개). 우산몬마다 기본 3~5개(바탕 체력이 클수록 많아요),
//   6레벨마다 반 개씩 늘고, 아무리 커도 HEART_MAX개(반 칸 HEART_MAX*2)까지예요.
//   vit는 예전 체력 크기(공격·방어로 정해지는 충격의 기준). 충격 = 예전 계산의 충격 ÷ vit × 하트 칸 수 → 반 칸 단위로 반올림(최소 반 칸).
export const HEART_MAX=8;
export function heartsMax(id,level){const b=getSpecies(id).base||DEFAULT_BASE,base=Math.max(6,Math.min(10,Math.round(6+(b.hp-45)/85*4)));return Math.min(HEART_MAX*2,base+Math.floor((Math.max(1,level)-1)/6));}
export function toHalves(amount,defender){if(!(amount>0))return 0;const full=heartsMax(defender.id,defender.level),vit=defender.vit||stats(defender.id,defender.level).vit;return Math.max(1,Math.round(amount/vit*full));}
export const heartText=n=>{const v=Math.max(0,n)/2;return Number.isInteger(v)?String(v):v.toFixed(1);}; // 반 칸 수 → ‘3.5’
export function stats(id,level){const b=getSpecies(id).base||DEFAULT_BASE,k=v=>(v+75)/150;return {maxHp:heartsMax(id,level),vit:Math.round((29+level*5)*k(b.hp)),attack:Math.max(1,Math.round((11+level*2)*k(b.attack))),defense:Math.max(1,Math.round((8+level)*k(b.defense))),speed:Math.max(1,Math.round((8+level)*k(b.speed)))};}
// 물러나기: 내 우산몬이 빠를수록 잘 돼요(30%~95%).
export const runChance=(me,foe)=>Math.min(.95,Math.max(.3,.6+(me.speed-foe.speed)/(me.speed+foe.speed)));
export function createMonster(id,level=4){const s=stats(id,level);return {uid:`m${Date.now().toString(36)}${Math.random().toString(36).slice(2,7)}`,id,level,xp:0,hp:s.maxHp,...s,pp:PP_MAX.slice()};}
// v0.47 속성 고리(독도의 자연): 파도→바위→바람→풀→빛→파도. 화살표 앞의 속성이 뒤의 속성에 강해요.
//   파도가 바위를 깎아요(해식동굴·독립문바위) · 바위가 거센 바람을 막아요 · 바닷바람 때문에 독도의 풀과 나무는 키가 작아요
//   풀은 햇빛을 받아 양분을 만들어요(광합성) · 햇볕이 바닷물을 데워 증발시켜요(물의 순환)
export const TYPE_RING={wave:'rock',rock:'wind',wind:'leaf',leaf:'light',light:'wave'};
export const TYPE_REASON={wave:'파도가 바위를 깎아 독립문바위와 천장굴 같은 모양을 만들었어요.',rock:'바위가 거센 바닷바람을 막아 줘요.',wind:'거센 바닷바람 때문에 독도의 풀과 나무는 키가 작아요.',leaf:'풀은 햇빛을 받아 양분을 만들어요(광합성).',light:'햇볕이 바닷물을 데워 수증기로 날려 보내요(물의 순환).'};
export function advantage(a,b){return TYPE_RING[a]===b?1.5:TYPE_RING[b]===a?.75:1;}
export function damage(attacker,defender,power=1,rng=Math.random){const mult=advantage(getSpecies(attacker.id).type,getSpecies(defender.id).type);return {amount:Math.max(3,Math.round((attacker.attack*power-defender.defense*.45)*mult*(.9+rng()*.2))),mult};}
// v0.42 결투 규칙
//  막기: 상대의 문제 공격은 늘 들어오지만, 정답을 맞히면 충격이 40% 줄어요(60%만 받아요).
//        독도 지킴이 결투와 마지막 백무 사장 결투(보스)는 PIERCE_CHANCE(15%) 확률로 정답을 맞혀도 그대로 들어와요(관통).
//  공격: 문제 카드를 골라 풀어요. 맞히면 정화(상성이 좋으면 1.5배, 나쁘면 0.75배).
//        틀리면 빗나가지만, 상성이 좋은 상대에게는 틀려도 보통 위력의 절반이 닿아요.
export const SOFTEN_RATE=.6, PIERCE_CHANCE=.15, QUESTION_POWER=1.3, WRONG_ADVANTAGE_RATE=.5;
export const BOSS_KINDS=['boss','rematch']; // + 마지막 백무 사장 결투(game.js isBoss)
// ENEMY_POWER: 상대가 문제로 공격할 때의 위력(난이도 손잡이). 낮출수록 쉬워요.
export let ENEMY_POWER=.6;
export function setEnemyPower(v){ENEMY_POWER=v;}
// v0.83 하트 규칙(반 칸 = 0.5개): 못 막으면 적어도 반 개 · 정답으로 막으면 그보다 적게(반 개짜리는 완전히 막아요) · 보호는 반으로 · 관통은 그대로
export function enemyHit(attacker,defender,{correct=false,guard=false,pierce=false}={},rng=Math.random){const full=Math.max(1,toHalves(damage(attacker,defender,ENEMY_POWER,rng).amount,defender));let d=full;if(correct&&!pierce)d=full<=1?0:Math.max(1,Math.min(full-1,Math.round(full*SOFTEN_RATE)));if(guard&&d>0)d=Math.max(1,Math.ceil(d/2));return d;}
// 내 공격: {amount(하트 반 칸 수), mult}. 맞히면 적어도 하트 1개. 틀렸을 때 상성이 좋으면 보통 위력(상성 1배)의 절반, 아니면 0.
export function attackHit(attacker,defender,correct,power=QUESTION_POWER,rng=Math.random){const d=damage(attacker,defender,power,rng);if(correct)return {amount:Math.max(2,toHalves(d.amount,defender)),mult:d.mult};if(d.mult>1)return {amount:Math.max(1,toHalves(d.amount/d.mult*WRONG_ADVANTAGE_RATE,defender)),mult:d.mult};return {amount:0,mult:d.mult};} // 하트 반 칸 수
// 기술: 처음(Lv1)에는 손길(정화)과 보호 두 가지, Lv8에 숨 고르기(회복), Lv12에 파동(강한 정화)을 배웁니다.
// 배열 순서(0 손길, 1 파동, 2 숨 고르기, 3 보호)는 저장 파일의 기술 횟수(pp) 순서와 같습니다.
export const PP_MAX=[25,8,8,10];
export const LEARN_LEVEL=[1,12,8,1];
const SKILL_NAMES={wave:['물결 손길','너울 파동','숨 고르기','파도 보호'],wind:['바람 손길','돌풍 파동','숨 고르기','순풍 보호'],rock:['바위 손길','묵직한 파동','숨 고르기','바위 보호'],leaf:['잎새 손길','꽃잎 파동','잎새 회복','초록 보호'],light:['빛줄기','반짝 파동','숨 고르기','별빛 보호']};
export function skills(m){const t=getSpecies(m.id).type;return SKILL_NAMES[t].map((name,i)=>({index:i,name,kind:i<2?'attack':i===2?'heal':'guard',power:i===1?1.74:1.2,max:PP_MAX[i],learn:LEARN_LEVEL[i]}));}
// The skills this 우산몬 can use now, in the order they were learned.
export function knownSkills(m){return skills(m).filter(s=>m.level>=s.learn).sort((a,b)=>a.learn-b.learn||a.index-b.index);}
// Skills learned when the level rises from `from` to `to`.
export function learnedBetween(m,from,to){return skills(m).filter(s=>s.learn>from&&s.learn<=to);}
export function healAll(state){for(const m of state.party){const st=stats(m.id,m.level);Object.assign(m,st);m.hp=m.maxHp;m.pp=PP_MAX.slice();}return state;}
// v0.44 경험치: 결투가 끝날 때가 아니라, 상대 우산몬을 정화하거나 동료로 만들 때마다 받아요.
//   내 레벨에서 다음 레벨까지 필요한 경험치(레벨×13)의 XP_RATE(35%)를 기준으로, 상대 레벨이 높을수록 더 많이(상대 레벨 ÷ 내 레벨).
//   한 번에 다음 레벨까지 필요한 양의 150%를 넘지 않아요. 결투에 나와 있던 동료는 전부, 나머지 동료는 절반을 받아요.
export const XP_RATE=.35,XP_CAP=1.5,BENCH_RATE=.5;
export function xpForDefeat(myLevel,foeLevel,share=1){const need=myLevel*13;return Math.max(1,Math.round(Math.min(need*XP_CAP,need*XP_RATE*foeLevel/myLevel)*share));}
export function gainXP(m,amount){m.xp+=amount;const changes=[];while(m.xp>=m.level*13){m.xp-=m.level*13;m.level++;changes.push(`${getSpecies(m.id).name} Lv.${m.level}`);const sp=getSpecies(m.id);if(sp.evolvesTo&&m.level>=sp.evolveLevel){m.id=sp.evolvesTo;changes.push(`${sp.name} → ${getSpecies(m.id).name}`);}Object.assign(m,stats(m.id,m.level));m.hp=m.maxHp;m.pp=PP_MAX.slice();}return changes;}
// 동료 만들기: 검은 기운이 적을수록 잘 돼요. 전설의 우산몬은 10%에서 시작해요.
export const LEGEND_CAPTURE=.1;
// tries: 그 전설의 우산몬에게 지금까지 손을 내밀었다가 실패한 횟수 — 한 번 실패할 때마다 5%씩 올라요(최대 60%)
export const LEGEND_STEP=.05,LEGEND_MAX=.6;
export function captureChance(enemy,tries=0){if(getSpecies(enemy.id).legendary)return Math.min(LEGEND_MAX,LEGEND_CAPTURE+LEGEND_STEP*Math.max(0,tries));return Math.min(.93,.45+(1-enemy.hp/enemy.maxHp)*.43);}
// 함께 다니는 동료는 4마리까지(v0.60). 그보다 많이 만나면 동료 보관함(storage)으로 가요.
export const PARTY_MAX=4;
export function addMonster(state,mon){if(state.party.length<PARTY_MAX)state.party.push(mon);else state.storage.push(mon);if(!state.caught.includes(mon.id))state.caught.push(mon.id);if(!state.seen.includes(mon.id))state.seen.push(mon.id);}
export function recordAnswer(state,q,correct,assisted=false,context={}){const r=state.learning[q.concept]||{attempts:0,correct:0,independent:0,seen:[],sessions:[],last:0};r.attempts++;if(correct){r.correct++;if(!assisted)r.independent++;}if(!r.seen.includes(q.id))r.seen.push(q.id);if(!r.sessions.includes(state.sessionId))r.sessions.push(state.sessionId);r.last=Date.now();state.learning[q.concept]=r;state.answerLog.push({q:q.id,concept:q.concept,correct,assisted,time:Date.now(),session:state.sessionId,mode:context.mode||'study',phase:context.phase||'',opponent:context.opponent||null,zone:state.zone});if(state.answerLog.length>2000)state.answerLog.shift();return r;}
export function newState(){return {schema:1,hearts:1,rosterVersion:ROSTER_VERSION,started:false,zone:0,map:'town0',visited:[0],flags:{},x:START.x,y:START.y,dir:'up',avatar:null,party:[],storage:[],active:0,caught:[],seen:[],badges:[],progress:Array.from({length:8},()=>({met:false,studied:0,enemy:false,boss:false})),learning:{},answerLog:[],items:{heal:8,orb:15},coins:120,playMs:0,ended:false,legend:false,sound:false,tutorial:{battle:true,walk:4},sessionId:Date.now().toString(36),savedAt:0};}
export function validateSave(value){
  const fail=()=>{throw new Error('저장 파일의 정보가 올바르지 않아요.');};
  if(!value||value.schema!==1||!Array.isArray(value.party)||value.party.length>6||!Array.isArray(value.progress)||value.progress.length!==8||!Number.isInteger(value.zone)||value.zone<0||value.zone>7)fail();
  // v0.47: 나리분지 초원에서 첫 동료를 고르는 동안만 동료 없이 저장할 수 있어요(초원 우산몬 목록 starterField와 함께).
  const choosing=value.map==='meadow0'&&Array.isArray(value.starterField)&&value.starterField.length>0&&value.starterField.length<=30&&value.starterField.every(n=>Number.isInteger(n)&&n>=1&&n<=100);
  if(value.started&&value.party.length===0&&!choosing)fail();
  const v={...newState(),...JSON.parse(JSON.stringify(value))};
  // v0.60: 예전 저장(동료 6마리)은 앞의 4마리만 함께 다니고, 나머지는 동료 보관함으로 옮겨요.
  if(v.party.length>PARTY_MAX){v.storage=[...(v.storage||[]),...v.party.slice(PARTY_MAX)];v.party=v.party.slice(0,PARTY_MAX);if(!(v.active>=0&&v.active<v.party.length))v.active=0;}
  const legacy=(value.rosterVersion??1)===1;
  if(!legacy&&value.rosterVersion!==ROSTER_VERSION)fail();
  v.avatar=['girl','boy'].includes(value.avatar)?value.avatar:null;
  for(const key of ['storage','caught','seen','badges','answerLog'])if(!Array.isArray(v[key]))fail();
  if(v.storage.length>500||v.answerLog.length>2000)fail();
  for(const key of ['caught','seen','badges']){const low=key==='badges'?0:1,high=key==='badges'?7:100;if(v[key].some(n=>!Number.isInteger(n)||n<low||n>high))fail();v[key]=[...new Set(v[key])];}
  for(const m of [...v.party,...v.storage]){
    if(!Number.isInteger(m.id)||m.id<1||m.id>100||!Number.isInteger(m.level)||m.level<1||m.level>100||!Number.isFinite(m.hp)||!Number.isFinite(m.xp)||m.xp<0||!Array.isArray(m.pp)||m.pp.length!==4||m.pp.some(p=>!Number.isInteger(p)||p<0))fail();
    if(legacy)m.id=LEGACY_SPECIES_MAP[m.id];
    delete m.form;delete m.formBase; // 형태변환은 결투 안에서만 (저장 파일에는 노멀폼)
    if(!value.hearts){const old=stats(m.id,m.level).vit;m.hp=m.hp<=0?0:Math.max(1,Math.round(Math.min(m.hp,old)/old*heartsMax(m.id,m.level)));} // v0.83 예전 저장(숫자 체력) → 남은 비율대로 하트
    Object.assign(m,stats(m.id,m.level));m.hp=Math.max(0,Math.min(m.hp,m.maxHp));m.pp=m.pp.map((p,i)=>Math.min(p,PP_MAX[i]));
  }
  for(const p of v.progress)if(!p||typeof p!=='object'||!Number.isFinite(p.studied)||['met','enemy','boss'].some(k=>typeof p[k]!=='boolean'))fail();
  if(!v.items||!Number.isFinite(v.items.heal)||v.items.heal<0||!Number.isFinite(v.items.orb)||v.items.orb<0||!v.learning||typeof v.learning!=='object'||Array.isArray(v.learning))fail();
  // 튜토리얼 진행(연습 대결, 걷기 안내 0~4단계). 예전 저장 파일은 이미 끝낸 것으로 봐요.
  const t=v.tutorial&&typeof v.tutorial==='object'?v.tutorial:{battle:true,walk:4};v.tutorial={battle:!!t.battle,walk:Math.max(0,Math.min(4,Number.isInteger(t.walk)?t.walk:4))};
  for(const k of ['coins','playMs','savedAt'])if(!Number.isFinite(v[k])||v[k]<0)fail();
  for(const r of Object.values(v.learning))if(!r||['attempts','correct','independent','last'].some(k=>!Number.isFinite(r[k])||r[k]<0)||!Array.isArray(r.seen)||!Array.isArray(r.sessions))fail();
  for(const a of v.answerLog)if(!a||typeof a.q!=='string'||typeof a.concept!=='string'||typeof a.session!=='string'||!Number.isFinite(a.time)||a.time<0||a.time>8640000000000000||typeof a.correct!=='boolean'||typeof a.assisted!=='boolean')fail();
  if(legacy){for(const k of ['caught','seen'])v[k]=[...new Set(v[k].map(id=>LEGACY_SPECIES_MAP[id]))];for(const a of v.answerLog)if(a.opponent)a.opponent=LEGACY_SPECIES_MAP[a.opponent]||null;}
  v.rosterVersion=ROSTER_VERSION;
  // v0.22: which map (town or route), towns reached on foot, and one-time map objects.
  const def=MAP_BY_ID[value.map];
  v.map=def&&def.zone===v.zone?def.id:`town${v.zone}`;
  if(v.party.length){delete v.starterField;if(v.map==='meadow0')v.map='town0';}
  const reached=Array.isArray(value.visited)?value.visited:[0,...v.badges.map(b=>Math.min(7,b+1)),v.zone];
  if(reached.some(n=>!Number.isInteger(n)||n<0||n>7))fail();
  v.visited=[...new Set([0,v.zone,...reached])].sort((a,b)=>a-b);
  if(value.flags!==undefined&&(typeof value.flags!=='object'||value.flags===null||Array.isArray(value.flags)))fail();
  v.flags={};for(const [k,f] of Object.entries(value.flags||{})){if(typeof k!=='string'||k.length>40||typeof f!=='boolean')fail();if(f)v.flags[k]=true;}
  if(Object.keys(v.flags).length>500)fail();
  const legacyPlace=!def;
  const mg=parseMap(v.map).grid;v.x=Number.isFinite(v.x)&&!legacyPlace?Math.max(0,Math.min((mg[0]?.length||MAP_W)-1,Math.round(v.x))):parseMap(v.map).spawns.a.x;
  v.y=Number.isFinite(v.y)&&!legacyPlace?Math.max(0,Math.min((mg.length||MAP_H)-1,Math.round(v.y))):parseMap(v.map).spawns.a.y;
  v.active=Math.max(0,Math.min(v.party.length-1,Math.floor(v.active)||0));v.sessionId=Date.now().toString(36);v.started=!!v.started;v.dir=['up','down','left','right'].includes(v.dir)?v.dir:'down';return v;
}
