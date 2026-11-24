// v0.96 GPT 요청 묶음 적용: 땅(03)·절벽(05)·식생(04, 섬마다 실제로 자라는 것만)·해저(09)·가구(02)·울릉도 명소(07) · 01·06·10은 보류
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const dist = new URL('../dist/', import.meta.url), read = f => readFileSync(new URL(f, dist), 'utf8');
const { PACK96, CLIFF_TEX } = await import('../dist/pack96.js');
const { HD2D_GROUND } = await import('../dist/hd2d-nature.js');
const { FURN_ATLAS, REGION_ATLAS } = await import('../dist/furniture-atlas.js');
const { furnitureSprite, PACK_FURNITURE } = await import('../dist/furniture.js');
const { getMapDef } = await import('../dist/maps.js');
const gl = read('gl3d.js'), sea = read('seabed.js');
const png = k => new URL(`assets/${k}.png`, dist).pathname;

// 03 땅: 계절마다 512×512(128칸 4×4) · 이음매 없음 · 계단은 예전 그림(비탈에 늘어나도 번지지 않게)
for (const s of ['spring', 'summer', 'autumn', 'winter']) { assert.equal(HD2D_GROUND.seasons[s], PACK96.ground[s]); assert.ok(existsSync(png(PACK96.ground[s]))); }
assert.ok(/HD2D_GROUND\.seasons\?\.\[o\.season\]/.test(gl), '계절 땅 그림');
const py = `
import numpy as np, sys, json
from PIL import Image
r = {}
for s in ['spring','summer','autumn','winter']:
    a = np.asarray(Image.open(sys.argv[1].replace('SEASON', s)).convert('RGB')).astype(float); assert a.shape[:2] == (512, 512)
    worst = 0
    for i in range(8):  # 9번째(계단)는 예전 그림(단마다 줄이 있어요)
        t = a[(i//4)*128:(i//4)*128+128, (i%4)*128:(i%4)*128+128]
        inner = max(np.abs(np.diff(t, axis=1)).mean(), np.abs(np.diff(t, axis=0)).mean())
        worst = max(worst, max(np.abs(t[:, 0]-t[:, -1]).mean(), np.abs(t[0]-t[-1]).mean()) / inner)
    r[s] = worst
old = np.asarray(Image.open(sys.argv[2]).convert('RGB'))[256:384, 0:128]; new = np.asarray(Image.open(sys.argv[1].replace('SEASON', 'summer')).convert('RGB'))[256:384, 0:128]
r['steps_old'] = bool((old == new).all())
print(json.dumps(r))`;
const g = JSON.parse(execFileSync('python3', ['-c', py, png('scenery/hd2d-ground-SEASON'), png('scenery/hd2d-ground')]).toString());
for (const s of ['spring', 'summer', 'autumn', 'winter']) assert.ok(g[s] < 3, `${s} 땅 이음매 ${g[s].toFixed(2)}`);
assert.ok(g.steps_old, '계단 칸은 예전 그림');

// 05 절벽: 섬마다 다른 절벽 면(독도·울릉도)
assert.notEqual(CLIFF_TEX.dokdo.face, CLIFF_TEX.ulleung.face); for (const k of [CLIFF_TEX.dokdo.face, CLIFF_TEX.ulleung.face]) assert.ok(existsSync(png(k)));
assert.ok(/CLIFF_TEX\[map\.def\?\.island === '울릉도' \? 'ulleung' : 'dokdo'\]/.test(gl));

