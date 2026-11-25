// v0.97 걸을 때 지지직거림 · 예전 저화질 바위 정리 · 시야(넓게) · 주변 소리(바람·파도·비·바닷속)와 발소리(눈 저벅저벅)
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const dist = new URL('../dist/', import.meta.url), read = f => readFileSync(new URL(f, dist), 'utf8');
const gl = read('gl3d.js'), game = read('game.js'), audio = read('audio.js');

// 1) 지지직거림: 그림 판은 ‘또렷한 쌍선형’(미리 곱한 알파) · 땅 재질은 부드럽게 · 식생 그림은 구멍 메우고 밝은 점 누르기
assert.ok(/#extension GL_OES_standard_derivatives : enable/.test(gl) && /fwidth\(t\)/.test(gl) && /c\.rgb \/ max\(c\.a, 1e-3\)/.test(gl), '또렷한 쌍선형');
assert.ok(/UNPACK_PREMULTIPLY_ALPHA_WEBGL, smooth === 'sprite'/.test(gl) && /const spriteTex = /.test(gl) && /spriteTex\(scene\.statics\.atlas\)/.test(gl));
assert.ok(/clamp\(fract\(vWP\.xz \/ 128\.0\), \.5 \/ 128\.0, 1\.0 - \.5 \/ 128\.0\)/.test(gl) && /HD2D_GROUND\.key\), false, 0, true\)/.test(gl), '땅 재질 부드럽게');
const py = `
import numpy as np, json, sys
from PIL import Image
from scipy import ndimage
a = np.asarray(Image.open(sys.argv[1]).convert('RGBA')).astype(float); m = a[..., 3] > 0
h = ndimage.binary_fill_holes(m) & ~m; l, n = ndimage.label(h); s = ndimage.sum(h, l, range(1, n + 1)) if n else []
lum = a[..., :3] @ np.array([.3, .59, .11])
print(json.dumps({'small_holes': int(sum(1 for v in s if v <= 40)), 'bright': float((lum[m] > 200).mean())}))`;
const f = JSON.parse(execFileSync('python3', ['-c', py, new URL('assets/scenery/flora96.png', dist).pathname]).toString());
assert.equal(f.small_holes, 0, '잎 속 작은 구멍 없음'); assert.ok(f.bright < .002, `아주 밝은 잎 점 ${f.bright}`);

// 2) 바위: 한 칸 바위는 HD-2D 팩 바위 그림(캐릭터 키에 맞게) · 바위 무더기는 가운데로 갈수록 높게 + 위에 HD 바위 그림
const rockSrc = gl.slice(gl.indexOf('const rockName = '), gl.indexOf('const treeName = ')); const rockName = new Function(`${rockSrc}; return rockName;`)();
const { HD2D_ATLAS } = await import('../dist/hd2d-atlas.js');
for (const isl of ['울릉도', '동도', '서도']) for (let x = 0; x < 9; x++) assert.ok(HD2D_ATLAS.frames[rockName({ def: { island: isl } }, { x, y: 3 })]);
assert.ok(/rockDepth\(map, x, y\) \* 6/.test(gl) && /rockSpots\.push\(/.test(gl) && /for \(const \[key, x, z, h\] of rockSpots\) pushCard/.test(gl));

// 3) 시야: 가까이·보통·넓게(기본)·아주 넓게 · 3D 카메라 거리와 2D 칸 수에 같이 써요
assert.ok(/const VIEW_ZOOM = \{ near: \.8, normal: 1, wide: 1\.3, wider: 1\.6 \}/.test(game) && /let viewPick = 'wide'/.test(game));
assert.ok(/VIEW_ZOOM\[viewPick\] \|\| 1\)/.test(game) && /id="viewPick"/.test(game) && /rows: Math\.round\(13 \* vz\)/.test(game));
const { hdCamera } = await import('../dist/gl3d.js');
assert.ok(hdCamera(500, 500, 0, 0, 800, 500, 2, 1.3) && hdCamera(500, 500, 0, 0, 800, 500, 2, 1), 'hdCamera zoom');

// 4) 주변 소리: 바람·파도(7초 물결)·비·바닷속 · 발소리(눈·풀·모래·돌·나무·물) · 주변 소리 크기 조절
for (const k of ['wind', 'sea', 'surf', 'rain', 'under']) assert.ok(new RegExp(`amb\\.${k}\\.g\\.gain`).test(audio), k);
assert.ok(/case 'snow': for \(let i = 0; i < 4; i\+\+\) hiss/.test(audio), '눈 밟는 소리');
const { STEP_SURFACES } = await import('../dist/audio.js'); for (const s of ['snow', 'grass', 'sand', 'stone', 'wood', 'water']) assert.ok(STEP_SURFACES.includes(s));
assert.ok(/currentSeason\(\) === 'winter' && \[C\.GRASS, C\.TALL, C\.PATH, C\.SAND\]\.includes\(t\)\) return 'snow'/.test(game), '겨울 땅은 눈');
assert.ok(/footstep\(stepSurface\(\)\)/.test(game) && /ambience\(battle \|\| cutscenes\.active\(\)/.test(game) && /id="ambVol"/.test(game));
console.log('PASS v0.97 지지직거림 · 바위 정리 · 시야 · 주변 소리와 발소리');
