// ─────────────────────────────────────────────────────────────────────────────
// 새 3D(v0.77~) — 라이브러리 없이 WebGL로 그리는 진짜 3D · v0.78 HD-2D 시점
//
// 땅·절벽·건물은 진짜 3D(깊이 버퍼가 앞뒤를 정해요), 사람·우산몬·나무·물건은 기존 도트 그림을 세운 판으로 —
// ‘HD-2D’(옥토패스 트래블러) 방식이에요. 그 느낌을 가볍게 흉내 내요.
//   땅     지도 칸마다 네모(층 높이 그대로) + 계단은 비탈 + 절벽·물가·지도 가장자리는 세운 벽(밑동은 조금 어둡게)
//   건물   box3d.js의 앞·뒤·옆·지붕 그림을 진짜 상자에
//   판     사람·나무·물건은 카메라를 보는 판(HD-2D 시점에선 카메라 쪽으로 살짝 기울여 납작해 보이지 않게)
//   그림자 건물·절벽·나무 그림자를 해 방향으로 땅에 눕힌 판(그림자 지도 없이 가볍게) + 사람 발밑 그림자
//   화면 효과(한 번에 합성) 틸트 시프트(위·아래 흐림) · 블룸(밝은 곳 번짐) · 따뜻한 색 · 비네트 · 빛줄기
//   분위기 떠다니는 빛 먼지, 풀숲 덤불
//   가림   내 캐릭터를 가리는 벽·나무는 도트 무늬로 비쳐 보여요(옥토패스처럼)
// 야숨에서 배운 것: 셀 셰이딩(그늘은 푸른빛) · 대기 원근(멀수록 하늘색) · 바람에 흔들리는 나무
// 가볍게: 1배 해상도로 그리고, 땅·건물·나무·그림자는 지도마다 한 번만 만들어요. 그리기 호출은 건물 그림 수 + 10번쯤.
// v0.79 HD-2D 에셋팩(scripts/import-hd2d.py → hd2d-atlas.js)
//   그림 판  건물·여객선·가로등 PNG를 카메라와 수직으로 세운 판으로. 판의 아랫변 = 건물 앞줄(문 줄)이라
//            깊이가 2D의 ‘발끝 순서’와 똑같아요 → 앞 칸 사람은 앞에, 뒤 칸 사람은 뒤에(묻히지 않아요). 충돌은 지도 칸 그대로.
//   바다     물 칸 위에 물결 셰이더(깊은 물·얕은 물 그림이 천천히 흐르고, 물가엔 거품, 해가 비치면 반짝)
//   절벽     에셋팩 바위 그림을 세계 좌표로 이어 붙여요(이음매 없이)
//   해·시간  해 방향은 시각 따라(그림자만 다시 만들어요), 빛 색은 새벽·노을·밤 따라. 밤엔 가로등이 켜져요
//   땅 재질  칸마다 재질 번호(풀밭·긴 풀·흙길·돌길·콘크리트·모래·해변 자갈·잔자갈)를 작은 그림(재질 지도)에 적어 두고,
//            셰이더가 세계 좌표로 이음매 없는 재질 그림을 깔아요. 경계는 잡음으로 흔들어 자연스럽게(2픽셀 도트 단위).
//            계단·출구·건물 칸·물·건물 안은 예전 땅 그림 그대로.
//   나무     scripts/make-hd2d-nature.py가 그린 소나무·활엽수(계절 색은 season.js가 바꿔요)
//   GLB      v0.81 울릉도·독도 맵 에셋 팩 v1의 입체 모델(glb-models.js): 바위 지명(숫돌·독립문·촛대·코끼리·삼형제굴·탕건봉),
//            동도 등대, 절벽·건물 안 계단, 난간, 헬기장, 소파블록. 셀 셰이딩 + 팩의 표면 무늬(세계 좌표)로 그려요.
//            충돌·문·말 걸기 자리는 지도 칸 그대로(모델 상자를 충돌로 쓰지 않아요).
//   v0.82    「독도 탐험대 v0.81 에셋 팩」: 이야기 건물 12장(창작 시설) · 독도 식물(여름·가을) · 건물 안 벽·벽 윗면·바닥 재질 ·
//            바위 지명 GLB 4(보찰·상장군·한반도·천장굴 둘레, 형상 추정 표시 유지) · 동도 선착장 GLB(지도 칸 그대로)
//   품질     o.quality 0 낮음(그림자·화면 효과·물거품 끔) · 1 보통 · 2 높음(빛 먼지·반짝임까지)
// ─────────────────────────────────────────────────────────────────────────────
import { buildingKit, buildingBox } from './box3d.js';
import { LEVEL_H, cliffWalls, cliffTextures, shoreWalls, shoreTextures } from './heights.js';
import { V2_TERRAIN } from './tileset-v2.js';
import { assetImage, assetTintTag, monsterAssetKey } from './assets.js';
import { sceneDrawOrder, paintActor, buildingArt, PROP_KINDS, doorColumns } from './world.js';
import { HD2D_ATLAS, HD2D_TEXTURES } from './hd2d-atlas.js';
import { CLIFF_TEX, PACK96 } from './pack96.js';
import { HD2D_GROUND, HD2D_TREES } from './hd2d-nature.js';
import { TILE_CODES as TC } from './maps.js';
import { glbModel, GLB_SURF, GLB_MODELS as GLB_MODELS_META } from './glb-models.js';
import { STORY_ATLAS, INTERIOR_HD } from './story-atlas.js';
import { UW_ATLAS } from './uw-atlas.js';
import { FURN_ATLAS, UW_WALLS, REGION_ATLAS } from './furniture-atlas.js';
import { furnitureGroups, pieceSize } from './furniture.js';
import { seabedLayout, uwBlock, uwQuay } from './seabed.js';
const UW_FLOOR_H = -58, UW_CEIL_H = -3; // v0.87 바닷속: 바닥 높이 · 섬 밑동·안벽 윗면(물낯 바로 아래)

const T = 32, WATER = -6;
// HD-2D 시점: 내려다보는 각도(라디안) · 카메라 거리 · 세로 화각 · 판 기울기
export const HD = { pitch: .6, dist: 660, fov: 30 * Math.PI / 180, tilt: .42 };
const SURF = WATER + 2; // 물결 셰이더 물낯 높이(땅 그림의 물 칸보다 조금 위: 얕은 물에 선 발이 살짝 잠겨요)

// HD-2D 에셋팩 그림: v0.79 시범(도동항) → 모든 바깥 지도
export const hd2dMap = map => map.kind !== 'room';
const HOUSE_CARDS = ['ul_house_a', 'ul_house_b', 'ul_house_c', 'ul_house_b'];
// 이야기 건물(수호관·집·연구소·상점)과 독도 건물: 지도 건물 칸 폭에 맞춰 크게 가져온 그림(big_*)
const STORY_CARDS = { 'ulleung-gym': 'big_brick', 'ulleung-home': 'big_house', 'ulleung-lab': 'big_solar', 'ulleung-shop': 'big_shop',
  'dokdo-east-gym': 'big_summit', 'dokdo-east-lab': 'big_lighthouse', 'dokdo-east-shop': 'big_solar', 'dokdo-home': 'big_bluehouse',
  'dokdo-gym': 'big_lodge', 'dokdo-west-lab': 'big_solar', 'dokdo-west-shop': 'big_shop' };
// v0.82 이야기 건물 전용 그림(모두 창작 시설): 섬마다 수호관·연구소·상점·집
const STORY_V082 = { 'ulleung-gym': 'story_ul_gym', 'ulleung-home': 'story_ul_home', 'ulleung-lab': 'story_ul_lab', 'ulleung-shop': 'story_ul_shop',
  'dokdo-east-gym': 'story_dd_gym', 'dokdo-east-lab': 'story_dd_lab', 'dokdo-east-shop': 'story_dd_shop',
  'dokdo-gym': 'story_sd_gym', 'dokdo-west-lab': 'story_sd_lab', 'dokdo-west-shop': 'story_sd_shop' };
const storyKey = (map, b) => { const art = buildingArt(map, b); return art === 'dokdo-home' ? (map.def?.island === '동도' ? 'story_dd_home' : 'story_sd_home') : STORY_V082[art]; };
// 건물 → 그림 판 이름(없으면 기존 상자). story_* 는 STORY_ATLAS, 나머지는 HD2D_ATLAS
export function hd2dCard(map, b) {
  if (b.kind === 'terminal') return 'ul_terminal';
  if (b.kind === 'house') return HOUSE_CARDS[((b.v || 1) - 1) % 4];
  if (b.kind === 'block') return b.v % 2 ? 'ul_shop_a' : 'ul_shop_b';
  return storyKey(map, b) || STORY_CARDS[buildingArt(map, b)] || null;
}
// v0.84 그림 속 문을 진짜 문 칸에 맞춰요: 그림 판을 가로로 조금 옮겨요(px). 집 3종은 문이 오른쪽 칸(world.js doorColumns), 가게 A는 가운데 칸
export const CARD_DOOR_DX = { ul_house_a: 20, ul_house_b: 7, ul_house_c: 11, ul_shop_a: -13 };
// v0.84 문 앞 발판: 돌 문턱 위에 야자 매트(1px = 지도 1px, 도트 그림). 바깥 지도의 들어갈 수 있는 문마다 하나
export const DOOR_MAT = { w: 30, h: 16 };
let doorMatCv = null;
function doorMatCanvas() {
  if (doorMatCv || typeof document === 'undefined') return doorMatCv;
  const { w, h } = DOOR_MAT, c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'), px = (x, y, col, ww = 1, hh = 1) => { g.fillStyle = col; g.fillRect(x, y, ww, hh); };
  px(0, 1, '#5b5447', w, h - 1); px(1, 1, '#b7ae99', w - 2, h - 3); px(1, 1, '#d3cbb5', w - 2, 1); px(1, h - 3, '#8f8775', w - 2, 1); px(1, h - 2, '#6f6858', w - 2, 1); // 돌 문턱(윗면 밝게, 앞 모서리 어둡게)
  for (const [x, y] of [[3, 3], [24, 4], [7, 12], [26, 11], [14, 2]]) px(x, y, '#9e9581');
  px(4, 3, '#4a2f17', w - 8, h - 6); px(5, 4, '#a8733d', w - 10, h - 8); // 매트 테두리 · 바탕
  for (let y = 5; y < h - 4; y += 2) px(5, y, '#c4925a', w - 10, 1); // 엮은 결
  for (let x = 6; x < w - 5; x += 3) px(x, 4, '#c79a5f'); // 윗가장자리 올
  px(5, 4, '#7d5229', 1, h - 8); px(w - 6, 4, '#7d5229', 1, h - 8);
  return (doorMatCv = c);
}
export const cardFrame = key => (key?.startsWith('story_') || key?.startsWith('fl_') && STORY_ATLAS.frames[key] ? STORY_ATLAS.frames[key] : HD2D_ATLAS.frames[key]);

const VS_MESH = `attribute vec3 aPos; attribute vec2 aUV; attribute vec3 aNrm;
uniform mat4 uMVP; uniform vec3 uCam; varying vec2 vUV; varying vec3 vN, vWP; varying float vDist, vW;
void main(){ gl_Position = uMVP * vec4(aPos, 1.0); vUV = aUV; vN = aNrm; vWP = aPos; vDist = distance(aPos.xz, uCam.xz); vW = gl_Position.w; }`;
const FS_COMMON = `precision mediump float;
uniform vec3 uFogCol, uTint; uniform vec2 uFog; uniform vec3 uSun; uniform vec4 uCut; uniform float uCutOn, uCutGap;
vec3 toon(vec3 c, vec3 n){ float nl = dot(normalize(n), uSun); float band = nl > .3 ? 1.0 : (nl > -.15 ? .84 : .7);
  return band > .99 ? c : c * vec3(.80, .87, 1.05) * band; }
vec3 air(vec3 c, float d){ c *= uTint; float f = smoothstep(uFog.x, uFog.y, d); return mix(c, uFogCol, f * .8); }
// 내 캐릭터를 가리는 것(캐릭터보다 카메라에 가깝고 화면에서 캐릭터 둘레)은 도트 무늬로 비워요 · 카메라에 아주 가까운 것도
bool cut(float w){ if (uCutOn < .5) return false; float k = mod(floor(gl_FragCoord.x) + floor(gl_FragCoord.y), 2.0);
  if (w < 46.0) return true; if (w < 100.0 && k < 1.0) return true;
  float d = length(vec2((gl_FragCoord.x - uCut.x) * 1.8, gl_FragCoord.y - uCut.y)); /* 세로로 긴 타원(캐릭터 둘레만) */ return w < uCut.w - uCutGap && d < uCut.z && (k < 1.0 || d < uCut.z * .55); }`;
const FS_MESH = FS_COMMON + `
uniform sampler2D uTex, uMat, uMatTex, uNoise; uniform vec4 uColor; uniform float uUseTex, uMode, uAO, uGround, uCutG, uCutY; uniform vec2 uMapSize; varying vec2 vUV; varying vec3 vN, vWP; varying float vDist, vW;
vec4 groundColor(){ // 칸마다 재질: 경계는 잡음으로 ±0.45칸 흔들어요(2픽셀 단위 → 도트 느낌)
  vec2 px = floor(vWP.xz); vec2 j = (texture2D(uNoise, floor(px / 2.0) / 128.0).rg - .5) * .9;
  vec2 cell = floor(px / 32.0 + j); float id = floor(texture2D(uMat, (cell + .5) / uMapSize).r * 255.0 + .5);
  if (id < .5) return texture2D(uTex, vUV);
  float sl = id - 1.0; vec2 f = clamp(fract(vWP.xz / 128.0), .5 / 128.0, 1.0 - .5 / 128.0); /* v0.97 칸 안 위치를 소수까지(부드럽게) · 옆 칸 그림이 섞이지 않게 반 점 안쪽 */
  return texture2D(uMatTex, (vec2(mod(sl, 4.0), floor(sl / 4.0)) + f) * vec2(.25, .25)); } // 재질 그림 4×4칸
void main(){
  if (uMode > 1.5) { gl_FragColor = vec4(.12, .16, .30, .26); return; }                                                             // 건물·절벽 그림자
  if (uMode > .5) { float r = length(vUV - vec2(.5)) * 2.0; gl_FragColor = vec4(.10, .14, .26, (1.0 - smoothstep(.35, 1.0, r)) * .34); return; } // 발밑 그림자
  vec4 c = uGround > .5 ? groundColor() : uUseTex > .5 ? texture2D(uTex, vUV) : uColor; if (c.a < .5) discard; if (cut(vW) && (uCutG < .5 || vWP.y > uCutY)) discard; /* 땅은 내 발보다 높은 곳(앞 언덕)만 비워요 */
  vec3 col = toon(c.rgb, vN); if (uAO > .5) col *= mix(1.0, .74, smoothstep(.62, 1.0, vUV.y)); // 벽 밑동은 조금 어둡게
  gl_FragColor = vec4(air(col, vDist), 1.0); }`;
const VS_SPRITE = `attribute vec3 aFoot; attribute vec2 aOff; attribute vec2 aUV; attribute vec3 aAxis;
uniform mat4 uMVP; uniform vec3 uRight; uniform vec2 uFwd; uniform float uTilt; uniform vec3 uCam; uniform float uTime; varying vec2 vUV; varying float vDist, vW;
void main(){
  bool fixedAxis = !(aAxis.x == 0.0 && aAxis.y == 0.0);
  vec3 r = fixedAxis ? vec3(aAxis.x, 0.0, aAxis.y) : uRight;
  vec3 up = fixedAxis ? vec3(0.0, 1.0, 0.0) : vec3(uFwd.x * sin(uTilt), cos(uTilt), uFwd.y * sin(uTilt)); // HD-2D: 위쪽을 카메라 반대쪽으로 눕혀 카메라를 마주 봐요(v0.79 고침: 예전엔 거꾸로 눕어 납작했어요)
  float sw = aAxis.z * sin(uTime * 1.3 + aFoot.x * .045 + aFoot.z * .03) * 3.0 * clamp(aOff.y / 64.0, 0.0, 1.0);    // 바람: 위로 갈수록 더 흔들려요
  vec3 p = aFoot + r * (aOff.x + sw) + up * aOff.y;
  gl_Position = uMVP * vec4(p, 1.0); vUV = aUV; vDist = distance(aFoot.xz, uCam.xz); vW = gl_Position.w; }`;
// v0.97 걸을 때 지지직거림(그림 판이 화면 픽셀과 딱 맞지 않을 때 가장 가까운 점만 고르면 한 칸씩 튀어요):
//   ‘또렷한 쌍선형’ — 그림 한 점의 안쪽은 그 색 그대로, 점과 점 사이 경계만 화면 1px 폭으로 부드럽게 섞어요(도트는 또렷, 깜빡임은 없게).
//   그림은 미리 곱한 알파로 올려 투명한 칸의 검은색이 테두리에 번지지 않게 해요. uSharp 0이면 예전처럼 가장 가까운 점.
const FS_SPRITE_EXT = `#extension GL_OES_standard_derivatives : enable
`;
const FS_SPRITE_BODY = `
uniform sampler2D uTex; uniform float uGlow, uSharp; uniform vec2 uTexSize; varying vec2 vUV; varying float vDist, vW;
vec4 sample(){
#ifdef SHARP
  if (uSharp > .5) { vec2 t = vUV * uTexSize, s = floor(t + .5), d = max(fwidth(t), vec2(1e-4)); t = s + clamp((t - s) / d, -.5, .5);
    vec4 c = texture2D(uTex, t / uTexSize); return vec4(c.rgb / max(c.a, 1e-3), c.a); }
#endif
  return texture2D(uTex, vUV); }
void main(){ vec4 c = sample(); if (uGlow > 0.0) { gl_FragColor = vec4(c.rgb * c.a * uGlow, 1.0); return; } // 가로등 불빛(더하기)
  if (c.a < .5) discard; if (cut(vW)) discard; gl_FragColor = vec4(air(c.rgb, vDist), 1.0); }`;
