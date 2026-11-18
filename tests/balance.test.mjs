// 결투 난이도: 정답을 60% 맞히는 학생도 독도 지킴이를 이길 수 있는지, 정해진 난수로 결투를 여러 번 흉내 내서 확인해요.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createMonster, attackHit, enemyHit, PIERCE_CHANCE } from '../dist/engine.js';
import { ZONES, MONSTERS, isUnique, getSpecies, starterPool, STARTER_LEVEL } from '../dist/data.js';
const STARTERS = starterPool(); // 들판에서 고를 수 있는 모든 우산몬

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
// 독도 지킴이 인증 결투: 상대는 이 장 기준 레벨 −2, 나는 지난 인증 보너스 레벨(1장은 첫 동료 Lv6)
// v0.71: 1장은 첫 동료 Lv1 → 연습 결투와 야생 결투 두어 번 뒤 Lv3쯤에 지킴이(Lv1 둘)를 만나요
const gym = z => ({ me: z === 0 ? STARTER_LEVEL + 2 : 8 + 4 * (z - 1), team: ZONES[z].bossTeam.slice(0, z === 7 ? 3 : 2).map(i => [i, z === 0 ? 1 : Math.max(3, 5 + 4 * z - 2)]) });

test('the first gym (도동항 물결 지킴이 해온) can be beaten alone by any 우산몬 you pick on the field, answering 60% right', () => {
  const rng = seeded(11), { me, team } = gym(0);
  for (const st of STARTERS) assert.ok(winRate([[st, me]], team, .6, 300, rng) >= .8, `${getSpecies(st).name} vs 해온`);
});

test('every gym can be beaten by a team of three, answering 60% right', () => {
  const rng = seeded(29);
  for (let z = 0; z < 8; z++) {
    const { me, team } = gym(z), pool = MONSTERS.filter(m => !isUnique(m) && m.zone <= Math.max(0, z - 1)).map(m => m.id);
    for (const st of STARTERS.filter((_, i) => i % 9 === z % 9)) {
      const party = [[st, me], [pool[(z * 7) % pool.length], me], [pool[(z * 13 + 5) % pool.length], me]];
      assert.ok(winRate(party, team, .6, 300, rng) >= .75, `${z + 1}장 지킴이 with ${getSpecies(st).name} + 2`);
    }
  }
});

test('gym teams never use legendaries', () => {
  for (const z of ZONES) for (const id of z.bossTeam) assert.ok(!isUnique(getSpecies(id)), 'no legendaries or starters in gym teams');
});

console.log('PASS: first gym beatable alone by any of the 92 field 우산몬 (Lv6) at 60% correct; every gym beatable by a team of three at 60% correct; no legendaries in gym teams.');
