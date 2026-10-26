import {getSpecies,TYPES,ROSTER_VERSION,LEGACY_SPECIES_MAP} from './data.js';
import {MAP_BY_ID,parseMap,MAP_W,MAP_H} from './maps.js';
const START=parseMap('town0').spawns.a;
export function stats(id,level){const s=getSpecies(id);const st=s.stage;return {maxHp:24+level*5+st*5,attack:8+level*2+st*3,defense:5+level+st*3,speed:8+level+(s.type==='wind'?6:0)};}
export function createMonster(id,level=4){const s=stats(id,level);return {uid:`m${Date.now().toString(36)}${Math.random().toString(36).slice(2,7)}`,id,level,xp:0,hp:s.maxHp,...s,pp:PP_MAX.slice()};}
export function advantage(a,b){const ring={wave:'rock',rock:'wind',wind:'wave',leaf:'light',light:'echo',echo:'leaf'};return ring[a]===b?1.5:ring[b]===a?.75:1;}
export function damage(attacker,defender,power=1,rng=Math.random){const mult=advantage(getSpecies(attacker.id).type,getSpecies(defender.id).type);return {amount:Math.max(3,Math.round((attacker.attack*power-defender.defense*.45)*mult*(.9+rng()*.2))),mult};}
// v0.23: the opponent's question attack always lands, but a correct answer softens the blow.
export const SOFTEN_RATE=.25;
export function enemyHit(attacker,defender,{correct=false,guard=false}={},rng=Math.random){let d=damage(attacker,defender,1,rng).amount;if(correct)d=Math.max(1,Math.round(d*SOFTEN_RATE));if(guard)d=Math.max(1,Math.ceil(d/2));return d;}
// 기술: 처음(Lv1)에는 손길(정화)과 보호 두 가지, Lv8에 숨 고르기(회복), Lv12에 파동(강한 정화)을 배웁니다.
// 배열 순서(0 손길, 1 파동, 2 숨 고르기, 3 보호)는 저장 파일의 기술 횟수(pp) 순서와 같습니다.
export const PP_MAX=[25,8,8,10];
export const LEARN_LEVEL=[1,12,8,1];
const SKILL_NAMES={wave:['물결 손길','너울 파동','숨 고르기','파도 보호'],wind:['바람 손길','돌풍 파동','숨 고르기','순풍 보호'],rock:['바위 손길','묵직한 파동','숨 고르기','바위 보호'],leaf:['잎새 손길','꽃잎 파동','잎새 회복','초록 보호'],light:['빛줄기','반짝 파동','숨 고르기','별빛 보호'],echo:['울림 손길','메아리 파동','숨 고르기','기억 보호']};
export function skills(m){const t=getSpecies(m.id).type;return SKILL_NAMES[t].map((name,i)=>({index:i,name,kind:i<2?'attack':i===2?'heal':'guard',power:i===1?1.74:1.2,max:PP_MAX[i],learn:LEARN_LEVEL[i]}));}
// The skills this 독도몬 can use now, in the order they were learned.
export function knownSkills(m){return skills(m).filter(s=>m.level>=s.learn).sort((a,b)=>a.learn-b.learn||a.index-b.index);}
// Skills learned when the level rises from `from` to `to`.
export function learnedBetween(m,from,to){return skills(m).filter(s=>s.learn>from&&s.learn<=to);}
export function healAll(state){for(const m of state.party){const st=stats(m.id,m.level);Object.assign(m,st);m.hp=m.maxHp;m.pp=PP_MAX.slice();}return state;}
export function gainXP(m,amount){m.xp+=amount;const changes=[];while(m.xp>=m.level*13){m.xp-=m.level*13;m.level++;changes.push(`${getSpecies(m.id).name} Lv.${m.level}`);const sp=getSpecies(m.id);if(sp.evolvesTo&&m.level>=sp.evolveLevel){m.id=sp.evolvesTo;changes.push(`${sp.name} → ${getSpecies(m.id).name}`);}Object.assign(m,stats(m.id,m.level));m.hp=m.maxHp;m.pp=PP_MAX.slice();}return changes;}
export function captureChance(enemy){if(getSpecies(enemy.id).legendary)return 0;return Math.min(.93,.45+(1-enemy.hp/enemy.maxHp)*.43);}
export function addMonster(state,mon){if(state.party.length<6)state.party.push(mon);else state.storage.push(mon);if(!state.caught.includes(mon.id))state.caught.push(mon.id);if(!state.seen.includes(mon.id))state.seen.push(mon.id);}
export function recordAnswer(state,q,correct,assisted=false,context={}){const r=state.learning[q.concept]||{attempts:0,correct:0,independent:0,seen:[],sessions:[],last:0};r.attempts++;if(correct){r.correct++;if(!assisted)r.independent++;}if(!r.seen.includes(q.id))r.seen.push(q.id);if(!r.sessions.includes(state.sessionId))r.sessions.push(state.sessionId);r.last=Date.now();state.learning[q.concept]=r;state.answerLog.push({q:q.id,concept:q.concept,correct,assisted,time:Date.now(),session:state.sessionId,mode:context.mode||'study',phase:context.phase||'',opponent:context.opponent||null,zone:state.zone});if(state.answerLog.length>2000)state.answerLog.shift();return r;}
export function newState(){return {schema:1,rosterVersion:ROSTER_VERSION,started:false,zone:0,map:'town0',visited:[0],flags:{},x:START.x,y:START.y,dir:'up',avatar:null,party:[],storage:[],active:0,caught:[],seen:[],badges:[],progress:Array.from({length:8},()=>({met:false,studied:0,enemy:false,boss:false})),learning:{},answerLog:[],items:{heal:8,orb:15},coins:120,playMs:0,ended:false,legend:false,sound:false,tutorial:{battle:true,walk:4},sessionId:Date.now().toString(36),savedAt:0};}
export function validateSave(value){
  const fail=()=>{throw new Error('저장 파일의 정보가 올바르지 않아요.');};
  if(!value||value.schema!==1||!Array.isArray(value.party)||value.party.length>6||!Array.isArray(value.progress)||value.progress.length!==8||!Number.isInteger(value.zone)||value.zone<0||value.zone>7)fail();
  if(value.started&&value.party.length===0)fail();
  const v={...newState(),...JSON.parse(JSON.stringify(value))};
  const legacy=(value.rosterVersion??1)===1;
  if(!legacy&&value.rosterVersion!==ROSTER_VERSION)fail();
  v.avatar=['girl','boy'].includes(value.avatar)?value.avatar:null;
  for(const key of ['storage','caught','seen','badges','answerLog'])if(!Array.isArray(v[key]))fail();
  if(v.storage.length>500||v.answerLog.length>2000)fail();
  for(const key of ['caught','seen','badges']){const low=key==='badges'?0:1,high=key==='badges'?7:100;if(v[key].some(n=>!Number.isInteger(n)||n<low||n>high))fail();v[key]=[...new Set(v[key])];}
  for(const m of [...v.party,...v.storage]){
    if(!Number.isInteger(m.id)||m.id<1||m.id>100||!Number.isInteger(m.level)||m.level<1||m.level>100||!Number.isFinite(m.hp)||!Number.isFinite(m.xp)||m.xp<0||!Array.isArray(m.pp)||m.pp.length!==4||m.pp.some(p=>!Number.isInteger(p)||p<0))fail();
    if(legacy)m.id=LEGACY_SPECIES_MAP[m.id];
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
  const reached=Array.isArray(value.visited)?value.visited:[0,...v.badges.map(b=>Math.min(7,b+1)),v.zone];
  if(reached.some(n=>!Number.isInteger(n)||n<0||n>7))fail();
  v.visited=[...new Set([0,v.zone,...reached])].sort((a,b)=>a-b);
  if(value.flags!==undefined&&(typeof value.flags!=='object'||value.flags===null||Array.isArray(value.flags)))fail();
  v.flags={};for(const [k,f] of Object.entries(value.flags||{})){if(typeof k!=='string'||k.length>40||typeof f!=='boolean')fail();if(f)v.flags[k]=true;}
  if(Object.keys(v.flags).length>500)fail();
  const legacyPlace=!def;
  v.x=Number.isFinite(v.x)&&!legacyPlace?Math.max(0,Math.min(MAP_W-1,Math.round(v.x))):parseMap(v.map).spawns.a.x;
  v.y=Number.isFinite(v.y)&&!legacyPlace?Math.max(0,Math.min(MAP_H-1,Math.round(v.y))):parseMap(v.map).spawns.a.y;
  v.active=Math.max(0,Math.min(v.party.length-1,Math.floor(v.active)||0));v.sessionId=Date.now().toString(36);v.started=!!v.started;v.dir=['up','down','left','right'].includes(v.dir)?v.dir:'down';return v;
}