const FS_SPRITE = FS_COMMON + FS_SPRITE_BODY;
// GLB 모델: 정점마다 색·재질. 재질 1~4는 팩 표면 무늬를 세계 좌표로(1무늬 픽셀 = 지도 1픽셀, 거울 반복), 0은 단색 + 도트 잡음
const VS_MODEL = `attribute vec3 aPos, aNrm, aCol; attribute float aCls;
uniform mat4 uMVP; uniform vec3 uCam; varying vec3 vWP, vN, vCol; varying float vCls, vDist, vW;
void main(){ gl_Position = uMVP * vec4(aPos, 1.0); vWP = aPos; vN = aNrm; vCol = aCol; vCls = aCls; vDist = distance(aPos.xz, uCam.xz); vW = gl_Position.w; }`;
const FS_MODEL = FS_COMMON + `
uniform sampler2D uSurf; uniform float uSurfOn; varying vec3 vWP, vN, vCol; varying float vCls, vDist, vW;
vec3 surf(float cls){ vec3 a = abs(vN); vec3 p = floor(vWP);
  vec2 uv = (a.y > a.x && a.y > a.z) ? p.xz : (a.x > a.z ? vec2(p.z, -p.y) : vec2(p.x, -p.y));
  vec2 f = abs(fract(uv / 128.0) * 2.0 - 1.0); f = clamp(f, .004, .996);
  return texture2D(uSurf, vec2((cls - 1.0 + f.x) * .2, f.y)).rgb; } // 무늬 5칸
void main(){
  if (cut(vW)) discard;
  vec3 c = vCol; float hsh = fract(sin(dot(floor(vWP.xz / 2.0) + floor(vWP.y / 2.0) * 7.0, vec2(12.9898, 78.233))) * 43758.5453);
  if (vCls > .5 && uSurfOn > .5) { vec3 t = surf(floor(vCls + .5)); float l = max(.2, dot(c, vec3(.333))); c = t * mix(vec3(1.0), c / l, .45); }
  else c *= .93 + hsh * .12;
  gl_FragColor = vec4(air(toon(c, vN), vDist), 1.0); }`;
// 바다: 깊은 물·얕은 물 그림 두 겹이 서로 다른 쪽으로 천천히 흘러요. vK.x 얕음(0~1) · vK.y 물가(거품)
const VS_WATER = `attribute vec3 aPos; attribute vec2 aUV; uniform mat4 uMVP; uniform vec3 uCam; varying vec2 vK, vP; varying float vDist;
void main(){ gl_Position = uMVP * vec4(aPos, 1.0); vK = aUV; vP = aPos.xz; vDist = distance(aPos.xz, uCam.xz); }`;
const FS_WATER = `precision mediump float;
uniform sampler2D uDeep, uShal, uFoam; uniform float uTime, uFx, uLight, uGlit; uniform vec3 uSun, uFogCol, uTint, uEye, uGlitCol; uniform vec2 uFog; varying vec2 vK, vP; varying float vDist;
void main(){
  float t = uTime; vec2 p = vP / 256.0;
  vec3 deep = (texture2D(uDeep, p + vec2(t * .012, t * .007)).rgb + texture2D(uDeep, p * 1.37 + vec2(-t * .009, t * .011)).rgb) * .5;
  vec3 shal = (texture2D(uShal, p * 1.2 + vec2(t * .006, -t * .004)).rgb + texture2D(uShal, p * .9 - vec2(t * .005, t * .003)).rgb) * .5;
  vec3 c = mix(deep, shal, vK.x);
  if (uFx > .5) { // 물가 거품: 거품 그림 + 밀려왔다 빠지는 물결
    float wave = .5 + .5 * sin(t * 1.6 - vK.y * 5.0 + (vP.x + vP.y) * .02);
    float fm = smoothstep(.72, .95, texture2D(uFoam, vP / 96.0 + vec2(t * .02, t * .01)).r);
    c = mix(c, vec3(.93, .97, 1.0), smoothstep(.5, .8, vK.y * (fm * .75 + wave * .45)) * .85);
  }
  if (uFx > 1.5) { // 햇빛 반짝임
    float g = texture2D(uDeep, p * 3.1 + vec2(t * .03, -t * .02)).b * texture2D(uDeep, p * 2.3 - vec2(t * .025, t * .018)).b;
    c += vec3(1.0, .95, .8) * smoothstep(.36, .5, g) * .5 * uLight * clamp(uSun.y, 0.0, 1.0);
  }
  c *= uTint; c = mix(c, uFogCol, smoothstep(uFog.x, uFog.y, vDist) * .8);
  if (uGlit > .5) { /* v0.84 1인칭: 해를 향한 바다에 반짝이는 햇빛 길 */ vec3 v = normalize(vec3(vP.x - uEye.x, -uEye.y, vP.y - uEye.z)); float s = max(dot(vec3(v.x, -v.y, v.z), normalize(uSun)), 0.0); float sp = texture2D(uDeep, p * 4.0 + vec2(t * .05, -t * .04)).b; c += uGlitCol * (pow(s, 40.0) * .7 + pow(s, 400.0) * 2.2) * smoothstep(.2, .55, sp); }
  gl_FragColor = vec4(c, mix(.93, .8, vK.x)); }`;
// 빛 먼지: 점 하나하나가 시간 따라 천천히 떠다니며 반짝여요
const VS_MOTE = `attribute vec4 aSeed; uniform mat4 uMVP; uniform float uTime; uniform vec3 uCenter; uniform float uScale; varying float vA;
void main(){ float t = uTime * (.25 + aSeed.w * .2) + aSeed.w * 30.0;
  vec3 p = uCenter + vec3(aSeed.x + sin(t) * 18.0, 14.0 + mod(aSeed.y + uTime * 6.0 * (.5 + aSeed.w), 150.0), aSeed.z + cos(t * .8) * 18.0);
  gl_Position = uMVP * vec4(p, 1.0); gl_PointSize = max(1.5, uScale * (2.0 + aSeed.w * 2.5) * 180.0 / gl_Position.w); vA = .35 + .65 * abs(sin(t * 2.3)); }`;
const FS_MOTE = `precision mediump float; uniform float uLight; varying float vA;
void main(){ vec2 d = gl_PointCoord - .5; float a = (1.0 - smoothstep(.15, .5, length(d))) * vA * uLight; gl_FragColor = vec4(1.0, .93, .72, a); }`;
// 화면 합성: 틸트 시프트 · 블룸 · 색감 · 빛줄기 · 비네트를 한 번에
const VS_POST = `attribute vec2 aP; varying vec2 vUV; void main(){ vUV = aP * .5 + .5; gl_Position = vec4(aP, 0.0, 1.0); }`;
const FS_POST = `precision mediump float; uniform sampler2D uScene, uSmall; uniform vec2 uTexel; uniform float uFocus, uTime, uLight, uDof; varying vec2 vUV;
void main(){
  vec4 s = texture2D(uScene, vUV);
  vec2 o = uTexel; vec4 b = texture2D(uSmall, vUV) * .36 + (texture2D(uSmall, vUV + vec2(o.x, 0.0)) + texture2D(uSmall, vUV - vec2(o.x, 0.0)) + texture2D(uSmall, vUV + vec2(0.0, o.y)) + texture2D(uSmall, vUV - vec2(0.0, o.y))) * .16;
  float dof = smoothstep(.3, .62, abs(vUV.y - uFocus)) * uDof; /* v0.91 내 둘레(가까운 우산몬·물건)는 또렷하게, 화면 끝만 흐리게 */
  vec3 c = mix(s.rgb, b.rgb, dof * .7);
  c += max(b.rgb - .6, 0.0) * 1.5 * uLight;                                            // 블룸
  c = c * vec3(1.04, 1.01, .95) + vec3(.01, .006, 0.0);                                 // 따뜻한 색
  float sh = pow(.5 + .5 * sin((vUV.x * 1.2 - vUV.y * .8) * 8.0 + uTime * .15), 10.0);   // 빛줄기(비스듬한 띠)
  c += vec3(1.0, .92, .72) * sh * .05 * uLight * vUV.y;
  c *= mix(.7, 1.0, smoothstep(.9, .3, length((vUV - .5) * vec2(1.15, 1.0))));         // 비네트
  gl_FragColor = vec4(c, max(s.a, b.a * dof)); }`;
const VS_COPY = VS_POST, FS_COPY = `precision mediump float; uniform sampler2D uScene; varying vec2 vUV; void main(){ gl_FragColor = texture2D(uScene, vUV); }`;
// v0.97 화면 효과용 작은 그림(1/4)을 만들 때 4×4칸을 고르게 섞어요. 예전엔 한 점만 골라 작게 줄여서, 밝은 꽃·잎 점이 카메라가 움직일 때마다
//   작은 그림에 들어갔다 빠졌다 하며 번짐(블룸)·흐림(심도)이 깜빡였어요(밝은 초원에서 가장 심하게 ‘지지직’).
const FS_DOWN = `precision mediump float; uniform sampler2D uScene; uniform vec2 uSrc; varying vec2 vUV;
void main(){ vec2 t = uSrc; gl_FragColor = (texture2D(uScene, vUV + vec2(-t.x, -t.y)) + texture2D(uScene, vUV + vec2(t.x, -t.y)) + texture2D(uScene, vUV + vec2(-t.x, t.y)) + texture2D(uScene, vUV + vec2(t.x, t.y))) * .25; }`;

