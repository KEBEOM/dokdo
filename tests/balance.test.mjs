// 결투 난이도: 정답을 60% 맞히는 학생도 관장을 이길 수 있는지, 정해진 난수로 결투를 여러 번 흉내 내서 확인해요.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createMonster, attackHit, enemyHit, PIERCE_CHANCE } from '../dist/engine.js';
import { ZONES, MONSTERS, STARTERS, isUnique, getSpecies } from '../dist/data.js';

function seeded(s) { return () => (s = (s * 16807) % 2147483647) / 2147483647; }
function winRate(party, team, p, n, rng) {
  let wins = 0;
  for (let k = 0; k < n; k++) {
    const mine = party.map(([i, l]) => createMonster(i, l)), foes = team.map(([i, l]) => createMonster(i, l));
    let a = 0, f = 0, t = 0;
    while (a < mine.length && f < foes.length && t++ < 300) {
      const me = mine[a], foe = foes[f];
      foe.hp -= attackHit(me, foe, rng() < p, undefined, rng).amount; if (foe.hp <= 0) { f++; continue; }
      const ok = rng() < p; me.hp -= enemyHit(foe, me, { correct: ok, pierce: ok && rng() < PIERCE_CHANCE }, rng); if (me.hp <= 0) a++;
    }
    if (f >= foes.length) wins++;
  }
  return wins / n;
}
// 관장 인증 결투: 상대는 이 장 기준 레벨 −2, 나는 지난 인증 보너스 레벨(1장은 스타팅 Lv5)
const gym = z => ({ me: z === 0 ? 5 : 8 + 4 * (z - 1), team: ZONES[z].bossTeam.slice(0, z === 7 ? 3 : 2).map(i => [i, Math.max(3, 5 + 4 * z - 2)]) });

test('the first gym (도동항 관장 해온) can be beaten by every starter alone, answering 60% right', () => {
  const rng = seeded(11), { me, team } = gym(0);
  for (const st of STARTERS) assert.ok(winRate([[st, me]], team, .6, 400, rng) >= .8, `${getSpecies(st).name} vs 해온`);
});

test('every gym can be beaten by a team of three, answering 60% right', () => {
  const rng = seeded(29);
  for (let z = 0; z < 8; z++) {
    const { me, team } = gym(z), pool = MONSTERS.filter(m => !isUnique(m) && m.zone <= Math.max(0, z - 1)).map(m => m.id);
    for (const st of STARTERS) {
      const party = [[st, me], [pool[(z * 7) % pool.length], me], [pool[(z * 13 + 5) % pool.length], me]];
      assert.ok(winRate(party, team, .6, 300, rng) >= .75, `${z + 1}장 관장 with ${getSpecies(st).name} + 2`);
    }
  }
});

test('gym teams match their gym and the first one never has a type that beats a starter', () => {
  const beats = { wave: 'rock', rock: 'wind', wind: 'wave', leaf: 'light', light: 'echo', echo: 'leaf' };
  for (const id of ZONES[0].bossTeam) for (const st of STARTERS) assert.notEqual(beats[getSpecies(id).type], getSpecies(st).type, `${getSpecies(id).name} vs ${getSpecies(st).name}`);
  for (const z of ZONES) for (const id of z.bossTeam) assert.ok(!isUnique(getSpecies(id)), 'no legendaries or starters in gym teams');
});

console.log('PASS: first gym beatable by every starter alone at 60% correct; every gym beatable by a team of three at 60% correct; gym teams are fair and themed.');
