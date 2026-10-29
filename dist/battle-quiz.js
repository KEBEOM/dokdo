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