function hex(c) { const n = parseInt(String(c).replace('#', '').slice(0, 6), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; }
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
function rowsToMat(r0, r1, r2, r3) { const m = new Float32Array(16); for (let c = 0; c < 4; c++) { m[c * 4] = r0[c]; m[c * 4 + 1] = r1[c]; m[c * 4 + 2] = r2[c]; m[c * 4 + 3] = r3[c]; } return m; }

// 예전 3D와 같은 원근(뒤에서 따라가기). cam·P: view3d.js makeChase
export function chaseView(cam, P) {
  const f = P.f, W = P.W, H = P.H, hz = cam.hz, eye = cam.eye, near = 8, far = 9000, A = (far + near) / (far - near), Bn = -2 * far * near / (far - near);
  const tf = -(cam.fx * cam.x + cam.fy * cam.y), tl = -(cam.rx * cam.x + cam.ry * cam.y), k = (H - 2 * hz) / H;
  const M = rowsToMat([2 * f / W * cam.rx, 0, 2 * f / W * cam.ry, 2 * f / W * tl], [k * cam.fx, 2 * f / H, k * cam.fy, -2 * f / H * eye + k * tf], [A * cam.fx, 0, A * cam.fy, A * tf + Bn], [cam.fx, 0, cam.fy, tf]);
  return { M, eye: [cam.x, eye, cam.y], right: [cam.rx, 0, cam.ry], fwd: [cam.fx, cam.fy], tilt: 0, hd: false, W, H };
}
// HD-2D 시점: (tx, ty) 높이 th 를 비스듬히 내려다봐요. project·unproject 는 화면(장면 픽셀) ↔ 지도
export function hdCamera(tx, ty, th, yaw, W, H, pxScale = 1, zoom = 1) { // pxScale: 이 장면 1단위가 그림판(캔버스) 몇 px인지 · zoom: v0.97 시야(1 보통, 1보다 크면 더 넓게)
  const s = Math.sin(yaw), c = Math.cos(yaw), cp = Math.cos(HD.pitch), sp = Math.sin(HD.pitch);
  const f = [s * cp, -sp, -c * cp], r = [c, 0, s], u = [s * sp, cp, -c * sp], tgt = [tx, th + 22, ty];
  // v0.91 도트가 고르게: 내 캐릭터 자리에서 지도 1px이 화면 정수 px(1·2·3…)이 되게 카메라 거리를 살짝 맞춰요(굵기가 들쭉날쭉하지 않게)
  const t = Math.tan(HD.fov / 2), sy = 1 / t, px0 = H / 2 * sy / HD.dist * pxScale, pxk = zoom === 1 ? Math.max(1, Math.round(px0)) : Math.max(.5, px0 / zoom), /* 넓은 시야는 정수로 맞추지 않아요(또렷한 쌍선형이라 도트가 흔들리지 않아요) */ dist = H / 2 * sy * pxScale / pxk;
  const eye = [tgt[0] - f[0] * dist, tgt[1] - f[1] * dist, tgt[2] - f[2] * dist];
  const sx = sy * H / W, near = 20, far = 7000, A = (far + near) / (far - near), Bn = -2 * far * near / (far - near);
  const tr = -dot3(r, eye), tu = -dot3(u, eye), tfw = -dot3(f, eye);
  const M = rowsToMat([sx * r[0], sx * r[1], sx * r[2], sx * tr], [sy * u[0], sy * u[1], sy * u[2], sy * tu], [A * f[0], A * f[1], A * f[2], A * tfw + Bn], [f[0], f[1], f[2], tfw]);
  const view = (x, h, y) => { const d = [x - eye[0], h - eye[1], y - eye[2]]; return [dot3(d, r), dot3(d, u), dot3(d, f)]; };
  return {
    M, eye, right: r, fwd: [s, -c], tilt: HD.tilt, hd: true, W, H, yaw,
    project(wx, wy, h = 0) { const [xv, yv, zv] = view(wx, h, wy); if (zv < near) return null; const k = H / 2 * sy / zv; return { x: W / 2 + xv * sx / zv * W / 2, y: H / 2 - yv * sy / zv * H / 2, k, z: zv }; },
    unproject(px, py, h = 0) { const nx = (px - W / 2) / (W / 2), ny = (H / 2 - py) / (H / 2), d = [0, 1, 2].map(i => f[i] + r[i] * nx / sx + u[i] * ny / sy); if (d[1] >= -1e-4) return null; const k = (h - eye[1]) / d[1]; return { x: eye[0] + d[0] * k, y: eye[2] + d[2] * k }; }
  };
}

// v0.84 1인칭 관찰: 눈 자리(ex, ez, 높이 eh)에서 yaw(0 = 북쪽)·pitch(+ = 아래)로 봐요. 나머지는 hdCamera와 같은 꼴(fp 표시)
export function fpCamera(ex, ez, eh, yaw, pitch, fov, W, H) {
  const s = Math.sin(yaw), c = Math.cos(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  const f = [s * cp, -sp, -c * cp], r = [c, 0, s], u = [s * sp, cp, -c * sp], eye = [ex, eh, ez];
  const t = Math.tan(fov / 2), sy = 1 / t, sx = sy * H / W, near = 6, far = 16000, A = (far + near) / (far - near), Bn = -2 * far * near / (far - near);
  const tr = -dot3(r, eye), tu = -dot3(u, eye), tfw = -dot3(f, eye);
  const M = rowsToMat([sx * r[0], sx * r[1], sx * r[2], sx * tr], [sy * u[0], sy * u[1], sy * u[2], sy * tu], [A * f[0], A * f[1], A * f[2], A * tfw + Bn], [f[0], f[1], f[2], tfw]);
  const view = (x, h, y) => { const d = [x - eye[0], h - eye[1], y - eye[2]]; return [dot3(d, r), dot3(d, u), dot3(d, f)]; };
  return {
    M, eye, right: r, fwd: [s, -c], tilt: 0, hd: true, fp: true, W, H, yaw,
    project(wx, wy, h = 0) { const [xv, yv, zv] = view(wx, h, wy); if (zv < near) return null; const k = H / 2 * sy / zv; return { x: W / 2 + xv * sx / zv * W / 2, y: H / 2 - yv * sy / zv * H / 2, k, z: zv }; },
    unproject() { return null; }
  };
}

export function createGL(canvas) {
  let gl = null;
  try { gl = canvas.getContext('webgl', { antialias: false, alpha: true, premultipliedAlpha: false, preserveDrawingBuffer: true }) || canvas.getContext('experimental-webgl'); } catch { gl = null; }
  const off = { ok: false, render() { return false; }, info: { ok: false }, reset() {} };
  if (!gl) return off;
  const compile = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const program = (vs, fs, attrs) => { const p = gl.createProgram(); gl.attachShader(p, compile(gl.VERTEX_SHADER, vs)); gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const a = {}, u = {}; for (const n of attrs) a[n] = gl.getAttribLocation(p, n);
    const cnt = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); for (let i = 0; i < cnt; i++) { const n = gl.getActiveUniform(p, i).name; u[n] = gl.getUniformLocation(p, n); } return { p, a, u }; };
  let mesh, sprite, mote, post, copy, down, water, model, sharpOK = false;
  try {
    mesh = program(VS_MESH, FS_MESH, ['aPos', 'aUV', 'aNrm']); sprite = null; if (gl.getExtension('OES_standard_derivatives')) try { sprite = program(VS_SPRITE, FS_SPRITE_EXT + '#define SHARP 1\n' + FS_SPRITE, ['aFoot', 'aOff', 'aUV', 'aAxis']); sharpOK = true; } catch (e) { console.warn('gl3d sharp', e); } if (!sprite) sprite = program(VS_SPRITE, FS_SPRITE, ['aFoot', 'aOff', 'aUV', 'aAxis']); water = program(VS_WATER, FS_WATER, ['aPos', 'aUV']); model = program(VS_MODEL, FS_MODEL, ['aPos', 'aNrm', 'aCol', 'aCls']);
    mote = program(VS_MOTE, FS_MOTE, ['aSeed']); post = program(VS_POST, FS_POST, ['aP']); copy = program(VS_COPY, FS_COPY, ['aP']); down = program(VS_POST, FS_DOWN, ['aP']);
  } catch (e) { console.warn('gl3d', e); return off; }

  // ── 그림 → 텍스처 ──
  const texOf = new Map();
  function texture(src, update = false, wrap = 0, smooth = false) { // smooth: v0.97 'sprite' 그림 판(또렷한 쌍선형·미리 곱한 알파) · true 땅 재질(부드럽게) // wrap 1 반복 · 2 거울 반복(이음매가 보이는 그림) — 가로세로 2의 거듭제곱 그림만
    let t = texOf.get(src); const fresh = !t, W = wrap === 2 ? gl.MIRRORED_REPEAT : wrap ? gl.REPEAT : gl.CLAMP_TO_EDGE;
    if (fresh) { t = gl.createTexture(); texOf.set(src, t); gl.bindTexture(gl.TEXTURE_2D, t); const FL = smooth ? gl.LINEAR : gl.NEAREST; gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, FL); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, FL); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, W); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, W); }
    if (fresh || update) { gl.bindTexture(gl.TEXTURE_2D, t); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, smooth === 'sprite'); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src); }
    return t;
  }
  function upload(arr, buf = null) { const b = buf || gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arr), buf ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW); return b; }
  class Batch { constructor() { this.v = []; } quad(p, uv, n) { for (const i of [0, 1, 2, 0, 2, 3]) this.v.push(p[i][0], p[i][1], p[i][2], uv[i][0], uv[i][1], n[0], n[1], n[2]); } poly(p, uv, n) { for (let i = 1; i < p.length - 1; i++) for (const k of [0, i, i + 1]) this.v.push(p[k][0], p[k][1], p[k][2], uv[k][0], uv[k][1], n[0], n[1], n[2]); } }

  // ── 땅 높이 ──
  const ROOM_WALL = 48;
  const lv = (map, x, y) => { const v = map[y]?.[x]; if (v === undefined) return 0;
    if (map.kind === 'room') return v === TC.WALL ? (map[y + 1]?.[x] === undefined || map[y + 1][x] === TC.VOID ? 8 : ROOM_WALL) : v === TC.VOID ? -6 : 0; // 건물 안: 벽은 서 있고 앞(아래) 벽만 낮게 → 방 안이 보여요
    if (map.diving) return uwBlock(map, x, y) ? UW_CEIL_H : UW_FLOOR_H; // v0.87 바닷속: 바닥과 섬 밑동만
    return v === 0 ? WATER : (map.cliff?.base.get(`${x},${y}`) || 0) * LEVEL_H; };
  function cornerHeights(map, x, y) {
    const h = lv(map, x, y), c = map.diving ? null : map.cliff, k = `${x},${y}`; let nw = h, ne = h, sw = h, se = h;
    if (c?.stairs.has(k)) { // 계단은 비탈: 높은 쪽에서 낮은 쪽으로
      if (c.face.has(k)) { const top = c.faceTop.get(k) * LEVEL_H; nw = ne = top; }
      else { const sides = c.rim.get(k) || '', base = (c.base.get(k) || 0) * LEVEL_H;
        if (sides.includes('n')) { nw = Math.min(nw, lv(map, x, y - 1)); ne = Math.min(ne, lv(map, x, y - 1)); sw = se = base; }
        if (sides.includes('w')) { nw = Math.min(nw, lv(map, x - 1, y)); sw = Math.min(sw, lv(map, x - 1, y)); }
        if (sides.includes('e')) { ne = Math.min(ne, lv(map, x + 1, y)); se = Math.min(se, lv(map, x + 1, y)); } }
    }
    return { nw, ne, sw, se };
  }
  function groundAt(map, wx, wy) { // 발이 닿는 땅 높이(계단 비탈은 칸 안 자리에 따라 이어서)
    const x = Math.floor(wx / T), y = Math.floor(wy / T); if (!map[y] || map[y][x] === undefined) return 0;
    const c = cornerHeights(map, x, y), fx = wx / T - x, fy = wy / T - y;
    return (c.nw * (1 - fx) + c.ne * fx) * (1 - fy) + (c.sw * (1 - fx) + c.se * fx) * fy;
  }

  // ── 지도마다 한 번: 땅·벽·건물·물 (그림자는 해가 움직이면 그것만 다시) ──
  let scene = null;
  // v0.87 바닷속 장면: 물 위의 것은 하나도 없이 — 바닥(해저 타일) · 섬 밑동 바위벽 · 항구 콘크리트 안벽 · 바다숲·생물·바위 판
  let quayCv = null;
  function quayCanvas() { // 안벽 블록(가로 32 · 세로 16, 엇갈려 쌓기) + 아래쪽 물때
    if (quayCv || typeof document === 'undefined') return quayCv; const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
    for (let r = 0; r < 4; r++) for (let i = -1; i < 3; i++) { const x = i * 32 + (r % 2 ? 16 : 0), y = r * 16, v = 132 + ((i * 7 + r * 13) % 5) * 6; g.fillStyle = `rgb(${v - 8},${v},${v + 4})`; g.fillRect(x, y, 32, 16); g.fillStyle = '#5c666c'; g.fillRect(x, y + 15, 32, 1); g.fillRect(x + 31, y, 1, 16); g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(x, y, 31, 1); }
    for (let i = 0; i < 90; i++) { const x = (i * 37) % 64, y = (i * 53) % 64; g.fillStyle = i % 3 ? 'rgba(40,60,50,.18)' : 'rgba(90,120,80,.22)'; g.fillRect(x, y, 2, 1); }
    return (quayCv = c);
  }
  const uwWallCv = {}; // v0.88 「해안 벽 확장팩」 안벽·자연 암벽 그림에서 자른 이어 붙이기 재질(128×128)
  function uwWall(kind) {
    if (uwWallCv[kind] || typeof document === 'undefined') return uwWallCv[kind] || null; const img = assetImage(UW_WALLS.key); if (!img) return null;
    const r = UW_WALLS[kind], c = document.createElement('canvas'); c.width = r[2]; c.height = r[3]; c.getContext('2d').drawImage(img, r[0], r[1], r[2], r[3], 0, 0, r[2], r[3]); return (uwWallCv[kind] = c);
  }
  function buildUnderwater(map, ground) {
    const W = map[0].length, H = map.length, gw = W * T, gh = H * T, floor = new Batch(), rock = new Batch(), quay = new Batch(), rockImg = uwWall('cliff') || assetImage(HD2D_TEXTURES.rock), qc = uwWall('quay') || quayCanvas(), uwImg = assetImage(UW_ATLAS.key), packWalls = !!uwWallCv.quay, S = packWalls ? 128 : 64; /* 팩 재질은 1px = 지도 1px로 */
    const blk = (x, y) => uwBlock(map, x, y), F = UW_FLOOR_H, C = UW_CEIL_H;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const X0 = x * T, X1 = X0 + T, Z0 = y * T, Z1 = Z0 + T;
      if (!blk(x, y)) { floor.quad([[X0, F, Z0], [X1, F, Z0], [X1, F, Z1], [X0, F, Z1]], [[X0 / gw, Z0 / gh], [X1 / gw, Z0 / gh], [X1 / gw, Z1 / gh], [X0 / gw, Z1 / gh]], [0, 1, 0]); continue; }
      const b = uwQuay(map, x, y) ? quay : rock;
      b.quad([[X0, C, Z0], [X1, C, Z0], [X1, C, Z1], [X0, C, Z1]], [[X0 / S, Z0 / S], [X1 / S, Z0 / S], [X1 / S, Z1 / S], [X0 / S, Z1 / S]], [0, 1, 0]);
      for (const [dx, dy, a, c2, n] of [[0, 1, [X1, Z1], [X0, Z1], [0, 1]], [0, -1, [X0, Z0], [X1, Z0], [0, -1]], [-1, 0, [X0, Z1], [X0, Z0], [-1, 0]], [1, 0, [X1, Z0], [X1, Z1], [1, 0]]]) {
        if (blk(x + dx, y + dy) || map[y + dy]?.[x + dx] === undefined) continue; const u0 = (a[0] + a[1]) / S, u1 = (c2[0] + c2[1]) / S, vb = packWalls ? (C - F) / S : -F / 64, vt = packWalls ? 0 : -C / 64; // 팩 재질은 윗변(물낯 쪽)부터
        b.quad([[a[0], F, a[1]], [c2[0], F, c2[1]], [c2[0], C, c2[1]], [a[0], C, a[1]]], [[u0, vb], [u1, vb], [u1, vt], [u0, vt]], [n[0], 0, n[1]]); }
    }
    const B = 6000; for (const [x0, z0, x1, z1] of [[-B, -B, gw + B, 0], [-B, gh, gw + B, gh + B], [-B, 0, 0, gh], [gw, 0, gw + B, gh]]) floor.quad([[x0, F, z0], [x1, F, z0], [x1, F, z1], [x0, F, z1]], [[0, 0], [0, 0], [0, 0], [0, 0]], [0, 1, 0]); // 지도 밖도 바닥(안개 속)
    const meshes = [{ tex: ground, buf: upload(floor.v), n: floor.v.length / 8, ground: true }];
    if (rockImg && rock.v.length) meshes.push({ tex: rockImg, buf: upload(rock.v), n: rock.v.length / 8, wrap: true });
    if (qc && quay.v.length) meshes.push({ tex: qc, buf: upload(quay.v), n: quay.v.length / 8, wrap: true });
    const cards = []; if (uwImg) for (const it of seabedLayout(map).items) { if (it.edge) continue; const f = UW_ATLAS.frames[it.id]; if (f) cards.push({ key: it.id, f, x: (it.x + (it.w || 1) / 2) * T + (it.big ? 0 : (((it.x * 7 + it.y * 3) % 9) - 4)), z: it.y * T + (it.big ? 30 : 24), h: F, uw: true }); }
    const missing = (!rockImg || !uwImg || !qc || !packWalls) ? 1 : 0;
    return { id: map.id, tag: assetTintTag(), hd2d: true, uw: true, meshes, missing, gw, gh, statics: { buf: null, n: 0, atlas: null, flat: { n: 0 }, blobs: { n: 0 } }, casters: [], shade: null, sunKey: '', water: null, cards: cardBuffer(cards, map), lamps: [],
      models: null, hideStatic: new Set(), hideLandmarks: new Set(), interior: false, pier: false, doorMats: 0, rockCaps: 0, landmarks: {} };
  }
  function buildScene(map, ground, o) {
    if (map.diving && o.hd2d && map.kind !== 'room') return buildUnderwater(map, ground);
    const W = map[0].length, H = map.length, gw = W * T, gh = H * T, top = new Batch(), sea = new Batch(), wet = new Batch(), casters = []; let scene_caps = 0;
    /* v0.96 절벽 재질(05): 독도·울릉도마다 다른 절벽 면(독도 붉은 갈색 응회암 · 울릉도 회색 현무암). 윗면은 예전 바위 그림 */
    const cliffSet = CLIFF_TEX[map.def?.island === '울릉도' ? 'ulleung' : 'dokdo'], rock0 = map.kind !== 'room' ? assetImage(HD2D_TEXTURES.rock) : null;
    const faceImg = rock0 ? assetImage(cliffSet.face) || rock0 : null, topImg = rock0, FS = faceImg?.width || 64, TS = topImg?.width || 64;
    const card = o.hd2d, rockImg = rock0, atlasImg = card ? assetImage(HD2D_ATLAS.key) : null, storyImg = card ? assetImage(STORY_ATLAS.key) : null;
    const room = map.kind === 'room', interImg = room ? assetImage(INTERIOR_HD.key) : null;
    const waterImgs = [HD2D_TEXTURES.sea_deep, HD2D_TEXTURES.sea_shallow, HD2D_TEXTURES.foam].map(k => assetImage(k)), useWater = !map.diving && map.kind !== 'room' && waterImgs.every(Boolean);
    const outdoor = map.kind !== 'room' && !map.diving; let missing = (card && !atlasImg) || (map.kind !== 'room' && !rockImg) || (map.kind !== 'room' && !assetImage(cliffSet.face)) || (outdoor && !useWater) || (card && !storyImg) || (room && !interImg) || (room && !assetImage(FURN_ATLAS.key)) ? 1 : 0; // 그림이 아직 안 왔으면 조금 뒤 다시 만들어요
    const isWater = (x, y) => map[y]?.[x] === undefined || map[y][x] === 0;
    // v0.82 동도 선착장 GLB 자리(지도 # 칸): 땅 윗면·물가 벽을 빼서 겹쳐 깜빡이지 않게
    const pier = o.hd2d && map.id === 'route0' && glbModel('dongdo_pier') ? new Set() : null;
    if (pier) for (let y = 15; y <= 28; y++) for (let x = 0; x <= 20; x++) if (map[y]?.[x] === TC.DOCK) pier.add(`${x},${y}`);
    // v0.82 건물 안: 바닥·벽 윗면은 실내 재질 그림으로(한 칸 = 그림 한 장, 1:1)
    const IR = INTERIOR_HD.rects, ikind = room ? (/^(shop|block|terminal)/.test(map.def?.building || '') ? 'shop' : /^lab/.test(map.def?.building || '') ? 'lab' : /^gym/.test(map.def?.building || '') ? 'gym' : 'home') : null;
    const iuv = (r, px0, py0, px1, py1) => [(r[0] + px0) / INTERIOR_HD.width, (r[1] + py0) / INTERIOR_HD.height, (r[0] + px1) / INTERIOR_HD.width, (r[1] + py1) / INTERIOR_HD.height];
    const inter = new Batch(), interFloor = new Batch(), rimTop = new Batch(); // 벽(가림 도트 무늬 받음) · 바닥과 벽 윗면(땅처럼 비치지 않음)
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const c = cornerHeights(map, x, y), X0 = x * T, X1 = X0 + T, Z0 = y * T, Z1 = Z0 + T;
      if (pier?.has(`${x},${y}`)) continue;
      if (interImg && [TC.FLOOR, TC.STONE, TC.WALL].includes(map[y][x])) { const [u0, v0, u1, v1] = iuv(IR[`${ikind}_${map[y][x] === TC.WALL ? 'walltop' : 'floor'}`], 0, 0, 32, 32), h = c.nw;
        interFloor.quad([[X0, h, Z0], [X1, h, Z0], [X1, h, Z1], [X0, h, Z1]], [[u0, v0], [u1, v0], [u1, v1], [u0, v1]], [0, 1, 0]); continue; }
      const kk = `${x},${y}`; if (rockImg && !room && map.cliff?.rim.has(kk) && !map.cliff.face.has(kk) && !map.cliff.stairs.has(kk) && map.solid.has(kk)) { rimTop.quad([[X0, c.nw, Z0], [X1, c.ne, Z0], [X1, c.se, Z1], [X0, c.sw, Z1]], [[X0 / TS, Z0 / TS], [X1 / TS, Z0 / TS], [X1 / TS, Z1 / TS], [X0 / TS, Z1 / TS]], [0, 1, 0]); continue; } // v0.84 절벽 끝 비탈은 바위(풀·눈 길처럼 보이지 않게)
      top.quad([[X0, c.nw, Z0], [X1, c.ne, Z0], [X1, c.se, Z1], [X0, c.sw, Z1]], [[X0 / gw, Z0 / gh], [X1 / gw, Z0 / gh], [X1 / gw, Z1 / gh], [X0 / gw, Z1 / gh]], [0, 1, 0]);
    }
    const B = 6000;
    if (useWater) { // 물 칸마다 물낯. 꼭짓점마다 얕음(둘레 네 칸 중 얕은 물·땅 비율)·물가(둘레에 땅이 있으면 1)
      const shallowAt = (x, y) => map[y]?.[x] !== undefined && (map[y][x] !== 0 || map.shallow?.has(`${x},${y}`)), landAt = (x, y) => !isWater(x, y);
      const K = (cx, cy) => { const t = [[cx - 1, cy - 1], [cx, cy - 1], [cx - 1, cy], [cx, cy]]; return [t.filter(([a, b]) => shallowAt(a, b)).length / 4, t.some(([a, b]) => landAt(a, b)) ? 1 : 0]; };
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (!isWater(x, y)) continue; const X0 = x * T, X1 = X0 + T, Z0 = y * T, Z1 = Z0 + T;
        wet.quad([[X0, SURF, Z0], [X1, SURF, Z0], [X1, SURF, Z1], [X0, SURF, Z1]], [K(x, y), K(x + 1, y), K(x + 1, y + 1), K(x, y + 1)], [0, 1, 0]);
      }
      for (const [x0, z0, x1, z1] of [[-B, -B, gw + B, 0], [-B, gh, gw + B, gh + B], [-B, 0, 0, gh], [gw, 0, gw + B, gh]]) wet.quad([[x0, SURF, z0], [x1, SURF, z0], [x1, SURF, z1], [x0, SURF, z1]], [[0, 0], [0, 0], [0, 0], [0, 0]], [0, 1, 0]);
    } else sea.quad([[-B, WATER - 1, -B], [gw + B, WATER - 1, -B], [gw + B, WATER - 1, gh + B], [-B, WATER - 1, gh + B]], [[0, 0], [1, 0], [1, 1], [0, 1]], [0, 1, 0]);
    const groups = new Map(), add = (tex, f) => { if (!groups.has(tex)) groups.set(tex, new Batch()); f(groups.get(tex)); };
    const img = assetImage(V2_TERRAIN.key), ctex = img ? cliffTextures(img) : null, stex = shoreTextures();
    const wall = (b, x0, y0, x1, y1, z0, z1, n, v0 = 0, v1 = 1) => b.quad([[x0, z0, y0], [x1, z0, y1], [x1, z1, y1], [x0, z1, y0]], [[0, v1], [1, v1], [1, v0], [0, v0]], [n[0], 0, n[1]]);
    // 에셋팩 바위: 세계 좌표로 이어 붙여요(64픽셀 그림 = 지도 64픽셀)
    const rockWall = (b, x0, y0, x1, y1, z0, z1, n) => { const u0 = (x0 + y0) / FS, u1 = (x1 + y1) / FS; b.quad([[x0, z0, y0], [x1, z0, y1], [x1, z1, y1], [x0, z1, y0]], [[u0, -z0 / FS], [u1, -z0 / FS], [u1, -z1 / FS], [u0, -z1 / FS]], [n[0], 0, n[1]]); };
    const rockOr = (tex, f) => faceImg && tex !== ctex?.ladder ? add(faceImg, b => f(b, true)) : add(tex, b => f(b, false));
    if (ctex) for (const w of cliffWalls(map)) {
      rockOr(w.ladder ? ctex.ladder : w.top === false ? ctex.rock : ctex.plain, (b, r) => (r ? rockWall : wall)(b, w.x0, w.y0, w.x1, w.y1, w.lift0, w.lift0 + LEVEL_H, w.n));
      if (w.top) { const tx = Math.floor((w.x0 + w.x1) / 2 / T + w.n[0] * .5), ty = Math.floor((w.y0 + w.y1) / 2 / T + w.n[1] * .5), fl = Math.max(0, lv(map, tx, ty)); casters.push([w.x0, w.y0, w.x1, w.y1, w.n[0], w.n[1], w.lift0 + LEVEL_H - fl, fl]); }
    }
    for (const w of shoreWalls(map)) if (!pier || !pier.has(`${Math.floor((w.x0 + w.x1) / 2 / T - w.n[0] * .5)},${Math.floor((w.y0 + w.y1) / 2 / T - w.n[1] * .5)}`)) add(w.sand ? stex.sand : stex.soil, b => wall(b, w.x0, w.y0, w.x1, w.y1, WATER, 0, w.n, 0, .12));
    if (ctex) for (let i = 0; i < W; i++) for (const [y, n] of [[0, [0, -1]], [H - 1, [0, 1]]]) { const h = lv(map, i, y); if (h <= 0) continue; const z = n[1] < 0 ? 0 : gh; for (let s = 0; s < h; s += LEVEL_H) rockOr(ctex.rock, (b, r) => (r ? rockWall : wall)(b, i * T, z, (i + 1) * T, z, s, Math.min(h, s + LEVEL_H), n)); }
    if (ctex) for (let j = 0; j < H; j++) for (const [x, n] of [[0, [-1, 0]], [W - 1, [1, 0]]]) { const h = lv(map, x, j); if (h <= 0) continue; const X = n[0] < 0 ? 0 : gw; for (let s = 0; s < h; s += LEVEL_H) rockOr(ctex.rock, (b, r) => (r ? rockWall : wall)(b, X, j * T, X, (j + 1) * T, s, Math.min(h, s + LEVEL_H), n)); }
    if (map.kind === 'room') for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { // 건물 안 벽: 낮은 이웃 쪽으로 세운 면(그 칸의 땅 그림을 그대로 붙여요)
      const h = lv(map, x, y); if (h <= 0) continue; const u0 = x * T / gw, u1 = (x + 1) * T / gw, v0 = y * T / gh, v1 = (y + 1) * T / gh;
      for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) { const lo = lv(map, x + dx, y + dy); if (lo >= h) continue;
        const ex = dx > 0 ? (x + 1) * T : x * T, ez = dy > 0 ? (y + 1) * T : y * T;
        const [a0, b0, a1, b1] = dy !== 0 ? [x * T, ez, (x + 1) * T, ez] : [ex, y * T, ex, (y + 1) * T];
        if (interImg) { // 실내 벽: 북쪽 벽 앞면은 창문(창문 자리)·게시판·민무늬, 나머지는 민무늬. 낮은 벽은 아랫부분만
          const front = dy > 0 && map[y + 1]?.[x] !== TC.WALL && lo === 0; // 방 안을 보는 북쪽 벽 앞면만 창문·게시판
          const win = front && map.decor.some(d => d.kind === 'window' && d.x === x && d.y === y), part = win ? 'wall_window' : front && h >= ROOM_WALL && x % 5 === 2 ? 'wall_board' : 'wall_plain';
          const [p0, q0, p1, q1] = iuv(IR[`${ikind}_${part}`], 0, Math.max(0, 48 - (h - lo)), 32, 48);
          const [s0, s1] = dx < 0 || dy > 0 ? [p0, p1] : [p1, p0];
          inter.quad([[a0, lo, b0], [a1, lo, b1], [a1, h, b1], [a0, h, b0]], [[s0, q1], [s1, q1], [s1, q0], [s0, q0]], [dx, 0, dy]);
        } else add(ground, b => b.quad([[a0, lo, b0], [a1, lo, b1], [a1, h, b1], [a0, h, b0]], [[u0, v1], [u1, v1], [u1, v0], [u0, v0]], [dx, 0, dy])); }
    }
    // ── GLB 모델 놓기 ──
    const mv = [], hideStatic = new Set(), hideLandmarks = new Set(), lmk = {}, rockSpots = []; // rockSpots: v0.97 바위 무더기 위 HD 바위 그림 자리 // lmk: 지명 → GLB 가운데·높이(1인칭으로 바라볼 곳)
    const put = (id, o2) => { // o2: { x, z, h(바닥 높이), yaw, sx, sy, sz } — 모델 원점(바닥 가운데)을 (x, h, z)에
      const m = glbModel(id); if (!m) return null; const { x, z, h = 0, yaw = 0, sx = 1, sy = sx, sz = sx } = o2, cs = Math.cos(yaw), sn = Math.sin(yaw);
      for (let i = 0; i < m.n; i++) {
        const px = m.pos[i * 3] * sx, py = m.pos[i * 3 + 1] * sy, pz = m.pos[i * 3 + 2] * sz;
        let nx = m.nrm[i * 3] / 127 / sx, ny = m.nrm[i * 3 + 1] / 127 / sy, nz = m.nrm[i * 3 + 2] / 127 / sz; const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
        mv.push(x + px * cs + pz * sn, h + py, z - px * sn + pz * cs, nx * cs + nz * sn, ny, -nx * sn + nz * cs, m.col[i * 4] / 255, m.col[i * 4 + 1] / 255, m.col[i * 4 + 2] / 255, m.col[i * 4 + 3]);
      }
      return m;
    };
    const glbSkip = []; // v0.84 칸에 꼭 맞춘 GLB(천장굴 둘레·바위 지명) 자리: 바위 턱을 얹지 않아요
    const boxShadow = (x0, z0, x1, z1, hh, fl) => { for (const [ax, az, bx2, bz, nx, nz] of [[x0, z0, x1, z0, 0, -1], [x1, z1, x0, z1, 0, 1], [x0, z1, x0, z0, -1, 0], [x1, z0, x1, z1, 1, 0]]) casters.push([ax, az, bx2, bz, nx, nz, hh, fl]); };
    if (o.hd2d) {
      // 바위 지명: 지도의 바위 무더기(또는 큰 바위 칸)에 맞춰 크기를 정해요. 말 걸기 자리는 지명 칸 그대로
      const LANDMARK = { '숫돌바위': 'sutdol', '독립문바위': 'independence', '촛대바위': 'candle', '코끼리바위': 'elephant', '삼형제굴바위': 'three_caves', '지네바위': 'bochal' }; // 지네바위: 일반 갯바위 모양(사진 확인 안 함)
      const regions = rockRegions(map);
      const placeRock = (id, R, fallback) => {
        const m = glbModel(id); if (!m) return false; const w = m.max[0] - m.min[0], d = m.max[2] - m.min[2];
        let box = R || fallback; if (box.x1 - box.x0 < 3) { const c = (box.x0 + box.x1) / 2; box = { ...box, x0: Math.round(c - 1.5), x1: Math.round(c + 1.5) }; } // 너무 작은 바위 칸엔 4칸 너비로
        if (box.y1 - box.y0 < 2) box = { ...box, y0: box.y1 - 2 };
        const bw = (box.x1 - box.x0 + 1) * T, bd = (box.y1 - box.y0 + 1) * T, k = Math.min(bw * 1.05 / w, bd * 1.25 / d, 30);
        const cx = (box.x0 + box.x1 + 1) / 2 * T - (m.min[0] + m.max[0]) / 2 * k, cz = (box.y0 + box.y1 + 1) / 2 * T - (m.min[2] + m.max[2]) / 2 * k, fl = Math.max(WATER, lv(map, Math.floor(cx / T), Math.floor(cz / T)));
        put(id, { x: cx, z: cz, h: fl - 2, sx: k });
        boxShadow(cx + m.min[0] * k, cz + m.min[2] * k, cx + m.max[0] * k, cz + m.max[2] * k, (m.max[1] - m.min[1]) * k * .45, Math.max(0, fl));
        if (R?.crag) hideStatic.add(R.crag); return { x: cx, z: cz, h: fl, top: (m.max[1] - m.min[1]) * k };
      };
      for (const ob of map.parsed?.objects || []) {
        const id = ob.type === 'landmark' && LANDMARK[ob.name]; if (!id) continue;
        let best = null, bd2 = 1e9; for (const R of regions) { const dx = Math.max(R.x0 - ob.x, 0, ob.x - R.x1), dy = Math.max(R.y0 - ob.y, 0, ob.y - R.y1), dd = dx * dx + dy * dy; if (dd < bd2 && dd <= 36) { bd2 = dd; best = R; } }
        if (ob.rock) best = { x0: ob.rock[0], y0: ob.rock[1], x1: ob.rock[2], y1: ob.rock[3] }; // v0.86 지명 고증 자리
        const at = placeRock(id, best, seaSpot(map, ob) || { x0: ob.x - 1, x1: ob.x + 1, y0: ob.y - 2, y1: ob.y }); if (at) { hideLandmarks.add(ob.name); lmk[ob.name] = at; } // 바위 무더기가 없으면 가까운 바다(바다의 바위라서)
      }
      if (map.id === 'town3' && regions.length) lmk['탕건봉'] = placeRock('tanggeon', regions.slice().sort((a, b) => b.n - a.n)[0]) || undefined; // 탕건봉: 가장 큰 바위 무더기
      // v0.82 바위 지명·천장굴 둘레·동도 선착장: 팩이 정한 자리(칸 경계 기준 실수 좌표)에 1단위 = 1칸으로
      const ANCHORED = { bochal: '보찰바위', sangjanggun: null, hanbando: '한반도바위', cheonjanggul: null, dongdo_pier: null };
      for (const [id, name] of Object.entries(ANCHORED)) {
        const m = glbModel(id), meta = m && GLB_META(id); if (!m || meta.map !== map.id) continue; const fix = name && (map.parsed?.objects || []).find(o => o.name === name && o.rock), [ax, az] = fix ? [(fix.rock[0] + fix.rock[2] + 1) / 2, (fix.rock[1] + fix.rock[3] + 1) / 2] : meta.anchor, tx = Math.floor(ax), ty = Math.floor(az);
        const fl = id === 'dongdo_pier' ? 0 : Math.max(WATER, lv(map, tx, ty)) - (map[ty]?.[tx] === 0 ? 2 : 0);
        put(id, { x: ax * T, z: az * T, h: fl, sx: T });
        glbSkip.push([Math.floor(ax + m.min[0]), Math.floor(az + m.min[2]), Math.ceil(ax + m.max[0]) - 1, Math.ceil(az + m.max[2]) - 1]);
        if (id !== 'dongdo_pier') boxShadow((ax + m.min[0]) * T, (az + m.min[2]) * T, (ax + m.max[0]) * T, (az + m.max[2]) * T, (m.max[1] - m.min[1]) * T * .45, Math.max(0, fl));
        if (name) hideLandmarks.add(name);
        const ln = name || (id === 'cheonjanggul' ? '천장굴' : null); if (ln) lmk[ln] = { x: (ax + (m.min[0] + m.max[0]) / 2) * T, z: (az + (m.min[2] + m.max[2]) / 2) * T, h: Math.max(0, fl), top: (m.max[1] - m.min[1]) * T };
      }
      // 난간: 같은 줄로 이어진 난간 칸을 한 모델로(7기둥 난간을 길이에 맞게 늘려요)
      const rv = new Set(map.decor.filter(d => d.kind === 'railv').map(d => `${d.x},${d.y}`));
      const inPier = d => pier && d.x <= 20 && d.y >= 15 && d.y <= 28; // 선착장 모델에 난간이 있어요
      for (const d of map.decor) {
        if ((d.kind === 'rail' || d.kind === 'railv') && inPier(d)) continue;
        if (d.kind === 'rail') { const len = d.len || 2, g0 = groundAt(map, (d.x + len / 2) * T, d.y * T + 8); put('railing', { x: (d.x + len / 2) * T, z: d.y * T + 6, h: g0, sx: len * T / 6.08, sy: 22, sz: 30 }); }
        if (d.kind === 'railv' && !rv.has(`${d.x},${d.y - 1}`)) { let n = 1; while (rv.has(`${d.x},${d.y + n}`)) n++; const g0 = groundAt(map, d.x * T + 16, (d.y + n / 2) * T); put('railing', { x: d.x * T + 16, z: (d.y + n / 2) * T, h: g0, yaw: Math.PI / 2, sx: n * T / 6.08, sy: 22, sz: 30 }); }
        if (d.kind === 'tetrapods') { const hsh = ((Math.imul(d.x, 73856093) ^ Math.imul(d.y, 19349663)) >>> 0) % 1000 / 1000; const k = 16 + hsh * 4; put('tetrapod', { x: d.x * T + 16, z: d.y * T + 18, h: SURF + .3 * k, yaw: hsh * 6.283, sx: k }); } // 아래 다리가 물에 살짝 잠기게
      }
      for (const k of ['rail', 'railv', 'tetrapods']) hideStatic.add(k);
      // 헬기장
      for (const g of map.ground || []) if (g.kind === 'helipad') put('helipad', { x: g.x * T + 48, z: g.y * T + 48, h: lv(map, g.x + 1, g.y + 1) + .3, sx: 96 / 5, sy: 6 });
    }
    // 계단: 절벽 계단 칸 · 건물 안 오르는 계단(U) — 높은 쪽으로 올라가게 돌려 놓아요
    for (const k of map.cliff?.stairs || []) {
      const [x, y] = k.split(',').map(Number), c = cornerHeights(map, x, y), N = c.nw + c.ne, S = c.sw + c.se, Wv = c.nw + c.sw, E = c.ne + c.se, hi = Math.max(c.nw, c.ne, c.sw, c.se), lo = Math.min(c.nw, c.ne, c.sw, c.se); if (hi - lo < 2) continue;
      const yaw = N - S >= Math.abs(Wv - E) ? 0 : S - N >= Math.abs(Wv - E) ? Math.PI : Wv > E ? Math.PI / 2 : -Math.PI / 2, sz = 32 / 4.51, off = 2.025 * sz; // 모델 원점은 낮은 쪽 끝 → 칸 가운데로 옮겨요
      put('stairs', { x: x * T + 16 + off * Math.sin(yaw), z: y * T + 16 + off * Math.cos(yaw), h: lo, yaw, sx: 32 / 1.62, sy: (hi - lo) / 3.03, sz });
    }
    if (map.kind === 'room') for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (map[y][x] === TC.UP) put('stairs', { x: x * T + 16, z: y * T + 30, h: 0, sx: 30 / 1.62, sy: 40 / 3.03, sz: 30 / 4.51 });
    // v0.84 못 지나가는 칸을 눈에 보이게: 바위 칸(맨바위 산·갯바위)은 울퉁불퉁한 바위 덩어리, 절벽 끝 턱(막힌 가장자리)은 낮은 바위 턱.
    //   예전에는 HD-2D 땅 재질이 풀·눈으로만 그려서, 아무것도 없어 보이는데 막히는 칸이 있었어요(2D 그림에는 턱 선이 있었어요).
    if (rockImg && map.kind !== 'room') { // (바닷속에서도 바위섬은 바위로)
      const cl = map.cliff, hsh = (x, y, s) => { const v = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453; return v - Math.floor(v); };
      const under = new Set(); for (const bd of [...map.buildings, ...(map.structures || [])]) for (let i = 0; i < bd.w; i++) for (let j = 0; j < bd.h; j++) under.add(`${bd.x + i},${bd.y + j}`);
      for (const d of map.decor) under.add(`${d.x},${d.y}`);
      const skip = (x, y) => glbSkip.some(([a, b, c2, d2]) => x >= a && x <= c2 && y >= b && y <= d2);
      const rockD = new Map(); { const q = []; for (const k of map.rockTiles || []) { const [x, y] = k.split(',').map(Number); if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => !map.rockTiles.has(`${x + a},${y + b}`))) { rockD.set(k, 0); q.push([x, y]); } }
        for (let i = 0; i < q.length; i++) { const [x, y] = q[i], d = rockD.get(`${x},${y}`); for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nk = `${x + a},${y + b}`; if (map.rockTiles.has(nk) && !rockD.has(nk)) { rockD.set(nk, d + 1); q.push([x + a, y + b]); } } } }
      const rockDepth = (map, x, y) => Math.min(4, rockD.get(`${x},${y}`) || 0); // 바위 무더기 가장자리에서 몇 칸 안쪽인지
      const capH = new Map(), rims = [];
      for (const k of map.solid) { const [x, y] = k.split(',').map(Number); if (map[y]?.[x] === undefined || (map[y][x] === 0 && !map.rockTiles?.has(k)) || under.has(k) || skip(x, y) || pier?.has(k)) continue;
        if (map.rockTiles?.has(k)) capH.set(k, map[y][x] === 0 ? 16 + rockDepth(map, x, y) * 6 + Math.round(hsh(x, y, 1) * 3) : 7 + rockDepth(map, x, y) * 3 + Math.round(hsh(x, y, 1) * 2)); // v0.97 바위 덩어리: 가장자리는 낮고 가운데로 갈수록 높게(제멋대로 들쭉날쭉한 계단 모양 대신 둥근 무더기) · 바다의 바위섬은 물 위로 16px부터
        else if (cl?.rim.has(k) && !cl.face.has(k) && !cl.stairs.has(k)) rims.push([x, y, cl.rim.get(k)]); } // 절벽 끝 칸: 낮은 돌담(아래)
      const capTop = (x, y) => { const h = capH.get(`${x},${y}`); if (h === undefined) return null; const c = cornerHeights(map, x, y); return Math.max(c.nw, c.ne, c.sw, c.se) + h; };
      for (const [k, h] of capH) { const [x, y] = k.split(',').map(Number), top = capTop(x, y), c = cornerHeights(map, x, y), X0 = x * T, X1 = X0 + T, Z0 = y * T, Z1 = Z0 + T;
        add(topImg, b => b.quad([[X0, top, Z0], [X1, top, Z0], [X1, top, Z1], [X0, top, Z1]], [[X0 / TS, Z0 / TS], [X1 / TS, Z0 / TS], [X1 / TS, Z1 / TS], [X0 / TS, Z1 / TS]], [0, 1, 0]));
        add(faceImg, b => {
          for (const [dx, dy, a, bb, n, lo0, lo1] of [[0, 1, [X1, Z1], [X0, Z1], [0, 1], c.se, c.sw], [0, -1, [X0, Z0], [X1, Z0], [0, -1], c.nw, c.ne], [-1, 0, [X0, Z1], [X0, Z0], [-1, 0], c.sw, c.nw], [1, 0, [X1, Z0], [X1, Z1], [1, 0], c.ne, c.se]]) {
            const nt = capTop(x + dx, y + dy); if (nt !== null && nt >= top) continue; const f0 = Math.max(lo0, nt ?? -1e9), f1 = Math.max(lo1, nt ?? -1e9); if (f0 >= top && f1 >= top) continue;
            const u0 = (a[0] + a[1]) / FS, u1 = (bb[0] + bb[1]) / FS; b.quad([[a[0], f0, a[1]], [bb[0], f1, bb[1]], [bb[0], top, bb[1]], [a[0], top, a[1]]], [[u0, -f0 / FS], [u1, -f1 / FS], [u1, -top / FS], [u0, -top / FS]], [n[0], 0, n[1]]); } });
        if (h >= 7) casters.push([X0, Z1, X1, Z1, 0, 1, h, top - h]); }
      // v0.84 고침: 절벽 끝 칸(막힌 가장자리)은 칸 전체 바위 덩어리 대신, 걸을 수 있는 높은 쪽 가장자리를 따라 낮은 돌담(폭 9 · 높이 8px).
      //   계단 칸에서는 돌담이 끊겨서 내려가는 곳이 보여요(칸 전체를 덮으면 비탈 위에 바위 기둥이 솟아 계단 둘레가 이상했어요)
      for (const [x, y, sides] of rims) { const base = lv(map, x, y), X0 = x * T, X1 = X0 + T, Z0 = y * T, Z1 = Z0 + T, lo = base - 2, hi = base + 8, Wd = 9;
        const boxes = []; if (sides.includes('n')) boxes.push([X0, Z1 - Wd, X1, Z1 - 1]); if (sides.includes('e')) boxes.push([X0 + 1, Z0, X0 + Wd, Z1]); if (sides.includes('w')) boxes.push([X1 - Wd, Z0, X1 - 1, Z1]);
        for (const [a0, b0, a1, b1] of boxes) { add(topImg, b => b.quad([[a0, hi, b0], [a1, hi, b0], [a1, hi, b1], [a0, hi, b1]], [[a0 / TS, b0 / TS], [a1 / TS, b0 / TS], [a1 / TS, b1 / TS], [a0 / TS, b1 / TS]], [0, 1, 0]));
          add(faceImg, b => { for (const [p0, p1, n] of [[[a1, b1], [a0, b1], [0, 1]], [[a0, b0], [a1, b0], [0, -1]], [[a0, b1], [a0, b0], [-1, 0]], [[a1, b0], [a1, b1], [1, 0]]]) { const u0 = (p0[0] + p0[1]) / FS, u1 = (p1[0] + p1[1]) / FS; b.quad([[p0[0], lo, p0[1]], [p1[0], lo, p1[1]], [p1[0], hi, p1[1]], [p0[0], hi, p0[1]]], [[u0, -lo / FS], [u1, -lo / FS], [u1, -hi / FS], [u0, -hi / FS]], [n[0], 0, n[1]]); } }); } }
      for (const d of map.decor) if (d.kind === 'crag') { let hit = false; for (let i = 0; i < d.w && !hit; i++) for (let j = 0; j < d.h && !hit; j++) hit = capH.has(`${d.x + i},${d.y - j}`); if (hit) hideStatic.add(`crag|${d.x},${d.y}`); } // 바위 덩어리로 그린 곳의 예전 바위 그림은 빼요
      scene_caps = capH.size + rims.length;
      // v0.97 바위 무더기(바위섬·바위 지대): 계단 모양 덩어리 위에 HD-2D 팩 바위 그림을 세 칸·두 줄마다 세워 둥근 바위 모양이 보이게
      for (const [k] of capH) { if (!map.rockTiles?.has(k)) continue; const [x, y] = k.split(',').map(Number), sea = map[y][x] === 0, j = Math.floor(hsh(x, y, 5) * 3);
        if ((x + j) % 3 !== 0 || y % 2 !== (j % 2)) continue; const c = cornerHeights(map, x, y);
        const key = map.def?.island === '울릉도' ? ['hn_rocks_a', 'hn_rocks_b'][j % 2] : sea ? ['dd_wave_rock', 'dd_rock_flat', 'dd_small_rocks'][j] : ['dd_small_rocks', 'dd_rock_flat', 'dd_shore_rock'][j];
        rockSpots.push([key, x * T + 16 + (hsh(x, y, 6) - .5) * 10, (y + 1) * T - 4, Math.max(c.nw, c.ne, c.sw, c.se) + (sea ? 0 : 2)]); }
    }
    const roofs = new Set(), cards = [], lamps = [], F = HD2D_ATLAS.frames;
    const pushCard = (key, fx, fz, h) => { const f = cardFrame(key); if (f) cards.push({ key, f, x: fx, z: fz, h, story: key.startsWith('story_') }); return f; };
    if (atlasImg) for (const [key, x, z, h] of rockSpots) pushCard(key, x, z, h);
    const uwImg = map.diving ? assetImage(UW_ATLAS.key) : null; if (map.diving && !uwImg) missing++;
    if (uwImg) for (const it of seabedLayout(map).items) { const f = UW_ATLAS.frames[it.id]; if (f) cards.push({ key: it.id, f, x: (it.x + (it.w || 1) / 2) * T + (it.big || it.edge ? 0 : (((it.x * 7 + it.y * 3) % 9) - 4)), z: it.y * T + (it.edge ? 6 : it.big ? 30 : 24), h: lv(map, it.x, it.y), uw: true }); } // v0.87 바닷속 판
    if (o.hd2d && !map.diving) for (const ob of map.parsed?.objects || []) { // v0.88 실제 시설의 관찰용 외관(「지상·수중 v2」): 지명 자리 칸 위에 그림 판 하나 · 들어가는 문 없음
      const f = ob.region && REGION_ATLAS.frames[ob.region]; if (!f) continue; if (!assetImage(REGION_ATLAS.key)) { missing++; continue; }
      const r = ob.rock || [ob.x - 1, ob.y - 1, ob.x + 1, ob.y], cx = (r[0] + r[2] + 1) / 2 * T, cz = (r[3] + 1) * T - 2, L = ob.onTop ? Math.max(...[...Array(r[2] - r[0] + 1).keys()].map(i => lv(map, r[0] + i, r[3]))) : lv(map, ob.x, ob.y); /* v0.96 onTop: 산·언덕 위 명소는 상자 앞줄 높이에 세워요 */
      if (ob.onTop) for (let y = r[1] - 2; y <= r[3]; y++) for (let x = r[0] - 1; x <= r[2] + 1; x++) hideStatic.add(`tree|${x},${y}`); /* v0.96 숲 위 명소: 상자와 둘레 나무를 비워 그림이 가리지 않게 */
      cards.push({ key: ob.region, f, x: cx, z: cz, h: L, rg: true }); hideLandmarks.add(ob.name); lmk[ob.name] = { x: cx, z: (r[1] + r[3] + 1) / 2 * T, h: L, top: f[3] * .8 };
      boxShadow(r[0] * T, r[1] * T, (r[2] + 1) * T, (r[3] + 1) * T, f[3] * .35, Math.max(0, L)); }
    for (const bd of [...map.buildings, ...(map.structures || [])]) {
      let ck = atlasImg ? hd2dCard(map, bd) : null; if (ck?.startsWith('story_') && !storyImg) ck = STORY_CARDS[buildingArt(map, bd)] || null; // 이야기 건물 그림이 아직이면 예전 그림
      if (ck) { // 그림 판: 아랫변 = 건물 앞줄. 그림자는 건물 칸 둘레를 그림 높이의 40%로
        const L = lv(map, bd.x + Math.floor(bd.w / 2), bd.y + bd.h - 1), x0 = bd.x * T, x1 = (bd.x + bd.w) * T, yF = (bd.y + bd.h) * T - 2, yB = bd.y * T + 6;
        const f = pushCard(ck, (x0 + x1) / 2 + (CARD_DOOR_DX[ck] || 0), yF, L), h = f[3] * .4; // 그림자는 낮게(그림 판 모양과 달라 보이지 않게)
        for (const [ax, az, bx2, bz, nx, nz] of [[x0, yB, x1, yB, 0, -1], [x1, yF, x0, yF, 0, 1], [x0, yF, x0, yB, -1, 0], [x1, yB, x1, yF, 1, 0]]) casters.push([ax, az, bx2, bz, nx, nz, h, L]);
        continue;
      }
      const kit = buildingKit(buildingArt(map, bd), bd); if (!kit) { missing++; continue; }
      const bx = buildingBox(bd, kit), L = lv(map, bd.x + Math.floor(bd.w / 2), bd.y + bd.h - 1), Tx = kit.tex;
      const { x0, x1, yF, yB, yM, h, top: tp } = bx, H0 = L, Hh = L + h, Ht = L + tp, rH = kit.rise / Tx.west.height;
      add(Tx.front, b => b.quad([[x0, H0, yF], [x1, H0, yF], [x1, Hh, yF], [x0, Hh, yF]], [[0, 1], [1, 1], [1, 0], [0, 0]], [0, 0, 1]));
      add(Tx.back, b => b.quad([[x1, H0, yB], [x0, H0, yB], [x0, Hh, yB], [x1, Hh, yB]], [[0, 1], [1, 1], [1, 0], [0, 0]], [0, 0, -1]));
      add(Tx.west, b => b.poly([[x0, H0, yB], [x0, H0, yF], [x0, Hh, yF], [x0, Ht, yM], [x0, Hh, yB]], [[0, 1], [1, 1], [1, rH], [.5, 0], [0, rH]], [-1, 0, 0]));
      add(Tx.east, b => b.poly([[x1, H0, yF], [x1, H0, yB], [x1, Hh, yB], [x1, Ht, yM], [x1, Hh, yF]], [[0, 1], [1, 1], [1, rH], [.5, 0], [0, rH]], [1, 0, 0]));
      add(Tx.roofFront, b => b.quad([[x0, Hh, yF], [x1, Hh, yF], [x1, Ht, yM], [x0, Ht, yM]], [[0, 1], [1, 1], [1, 0], [0, 0]], [0, .8, .6])); roofs.add(Tx.roofFront);
      add(Tx.roofBack, b => b.quad([[x1, Hh, yB], [x0, Hh, yB], [x0, Ht, yM], [x1, Ht, yM]], [[0, 1], [1, 1], [1, 0], [0, 0]], [0, .8, -.6])); roofs.add(Tx.roofBack);
      for (const [ax, az, bx2, bz, nx, nz] of [[x0, yB, x1, yB, 0, -1], [x1, yF, x0, yF, 0, 1], [x0, yF, x0, yB, -1, 0], [x1, yB, x1, yF, 1, 0]]) casters.push([ax, az, bx2, bz, nx, nz, h, L]);
    }
    if (atlasImg) for (const d of map.decor) { // 여객선은 옆모습 판(배 가운데 줄에), 물가 난간 네 칸마다 가로등
      if (d.kind === 'ferry' && !map.diving) pushCard('ul_ferry', d.x * T + 16, d.y * T + 150, SURF);
      if ((d.kind === 'railv' || d.kind === 'rail') && (d.kind === 'rail' ? d.x : d.y) % 4 === 0) { const fz = d.y * T + 22, h = groundAt(map, d.x * T + 16, fz), f = pushCard(d.y % 8 ? 'ul_lamp_a' : 'ul_lamp_b', d.x * T + 16, fz, h); lamps.push([d.x * T + 16 + (f[2] > 40 ? 0 : 6), h + f[3] - 8, fz]); }
    }
    const mats = new Batch(), matCv = map.kind === 'town' ? doorMatCanvas() : null; // v0.84 문 앞 발판
    if (matCv) for (const bd of [...map.buildings, ...(map.structures || [])]) { const c = doorColumns(bd), cx = ((c[0] + c[c.length - 1]) / 2) * T + 16, fy = bd.y + bd.h, z0 = fy * T + 1, z1 = z0 + DOOR_MAT.h, hh = lv(map, c[0], fy) + .6, x0 = cx - DOOR_MAT.w / 2, x1 = cx + DOOR_MAT.w / 2;
      mats.quad([[x0, hh, z0], [x1, hh, z0], [x1, hh, z1], [x0, hh, z1]], [[0, 0], [1, 0], [1, 1], [0, 1]], [0, 1, 0]); }
    const mat = materialMap(map); if (!mat) missing++;
    const meshes = [{ tex: ground, buf: upload(top.v), n: top.v.length / 8, ground: true, mat }];
    if (sea.v.length) meshes.push({ color: true, buf: upload(sea.v), n: sea.v.length / 8, ground: true });
    for (const [tex, b] of groups) meshes.push({ tex, buf: upload(b.v), n: b.v.length / 8, ao: !roofs.has(tex) && tex !== ground, wrap: tex === rockImg || tex === faceImg || tex === topImg });
    if (interFloor.v.length) meshes.push({ tex: interImg, buf: upload(interFloor.v), n: interFloor.v.length / 8, ground: true }); // 건물 안 바닥·벽 윗면(실내 재질)
    if (inter.v.length) meshes.push({ tex: interImg, buf: upload(inter.v), n: inter.v.length / 8 }); // 건물 안 벽(실내 재질)
    if (mats.v.length) meshes.push({ tex: matCv, buf: upload(mats.v), n: mats.v.length / 8, ground: true });
    if (rimTop.v.length) meshes.push({ tex: topImg, buf: upload(rimTop.v), n: rimTop.v.length / 8, ground: true, wrap: true }); // 절벽 끝 비탈(바위)
    return { id: map.id, tag: assetTintTag(), hd2d: !!atlasImg, meshes, missing, gw, gh, statics: null, casters, shade: null, sunKey: '', water: useWater ? { buf: upload(wet.v), n: wet.v.length / 8 } : null, cards: cardBuffer(cards, map), lamps,
      models: mv.length ? { buf: upload(mv), n: mv.length / 10 } : null, hideStatic, hideLandmarks, interior: !!(interImg && interFloor.v.length), pier: !!pier, doorMats: mats.v.length / 48, rockCaps: scene_caps, landmarks: lmk };
  }
  const GLB_META = id => ({ anchor: GLB_MODELS_META[id]?.anchor, map: GLB_MODELS_META[id]?.map });
  // 지명 칸에서 가까운 바다 자리(3×3이 모두 물) — 바다에 선 바위(촛대바위 등)
  function seaSpot(map, ob) {
    const water = (x, y) => map[y]?.[x] === 0;
    for (let r = 2; r <= 8; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; const x = ob.x + dx, y = ob.y + dy; let ok = true;
      for (let j = -1; j <= 1 && ok; j++) for (let i = -1; i <= 1 && ok; i++) ok = water(x + i, y + j); if (ok) return { x0: x - 1, x1: x + 1, y0: y - 1, y1: y + 1 };
    }
    return null;
  }
  // 바위 무더기(4방향으로 이어진 바위 칸) + 큰 바위(crag) 자리
  function rockRegions(map) {
    const out = [], seen = new Set(), rocks = map.rockTiles || new Set();
    for (const k of rocks) { if (seen.has(k)) continue; const st = [k]; seen.add(k); const R = { x0: 1e9, y0: 1e9, x1: -1, y1: -1, n: 0 };
      while (st.length) { const c = st.pop(), [x, y] = c.split(',').map(Number); R.n++; R.x0 = Math.min(R.x0, x); R.x1 = Math.max(R.x1, x); R.y0 = Math.min(R.y0, y); R.y1 = Math.max(R.y1, y);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const q = `${x + dx},${y + dy}`; if (rocks.has(q) && !seen.has(q)) { seen.add(q); st.push(q); } } }
      if (R.n >= 3) out.push(R); }
    for (const d of map.decor) if (d.kind === 'crag') out.push({ x0: d.x, x1: d.x + d.w - 1, y0: d.y - d.h + 1, y1: d.y, n: d.w * d.h, crag: `crag|${d.x},${d.y}` });
    return out;
  }
  // 칸마다 땅 재질 번호(0 = 예전 땅 그림). 울릉도 마을 길은 돌길, 들길은 흙길, 독도 길은 잔자갈, 독도 물가는 해변 자갈
  function materialMap(map) {
    if (map.kind === 'room' || !assetImage(HD2D_GROUND.key) || !assetImage(HD2D_GROUND.noise)) return null;
    const W = map[0].length, H = map.length, S = HD2D_GROUND.slots, dokdo = map.def?.island !== '울릉도', town = map.kind === 'town';
    const keep = new Set([...map.exits.keys(), ...(map.ground || []).filter(g => g.kind === 'helipad').map(g => `${g.x},${g.y}`)]);
    const peb = new Set((map.ground || []).filter(g => g.kind === 'pebbles').map(g => `${g.x},${g.y}`));
    const stairs = new Set([...(map.cliff?.stairs || []), ...(map.ground || []).filter(g => g.kind === 'steps').map(g => `${g.x},${g.y}`)]);
    const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'), d = g.createImageData(W, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const k = `${x},${y}`, v = map[y][x]; let id = 0;
      if (peb.has(k)) id = S.pebbles; else if (stairs.has(k)) id = S.steps;
      else if (!keep.has(k)) id = v === TC.GRASS ? S.grass : v === TC.TALL ? S.tall : v === TC.PATH ? (dokdo ? S.gravel : town ? S.cobble : S.dirt) : v === TC.SAND ? (dokdo ? S.pebbles : S.sand) : v === TC.DOCK ? S.concrete : v === TC.BUILDING ? (dokdo ? S.gravel : S.cobble) : 0; // 건물 칸 밑(그림 판 옆으로 보이는 자리)도 길과 같게
      d.data[(y * W + x) * 4] = id; d.data[(y * W + x) * 4 + 3] = 255;
    }
    g.putImageData(d, 0, 0); return { canvas: c, W, H };
  }
  // 그림 판 → 세운 판 꼭짓점(발 자리는 그림 아랫변 가운데, 1픽셀 = 지도 1픽셀)
  function cardBuffer(cards, map) { // 그림 모음 두 장(에셋팩 · v0.81 팩 이야기 건물)마다 한 묶음
    const part = story => { const arr = [], A = story === 'rg' ? REGION_ATLAS : story === 'uw' ? UW_ATLAS : story ? STORY_ATLAS : HD2D_ATLAS, AW = A.width, AH = A.height;
      for (const c of cards.filter(c => story === 'rg' ? c.rg : story === 'uw' ? c.uw : !c.uw && !c.rg && !!c.story === story)) { const [fx, fy, w, h] = c.f, u0 = fx / AW, u1 = (fx + w) / AW, v0 = fy / AH, v1 = (fy + h) / AH, L = -w / 2, R = w / 2;
        const q = [[L, -1, u0, v1], [R, -1, u1, v1], [R, h - 1, u1, v0], [L, h - 1, u0, v0]]; for (const i of [0, 1, 2, 0, 2, 3]) arr.push(c.x, c.h, c.z, q[i][0], q[i][1], q[i][2], q[i][3], 0, 0, 0); } // 아랫줄 1px은 테두리라 땅 밑으로
      return { buf: upload(arr), n: arr.length / 10 }; };
    const hd = part(false), st = part(true), uw = part('uw'), region = part('rg');
    return { buf: hd.buf, n: hd.n, story: st, uw, region, count: cards.length, keys: cards.map(c => c.key) };
  }
  // 그림자: 해를 등진 면의 위쪽 모서리를 땅에 눕힌 판(해가 움직이면 이것만 다시)
  function buildShade(casters, sun) {
    const shade = new Batch(), sy = Math.max(.3, sun[1]), sdx = -sun[0] / sy, sdz = -sun[2] / sy;
    for (const [x0, z0, x1, z1, nx, nz, h, fl] of casters) { if (h <= 0 || nx * sun[0] + nz * sun[2] >= 0) continue;
      shade.quad([[x0, fl + .4, z0], [x1, fl + .4, z1], [x1 + sdx * h, fl + .4, z1 + sdz * h], [x0 + sdx * h, fl + .4, z0 + sdz * h]], [[0, 0], [1, 0], [1, 1], [0, 1]], [0, 1, 0]); }
    return { buf: upload(shade.v), n: shade.v.length / 8 };
  }

  // ── 그림 칸(아틀라스) ──
  function atlas(size, h = size) { const c = document.createElement('canvas'); c.width = size; c.height = h; return { c, g: c.getContext('2d'), x: 0, y: 0, row: 0, size, h }; }
  function place(A, w, h) { if (A.x + w > A.size) { A.x = 0; A.y += A.row + 1; A.row = 0; } if (A.y + h > A.h) return null; const r = { x: A.x, y: A.y }; A.x += w + 1; A.row = Math.max(A.row, h); return r; }
  function cellOf(n, map) {
    const fg = FURNITURE.has(n.scenery) && map ? furnitureGroups(map)?.get(`${n.x},${n.y}`)?.draw : null; // v0.88 가구 팩: 여러 칸 가구 한 장이 들어가게 넓혀요
    if (fg) { const { w: pw, h: ph } = pieceSize(fg), w = 2 * (Math.max(fg.w * 32, pw) + 32), h = ph + fg.h * 32 + 48; return { w, h, ax: w / 2, ay: h - 24 }; }
    if (n.scenery === 'crag') return { w: n.w * 32 + 64, h: n.h * 32 + 112, ax: (n.w * 32 + 64) / 2, ay: n.h * 32 + 88 };
    if (n.scenery === 'flower' || n.scenery === 'tuft') return { w: 60, h: 60, ax: 30, ay: 54 };
    if (FURNITURE.has(n.scenery)) { const w = (n.w || 1) * 32 + 64, h = (n.h || 1) * 32 + 112; return { w, h, ax: w / 2, ay: h - 24 }; }
    if (n.scenery === 'fence' || n.scenery === 'rail') return { w: (n.w || 2) * 32 + 8, h: 64, ax: (n.w || 2) * 16 + 4, ay: 56 };
    if (n.kind === 'legend') return { w: 128, h: 160, ax: 64, ay: 136 };
    return { w: 112, h: 144, ax: 56, ay: 124 };
  }
  const footOf = n => ({ x: n.x * T + (n.w ? n.w * 16 : 16), y: n.depth });
  function drawCell(A, n, env) {
    const c = cellOf(n, env.map), r = place(A, c.w, c.h); if (!r) return null; const f = footOf(n);
    A.g.save(); A.g.beginPath(); A.g.rect(r.x, r.y, c.w, c.h); A.g.clip(); A.g.imageSmoothingEnabled = false;
    A.g.translate(r.x + c.ax - f.x, r.y + c.ay - f.y);
    const fl = env.flora && PACK96.flora, fkey = fl && (n.scenery === 'tree' || (n.scenery === 'tuft' && env.map.def?.island !== '울릉도')) ? floraName(env.map, n, env.season) : null, flf = fkey && fl.frames[fkey];
    if (flf) { A.g.drawImage(env.flora, flf[0], flf[1], flf[2], flf[3], Math.round(f.x - flf[2] / 2), f.y - flf[3] + 2, flf[2], flf[3]); A.g.restore(); return { ...c, u0: r.x / A.size, v0: r.y / A.h, u1: (r.x + c.w) / A.size, v1: (r.y + c.h) / A.h }; } /* v0.96 식생(04): 발 = 아랫변 가운데 */
    const rk = n.scenery === 'rock' && env.cards ? rockName(env.map, n) : null, rf = rk && HD2D_ATLAS.frames[rk];
    if (rf) { const w = 46, h = Math.round(rf[3] * w / rf[2]); A.g.imageSmoothingEnabled = true; A.g.drawImage(env.cards, rf[0], rf[1], rf[2], rf[3], Math.round(f.x - w / 2), f.y - h + 3, w, h); A.g.restore(); return { ...c, u0: r.x / A.size, v0: r.y / A.h, u1: (r.x + c.w) / A.size, v1: (r.y + c.h) / A.h }; } /* v0.97 예전 저화질 바위(타일셋 v2 작은 바위) 대신 HD-2D 팩 바위를 캐릭터 키에 맞게 줄여서 */
    const tf = n.scenery === 'tree' && env.trees ? HD2D_TREES.frames[treeName(env.map, n)] : null, fk = n.scenery === 'flower' && env.cards ? flowerName(env.map, n, env.season, !!env.story) : null, ff = fk ? cardFrame(fk) : null, fimg = fk && STORY_ATLAS.frames[fk] ? env.story : env.cards;
    if (tf) A.g.drawImage(env.trees, tf[0], tf[1], tf[2], tf[3], Math.round(f.x - tf[2] / 2), f.y - tf[3] + 3, tf[2], tf[3]); // HD-2D 나무(발 = 줄기 밑동)
    else if (ff && fimg) A.g.drawImage(fimg, ff[0], ff[1], ff[2], ff[3], Math.round(f.x - ff[2] / 2), f.y - ff[3] + 2, ff[2], ff[3]); // 꽃 덤불(에셋팩 · v0.81 팩)
    else if (n.scenery === 'tuft') tuft(A.g, f.x, f.y, n.v, env.season); else paintActor(A.g, n, env);
    A.g.restore();
    return { ...c, u0: r.x / A.size, v0: r.y / A.h, u1: (r.x + c.w) / A.size, v1: (r.y + c.h) / A.h };
  }
  // 풀숲 덤불(HD-2D의 수북한 풀): 계절 색 잎 몇 가닥
  const TUFT = { spring: ['#4f9a3c', '#7cc35a', '#a6dd7a'], summer: ['#2f7a34', '#4c9a3e', '#78bf55'], autumn: ['#8a7a34', '#b89a44', '#d8b65c'], winter: ['#8fa39a', '#c9d6d2', '#eef3f2'] };
  function tuft(g, x, y, v, season) {
    const pal = TUFT[season] || TUFT.summer, n = 5 + v;
    for (let i = 0; i < n; i++) { const bx = x - 9 + ((i * 7 + v * 3) % 18), hgt = 5 + ((i * 5 + v) % 7), lean = (i % 3) - 1; g.fillStyle = pal[i % 3];
      for (let k = 0; k < hgt; k++) g.fillRect(bx + Math.round(lean * k / hgt * 2), y - k, 1, 1); }
    g.fillStyle = pal[0]; g.fillRect(x - 8, y, 16, 1);
  }
  // 나무 종류: 자리마다 정해져요(소나무 2 : 활엽수 3). 독도엔 활엽수(사철나무)만
  // 나무 종류: 자리마다 정해져요. 울릉도는 소나무 2 : 활엽수 2 : 동백 1, 독도엔 활엽수(사철나무)만
  /* v0.96 식생(04) 고르기 — 공공 자료로 섬마다 실제로 자라는지 확인한 것만(docs/v096-식생-검증.md)
     독도: 큰 나무는 자라지 못해요 → 나무 자리는 사철나무(국립생물자원관 독도 생물종 목록 · 천연기념물 독도 사철나무)만.
           풀포기는 개밀·김의털 같은 벼과 풀, 여름에만 노란 꽃 덤불(땅채송화·섬기린초, 독도 해국-땅채송화 군락)을 섞어요.
     울릉도: 솔송·섬잣·너도밤(천연기념물 태하동 군락) · 향나무(천연기념물 통구미 자생지) · 후박(울릉도 분포) · 동백(울릉도 자생).
           동백은 꽃 핀 그림이라 꽃 피는 겨울·봄에만, 너도밤나무는 잎 지는 나무인데 겨울 그림이 잎이 무성해서 겨울엔 후박나무로 바꿔요. */
  const floraName = (map, n, season = 'summer') => { const h = (n.x * 5 + n.y * 3) % 5, v = (n.x * 7 + n.y * 13), win = season === 'winter', sw = win ? 'winter' : 'summer';
    if (map.def?.island !== '울릉도') { if (n.scenery === 'tuft') return season === 'summer' && v % 3 === 0 ? `dd_scrub_summer_${v % 3 + 1}` : `dd_grass_tuft_${sw}_${v % 3 + 1}`; return `dd_sacheol_${sw}_${v % 2 + 1}`; }
    if (n.scenery === 'tuft') return null;
    let kind = h < 2 ? ((n.x * 3 + n.y) % 5 === 0 ? 'ul_hyang' : (n.x + n.y) % 2 ? 'ul_solsong' : 'ul_seomjat') : h < 4 ? ((n.x * 3 + n.y) % 2 ? 'ul_hubak' : 'ul_neodo') : 'ul_camellia';
    if (kind === 'ul_neodo' && win) kind = 'ul_hubak';
    if (kind === 'ul_camellia' && (season === 'summer' || season === 'autumn')) kind = 'ul_hubak';
    return `${kind}_${kind === 'ul_neodo' ? season : sw}_${v % 2 + 1}`; };
  // v0.97 바위 칸: 독도는 갯바위·작은 바위 무더기, 울릉도는 산 바위(모두 HD-2D 팩 그림)
  const rockName = (map, n) => { const h = (n.x * 7 + n.y * 3) % 3; return map.def?.island === '울릉도' ? ['hn_rocks_a', 'hn_rocks_b', 'hn_rocks_a'][h] : ['dd_shore_rock', 'dd_small_rocks', 'hn_rocks_b'][h]; };
  const treeName = (map, n) => { const h = (n.x * 5 + n.y * 3) % 5; return `${map.def?.island !== '울릉도' ? 'broad' : h < 2 ? 'pine' : h < 4 ? 'broad' : 'camellia'}_${(n.x * 7 + n.y * 13) % 3}`; };
  // 꽃 칸: 울릉도 마을은 수국·들꽃, 울릉도 들길은 억새도 · 독도는 해국·섬기린초·땅채송화·바닷가 풀(v0.82, 여름·가을 그림 · 겨울은 가을 그림에 눈 색)
  const flowerName = (map, n, season = 'summer', story = true) => { const h = (n.x * 3 + n.y * 7) % 4, sfx = season === 'autumn' || season === 'winter' ? '_autumn' : '_summer';
    if (map.def?.island === '울릉도') return map.kind === 'town' || !story ? ['fl_hydrangea', 'fl_wild', 'fl_hydrangea', 'fl_wild'][h] : ['fl_eoksae' + sfx, 'fl_wild', 'fl_hydrangea', 'fl_eoksae' + sfx][h];
    return story ? ['fl_haeguk', 'fl_seomgirincho', 'fl_ttangchaesongwha', 'fl_galdae'][h] + sfx : ['fl_wild', 'fl_wild', 'fl_grass', 'fl_wild'][h]; };
  function trimCells(A, list) {
    let d; try { d = A.g.getImageData(0, 0, A.size, A.h).data; } catch { return; }
    for (const c of list) {
      const X0 = Math.round(c.u0 * A.size), Y0 = Math.round(c.v0 * A.h); let x0 = c.w, y0 = c.h, x1 = -1, y1 = -1;
      for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) if (d[((Y0 + y) * A.size + X0 + x) * 4 + 3] > 0) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      if (x1 < 0) { c.empty = true; continue; }
      c.u0 = (X0 + x0) / A.size; c.u1 = (X0 + x1 + 1) / A.size; c.v0 = (Y0 + y0) / A.h; c.v1 = (Y0 + y1 + 1) / A.h;
      c.ax -= x0; c.ay -= y0; c.w = x1 + 1 - x0; c.h = y1 + 1 - y0;
    }
  }
  function pushSprite(arr, map, n, cell, axis = [0, 0], swayW = 0, lift = 0) {
    if (cell.empty) return;
    const f = footOf(n), h = groundAt(map, f.x, f.y) + lift, L = -cell.ax, R = cell.w - cell.ax, D = -(cell.h - cell.ay), U = cell.ay;
    const c = [[L, D, cell.u0, cell.v1], [R, D, cell.u1, cell.v1], [R, U, cell.u1, cell.v0], [L, U, cell.u0, cell.v0]];
    // v0.97 같은 줄에 선 나무·풀 그림 판은 깊이가 똑같아(한 평면) 겹친 곳에서 어느 쪽이 앞인지 매 장면 바뀌며 지지직거렸어요(깊이 다툼).
    //   이웃끼리 다른 만큼(0~6px) 살짝 뒤로 비켜 세워 늘 같은 쪽이 앞에 보이게 해요(눈에 띄지 않는 거리 · 사람보다 앞으로 나오지 않게 뒤로만).
    const zj = axis[0] === 0 && axis[1] === 0 && !n.building ? (((n.x | 0) * 5 + (n.y | 0) * 3) % 7) * 1.0 : 0;
    for (const i of [0, 1, 2, 0, 2, 3]) arr.push(f.x, h, f.y - zj, c[i][0], c[i][1], c[i][2], c[i][3], axis[0], axis[1], swayW);
  }
  const FURNITURE = new Set(['shelf', 'crates', 'plant', 'table', 'sofa', 'desk', 'trophy', 'counter', 'bed']); // 건물 안 가구
  const STATIC = new Set(['tree', 'rock', 'flower', 'tuft', 'crag', 'fence', 'rail', 'railv', 'tetrapods', 'planter', 'monument', 'beacon', 'barrier', ...FURNITURE]);
  function tufts(map) { // 풀밭 칸 몇 곳에 덤불(막힌 칸·길·물가·건물 옆은 빼고)
    const out = [], busy = new Set(map.decor.map(d => `${d.x},${d.y}`));
    for (let y = 1; y < map.length - 1; y++) for (let x = 1; x < map[0].length - 1; x++) {
      if (map[y][x] !== 1 || map.solid.has(`${x},${y}`) || busy.has(`${x},${y}`) || map.keepClear?.has(`${x},${y}`)) continue;
      const h = ((Math.imul(x, 73856093) ^ Math.imul(y, 19349663)) >>> 0) % 100; if (h < 28) out.push({ scenery: 'tuft', x, y, v: h % 3, depth: y * T + 18 + (h % 9) });
    }
    return out;
  }
  function buildStatics(map, env, items, opt = {}) { // 한 번 그려 두고 다시 써요(같은 모양은 칸 하나)
    const A = atlas(2048), keyOf = n => env.flora && (n.scenery === 'tree' || (n.scenery === 'tuft' && map.def?.island !== '울릉도')) ? `flora|${floraName(map, n, env.season)}` : n.scenery === 'tree' ? `tree|${env.trees ? treeName(map, n) : (n.x * 7 + n.y * 13) % 3}` : n.scenery === 'flower' && env.cards ? `flower|${flowerName(map, n, env.season, !!env.story)}` : n.scenery === 'tuft' ? `tuft|${n.v}` : n.scenery === 'rock' && env.cards ? `rock|${rockName(map, n)}` : ['rock', 'tetrapods', 'planter', 'beacon', 'barrier'].includes(n.scenery) ? n.scenery : `${n.scenery}|${n.x},${n.y}|${n.w || ''}`;
    const cells = new Map(), arr = [], flats = [], blobs = new Batch(), todo = [], wallDecor = [];
    for (const n of [...items, ...tufts(map)]) {
      if (n.scenery === 'boat' || n.scenery === 'ferry') { if (map.diving) continue; /* v0.87 바닷속엔 배가 없어요 */ if (!(opt.hd2d && n.scenery === 'ferry')) flats.push(n); continue; } // HD-2D 지도의 여객선은 옆모습 판으로
      if (n.scenery === 'window') { if (!opt.interior) wallDecor.push(n); continue; } // v0.82 실내 재질의 창문 벽이 대신해요
      if (!STATIC.has(n.scenery) || n.building || opt.hide?.has(n.scenery) || opt.hide?.has(`${n.scenery}|${n.x},${n.y}`)) continue; // GLB 모델로 그린 것(난간·소파블록·큰 바위)은 판을 빼요
      const key = keyOf(n); let cell = cells.get(key);
      if (!cell) { cell = drawCell(A, n.scenery === 'railv' ? { ...n, scenery: 'rail', w: 1 } : n, env); if (!cell) continue; cells.set(key, cell); }
      const axis = n.scenery === 'fence' || n.scenery === 'rail' || n.scenery === 'barrier' ? [1, 0] : n.scenery === 'railv' && !opt.hd ? [0, 1] : [0, 0]; // HD-2D(카메라 고정)에선 세로 난간도 카메라를 봐요
      todo.push([n, cell, axis, n.scenery === 'tree' ? 0 : n.scenery === 'flower' || n.scenery === 'tuft' ? .3 : 0]); // v0.97 나무는 바람에 흔들지 않아요: 잎이 촘촘한 새 나무 그림을 매 장면 기울이면 잎 점이 들썩이며 지지직거렸어요(겹친 숲에서 특히). 풀·꽃은 살짝만
      if (n.scenery === 'tree' || n.scenery === 'rock' || n.scenery === 'crag') blob(blobs, map, n, n.scenery === 'tree' ? 24 : 16);
    }
    trimCells(A, cells.values()); // 판을 그림이 있는 자리만큼으로 줄여요(투명한 빈칸을 그리지 않게 → 나무가 빽빽한 숲에서 훨씬 가벼워요)
    for (const [n, cell, axis, sw] of todo) pushSprite(arr, map, n, cell, axis, sw);
    for (const n of wallDecor) { // 건물 안 창문: 북쪽 벽 앞면에 붙여요(벽 칸 그림과 같은 비율로 늘려서)
      const c = drawCell(A, n, env); if (!c) continue; const f = footOf(n), px = n.x * T - f.x + c.ax, py = n.y * T - f.y + c.ay; // 칸 그림의 왼쪽 위(그림 칸 안 자리)
      const u0 = c.u0 + px / A.size, u1 = u0 + T / A.size, v0 = c.v0 + py / A.h, v1 = v0 + T / A.h, z = (n.y + 1) * T + .6;
      const q = [[-16, 0, u0, v1], [16, 0, u1, v1], [16, ROOM_WALL, u1, v0], [-16, ROOM_WALL, u0, v0]];
      for (const i of [0, 1, 2, 0, 2, 3]) arr.push(n.x * T + 16, 0, z, q[i][0], q[i][1], q[i][2], q[i][3], 1, 0, 0);
    }
    const fl = new Batch(), FA = atlas(512);
    for (const n of flats) { // 배: 위에서 본 그림을 물 위에 눕혀요
      const [w, h, dx, dy] = n.scenery === 'ferry' ? [92, 208, -30, -16] : [64, 100, -16, -30], r = place(FA, w, h); if (!r) continue;
      FA.g.save(); FA.g.translate(r.x - (n.x * T + dx), r.y - (n.y * T + dy)); paintActor(FA.g, n, env); FA.g.restore();
      const X0 = n.x * T + dx, Z0 = n.y * T + dy, u0 = r.x / 512, v0 = r.y / 512, u1 = (r.x + w) / 512, v1 = (r.y + h) / 512, Y = (opt.water ? SURF : WATER) + .5;
      fl.quad([[X0, Y, Z0], [X0 + w, Y, Z0], [X0 + w, Y, Z0 + h], [X0, Y, Z0 + h]], [[u0, v0], [u1, v0], [u1, v1], [u0, v1]], [0, 1, 0]);
    }
    return { atlas: A.c, buf: upload(arr), n: arr.length / 10, flat: { tex: FA.c, buf: upload(fl.v), n: fl.v.length / 8 }, blobs: { buf: upload(blobs.v), n: blobs.v.length / 8 } };
  }
  function blob(b, map, n, rx = 15) { const f = footOf(n), h = groundAt(map, f.x, f.y) + .6, rz = rx * .55, y = f.y - 2; b.quad([[f.x - rx, h, y - rz], [f.x + rx, h, y - rz], [f.x + rx, h, y + rz], [f.x - rx, h, y + rz]], [[0, 0], [1, 0], [1, 1], [0, 1]], [0, 1, 0]); }

  // ── 화면 효과용 그림판(프레임버퍼) ──
  const quadBuf = upload([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]);
  const moteBuf = upload(Array.from({ length: 70 }, (_, i) => { const h = k => ((Math.imul(i + 1, 2654435761 + k * 97) >>> 0) % 10000) / 10000; return [(h(1) - .5) * 640, h(2) * 150, (h(3) - .5) * 640, h(4)]; }).flat());
  let fbo = null;
  function target(w, h) {
    if (fbo && fbo.w === w && fbo.h === h) return fbo;
    const mk = (W, H, depth) => { const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
      const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      if (depth) { const rb = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, rb); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, W, H); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rb); }
      const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE; return { tex, fb, W, H, ok }; };
    fbo = { w, h, a: mk(w, h, true), b: mk(Math.max(1, Math.ceil(w / 4)), Math.max(1, Math.ceil(h / 4)), false) }; gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    fbo.ok = fbo.a.ok && fbo.b.ok; return fbo;
  }

  function bindMesh(m) { gl.bindBuffer(gl.ARRAY_BUFFER, m.buf); const S = 32, a = mesh.a;
    gl.enableVertexAttribArray(a.aPos); gl.vertexAttribPointer(a.aPos, 3, gl.FLOAT, false, S, 0); gl.enableVertexAttribArray(a.aUV); gl.vertexAttribPointer(a.aUV, 2, gl.FLOAT, false, S, 12); gl.enableVertexAttribArray(a.aNrm); gl.vertexAttribPointer(a.aNrm, 3, gl.FLOAT, false, S, 20); }
  function bindWater(buf) { gl.bindBuffer(gl.ARRAY_BUFFER, buf); const a = water.a;
    gl.enableVertexAttribArray(a.aPos); gl.vertexAttribPointer(a.aPos, 3, gl.FLOAT, false, 32, 0); gl.enableVertexAttribArray(a.aUV); gl.vertexAttribPointer(a.aUV, 2, gl.FLOAT, false, 32, 12); }
  const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'), r = g.createRadialGradient(16, 16, 1, 16, 16, 16); r.addColorStop(0, 'rgba(255,230,160,1)'); r.addColorStop(.35, 'rgba(255,190,90,.55)'); r.addColorStop(1, 'rgba(255,160,60,0)'); g.fillStyle = r; g.fillRect(0, 0, 32, 32); return c; })();
  let glowBuf = null, glowKey = '';
  function bindSprite(buf) { gl.bindBuffer(gl.ARRAY_BUFFER, buf); const S = 40, a = sprite.a;
    gl.enableVertexAttribArray(a.aFoot); gl.vertexAttribPointer(a.aFoot, 3, gl.FLOAT, false, S, 0); gl.enableVertexAttribArray(a.aOff); gl.vertexAttribPointer(a.aOff, 2, gl.FLOAT, false, S, 12);
    gl.enableVertexAttribArray(a.aUV); gl.vertexAttribPointer(a.aUV, 2, gl.FLOAT, false, S, 20); gl.enableVertexAttribArray(a.aAxis); gl.vertexAttribPointer(a.aAxis, 3, gl.FLOAT, false, S, 28); }
  function disableAll() { for (let i = 0; i < 6; i++) gl.disableVertexAttribArray(i); }
  const dyn = { A: atlas(1024, 512), // 사람·우산몬: 1024×512(매 장면 올리는 양을 줄여요)
    buf: null, n: 0, sh: null, shn: 0 }, blobTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 4; return c; })();
  let frames = 0, groundAtMs = 0, groundVer = -1;
  // 그래픽 카드 없이 CPU로 그리는 브라우저(소프트웨어 WebGL)면 game.js가 품질을 ‘낮음’으로 시작해요
  let renderer = ''; try { const ext = gl.getExtension('WEBGL_debug_renderer_info'); renderer = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)); } catch { /* 몰라도 괜찮아요 */ }
  const info = { renderer, software: /swiftshader|llvmpipe|softpipe|software|basic render/i.test(renderer), ok: true, frames: 0, meshes: 0, statics: 0, dynamic: 0, draws: 0, post: false, cards: 0, water: false, quality: 1, lamps: [] };
  if (info.software) sharpOK = false; info.sharp = sharpOK; // v0.97 그래픽 카드 없이 그리는 기기는 예전처럼 가장 가까운 점(또렷한 쌍선형은 계산이 많아 느려요)

  // o: { map, ground, view(chaseView·hdCamera), now, people, viewPos, state, motion, wanted, seen, fogColor, seaColor, sun, light(0..1), post, season,
  //      tint(빛 색), night(0..1, 가로등), quality(0 낮음 · 1 보통 · 2 높음) }
  function render(o) {
    const t0 = performance.now(), { map, view: V } = o, sun = o.sun, fbw = canvas.width, fbh = canvas.height, q = o.quality ?? 1, hd2d = !!V.hd && hd2dMap(map);
    if (!scene || scene.id !== map.id || scene.tag !== assetTintTag() || scene.want !== hd2d || scene.dive !== !!map.diving || (scene.missing && frames % 30 === 0)) {
      if (scene) { if (scene.models) gl.deleteBuffer(scene.models.buf); for (const m of scene.meshes) { gl.deleteBuffer(m.buf); if (m.mat) { const t = texOf.get(m.mat.canvas); if (t) { gl.deleteTexture(t); texOf.delete(m.mat.canvas); } } } if (scene.shade) gl.deleteBuffer(scene.shade.buf); if (scene.water) gl.deleteBuffer(scene.water.buf); gl.deleteBuffer(scene.cards.buf); if (scene.cards.uw) gl.deleteBuffer(scene.cards.uw.buf); if (scene.cards.region) gl.deleteBuffer(scene.cards.region.buf); gl.deleteBuffer(scene.cards.story.buf); }
      scene = buildScene(map, o.ground, { hd2d }); scene.want = hd2d; scene.dive = !!map.diving; groundAtMs = o.now;
    }
    if (scene.sunKey !== sun.join()) { if (scene.shade) gl.deleteBuffer(scene.shade.buf); scene.shade = buildShade(scene.casters, sun); scene.sunKey = sun.join(); }
    if (o.groundVer !== undefined ? o.groundVer !== groundVer : o.now - groundAtMs > 220) { texture(o.ground, true); groundAtMs = o.now; groundVer = o.groundVer; } else texture(o.ground); // 땅 그림이 바뀐 때만 올려요
    const env = { map, state: o.state, time: o.now, motion: o.motion, wanted: o.wanted, seen: o.seen, season: o.season };
    const order = sceneDrawOrder(o.people, o.viewPos, map);
    if (!scene.statics || scene.statics.season !== o.season || (scene.statics.noTrees && frames % 30 === 0 && assetImage(HD2D_TREES.key) && assetImage(PACK96.flora.key))) {
      const trees = assetImage(HD2D_TREES.key), flora = assetImage(PACK96.flora.key), cards = scene.hd2d ? assetImage(HD2D_ATLAS.key) : null, story = scene.hd2d ? assetImage(STORY_ATLAS.key) : null; scene.statics = scene.uw ? { buf: null, n: 0, atlas: null, flat: { n: 0 }, blobs: { n: 0 } } : buildStatics(map, { ...env, time: 0, trees, flora, cards, story }, order, { hd2d: scene.hd2d, hd: !!V.hd, water: !!scene.water, hide: scene.hideStatic, interior: scene.interior }); scene.statics.season = o.season; scene.statics.noTrees = !trees || !flora || (scene.hd2d && !story); if (!scene.uw) { texture(scene.statics.atlas, true, 0, sharpOK ? 'sprite' : false); texture(scene.statics.flat.tex, true); } }
    let A = dyn.A; A.g.clearRect(0, 0, A.size, A.h); A.x = A.y = A.row = 0; const arr = [], sh = new Batch(); let player = null;
    // v0.82 고침: 사람·우산몬이 많으면(나리분지처럼) 그림 칸이 모자라 내 캐릭터가 빠지던 것 → 내 캐릭터를 먼저 그리고,
    //   화면에서 먼 것은 건너뛰고, 그래도 모자라면 그림 칸을 두 배로 늘려요. 그리는 순서(깊이)는 깊이 버퍼가 정하니 바뀌어도 괜찮아요.
    const vx = o.viewPos.x, vy = o.viewPos.y, near = n => n.player || (Math.abs(n.x - vx) <= 22 && n.y - vy <= 14 && vy - n.y <= 26);
    const live = order.filter(n => !(map.diving && !n.player && (n.actor || map[Math.round(n.y)]?.[Math.round(n.x)] !== 0 || PROP_KINDS.includes(n.kind))) && !(n.scenery || n.building || (n.kind === 'landmark' && scene.hideLandmarks.has(n.name))) && near(n)); // GLB 바위로 그린 지명은 작은 그림을 빼요(말 걸기 자리는 그대로)
    live.sort((a, b) => (b.player ? 1 : 0) - (a.player ? 1 : 0));
    for (const n of live) {
      if (n.player && V.fp) continue; // v0.84 1인칭: 내 눈이라 내 몸은 안 그려요
      const it = n.player ? { ...n, x: vx, y: vy, depth: vy * T + 28 } : n; if (n.player) player = it;
      let c = drawCell(A, it, env);
      if (!c && A.h < 2048) { const old = A; dyn.A = A = atlas(1024, old.h * 2); A.g.drawImage(old.c, 0, 0); A.x = old.x; A.y = old.y; A.row = old.row; arr.length = 0; sh.v.length = 0; return render(o); } // 칸이 모자라면 늘려서 이 장면을 다시
      if (!c) continue;
      const tx = Math.round(it.x), ty = Math.round(it.y), swim = n.player && !map.diving && map[ty]?.[tx] === 0 && !map.shallow?.has(`${tx},${ty}`); // v0.82 깊은 물: 그림의 물결 줄이 물낯에 오게 판을 내려요(가슴까지 잠긴 헤엄)
      pushSprite(arr, map, it, c, [0, 0], 0, swim ? -14 : 0);
      if (!swim && (n.player || !(PROP_KINDS.includes(n.kind) || n.kind === 'board'))) blob(sh, map, it);
    }
    dyn.buf = upload(arr, dyn.buf); dyn.n = arr.length / 10; texture(A.c, true, 0, sharpOK ? 'sprite' : false); dyn.sh = upload(sh.v, dyn.sh); dyn.shn = sh.v.length / 8;
    // 내 캐릭터의 화면 자리(가림 판단): 프레임버퍼 픽셀 · 깊이(w)
    let cutU = [0, 0, 0, 0], cutY = 1e6;
    if (player) { const f = footOf(player), h = groundAt(map, f.x, f.y) + 24; cutY = h - 24 + 6; const M = V.M, p = [f.x, h, f.y, 1], cl = [0, 1, 2, 3].map(r => M[r] * p[0] + M[4 + r] * p[1] + M[8 + r] * p[2] + M[12 + r] * p[3]);
      const g0 = h - 24, wRef = M[3] * f.x + M[7] * g0 + M[11] * (f.y - 8) + M[15]; // 깊이 기준: 발 높이 · 발보다 조금 뒤(그 앞에 있는 것이 나를 가려요)
      // v0.87 비침 둘레: 캐릭터 크기만큼만(예전엔 화면 높이의 20%라 가리지 않는 앞 벽에도 둥근 무늬가 보였어요). 앞에 가리는 것이 있을 때만 보여요
      const scr = hh => { const c = [0, 1, 2, 3].map(r => M[r] * f.x + M[4 + r] * hh + M[8 + r] * f.y + M[12 + r]); return c[3] > 1 ? [(c[0] / c[3] * .5 + .5) * fbw, (c[1] / c[3] * .5 + .5) * fbh] : null; };
      const ft = scr(h - 24), hd = scr(h + 30); // 발 · 머리 위 → 그 사이 가운데, 반지름은 키의 절반 남짓
      if (ft && hd) cutU = [(ft[0] + hd[0]) / 2, (ft[1] + hd[1]) / 2, Math.max(12, Math.abs(hd[1] - ft[1]) * .62), wRef]; }

    const usePost = o.post && q >= 1 && target(fbw, fbh).ok;
    if (usePost) gl.bindFramebuffer(gl.FRAMEBUFFER, fbo.a.fb); else gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, fbw, fbh); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND); disableAll();
    const fogCol = hex(o.fogColor), fog = V.fp ? [2400, 12000] : map.diving ? [520, 2100] : V.hd ? [950, 3400] : [520, 2300], camPos = V.eye;
    const tint = o.tint || [1, 1, 1];
    const common = (P) => { gl.uniformMatrix4fv(P.u.uMVP, false, V.M); gl.uniform3fv(P.u.uCam, camPos); gl.uniform3fv(P.u.uFogCol, fogCol); gl.uniform2fv(P.u.uFog, fog); if (P.u.uSun) gl.uniform3fv(P.u.uSun, sun); if (P.u.uCut) gl.uniform4fv(P.u.uCut, cutU); if (P.u.uCutGap) gl.uniform1f(P.u.uCutGap, P === mesh ? 0 : 16); /* 땅·벽·바위 턱은 바로 앞 것도 비워요 */ if (P.u.uTex) gl.uniform1i(P.u.uTex, 0); if (P.u.uTint) gl.uniform3fv(P.u.uTint, tint); };
    let draws = 0; gl.activeTexture(gl.TEXTURE0);
    gl.useProgram(mesh.p); common(mesh); gl.uniform1f(mesh.u.uMode, 0);
    for (const m of scene.meshes) {
      gl.uniform1f(mesh.u.uCutOn, 1); gl.uniform1f(mesh.u.uCutG, m.ground ? 1 : 0); gl.uniform1f(mesh.u.uCutY, cutY); gl.uniform1f(mesh.u.uAO, m.ao ? 1 : 0); gl.uniform1f(mesh.u.uGround, m.mat ? 1 : 0);
      if (m.mat) { // 땅 재질: 재질 지도(1) · 재질 그림(2) · 잡음(3)
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, texture(m.mat.canvas)); gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, texture(assetImage(HD2D_GROUND.seasons?.[o.season] || HD2D_GROUND.key) || assetImage(HD2D_GROUND.key), false, 0, sharpOK)); /* v0.97 부드럽게(걸을 때 땅 무늬가 지지직거리지 않게) · 그래픽 카드 없이 그리는 기기는 예전처럼 */ /* v0.96 계절별 땅 그림(03 땅 재질) */
        gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, texture(assetImage(HD2D_GROUND.noise), false, 1)); gl.activeTexture(gl.TEXTURE0);
        gl.uniform1i(mesh.u.uMat, 1); gl.uniform1i(mesh.u.uMatTex, 2); gl.uniform1i(mesh.u.uNoise, 3); gl.uniform2fv(mesh.u.uMapSize, [m.mat.W, m.mat.H]);
      }
      if (m.tex) { gl.uniform1f(mesh.u.uUseTex, 1); gl.bindTexture(gl.TEXTURE_2D, texture(m.tex, false, m.wrap ? 1 : 0)); } else { gl.uniform1f(mesh.u.uUseTex, 0); gl.uniform4fv(mesh.u.uColor, [...(m.rgb || hex(o.seaColor)), 1]); }
      bindMesh(m); gl.drawArrays(gl.TRIANGLES, 0, m.n); draws++;
    }
    gl.uniform1f(mesh.u.uAO, 0); gl.uniform1f(mesh.u.uCutOn, 0); gl.uniform1f(mesh.u.uCutG, 0); gl.uniform1f(mesh.u.uGround, 0);
    if (scene.statics.flat.n) { gl.uniform1f(mesh.u.uUseTex, 1); gl.bindTexture(gl.TEXTURE_2D, texture(scene.statics.flat.tex)); bindMesh(scene.statics.flat); gl.drawArrays(gl.TRIANGLES, 0, scene.statics.flat.n); draws++; }
    if (scene.models) { // GLB 모델(불투명, 깊이 씀)
      disableAll(); gl.useProgram(model.p); common(model); gl.uniform1f(model.u.uCutOn, 1); const surfImg = assetImage(GLB_SURF);
      gl.uniform1f(model.u.uSurfOn, surfImg ? 1 : 0); if (surfImg) gl.bindTexture(gl.TEXTURE_2D, texture(surfImg)); gl.uniform1i(model.u.uSurf, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, scene.models.buf); const a = model.a, S = 40;
      gl.enableVertexAttribArray(a.aPos); gl.vertexAttribPointer(a.aPos, 3, gl.FLOAT, false, S, 0); gl.enableVertexAttribArray(a.aNrm); gl.vertexAttribPointer(a.aNrm, 3, gl.FLOAT, false, S, 12);
      gl.enableVertexAttribArray(a.aCol); gl.vertexAttribPointer(a.aCol, 3, gl.FLOAT, false, S, 24); gl.enableVertexAttribArray(a.aCls); gl.vertexAttribPointer(a.aCls, 1, gl.FLOAT, false, S, 36);
      gl.drawArrays(gl.TRIANGLES, 0, scene.models.n); draws++; disableAll(); gl.useProgram(mesh.p);
    }
    // 바다 물낯(반투명, 깊이는 쓰지 않아요 → 물에 선 사람·배는 그 위에 그려져요)
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
    if (scene.water) {
      disableAll(); gl.useProgram(water.p); common(water); gl.uniform1f(water.u.uTime, o.now / 1000); gl.uniform1f(water.u.uFx, q); gl.uniform1f(water.u.uLight, o.light); gl.uniform1f(water.u.uGlit, V.fp && o.glit ? 1 : 0); gl.uniform3fv(water.u.uEye, V.eye); gl.uniform3fv(water.u.uGlitCol, o.glitCol || [1, .85, .6]);
      [HD2D_TEXTURES.sea_deep, HD2D_TEXTURES.sea_shallow, HD2D_TEXTURES.foam].forEach((k, i) => { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, texture(assetImage(k), false, i === 1 ? 2 : 1)); });
      gl.uniform1i(water.u.uDeep, 0); gl.uniform1i(water.u.uShal, 1); gl.uniform1i(water.u.uFoam, 2); gl.activeTexture(gl.TEXTURE0);
      bindWater(scene.water.buf); gl.drawArrays(gl.TRIANGLES, 0, scene.water.n); draws++; disableAll(); gl.useProgram(mesh.p);
    }
    // 그림자(반투명, 깊이는 쓰지 않아요): 건물·절벽 → 나무·바위 → 사람
    if (q >= 1 && scene.shade.n) { gl.uniform1f(mesh.u.uMode, 2); bindMesh(scene.shade); gl.drawArrays(gl.TRIANGLES, 0, scene.shade.n); draws++; }
    gl.uniform1f(mesh.u.uMode, 1); gl.bindTexture(gl.TEXTURE_2D, texture(blobTex));
    if (scene.statics.blobs.n) { bindMesh(scene.statics.blobs); gl.drawArrays(gl.TRIANGLES, 0, scene.statics.blobs.n); draws++; }
    if (dyn.shn) { bindMesh({ buf: dyn.sh }); gl.drawArrays(gl.TRIANGLES, 0, dyn.shn); draws++; }
    gl.depthMask(true); gl.disable(gl.BLEND); gl.uniform1f(mesh.u.uMode, 0); disableAll();
    // 세운 판: 나무·물건 → 사람
    gl.useProgram(sprite.p); common(sprite); gl.uniform3fv(sprite.u.uRight, V.right); gl.uniform2fv(sprite.u.uFwd, V.fwd); gl.uniform1f(sprite.u.uTilt, V.tilt); gl.uniform1f(sprite.u.uTime, o.now / 1000);
    gl.uniform1f(sprite.u.uCutOn, 1);
    gl.uniform1f(sprite.u.uGlow, 0);
    const spriteTex = (img, update = false) => { const sh = sharpOK && !!img; gl.uniform1f(sprite.u.uSharp, sh ? 1 : 0); if (sh) gl.uniform2f(sprite.u.uTexSize, img.width, img.height); gl.bindTexture(gl.TEXTURE_2D, texture(img, update, 0, sh ? 'sprite' : false)); }; // v0.97 또렷한 쌍선형
    if (scene.statics.n) { spriteTex(scene.statics.atlas); bindSprite(scene.statics.buf); gl.drawArrays(gl.TRIANGLES, 0, scene.statics.n); draws++; }
    for (const [cb, key] of [[scene.cards, HD2D_ATLAS.key], [scene.cards.story, STORY_ATLAS.key], [scene.cards.uw, UW_ATLAS.key], [scene.cards.region, REGION_ATLAS.key]]) if (cb?.n && assetImage(key)) { // 그림 판: 카메라와 수직(깊이 = 아랫변 줄) · 내 캐릭터를 가리면 도트 무늬로 비쳐요
      gl.uniform1f(sprite.u.uTilt, V.fp ? 0 : HD.pitch); spriteTex(assetImage(key)); bindSprite(cb.buf); gl.drawArrays(gl.TRIANGLES, 0, cb.n); draws++; gl.uniform1f(sprite.u.uTilt, V.tilt);
    }
    gl.uniform1f(sprite.u.uCutOn, 0);
    if (dyn.n) { spriteTex(A.c); bindSprite(dyn.buf); gl.drawArrays(gl.TRIANGLES, 0, dyn.n); draws++; }
    disableAll();
    // 밤: 가로등 불빛(더하기 섞기)
    const night = o.night || 0;
    if (night > .05 && scene.lamps.length) {
      const key = scene.id + scene.lamps.length; if (glowKey !== key) { const arr = []; for (const [x, h, z] of scene.lamps) for (const [ox, oy, u, v] of [[-26, -26, 0, 1], [26, -26, 1, 1], [26, 26, 1, 0], [-26, -26, 0, 1], [26, 26, 1, 0], [-26, 26, 0, 0]]) arr.push(x, h, z + 3, ox, oy, u, v, 0, 0, 0); glowBuf = upload(arr, glowBuf); glowKey = key; }
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); gl.depthMask(false); gl.uniform1f(sprite.u.uGlow, night * .9); gl.uniform1f(sprite.u.uTilt, V.fp ? 0 : HD.pitch);
      gl.bindTexture(gl.TEXTURE_2D, texture(glowTex)); bindSprite(glowBuf); gl.drawArrays(gl.TRIANGLES, 0, scene.lamps.length * 6); draws++;
      gl.uniform1f(sprite.u.uGlow, 0); gl.uniform1f(sprite.u.uTilt, V.tilt); gl.depthMask(true); gl.disable(gl.BLEND); disableAll();
    }
    // 빛 먼지(더하기 섞기) · 높음에서만
    if (q >= 2 && o.light > .05 && player) {
      gl.useProgram(mote.p); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE); gl.depthMask(false);
      const f = footOf(player); gl.uniformMatrix4fv(mote.u.uMVP, false, V.M); gl.uniform1f(mote.u.uTime, o.now / 1000); gl.uniform3fv(mote.u.uCenter, [f.x, groundAt(map, f.x, f.y), f.y]); gl.uniform1f(mote.u.uScale, fbh / 600); gl.uniform1f(mote.u.uLight, o.light);
      gl.bindBuffer(gl.ARRAY_BUFFER, moteBuf); gl.enableVertexAttribArray(mote.a.aSeed); gl.vertexAttribPointer(mote.a.aSeed, 4, gl.FLOAT, false, 16, 0);
      gl.drawArrays(gl.POINTS, 0, 70); draws++; gl.depthMask(true); gl.disable(gl.BLEND); disableAll();
    }
    // 화면 합성
    if (usePost) {
      gl.disable(gl.DEPTH_TEST);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo.b.fb); gl.viewport(0, 0, fbo.b.W, fbo.b.H); gl.useProgram(down.p); gl.bindTexture(gl.TEXTURE_2D, fbo.a.tex); gl.uniform1i(down.u.uScene, 0); gl.uniform2f(down.u.uSrc, 1 / fbo.a.W, 1 / fbo.a.H);
      gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf); gl.enableVertexAttribArray(down.a.aP); gl.vertexAttribPointer(down.a.aP, 2, gl.FLOAT, false, 8, 0); gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, fbw, fbh); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(post.p); gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, fbo.b.tex); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, fbo.a.tex);
      gl.uniform1i(post.u.uScene, 0); gl.uniform1i(post.u.uSmall, 1); gl.uniform2fv(post.u.uTexel, [1 / fbo.b.W, 1 / fbo.b.H]);
      gl.uniform1f(post.u.uFocus, cutU[3] ? cutU[1] / fbh : .45); gl.uniform1f(post.u.uTime, o.now / 1000); gl.uniform1f(post.u.uLight, o.light); gl.uniform1f(post.u.uDof, V.hd ? 1 : .55);
      gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf); gl.enableVertexAttribArray(post.a.aP); gl.vertexAttribPointer(post.a.aP, 2, gl.FLOAT, false, 8, 0); gl.drawArrays(gl.TRIANGLES, 0, 6); draws += 2; disableAll();
    }
    frames++; Object.assign(info, { frames, meshes: scene.meshes.length, statics: scene.statics.n / 6, dynamic: dyn.n / 6, draws, post: usePost, shadows: q >= 1 ? scene.shade.n / 6 : 0, cards: scene.cards.count, cardKeys: scene.cards.keys, water: !!scene.water, quality: q, lamps: scene.lamps, hd2d: scene.hd2d, models: scene.models ? scene.models.n / 3 : 0, glbLandmarks: [...scene.hideLandmarks], interior: scene.interior, pier: scene.pier, doorMats: scene.doorMats || 0, uwCards: scene.cards.uw?.n ? scene.cards.uw.n / 6 : 0, rockCaps: scene.rockCaps || 0, storyCards: scene.cards.story.n / 6, playerDrawn: !!player, dynCap: dyn.A.h, ms: Math.round((performance.now() - t0) * 10) / 10 });
    return true;
  }
  return { ok: true, render, info, groundAt: (map, x, y) => groundAt(map, x, y), landmark: name => scene?.landmarks?.[name] || null, reset() { scene = null; } };
}
