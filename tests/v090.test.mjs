// v0.90 이음매 없는 바닷속 바닥·벽 재질 · 조사 상자·실내 알림판도 가구 팩 그림
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const dist = new URL('../dist/', import.meta.url);
const { UW_FLOOR: UW0 } = await import('../dist/uw-atlas.js'); const { PACK96 } = await import('../dist/pack96.js'); const UW_FLOOR = PACK96.seabed || UW0; // v0.96 새 해저 바닥(09)
const { seabedLayout } = await import('../dist/seabed.js');
const { furnitureSprite, furnitureGroups } = await import('../dist/furniture.js');
const { createMap } = await import('../dist/world.js');
const { MAPS } = await import('../dist/maps.js');
const { ROOM_DEFS } = await import('../dist/interiors.js');
// 이음매 검사(파이썬): 같은 띠의 타일 두 장을 어떤 순서로 붙여도, 맞닿는 두 줄의 색 차이가 타일 안 이웃한 두 줄의 차이보다 크지 않아요
const py = `
import numpy as np, json, re, sys
from PIL import Image
a = np.asarray(Image.open(sys.argv[1]).convert('RGB')).astype(float); U = json.loads(sys.argv[2]); ids = U['ids']
T = {k: a[:, i*32:i*32+32] for i, k in enumerate(ids)}
B = [k for k in ids if U['band'][k] is not None]  # v0.96 전환 타일(band 없음)은 따로
IN = {k: max(np.abs(np.diff(T[k], axis=1)).mean(), np.abs(np.diff(T[k], axis=0)).mean()) for k in B}  # 타일 안 이웃한 두 줄의 평균 차이(가로·세로 중 큰 쪽)
ratio = max(max(np.abs(T[p][:, -1]-T[q][:, 0]).mean(), np.abs(T[p][-1]-T[q][0]).mean()) / ((IN[p] + IN[q]) / 2) for p in B for q in B if U['band'][p] == U['band'][q])
worst = ratio; inner = 1.0
w = np.asarray(Image.open(sys.argv[3]).convert('RGB')).astype(float); ws = max(max(np.abs(t[:, 0]-t[:, -1]).mean() / max(np.abs(t[:, 63]-t[:, 64]).mean(), 1), np.abs(t[0]-t[-1]).mean() / max(np.abs(t[63]-t[64]).mean(), 1)) for t in (w[:128], w[128:]))
print(json.dumps({'worst': worst, 'inner': inner, 'wall': ws}))`;
const r = JSON.parse(execFileSync('python3', ['-c', py, new URL('assets/scenery/uw-floor.png', dist).pathname, JSON.stringify(UW_FLOOR), new URL('assets/scenery/uw-walls.png', dist).pathname]).toString());
assert.ok(UW_FLOOR.seamless && Object.values(UW_FLOOR.band).filter(b => b != null).length === 12 && UW_FLOOR.bandColor.length === 4);
assert.ok(r.worst <= r.inner * 1.3, `바닥 이음매 ${r.worst.toFixed(1)} ≤ 타일 안 ${r.inner.toFixed(1)}`);
assert.ok(r.wall <= 1.6, `벽 재질 이음매 비율 ${r.wall.toFixed(2)}`);
// 깊이마다 한 띠만 → 띠가 바뀌는 곳은 깊이가 바뀌는 곳뿐(그곳은 색을 섞어요) · 이음매 없는 타일은 뒤집지 않아요
for (const d of MAPS.filter(m => m.kind !== 'room')) { const m = createMap(d.id), L = seabedLayout(m);
  for (let y = 0; y < m.length; y++) for (let x = 0; x < m[0].length - 1; x++) { const a = L.floor[y][x], b = L.floor[y][x + 1]; if (a && b && UW_FLOOR.band[a] != null && UW_FLOOR.band[b] != null && UW_FLOOR.band[a] !== UW_FLOOR.band[b]) assert.ok(Math.abs(UW_FLOOR.band[a] - UW_FLOOR.band[b]) <= 2, `${d.id} 띠가 갑자기 건너뛰지 않아요`); } }
const ter = readFileSync(new URL('terrain.js', dist), 'utf8'); assert.ok(/fx=!seam&&/.test(ter) && /createLinearGradient/.test(ter), '뒤집지 않기 · 띠 경계 색 섞기');
// 조사 상자·실내 알림판
assert.equal(furnitureSprite('chest', 'lab'), 'chest_closed'); assert.equal(furnitureSprite('board', 'shop'), 'board_indoor'); /* v0.96 02 가구 그림으로 */
{ const G = furnitureGroups(createMap('town0/lab/3')); assert.equal(G.get('25,15')?.draw?.sprite, 'chest_closed'); }
{ let n = 0; for (const d of ROOM_DEFS) { const m = createMap(d.id), G = furnitureGroups(m); for (const o of m.parsed.objects) if (o.furniture === 'board' && G.get(`${o.x},${o.y}`)) n++; } assert.ok(n >= 10, `실내 알림판 ${n}`); }
console.log(`PASS v0.90 바닥 이음매 ${r.worst.toFixed(1)}(타일 안 ${r.inner.toFixed(1)}) · 벽 ${r.wall.toFixed(2)} · 조사 상자·알림판`);