// 04 식생: 발 = 아랫변 가운데 · 독도엔 사철나무·풀포기·(여름) 노란 꽃 덤불만 · 울릉도 나무는 울릉도에만 · 동백은 겨울·봄, 너도밤나무는 겨울 빼고
const F = PACK96.flora.frames; assert.equal(Object.keys(F).length, 44);
const floraSrc = gl.slice(gl.indexOf('const floraName = '), gl.indexOf('const treeName = ')); const floraName = new Function(`${floraSrc}; return floraName;`)();
const dd = { def: { island: '동도' } }, ul = { def: { island: '울릉도' } };
for (const season of ['spring', 'summer', 'autumn', 'winter']) for (let x = 0; x < 30; x++) for (let y = 0; y < 30; y++) {
  const t = floraName(dd, { x, y, scenery: 'tree' }, season), u = floraName(ul, { x, y, scenery: 'tree' }, season), tf = floraName(dd, { x, y, scenery: 'tuft' }, season);
  assert.ok(/^dd_sacheol_/.test(t) && F[t], `독도 나무 자리 = 사철나무 (${t})`);
  assert.ok(/^dd_(grass_tuft|scrub)_/.test(tf) && F[tf] && (season === 'summer' || !/scrub/.test(tf)), `독도 풀포기 (${season} ${tf})`);
  assert.ok(/^ul_/.test(u) && F[u], `울릉도 나무 ${u}`);
  if (/camellia/.test(u)) assert.ok(season === 'winter' || season === 'spring', '동백 꽃은 겨울·봄');
  if (/neodo/.test(u)) assert.ok(season !== 'winter', '너도밤나무는 겨울엔 잎이 져요');
}
assert.ok(existsSync(new URL('../docs/v096-식생-검증.md', import.meta.url)), '식생 검증 문서');

// 09 해저: 4단계 × 3변형 + 전환 12장, 단계마다 두 칸 넓이
const U = PACK96.seabed; assert.equal(U.ids.length, 24); assert.equal(Object.values(U.band).filter(b => b != null).length, 12);
for (const ab of ['12', '23', '34']) for (const d of 'nswe') assert.ok(U.ids.includes(U.blend[ab][d]));
assert.ok(/const BAND_OF_DEPTH = \[null, 0, 0, 1, 1, 2, 2, 3, 3, 3\]/.test(sea) && /blendFloor\(floor\)/.test(sea));

// 02 가구: 새 그림 10장 · 수조·망원경·독서대·수련 기둥·이불·집 소파·조사 상자(닫힘/열림)·알림판 · 액자는 벽 자리가 없어 예전 그림
for (const k of PACK96.furniture.ids) assert.ok(FURN_ATLAS.frames[k], k);
assert.equal(furnitureSprite('sofa', 'home'), 'home_sofa'); assert.equal(furnitureSprite('tank', 'lab'), 'lab_tank'); assert.equal(furnitureSprite('post', 'gym'), 'gym_post');
assert.equal(furnitureSprite('chest', 'lab'), 'chest_closed'); assert.ok(!PACK_FURNITURE.has('frame'));
assert.ok(/openChest = p\.sprite === 'chest_closed' && opts\.open/.test(read('furniture.js')), '열린 상자 그림');

// 07 울릉도 명소: 관찰용 외관(문 없음) · 막힌 칸 상자 위에만 · 사진 미대조 안내
const t0 = getMapDef('town0'), m0 = getMapDef('meadow0');
const lm = [[t0, '9', 'ul_dokdo_observatory'], [t0, '0', 'ul_haengnam_lighthouse'], [m0, '3', 'ul_albong_far'], [m0, '4', 'ul_seonginbong_far']];
for (const [d, ch, region] of lm) { const o = d.objects[ch]; assert.equal(o.region, region); assert.ok(REGION_ATLAS.frames[region]);
  const [x0, y0, x1, y1] = o.rock; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) assert.equal(d.art[y][x], 'T', `${region} 상자 칸은 원래 숲(막힌 칸)`);
  assert.ok(o.lines.some(l => /사진과 대조하지 않았어요/.test(l)), `${region} 사진 미대조 안내`); }
assert.ok(/ob\.onTop/.test(gl));

// 보류: 01 움직임 · 06 지명 바위 · 10 다시 그린 그림 → 게임 파일은 그대로(검사 기록만)
for (const f of ['v096-움직임-검사.md', 'v096-다시그리기-검사.md', 'v096-지형고증-대조.md']) assert.ok(existsSync(new URL(`../docs/${f}`, import.meta.url)), f);
assert.ok(!/dokdo_motion_v2|redraw/.test(read('characters.js')));
console.log('PASS v0.96 땅·절벽·식생(섬별 검증)·해저·가구·울릉도 명소 · 움직임·지명 바위·다시 그린 그림은 보류');
