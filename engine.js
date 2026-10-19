import {getSpecies,TYPES} from './data.js';
export function stats(id,level){const s=getSpecies(id);const st=s.stage;return {maxHp:24+level*5+st*5,attack:8+level*2+st*3,defense:5+level+st*3,speed:8+level+(s.type==='wind'?6:0)};}
export function createMonster(id,level=4){const s=stats(id,level);return {uid:`m${Date.now().toString(36)}${Math.random().toString(36).slice(2,7)}`,id,level,xp:0,hp:s.maxHp,...s,pp:[20,12,8,6]};}
export function advantage(a,b){const ring={wave:'rock',rock:'wind',wind:'wave',leaf:'light',light:'echo',echo:'leaf'};return ring[a]===b?1.5:ring[b]===a?.75:1;}
export function damage(attacker,defender,power=1,rng=Math.random){const mult=advantage(getSpecies(attacker.id).type,getSpecies(defender.id).type);return {amount:Math.max(3,Math.round((attacker.attack*power-defender.defense*.45)*mult*(.9+rng()*.2))),mult};}
export function skills(m){const t=getSpecies(m.id).type;const names={wave:['물결 치기','너울 강타','숨 고르기','파도 보호'],wind:['바람 치기','돌풍 날개','숨 고르기','순풍 보호'],rock:['돌진','단단한 일격','숨 고르기','바위 보호'],leaf:['잎새 치기','꽃잎 바람','잎새 회복','초록 보호'],light:['빛줄기','반짝 강타','숨 고르기','별빛 보호'],echo:['울림 치기','메아리 파동','숨 고르기','기억 보호']}[t];return names.map((name,i)=>({name,kind:i<2?'attack':i===2?'heal':'guard',power:i===1?1.45:1,max:[20,12,8,6][i]}));}
export function healAll(state){for(const m of state.party){const st=stats(m.id,m.level);Object.assign(m,st);m.hp=m.maxHp;m.pp=[20,12,8,6];}return state;}
export function gainXP(m,amount){m.xp+=amount;const changes=[];while(m.xp>=m.level*13){m.xp-=m.level*13;m.level++;changes.push(`${getSpecies(m.id).name} Lv.${m.level}`);const sp=getSpecies(m.id);if(sp.evolvesTo&&m.level>=sp.evolveLevel){m.id=sp.evolvesTo;changes.push(`${sp.name} → ${getSpecies(m.id).name}`);}Object.assign(m,stats(m.id,m.level));m.hp=m.maxHp;m.pp=[20,12,8,6];}return changes;}
export function captureChance(enemy){if(getSpecies(enemy.id).legendary)return 0;return Math.min(.93,.45+(1-enemy.hp/enemy.maxHp)*.43);}
export function addMonster(state,mon){if(state.party.length<6)state.party.push(mon);else state.storage.push(mon);if(!state.caught.includes(mon.id))state.caught.push(mon.id);if(!state.seen.includes(mon.id))state.seen.push(mon.id);}
export function recordAnswer(state,q,correct,assisted=false,context={}){const r=state.learning[q.concept]||{attempts:0,correct:0,independent:0,seen:[],sessions:[],last:0};r.attempts++;if(correct){r.correct++;if(!assisted)r.independent++;}if(!r.seen.includes(q.id))r.seen.push(q.id);if(!r.sessions.includes(state.sessionId))r.sessions.push(state.sessionId);r.last=Date.now();state.learning[q.concept]=r;state.answerLog.push({q:q.id,concept:q.concept,correct,assisted,time:Date.now(),session:state.sessionId,mode:context.mode||'study',phase:context.phase||'',opponent:context.opponent||null,zone:state.zone});if(state.answerLog.length>2000)state.answerLog.shift();return r;}
export function newState(){return {schema:1,started:false,zone:0,x:9,y:21,dir:'down',avatar:null,party:[],storage:[],active:0,caught:[],seen:[],badges:[],progress:Array.from({length:8},()=>({met:false,studied:0,enemy:false,boss:false})),learning:{},answerLog:[],items:{heal:8,orb:15},coins:120,playMs:0,ended:false,legend:false,sound:false,sessionId:Date.now().toString(36),savedAt:0};}
export function validateSave(value){
  const fail=()=>{throw new Error('저장 파일의 정보가 올바르지 않아요.');};
  if(!value||value.schema!==1||!Array.isArray(value.party)||value.party.length>6||!Array.isArray(value.progress)||value.progress.length!==8||!Number.isInteger(value.zone)||value.zone<0||value.zone>7)fail();
  if(value.started&&value.party.length===0)fail();
  const v={...newState(),...value};
  v.avatar=['girl','boy'].includes(value.avatar)?value.avatar:null;
  for(const key of ['storage','caught','seen','badges','answerLog'])if(!Array.isArray(v[key]))fail();
  if(v.storage.length>500||v.answerLog.length>2000)fail();
  for(const key of ['caught','seen','badges']){const low=key==='badges'?0:1,high=key==='badges'?7:100;if(v[key].some(n=>!Number.isInteger(n)||n<low||n>high))fail();v[key]=[...new Set(v[key])];}
  for(const m of [...v.party,...v.storage]){
    if(!Number.isInteger(m.id)||m.id<1||m.id>100||!Number.isInteger(m.level)||m.level<1||m.level>100||!Number.isFinite(m.hp)||!Number.isFinite(m.xp)||m.xp<0||!Array.isArray(m.pp)||m.pp.length!==4||m.pp.some(p=>!Number.isInteger(p)||p<0))fail();
    Object.assign(m,stats(m.id,m.level));m.hp=Math.max(0,Math.min(m.hp,m.maxHp));m.pp=m.pp.map((p,i)=>Math.min(p,[20,12,8,6][i]));
  }
  for(const p of v.progress)if(!p||typeof p!=='object'||!Number.isFinite(p.studied)||['met','enemy','boss'].some(k=>typeof p[k]!=='boolean'))fail();
  if(!v.items||!Number.isFinite(v.items.heal)||v.items.heal<0||!Number.isFinite(v.items.orb)||v.items.orb<0||!v.learning||typeof v.learning!=='object'||Array.isArray(v.learning))fail();
  for(const k of ['coins','playMs','savedAt'])if(!Number.isFinite(v[k])||v[k]<0)fail();
  for(const r of Object.values(v.learning))if(!r||['attempts','correct','independent','last'].some(k=>!Number.isFinite(r[k])||r[k]<0)||!Array.isArray(r.seen)||!Array.isArray(r.sessions))fail();
  for(const a of v.answerLog)if(!a||typeof a.q!=='string'||typeof a.concept!=='string'||typeof a.session!=='string'||!Number.isFinite(a.time)||a.time<0||a.time>8640000000000000||typeof a.correct!=='boolean'||typeof a.assisted!=='boolean')fail();
  v.x=Number.isFinite(v.x)?Math.max(2,Math.min(39,Math.round(v.x))):9;v.y=Number.isFinite(v.y)?Math.max(3,Math.min(26,Math.round(v.y))):21;
  v.active=Math.max(0,Math.min(v.party.length-1,Math.floor(v.active)||0));v.sessionId=Date.now().toString(36);v.started=!!v.started;v.dir=['up','down','left','right'].includes(v.dir)?v.dir:'down';return v;
}
