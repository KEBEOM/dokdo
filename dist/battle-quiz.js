import {QUESTIONS} from './learning.js';

// Avoid immediate repeats; revisit a missed concept after other questions.
export function rankBattleQuestions(state,rng=Math.random){
  const log=state.answerLog, recent=new Set(log.slice(-3).map(a=>a.q));
  const due=new Set();
  for(let i=Math.max(0,log.length-16);i<log.length-2;i++){
    const a=log[i];
    if(!a.correct&&!log.slice(i+1).some(b=>b.concept===a.concept&&b.correct&&!b.assisted))due.add(a.concept);
  }
  const counts=new Map();for(const a of log)counts.set(a.q,(counts.get(a.q)||0)+1);
  // v0.59 수준 맞추기: 최근 10문제를 잘 맞히면 어려운 문제(수·연도·순서·근거)를, 많이 틀리면 쉬운 문제를 더 자주 내요.
  // 혼자 힘으로 맞힌 문제와 지나온 장의 쉬운 문제는 뒤로 미뤄요.
  const last=log.slice(-10),acc=last.length>=4?last.filter(a=>a.correct&&!a.assisted).length/last.length:.5;
  const lean=acc>=.7?-1.6:acc<.4?1:-.4; // 어려운 문제 쪽으로 기우는 정도(음수 = 어려운 문제 먼저)
  const solved=new Set(log.filter(a=>a.correct&&!a.assisted).map(a=>a.q));
  const pool=QUESTIONS.filter(q=>q.zone<=state.zone).map(q=>({q,score:
    (recent.has(q.id)?100:0)-(due.has(q.concept)?12:0)+
    (counts.get(q.id)||0)*1.2+(solved.has(q.id)?2.5:0)+(state.learning[q.concept]?.independent||0)*.3-
    (q.zone===state.zone?1:0)+(state.zone-q.zone)*.3+(difficulty(q)-2)*lean+rng()
  }));
  pool.sort((a,b)=>a.score-b.score);return pool.map(p=>p.q);
}
export function selectBattleQuestion(state,rng=Math.random){return rankBattleQuestions(state,rng)[0];}

export function shuffledChoices(q,rng=Math.random){
  const order=q.options.map((_,i)=>i);
  for(let i=order.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[order[i],order[j]]=[order[j],order[i]];}
  return order;
}

// ── 기록 되찾기 결투의 문제 형식 (v0.58) ───────────────────────────────────────
// 같은 문제 은행을 차례와 내용에 따라 다른 모양으로 물어요.
//   compass 나침반: 선택지가 모두 방향(동남쪽 …)이면 나침반에서 방향을 골라요
//   order   순서 놓기: 선택지가 모두 같은 낱말들의 ‘A → B → C’ 순서이면 낱말 카드를 차례로 눌러 놓아요
//   cards   근거 카드: 자료 읽기·관찰과 추측·주장과 근거(S3·S4·N4)는 카드 네 장에서 골라요
//   ox      빠른 판단: 검은 기운이 밀려올 때(막기)는 ‘이 답이 맞을까?’를 ○ ×로 판단해요
//   choice  고르기: 그 밖의 문제
const DIRECTION = { 북쪽: 0, 북동쪽: 45, 동북쪽: 45, 동쪽: 90, 동남쪽: 135, 남동쪽: 135, 남쪽: 180, 남서쪽: 225, 서남쪽: 225, 서쪽: 270, 북서쪽: 315, 서북쪽: 315 };
export const directionAngle = text => DIRECTION[text] ?? null;
export const orderItems = text => text.split(' → ').map(s => s.trim());
export function quizFormat(q, phase = 'attack') {
  if (phase === 'defense') return 'ox';
  if (q.options.every(o => directionAngle(o) !== null) && new Set(q.options.map(directionAngle)).size === 4) return 'compass';
  const sets = q.options.map(o => orderItems(o));
  if (sets.every(s => s.length >= 3 && s.length === sets[0].length && [...s].sort().join('|') === [...sets[0]].sort().join('|'))) return 'order';
  if (['S3', 'S4', 'N4'].includes(q.concept)) return 'cards';
  return 'choice';
}
// 빠른 판단에서 보여 줄 답: 절반은 정답, 절반은 오답. fixedWrong이면 오답은 늘 (정답+1)번(검사용)
export function oxShown(q, rng = Math.random, fixedWrong = false) {
  if (rng() < .5) return q.answer;
  if (fixedWrong) return (q.answer + 1) % q.options.length;
  const wrong = q.options.map((_, i) => i).filter(i => i !== q.answer);
  return wrong[Math.floor(rng() * wrong.length)];
}
// 순서 놓기에서 놓은 순서 → 고른 선택지 번호(선택지에 없는 순서는 오답 가운데 하나)
export function orderChoice(q, seq) {
  const i = q.options.indexOf(seq.join(' → '));
  return i >= 0 ? i : (q.answer + 1) % q.options.length;
}

// 문제의 수준(1 쉬움 · 2 보통 · 3 어려움): 수·연도를 가려야 하거나, 순서를 놓거나, 자료·근거를 따지는 문제일수록 높아요.
export function difficulty(q){
  let n=0;
  if(q.options.filter(o=>/\d/.test(o)).length>=3)n+=2;          // 비슷한 수·연도 가운데 고르기
  if(q.options.every(o=>o.includes(' → ')))n+=2;                  // 순서 놓기
  if(['H3','H4','S3','S4','N4'].includes(q.concept))n+=1;         // 기록·자료·근거 다루기
  if(q.zone>=4)n+=1;if(q.prompt.length>=30)n+=1;
  return n>=3?3:n>=1?2:1;
}
