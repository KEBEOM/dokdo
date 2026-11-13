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
  const pool=QUESTIONS.filter(q=>q.zone<=state.zone).map(q=>({q,score:
    (recent.has(q.id)?100:0)-(due.has(q.concept)?12:0)+
    (counts.get(q.id)||0)*1.2+(state.learning[q.concept]?.independent||0)*.3-
    (q.zone===state.zone?1:0)+rng()
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
