import { PROPS_ATLAS } from './props-atlas.js';
import { TERRAIN_ATLAS } from './terrain-atlas.js';
// 독도 탐험대 v0.36 — screens, movement between maps, story cutscenes and turn-based quiz battles.
import { CUTSCENE_ATLAS } from './cutscene-atlas.js';
import { worldScale } from './layout.js';
import { createJoystick, createLookStick } from './joystick.js';
import { createDirectionInput, KEY_VECTORS } from './input.js';
import { roomId, parseRoomId } from './interiors.js';
import { createGL, hdCamera, fpCamera } from './gl3d.js';
import { MONSTERS, ZONES, TYPES, getSpecies, isUnique, pickStarterField, STARTER_LEVEL, keeperName } from './data.js';
import { CONCEPTS, QUESTIONS, SOURCES } from './learning.js';
import { STUDY_PAGES } from './study.js';
import { stampSVG } from './stamps.js';
import { heartText, toHalves } from './engine.js';
import { newState, validateSave, createMonster, damage, enemyHit, attackHit, advantage, TYPE_RING, TYPE_REASON, healAll, gainXP, PARTY_MAX, captureChance, runChance, xpForDefeat, BENCH_RATE, addMonster, recordAnswer, BOSS_KINDS, PIERCE_CHANCE, QUESTION_POWER } from './engine.js';
import { portrait, look } from './sprites.js';
import { LEGENDS, ALL_LEGEND_IDS, legendProgress, legendScene, openFlag, metFlag, ownsSpecies } from './legends.js';
import { PHOTO_CREDITS, LICENSE_TEXT, photoKey } from './photo-credits.js';
import { onAssetReady, preloadMonsters, assetImage, assetURL, assetTintTag } from './assets.js';
import { VILLAIN_ATLASES } from './villain-atlases.js';
import { music, sfx, jingle, setOn, setVolume, isOn, audioPrefs, currentMusic, wantedMusic } from './audio.js';
import { TRACKS } from './music-data.js';
import { cameraStep, seenDir, clampPitch, DIR_ANGLE } from './view3d.js';
import { weatherNow, weatherChoice, setWeather, currentSeason, seasonChoice, setSeason, seasonColor, seasonWind, SEASON_NAME, SEASON_ICON, seasonOfMonth, clockTick, setClock, gameClock, daylight, isNight, clockLabel, dayNightChoice, setDayNight, DAY_MS } from './season.js';
import { whenNote, timeTalk } from './roamers.js';
import { TRAITS, TRAIT_KINDS, traitOf } from './traits.js';
import { pictureKey } from './characters.js';
import { setPixelSnap } from './characters.js';
import { EXPLORERS, PROFESSOR_PICTURE, paintExplorerCard, paintExplorerPortrait, drawResident } from './characters.js';
import { createNPCMotion } from './npc-motion.js';
import { createRoamers } from './roamers.js';
import { MOVE_DURATION, moveView } from './movement.js';
import { selectBattleQuestion, shuffledChoices, quizFormat, oxShown } from './battle-quiz.js';
import { pickRecord } from './records.js';
import { seabedLayout, fishAt, UW_INFO, UW_NOTE, UW_MON_NOTE } from './seabed.js';
import { UW_ATLAS, UW_FLOOR } from './uw-atlas.js';
import { createMap, npcs, blocked, pathfind, drawWorld, drawActors, drawFlatDecor, TILE, W, H, wantedRole, VILLAIN_BY_ZONE, ROLE_ACTOR, buildingArt, doorColumns } from './world.js';
import { MAPS, getMapDef, townId, nextMapId, prevMapId } from './maps.js';
import { createCutscenePlayer } from './cutscene.js';
import { OPENING, GUIDE, LEGEND, arrivalScene, VILLAIN_TALES, BOSS_REVEAL, BOSS_FALL, TREE_JOINS, EPILOGUE, FERRY, FERRY_AGAIN, ISLAND_BOAT } from './story.js';
import { createBattleUI } from './battle-ui.js';
import { josa } from './text.js';

const VERSION = '0.91';
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const wait = ms => new Promise(r => setTimeout(r, ms));
const KEY = 'dokdomon-save-v1';

let state = newState(), saved = null, map = createMap('town0');
let fp = null; // v0.84 1인칭 관찰 중이면 { 이름, 눈 자리, 보는 방향, 모드 }
// v0.79 보기는 HD-2D 하나예요(2D·3D 보기 단추를 없앴어요). 들판·마을·건물 안·바닷속 모두 gl3d.js가 그려요.
//   카메라는 북쪽을 보며 비스듬히 내려다보고 돌리지 않아요 → 걷기·누르기는 2D와 같아요(위 = 북쪽).
//   WebGL이 안 되는 기기만 예전 2D 그리기가 자동으로 대신해요(고르는 메뉴는 없어요).
let ground3d = null; const groundCache = { key: '', at: 0, ver: 0, camera: { x: 0, y: 0 } };
const in3d = () => false; // 돌리는 3D 카메라(v0.59~0.78)는 없어졌어요
let yaw = null, pitch = 0; // 시험 고리(setLook)용으로만 남겨 둬요
const FOG = '#0e4f73'; // 바닷속 안개 색
// 지도 위의 점(픽셀) → 화면 위의 점(지도 칸 단위 픽셀, sceneScale을 곱하기 전). lift: 땅에서 띄울 높이
function toScreen(wx, wy, lift = 0) {
  if (hdOn() && hdView) { const p = hdView.project(wx, wy, glView.groundAt(map, wx, wy) + lift); return p ? { x: p.x, y: p.y, k: p.k } : { x: -9999, y: -9999, k: 0 }; } // HD-2D
  return { x: wx - camera.x, y: wy - lift - camera.y, k: 1 };
}
function fromScreen(sx, sy) {
  if (hdOn() && hdView) return hdView.unproject(sx, sy, glView.groundAt(map, view.x * TILE + 16, view.y * TILE + 28));
  return { x: sx + camera.x, y: sy + camera.y };
}
let camera = { x: 0, y: 0 }, view = { x: state.x, y: state.y }, moving = null, path = [], pathAction = null;
let walks = 0, lastEncounter = 0, walkDistance = 0, battle = null, dialogueState = null, modalReturn = null, avatarChoice = null;
let lastTick = performance.now(), transition = false;
const npcMotion = createNPCMotion(); let npcFocus = null;
const roamers = createRoamers(Math.random, () => ({ season: currentSeason(), night: isNight() })); // 길 위를 걸어 다니는 야생 우산몬 (roamers.js) · v0.69 계절·밤낮에 따라 달라요
const keys = createDirectionInput(); // 방향키: 나중에 누른 방향 우선 · 짧게 친 방향 기억 (input.js)

const canvas = $('#world'), ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = false;
const actorCanvas = $('#actors'), actorCtx = actorCanvas.getContext('2d');
// v0.77 새 3D(시험판): WebGL 캔버스는 하늘(#world)과 날씨·이름표(#actors) 사이에 놓여요
const glCanvas = document.createElement('canvas'); glCanvas.id = 'gl3d'; glCanvas.setAttribute('aria-hidden', 'true'); glCanvas.hidden = true; canvas.after(glCanvas);
// v0.79 그리기: HD-2D 하나(WebGL). WebGL이 없으면 2D로
let glView = null, hdView = null, force2D = false; // force2D: 시험용(WebGL이 없는 기기 흉내)
function glOn() {
  if (force2D) return false;
  if (!glView) { glView = createGL(glCanvas); if (glView.ok && glView.info.software && !gqSaved) { gfxQ = 0; resizeScene(); } } // 그래픽 카드 없이 그리는 기기는 ‘낮음’부터
  return glView.ok;
}
const hdOn = () => glOn();
function setGL(on) { force2D = !on; hdView = null; glView?.reset?.(); labelKey = ''; }
const moveYaw = () => 0, lookYaw = () => 0; // HD-2D 카메라는 늘 북쪽을 봐요
// 그래픽 품질(이 기기에 기억): 0 낮음(0.6배 해상도·그림자·화면 효과·물거품 끔) · 1 보통 · 2 높음(빛 먼지·물 반짝임, 선명하게)
let gfxQ = 1, gqSaved = false; try { const q = localStorage.getItem('dokdo-gq'); if (q !== null) { gfxQ = Math.max(0, Math.min(2, Math.round(+q) || 0)); gqSaved = true; } } catch { /* 보통 */ }
function setQuality(q) { gfxQ = Math.max(0, Math.min(2, Math.round(+q) || 0)); gqSaved = true; try { localStorage.setItem('dokdo-gq', String(gfxQ)); } catch { /* 괜찮아요 */ } resizeScene(); }
// v0.79 해 방향·빛 색: 아침엔 동쪽, 낮엔 남쪽 하늘 높이, 저녁엔 서쪽에서 비춰요(그림자는 반대쪽). 밤엔 서늘한 달빛.
function lightFor(L) {
  const h = L.hour, mix = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
  let sun; if (h < 5.5 || h > 19) sun = [-.3, .85, .42]; else { const a = Math.max(0, Math.min(1, (h - 6) / 12)) * Math.PI; sun = [Math.cos(a) * .8, .35 + Math.sin(a) * .55, .45]; }
  const n = Math.hypot(...sun); sun = sun.map(v => Math.round(v / n * 20) / 20); // 조금씩만 바뀌어요(그림자를 너무 자주 다시 만들지 않게)
  let tint = mix([1, 1, 1], [1.1, .9, .74], L.warm || 0); tint = mix(tint, [.8, .86, 1.05], L.night || 0);
  return { sun, tint };
}
let nightLamps = [];
const scene = $('#gameApp');
let actorPixelRatio = 1, sceneScale = 1, sceneWidth = 768, sceneHeight = 480, labelKey = '', labelNodes = [], activePanel = null;

const titleEl = $('#titleScreen');
const cutscenes = createCutscenePlayer($('#cutscene'), { onBlip: () => sfx('blip') });
const battleUI = createBattleUI($('#battleScreen'), { onBlip: () => sfx('blip'), onSelect: () => sfx('select') });

// ── basics ───────────────────────────────────────────────────────────────────
const z = () => ZONES[state.zone];
const progress = () => state.progress[state.zone];
const name = m => getSpecies(m.id).name;
const busy = () => !state.started || !$('#modal').classList.contains('hidden') || !!dialogueState || !!battle || cutscenes.active() || transition || !!fp;
function liveNPCs() { const base = npcs(map, progress(), state.flags); npcMotion.sync(map.id, base); return [...npcMotion.snapshot(base), ...roamers.snapshot(performance.now())]; }

// The visible height of the browser window (iPad/iPhone Safari toolbars excluded), also for browsers without 100dvh.
function setAppHeight() { document.documentElement.style.setProperty('--app-h', `${Math.round(window.innerHeight)}px`); }
setAppHeight(); window.addEventListener('resize', setAppHeight); window.addEventListener('orientationchange', () => setTimeout(setAppHeight, 250));
window.visualViewport?.addEventListener('resize', setAppHeight);
function resizeScene() {
  const bounds = scene.getBoundingClientRect(), w = Math.max(1, Math.round(bounds.width || 768)), h = Math.max(1, Math.round(bounds.height || 480));
  sceneScale = worldScale(w, h, { dpr: Math.min(3, Math.max(1, window.devicePixelRatio || 1)), tile: TILE, mapW: W, mapH: H });
  sceneWidth = Math.ceil(w / sceneScale); sceneHeight = Math.ceil(h / sceneScale);
  canvas.width = sceneWidth; canvas.height = sceneHeight; canvas.style.width = sceneWidth * sceneScale + 'px'; canvas.style.height = sceneHeight * sceneScale + 'px'; ctx.imageSmoothingEnabled = false;
  actorPixelRatio = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
  actorCanvas.width = Math.ceil(w * actorPixelRatio); actorCanvas.height = Math.ceil(h * actorPixelRatio); actorCanvas.style.width = w + 'px'; actorCanvas.style.height = h + 'px';
  const gq = [.6, 1, Math.min(1.5, actorPixelRatio)][gfxQ] ?? 1; // HD-2D 그리는 해상도(품질 따라)
  glCanvas.width = Math.ceil(sceneWidth * sceneScale * gq); glCanvas.height = Math.ceil(sceneHeight * sceneScale * gq); glCanvas.style.width = canvas.style.width; glCanvas.style.height = canvas.style.height;
}
resizeScene(); window.addEventListener('resize', resizeScene); if (typeof ResizeObserver !== 'undefined') new ResizeObserver(resizeScene).observe(scene);

function exitLabels() {
  const out = [];
  if (map.kind === 'room') {
    for (const d of map.doors) out.push({ name: '밖으로 ▼', x: d.x * TILE + 16, y: d.y * TILE + 26, exit: true });
    for (const s of map.stairs) out.push({ name: s.dir === 'up' ? `${map.def.floor + 1}층 ▲` : `${map.def.floor - 1}층 ▼`, x: s.x * TILE + 16, y: s.y * TILE - 12, exit: true });
    return out;
  }
  for (const dir of ['prev', 'next']) {
    const tiles = [...map.exits].filter(([, d]) => d === dir).map(([k]) => k.split(',').map(Number)); if (!tiles.length) continue;
    const target = getMapDef(dir === 'next' ? nextMapId(map.id) : prevMapId(map.id)), locked = dir === 'next' && map.kind === 'town' && !state.badges.includes(state.zone);
    const x = tiles[0][0] + (dir === 'next' ? -1.2 : 1.6), y = Math.min(...tiles.map(t => t[1]));
    const boat = crossesSea(map.id, target.id), label = boat ? boatLabel(map.id, target.id) : target.name;
    out.push({ name: dir === 'next' ? `${label} →${locked ? ' (인증 후)' : ''}` : `← ${label}`, x: x * TILE + 16, y: y * TILE - 10, exit: true, locked });
  }
  return out;
}
function paintWorldLabels(people = liveNPCs()) {
  const key = map.id + state.badges.length + '|' + people.map(n => n.uid).join('|');
  if (labelKey !== key) {
    labelKey = key; const layer = $('#worldLabels'); layer.replaceChildren();
    // 건물 이름은 문 위 간판처럼, 사람 이름은 머리 위에 — 가까이 갔을 때만 나타나서 다른 캐릭터를 가리지 않아요.
    const fixed = [...(map.kind === 'town' ? enterable() : []).map(b => { const c = doorCols(b), dx = (c[0] + c[c.length - 1]) / 2; return { name: b.name, x: dx * TILE + 16, y: (b.y + b.h) * TILE - 2, lift: 44, door: { x: dx, y: b.y + b.h }, building: true }; }), ...exitLabels(), ...(map.kind === 'room' ? [] : map.parsed.objects.filter(o => o.type === 'sign' && !o.furniture && o.name).map(o => ({ name: o.name, x: o.x * TILE + 16, y: o.y * TILE + 30, lift: 54, sign: { x: o.x, y: o.y } })))]; /* v0.88 빈 안내판 위 이름표(가까운 한 개) */ // v0.84 간판은 진짜 문 바로 위에(집·가게·터미널도)
    labelNodes = [...fixed, ...people.filter(n => n.actor).map(n => ({ name: n.name, uid: n.uid }))].map(n => {
      const el = document.createElement('span');
      el.className = n.exit ? `exit-label${n.locked ? ' locked' : ''}` : n.building ? 'building-label' : n.sign ? 'sign-label' : 'world-nameplate';
      if (n.building) { el.innerHTML = '<i class="door-ico" aria-hidden="true"></i>'; el.append(n.name); } else el.textContent = n.name; layer.append(el); return { ...n, el };
    });
  }
  const positions = new Map(people.map(n => [n.uid, n])), talking = !!dialogueState;
  const near = (x, y, r) => Math.max(Math.abs(x - view.x), Math.abs(y - view.y)) <= r;
  // 사람 이름표는 한 명만: 2칸 안에서 가장 가까운 사람(말을 걸 상대)
  let closest = null, best = Infinity;
  for (const p of people) { if (!p.actor) continue; const px = p.drawX ?? p.x, py = p.drawY ?? p.y, d = Math.abs(px - view.x) + Math.abs(py - view.y); if (near(px, py, 2) && d < best) { best = d; closest = p.uid; } }
  let doorNear = null, doorBest = Infinity; // v0.84 문 간판도 한 개만: 3칸 안에서 가장 가까운 문
  for (const n of labelNodes) if (n.building && near(n.door.x, n.door.y, 3)) { const d = Math.abs(n.door.x - view.x) + Math.abs(n.door.y - view.y) * 1.5; if (d < doorBest) { doorBest = d; doorNear = n; } }
  let signNear = null, signBest = Infinity; // v0.88 안내판 이름표도 한 개만: 2칸 안에서 가장 가까운 안내판
  for (const n of labelNodes) if (n.sign && near(n.sign.x, n.sign.y, 2)) { const d = Math.abs(n.sign.x - view.x) + Math.abs(n.sign.y - view.y); if (d < signBest) { signBest = d; signNear = n; } }
  for (const n of labelNodes) {
    const live = positions.get(n.uid), fixed = n.building || n.exit || n.sign;
    const px = live?.drawX ?? live?.x ?? 0, py = live?.drawY ?? live?.y ?? 0;
    const at = fixed ? toScreen(n.x, n.y, n.lift || 0) : toScreen(px * TILE + 16, py * TILE + 28, 48 + 24); // 48 = 캐릭터 키, 그 위 ‘!’ 표시보다 위쪽
    const x = Math.round(at.x * sceneScale), y = Math.round(at.y * sceneScale);
    const onScreen = x >= 0 && x <= sceneWidth * sceneScale && y >= 20 && y < sceneHeight * sceneScale - 25;
    const shown = onScreen && (n.exit || (!talking && (n.building ? n === doorNear : n.sign ? n === signNear && !map.diving : n.uid === closest && !map.diving)));
    n.el.hidden = !onScreen; n.el.classList.toggle('show', shown);
    if (onScreen) { const half = (n.el.offsetWidth || n.name.length * 14 + 20) / 2; n.el.style.left = Math.round(Math.max(half + 5, Math.min(sceneWidth * sceneScale - half - 5, x))) + 'px'; n.el.style.top = y + 'px'; }
  }
}

function save(manual = false) {
  if (!state.started) return; state.savedAt = Date.now();
  try { localStorage.setItem(KEY, JSON.stringify(state)); $('#saveStatus').textContent = `${new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 저장됨`; if (manual) { toast('모험을 이 기기에 저장했어요.'); sfx('save'); } }
  catch { $('#saveStatus').textContent = '기기 저장 공간을 확인하세요'; toast('자동 저장이 어려워요. 메뉴에서 저장 파일을 내려받아 주세요.'); }
}
function toast(message) { $('#toast').textContent = message; $('#toast').classList.remove('hidden'); clearTimeout(toast.timer); toast.timer = setTimeout(() => $('#toast').classList.add('hidden'), 3100); }
// ── 배경음악 고르기 (v0.55, audio.js · music-data.js) ─────────────────────────
// 결투 > 컷신 > 타이틀 > 지금 있는 곳 순서로 정해요. 매 화면마다 불러도 같은 곡이면 그대로 이어요.
const CUTSCENE_MUSIC = { opening: 'town', guide: 'meadow', ferry: 'dokdo', legend: 'legend', 'boss-reveal': 'villain', 'boss-fall': 'dokdo', 'tree-joins': 'legend', epilogue: 'title' };
// v0.69: 밤에는 밤 노래(마을·초원 ‘별 헤는 밤’, 바닷길·독도 ‘달빛 밤바다’). 건물 안은 늘 같아요.
function mapMusic() { const d = map.def, n = d.kind !== 'room' && isNight(); if (map.diving) return 'nightsea'; /* v0.71 바닷속은 잔잔한 노래 */ return d.kind === 'route' ? (n ? 'nightsea' : 'route') : d.kind === 'room' ? 'room' : d.kind === 'meadow' ? (n ? 'night' : 'meadow') : d.island === '울릉도' ? (n ? 'night' : 'town') : (n ? 'nightsea' : 'dokdo'); }
let musicPreview = null; // 모험 메뉴의 ‘배경음악 듣기’로 고른 곡(메뉴를 닫으면 원래대로)
function musicFor() {
  if (musicPreview) return musicPreview;
  if (battle) return battle.won ? null : BOSS_KINDS.includes(battle.kind) || battle.kind === 'legend' || (battle.kind === 'enemy' && state.zone === 7) ? 'boss' : battle.kind === 'enemy' || battle.kind === 'trainer' ? 'villain' : 'battle';
  const cs = cutscenes.current; if (cs) return CUTSCENE_MUSIC[cs] ?? mapMusic();
  if (!titleEl.classList.contains('hidden')) return 'title';
  return state.started ? mapMusic() : 'title';
}
function settleMovement() { if (moving) { state.x = moving.toX; state.y = moving.toY; view = { x: state.x, y: state.y }; moving = null; } }
function resetTransient() {
  npcMotion.reset(); roamers.reset(); npcFocus = null; walkDistance = 0; avatarChoice = null; moving = null; path = []; pathAction = null; keys.clear();
  dialogueState = null; if (battle) battleUI.destroy(); battle = null; modalReturn = null; walks = 0; lastEncounter = 0; transition = false;
  $('#dialogue').classList.add('hidden'); $('#battleScreen').classList.add('hidden'); scene.classList.remove('battling', 'talking', 'map-fading');
  $('#coachPanel')?.remove(); tutorialSteps = 0;
}

// ── modal panels ───────────────────────────────────────────────────────────────
function restorePanel() { if (activePanel) { $('#panelStorage').append(activePanel); activePanel = null; } }
function openPanel(id, title, kicker) { openModal(head(title, kicker) + '<div id="panelMount"></div>', () => { activePanel = $(id); $('#panelMount').append(activePanel); }); }
function showQuest() { if (!battle) { openPanel('#questPanel', '모험 수첩', map.name); tutorialEvent('quest'); } }
function showParty() { if (!battle) showStorage(); }
async function toggleFullscreen() {
  try { if (document.fullscreenElement) await document.exitFullscreen(); else if (scene.requestFullscreen) await scene.requestFullscreen(); else toast('현재 브라우저에서는 이 화면 크기로 플레이할 수 있어요.'); }
  catch { toast('전체 화면을 열 수 없어 현재 화면 크기로 플레이해요.'); }
}
document.addEventListener('fullscreenchange', () => { const full = !!document.fullscreenElement; $('#fullscreenBtn').setAttribute('aria-label', full ? '전체 화면 끝내기' : '전체 화면으로 보기'); $('#fullscreenBtn').innerHTML = full ? '⛶ <span>화면 줄이기</span>' : '⛶ <span>전체 화면</span>'; resizeScene(); });
function openModal(html, mount) {
  restorePanel(); settleMovement(); keys.clear(); path = []; pathAction = null;
  $('#modalContent').innerHTML = html; $('#modal').classList.remove('hidden'); $('#modal .modal-panel').scrollTop = 0; $('#modal .modal-panel').focus();
  $('#modalContent .modal-close')?.addEventListener('click', closeModal); mount?.(); paintPortraits(); paintExplorerChoices(performance.now());
}
function closeModal() {
  if ($('#modal').classList.contains('hidden')) return;
  restorePanel(); $('#modal').classList.add('hidden'); $('#modalContent').innerHTML = ''; avatarChoice = null; musicPreview = null; canvas.focus({ preventScroll: true });
  if (modalReturn) { const fn = modalReturn; modalReturn = null; fn(); }
}
function head(title, kicker = '탐험 수첩', close = true) { return `<div class="modal-head"><div><span class="eyebrow">${kicker}</span><h2 id="modalTitle">${title}</h2></div>${close ? '<button class="modal-close" aria-label="닫기">✕</button>' : ''}</div>`; }
function paintPortraits() { $$('canvas[data-portrait]').forEach(c => portrait(c, c.dataset.portrait)); } // '68-2' = 변환폼

// ── map dialogue ───────────────────────────────────────────────────────────────
function talk(speakerName, lines, done, note = '게임용 재구성 대화', actor = null, extra = null) {
  const speaker = liveNPCs().find(n => n.name === speakerName); actor = actor || speaker?.actor || null;
  if (speaker) { npcFocus = speaker.uid; npcMotion.face(npcFocus, state); }
  settleMovement(); keys.clear(); path = []; pathAction = null;
  dialogueState = { name: speakerName, lines, index: 0, done, note, actor, extra }; renderTalk(); sfx('talk');
}
function renderTalk() {
  const d = dialogueState; scene.classList.add('talking'); $('#dialogue').classList.remove('hidden');
  $('#dialogue').innerHTML = `<div class="speaker">${d.actor ? '<canvas class="resident-portrait" width="64" height="64" aria-hidden="true"></canvas>' : ''}<span class="speaker-name">${esc(d.name)}</span></div><p>${esc(d.lines[d.index])}</p><div class="dialogue-footer"><small>${esc(d.note)} · ${d.index + 1}/${d.lines.length}</small>${d.extra && d.index === d.lines.length - 1 ? `<button id="extraTalk" class="talk-extra">${esc(d.extra.label)}</button>` : ''}<button id="nextTalk">${d.index === d.lines.length - 1 ? '알겠어요' : '계속 듣기'} ▸</button></div>`;
  $('#nextTalk').onclick = nextTalk; if ($('#extraTalk')) $('#extraTalk').onclick = () => { const x = dialogueState?.extra; nextTalk(); x?.fn(); }; paintResidentPortrait();
}
function paintResidentPortrait() { const p = $('.resident-portrait'); if (p && dialogueState?.actor) { const c = p.getContext('2d'); c.clearRect(0, 0, 64, 64); drawResident(c, dialogueState.actor, 0, 0, 64); } }
function nextTalk() {
  if (!dialogueState) return; sfx('next');
  if (++dialogueState.index < dialogueState.lines.length) renderTalk();
  else { const fn = dialogueState.done, who = dialogueState.note; dialogueState = null; scene.classList.remove('talking'); $('#dialogue').classList.add('hidden'); fn?.(); if (who !== '튜토리얼') tutorialEvent('talk'); updateUI(); save(); }
}
async function playStory(script, vars = {}, opts = {}) {
  settleMovement(); keys.clear(); path = []; pathAction = null;
  return cutscenes.play(script, { vars: { avatar: state.avatar || 'girl', ...vars }, ...opts });
}

// ── new game: avatar → opening cutscene → starter → guide ───────────────────────
function startNew() {
  if (saved?.started) {
    openModal(head('새로운 모험을 시작할까요?') + '<p>이 기기의 현재 진행이 새 모험으로 바뀌어요. 이어 하려면 닫아 주세요.</p><div class="modal-actions"><button id="backupStart" class="neutral">기존 저장 내려받기</button><button id="confirmStart" class="primary">새 모험 시작</button></div>', () => {
      $('#backupStart').onclick = () => download('dokdomon-save.json', JSON.stringify(saved, null, 2));
      $('#confirmStart').onclick = () => { closeModal(); chooseAvatar(); };
    });
  } else chooseAvatar();
}
function paintExplorerChoices(now = 0) {
  $$('canvas[data-explorer-portrait]').forEach(c => paintExplorerPortrait(c, c.dataset.explorerPortrait));
  $$('canvas[data-explorer-sprite]').forEach(c => paintExplorerCard(c, c.dataset.explorerSprite, now, avatarChoice?.selected === c.dataset.explorerSprite));
}
function chooseAvatar(onChoose = null, canClose = true) {
  let selected = null; EXPLORERS.forEach(e => assetImage(e.picture));
  openModal(head('어떤 탐험대원으로 떠날까요?', '독도 탐험대 · 캐릭터 선택', canClose) + `<p class="explorer-intro">마음에 드는 탐험대원을 골라 주세요. 두 캐릭터의 능력과 이야기는 같아요.</p><div class="explorer-grid">${EXPLORERS.map(e => `<button class="explorer-card" data-avatar="${e.id}" aria-pressed="false"><canvas class="explorer-portrait" data-explorer-portrait="${e.id}" width="512" height="512" aria-label="${e.label} 탐험대원 그림"></canvas><div class="explorer-card-footer"><canvas data-explorer-sprite="${e.id}" width="64" height="64" aria-hidden="true"></canvas><strong>${e.label}</strong><span class="explorer-selected">✓</span></div></button>`).join('')}</div><p class="explorer-choice-status" id="avatarStatus" role="status">캐릭터를 누르면 걷는 모습을 볼 수 있어요.</p><div class="modal-actions"><button id="avatarConfirm" class="primary" disabled>이 캐릭터로 시작 →</button></div>`, () => {
    avatarChoice = { selected: null };
    $$('[data-avatar]').forEach(b => b.onclick = () => {
      selected = b.dataset.avatar; avatarChoice.selected = selected;
      $$('[data-avatar]').forEach(card => { const chosen = card.dataset.avatar === selected; card.classList.toggle('selected', chosen); card.setAttribute('aria-pressed', String(chosen)); });
      $('#avatarStatus').textContent = `${EXPLORERS.find(e => e.id === selected).label} 탐험대원과 함께 떠나요.`; $('#avatarConfirm').disabled = false; paintExplorerChoices(performance.now());
    });
    $('#avatarConfirm').onclick = () => { if (!selected) return; const id = selected; closeModal(); if (onChoose) onChoose(id); else beginOpening(id); };
  });
}
async function beginOpening(avatar) {
  resetTransient(); state = newState(); state.avatar = avatar; map = createMap('town0'); view = { x: state.x, y: state.y };
  $('#titleScreen').classList.add('hidden'); scene.classList.add('story');
  preloadMonsters([67, 34, 55, 9, 3]); assetImage('monsters/dots'); /* v0.91 지도용 우산몬 도트 그림 */ assetImage(PROFESSOR_PICTURE); assetImage(CUTSCENE_ATLAS.key); assetImage(PROPS_ATLAS.key); assetImage(TERRAIN_ATLAS.key);
  await playStory(OPENING);
  await enterMeadow(avatar);
}
// ── 첫 동료 고르기 (v0.47): 김박사가 데려다 놓은 우산몬 30마리가 나리분지 초원을 걸어 다녀요. ──
// 돌아다니며 말을 걸어 보고(meetFriend), 마음에 드는 친구를 동료로 데려가면(chooseFriend) 도동항에서 모험이 시작돼요.
async function enterMeadow(avatar) {
  if (!state.avatar) state.avatar = avatar;
  state.starterField = (TEST_MODE && window.__dokdoStarterField?.()) || pickStarterField();
  state.started = true; state.map = 'meadow0'; state.zone = 0; map = createMap('meadow0');
  const s = map.spawns.a; state.x = s.x; state.y = s.y; state.dir = 'right'; view = { x: s.x, y: s.y };
  roamers.setFriends(state.starterField); preloadMonsters(state.starterField);
  $('#titleScreen').classList.add('hidden'); scene.classList.remove('story'); updateUI(); save(); showPlaceBanner(map.def);
  await wait(500);
  talk('김박사', ['여기는 울릉도 한가운데의 나리분지예요. 제가 돌보는 우산몬들이 지내는 초원이죠.', '검은 기운에 물들지 않은 우산몬 서른 마리를 데려다 놓았어요. 저마다 속성도, 성격도 달라요.', `초원을 돌아다니며 우산몬에게 다가가 ${touchy() ? '‘대화’ 버튼을 누르거나 우산몬을 눌러' : 'E 키나 스페이스를 누르거나 우산몬을 눌러'} 말을 걸어 보세요.`, '마음이 가는 친구를 찾으면 함께 데려가요. 천천히 골라도 괜찮아요!'], null, '첫 동료 고르기', 'professor');
}
const STRONG = TYPE_RING;
// 속성 고리: 파도→바위→바람→풀→빛→파도 (도움말 · 첫 동료 카드에서 보여 줘요)
function typeRingHTML() {
  const order = ['wave', 'rock', 'wind', 'leaf', 'light'];
  return `<div class="type-ring" aria-label="속성 고리"><strong>속성 고리</strong><div class="ring-row">${order.map(t => `<span class="type-chip" style="--type:${TYPES[t].color}">${TYPES[t].name}</span>`).join('<b aria-hidden="true">→</b>')}<b aria-hidden="true">→</b><span class="type-chip" style="--type:${TYPES.wave.color}">${TYPES.wave.name}</span></div><ul>${order.map(t => `<li><b>${TYPES[t].name} → ${TYPES[TYPE_RING[t]].name}</b><span>${TYPE_REASON[t]}</span></li>`).join('')}</ul><small>화살표 앞의 속성이 뒤의 속성에 강해요. 강한 상대에게 정답을 맞히면 1.5배!</small></div>`;
}
const FRIEND_HELLO = { 조류: '날개를 파닥이며 가까이 날아왔어요.', 물고기: '꼬리를 살랑 흔들며 물방울을 튀겼어요.', 곤충: '더듬이를 쫑긋 세우고 빙글빙글 돌아요.', 식물: '잎을 살랑살랑 흔들며 인사해요.' };
function meetFriend(n) {
  const m = getSpecies(n.species), type = TYPES[m.type].name, weak = Object.keys(STRONG).find(k => STRONG[k] === m.type);
  if (!state.seen.includes(m.id)) state.seen.push(m.id);
  const bars = m.base ? `<div class="base-stats" aria-label="기본 능력치">${[['체력', 'hp'], ['공격', 'attack'], ['방어', 'defense'], ['스피드', 'speed']].map(([l, k]) => `<div><span>${l}</span><i><b style="width:${Math.round(m.base[k] / 140 * 100)}%"></b></i><em>${m.base[k]}</em></div>`).join('')}</div>` : '';
  const gym = TYPES[ZONES[0].type].name, vsGym = STRONG[m.type] === ZONES[0].type ? `첫 독도 지킴이 ${ZONES[0].boss}의 ${gym} 속성 우산몬에게 강해요!` : STRONG[ZONES[0].type] === m.type ? `첫 독도 지킴이 ${ZONES[0].boss}의 ${gym} 속성 우산몬에게는 조금 약하지만, 정답을 맞히면 이길 수 있어요.` : `첫 독도 지킴이 ${ZONES[0].boss}은 ${gym} 속성 우산몬을 데려와요.`;
  openModal(head(m.name, `나리분지 초원 · 첫 동료 고르기`) + `<div class="monster-detail meet-friend"><canvas data-portrait="${m.id}" width="160" height="160"></canvas><div><span class="type-chip">${type} 속성</span> <span class="type-chip">${esc(m.group || '')}</span><p class="trait-line">${traitChip(m)} ${esc(traitOf(m.id).text)}</p><p class="meet-hello">${esc(josa(m.name, '이/가'))} ${FRIEND_HELLO[m.group] || '고개를 갸웃하며 바라봐요.'}</p>${bars}<p class="meet-type">${type} 속성은 <b>${TYPES[STRONG[m.type]].name}</b> 속성에 강하고, <b>${TYPES[weak].name}</b> 속성에 약해요.<br><small>${TYPE_REASON[m.type]}</small><br>${vsGym}</p></div></div><div class="modal-actions"><button id="takeFriend" class="primary">이 친구를 동료로 데려갈래요</button><button id="keepLooking" class="neutral">조금 더 둘러볼래요</button></div>`, () => {
    $('#takeFriend').onclick = () => { closeModal(); chooseFriend(m.id, n.uid); };
    $('#keepLooking').onclick = () => { closeModal(); toast('천천히 둘러보세요. 다른 친구에게도 말을 걸어 봐요!'); };
  });
  sfx('talk'); updateUI();
}
async function chooseFriend(id, uid) {
  addMonster(state, createMonster(id, STARTER_LEVEL)); state.active = 0; roamers.remove(uid, performance.now());
  delete state.starterField; save();
  await playStory(GUIDE, { starter: getSpecies(id).name, starterId: id });
  await changeMap('town0', 'a', { instant: true, dir: 'up' });
  state.tutorial = { battle: false, walk: 0 }; updateUI(); save();
  startTutorial();
}
function continueGame() {
  if (!saved) return;
  if (!['girl', 'boy'].includes(saved.avatar)) { chooseAvatar(id => { saved.avatar = id; continueGame(); }); return; }
  resetTransient(); state = validateSave(JSON.parse(JSON.stringify(saved))); state.started = true;
  map = createMap(state.map); view = { x: state.x, y: state.y }; if (state.starterField) roamers.setFriends(state.starterField);
  if (blocked(map, state.x, state.y, liveNPCs()) || map.exits.has(`${state.x},${state.y}`)) { const s = map.spawns.a; state.x = s.x; state.y = s.y; view = { x: s.x, y: s.y }; }
  $('#titleScreen').classList.add('hidden'); scene.classList.remove('story'); updateUI(); save();
  toast('반가워요! 수첩에서 다음 목적지를 확인하세요.'); showPlaceBanner(map.def);
  if (!state.party.length) toast('나리분지 초원이에요. 우산몬에게 말을 걸어 첫 동료를 골라 보세요!');
  else if (!state.tutorial.battle) setTimeout(startTutorial, 600); else renderCoachPanel();
}

// ── HUD ────────────────────────────────────────────────────────────────────────
function questInfo() {
  if (map.kind === 'meadow') return { title: '함께 떠날 첫 동료 고르기', desc: '나리분지 초원을 돌아다니며 우산몬에게 말을 걸어 보세요. 속성과 능력치를 살펴보고, 마음에 드는 친구를 동료로 데려가면 모험이 시작돼요.', stage: -1 };
  if (map.kind === 'route') {
    const next = getMapDef(nextMapId(map.id)), objs = map.parsed.objects, found = objs.filter(o => state.flags[`${map.id}:${o.key}`]).length;
    return { title: `${map.name}을 따라서`, desc: `오른쪽 끝까지 걸어가면 ${next.name}에 도착해요. 표지판·관찰 지점·기억 비석도 살펴봐요. (길에서 해낸 일 ${found})`, stage: -1 };
  }
  const p = progress(), stage = !p.met ? 0 : p.studied < 2 ? 1 : !p.enemy ? 2 : !p.boss ? 3 : 4;
  const titles = [state.zone === 0 ? '우산몬의 비밀을 찾아서' : z().helper ? '시간을 건너온 조상님' : '기억 속 인물을 찾아서', '기록판의 단서를 읽어요', '빼앗긴 기록을 되찾자', `${keeperName(z())}의 시험`, state.zone === 7 ? '두 섬의 기억을 되찾았어요' : '새로운 길이 열렸어요'];
  const nextRoute = state.zone < 7 ? getMapDef(nextMapId(map.id)) : null, nextTown = state.zone < 7 ? getMapDef(townId(state.zone + 1)) : null;
  const desc = [`${z().npc}에게 말을 걸어 이 지역의 이야기를 들어보세요.`, '배운 사실과 지난 기록을 연결해 두 가지 조사를 마치세요.', `${z().enemy}에게 다가가 기록을 돌려받으세요.`, `수호관 앞에서 ${josa(keeperName(z()), '과/와')} 대화하세요. 쉼터에서 동료를 회복할 수 있어요.`,
    state.zone === 7 ? '두 섬의 기억을 되찾았어요! 도감과 다른 지역의 모험이 기다려요.' : `오른쪽 다리를 건너 ‘${nextRoute.name}’을 따라 ${josa(nextTown.name, '으로/로')} 가요.`];
  return { title: titles[stage], desc: desc[stage], stage };
}
function updateUI() {
  preloadMonsters([...state.party.map(m => m.id), ...z().wild.slice(0, 6)]);
  scene.classList.toggle('playing', state.started);
  const def = map.def;
  $('#chapterTitle').textContent = state.started ? `${String(state.zone + 1).padStart(2, '0')} · ${z().subtitle}` : '독도로 떠나는 모험';
  $('#regionTag').textContent = def.kind === 'town' ? `CHAPTER ${String(state.zone + 1).padStart(2, '0')} · ${def.island}` : def.kind === 'room' ? `${def.island} · ${def.townName}` : def.kind === 'meadow' ? `${def.island} · 김박사의 초원` : `${def.island} · 길`;
  $('#locationName').textContent = def.name; $('#weather').textContent = weatherText();
  $('#questCounter').textContent = String(state.zone + 1).padStart(2, '0');
  const q = questInfo();
  $('#questTitle').textContent = state.started ? q.title : '첫 동료를 만나러'; $('#questDesc').textContent = state.started ? q.desc : '새로운 모험을 시작해 보세요.';
  $('#questSteps').innerHTML = state.started && q.stage >= 0 ? ['인물과 이야기하기', '기록 조사하기', '기록 되찾기', '지킴이 인증 받기'].map((v, i) => `<div class="quest-step ${i < q.stage ? 'done' : i === q.stage ? 'current' : ''}"><i>${i < q.stage ? '✓' : i + 1}</i>${v}</div>`).join('') : '';
  $('#badges').innerHTML = stampsHTML();
  $('#badgeCount').textContent = `${state.badges.length} / 8`; $('#partyCount').textContent = `${state.party.length} / ${PARTY_MAX}`;
  $('#dexProgress').textContent = `${state.caught.length} / 100`; $('#learningProgress').textContent = `${studyRead()} / ${STUDY_PAGES.length}`; $('#dailyNote').textContent = z().fact;
  $('#soundBtn').setAttribute('aria-label', isOn() ? '소리 끄기' : '소리 켜기'); $('#soundBtn').title = isOn() ? '소리 끄기' : '소리 켜기'; $('#soundBtn').innerHTML = `♪ <span>소리 ${isOn() ? '켜짐' : '꺼짐'}</span>`;
  $('#partyCards').innerHTML = state.party.length ? state.party.map((m, i) => `<button class="party-card ${i === state.active ? 'active' : ''}" data-party="${i}"><canvas data-portrait="${m.id}" width="64" height="64"></canvas><strong>${name(m)}</strong><small>Lv.${m.level} · ♥ ${heartText(m.hp)}/${heartText(m.maxHp)}</small><div class="hp-track"><i style="width:${m.hp / m.maxHp * 100}%"></i></div></button>`).join('') + Array.from({ length: 6 - state.party.length }, () => '<div class="party-slot">+</div>').join('') : '<p class="empty-party">첫 번째 동료가 당신을 기다리고 있어요.</p>';
  $$('[data-party]').forEach(b => b.onclick = () => partyDetail(Number(b.dataset.party)));
  $('#quickQuestText').textContent = $('#questTitle').textContent; $('#dockPartyCount').textContent = state.storage.length ? `${state.party.length} / ${PARTY_MAX} · 보관 ${state.storage.length}` : `${state.party.length} / ${PARTY_MAX}`;
  const buddy = state.party[state.active] || state.party[0];
  paintLegendList(); preloadMonsters(LEGENDS.filter(q => q.map === map.id).map(q => q.id));
  $('.buddy-peek')?.classList.toggle('hidden', !buddy); // 첫 동료를 고르기 전(나리분지 초원)에는 숨겨요
  if (buddy) { $('#buddyName').textContent = name(buddy); $('#buddyStatus').textContent = `Lv.${buddy.level} · ♥ ${heartText(buddy.hp)}/${heartText(buddy.maxHp)}`; $('#buddyImage').dataset.portrait = buddy.id; }
  paintPortraits();
}
function showPlaceBanner(def) {
  const b = $('#placeBanner'); b.querySelector('small').textContent = def.kind === 'town' ? `${def.island} · CHAPTER ${String(def.zone + 1).padStart(2, '0')}` : def.kind === 'room' ? `${def.townName} · 건물 안` : def.kind === 'meadow' ? `${def.island} · 김박사의 초원` : `${def.island} · 길`;
  b.querySelector('strong').textContent = def.name; b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
  clearTimeout(showPlaceBanner.t); showPlaceBanner.t = setTimeout(() => b.classList.remove('show'), 2600);
}

// ── who to go to next ──────────────────────────────────────────────────────────
function exitTile(dir = 'next') { const k = [...map.exits].find(([, d]) => d === dir)?.[0]; if (!k) return null; const [x, y] = k.split(',').map(Number); const to = getMapDef(dir === 'next' ? nextMapId(map.id) : prevMapId(map.id)); return { exit: dir, x, y, name: crossesSea(map.id, to.id) ? boatLabel(map.id, to.id) : to.name }; }
// 울릉도(1장 도동항)와 독도 사이는 걸어갈 수 없어요: 부두 끝에서 여객선을 타요.
// v0.74 동도와 서도 사이도 걸어갈 수 없어요(다리가 없어요): 선착장에서 작은 배를 타요.
const sideOf = id => { const i = getMapDef(id).island || ''; return i === '울릉도' ? 'ulleung' : i.includes('서도') ? 'west' : 'east'; };
function crossesSea(from, to) { return !!to && sideOf(from) !== sideOf(to); }
function boatLabel(from, to) { const a = sideOf(from), b = sideOf(to); return b === 'ulleung' ? '울릉도행 배' : a === 'ulleung' ? '독도행 배' : b === 'west' ? '서도행 배' : '동도행 배'; }
async function takeFerry(to, spawnKey) {
  const toDokdo = getMapDef(to).island !== '울릉도';
  settleMovement(); path = []; pathAction = null; keys.clear();
  if (sideOf(map.def.town || map.id) !== 'ulleung' && toDokdo) { await playStory(ISLAND_BOAT(sideOf(to))); await changeMap(to, spawnKey); return; }
  if (toDokdo && !state.flags.ferry) { state.flags.ferry = true; await playStory(FERRY); }
  else await playStory(FERRY_AGAIN(toDokdo ? 'dokdo' : 'ulleung'));
  await changeMap(to, spawnKey);
}
function targetNPC() {
  if (map.kind === 'meadow') return liveNPCs().filter(n => n.kind === 'friend').sort((a, b) => Math.abs(a.x - state.x) + Math.abs(a.y - state.y) - Math.abs(b.x - state.x) - Math.abs(b.y - state.y))[0] || null;
  if (map.kind === 'route') return exitTile('next');
  if (map.kind === 'room') { // inside: down the stairs, then out of the door
    const down = map.stairs.find(s => s.dir === 'down'), door = map.doors[0];
    return down ? { exit: 'room', x: down.x, y: down.y, name: '아래층 계단' } : door ? { exit: 'room', x: door.x, y: door.y, name: '문' } : null;
  }
  const role = wantedRole(progress());
  if (!role) return state.zone < 7 ? exitTile('next') : null;
  return liveNPCs().find(n => n.id === role);
}
function nearestNPC() {
  const all = liveNPCs(), dir = state.dir === 'up' ? [0, -1] : state.dir === 'down' ? [0, 1] : state.dir === 'left' ? [-1, 0] : [1, 0];
  return all.filter(n => Math.abs(n.x - state.x) + Math.abs(n.y - state.y) <= 1)
    .sort((a, b) => (a.x === state.x + dir[0] && a.y === state.y + dir[1] ? -1 : 1) - (b.x === state.x + dir[0] && b.y === state.y + dir[1] ? -1 : 1))[0];
}
// v0.82 입체 바위의 모양을 얼마나 확인했는지(에셋 팩 기록) — 추정인 것은 추정이라고 말해요
const LANDMARK_NOTE = { '서도 주민숙소': '실제 시설 · 관찰용 외관(사진 참고 그림, 실측 아님) · 들어갈 수 없어요', '독도 등대': '실제 시설 · 관찰용 외관(사진 참고 그림, 실측 아님) · 들어갈 수 없어요', '보찰바위': '실제 지명 · 바위 모양은 추정(자세한 사진 확인 부족)', '지네바위': '실제 지명(국토지리정보원 고시) · 바위 모양은 게임용(사진 확인 안 함)', '한반도바위': '실제 지명 · 사진 한 장을 참고한 단순한 모양' };
function guide() {
  if (!state.started || busy()) return;
  if (map.diving) { toast('잠수 중이에요. ‘물 위로’(Q)로 올라온 뒤 길을 안내할게요.'); return; } // v0.91 바닷속에선 물 밖으로 길을 내지 않아요
  tutorialEvent('guide');
  const t = targetNPC(); if (!t) { toast('이 지역의 모험을 모두 마쳤어요. 도감을 채우거나 다른 지역을 다시 둘러봐요.'); return; }
  if (t.exit) {
    const sx = moving?.toX ?? state.x, sy = moving?.toY ?? state.y; let p = pathfind(map, sx, sy, t.x, t.y, liveNPCs());
    if (!p.length) p = pathfind(map, sx, sy, t.x, t.y, []); // v0.81 누가 잠깐 길을 막고 있어도 안내는 시작해요(걷다가 막히면 다시 찾아요)
    if (p.length) { path = p; pathAction = null; npcFocus = null; toast(`${josa(t.name, '으로/로')} 가는 길을 안내할게요.`); }
    else toast('가까운 길로 조금 더 이동해 보세요.');
    return;
  }
  moveToNPC(t); toast(`${t.name}에게 가는 길을 안내할게요.`);
}
function moveToNPC(n) {
  if (busy()) return;
  n = liveNPCs().find(p => p.uid === n.uid) || n; npcFocus = n.uid;
  const sx = moving?.toX ?? state.x, sy = moving?.toY ?? state.y, people = liveNPCs();
  const paths = [[0, 1], [1, 0], [-1, 0], [0, -1]].map(([dx, dy]) => { const x = n.x + dx, y = n.y + dy; let path = pathfind(map, sx, sy, x, y, people); if (!path.length) path = pathfind(map, sx, sy, x, y, people.filter(p => p.uid === n.uid)); return { x, y, path }; }) // v0.81 지나가는 사람이 막아도
    .filter(v => v.path.length || (v.x === sx && v.y === sy)).sort((a, b) => a.path.length - b.path.length);
  if (paths.length) { path = paths[0].path; pathAction = () => interact(n); if (!path.length && !moving) { pathAction = null; interact(n); } }
  else toast('가까운 길로 조금 더 이동해 보세요.');
}

// ── talking to people and objects ──────────────────────────────────────────────
function giveItems(give = {}) {
  const parts = [];
  // v0.42: 친구 구슬이 없어져서, 예전 구슬 선물은 회복젤로 받아요.
  const heal = (give.heal || 0) + (give.orb || 0);
  if (heal) { state.items.heal += heal; parts.push(`회복젤 ${heal}개`); }
  if (give.coins) { state.coins += give.coins; parts.push(`조사 코인 ${give.coins}개`); }
  if (parts.length) { toast(`${parts.join(', ')}를 받았어요!`); jingle('item'); }
}
function setFlag(flag) { if (flag) state.flags[flag] = true; labelKey = ''; }
// The person or object right in front of you (not just beside you).
// v0.87 바닷속: 바로 앞(또는 지금 칸)의 바다 생물·바위·물고기
function seabedAhead() {
  if (!map.diving) return null; const [dx, dy] = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[state.dir] || [0, 1], L = seabedLayout(map), t = performance.now() / 1000;
  const hit = it => (it.foot || [[it.x, it.y]]).some(([x, y]) => (x === state.x + dx && y === state.y + dy) || (x === state.x && y === state.y));
  const ok = i => !i.edge && (i.mon || UW_INFO[i.group]), around = it => (it.foot || [[it.x, it.y]]).some(([x, y]) => Math.max(Math.abs(x - state.x), Math.abs(y - state.y)) <= 1); // v0.91 바로 앞이 아니어도 둘레 한 칸(대각선 포함)
  const it = L.items.find(i => ok(i) && hit(i)) || L.items.filter(i => i.mon && around(i))[0] || L.items.find(i => ok(i) && around(i)); if (it) return it.mon ? uwMonInfo(it.mon) : { ...UW_INFO[it.group], group: it.group };
  // 헤엄치는 물고기 우산몬: 실제 자리 또는 화면에 보이는 자리(바닥에서 떠 있는 만큼 북쪽으로 보여요) 가까이면
  const f = L.fish.find(f => { const p = fishAt(f, t), vy = p.y - (f.lift || 0) / 32 * 1.4; return Math.hypot(p.x - state.x, p.y - state.y) < 1.8 || Math.hypot(p.x - state.x, vy - state.y) < 1.6; }); return f ? uwMonInfo(f.mon) : null;
}
// v0.91 잠수 중 가까운 야생·친구 우산몬(바로 앞이면 ahead)
function diveMon() {
  const [dx, dy] = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[state.dir] || [0, 1];
  const list = liveNPCs().filter(n => n.id === 'wild' || n.id === 'friend'), at = (n, x, y) => Math.round(n.drawX ?? n.x) === x && Math.round(n.drawY ?? n.y) === y;
  const a = list.find(n => at(n, state.x + dx, state.y + dy)); if (a) return { n: a, ahead: true };
  const near = list.filter(n => Math.max(Math.abs((n.drawX ?? n.x) - state.x), Math.abs((n.drawY ?? n.y) - state.y)) <= 1.2).sort((p, q) => Math.hypot(p.x - state.x, p.y - state.y) - Math.hypot(q.x - state.x, q.y - state.y))[0];
  return near ? { n: near, ahead: false } : null;
}
// v0.89 바닷속에서 쉬거나 헤엄치는 바다 생물 우산몬: 살펴보면 이름·사는 곳과 그 생물 이야기 · 도감에 ‘본 우산몬’으로
function uwMonInfo(id) {
  const sp = getSpecies(id); if (!sp) return null;
  return { mon: id, group: `mon${id}`, name: sp.name, lines: [`바닷속에서 ${sp.name}${/[가-힣]/.test(sp.name.slice(-1)) && (sp.name.slice(-1).charCodeAt(0) - 44032) % 28 ? '이' : '가'} 쉬고 있어요. 다가가도 싸우지 않아요.`, ...(UW_MON_NOTE[id] ? [UW_MON_NOTE[id]] : []), `${sp.group || '바다 생물'} · ${sp.area || '바다'}. 기록 확인: ${sp.recordStatus}. 모습과 능력은 게임용 창작이에요.`] };
}
function lookSeabed(s) { if (s.mon) { talk(s.name, s.lines, () => { if (!state.seen.includes(s.mon)) state.seen.push(s.mon); const k = `uwm:${s.mon}`; if (!state.flags[k]) { setFlag(k); const n = Object.keys(state.flags).filter(f => f.startsWith('uwm:') && state.flags[f]).length; toast(`바닷속에서 만난 우산몬 ${n}종 · 도감에 적었어요`); } updateUI(); }, '바닷속 우산몬 · 게임용 창작'); return; } talk(s.name, s.lines, () => { const k = `uw:${s.group}`; if (!state.flags[k]) { setFlag(k); const n = Object.keys(UW_INFO).filter(g => state.flags[`uw:${g}`]).length; toast(`바닷속 관찰 ${n} / ${Object.keys(UW_INFO).length}`); } }, UW_NOTE); }
function facingNPC() { const [dx, dy] = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[state.dir] || [0, 1]; return liveNPCs().find(n => n.x === state.x + dx && n.y === state.y + dy) || null; }
function interact(n) {
  if (!n) { // E / ‘대화’: facing a door with nobody right in front of you means going in
    const swimmer = map.diving ? diveMon() : null; // v0.91 잠수 중에도 헤엄치는 야생·친구 우산몬과는 물 위처럼(결투·만나기)
    if (swimmer?.ahead) { n = swimmer.n; } else {
    const sb = !busy() && seabedAhead(); if (sb) { lookSeabed(sb); return; } // v0.87 바닷속 관찰
    const b = !busy() && doorAhead();
    if (b && !facingNPC()) { enterBuilding(b); return; }
    if (map.diving) { if (!swimmer) return; n = swimmer.n; } // 잠수 중엔 바닷속 생물·우산몬만(물 위의 사람·안내판은 안 보여요)
    else { n = nearestNPC(); if (!n) return; } }
  }
  if (busy()) return;
  n = liveNPCs().find(p => p.uid === n.uid) || n; npcFocus = n.uid; npcMotion.face(npcFocus, state);
  const p = progress();
  switch (n.id) {
    case 'history': return talk(n.name, z().history, () => { p.met = true; updateUI(); if (state.zone === 0 && p.studied === 0) toast('탐험 기록판의 노란 표시를 찾아보세요.'); });
    case 'resident': return talk(n.name, [timeTalk(n.name, currentSeason(), isNight()), ...n.lines], null, '마을 주민 · 창작 대화', n.actor); // v0.69: 계절·밤에 맞는 첫인사
    case 'extra': return talk(n.name, [timeTalk(n.name, currentSeason(), isNight()), ...n.lines]);
    case 'guide': return talk('나루', ['나는 나루! 다른 우산몬을 만나면 동료를 바꿔 가며 문제를 풀어 봐.', '키보드가 없어도 화면 속 사람을 누르면 가까이 다가가서 이야기할 수 있어.', '마을 오른쪽 끝의 다리를 건너면 다음 지역으로 가는 길이 이어져. 길을 잃으면 수첩의 ‘목적지 안내’를 눌러 봐!', '…잠깐, 나 방금 누구한테 ‘누르라고’ 한 거지? 하늘 위에 누가 있나…?', '에이, 바닷바람 때문에 헛소리가 나왔나 봐. 못 들은 걸로 해 줘!']);
    case 'prof': return talk('연구 안내원', ['우산몬 도감에서 창작 캐릭터와 실제 생물 모티브를 비교할 수 있어요.', '각 지역의 기록판은 배운 내용과 이전 개념을 다시 확인하는 곳이에요.', '메뉴에서 저장 파일과 학습 기록을 내려받을 수 있어요.', '…메뉴요? 제가 방금 메뉴라고 했나요? 식당도 아닌데.', '연구소에 너무 오래 있었나 봐요. 바닷바람 좀 쐬고 올게요!']);
    case 'board': if (!p.met) return talk('탐험 기록판', ['먼저 이 지역의 인물에게 이야기를 들어 보세요. 자료를 이해할 단서를 얻을 수 있어요.']); return beginStudy('board');
    case 'enemy':
      if (p.studied < 2) return talk(n.name, ['이 기록이 왜 중요한지 알고 있나? 기록판에서 자료를 먼저 확인해 봐!']);
      if (state.zone === 7) { playStory(BOSS_REVEAL).then(() => startBattle('enemy')); return; }
      return talk(n.name, VILLAIN_TALES[state.zone].before, () => startBattle('enemy'), '몽땅랜드 · 창작 대화', n.actor);
    case 'boss':
      if (!p.enemy) return talk(keeperName(z()), ['마을의 기록이 아직 돌아오지 않았어요. 기록판을 조사하고 몽땅랜드의 계획부터 막아 주세요.']);
      if (p.boss) return talk(keeperName(z()), ['인증을 받은 뒤에도 새로운 상황에 배운 내용을 적용해 봐요. 다시 대련하고 싶다면 준비할게요.'], () => startBattle('rematch'));
      return talk(keeperName(z()), ['잘 왔어요. 먼저 여행에서 배운 사실을 하나 확인해 볼까요?', '그다음에는 우산몬과 호흡을 맞춰 봐요. 준비된 동료와 함께 도전하세요!'], () => beginStudy('boss'));
    case 'shop': return showShop();
    case 'shopkeeper': return talk(n.name, n.lines, () => showShop(), '쉼터 · 회복과 준비', n.actor);
    case 'storage': return showStorage(); // (예전 저장 지도 호환) 지금은 동료 메뉴에서 열어요
    case 'dex': return showDex();
    case 'rest': return talk(n.name, ['포근한 자리에서 잠깐 쉬었어요.', '동료들이 모두 기운을 되찾았어요!'], () => { healAll(state); jingle('heal'); updateUI(); save(); }, '쉬어 가기');
    case 'badges': {
      const got = state.badges.slice().sort((a, b) => a - b).map(i => `${ZONES[i].badge}(${ZONES[i].name})`);
      return talk(n.name, got.length ? [`지금까지 받은 인증 ${got.length}개: ${got.join(', ')}`, '인증을 받을 때마다 진열장에 이름이 새겨져요.'] : ['아직 받은 인증이 없어요.', `${keeperName(z())}의 시험을 통과하면 여기에 ‘${z().badge}’ 인증이 새겨져요.`], null, '수호관 · 인증 진열장');
    }
    case 'wild': return startBattle('wild', n.species, { roamer: n.uid });
    case 'friend': return meetFriend(n);
    case 'sign': return talk(n.name, n.lines, () => setFlag(n.flag), '안내판 · 실제 지명 정보');
    case 'landmark': return talk(n.name, n.lines, () => setFlag(n.flag), LANDMARK_NOTE[n.name] || (n.view ? '해돋이·해넘이 보는 곳 · 게임 속 자리' : '실제 지명 · 지도 위 그림은 게임용'), null, hdOn() ? { label: n.view === 'sunrise' ? '🌅 해돋이 보기' : n.view === 'sunset' ? '🌇 해넘이 보기' : '👁 1인칭으로 보기', fn: () => startFirstPerson(n, n.view || 'look') } : null);
    case 'person':
      if (n.give && !n.used) return talk(n.name, n.lines, () => { giveItems(n.give); setFlag(n.flag); }, '길에서 만난 사람 · 창작 대화', n.actor);
      return talk(n.name, n.used && n.after ? n.after : n.lines, () => setFlag(n.flag), '길에서 만난 사람 · 창작 대화', n.actor);
    case 'trash': return talk(n.name, n.lines, () => { setFlag(n.flag); giveItems({ coins: n.coins || 0 }); }, '자연 보호');
    case 'box': if (n.used) return talk(n.name, ['이미 열어 본 조사 상자예요.'], null, '조사 상자'); return talk(n.name, n.lines, () => { giveItems(n.give); setFlag(n.flag); }, '조사 상자');
    case 'observe': {
      const sp = getSpecies(n.species), lines = n.lines.map(l => l.replace('{species}을(를)', josa(sp.name, '을/를')).replace('{species}', sp.name));
      return talk(n.name, [...lines, `기록 확인: ${sp.recordStatus}. 모습과 능력은 게임용 창작이에요.`], () => { if (!state.seen.includes(sp.id)) state.seen.push(sp.id); setFlag(n.flag); updateUI(); }, '관찰 기록');
    }
    case 'stone': return talk(n.name, n.lines, () => beginStudy('stone', null, { flag: n.flag, rewarded: n.used }), '기억 비석 · 복습');
    case 'legend': {
      // 전설의 우산몬은 게임 전체에 한 마리: 한 번 정화해 동료가 되면 다시 나오지 않아요.
      const q = LEGENDS.find(l => l.id === n.species);
      if (n.used || ownsSpecies(state, n.species)) { setFlag(metFlag(n.species)); return talk(n.name, ['금빛 기운이 조용히 사라졌어요.'], null, '전설의 우산몬'); }
      if (!q) return talk(n.name, n.lines, () => startBattle('legend', n.species, { npc: n }), '전설의 우산몬');
      preloadMonsters([q.id, `${q.id}-2`]);
      playStory(legendScene(q)).then(() => startBattle('legend', n.species, { npc: n }));
      return;
    }
    case 'trainer':
      if (n.used) return talk(n.name, n.after || ['다음엔 지지 않을 거야!'], null, '몽땅랜드 · 창작 대화', n.actor);
      return talk(n.name, n.lines, () => startBattle('trainer', null, { npc: n }), '몽땅랜드 · 창작 대화', n.actor);
  }
}

// ── buildings: doors, floors and stairs ────────────────────────────────────────
// A building's door is the middle of its bottom row (both middle columns for even widths).
const doorCols = b => doorColumns(b); // v0.84 문 자리는 world.js 한 곳에서
const enterable = () => [...map.buildings, ...(map.structures || [])]; // v0.75 시가지의 집·가게·터미널도 들어가요
function buildingDoorAt(x, y) { return map.kind === 'town' ? enterable().find(b => y === b.y + b.h - 1 && doorCols(b).includes(x)) : null; }
function doorAhead() { return map.kind === 'town' && state.dir === 'up' ? buildingDoorAt(state.x, state.y - 1) : null; }
function doorFront(b, people = liveNPCs()) { return doorCols(b).map(x => ({ x, y: b.y + b.h })).find(p => !blocked(map, p.x, p.y, people)) || { x: doorCols(b)[0], y: b.y + b.h }; }
let stairHold = false; // after stairs, wait until the stick / keys are let go (no bouncing between floors)
function enterBuilding(b) { sfx('door'); changeMap(roomId(state.zone, b.room || b.kind, 1), 'a', { dir: 'up' }); }
function leaveBuilding() {
  const def = map.def, town = createMap(def.town), b = [...town.buildings, ...(town.structures || [])].find(b => (b.room || b.kind) === def.building);
  const front = b ? doorCols(b).map(x => ({ x, y: b.y + b.h })).find(p => !blocked(town, p.x, p.y)) : null;
  sfx('door'); changeMap(def.town, front ? { ...front, dir: 'down' } : 'a');
}
function useStairs(s) {
  const def = map.def, floor = def.floor + (s.dir === 'up' ? 1 : -1), target = createMap(roomId(def.zone, def.building, floor));
  const land = target.stairs.find(t => t.dir === (s.dir === 'up' ? 'down' : 'up'))?.land || target.spawns.a;
  stairHold = true; sfx('stairs', s.dir === 'up'); changeMap(target.id, { ...land, dir: 'down' });
}

// ── walking, exits and encounters ──────────────────────────────────────────────
function exitLocked(x, y) { return map.exits.get(`${x},${y}`) === 'next' && map.kind === 'town' && !state.badges.includes(state.zone); }
const lockedMessage = () => map.def.island === '울릉도' ? `${keeperName(z())}의 인증을 받으면 독도행 배를 탈 수 있어요.` : `${keeperName(z())}의 인증을 받으면 다리 건너 길이 열려요.`;
function move(dx, dy, now, keepDir = false) {
  if (moving || busy() || Math.abs(dx) + Math.abs(dy) !== 1) return false;
  const nx = state.x + dx, ny = state.y + dy; if (!keepDir) state.dir = dx < 0 ? 'left' : dx > 0 ? 'right' : dy < 0 ? 'up' : 'down';
  if (exitLocked(nx, ny)) { if (!move.warned || now - move.warned > 1500) { toast(lockedMessage()); move.warned = now; } return false; }
  if (dy === -1 && !keepDir) { const b = buildingDoorAt(nx, ny); if (b) { enterBuilding(b); return true; } } // walking up into a door
  const wild = roamers.at(nx, ny); if (wild?.kind === 'friend') return false; if (wild) { path = []; pathAction = null; startBattle('wild', wild.species, { roamer: wild.uid }); return false; } // 걸어 다니는 우산몬과 부딪히면 결투
  if (blocked(map, nx, ny, liveNPCs()) || diveWall(nx, ny)) { if (!move.bumped || now - move.bumped > 380) { sfx('bump'); move.bumped = now; } if (diveWall(nx, ny) && (!move.warned || now - move.warned > 2500)) { toast('물 밖으로 나가려면 먼저 ‘물 위로’(Q)로 올라와요.'); move.warned = now; } return false; }
  moving = { fromX: state.x, fromY: state.y, toX: nx, toY: ny, start: now }; return true;
}
// 한 걸음: 2D에서는 누른 쪽으로, 3D 보기에서는 ‘보는 방향’을 기준으로 앞(W)·왼쪽(A)·뒤(S)·오른쪽(D) 칸으로 걸어요
function step(v, now) {
  if (!in3d()) return move(v[0], v[1], now);
  const [dx, dy] = cameraStep(moveYaw(), v); return move(dx, dy, now);
}
// ── 바람에 날리는 나뭇잎·꽃잎 (v0.64, 건물 밖) ── 시간으로만 자리를 정해서 따로 기억할 것이 없어요.
// ox, oy: 화면이 움직인 만큼(2D는 카메라, 3D는 보는 방향) 함께 밀려서 제자리에 떠 있는 것처럼 보여요.
// v0.69 낮·밤: 새벽·노을은 주황빛, 밤은 짙은 남색을 덮고 내 둘레만 손전등처럼 밝게 남겨요.
let lamp = null, nightCanvas = null;
// v0.71 일출·일몰: 하늘 색(낮 파랑 · 새벽 분홍빛 · 노을 주황 · 밤 남색)과 해·달
const mixHex = (a, b, t) => { const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)), A = p(a), B = p(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
function skyColors() {
  const L = daylight(), dusk = L.hour > 12, warm = dusk ? ['#3c3f80', '#f0846a', '#ffc46e'] : ['#4a5a96', '#ee9fb0', '#ffd49a'], night = ['#16224e', '#24336a', '#3a4c7e'];
  let c = ['#4f9fd6', '#8fcbe6', '#e4f4f6'].map((d, i) => mixHex(d, warm[i], L.warm * .9)); c = c.map((d, i) => mixHex(d, night[i], L.night)); return c;
}
function weatherText() { if (map.diving) return `🫧 바닷속 · ${SEASON_NAME[currentSeason()]} · ${clockLabel()}`; const L = daylight(), w = weatherNow(), sky = w.kind === 'rain' && w.amount > .3 ? '☂ 비' : w.kind === 'snow' && w.amount > .3 ? '❄ 눈' : L.night > .5 ? '☾ 밤' : z().sky; return `${sky} · ${SEASON_NAME[currentSeason()]} · ${clockLabel()}`; }
function paintDaylight(g, K) {
  const L = daylight(); if (L.night < .01 && L.warm < .01) return;
  const w = g.canvas.width, h = g.canvas.height;
  nightCanvas ||= document.createElement('canvas'); if (nightCanvas.width !== w || nightCanvas.height !== h) { nightCanvas.width = w; nightCanvas.height = h; }
  const n = nightCanvas.getContext('2d'); n.setTransform(1, 0, 0, 1, 0, 0); n.globalCompositeOperation = 'source-over'; n.clearRect(0, 0, w, h);
  if (L.warm > .01) { // 새벽은 동쪽(오른쪽)에서, 노을은 서쪽(왼쪽)에서 비치는 주황빛(2D) · 3D는 고르게
    const k = L.warm * (1 - L.night * .6); n.fillStyle = `rgba(255,128,48,${(.11 * k).toFixed(3)})`; n.fillRect(0, 0, w, h);
    if (!in3d()) { const east = L.hour < 12, gr = n.createLinearGradient(east ? w : 0, 0, east ? 0 : w, 0); gr.addColorStop(0, `rgba(255,140,60,${(.3 * k).toFixed(3)})`); gr.addColorStop(.6, 'rgba(255,140,60,0)'); n.fillStyle = gr; n.fillRect(0, 0, w, h); }
  }
  if (L.night > .01) {
    n.fillStyle = `rgba(8,16,54,${(.6 * L.night).toFixed(3)})`; n.fillRect(0, 0, w, h);
    for (const l of nightLamps) { const x = l.x * K, y = l.y * K, r = l.r * K, gr = n.createRadialGradient(x, y, r * .1, x, y, r); gr.addColorStop(0, `rgba(0,0,0,${(.7 * L.night).toFixed(3)})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); n.globalCompositeOperation = 'destination-out'; n.fillStyle = gr; n.fillRect(x - r, y - r, r * 2, r * 2); n.globalCompositeOperation = 'source-over'; } // v0.79 가로등 둘레는 밝게
    if (lamp) { const x = lamp.x * K, y = lamp.y * K, r = lamp.r * K, gr = n.createRadialGradient(x, y, r * .12, x, y, r); gr.addColorStop(0, `rgba(0,0,0,${(.8 * L.night).toFixed(3)})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); n.globalCompositeOperation = 'destination-out'; n.fillStyle = gr; n.fillRect(x - r, y - r, r * 2, r * 2); n.globalCompositeOperation = 'source-over'; }
  }
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.drawImage(nightCanvas, 0, 0); g.restore();
}
// v0.71 바닷속: 깊은 물(얕은 물보다 안쪽)에 들어가면 잠수해요. 푸른 물빛, 일렁이는 빛무늬, 위에서 비치는 빛줄기, 내 둘레에 올라가는 물방울
// v0.72: 저절로 잠수하지 않아요. 물에 있을 때 ‘잠수하기’ 단추(또는 Q)로 들어가고 ‘물 위로’로 나와요. 땅에 오르면 저절로 물 위예요.
// ── v0.84 1인칭 관찰 ──────────────────────────────────────────────────────────
// 대표 바위·자연물 앞에서 말을 다 들으면 ‘1인칭으로 보기’: 그 자리에 서서 내 눈으로 둘러봐요(끌기·방향키·확대).
// 해돋이 보는 곳(동도)·해넘이 보는 곳(서도)에선 해가 수평선에서 뜨고 지는 장면을 봐요(게임 시계는 그대로).
const FP_LOOK = { up: 0, right: Math.PI / 2, down: Math.PI, left: -Math.PI / 2 };
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function startFirstPerson(n, mode = 'look') {
  if (!hdOn() || !glView?.ok) { toast('이 기기에서는 1인칭 보기를 할 수 없어요(그래픽 가속이 필요해요).'); return; }
  if (map.diving) { toast('물 위로 올라와서 볼 수 있어요.'); return; }
  const ex = view.x * TILE + 16, ez = view.y * TILE + 24, eh = glView.groundAt(map, ex, ez) + 44;
  let yaw = FP_LOOK[state.dir] ?? 0, pitch = .03; const lm = mode === 'look' ? glView.landmark?.(n.name) : null;
  if (mode === 'sunrise') yaw = Math.PI / 2 + .2; else if (mode === 'sunset') yaw = -Math.PI / 2 + .12;
  else if (lm) { const dx = lm.x - ex, dz = lm.z - ez, d = Math.hypot(dx, dz) || 1; yaw = Math.atan2(dx, -dz); pitch = Math.max(-.5, Math.min(.3, -Math.atan2(lm.h + lm.top * .4 - eh, d))); }
  fp = { name: n.name, mode, ex, ez, eh, yaw, pitch, fov: mode === 'look' ? 52 : 46, t0: performance.now(), li: 0, lines: n.lines || [], note: LANDMARK_NOTE[n.name] || '', sky: null, phase: '' };
  settleMovement(); keys.clear(); path = []; pathAction = null; sfx('toggle');
  scene.classList.add('fp-on'); fpTick(performance.now()); renderFP();
}
function closeFP() { if (!fp) return; fp = null; scene.classList.remove('fp-on'); $('#fpView')?.remove(); labelKey = ''; sfx('toggle'); }
const fpClampP = p => Math.max(-.75, Math.min(.6, p));
function zoomFP(d) { if (fp) fp.fov = Math.max(22, Math.min(68, fp.fov + d)); }
function nextFP() { if (!fp) return; if (fp.lines.length > 1) { fp.li = (fp.li + 1) % fp.lines.length; const p = $('#fpLine'); if (p) p.textContent = fp.lines[fp.li]; sfx('next'); } }
// 하늘 색·해 방향: 관찰은 지금 게임 시각 그대로, 해돋이·해넘이는 16초 동안 해가 수평선을 지나요
function fpTick(now) {
  const L = daylight();
  if (fp.mode === 'look') { const c = skyColors(), lt = lightFor(L); fp.sky = { zen: c[0], mid: c[1], horizon: c[2], sun: lt.sun, tint: lt.tint, light: Math.max(0, 1 - (L.night || 0)), night: L.night || 0, sunShow: (L.night || 0) < .5, glit: (L.night || 0) < .5, glitCol: [1, .93, .78] }; return; }
  const t = Math.min(1, (now - fp.t0) / 16000), up = fp.mode === 'sunrise', el = up ? -.09 + .3 * t : .21 - .3 * t;
  const sx = (up ? 1 : -1) * Math.cos(el) * .96, sz = (up ? .27 : .18) * Math.cos(el), n3 = Math.hypot(sx, Math.sin(el), sz), sun = [sx / n3, Math.sin(el) / n3, sz / n3];
  const day = smooth(-.08, .2, el), glow = 1 - smooth(.04, .22, el), dark = 1 - smooth(-.1, -.02, el);
  const zen = mixHex(mixHex('#1a2152', '#5a95d0', day), '#121838', dark * .5), mid = mixHex(mixHex('#5d4a8a', '#a6cde6', day), up ? '#e8907a' : '#e07a62', glow * .55);
  const horizon = mixHex(mixHex('#3c3a66', up ? '#ff9a52' : '#ff7a46', smooth(-.1, -.03, el)), '#ffe2b0', smooth(.04, .22, el));
  const tint = [1, .97, .92].map((v, i) => v + ([1.28, .84, .62][i] - v) * glow * (1 - dark * .6) + ([.55, .55, .8][i] - v) * dark * .7);
  fp.sky = { zen, mid, horizon, sun, tint, light: smooth(-.06, .12, el), night: dark * .5, sunShow: true, el, glit: el > -.03, glitCol: [1, .62 + .3 * day, .35 + .45 * day] };
  const ph = up ? (el < -.012 ? '동쪽 하늘이 붉게 물들어요' : el < .02 ? '해가 수평선 위로 고개를 내밀어요' : el < .1 ? '바다 위로 반짝이는 햇빛 길이 생겨요' : '해가 떠올랐어요. 독도의 아침이에요')
    : (el > .12 ? '해가 서쪽 바다로 기울어요' : el > .03 ? '바다가 금빛으로 물들어요' : el > -.02 ? '해가 수평선 너머로 들어가요' : '노을이 남은 하늘 · 독도의 저녁이에요');
  if (ph !== fp.phase) { fp.phase = ph; const e = $('#fpPhase'); if (e) e.textContent = ph; }
}
// 하늘(장면 뒤 2D 그림): 위에서 수평선까지 색 띠 · 해 둘레 빛 · 도트 해 · 구름 줄 · 해넘이엔 울릉도 그림자
function paintFPSky(g, V) {
  const W = sceneWidth, H = sceneHeight, S = fp.sky, far = 9000, ex = fp.ex, ez = fp.ez, eh = fp.eh;
  const fx = Math.sin(fp.yaw), fz = -Math.cos(fp.yaw), hz = V.project(ex + fx * far, ez + fz * far, 0), hy = hz ? Math.max(-H, Math.min(H * 2, hz.y)) : H * .5;
  const gr = g.createLinearGradient(0, Math.min(hy - H * 1.2, 0), 0, hy); gr.addColorStop(0, S.zen); gr.addColorStop(.62, S.mid); gr.addColorStop(1, S.horizon);
  g.fillStyle = gr; g.fillRect(0, 0, W, H); g.fillStyle = S.horizon; if (hy < H) g.fillRect(0, Math.max(0, hy), W, H);
  const at = (dx, dy, dz) => V.project(ex + dx * far, ez + dz * far, eh + dy * far);
  g.save(); g.beginPath(); g.rect(0, 0, W, Math.max(0, hy + 1)); g.clip();
  if (fp.mode === 'sunset') { // 울릉도: 서북서 87.4km(높이 984m) — 수평선 위 낮은 그림자
    const a0 = Math.atan2(-.36, -.93); let pts = [];
    for (let i = 0; i <= 12; i++) { const a = a0 - .055 + i * .0092, hh = Math.sin(i / 12 * Math.PI) ** .8 * .0105 + (i === 6 ? .0012 : 0); const p = at(Math.cos(a), hh, Math.sin(a)); if (p) pts.push(p); }
    if (pts.length > 2) { g.fillStyle = mixHex(S.horizon, '#3b3550', .55); g.beginPath(); g.moveTo(pts[0].x, hy + 1); for (const p of pts) g.lineTo(p.x, p.y); g.lineTo(pts.at(-1).x, hy + 1); g.fill(); const top = pts[6]; if (top && top.x > 0 && top.x < W) { g.fillStyle = 'rgba(255,250,235,.85)'; g.font = `bold ${Math.round(11 + H / 90)}px ${getComputedStyle(document.body).fontFamily}`; g.textAlign = 'center'; g.fillText('울릉도 (87.4km)', top.x, top.y - 10); } }
  }
  const sp = S.sunShow && S.sun[1] > -.12 ? at(S.sun[0], S.sun[1], S.sun[2]) : null;
  if (sp) { const R = Math.max(4, H * .028 * (50 / fp.fov)), low = 1 - smooth(.02, .2, S.sun[1]);
    const gl2 = g.createRadialGradient(sp.x, sp.y, R, sp.x, sp.y, H * (.28 + .2 * low)); gl2.addColorStop(0, `rgba(255,${200 - 50 * low | 0},${150 - 70 * low | 0},${.55 + .3 * low})`); gl2.addColorStop(1, 'rgba(255,160,90,0)'); g.fillStyle = gl2; g.fillRect(0, 0, W, H);
    g.imageSmoothingEnabled = false; g.fillStyle = mixHex('#fff4cf', '#ff8a3c', low * .8); g.beginPath(); g.arc(Math.round(sp.x), Math.round(sp.y), R, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,255,240,.9)'; g.beginPath(); g.arc(Math.round(sp.x - R * .2), Math.round(sp.y - R * .2), R * .55, 0, Math.PI * 2); g.fill(); }
  // 구름 줄: 세계에 고정(둘러보면 같이 돌아요), 해 쪽은 아랫면이 빛나요
  for (let i = 0; i < 14; i++) { const a = i * .45 + (i % 3) * .11, e = .035 + (i % 4) * .028, p = at(Math.cos(a), e, Math.sin(a)); if (!p || p.y > hy) continue;
    const w = (40 + (i * 37) % 70) * (50 / fp.fov) * H / 480, h = Math.max(2, Math.round(w * .08)), lit = S.sun ? Math.max(0, Math.cos(a) * S.sun[0] + Math.sin(a) * S.sun[2]) : 0;
    g.fillStyle = mixHex(mixHex(S.mid, '#ffffff', .35), '#ffb37a', lit * (1 - smooth(.05, .25, S.sun[1])) * .8); g.globalAlpha = .55 + .25 * lit; g.fillRect(Math.round(p.x - w / 2), Math.round(p.y), Math.round(w), Math.round(h)); g.fillRect(Math.round(p.x - w * .3), Math.round(p.y - h), Math.round(w * .55), Math.round(h)); g.globalAlpha = 1; }
  g.restore();
}
function renderFP() {
  let el = $('#fpView'); if (!el) { el = document.createElement('div'); el.id = 'fpView'; scene.append(el); bindFP(el); }
  const sun = fp.mode !== 'look', tag = fp.mode === 'sunrise' ? '🌅 해돋이' : fp.mode === 'sunset' ? '🌇 해넘이' : '👁 1인칭 관찰';
  el.className = 'fp-view' + (sun ? ' fp-sun' : '');
  el.innerHTML = `<div class="fp-top"><span class="fp-tag">${tag}</span><strong>${esc(fp.name)}</strong>${fp.note ? `<small>${esc(fp.note)}</small>` : ''}</div>
    <div class="fp-cap">${sun ? `<b id="fpPhase">${esc(fp.phase)}</b>` : ''}<p id="fpLine">${esc(fp.lines[fp.li] || '')}</p>
    <div class="fp-ctl"><button data-fp="zout" aria-label="넓게 보기">－</button><button data-fp="zin" aria-label="가깝게 보기">＋</button>${fp.lines.length > 1 ? '<button data-fp="next">다음 이야기 ▸</button>' : ''}${sun ? '<button data-fp="again">다시 보기 ↺</button>' : ''}<button data-fp="close" class="fp-close">돌아가기 ✕</button></div>
    <small class="fp-hint">끌어서 둘러보기 · 방향키 · 휠·＋－로 확대 · Esc 돌아가기</small></div>`;
}
function bindFP(el) {
  let drag = null;
  el.addEventListener('pointerdown', e => { if (!fp || e.target.closest('button')) return; drag = { x: e.clientX, y: e.clientY, yaw: fp.yaw, pitch: fp.pitch }; el.setPointerCapture?.(e.pointerId); });
  el.addEventListener('pointermove', e => { if (!fp || !drag) return; const k = fp.fov / 52 * .0055; fp.yaw = drag.yaw - (e.clientX - drag.x) * k; fp.pitch = fpClampP(drag.pitch - (e.clientY - drag.y) * k); });
  const end = () => { drag = null; }; el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  el.addEventListener('wheel', e => { if (!fp) return; e.preventDefault(); zoomFP(e.deltaY > 0 ? 4 : -4); }, { passive: false });
  el.addEventListener('click', e => { const b = e.target.closest('[data-fp]'); if (!b || !fp) return; const a = b.dataset.fp;
    if (a === 'close') closeFP(); else if (a === 'zin') zoomFP(-6); else if (a === 'zout') zoomFP(6); else if (a === 'next') nextFP(); else if (a === 'again') { fp.t0 = performance.now(); sfx('select'); } });
}
window.addEventListener('keydown', e => { // 1인칭일 때는 걷기 대신 둘러보기(먼저 받아요)
  if (!fp) return; const k = e.code; let used = true;
  if (k === 'ArrowLeft' || k === 'KeyA') fp.yaw -= .08; else if (k === 'ArrowRight' || k === 'KeyD') fp.yaw += .08;
  else if (k === 'ArrowUp' || k === 'KeyW') fp.pitch = fpClampP(fp.pitch - .06); else if (k === 'ArrowDown' || k === 'KeyS') fp.pitch = fpClampP(fp.pitch + .06);
  else if (k === 'Equal' || k === 'NumpadAdd') zoomFP(-6); else if (k === 'Minus' || k === 'NumpadSubtract') zoomFP(6);
  else if (k === 'Escape' || k === 'KeyQ' || k === 'Backspace') closeFP(); else if (k === 'Enter' || k === 'Space' || k === 'KeyE') nextFP(); else used = false;
  if (used) { e.preventDefault(); e.stopImmediatePropagation(); }
}, true);
let diveWanted = false;
function inWater() { if (map.kind === 'room') return false; return map[Math.round(view.y)]?.[Math.round(view.x)] === 0; }
function deepWater() { if (!inWater() || map.diving) return false; return !map.shallow?.has(`${Math.round(view.x)},${Math.round(view.y)}`); } // v0.82 깊은 물: 헤엄쳐요(조금 느리게)
// v0.91 잠수 중엔 물 밖(땅·부두·물가)이 벽처럼 막혀요 — 물 위로 올라오는 건 ‘물 위로’(Q)로만
function diveWall(x, y) { return !!map.diving && map.kind !== 'room' && map[y]?.[x] !== 0; }
function isDiving() { if (!inWater()) diveWanted = false; return diveWanted; }
function toggleDive() { if (!inWater() || busy() || battle) return; diveWanted = !diveWanted; sfx('toggle'); }
function updateDiveButton() { const b = $('#diveBtn'), show = inWater() && !battle && state.started; b.classList.toggle('hidden', !show); if (!show) return; assetImage(UW_ATLAS.key); assetImage(UW_FLOOR.key); assetImage('scenery/uw-walls'); assetImage('monsters/dots'); /* v0.87 물에 들어가면 바닷속 그림을 미리 불러요 */ const label = map.diving ? '⬆ 물 위로' : '🫧 잠수하기'; if (b.dataset.label !== label) { b.dataset.label = label; b.innerHTML = `${label} <small>Q</small>`; b.setAttribute('aria-label', label); } b.classList.toggle('down', !!map.diving); }
$('#diveBtn').onclick = e => { toggleDive(); e.currentTarget.blur(); };
function paintUnderwater(g, K, now) {
  const t = now / 1000, w = sceneWidth, h = sceneHeight;
  g.save(); g.setTransform(K, 0, 0, K, 0, 0);
  const hd = hdOn(); g.fillStyle = hd ? 'rgba(14,92,138,.2)' : 'rgba(14,92,138,.36)'; g.fillRect(0, 0, w, h); // v0.87 HD-2D 바닷속은 조금 더 밝고 멀리 보여요(안개는 WebGL이)
  if (lamp) { const r0 = (hd ? 5 : 3) * TILE, r1 = (hd ? 15 : 9) * TILE, gr = g.createRadialGradient(lamp.x, lamp.y, r0, lamp.x, lamp.y, r1); gr.addColorStop(0, 'rgba(8,46,74,0)'); gr.addColorStop(1, hd ? 'rgba(8,46,74,.55)' : 'rgba(8,46,74,.9)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); } // 2D: 물속에선 멀리 안 보여요
  for (let i = 0; i < 5; i++) { const x = ((i * 211 + t * 14) % (w + 200)) - 100, gr = g.createLinearGradient(x, 0, x + 60, h); gr.addColorStop(0, 'rgba(210,245,255,.16)'); gr.addColorStop(1, 'rgba(210,245,255,0)'); g.fillStyle = gr; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 34, 0); g.lineTo(x + 110, h); g.lineTo(x + 50, h); g.closePath(); g.fill(); } // 빛줄기
  g.fillStyle = 'rgba(220,250,255,.09)'; // 일렁이는 빛무늬
  for (let i = 0; i < 46; i++) { const cx = ((i * 97) % w) + Math.sin(t * 1.3 + i) * 12, cy = ((i * 53) % h) + Math.cos(t * 1.1 + i * 1.7) * 9, r = 10 + (i % 5) * 4; g.beginPath(); g.ellipse(cx, cy, r, r * .45, Math.sin(t + i) * .5, 0, Math.PI * 2); g.fill(); }
  if (lamp) { g.strokeStyle = 'rgba(235,252,255,.75)'; g.lineWidth = 1; for (let i = 0; i < 9; i++) { const life = (t * .7 + i / 9) % 1, bx = lamp.x + Math.sin(t * 3 + i * 2) * 6 + (i % 3 - 1) * 5, by = lamp.y - life * 70, r = 1.5 + (i % 3); g.globalAlpha = 1 - life; g.beginPath(); g.arc(bx, by, r, 0, Math.PI * 2); g.stroke(); } g.globalAlpha = 1; } // 물방울
  g.restore();
}
function paintWind(g, now, K, ox = 0, oy = 0) {
  const wind = seasonWind(), cols = wind.colors, wx = weatherNow(); // v0.68: 봄 꽃잎 · 여름 잎 · 가을 단풍잎 · 겨울 눈송이
  // v0.70 날씨: 비가 오면 날리는 잎·꽃잎이 줄고, 눈이 오면 눈송이가 펑펑(크게) 내려요
  const more = wx.kind === 'snow' ? 1 + 3.2 * wx.amount : wx.kind === 'rain' ? 1 - .7 * wx.amount : 1;
  const t = now / 1000, Wd = sceneWidth + 60, Hd = sceneHeight + 60, n = Math.round(Math.min(34, Math.max(14, sceneWidth * sceneHeight / 26000)) * (wind.count || 1) * more);
  const h = (i, k) => { const v = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return v - Math.floor(v); }, mod = (a, m) => ((a % m) + m) % m;
  g.save(); g.setTransform(K, 0, 0, K, 0, 0);
  for (let i = 0; i < n; i++) {
    const sp = (26 + h(i, 1) * 46) * wind.speed, fall = (9 + h(i, 2) * 20) * wind.fall, ph = h(i, 3) * 6.28;
    const x = mod(h(i, 4) * Wd + t * sp + ox, Wd) - 30, y = mod(h(i, 5) * Hd + t * fall + Math.sin(t * 1.6 + ph) * 9 + oy, Hd) - 30;
    const flip = Math.sin(t * (3 + h(i, 6) * 3) + ph), s = 2 + (i % 3 === 0 ? 1 : 0) + (wx.kind === 'snow' ? (i % 3 === 0 ? 2 : 1) : 0);
    g.globalAlpha = .55 + .4 * Math.abs(flip); g.fillStyle = cols[i % cols.length];
    g.fillRect(Math.round(x), Math.round(y), flip > 0 ? s + 1 : s, flip > 0 ? s : s + 1);
  }
  g.restore();
  if (wx.kind === 'rain' && wx.amount > .01) paintRain(g, now, K, wx.amount, ox, oy);
}
// v0.70 비: 비스듬히 떨어지는 빗줄기와 땅에 튀는 물방울, 하늘이 조금 어두워져요
function paintRain(g, now, K, amount, ox = 0, oy = 0) {
  const t = now / 1000, Wd = sceneWidth + 80, Hd = sceneHeight + 80, n = Math.round(Math.min(160, sceneWidth * sceneHeight / 4200) * amount);
  const h = (i, k) => { const v = Math.sin(i * 91.7 + k * 271.3) * 43758.5453; return v - Math.floor(v); }, mod = (a, m) => ((a % m) + m) % m;
  g.save(); g.setTransform(K, 0, 0, K, 0, 0);
  g.fillStyle = `rgba(52,70,98,${(.16 * amount).toFixed(3)})`; g.fillRect(0, 0, sceneWidth, sceneHeight);
  g.strokeStyle = 'rgba(206,222,252,.82)'; g.lineWidth = 1.4; g.beginPath();
  for (let i = 0; i < n; i++) {
    const sp = 520 + h(i, 1) * 260, len = 12 + h(i, 2) * 12;
    const x = mod(h(i, 3) * Wd + t * sp * .22 + ox * .3, Wd) - 40, y = mod(h(i, 4) * Hd + t * sp + oy * .3, Hd) - 40;
    g.moveTo(Math.round(x), Math.round(y)); g.lineTo(Math.round(x - len * .22), Math.round(y - len));
  }
  g.stroke();
  g.fillStyle = 'rgba(225,238,255,.55)'; // 물방울 튀기: 짧게 깜빡이는 작은 고리
  for (let i = 0; i < n / 3; i++) { const life = (t * 3 + h(i, 5)) % 1; if (life > .35) continue; const x = h(i, 6 + Math.floor(t * 3 + h(i, 5))) * sceneWidth, y = h(i, 9 + Math.floor(t * 3 + h(i, 5))) * sceneHeight; const r = 1 + life * 6; g.fillRect(Math.round(x - r), Math.round(y), Math.round(r * 2), 1); }
  g.restore();
}
// ── 자유 걷기 (v0.63, 3D 보기) ── 칸에 얽매이지 않고 보는 방향으로 부드럽게 걸어요.
// 내 자리는 freePos(칸 단위 소수)로 두고, 반올림한 칸을 state.x·y 로 삼아요. 칸이 바뀌면 landed()가 나가는 길·문·계단을 살펴요.
// 몸은 반지름 FREE_R 칸의 네모로 보고, 가로·세로를 따로 움직여서 벽을 따라 미끄러져요.
let freePos = null, freeWalking = false, freeStuck = 0; const walkKeys = new Set(), FREE_R = .3;
function freeXY() { if (!freePos || Math.round(freePos.x) !== state.x || Math.round(freePos.y) !== state.y) freePos = { x: state.x, y: state.y }; return freePos; }
const touchedTiles = (x, y) => { const t = new Set(); for (const ox of [-FREE_R, FREE_R]) for (const oy of [-FREE_R, FREE_R]) t.add(`${Math.round(x + ox)},${Math.round(y + oy)}`); return t; };
// (ox, oy) → (nx, ny)로 갈 때 새로 닿는 칸이 막혔는지. 닿은 것이 문이면 들어가고, 사나워진 우산몬이면 결투가 시작돼요.
function freeBlocked(ox, oy, nx, ny, vy, now) {
  const was = touchedTiles(ox, oy), people = liveNPCs();
  for (const key of touchedTiles(nx, ny)) {
    if (was.has(key)) continue; const [tx, ty] = key.split(',').map(Number);
    if (exitLocked(tx, ty)) { if (!move.warned || now - move.warned > 1500) { toast(lockedMessage()); move.warned = now; } return true; }
    if (vy < -.3 && tx === Math.round(nx)) { const b = buildingDoorAt(tx, ty); if (b) { enterBuilding(b); return true; } }
    const wild = roamers.at(tx, ty); if (wild?.kind === 'friend') return true;
    if (wild) { path = []; pathAction = null; startBattle('wild', wild.species, { roamer: wild.uid }); return true; }
    if (blocked(map, tx, ty, people) || diveWall(tx, ty)) return true;
  }
  return false;
}
// (vx, vy): 지도 위에서 갈 방향(길이 1 이하). 움직였으면 true
function freeWalk(vx, vy, dt, now) {
  const p = freeXY(), sp = dt / MOVE_DURATION * (deepWater() ? .6 : 1), ox = p.x, oy = p.y, nx = ox + vx * sp, ny = oy + vy * sp;
  state.dir = Math.abs(vx) > Math.abs(vy) ? (vx > 0 ? 'right' : 'left') : (vy > 0 ? 'down' : 'up');
  if (vx && !freeBlocked(ox, oy, nx, oy, vy, now)) p.x = nx; if (battle || transition || busy()) return false;
  if (vy && !freeBlocked(p.x, oy, p.x, ny, vy, now)) p.y = ny; if (battle || transition || busy()) { p.x = ox; p.y = oy; return false; }
  const d = Math.hypot(p.x - ox, p.y - oy);
  if (d < 1e-5) { if (!move.bumped || now - move.bumped > 380) { sfx('bump'); move.bumped = now; } return false; }
  walkDistance += d * 32; freeWalking = true; view = { x: p.x, y: p.y };
  const tx = Math.round(p.x), ty = Math.round(p.y); if (tx !== state.x || ty !== state.y) { state.x = tx; state.y = ty; landed(); }
  return true;
}
// 걷기의 한 프레임. 2D: 방향키·W A S D·조이스틱이 누른 쪽 그대로. 3D 보기: W A S D·조이스틱이 보는 방향 기준(방향키는 둘러보기).
// 눌러서 정한 길(path)은 칸 가운데를 따라 걸어요.
function freeFrame(dt, now) {
  const jv = joystick.vector, has = (...c) => c.some(k => walkKeys.has(k)) ? 1 : 0, d3 = in3d(); let ix = 0, iy = 0;
  if (jv) { const m = Math.hypot(jv.x, jv.y), k = Math.max(.55, m) / (m || 1); ix = jv.x * k; iy = jv.y * k; }
  else if (d3) { ix = has('KeyD') - has('KeyA'); iy = has('KeyS') - has('KeyW'); }
  else { ix = has('KeyD', 'ArrowRight') - has('KeyA', 'ArrowLeft'); iy = has('KeyS', 'ArrowDown') - has('KeyW', 'ArrowUp'); }
  if (stairHold) { if (!ix && !iy) stairHold = false; return; } // 계단을 오르내린 뒤에는 손을 한 번 뗐다가 걸어요
  if (ix || iy) {
    path = []; pathAction = null; pathRetry = 0;
    const l = Math.hypot(ix, iy), k = l > 1 ? 1 / l : 1; ix *= k; iy *= k;
    if (!d3) { freeWalk(ix, iy, dt, now); return; }
    const my = moveYaw(), sn = Math.sin(my), cs = Math.cos(my);
    freeWalk(cs * ix - sn * iy, sn * ix + cs * iy, dt, now); return;
  }
  if (path.length) {
    const [tx, ty] = path[0], p = freeXY(), dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
    if (d <= Math.max(.04, dt / MOVE_DURATION)) {
      if ((blocked(map, tx, ty, liveNPCs()) || diveWall(tx, ty)) && (tx !== state.x || ty !== state.y)) { pathBlocked(); return; }
      walkDistance += d * 32; freeWalking = d > 1e-4; p.x = tx; p.y = ty; view = { x: tx, y: ty }; path.shift(); freeStuck = 0;
      if (tx !== state.x || ty !== state.y) { state.x = tx; state.y = ty; landed(); }
    } else if (freeWalk(dx / d, dy / d, dt, now)) freeStuck = 0;
    else if ((freeStuck += dt) > 500) pathBlocked();
    return;
  }
  if (pathAction) { const fn = pathAction; pathAction = null; pathRetry = 0; fn(); }
}
// 가던 길이 막혔을 때(지나가던 사람이 길을 막음): 누군가에게 가던 중이면 길을 다시 찾아요(여섯 번까지)
let pathRetry = 0;
function pathBlocked() {
  const uid = npcFocus, had = !!pathAction; path = []; pathAction = null; freeStuck = 0;
  if (!had || !uid || ++pathRetry > 6) { pathRetry = 0; return; }
  const n = liveNPCs().find(p => p.uid === uid); if (n) moveToNPC(n);
}
window.addEventListener('keydown', e => { if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code) && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) { if (!walkKeys.has(e.code)) freshKeys.add(e.code); walkKeys.add(e.code); liftedKeys.delete(e.code); } });
// 아주 짧게 톡 친 키(한 프레임도 지나기 전에 뗀 키)도 한 프레임은 눌린 것으로 쳐요. 이미 한 프레임 넘게 누른 키는 떼는 즉시 지워요.
const liftedKeys = new Set(), freshKeys = new Set();
window.addEventListener('keyup', e => { if (freshKeys.has(e.code)) liftedKeys.add(e.code); else walkKeys.delete(e.code); }); window.addEventListener('blur', () => { walkKeys.clear(); liftedKeys.clear(); freshKeys.clear(); });
function flushLiftedKeys() { for (const k of liftedKeys) walkKeys.delete(k); liftedKeys.clear(); freshKeys.clear(); }
function arrive() {
  if (!moving) return;
  state.x = moving.toX; state.y = moving.toY; view = { x: state.x, y: state.y }; moving = null; landed();
}
// 새 칸에 닿았을 때: 나가는 길·문·계단을 살펴요(한 칸 걷기와 자유 걷기가 함께 써요)
function landed() {
  walks++; tutorialEvent('walk');
  if (walks % 10 === 0) save();
  const exit = map.exits.get(`${state.x},${state.y}`);
  if (exit) { const to = exit === 'next' ? nextMapId(map.id) : prevMapId(map.id), key = exit === 'next' ? 'a' : 'z'; if (crossesSea(map.id, to)) takeFerry(to, key); else changeMap(to, key); return; }
  if (map.kind === 'room') {
    if (map.doors.some(d => d.x === state.x && d.y === state.y)) { leaveBuilding(); return; }
    const s = map.stairs.find(s => s.x === state.x && s.y === state.y); if (s) { useStairs(s); return; }
  }
  // v0.43: 풀숲을 걸어도 갑자기 나타나지 않아요. 야생 우산몬은 길 위에서 걸어 다녀요(roamers.js).
}
async function changeMap(id, spawnKey = 'a', { heal = false, instant = false, dir = null } = {}) {
  if (fp) closeFP(); // v0.86 지도를 옮기면 1인칭 보기는 닫아요
  if (!id || transition) return;
  transition = true; settleMovement(); path = []; pathAction = null; keys.clear();
  if (!instant) { scene.classList.add('map-fading'); await wait(260); }
  const def = getMapDef(id);
  state.map = def.id; state.zone = def.zone; map = createMap(def.id);
  const spot = typeof spawnKey === 'object' ? spawnKey : map.spawns[spawnKey] || map.spawns.a; state.x = spot.x; state.y = spot.y; view = { x: spot.x, y: spot.y };
  state.dir = dir || spot.dir || (spawnKey === 'z' ? 'left' : 'right');
  npcMotion.reset(); npcFocus = null; labelKey = ''; walks = 0; lastEncounter = 0;
  if (heal) healAll(state);
  const first = def.kind === 'town' && !state.visited.includes(def.zone);
  if (first) state.visited = [...state.visited, def.zone].sort((a, b) => a - b);
  updateUI(); save();
  if (!instant) { await wait(80); scene.classList.remove('map-fading'); }
  transition = false; yaw = null; showPlaceBanner(def);
  if (first && def.zone > 0) { await playStory(arrivalScene(def.zone, ZONES[def.zone], def)); updateUI(); }
}

// 지도 화면을 누르면 그곳으로 걸어가요(사람을 누르면 말 걸기, 건물을 누르면 문으로 가서 들어가요)
canvas.addEventListener('pointerdown', e => { if (busy()) return; tapAt(e); });
function tapAt(e) {
  const bounds = canvas.getBoundingClientRect();
  const hit = fromScreen((e.clientX - bounds.left) * sceneWidth / bounds.width, (e.clientY - bounds.top) * sceneHeight / bounds.height); if (!hit) return;
  const tx = Math.floor(hit.x / 32), ty = Math.floor(hit.y / 32);
  const people = liveNPCs(), n = people.find(n => Math.abs((n.drawX ?? n.x) - tx) <= .65 && Math.abs((n.drawY ?? n.y) - ty) <= 1);
  if (n) { moveToNPC(n); return; }
  const b = map.kind === 'town' && enterable().find(b => tx >= b.x && tx < b.x + b.w && ty >= b.y - 1 && ty < b.y + b.h);
  if (b) { // tap a building: walk to its door and go in
    const f = doorFront(b, people), sx = moving?.toX ?? state.x, sy = moving?.toY ?? state.y;
    if (sx === f.x && sy === f.y) { if (!moving) enterBuilding(b); else { path = []; pathAction = () => enterBuilding(b); } return; }
    const p = pathfind(map, sx, sy, f.x, f.y, people); if (p.length) { path = p; pathAction = () => enterBuilding(b); }
    return;
  }
  const next = pathfind(map, moving?.toX ?? state.x, moving?.toY ?? state.y, tx, ty, people);
  if (next.length) { path = next; pathAction = null; }
  canvas.focus({ preventScroll: true });
}
const vectors = KEY_VECTORS;
// v0.71: 위쪽 단추(소리·저장·3D·전체 화면·메뉴)와 아래 탐험 메뉴는 누르고 나면 손을 떼요(포커스 해제).
//        그래야 주황 테두리가 남지 않고, 스페이스·엔터가 그 단추를 또 누르지 않고 게임(말 걸기)으로 가요.
//        Tab 키로 옮겨 가서 누른 경우(e.detail 0)는 그대로 두어 키보드로도 쓸 수 있어요.
const HUD_BUTTONS = '.hud-actions button, .game-dock button';
document.addEventListener('click', e => { const b = e.target.closest?.(HUD_BUTTONS); if (b && e.detail !== 0) setTimeout(() => { if (document.activeElement === b) b.blur(); }, 0); }, true);
window.addEventListener('keydown', e => {
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
  if (cutscenes.active()) { cutscenes.handleKey(e); return; }
  if (e.key === 'Escape' && !$('#modal').classList.contains('hidden')) { closeModal(); return; }
  if (e.key === 'Tab' && !$('#modal').classList.contains('hidden')) {
    const f = $$('#modal button:not(:disabled),#modal a,#modal input');
    if (f.length) { if (e.shiftKey && document.activeElement === f[0]) { f.at(-1).focus(); e.preventDefault(); } else if (!e.shiftKey && document.activeElement === f.at(-1)) { f[0].focus(); e.preventDefault(); } }
    return;
  }
  if (battle) { battleUI.handleKey(e); return; }
  if (vectors[e.key]) { e.preventDefault(); if (!e.repeat) keys.press(e.key, performance.now()); path = []; pathAction = null; }
  if ((e.key === 'q' || e.key === 'Q') && !e.repeat && $('#modal').classList.contains('hidden') && !dialogueState) { toggleDive(); return; } // v0.72 잠수·물 위로
  if (['e', 'E', ' ', 'Enter'].includes(e.key) && !e.repeat) {
    if (!$('#modal').classList.contains('hidden')) return;
    if (document.activeElement?.tagName === 'BUTTON' && !dialogueState) return;
    e.preventDefault(); if (dialogueState) nextTalk(); else interact();
  }
});
window.addEventListener('keyup', e => { keys.release(e.key); }); window.addEventListener('blur', () => { keys.clear(); });
// 가상 조이스틱: 누른 채로 밀면 그쪽으로 한 칸씩 걸어요. 대각선으로 밀면 막힌 쪽 대신 다른 쪽으로 미끄러지듯 걸어요.
const joystick = createJoystick($('#joystick'), dir => { if (dir) { path = []; pathAction = null; } });
const lookStick = createLookStick($('#lookStick'));
window.addEventListener('blur', () => { joystick.reset(); lookStick.reset(); });
$('#interactBtn').onclick = () => dialogueState ? nextTalk() : interact();

function frame(now) {
  let keyDir = null;
  const dt = Math.max(0, Math.min(now - lastTick, 100)); lastTick = now;
  if (state.started && !document.hidden) state.playMs += dt;
  { const d = isDiving(); if (d !== !!map.diving) { map.diving = d; scene.classList.toggle('diving', d); labelKey = ''; if (d && !frame.dived) { frame.dived = true; toast('🫧 바닷속으로 잠수했어요! 생물 앞에서 E로 살펴보고, ‘물 위로’(Q)로 올라와요.'); } frame.clockText = ''; } if (now - (frame.diveAt || 0) > 150) { frame.diveAt = now; updateDiveButton(); } } // v0.72 잠수는 단추로
  // v0.69 게임 시계: 결투·컷신·타이틀 화면에서는 멈춰요. 계절이 바뀌면 알려 주고, 시각은 위치 칸에 보여요.
  if (state.started && !document.hidden && !battle && !cutscenes.active() && titleEl.classList.contains('hidden')) {
    const ev = clockTick(dt); if (ev?.season) { toast(`${SEASON_ICON[ev.season]} ${SEASON_NAME[ev.season]}이 왔어요.`); sfx('toggle'); }
    if (now - (frame.clockAt || 0) > 400) { frame.clockAt = now; const t = weatherText(); if (t !== frame.clockText) { frame.clockText = t; $('#weather').textContent = t; } }
  }
  if (!pathAction && !dialogueState && !busy()) npcFocus = null;
  const baseNPCs = npcs(map, progress(), state.flags); npcMotion.sync(map.id, baseNPCs);
  npcMotion.update(baseNPCs, map, { dt, player: { x: state.x, y: state.y, toX: moving?.toX, toY: moving?.toY }, paused: busy() || document.hidden, holdKey: npcFocus, route: path });
  if (state.started) { const people = npcMotion.snapshot(baseNPCs), me = { x: state.x, y: state.y, toX: moving?.toX, toY: moving?.toY }; roamers.sync(map, people, me, now); roamers.update(map, people, me, now, busy() || document.hidden); }
  let nextStart = now;
  if (moving) { const result = moveView(view, moving, now); walkDistance += result.distance; if (result.complete) { nextStart = Math.max(moving.start + MOVE_DURATION, now - MOVE_DURATION); arrive(); } }
  freeWalking = false;
  if (!moving && !busy()) freeFrame(dt, now); // v0.63: 2D·3D 모두 칸에 얽매이지 않고 걸어요
  flushLiftedKeys();
  // Render any residual part of the next tile in the same frame, avoiding a pause at tile edges.
  if (moving) { const result = moveView(view, moving, now); walkDistance += result.distance; if (result.complete) arrive(); }
  if (!cutscenes.active() && !battle) {
    const walking = (!!moving || freeWalking) && !busy(), people = liveNPCs();
    const target = path.length ? { x: path.at(-1)[0], y: path.at(-1)[1] } : null, motion = { walking, distance: walkDistance }, K = sceneScale * actorPixelRatio;
    actorCtx.setTransform(1, 0, 0, 1, 0, 0); actorCtx.clearRect(0, 0, actorCanvas.width, actorCanvas.height); actorCtx.save();
    if (hdOn()) {
      // v0.79 HD-2D: 땅 그림(지도 전체, 2D와 같은 그림) → WebGL이 땅·절벽·건물 그림 판·물결·사람 판을 진짜 3D 공간에 세워요
      glCanvas.hidden = false; setPixelSnap(false);
      const gw = map[0].length * TILE, gh = map.length * TILE;
      ground3d ||= document.createElement('canvas'); if (ground3d.width !== gw || ground3d.height !== gh) { ground3d.width = gw; ground3d.height = gh; }
      const g = ground3d.getContext('2d'); g.imageSmoothingEnabled = false;
      // 땅 그림은 바뀔 때만 다시 그려요(지도·계절·누른 곳 표시·잠수) — 물결·풀 흔들림은 WebGL이 그려요. 늦어도 4초마다 한 번
      const gkey = `${map.id}|${assetTintTag()}|${target ? target.x + ',' + target.y : ''}|${map.diving ? 1 + (assetImage(UW_FLOOR.key) ? 1 : 0) : 0}|${gw}x${gh}|${Object.keys(state.flags || {}).length}`;
      if (gkey !== groundCache.key || now - groundCache.at > 4000) { groundCache.camera = drawWorld(g, map, state, view, now, target, motion, { width: gw, height: gh, labels: false, actors: false, seabed: map.diving ? 'floor' : false }, people); groundCache.key = gkey; groundCache.at = now; groundCache.ver++; }
      camera = groundCache.camera;
      const sc = map.diving ? ['#7fd6ec', '#2c8db5', FOG] : map.kind === 'room' ? ['#3b3448', '#3b3448', '#3b3448'] : skyColors(); ctx.fillStyle = sc[2]; ctx.fillRect(0, 0, sceneWidth, sceneHeight);
      const px = view.x * TILE + 16, py = view.y * TILE + 28;
      if (fp) { fpTick(now); hdView = fpCamera(fp.ex, fp.ez, fp.eh, fp.yaw, fp.pitch, fp.fov * Math.PI / 180, sceneWidth, sceneHeight); paintFPSky(ctx, hdView); sc[2] = fp.sky.horizon; } // v0.84 1인칭 관찰
      else hdView = hdCamera(px, py, glView.groundAt(map, px, py), 0, sceneWidth, sceneHeight, glCanvas.height / sceneHeight);
      const L = daylight(), room = map.kind === 'room', lt = fp ? { sun: fp.sky.sun, tint: fp.sky.tint } : room ? { sun: [.42, .82, .39], tint: [1, 1, 1] } : lightFor(L);
      glView.render({ map, ground: ground3d, groundVer: groundCache.ver, view: hdView, now, people, viewPos: view, state, motion, wanted: map.kind === 'town' ? wantedRole(state.progress[state.zone] || {}) : null, seen: d => seenDir(0, d), fogColor: sc[2], seaColor: map.diving ? '#1d6f96' : '#3d8fc4', sun: lt.sun, tint: map.diving ? [.72, .9, 1.05] : lt.tint, night: fp ? fp.sky.night : room ? 0 : L.night, light: fp ? fp.sky.light : room ? .5 : Math.max(0, 1 - (L.night || 0)), post: !fp, glit: !!fp?.sky.glit, glitCol: fp?.sky.glitCol, season: currentSeason(), quality: gfxQ });
      nightLamps = !room && L.night > .05 ? (glView.info.lamps || []).map(([x, h, z]) => hdView.project(x, z, h)).filter(Boolean).map(p => ({ x: p.x, y: p.y, r: 64 * p.k })) : [];
      { const lp = toScreen(px, py); lamp = lp && lp.k ? { x: lp.x, y: lp.y - 22 * lp.k, r: 120 * lp.k } : null; }
      if (!room) paintMiniMap(now, people); else if (miniMap) miniMap.hidden = true;
    } else { // WebGL이 안 되는 기기: 2D로 그려요
      glCanvas.hidden = true; setPixelSnap(true); nightLamps = [];
      camera = drawWorld(ctx, map, state, view, now, target, motion, { width: sceneWidth, height: sceneHeight, labels: false, actors: false, seabed: map.diving }, people);
      actorCtx.scale(K, K); actorCtx.translate(-camera.x, -camera.y);
      drawActors(actorCtx, state, view, now, motion, map.diving ? people.filter(n => !n.actor) : people, map); // v0.87 바닷속엔 사람이 없어요
      lamp = { x: view.x * TILE + 16 - camera.x, y: view.y * TILE + 8 - camera.y, r: 120 };
      if (map.kind !== 'room') paintMiniMap(now, people); else if (miniMap) miniMap.hidden = true; // v0.68: 2D에서도 작은 지도
    }
    actorCtx.restore();
    if (map.diving) paintUnderwater(actorCtx, K, now); // v0.71 바닷속
    else if (map.kind !== 'room' && !fp) paintWind(actorCtx, now, K, hdOn() ? -view.x * TILE : -camera.x, hdOn() ? -view.y * TILE * .6 : -camera.y);
    if (map.kind !== 'room' && (!fp || fp.mode === 'look')) paintDaylight(actorCtx, K); // v0.69 낮·밤
    paintWorldLabels(people);
  }
  music(musicFor());
  if (state.started && !document.hidden && now - (frame.legendAt || 0) > 700) { frame.legendAt = now; checkLegends(); }
  if (avatarChoice) $$('canvas[data-explorer-sprite]').forEach(c => paintExplorerCard(c, c.dataset.explorerSprite, now, avatarChoice.selected === c.dataset.explorerSprite));
  const door = !busy() && !facingNPC() && doorAhead(), sb = !door && !busy() && seabedAhead(), n = !door && !sb && !busy() && !map.diving && nearestNPC(); $('#interactionPrompt').classList.toggle('hidden', !n && !door && !sb);
  if (sb) $('#interactionPrompt').textContent = `${matchMedia('(pointer:coarse)').matches ? '대화' : 'E'} · ${sb.name} 살펴보기`;
  if (door) $('#interactionPrompt').textContent = `${matchMedia('(pointer:coarse)').matches ? '대화' : 'E'} · ${door.name} 들어가기${map.def.island !== '울릉도' && ['gym', 'lab', 'shop', 'home'].includes(door.kind) ? ' · 이야기 시설' : ''}`; // v0.82 독도의 수호관·연구소·상점·집은 창작 시설
  else if (n && !sb) $('#interactionPrompt').textContent = `${matchMedia('(pointer:coarse)').matches ? '대화' : 'E'} · ${n.name}`;
  requestAnimationFrame(frame);
}

// ── study questions (board, boss, review, memory stone) ────────────────────────
function chooseQuestions(count, concept = null) {
  const pool = QUESTIONS.filter(q => concept ? q.concept === concept : q.zone <= state.zone), seen = new Set(state.answerLog.slice(-8).map(a => a.q));
  const score = q => (seen.has(q.id) ? 10 : 0) + (state.learning[q.concept]?.independent || 0) + (state.zone < 7 && q.zone === state.zone ? -3 : 0);
  pool.sort((a, b) => score(a) - score(b));
  const chosen = [];
  for (const q of pool) { if (chosen.length === count) break; if (!chosen.some(c => c.concept === q.concept)) chosen.push(q); }
  for (const q of pool) { if (chosen.length === count) break; if (!chosen.includes(q)) chosen.push(q); }
  return chosen;
}
function beginStudy(kind = 'review', concept = null, opts = {}) {
  if (battle) return;
  const count = kind === 'board' ? 2 : kind === 'boss' ? (state.zone === 7 ? 3 : 1) : kind === 'stone' ? 1 : 2;
  const questions = chooseQuestions(count, concept); let index = 0, assisted = false;
  const title = { boss: '지킴이의 기억 확인', board: '기록을 연결해요', stone: '기억 비석의 질문' }[kind] || '배운 내용을 다시 만나기';
  function show() {
    const q = questions[index];
    openModal(head(title, `${map.name} · ${index + 1}/${questions.length}`) + `<div class="progress-dots">${questions.map((_, i) => `<i class="${i < index ? 'done' : ''}"></i>`).join('')}</div><div class="question-tag">${CONCEPTS.find(c => c.id === q.concept)?.title || '기록 탐구'}</div><h3 class="question-title">${esc(q.prompt)}</h3><div class="answer-options">${q.options.map((opt, i) => `<button class="answer-option" data-answer="${i}"><b>${i + 1}</b><span>${esc(opt)}</span></button>`).join('')}</div><div id="feedbackArea"></div><p class="footer-note">틀려도 괜찮아요. 자료를 함께 읽고 다음에 다시 확인해요.</p>`, () => {
      $$('[data-answer]').forEach(b => b.onclick = () => {
        const answer = Number(b.dataset.answer), correct = answer === q.answer;
        recordAnswer(state, q, correct, assisted);
        $$('[data-answer]').forEach(btn => { btn.disabled = true; if (Number(btn.dataset.answer) === q.answer) btn.classList.add('correct'); });
        if (!correct) b.classList.add('wrong'); sfx(correct ? 'correct' : 'wrong');
        $('#feedbackArea').innerHTML = `<div class="feedback"><strong>${correct ? '잘 연결했어요!' : '근거를 다시 살펴볼까요?'}</strong><br>${esc(q.explanation)}<br><span class="source-link">출처: ${esc(sourceCite(q.source))}</span></div><div class="modal-actions"><button id="nextQuestion" class="primary">${!correct ? '근거를 읽고 다시 풀기' : index < questions.length - 1 ? '다음 기록' : '조사 마치기'} →</button></div>`;
        $('#nextQuestion').onclick = () => {
          if (!correct) { assisted = true; show(); return; }
          assisted = false; index++;
          if (index < questions.length) { show(); return; }
          closeModal();
          if (kind === 'board') { progress().studied = Math.max(2, progress().studied); state.coins += 20; for (const m of state.party) gainXP(m, 15); toast('기록 조사 완료! 조사 코인 20개를 받았어요.'); }
          if (kind === 'stone') { if (!opts.rewarded && opts.flag) { setFlag(opts.flag); giveItems({ coins: 15 }); } else toast('기억이 한층 또렷해졌어요.'); }
          updateUI(); save();
          if (kind === 'boss') startBattle('boss');
        };
        save();
      });
    });
  }
  show();
}

// ── 튜토리얼: 김박사와 연습 대결 → 마을 걷기 안내(4단계) ─────────────────────────
// state.tutorial = { battle: 연습 대결을 마쳤는지, walk: 걷기 안내 단계 0~4 (4 = 끝) }
const tut = b => b?.kind === 'tutorial';
function tip(b, text) { if (tut(b)) battleUI.coach(text, { onSkip: skipTutorialBattle }); }
function startTutorial() { if (!battle && state.started && state.party.length) startBattle('tutorial', 2); }
function skipTutorialBattle() { if (!tut(battle)) return; closeBattle(); finishTutorialBattle(); }
function finishTutorialBattle() {
  state.tutorial.battle = true; healAll(state); save(); updateUI();
  talk('김박사', ['정말 잘했어요! 이렇게 문제를 맞히며 사나워진 우산몬을 도와주면 돼요.', '이제 마을을 걸어 볼까요? 위쪽 안내를 하나씩 따라 해 봐요.'], () => { renderCoachPanel(); }, '튜토리얼', 'professor');
}
const touchy = () => typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
const WALK_STEPS = [
  { title: '걸어 보기', text: () => touchy() ? '왼쪽 아래 조이스틱을 누른 채로 밀거나, 가고 싶은 곳을 눌러서 세 걸음 걸어 보세요.' : '방향키나 W·A·S·D 키로 세 걸음 걸어 보세요. 가고 싶은 곳을 마우스로 눌러도 돼요.', glow: null },
  { title: '말 걸기', text: () => `노란 ! 표시가 있는 사람에게 다가가 ${touchy() ? '‘대화’ 버튼' : 'E 키나 스페이스'}를 눌러 말을 걸어요.`, glow: '#interactBtn' },
  { title: '모험 수첩', text: () => '아래쪽 ‘모험 수첩’을 눌러 지금 할 일을 확인해요.', glow: '#questBtn' },
  { title: '목적지 안내', text: () => '수첩의 ‘목적지 안내’를 누르면 가야 할 곳까지 저절로 걸어가요.', glow: '#guideBtn' }
];
var tutorialSteps = 0; // steps walked during tutorial step 1
function renderCoachPanel() {
  $$('.coach-glow').forEach(el => el.classList.remove('coach-glow'));
  let panel = $('#coachPanel'); const step = state.started && state.tutorial?.battle ? state.tutorial.walk : 4;
  if (step >= 4) { panel?.remove(); return; }
  if (!panel) { panel = document.createElement('div'); panel.id = 'coachPanel'; panel.className = 'coach-panel'; panel.setAttribute('role', 'status'); scene.append(panel); }
  const st = WALK_STEPS[step];
  panel.innerHTML = `<canvas width="64" height="64" aria-hidden="true"></canvas><div><small>튜토리얼 ${step + 1} / 4 · ${st.title}</small><p>${esc(st.text())}</p></div><button type="button" id="coachSkip">건너뛰기</button>`;
  const g = panel.querySelector('canvas').getContext('2d'); g.imageSmoothingEnabled = false; drawResident(g, 'professor', 0, 0, 64);
  $('#coachSkip').onclick = () => { state.tutorial.walk = 4; save(); renderCoachPanel(); toast('튜토리얼을 건너뛰었어요. 메뉴에서 다시 볼 수 있어요.'); };
  if (st.glow) $(st.glow)?.classList.add('coach-glow');
}
// walk / talk / quest / guide: the player did something the current step asks for.
function tutorialEvent(kind) {
  const t = state.tutorial; if (!state.started || !t?.battle || t.walk >= 4) return;
  const want = ['walk', 'talk', 'quest', 'guide'][t.walk]; if (kind !== want) return;
  if (kind === 'walk' && ++tutorialSteps < 3) return;
  t.walk++; tutorialSteps = 0; sfx('toggle'); save();
  if (t.walk >= 4) { renderCoachPanel(); toast('튜토리얼 끝! 이제 마음껏 독도를 탐험해요.'); }
  else renderCoachPanel();
}

// ── turn-based duel: calm berserk (사나워짐) 우산몬 by clearing their dark energy ──
// Wild and 몽땅랜드 우산몬 are 사나워짐 (wrapped in 검은 기운). A correct answer clears some of it;
// at zero they find their calm again. 독도 지킴이 duels are friendly certification matches.
const active = () => state.party[state.active];
const enemy = () => battle.enemies[battle.index];
const berserk = b => b.kind !== 'boss' && b.kind !== 'rematch';
function opponentName(b) { return b.kind === 'enemy' ? z().enemy : b.kind === 'trainer' ? b.npc.name : keeperName(z()); }
function backdropKind() { const t = map[state.y]?.[state.x]; return t === 3 ? 'field' : t === 4 || t === 6 || map.kind === 'route' ? 'shore' : 'town'; }
// 몽땅랜드 battle pictures: 직원 / 팀장 / 백무 사장 (dist/assets/characters/baekmudan-*-portrait.png)
function villainPortrait(actor) {
  if (!actor?.startsWith('villain-')) return null;
  const role = actor === 'villain-leader' ? 'boss' : actor.startsWith('villain-exec') ? 'exec' : 'grunt';
  return `characters/baekmudan-${role}-portrait`;
}
// 백무 사장은 마지막에 전설의 우산몬 사철나무를 내보내요. 정화하면 동료가 돼요(게임 전체에 한 마리).
const TREE = 18;
const ownsTree = () => [...state.party, ...state.storage].some(m => m.id === TREE);
const bossTeam = () => [43, 58, ownsTree() ? 26 : TREE];
let testQuestion = null; // screen-size checks (?test) ask the longest question on purpose
function startBattle(kind, id, opts = {}) {
  if (battle || !state.started) return;
  settleMovement(); path = []; pathAction = null; keys.clear();
  if (!state.party.some(m => m.hp > 0)) { healAll(state); state.active = 0; }
  if (state.party[state.active]?.hp <= 0) state.active = state.party.findIndex(m => m.hp > 0);
  // v0.71: 첫 동료가 Lv1부터라 1장(도동항·숫돌바위 길)의 상대는 Lv1~2예요. 2장부터는 예전 그대로(인증하면 동료가 8+4×장 레벨로 올라요).
  const first = state.zone === 0, base = first ? (map.kind === 'route' ? 2 : 1) : 5 + state.zone * 4 + (map.kind === 'route' ? 2 : 0);
  let enemies;
  if (kind === 'wild') enemies = [createMonster(id, first ? Math.max(1, base - 1 + Math.floor(Math.random() * 2)) : Math.max(3, base - 2 + Math.floor(Math.random() * 3)))];
  else if (kind === 'legend') enemies = [createMonster(id, base + 4)];
  else if (kind === 'tutorial') {
    // a gentle practice foe: two right answers calm it, and it only taps lightly
    const foe = createMonster(id, 3), mine = state.party[state.active] || state.party[0];
    foe.maxHp = foe.hp = Math.max(3, toHalves(damage(mine, foe, QUESTION_POWER, () => .5).amount, foe) * 2 - 2); foe.attack = 3; enemies = [foe]; // 하트 반 칸 단위
  }
  else if (kind === 'enemy') { const pool = z().wild; enemies = (state.zone === 7 ? bossTeam() : [pool[2] || pool[0] || 21]).map(i => createMonster(i, base)); }
  else if (kind === 'trainer') enemies = (opts.npc.team?.length ? opts.npc.team : [z().wild[3]]).map(i => createMonster(i, base));
  else enemies = z().bossTeam.slice(0, kind === 'rematch' ? 3 : 2).map(i => createMonster(i, kind === 'rematch' ? base + 1 : first ? 1 : Math.max(3, base - 2))); // v0.44 독도 지킴이 약하게: 인증 결투는 이 장 기준 레벨 −2
  for (const m of enemies) if (!state.seen.includes(m.id)) state.seen.push(m.id);
  for (const m of enemies) m.record = pickRecord(state.zone, Math.random, enemies.map(x => x.record).filter(Boolean)); // 검은 기운이 지운 기록 한 줄씩
  preloadMonsters(enemies.map(m => m.id));
  for (const r of ['grunt', 'exec', 'boss']) assetImage(`characters/baekmudan-${r}-portrait`);
  $('#toast').classList.add('hidden');
  battle = { kind, enemies, index: 0, turn: 1, npc: opts.npc || null, roamer: opts.roamer || null, captureTried: false, guard: false, quiz: null };
  $('#battleScreen').classList.remove('hidden'); scene.classList.add('battling');
  const foeTrainer = kind === 'enemy' ? VILLAIN_BY_ZONE[state.zone] : kind === 'trainer' ? opts.npc.actor : (kind === 'boss' || kind === 'rematch') ? ROLE_ACTOR(state.zone).boss : null;
  const foePortrait = villainPortrait(foeTrainer);
  battleUI.mount({ backdrop: backdropKind(), sky: z().color, aura: berserk(battle), island: map.def?.island || '', myPicture: ['enemy', 'trainer', 'boss', 'rematch'].includes(kind) ? pictureKey(EXPLORERS.find(x => x.id === state.avatar)?.picture) : null, label: kind === 'tutorial' ? '연습 · 김박사와 함께' : kind === 'wild' ? `기록 되찾기 · ${map.name}` : kind === 'legend' ? `전설의 우산몬 · ${map.name}` : kind === 'boss' || kind === 'rematch' ? `${opponentName(battle)} · 인증 결투` : opponentName(battle), foeTrainer, foePortrait });
  foeEnters(battle); refreshBattle(); if (!battleUI.portraitIn()) battleUI.enemyEnter(); sfx('encounter'); updateUI();
  runBattle(battle).catch(err => { console.error(err); if (battle) finishBattle(false, true); });
}
function refreshBattle() {
  if (!battle) return;
  const a = active(), e = enemy(), sp = getSpecies(e.id), dark = berserk(battle);
  battleUI.setStatus(a, { name: name(a), trait: traitId(battle, a) ? traitName(a) : '' }, state.party.map((m, i) => ({ hp: m.hp, name: name(m), active: i === state.active })));
  battleUI.setFoe(e, { name: sp.name, type: TYPES[sp.type].name, gauge: dark ? '남은 검은 기운' : '남은 기운', dark, record: e.record, title: dark ? '지워진 기록' : '시험 두루마리' }, battle.enemies.length > 1 ? `${battle.index + 1} / ${battle.enemies.length}번째 우산몬` : '');
  if (dark) battleUI.setAura(e.hp > 0 ? Math.max(.25, e.hp / e.maxHp) : 0);
}
// 출처 표시: 공공누리·자유이용 조건에 따라 문제마다 근거 자료의 이름을 밝혀요
const sourceCite = url => SOURCES.find(s => s.url === url)?.cite || '학습 자료';
function explanationHTML(q) { return `<p class="dq-explain">${esc(q.explanation)}</p><span class="source-link">출처: ${esc(sourceCite(q.source))}</span>`; }
// 결투 글 줄이기(v0.65): ‘ [특성 이름]’ 꼬리말을 배지로 바꿔요
const noteBadges = note => [...String(note || '').matchAll(/\[([^\]]+)\]/g)].map(m => `✦ ${m[1]}`);
// ── 문제 결투 (v0.42) ───────────────────────────────────────────────────────────
// 기록 되찾기 결투(v0.58): 검은 기운이 지운 기록(두루마리의 빈칸)을 문제를 맞혀 채워요.
// 내 차례: ‘기록 찾기’를 누르면 바로 독도 문제가 나와요(형식은 battle-quiz.js quizFormat). 상대 차례: ○× 빠른 판단으로 막아요. 상성은 내 우산몬과 상대 우산몬의 속성으로 정해요.
const conceptTitle = q => CONCEPTS.find(c => c.id === q.concept)?.title || '기억 확인';
const matchup = (a, e) => advantage(getSpecies(a.id).type, getSpecies(e.id).type);
const isBoss = b => BOSS_KINDS.includes(b.kind) || (b.kind === 'enemy' && state.zone === 7); // 독도 지킴이 · 백무 사장
// ── 특성 (v0.60, traits.js) ── 우산몬마다 하나씩. 연습 대결에서는 쓰지 않아요(자동 검사는 따로 켜서 봐요).
const traitId = (b, m) => (!m || tut(b) || (TEST_MODE && !window.__dokdoTraits)) ? null : traitOf(m.id).id;
const traitName = m => traitOf(m.id).name;
function traitState(b, m) { b.traits ||= new Map(); if (!b.traits.has(m)) b.traits.set(m, { rights: 0, streak: 0, lastWrong: false, hit: false }); return b.traits.get(m); }
const healBy = (m, rate) => { const before = m.hp; m.hp = Math.min(m.maxHp, m.hp + Math.max(1, Math.round(m.maxHp * rate))); return m.hp - before; };
// 기운 읽기: 상대가 나올 때 두루마리를 10% 먼저 채워요
function foeEnters(b) { const a = active(), e = enemy(); if (traitId(b, a) === 'reader' && e.hp === e.maxHp) e.hp = Math.max(1, e.hp - Math.round(e.maxHp * .1)); }
function attackRule(b, mult) {
  if (mult > 1) return '상성이 좋아요! 맞히면 1.5배로 채우고, 틀려도 절반은 채워져요.';
  if (mult < 1) return '상성이 나빠요. 맞혀도 0.75배만 채워지고, 틀리면 채워지지 않아요.';
  return berserk(b) ? '맞히면 지워진 기록이 채워져요. 틀리면 채워지지 않아요.' : '맞히면 시험 두루마리가 채워져요. 틀리면 채워지지 않아요.';
}
async function askQuiz(b, phase, header, chosen = null) {
  const q = chosen || testQuestion || selectBattleQuestion(state), order = shuffledChoices(q);
  b.quiz = { q, phase, order, answered: false, assisted: false };
  const pierce = phase === 'defense' && isBoss(b);
  const rule = phase === 'attack' ? attackRule(b, matchup(active(), enemy()))
    : `맞히면 충격이 40% 줄어요. 틀리면 그대로 받아요.${pierce ? ' 이 상대는 가끔 정답도 뚫고 들어와요(관통)!' : ''}`;
  const wanted = quizFormat(q, phase), format = wanted === 'order' && TEST_MODE && !window.__dokdoOrder ? 'choice' : wanted; // 자동 검사는 순서 놓기를 따로 켜서 봐요
  const shown = format === 'ox' ? oxShown(q, Math.random, TEST_MODE) : null;
  if (phase === 'attack' && traitId(b, active()) === 'eliminate' && ['choice', 'cards'].includes(format)) { // 약점 찾기: 틀린 답 하나를 지워요
    const wrong = order.filter(i => i !== q.answer), drop = TEST_MODE ? (q.answer + 2) % 4 : wrong[Math.floor(Math.random() * wrong.length)]; order.splice(order.indexOf(drop), 1);
  }
  b.quiz.format = format;
  const mu = matchup(active(), enemy()), badge = phase === 'attack' ? (mu > 1 ? '상성 좋음 ×1.5' : mu < 1 ? '상성 나쁨 ×0.75' : '') : pierce ? '관통 주의' : '';
  const res = await battleUI.quiz({ q, order, phase, header: phase === 'attack' ? '✎ 기록 찾기' : '🛡 막기', rule: tut(b) ? rule : '', badge, concept: conceptTitle(q), format, shown }); void header;
  if (battle !== b) return null;
  const correct = res.choice === q.answer;
  Object.assign(b.quiz, { answered: true, assisted: res.assisted, correct, choice: res.choice });
  recordAnswer(state, q, correct, res.assisted, { mode: 'battle', phase, opponent: enemy().id });
  battleUI.reveal(q, res.choice); sfx(correct ? 'correct' : 'wrong'); save();
  return { q, correct };
}
async function attackWithQuiz(b, q = null) {
  const a = active(), e = enemy(), dark = berserk(b);
  battleUI.allyAct?.('lunge');
  tip(b, '알맞은 답을 눌러요. 맞히면 위쪽 두루마리의 빈칸이 채워져요. 모르겠으면 ‘기록 힌트 보기’를 눌러도 돼요.');
  const r = await askQuiz(b, 'attack', `${josa(name(a), '과/와')} 기록 찾기`, q); if (!r) return;
  tip(b, r.correct ? '잘했어요! 두루마리에 글자가 돌아온 게 보이죠?' : '괜찮아요! 틀려도 내 우산몬은 다치지 않아요. 다시 해 봐요.');
  const d = attackHit(a, e, r.correct), tr = traitId(b, a), ts = traitState(b, a); let note = '';
  if (r.correct) {
    ts.rights++; ts.streak++; let k = 1;
    if (tr === 'opener' && ts.rights === 1) k *= 1.5;
    if (tr === 'clutch' && a.hp < a.maxHp / 2) k *= 1.3;
    if (tr === 'streak' && ts.streak > 1) k *= 1 + Math.min(.3, .1 * (ts.streak - 1));
    if (tr === 'sharp' && ts.rights % 3 === 0) k *= 1.5;
    if (tr === 'typeace' && d.mult > 1) k *= 1.2;
    if (tr === 'underdog' && d.mult < 1) k /= d.mult;
    if (tr === 'finisher' && e.hp / e.maxHp < .3) k *= 1.4;
    if (tr === 'careful' && !b.quiz.assisted) k *= 1.15;
    if (tr === 'comeback' && ts.lastWrong) k *= 1.4;
    if (k !== 1) { d.amount = Math.max(1, Math.round(d.amount * k)); note = ` [${traitName(a)}]`; }
    ts.lastWrong = false;
    if (tr === 'mend' && a.hp < a.maxHp) { healBy(a, .06); note = ` [${traitName(a)}: 하트 회복]`; }
  } else {
    ts.streak = 0; ts.lastWrong = true;
    if (tr === 'grit' && d.amount === 0) { d.amount = Math.max(1, Math.round(attackHit(a, e, true).amount * .3)); note = ` [${traitName(a)}]`; }
  }
  if (d.amount > 0) { e.hp = Math.max(0, e.hp - d.amount); sfx(d.mult > 1 ? 'hitStrong' : d.mult < 1 ? 'hitWeak' : 'hit'); battleUI.damage(d.amount, 'enemy'); refreshBattle(); }
  // 결과는 짧은 한 줄 + 배지(v0.65): 숫자는 문장에, 상성·특성은 배지에
  const tags = [...(d.amount > 0 && d.mult > 1 ? ['상성 좋음 ×1.5'] : d.amount > 0 && d.mult < 1 ? ['상성 나쁨 ×0.75'] : []), ...noteBadges(note)], gauge = dark ? '검은 기운' : '기운';
  if (r.correct) await battleUI.explain(`정답! ${gauge} −${heartText(d.amount)}♥`, explanationHTML(r.q), 'good', tags);
  else if (d.amount > 0) await battleUI.explain(`아쉬워요! 그래도 ${gauge} −${heartText(d.amount)}♥`, explanationHTML(r.q), 'bad', tags);
  else await battleUI.explain('아쉬워요! 이번에는 채우지 못했어요.', explanationHTML(r.q), 'bad', tags);
  // 연속 풀이: 결투마다 한 번, 맞히면 곧바로 한 문제 더
  if (battle === b && r.correct && tr === 'double' && !ts.doubled && e.hp > 0) { ts.doubled = true; await battleUI.say(`${name(a)}의 ${traitName(a)}! 한 문제 더 풀 수 있다!`, { tone: 'good' }); if (battle === b) await attackWithQuiz(b); }
}
// ── 전설의 우산몬 형태변환 (v0.41): 노멀폼(그림 068) ↔ 변환폼(그림 068-2) ──
// 변환폼이면 정답의 힘 ×1.3, 튼튼함 ×1.2. 결투가 끝나면 노멀폼으로 돌아와요(저장 파일에는 노멀폼만).
function setForm(m, form) {
  if (form === 2 && m.form !== 2) { m.formBase = { attack: m.attack, defense: m.defense }; m.attack = Math.round(m.attack * 1.3); m.defense = Math.round(m.defense * 1.2); m.form = 2; }
  else if (form !== 2 && m.form === 2) { if (m.formBase) { m.attack = m.formBase.attack; m.defense = m.formBase.defense; } delete m.form; delete m.formBase; }
}
async function morph(b, m, side) {
  const to = m.form === 2 ? 1 : 2; setForm(m, to); battleUI.morph(side); sfx('morph'); refreshBattle(); updateUI();
  if (side === 'ally') await battleUI.say(to === 2 ? `${name(m)}의 형태변환! 눈부신 빛에 휩싸여 모습이 바뀌었다! 정화의 힘이 강해졌다!` : `${josa(name(m), '이/가')} 원래 모습으로 돌아왔다.`, { tone: 'good' });
  else await battleUI.say(`전설의 우산몬 ${josa(name(m), '이/가')} 형태를 바꿨다! 더 강한 모습이 되었다!`, { tone: 'dark' });
}
// 동료 만들기: 버튼을 누르면 확률로 동료가 돼요(구슬 필요 없음). 시도하면 그 차례에는 공격하지 못해요.
async function befriend(b) {
  const e = enemy(), sp = getSpecies(e.id), triesKey = `legend-tries:${e.id}`, chance = Math.min(.95, captureChance(e, state.flags[triesKey] || 0) + (traitId(b, active()) === 'charm' ? .15 : 0));
  await battleUI.say(`${name(e)}에게 손을 내밀었다… 마음이 닿을까?`);
  if (battle !== b) return 'end';
  const sure = !sp.legendary && state.caught.length < 2; // 첫 동료 한 마리는 꼭 함께해요
  if (sure || Math.random() < chance) {
    addMonster(state, createMonster(e.id, e.level)); jingle('join');
    await battleUI.say(`검은 기운이 걷히고, ${josa(name(e), '이/가')} 마음을 열어 동료가 되었다!`, { tone: 'good' });
    await awardXP(b, e); if (battle !== b) return 'end';
    finishBattle(false, false, { captured: e, legend: b.kind === 'legend' ? b : null }); return 'end';
  }
  if (sp.legendary) { state.flags[triesKey] = (state.flags[triesKey] || 0) + 1; save(); }
  await battleUI.say(sp.legendary ? `${josa(name(e), '은/는')} 아직 마음을 열지 않았다. 하지만 조금 가까워졌다! (다음 성공률 ${Math.round(captureChance(e, state.flags[triesKey]) * 100)}%)` : '아직 마음을 열지 않았다. 검은 기운을 더 걷어 내면 잘 돼요.'); return 'turn';
}
async function playerTurn(b) {
  const a = active(), e = enemy(), first = tut(b) && b.turn === 1, wild = b.kind === 'wild' || b.kind === 'legend', mult = matchup(a, e);
  const forms = getSpecies(a.id).forms === 2 && !tut(b);
  tip(b, first ? '‘기록 찾기’를 눌러 보세요. 독도 문제가 나와요!' : '이번엔 마음대로 골라 봐요! 상성이 좋은 동료로 바꾸면 더 크게 걷어 낼 수 있어요.');
  const tr = traitId(b, a), chance = wild ? Math.round(Math.min(.95, captureChance(e, state.flags[`legend-tries:${e.id}`] || 0) + (tr === 'charm' ? .15 : 0)) * 100) : 0;
  const cmd = await battleUI.menu([
    { label: '기록 찾기', value: 'quiz', sub: `${TYPES[getSpecies(a.id).type].name} → ${TYPES[getSpecies(e.id).type].name}${mult > 1 ? ' · 유리' : mult < 1 ? ' · 불리' : ''}`, hint: first },
    { label: '동료 만들기', value: 'befriend', sub: wild ? `성공률 ${chance}%` : '야생 우산몬만', disabled: first || !wild },
    { label: '도구', value: 'item', sub: `회복젤 ${state.items.heal}`, disabled: first },
    { label: '동료', value: 'party', sub: '교체', disabled: first || state.party.filter(m => m.hp > 0).length < 2 },
    ...(forms ? [{ label: a.form === 2 ? '원래 모습으로' : '형태변환', value: 'morph', sub: a.form === 2 ? '노멀폼으로' : '변환폼 · 힘 UP' }] : []),
    { label: '물러나기', value: 'run', sub: wild ? `성공률 ${tr === 'swift' ? 100 : Math.round(runChance(a, enemy()) * 100)}%` : '결투 중', disabled: first, back: true }
  ], { prompt: `${josa(name(a), '은/는')} 무엇을 할까?`, layout: forms ? 'cards' : '' });
  if (battle !== b) return 'end';
  if (cmd === 'quiz') { await attackWithQuiz(b); return 'turn'; }
  if (cmd === 'morph') { await morph(b, a, 'ally'); return 'turn'; }
  if (cmd === 'befriend') return befriend(b);
  if (cmd === 'item') {
    const pick = await battleUI.menu([
      { label: `회복젤 ×${state.items.heal}`, value: 'heal', sub: `하트 ${tr === 'medic' ? 70 : 45}% 회복`, disabled: state.items.heal <= 0 || a.hp === a.maxHp }
    ], { title: '도구', prompt: '어떤 도구를 쓸까?', cancel: true });
    if (pick === null) return 'free';
    state.items.heal--; jingle('heal'); const before = a.hp; a.hp = Math.min(a.maxHp, a.hp + Math.ceil(a.maxHp * (tr === 'medic' ? .7 : .45))); refreshBattle(); updateUI(); save();
    await battleUI.say(`회복젤을 썼다! ${name(a)}의 하트가 ${heartText(a.hp - before)}개 채워졌다!`); return 'turn';
  }
  if (cmd === 'party') {
    const e = enemy();
    const pick = await battleUI.menu(state.party.map((m, i) => { const mu = matchup(m, e); return { label: name(m), value: String(i), sub: `Lv ${m.level} · 하트 ${heartText(m.hp)}/${heartText(m.maxHp)}${mu > 1 ? ' · 유리' : mu < 1 ? ' · 불리' : ''}`, disabled: m.hp <= 0 || i === state.active }; }), { title: '동료', prompt: '누구와 교체할까?', cancel: true });
    if (pick === null) return 'free';
    state.active = Number(pick); if (traitId(b, active()) === 'cheer') healBy(active(), .15); refreshBattle(); battleUI.allyAct?.('enter'); updateUI(); save();
    await battleUI.say(`${name(active())}, 부탁해!`); return 'turn';
  }
  if (tut(b)) { await battleUI.say('연습 대결은 끝까지 해 봐요! 그만하려면 위쪽 ‘연습 건너뛰기’를 눌러요.'); return 'free'; }
  if (!wild) { await battleUI.say('이 결투에서는 물러날 수 없다!'); return 'free'; }
  if (tr === 'swift' || Math.random() < runChance(a, enemy())) { sfx('run'); await battleUI.say('무사히 물러났다!'); finishBattle(false, true); return 'end'; }
  await battleUI.say('물러나지 못했다!'); return 'turn';
}
async function enemyTurn(b) {
  const a = active(), e = enemy(), dark = berserk(b);
  if (b.kind === 'legend' && getSpecies(e.id).forms === 2 && e.form !== 2 && e.hp > 0 && e.hp <= e.maxHp / 2) { await morph(b, e, 'enemy'); if (battle !== b) return; }
  tip(b, '이번엔 검은 기운이 밀려와요! ‘이 답이 맞을까?’를 ○ ×로 빠르게 판단해요. 맞히면 충격이 40% 줄어요.');
  const r = await askQuiz(b, 'defense', dark ? '검은 기운이 밀려온다!' : `${name(e)}의 시험!`); if (!r) return;
  const tr = traitId(b, a), ts = traitState(b, a); let note = '';
  const pierce = r.correct && isBoss(b) && tr !== 'antipierce' && Math.random() < PIERCE_CHANCE;
  let d = enemyHit(e, a, { correct: r.correct, pierce });
  if (tr === 'sturdy') { d *= .85; note = ` [${traitName(a)}]`; }
  if (tr === 'shield' && r.correct && !pierce) { d *= 2 / 3; note = ` [${traitName(a)}]`; }
  if (tr === 'firstguard' && !ts.hit) { d *= .5; note = ` [${traitName(a)}]`; }
  ts.hit = true; d = d > 0 ? Math.max(1, Math.round(d)) : 0; // v0.83 반 개짜리 충격을 맞혀서 막으면 0(완전 방어)
  if (tr === 'endure' && !ts.endured && a.hp > 1 && a.hp - d <= 0) { d = a.hp - 1; ts.endured = true; note = ` [${traitName(a)}: 하트 반 개로 버텼다!]`; }
  a.hp = Math.max(tut(b) ? 1 : 0, a.hp - d);
  if (tr === 'counter' && r.correct) { e.hp = Math.max(1, e.hp - Math.max(1, Math.round(e.maxHp * .05))); note = ` [${traitName(a)}: 두루마리가 조금 채워졌다]`; }
  if (tr === 'thorns' && d > 0 && e.hp > 1) { e.hp = Math.max(1, e.hp - Math.max(1, Math.round(d * .2))); note = ` [${traitName(a)}]`; }
  tip(b, '내 하트는 왼쪽 위에서 볼 수 있어요. 줄어들면 쉼터나 회복젤로 채워요.'); if (d > 0) { sfx('hurt'); battleUI.damage(d, 'player'); } refreshBattle(); updateUI();
  if (pierce) await battleUI.explain(`정답! 하지만 뚫고 들어왔다. 하트 −${heartText(d)}`, explanationHTML(r.q), 'bad', ['관통', ...noteBadges(note)]);
  else if (r.correct && d === 0) await battleUI.explain('정답! 완전히 막아 냈다. 하트 그대로!', explanationHTML(r.q), 'good', ['완전 방어', ...noteBadges(note)]);
  else if (r.correct) await battleUI.explain(`정답! 잘 막았다. 하트 −${heartText(d)}`, explanationHTML(r.q), 'good', ['충격 40% 줄임', ...noteBadges(note)]);
  else await battleUI.explain(`막지 못했다! 하트 −${heartText(d)}`, explanationHTML(r.q), 'bad', noteBadges(note));
}
async function allyFainted(b) {
  battleUI.allyAct?.('tired'); sfx('faint');
  await battleUI.say(`${josa(name(active()), '이/가')} 지쳐서 더 이상 겨룰 수 없다!`, { tone: 'bad' });
  const next = state.party.findIndex(m => m.hp > 0);
  if (next < 0) { await battleUI.say('동료들이 모두 지쳐 버렸다… 쉼터로 돌아가 쉬자.', { tone: 'bad' }); finishBattle(false); return false; }
  state.active = next; refreshBattle(); battleUI.allyAct?.('enter'); updateUI();
  await battleUI.say(`${name(active())}, 부탁해!`); return true;
}
// 상대 우산몬을 정화하거나 동료로 만들었을 때 경험치(engine.js xpForDefeat): 나와 있던 동료는 전부, 나머지는 절반
async function awardXP(b, foe) {
  const lines = [];
  state.party.forEach((m, i) => {
    if (m.hp <= 0 && i !== state.active) return;
    const lead = state.party[state.active], rate = i === state.active ? 1 : traitId(b, lead) === 'share' ? 1 : BENCH_RATE;
    const xp = Math.round(xpForDefeat(m.level, foe.level, rate) * (traitId(b, m) === 'learner' ? 1.2 : 1)), before = m.level;
    gainXP(m, xp);
    if (i === state.active) lines.push(`${josa(name(m), '이/가')} 경험치 ${xp}을 얻었다! (상대 Lv.${foe.level} · 내 Lv.${before})`);
    if (m.level > before) lines.push(`${name(m)}의 레벨이 올라 Lv.${josa(String(m.level), '이/가')} 되었다!`);
  });
  if (state.party.length > 1) lines.splice(1, 0, '함께한 다른 동료들도 경험치를 절반씩 얻었다.');
  refreshBattle(); updateUI(); save();
  for (const line of lines.slice(0, 7)) { if (battle !== b) return; if (line.includes('레벨이')) jingle('levelup'); else sfx('xp'); await battleUI.say(line, { tone: 'good' }); }
}
async function enemyFainted(b) {
  const e = enemy(); battleUI.enemyCalmed?.(); battleUI.setAura(0); sfx('purify');
  if (active().hp > 0 && traitId(b, active()) === 'afterglow') { healBy(active(), .25); refreshBattle(); updateUI(); }
  tip(b, '검은 기운이 모두 걷혔어요! 이렇게 우산몬을 원래대로 돌려 주면 돼요.');
  if (berserk(b)) await battleUI.say(`${name(e)}의 검은 기운이 모두 사라졌다! ${josa(name(e), '이/가')} 원래대로 돌아왔다.`, { tone: 'good' });
  else await battleUI.say(`시험 두루마리를 모두 채웠다! ${josa(name(e), '이/가')} 물러났다.`);
  if (battle !== b) return false;
  if (e.record) await battleUI.say(`${berserk(b) ? '되찾은 기록' : '채운 기록'}: “${e.record}”`, { tone: 'good' });
  if (battle !== b) return false;
  await awardXP(b, e); if (battle !== b) return false;
  if (b.index + 1 < b.enemies.length) {
    b.index++; b.turn++; foeEnters(b); refreshBattle();
    battleUI.enemyEnter(); // 몽땅랜드 직원은 결투를 시작할 때 한 번만 나와요
    if (getSpecies(enemy().id).legendary) {
      await battleUI.say(`${josa(opponentName(b), '이/가')} 마지막으로 전설의 우산몬 ${josa(name(enemy()), '을/를')} 내보냈다!`); if (battle !== b) return false;
      await battleUI.say(`오랜 세월을 견딘 ${josa(name(enemy()), '이/가')} 검은 기운에 괴로워하고 있다. 정화해서 구해 주자!`, { tone: 'dark' }); return true;
    }
    await battleUI.say(berserk(b) ? `${josa(opponentName(b), '이/가')} 사나워진 ${josa(name(enemy()), '을/를')} 내보냈다!` : `${josa(opponentName(b), '은/는')} ${josa(name(enemy()), '을/를')} 내보냈다!`); return true;
  }
  await victory(b); return false;
}
async function victory(b) {
  const kind = b.kind, coins = { wild: 12, enemy: 45, trainer: 30, tutorial: 10 }[kind] ?? 80;
  b.won = true; jingle('victory'); // 결투 음악을 멈추고 승리 노래
  state.coins += traitId(b, active()) === 'picker' ? Math.round(coins * 1.5) : coins;
  for (const m of state.party) { if (!state.caught.includes(m.id)) state.caught.push(m.id); if (!state.seen.includes(m.id)) state.seen.push(m.id); }
  refreshBattle(); updateUI(); save();
  if (kind === 'wild') await battleUI.say(`원래대로 돌아온 ${josa(name(enemy()), '이/가')} 고마운 듯 풀숲으로 돌아갔다.`, { tone: 'good' });
  if (battle !== b) return;
  await battleUI.say(`조사 코인 ${coins}개를 받았다!`, { tone: 'good' });
  if (battle === b) finishBattle(true);
}
async function runBattle(b) {
  const alive = () => battle === b, e0 = enemy();
  if (tut(b)) {
    tip(b, '연습 대결이에요! 제가 옆에서 하나씩 알려 줄게요.');
    await battleUI.say(`연습 대결! 검은 기운에 휩싸인 ${josa(name(e0), '과/와')} 마주쳤다!`); if (!alive()) return;
    tip(b, '위쪽 두루마리가 검은 기운이 지운 ‘기록’이에요. 빈칸을 모두 채우면 우산몬이 원래대로 돌아와요.');
    await battleUI.say('검은 기운이 독도의 기록을 지우고 있다. 기록을 되찾아 도와주자!', { tone: 'dark' }); if (!alive()) return;
  }
  else if (b.kind === 'legend') { await battleUI.say(`전설의 우산몬 ${josa(name(e0), '이/가')} 깨어났다!`); if (!alive()) return; await battleUI.say(`오랜 세월을 견딘 ${josa(name(e0), '이/가')} 검은 기운에 괴로워하고 있다. 정화하자!`, { tone: 'dark' }); }
  else if (b.kind === 'wild') await battleUI.say(`검은 기운에 휩싸인 ${name(e0)}! 기록을 되찾아 주자!`, { tone: 'dark' });
  else if (b.kind === 'enemy' || b.kind === 'trainer') {
    await battleUI.say(`${josa(opponentName(b), '이/가')} 길을 막아섰다!`);
    if (!alive()) return;
    battleUI.portraitOut(); // the member fades away as the 우산몬 comes out
    await battleUI.say(`${josa(opponentName(b), '이/가')} 사나워진 ${josa(name(e0), '을/를')} 내보냈다! 기록을 되찾자!`, { tone: 'dark' });
  } else { await battleUI.say(`${opponentName(b)}의 인증 결투!`); if (!alive()) return; battleUI.portraitOut(); await battleUI.say(`${opponentName(b)}의 ${josa(name(e0), '이/가')} 나왔다!`); if (!alive()) return; }
  while (alive()) {
    const outcome = await playerTurn(b);
    if (!alive() || outcome === 'end') return;
    if (outcome === 'free') continue;
    if (enemy().hp <= 0) { if (!(await enemyFainted(b))) return; continue; }
    if (active().hp <= 0) { if (!(await allyFainted(b))) return; }
    await enemyTurn(b); if (!alive()) return;
    if (active().hp > 0 && traitId(b, active()) === 'rest' && active().hp < active().maxHp) { healBy(active(), .04); refreshBattle(); updateUI(); }
    if (active().hp <= 0 && !(await allyFainted(b))) return;
    b.turn++; b.guard = false;
  }
}
function closeBattle() { for (const m of [...state.party, ...state.storage]) setForm(m, 1); if (battle?.roamer) roamers.remove(battle.roamer, performance.now()); battle = null; battleUI.destroy(); $('#battleScreen').classList.add('hidden'); scene.classList.remove('battling'); lastEncounter = walks; }
function returnToShelter() {
  if (map.kind !== 'town') { const def = getMapDef(townId(state.zone)); state.map = def.id; map = createMap(def.id); npcMotion.reset(); labelKey = ''; }
  const shop = map.parsed.roles.shop, people = npcs(map, progress(), state.flags);
  const spot = shop && [[0, 1], [1, 0], [-1, 0], [0, -1]].map(([dx, dy]) => ({ x: shop.x + dx, y: shop.y + dy })).find(p => !blocked(map, p.x, p.y, people) && !map.exits.has(`${p.x},${p.y}`));
  const s = spot || map.spawns.a; state.x = s.x; state.y = s.y; view = { x: s.x, y: s.y };
}
function finishBattle(win, escaped = false, info = {}) {
  if (!battle) return;
  const b = battle, kind = b.kind; closeBattle();
  if (info.captured && info.legend) legendJoins(info.legend);
  else if (info.captured) toast(state.storage.some(m => m === state.storage.at(-1) && m.id === info.captured.id) && state.party.length >= PARTY_MAX ? `${josa(getSpecies(info.captured.id).name, '이/가')} 동료가 되어 보관함으로 갔어요! 아래 ‘동료’ 단추에서 바로 바꿀 수 있어요.` : `${josa(getSpecies(info.captured.id).name, '이/가')} 동료가 되었어요!`);
  else if (win) {
    if (kind === 'enemy') {
      progress().enemy = true; state.items.heal += 2;
      if (state.zone === 7) bossFall(b);
      else talk(z().enemy, VILLAIN_TALES[state.zone].after, () => talk('서하', [z().story, '쉼터에서 동료를 회복하고 수호관으로 가 보세요.']), '몽땅랜드 · 창작 대화', VILLAIN_BY_ZONE[state.zone]);
    }
    else if (kind === 'tutorial') finishTutorialBattle();
    else if (kind === 'legend') { const sp = getSpecies(b.enemies[0].id); talk('김박사(무전)', [`검은 기운은 걷혔지만, ${josa(sp.name, '은/는')} 아직 마음을 열지 않고 제자리로 돌아갔어요.`, '전설의 우산몬은 결투 중에 ‘동료 만들기’를 눌러야 해요(10%). 다시 찾아가 도전해 봐요!'], null, '전설의 우산몬', 'professor'); }
    else if (kind === 'trainer') { setFlag(b.npc.flag); talk(b.npc.name, b.npc.after || ['다음엔 지지 않을 거야!'], null, '몽땅랜드 · 창작 대화', b.npc.actor); }
    else if (kind === 'boss') {
      progress().boss = true; if (!state.badges.includes(state.zone)) state.badges.push(state.zone);
      for (const m of state.party) { const goal = 8 + state.zone * 4; while (m.level < goal) gainXP(m, m.level * 13); if (!state.caught.includes(m.id)) state.caught.push(m.id); if (!state.seen.includes(m.id)) state.seen.push(m.id); }
      healAll(state); state.items.heal += 4; labelKey = '';
      talk(keeperName(z()), [`훌륭해요! 모험 수첩을 펴 보세요. ‘${z().badge}’ 도장을 꾹 찍어 드릴게요.`, state.zone === 7 ? '울릉도와 독도, 두 섬의 기억을 되찾은 당신은 이제 두 섬의 수호사예요!' : `이제 마을 오른쪽 다리가 열렸어요. ‘${getMapDef(nextMapId(map.id)).name}’을 따라 다음 지역으로 가 보세요!`], () => stampCeremony(state.zone, () => { if (state.zone === 7) { state.ended = true; save(); playStory(EPILOGUE).then(showEnding); } }));
    }
  } else if (!escaped) {
    healAll(state); returnToShelter();
    talk('쉼터지기', ['동료들이 푹 쉬고 기운을 되찾았어요. 잃어버린 기록이나 동료는 없으니 걱정하지 마세요.', '회복젤과 동료 교체를 활용하고, 상성이 좋은 동료로 다시 결투해 보세요.']);
  } else toast('사나워진 우산몬에게서 잠시 물러났어요.');
  updateUI(); save();
}
async function bossFall(b) {
  await playStory(BOSS_FALL);
  // 사철나무는 풀려나 천장굴 길로 돌아가요. 그곳에서 다시 만나 ‘동료 만들기’(10%)로 함께할 수 있어요.
  if (b?.enemies.some(m => m.id === TREE) && !ownsTree()) await playStory(TREE_JOINS);
  if (!state.legend) await legendEncounter();
  else talk('서하', [z().story, '쉼터에서 동료를 회복하고 수호관으로 가 보세요.']);
}
async function legendEncounter() {
  state.legend = true; addMonster(state, createMonster(100, 34)); save();
  await playStory(LEGEND);
  openModal(head('기억의 강치', '전설의 우산몬 · NO.100') + '<div class="end-screen"><canvas data-portrait="100" width="160" height="160"></canvas><p>흩어진 강치의 기록이 하나로 이어졌어요.<br>강치는 당신과 함께 기억을 지키고 싶어 해요.</p><div class="fact-box">현실의 강치는 남획으로 멸종했어요. 게임 속 강치는 탐사 장치가 보여 주는 기억의 세계에서 만나는 창작 우산몬이며, 실제 생물이 되살아났다는 뜻은 아니에요.</div><div class="modal-actions"><button id="legendOK" class="primary">함께 기억할게 →</button></div></div>', () => { $('#legendOK').onclick = () => { closeModal(); updateUI(); save(); talk('서하', [z().story, '쉼터에서 동료를 회복하고 수호관으로 가 보세요.']); }; });
}

// ── 전설의 우산몬(천연기념물) 퀘스트 ─────────────────────────────────────────
// 조건을 채우면 김박사가 무전으로 알려 주고(legend-open:번호), 지도 위에 금빛 기운이 생겨요.
// 자동 검사(?test)에서는 다른 단계를 방해하지 않게, 검사가 window.__dokdo.legendRadio = true로 켤 때만 무전이 와요.
const TEST_MODE = typeof location !== 'undefined' && new URLSearchParams(location.search).has('test');
function checkLegends() {
  if (!state.started || busy() || !state.tutorial?.battle || (TEST_MODE && !window.__dokdo?.legendRadio)) return;
  const q = LEGENDS.find(l => !state.flags[openFlag(l.id)] && !ownsSpecies(state, l.id) && legendProgress(l, state).done);
  if (!q) return;
  setFlag(openFlag(q.id)); save();
  const intro = state.flags['legend-intro'] ? [] : ['탐험대, 들리나요? 김박사예요. 중요한 소식이 있어요!', '천연기념물은 나라가 법으로 정해 보호하는 자연유산이에요. 천연기념물 생물의 기록은 아주 오래되고 단단해서, 지우개 기계 속에서 ‘전설의 우산몬’이 되었대요.', '전설의 우산몬은 자연을 아끼는 탐험대 앞에만 나타나요. 모험 수첩에 조건을 적어 둘게요.'];
  setFlag('legend-intro'); jingle('legend');
  talk('김박사(무전)', [...intro, ...q.radio, `전설의 우산몬 ‘${q.name}’ · ${q.place}`], () => { toast(`${q.place}에 전설의 기운이 나타났어요!`); labelKey = ''; updateUI(); }, '전설의 우산몬 소식', 'professor');
}
// 전설의 우산몬이 ‘동료 만들기’(10%)로 동료가 됐을 때 (동료로 넣는 일은 befriend가 이미 했어요)
function legendJoins(b) {
  const e = b.enemies[0], q = LEGENDS.find(l => l.id === e.id); if (!q) return;
  setFlag(metFlag(q.id)); if (b.npc?.flag) setFlag(b.npc.flag);
  if (!ownsSpecies(state, e.id)) addMonster(state, createMonster(e.id, e.level));
  save(); updateUI();
  const forms = getSpecies(q.id).forms === 2;
  const pics = forms ? `<div class="form-pair"><figure><canvas data-portrait="${q.id}" width="128" height="128"></canvas><figcaption>노멀폼</figcaption></figure><span aria-hidden="true">⇄</span><figure><canvas data-portrait="${q.id}-2" width="128" height="128"></canvas><figcaption>변환폼</figcaption></figure></div>` : `<canvas data-portrait="${q.id}" width="160" height="160"></canvas>`;
  openModal(head(q.name, `전설의 우산몬 · ${q.monument}`) + `<div class="end-screen">${pics}<p>${josa(q.name, '이/가')} 마음을 열고 곁에 다가왔어요.<br>이제 동료가 되어 함께해요!</p><div class="fact-box"><strong>${q.monument} · ${q.name}</strong><br>${esc(q.fact)}<br>${forms ? '결투 메뉴의 ‘형태변환’을 누르면 변환폼으로 바뀌어요. ' : ''}게임 속 모습은 창작이에요.</div><div class="modal-actions"><button id="legendJoinOK" class="primary">함께 가자 →</button></div></div>`, () => {
    $('#legendJoinOK').onclick = () => { closeModal(); allLegendsCheck(); };
  });
}
function allLegendsCheck() {
  if (state.flags['legend-all'] || !ALL_LEGEND_IDS.every(id => ownsSpecies(state, id))) return;
  setFlag('legend-all'); state.items.heal += 10; state.coins += 300; save(); updateUI();
  talk('김박사(무전)', ['천연기념물 전설의 우산몬 일곱이 모두 당신과 함께하게 됐어요!', '오늘부터 당신은 ‘천연기념물 지킴이’예요. 회복젤 10개와 조사 코인 300개를 보낼게요.', '천연기념물은 우리가 아끼고 지켜야 다음 세대도 만날 수 있어요. 고마워요!'], null, '천연기념물 지킴이', 'professor');
}
function paintLegendList() {
  const el = $('#legendList'); if (!el) return;
  const rows = LEGENDS.map(q => {
    const owned = ownsSpecies(state, q.id), open = state.flags[openFlag(q.id)], p = legendProgress(q, state);
    const status = owned ? '함께해요 ✓' : open ? `가 볼 곳: ${q.place}` : p ? `${q.need.label} (${p.cur}/${p.need})` : q.need.label;
    return `<li class="${owned ? 'done' : open ? 'open' : ''}"><canvas data-portrait="${q.id}" width="40" height="40" style="${owned || open ? '' : 'filter:brightness(0) opacity(.35)'}"></canvas><div><strong>${owned || open ? q.name : '???'}</strong><small>${esc(q.title)}</small><small>${esc(status)}</small></div></li>`;
  });
  el.innerHTML = rows.join('');
  $('#legendCount').textContent = `${ALL_LEGEND_IDS.filter(id => ownsSpecies(state, id)).length} / ${ALL_LEGEND_IDS.length}`;
}

// ── shop, party, dex, world map, notebook, menu ────────────────────────────────
function showShop() {
  openModal(head('쉼터', '회복 · 준비') + `<p>잠깐 쉬어 가요. 동료 회복은 언제나 무료예요.</p><div class="fact-box">조사 코인 <strong>${state.coins}</strong> · 회복젤 ${state.items.heal}</div><div class="modal-actions"><button id="healAll" class="primary">모두 회복하기</button><button id="buyHeal" class="neutral" ${state.coins < 20 ? 'disabled' : ''}>회복젤 +3 · 20코인</button></div>`, () => {
    $('#healAll').onclick = () => { healAll(state); save(); updateUI(); closeModal(); toast('모든 동료의 하트를 가득 채웠어요.'); jingle('heal'); };
    $('#buyHeal').onclick = () => { state.coins -= 20; state.items.heal += 3; save(); showShop(); };
  });
}
// 동료 보관함(v0.60): 함께 다니는 동료는 4마리. 나머지는 보관함에서 쉬고, 기계 없이 어디서나 바로 바꿔요.
// 화면 아래 ‘동료’ 단추를 누르면 바로 여기가 열려요. 함께 다니는 동료를 누르면 자세히(특성·순서·회복·맡기기), 보관함의 동료를 누르면 데려가요.
const traitChip = m => { const t = traitOf(m.id); return `<span class="trait-chip" title="${esc(t.text)}">✦ ${esc(t.name)}</span>`; };
function showStorage(pick = null) {
  if (battle) return;
  const card = (m, attr, note, cls = '') => `<button class="dex-card ${cls}" ${attr}><canvas data-portrait="${m.id}" width="80" height="80"></canvas><strong>${name(m)}</strong><small>Lv.${m.level} · ${TYPES[getSpecies(m.id).type].name}</small>${traitChip(m)}<em>${note}</em></button>`;
  const swapping = pick !== null && state.storage[pick], full = state.party.length >= PARTY_MAX;
  openModal(head('동료 보관함', `함께 다니는 동료 ${state.party.length} / ${PARTY_MAX} · 보관함 ${state.storage.length}`) +
    (swapping ? `<p class="swap-note"><strong>${name(state.storage[pick])}</strong>${josa(name(state.storage[pick]), '을/를').slice(name(state.storage[pick]).length)} 데려갈게요. 함께 다니는 동료 중 누구와 바꿀까요?</p>` : `<p>함께 다니는 동료는 ${PARTY_MAX}마리예요. 보관함의 동료를 누르면 바로 바꿔요. ✦는 특성이에요.</p>`) +
    `<h3>함께 다니는 동료</h3><div class="dex-grid storage-grid">${state.party.map((m, i) => card(m, `data-party-slot="${i}"`, swapping ? '이 동료와 바꾸기' : i === state.active ? '맨 앞 · 자세히' : '자세히', 'owned' + (swapping ? ' swap-target' : ''))).join('')}${Array.from({ length: PARTY_MAX - state.party.length }, () => '<div class="party-slot" aria-hidden="true">+</div>').join('')}</div>` +
    `<h3>보관함에서 쉬는 동료 (${state.storage.length})</h3><div class="dex-grid storage-grid">${state.storage.length ? state.storage.map((m, i) => card(m, `data-rest-slot="${i}"`, i === pick ? '고른 동료' : full ? '바꾸기' : '데려가기', i === pick ? 'selected' : '')).join('') : `<p class="footer-note">아직 보관함에 동료가 없어요. ${PARTY_MAX}마리가 넘으면 새 동료는 여기로 와요.</p>`}</div>` +
    (swapping ? '<div class="modal-actions"><button id="swapCancel" class="neutral">그만두기</button></div>' : ''), () => {
    $$('[data-party-slot]').forEach(b => b.onclick = () => {
      const i = Number(b.dataset.partySlot);
      if (!swapping) { partyDetail(i); return; }
      const out = state.party[i]; state.party[i] = state.storage.splice(pick, 1)[0]; state.storage.push(out); toast(`${josa(name(state.party[i]), '이/가')} 함께해요. ${josa(name(out), '은/는')} 보관함에서 쉬어요.`);
      state.active = Math.min(state.active, state.party.length - 1); save(); updateUI(); showStorage();
    });
    $$('[data-rest-slot]').forEach(b => b.onclick = () => {
      const i = Number(b.dataset.restSlot);
      if (state.party.length < PARTY_MAX) { state.party.push(state.storage.splice(i, 1)[0]); save(); updateUI(); showStorage(); }
      else showStorage(i);
    });
    $('#swapCancel')?.addEventListener('click', () => showStorage());
  });
}
function partyDetail(index) {
  if (battle) return; const m = state.party[index]; if (!m) return; const sp = getSpecies(m.id);
  openModal(head(sp.name, `함께하는 동료 · Lv.${m.level}`) + `<div class="monster-detail"><canvas data-portrait="${m.id}" width="160" height="160"></canvas><div><span class="type-chip">${TYPES[sp.type].name}</span><p>${sp.motif} 모티브</p><p class="trait-line">${traitChip(m)} ${esc(traitOf(m.id).text)}</p><div class="stat-list"><span>하트 ${heartText(m.hp)}/${heartText(m.maxHp)}</span><span>공격 ${m.attack}</span><span>방어 ${m.defense}</span><span>스피드 ${m.speed}</span></div></div></div><div class="fact-box">결투에서는 ‘기록 찾기’로 문제를 풀어 검은 기운이 지운 기록을 되찾아요. 상성이 좋은 상대에게는 1.5배! 특성은 결투에서 저절로 쓰여요.</div><div class="modal-actions"><button id="leadMon" class="primary" ${m.hp <= 0 ? 'disabled' : ''}>첫 번째로 내보내기</button><button id="fieldHeal" class="neutral" ${state.items.heal <= 0 ? 'disabled' : ''}>회복젤 사용 (${state.items.heal})</button><button id="toStorage" class="neutral" ${state.party.length <= 1 ? 'disabled' : ''}>보관함에 맡기기</button><button id="backStorage" class="neutral">← 동료 보관함</button></div>`, () => {
    $('#leadMon').onclick = () => { state.active = index; save(); updateUI(); showStorage(); };
    $('#toStorage').onclick = () => { if (state.party.length <= 1) return; const out = state.party.splice(index, 1)[0]; state.storage.push(out); state.active = Math.min(state.active > index ? state.active - 1 : state.active === index ? 0 : state.active, state.party.length - 1); save(); updateUI(); toast(`${josa(name(out), '은/는')} 보관함에서 쉬어요.`); showStorage(); };
    $('#backStorage').onclick = () => showStorage();
    $('#fieldHeal').onclick = () => { state.items.heal--; m.hp = Math.min(m.maxHp, m.hp + Math.ceil(m.maxHp * .45)); save(); updateUI(); partyDetail(index); };
  });
}
// 도감: 만나지 못한 우산몬은 검은 실루엣, 발견·결투한 우산몬은 원래 모습, 동료로 만든 우산몬은 왼쪽 위에 도트 별(★)
const PIXEL_STAR = (() => { const rows = ['....#....', '...#o#...', '...#o#...', '####o####', '#ooooooo#', '.#ooooo#.', '..#o#o#..', '.#o#.#o#.', '.##...##.'];
  const px = rows.flatMap((r, y) => [...r].map((c, x) => c === '.' ? '' : `<rect x="${x}" y="${y}" width="1" height="1" fill="${c === '#' ? '#5a3a10' : y < 4 ? '#ffe680' : '#f5c331'}"/>`)).join('');
  return `<i class="dex-star" role="img" aria-label="동료"><svg viewBox="0 0 9 9" shape-rendering="crispEdges">${px}</svg></i>`; })();
function showDex(filter = 'all') {
  openModal(head('우산몬 도감', `100개의 만남 · 동료 ${state.caught.length}종`) + `<div class="filter-row">${[['all', '전체 100종'], ['caught', '동료'], ['seen', '발견'], ['bird', '조류'], ['fish', '어류'], ['plant', '식물'], ['legend', '전설']].map(([id, label]) => `<button data-filter="${id}" class="${filter === id ? 'selected' : ''}">${label}</button>`).join('')}</div><p class="footer-note">실제 생물 이름으로 만나는 100종. 레벨이 올라가도 같은 이름으로 함께해요.</p><div class="dex-grid">${MONSTERS.filter(m => filter === 'all' || filter === 'caught' && state.caught.includes(m.id) || filter === 'seen' && state.seen.includes(m.id) || filter === 'bird' && ['bird', 'raptor'].includes(m.shape) || filter === 'fish' && ['fish', 'goby'].includes(m.shape) || filter === 'plant' && ['flower', 'plant', 'kelp'].includes(m.shape) || filter === 'legend' && m.legendary).map(m => `<button data-dex="${m.id}" class="dex-card ${state.caught.includes(m.id) ? 'owned' : !state.seen.includes(m.id) ? 'locked' : ''}">${state.caught.includes(m.id) ? PIXEL_STAR : ''}<small>NO.${String(m.id).padStart(3, '0')}</small><canvas data-portrait="${m.id}" width="80" height="80"></canvas><strong>${state.seen.includes(m.id) ? m.name : '???'}</strong></button>`).join('')}</div>`, () => {
    $$('[data-filter]').forEach(b => b.onclick = () => showDex(b.dataset.filter)); $$('[data-dex]').forEach(b => b.onclick = () => dexDetail(Number(b.dataset.dex), filter));
  });
}
// 도감: 도트 그림이 기본, ‘실제 사진 보기’를 누르면 실제 생물 사진으로 바뀌어요 (사진은 자르지 않고 전체를 보여 줘요).
// 전설의 우산몬은 ‘노멀폼 / 변환폼’ 버튼으로 두 모습을 볼 수 있어요.
function dexDetail(id, filter, view = 'dot') {
  const m = getSpecies(id), seen = state.seen.includes(id), credit = PHOTO_CREDITS[id], hasForms = m.forms === 2;
  const photo = seen && view === 'photo' && credit, dotId = view === 'form2' && hasForms ? `${id}-2` : String(id);
  const picture = photo
    ? `<figure class="dex-photo"><img src="${assetURL(photoKey(id))}" alt="${esc(credit.name)} 실제 사진" loading="lazy"><figcaption>사진: ${esc(credit.by)} · ${esc(LICENSE_TEXT[credit.license] || credit.license)}${credit.note ? `<br>${esc(credit.note)}` : ''}</figcaption></figure>`
    : `<canvas data-portrait="${dotId}" width="160" height="160" style="${seen ? '' : 'filter:brightness(0) opacity(.2)'}"></canvas>`;
  const toggles = seen ? `<div class="dex-view">${[['dot', '도트 그림'], ...(hasForms ? [['form2', '변환폼']] : []), ...(credit ? [['photo', '실제 사진 보기']] : [])].map(([v, label]) => `<button data-view="${v}" class="${view === v ? 'selected' : ''}" aria-pressed="${view === v}">${label}</button>`).join('')}</div>` : '';
  const statBars = seen && m.base ? `<div class="base-stats" aria-label="기본 능력치">${[['체력', 'hp'], ['공격', 'attack'], ['방어', 'defense'], ['스피드', 'speed']].map(([l, k]) => `<div><span>${l}</span><i><b style="width:${Math.round(m.base[k] / 140 * 100)}%"></b></i><em>${m.base[k]}</em></div>`).join('')}</div>` : '';
  const legendNote = m.legendary ? `<br><strong>전설의 우산몬</strong>${hasForms ? ' · 결투에서 형태변환을 쓸 수 있어요' : ''}` : '';
  openModal(head(seen ? m.name : '아직 만나지 못한 친구', `NO.${String(id).padStart(3, '0')}${m.legendary ? ' · 전설' : ''}`) + `<div class="monster-detail${photo ? ' with-photo' : ''}">${picture}<div><span class="type-chip">${seen ? TYPES[m.type].name : '발견 전'}</span><p>${seen ? m.detail : `${ZONES[m.zone].name} 부근에서 단서를 찾아보세요.`}</p>${whenNote(m.id) ? `<p class="when-note">🕒 ${esc(whenNote(m.id))}</p>` : ''}${seen ? `<p class="trait-line">${traitChip(m)} ${esc(traitOf(m.id).text)}</p>` : ''}</div></div>${toggles}${statBars}${seen ? `<div class="fact-box"><strong>실제 생물 모티브 · ${m.motif}</strong><br>${esc(m.area)} · ${esc(m.group)}<br>기록 확인: ${esc(m.recordStatus)}<br>${esc(m.recordNote)}${legendNote}<br>모습과 능력은 게임용 창작이에요.${m.source ? `<br><span class="source-link">관련 자료: ${esc(sourceCite(m.source))}</span>` : ''}</div>` : ''}<div class="modal-actions"><button id="backDex" class="neutral">← 도감으로</button></div>`, () => {
    $('#backDex').onclick = () => showDex(filter);
    $$('[data-view]').forEach(b => b.onclick = () => dexDetail(id, filter, b.dataset.view));
  });
}
// ── 세계 지도: 두 섬을 그린 그림 지도. 가 본 마을을 누르면 바로 이동해요. ──
// 자리(320×200 지도 칸)는 실제 지명의 대략적인 방향을 따랐어요. 섬 모양은 게임용 그림이에요.
// v0.86 세계 지도: 국토지리정보원 독도 지명 고시 좌표로 섬 모양·지명 자리를 그려요(울릉도만 왼쪽 위에 작게).
//   [이름, 경도 초(131°51′40″부터), 위도 초(37°14′20″부터)] — 1초 ≈ 동서 24.6m · 남북 30.9m
const DOKDO_NAMES = [['우산봉', 30.4, 6.8], ['대한봉', 14.6, 10.6], ['탕건봉', 15.9, 16.8], ['물골', 11.9, 13.0], ['천장굴', 30.3, 4.5], ['큰가제바위', 9.9, 29.9], ['작은가제바위', 11.6, 28.6], ['지네바위', 7.3, 16.6], ['넙덕바위', 2.5, 8.6], ['군함바위', 5.1, 10.3],
  ['김바위', 18.1, 16.8], ['보찰바위', 2.4, 2.6], ['삼형제굴바위', 22.6, 13.1], ['닭바위', 27.2, 8.8], ['춧발바위', 29.8, -2.8], ['촛대바위', 22.1, 8.0], ['미역바위', 20.8, 8.4], ['물오리바위', 39.9, 4.5], ['숫돌바위', 24.3, 1.4],
  ['부채바위', 24.6, -0.5], ['얼굴바위', 32.1, 0.6], ['독립문바위', 38.4, 3.9], ['한반도바위', 34.5, 6.2], ['코끼리바위', 7.2, 6.1], ['해녀바위', 27.8, -1.8], ['전차바위', 30.2, -0.8]];
const wmM = ([lo, la]) => [lo * 24.57, la * 30.87], wmPx = ([mx, my]) => [Math.round(104 + mx * .17), Math.round(193 - (my + 124) * .17)];
const WM_SIDE = { town1: 'l', town2: 'r', town3: 'r', town4: 'l', town5: 'l', town6: 'l', town7: 'r' }; // 가까운 마을끼리 이름표가 겹치지 않게 옆으로
const WM_AT = Object.fromEntries(DOKDO_NAMES.map(([n, lo, la]) => [n, wmPx(wmM([lo, la]))]));
// 섬 둘레(미터, 고시 좌표의 바위·봉우리를 둘러 그린 대략 모양)
const WM_ISLANDS = [{ name: '서도', peak: '대한봉', poly: [[230, 190], [300, 165], [390, 170], [460, 200], [495, 260], [500, 330], [470, 400], [440, 470], [420, 540], [380, 555], [345, 520], [320, 470], [285, 420], [255, 370], [230, 300], [215, 240]] },
  { name: '동도', peak: '우산봉', poly: [[610, 40], [640, -20], [700, -60], [735, -80], [780, -10], [840, 40], [900, 80], [935, 120], [900, 170], [840, 215], [780, 260], [700, 275], [650, 240], [615, 170], [600, 100]] }];
const WORLD_SPOTS = { town0: [26, 24], town1: WM_AT['우산봉'], town2: WM_AT['한반도바위'], town3: WM_AT['탕건봉'], town4: wmPx(wmM([13.5, 19.6])), town5: wmPx(wmM([9.2, 7.0])), town6: WM_AT['물골'], town7: WM_AT['대한봉'] };
const ROUTE_SPOTS = { route0: WM_AT['숫돌바위'], route1: WM_AT['천장굴'], route2: WM_AT['독립문바위'], route3: WM_AT['촛대바위'], route4: WM_AT['보찰바위'], route5: WM_AT['군함바위'], route6: wmPx(wmM([13.2, 11.8])) };
const ROUTE_BENDS = { route0: [[30, 60], [44, 170]] };
function drawWorldMap(c) {
  const g = c.getContext('2d'), W = c.width, H = c.height; g.imageSmoothingEnabled = false;
  const img = g.createImageData(W, H), px = img.data;
  const rnd = (x, y) => { const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return v - Math.floor(v); };
  const isl = WM_ISLANDS.map(s => ({ ...s, pts: s.poly.map(wmPx), pk: s.peak && DOKDO_NAMES.find(n => n[0] === s.peak) && WM_AT[s.peak] }));
  const inside = (pts, x, y) => { let o = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) o = !o; } return o; };
  const edge = (pts, x, y) => { let d = 1e9; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [ax, ay] = pts[j], [bx, by] = pts[i], vx = bx - ax, vy = by - ay, t = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy || 1))); d = Math.min(d, Math.hypot(x - ax - vx * t, y - ay - vy * t)); } return d; };
  const set = (i, c) => { px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = 255; };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4; let land = -1, at = null;
    for (const s of isl) { const e = edge(s.pts, x + .5, y + .5) + (rnd(x >> 1, y >> 1) - .5) * .7, d = (inside(s.pts, x + .5, y + .5) ? e : -e) / 25; if (d > land) { land = d; at = s; } }
    if (land < 0) {
      const wave = (x % 14 < 5) && (y + (x >> 3) * 3) % 11 === 0 && rnd(x >> 4, y) > .45;
      if (land > -.03) set(i, [43, 38, 34]); else if (land > -.07) set(i, [255, 255, 255]); else if (land > -.16) set(i, [142, 212, 239]); else set(i, wave ? [166, 220, 242] : [74, 169, 216]);
      continue;
    }
    const pk = at.pk ? Math.hypot(x - at.pk[0], y - at.pk[1]) / 12 : 9;
    if (land < .05) set(i, [108, 85, 71]); else if (land < .1) set(i, (x + y) % 5 === 0 ? [142, 112, 90] : [155, 125, 101]); else if (land < .12) set(i, [95, 158, 71]);
    else if (pk < .35) set(i, (x * 3 + y) % 7 === 0 ? [142, 112, 90] : [179, 160, 138]); else if (pk < .45) set(i, [108, 85, 71]);
    else set(i, (x * 7 + y * 3) % 23 === 0 ? [108, 179, 80] : [143, 209, 106]);
  }
  // 고시된 바위(섬 밖에 있는 것)는 작은 바위 점으로
  for (const [n] of DOKDO_NAMES) { const [x, y] = WM_AT[n]; if (isl.some(s => inside(s.pts, x, y)) || /봉$|물골|천장굴/.test(n)) continue; const r = /가제|군함/.test(n) ? 2 : 1;
    for (let yy = -r - 1; yy <= r + 1; yy++) for (let xx = -r - 1; xx <= r + 1; xx++) { const d = xx * xx + yy * yy, k = ((y + yy) * W + x + xx) * 4; if (k < 0 || k >= px.length) continue; if (d <= r * r) set(k, xx + yy < 0 ? [179, 160, 138] : [124, 99, 80]); else if (d <= (r + 1) * (r + 1)) set(k, [43, 38, 34]); } }
  g.putImageData(img, 0, 0);
  // 울릉도 (작게 줄인 그림): 왼쪽 위 네모 안. 실제로는 독도에서 서북서쪽으로 약 87.4km 떨어져 있어요.
  g.fillStyle = '#2b2622'; g.fillRect(0, 0, 66, 48); g.fillStyle = '#4aa9d8'; g.fillRect(2, 2, 62, 44); g.fillStyle = '#ffffff'; g.fillRect(2, 2, 62, 1);
  g.fillStyle = '#2b2622'; g.beginPath(); g.ellipse(28, 24, 22, 17, -.3, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#9b7d65'; g.beginPath(); g.ellipse(28, 24, 21, 16, -.3, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#4f8a4a'; g.beginPath(); g.ellipse(28, 23, 18, 13, -.3, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#78ad5c'; g.beginPath(); g.ellipse(25, 20, 10, 7, -.3, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#2f5e3e'; g.fillRect(25, 18, 4, 3);
  g.fillStyle = '#ffffff'; g.fillRect(36, 34, 4, 2);
  // 마을 → 길(대표 바위 자리) → 다음 마을을 잇는 점선(섬 사이는 배)
  const towns = MAPS.filter(m => m.kind === 'town');
  g.lineWidth = 2; g.setLineDash([3, 3]);
  towns.slice(0, -1).forEach((t, i) => {
    const route = `route${i}`, a = WORLD_SPOTS[t.id], b = WORLD_SPOTS[`town${i + 1}`];
    const walked = state.visited.includes(i + 1);
    g.strokeStyle = map.id === route ? '#ffe28a' : walked ? '#fff6dc' : '#ffffff88';
    g.beginPath(); g.moveTo(...a); for (const p of ROUTE_BENDS[route] || []) g.lineTo(...p); if (ROUTE_SPOTS[route]) g.lineTo(...ROUTE_SPOTS[route]); g.lineTo(...b); g.stroke();
  });
  g.setLineDash([]);
}
function showMap() {
  const towns = MAPS.filter(m => m.kind === 'town'), routes = MAPS.filter(m => m.kind === 'route');
  const pct = ([x, y]) => `left:${Math.min(92, Math.max(8, x / 320 * 100)).toFixed(2)}%;top:${Math.min(87, Math.max(13, y / 200 * 100)).toFixed(2)}%`; // markers stay inside the picture
  const routeSpot = r => ROUTE_SPOTS[r.id] || WORLD_SPOTS[`town${r.zone}`];
  const townMarks = towns.map((t, i) => {
    const visited = state.visited.includes(t.zone), here = (map.def.town || map.id) === t.id, badge = state.badges.includes(t.zone);
    const status = here ? '지금 여기' : visited ? '눌러서 바로 이동' : '아직 가 보지 않은 곳';
    return `<button class="wm-town ${WM_SIDE[t.id] || ''} ${here ? 'here' : ''} ${visited ? 'visited' : 'locked'}" style="${pct(WORLD_SPOTS[t.id])}" data-zone="${t.zone}" ${!visited || here ? 'disabled' : ''} aria-label="${esc(t.name)} · ${status}"><i>${here ? '★' : visited ? (badge ? '✓' : ZONES[t.zone].icon) : '?'}</i><span>${String(i + 1).padStart(2, '0')} ${esc(visited ? t.name : '???')}</span></button>`;
  }).join('');
  const routeMarks = routes.map(r => `<span class="wm-route ${map.id === r.id ? 'here' : ''}" style="${pct(routeSpot(r))}">${map.id === r.id ? '★ ' : ''}${esc(state.visited.includes(r.zone + 1) || map.id === r.id ? r.name : '…')}</span>`).join('');
  openModal(head('울릉도·독도 탐험 지도', '실제 지명 · 마을과 길은 게임 속 창작') + `<p>가 본 마을을 누르면 바로 이동해요(동료도 회복). 처음 가는 곳은 점선 길을 따라 걸어가요.</p>
    <div class="world-map"><canvas id="worldMapArt" width="320" height="200" aria-hidden="true"></canvas><span class="wm-island small" style="left:10%;top:27%">울릉도</span><span class="wm-ferry" style="left:6%;top:64%">⛴ 약 87.4km</span><span class="wm-island" style="left:51%;top:66%">서도</span><span class="wm-island" style="left:75%;top:82%">동도</span>${DOKDO_NAMES.map(([n]) => `<span class="wm-name" style="${pct(WM_AT[n])}">${esc(n)}</span>`).join('')}<span class="wm-compass" aria-hidden="true">N<br>▲</span>${routeMarks}${townMarks}</div>
    <div class="wm-legend"><span><i class="here">★</i> 지금 여기</span><span><i class="visited">✓</i> 인증 받은 마을</span><span><i class="visited">≈</i> 가 본 마을</span><span><i class="locked">?</i> 아직 못 가 본 곳</span></div>
    <button class="text-button wm-names-btn" id="wmNames">📍 고시된 독도 지명 ${DOKDO_NAMES.length}곳 보기</button><p class="footer-note">독도의 섬 모양과 지명 자리는 국토지리정보원 독도 지명 고시 좌표를 따랐어요(섬 둘레는 대략). 마을·건물·길은 게임 속 창작이에요. 울릉도는 실제로 훨씬 크고 멀리(약 87.4km) 있어서 왼쪽 위에 작게 줄여 그렸어요.</p>`, () => {
    drawWorldMap($('#worldMapArt')); $('#wmNames').onclick = e => { const on = $('.world-map').classList.toggle('show-names'); e.currentTarget.textContent = on ? '📍 지명 숨기기' : `📍 고시된 독도 지명 ${DOKDO_NAMES.length}곳 보기`; };
    $$('[data-zone]').forEach(b => b.onclick = () => travel(Number(b.dataset.zone)));
  });
}
async function travel(zone) {
  if (battle || !state.started || !state.visited.includes(zone)) return;
  const boat = crossesSea(map.def.town || map.id, townId(zone));
  closeModal(); await changeMap(townId(zone), 'a', { heal: true });
  toast(`${boat ? '배를 타고 ' : ''}${map.name}에 도착했어요. 동료들도 기운을 되찾았어요.`);
}
// ── 독도 지킴이 도장 (v0.47): 지킴이를 이기면 모험 수첩에 도장이 찍혀요 ──
function stampHTML(i, fresh = false) {
  const zone = ZONES[i], got = state.badges.includes(i);
  return got
    ? `<div class="stamp-slot earned${fresh ? ' fresh' : ''}" title="${esc(keeperName(zone))}"><span class="stamp">${stampSVG(i)}</span><small>${esc(zone.badge)} · ${esc(zone.boss)}</small></div>`
    : `<div class="stamp-slot"><span class="stamp empty" aria-label="아직 받지 않은 도장">${zone.icon}</span><small>${esc(zone.name)}</small></div>`;
}
function stampsHTML(fresh = -1) { return ZONES.map((_, i) => stampHTML(i, i === fresh)).join(''); }
function stampCeremony(zone, then) {
  const z0 = ZONES[zone];
  modalReturn = then || null;
  openModal(head('도장을 받았어요!', `${keeperName(z0)} · 도장 ${state.badges.length} / 8`) + `<p class="stamp-line">쾅! <b>${esc(keeperName(z0))}</b>의 ‘${esc(z0.badge)}’ 도장이 찍혔어요.</p><div class="badge-grid stamp-book">${stampsHTML(zone)}</div><div class="modal-actions"><button id="stampClose" class="primary">수첩 덮기</button></div>`, () => {
    $('#stampClose').onclick = closeModal; setTimeout(() => { sfx('stampThud'); jingle('stamp'); }, 380);
  });
}
// ── 공부 수첩 (v0.47): [독도 공부] 쪽 읽기 · [배움의 기록] 학습 기록 ──
const studyRead = () => STUDY_PAGES.filter(p => state.flags[`study:${p.id}`]).length;
function noteTabs(active) { return `<div class="note-tabs" role="tablist">${[['study', '독도 공부'], ['record', '배움의 기록']].map(([k, l]) => `<button role="tab" data-tab="${k}" class="${active === k ? 'selected' : ''}" aria-selected="${active === k}">${l}</button>`).join('')}</div>`; }
function bindTabs() { $$('[data-tab]').forEach(b => b.onclick = () => b.dataset.tab === 'study' ? showStudy() : showNotebook()); }
const sourceOf = r => typeof r === 'number' ? SOURCES[r] : typeof r === 'string' ? SOURCES.find(s => s.url === r) : r;
function showStudy(pageId = null) {
  const at = STUDY_PAGES.findIndex(p => p.id === pageId), p = STUDY_PAGES[at];
  if (!p) {
    openModal(head('공부 수첩', `독도 공부 · 읽은 쪽 ${studyRead()} / ${STUDY_PAGES.length}`) + noteTabs('study') + `<p>독도에 관한 지식을 언제든 펼쳐 읽어요. 다 읽은 쪽은 ‘확인 문제’로 스스로 점검해 봐요.</p><div class="study-grid">${STUDY_PAGES.map((q, i) => { const read = !!state.flags[`study:${q.id}`]; return `<button class="study-card${read ? ' read' : ''}" data-page="${q.id}"><span class="study-icon" aria-hidden="true">${q.icon}</span><strong>${i + 1}. ${esc(q.title)}</strong><small>${read ? '읽음 ✓' : '아직 안 읽음'}</small></button>`; }).join('')}</div>`, () => {
      bindTabs(); $$('[data-page]').forEach(b => b.onclick = () => showStudy(b.dataset.page));
    });
    return;
  }
  if (state.started && !state.flags[`study:${p.id}`]) { state.flags[`study:${p.id}`] = true; save(); updateUI(); }
  const timeline = p.timeline ? `<ol class="study-timeline">${p.timeline.map(([y, t]) => `<li><b>${esc(y)}</b><span>${esc(t)}</span></li>`).join('')}</ol>` : '';
  const quiz = p.concepts.map(c => `<button class="primary" data-review="${c}" ${!state.started ? 'disabled' : ''}>확인 문제 · ${esc(CONCEPTS.find(x => x.id === c).title)}</button>`).join('');
  const refs = p.sources.map(sourceOf).filter(Boolean).map(r => `<span class="source-link">${esc(r.title)}</span>`).join('');
  openModal(head(p.title, `독도 공부 수첩 · ${at + 1} / ${STUDY_PAGES.length}`) + noteTabs('study') + `<ul class="study-points">${p.points.map(t => `<li>${esc(t)}</li>`).join('')}</ul>${timeline}<div class="modal-actions study-quiz">${quiz}</div><div class="modal-actions study-nav"><button id="studyPrev" class="neutral" ${at === 0 ? 'disabled' : ''}>← 앞 쪽</button><button id="studyIndex" class="neutral">목차</button><button id="studyNext" class="neutral" ${at === STUDY_PAGES.length - 1 ? 'disabled' : ''}>다음 쪽 →</button></div><div class="study-sources"><strong>근거 자료</strong>${refs}</div>`, () => {
    bindTabs();
    $('#studyPrev').onclick = () => showStudy(STUDY_PAGES[at - 1]?.id); $('#studyNext').onclick = () => showStudy(STUDY_PAGES[at + 1]?.id); $('#studyIndex').onclick = () => showStudy();
    $$('[data-review]').forEach(b => b.onclick = () => beginStudy('review', b.dataset.review));
  });
}
function showNotebook() {
  openModal(head('공부 수첩', `배움의 기록 · 발견한 개념 ${Object.keys(state.learning).length}/12`) + noteTabs('record') + `<p>게임 레벨과 배움의 기록은 달라요. 힌트 없이 해결한 경험과 여러 번의 학습을 함께 살펴봐요.</p>${CONCEPTS.map(c => { const r = state.learning[c.id]; const status = !r ? '아직 발견 전' : r.independent >= 3 && r.sessions.length >= 2 ? '반복 확인 중' : r.independent ? '혼자 해결한 경험' : '도움받아 배우는 중'; return `<div class="knowledge-row"><div><strong>${c.title}</strong><small>${c.standard} · ${status}</small><small>독립 정답 ${r?.independent || 0} · 학습 세션 ${r?.sessions.length || 0}</small></div><button data-review="${c.id}" ${!state.started ? 'disabled' : ''}>다시 보기</button></div>`; }).join('')}<div class="modal-actions"><button id="exportLearning" class="neutral">학습 기록 내려받기</button><button id="sourceBtn" class="neutral">학습 자료 출처</button></div><p class="footer-note">이 기록만으로 성취기준 도달을 확정하지 않아요. 학생의 설명과 지연 확인을 함께 살펴보세요.</p>`, () => {
    bindTabs(); $$('[data-review]').forEach(b => b.onclick = () => beginStudy('review', b.dataset.review)); $('#exportLearning').onclick = exportLearning; $('#sourceBtn').onclick = showSources;
  });
}
function showSources() {
  openModal(head('사실과 창작을 구분해요') + `<p>지역 이름은 실제 독도의 지명이에요. 우산몬·마을·건물·NPC 대사·기억의 세계는 창작입니다. 배경음악과 효과음도 이 게임을 위해 새로 지은 곡으로, 녹음한 소리 파일 없이 브라우저가 그 자리에서 만들어요(우리 5음 음계와 세마치·굿거리·자진모리·휘모리 장단을 본떴어요). 시간을 건너온 조상님 이서부·이규운·안응복·심흥탁·홍순팔도 창작 인물이고, 그들이 들려주는 이사부·이규원·안용복·심흥택·홍순칠의 활동은 실제 기록이에요. 실제 역사와 자연은 아래 자료를 바탕으로 살펴봐요. 타이틀 그림은 생성형 AI로 만든 그림을 실제 독도(동도의 등대·경비대 건물·태극기, 맞은편 서도, 괭이갈매기)에 맞게 다듬어 썼어요.</p><h3 class="source-head">문제와 공부 수첩의 자료</h3><p>문제 ${QUESTIONS.length}개는 모두 아래 공공 자료 가운데 하나에 근거해요. 이용 조건이 분명한 곳만 골랐어요. 한국민족문화대백과사전 본문은 저작권법 제24조의2(공공저작물의 자유이용)에 따라, 정책브리핑 글은 공공누리 제1유형(출처표시)에 따라 출처를 밝히고 썼어요. 문제와 해설은 자료의 사실을 초등학생 눈높이로 새로 쓴 글이에요.</p><div class="resource-list">${SOURCES.map(s => `<div class="resource-item">${esc(s.title)}<small>${esc(s.license)} · 문제 ${QUESTIONS.filter(q => q.source === s.url).length}개</small></div>`).join('')}<div class="resource-item">교육부 · 2022 개정 교육과정 고시</div></div><div class="fact-box">중심 성취기준: 사회 [6사01-02]<br>자료 신뢰성: 국어 [6국06-02]<br>생태계 보전: 과학 [4과14-01~03]의 선수학습 복습</div><p class="footer-note">개별 생물 모티브는 도감의 자료 링크에서 확인할 수 있어요. 수업 효과는 아직 검증하지 않았어요.</p>`);
}
function exportLearning() {
  const quote = v => '"' + String(v).replace(/"/g, '""') + '"';
  const rows = [['문항', '개념', '정답', '도움받음', '학습세션', '시각', '학습상황', '전투단계', '상대우산몬', '지역'], ...state.answerLog.map(a => [a.q, CONCEPTS.find(c => c.id === a.concept)?.title || a.concept, a.correct ? '1' : '0', a.assisted ? '1' : '0', a.session, new Date(a.time).toISOString(), a.mode || 'study', a.phase || '', a.opponent ? getSpecies(a.opponent).name : '', Number.isInteger(a.zone) ? ZONES[a.zone].name : ''])];
  download('dokdomon-learning.csv', '﻿' + rows.map(r => r.map(quote).join(',')).join('\r\n'), 'text/csv;charset=utf-8');
}
function download(fileName, content, type = 'application/json') { const blob = new Blob([content], { type }), url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = fileName; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
function showMenu() {
  if (battle) { toast('결투를 마친 뒤 메뉴를 열어 주세요.'); return; }
  openModal(head('모험 메뉴', `DOKDO EXPLORERS · BUILD ${VERSION}`) + `<div class="sound-settings" aria-label="소리 설정"><strong>소리</strong><label><span>배경음악</span><input id="musicVol" type="range" min="0" max="100" step="5" value="${Math.round(audioPrefs().music * 100)}"></label><label><span>효과음</span><input id="sfxVol" type="range" min="0" max="100" step="5" value="${Math.round(audioPrefs().sfx * 100)}"></label><button id="soundToggle" class="neutral">${isOn() ? '소리 끄기' : '소리 켜기'}</button><label class="music-pick"><span>배경음악 듣기</span><select id="musicPick"><option value="">지금 있는 곳의 음악</option>${Object.entries(TRACKS).map(([id, t]) => `<option value="${id}">${t.name}</option>`).join('')}</select></label></div><div class="sound-settings hand-settings" aria-label="조작 설정"><strong>조작 손</strong><button id="handToggle" class="neutral">${handLabel()}</button></div><div class="sound-settings hand-settings" aria-label="계절 설정"><strong>계절</strong><select id="seasonPick" aria-label="계절 고르기"><option value="flow">시간 따라 바뀌기 · 한 계절 5분</option><option value="auto">달력 따라 (지금 ${SEASON_NAME[seasonOfMonth(new Date().getMonth())]})</option>${['spring', 'summer', 'autumn', 'winter'].map(s => `<option value="${s}">${SEASON_ICON[s]} ${SEASON_NAME[s]}</option>`).join('')}</select></div><div class="sound-settings hand-settings" aria-label="낮과 밤 설정"><strong>낮·밤</strong><select id="dayPick" aria-label="낮과 밤"><option value="flow">흐르기 · 하루 2분 30초</option><option value="day">항상 낮</option></select></div><div class="sound-settings hand-settings" aria-label="날씨 설정"><strong>날씨</strong><select id="weatherPick" aria-label="날씨"><option value="flow">바뀌기 · 비와 눈이 와요</option><option value="clear">늘 맑음</option></select></div><div class="sound-settings hand-settings" aria-label="그래픽 품질"><strong>그래픽</strong><select id="gfxPick" aria-label="그래픽 품질"><option value="0">낮음 · 가볍게(오래된 기기)</option><option value="1">보통</option><option value="2">높음 · 빛 먼지·물 반짝임</option></select></div><div class="settings-grid"><button id="menuSave" class="neutral" ${!state.started ? 'disabled' : ''}>▣ 지금 저장하기</button><button id="exportSave" class="neutral" ${!state.started ? 'disabled' : ''}>↓ 저장 파일 내려받기</button><label class="neutral">↑ 저장 파일 불러오기 <input id="importSave" type="file" accept="application/json,.json"></label><button id="menuLearn" class="neutral">✎ 공부 수첩 · 배움의 기록 내보내기</button><button id="menuSources" class="neutral">학습 자료와 출처</button><button id="menuHelp" class="neutral">조작 방법</button><button id="menuOpening" class="neutral" ${!state.started ? 'disabled' : ''}>오프닝 다시 보기</button><button id="menuTutorial" class="neutral" ${!state.started ? 'disabled' : ''}>튜토리얼 다시 하기</button><button id="menuAvatar" class="neutral" ${!state.started ? 'disabled' : ''}>탐험대원 바꾸기</button><button id="restartBtn" class="neutral danger">새로운 모험</button></div><p class="footer-note">진행은 현재 브라우저에 저장돼요. 다른 기기에서는 저장 파일을 불러와 이어갈 수 있어요. 서버에 학생 이름이나 기록을 전송하지 않아요.</p>`, () => {
    $('#musicVol').oninput = e => setVolume('music', e.target.value / 100);
    $('#musicPick').onchange = e => { musicPreview = e.target.value || null; if (musicPreview && !isOn()) { setOn(true); $('#soundToggle').textContent = '소리 끄기'; updateUI(); } };
    $('#sfxVol').oninput = e => setVolume('sfx', e.target.value / 100); $('#sfxVol').onchange = () => sfx('correct');
    $('#handToggle').onclick = e => { setHand(!leftHanded); e.target.textContent = handLabel(); };
    $('#weatherPick').value = weatherChoice(); $('#weatherPick').onchange = e => { setWeather(e.target.value); $('#weather').textContent = weatherText(); };
    $('#gfxPick').value = String(gfxQ); $('#gfxPick').onchange = e => { setQuality(e.target.value); toast(['그래픽 낮음: 가볍게 그려요(그림자·화면 효과 끔).', '그래픽 보통으로 그려요.', '그래픽 높음: 선명하게, 빛 먼지와 물 반짝임까지 그려요.'][gfxQ]); };
    $('#dayPick').value = dayNightChoice(); $('#dayPick').onchange = e => { setDayNight(e.target.value); $('#weather').textContent = weatherText(); };
    $('#seasonPick').value = seasonChoice(); $('#seasonPick').onchange = e => { const s = setSeason(e.target.value); $('#weather').textContent = weatherText(); toast(`${SEASON_ICON[s]} ${SEASON_NAME[s]}이 왔어요.`); };
    $('#soundToggle').onclick = e => { setOn(!isOn()); e.target.textContent = isOn() ? '소리 끄기' : '소리 켜기'; updateUI(); };
    $('#menuSave').onclick = () => save(true); $('#exportSave').onclick = () => download('dokdomon-save.json', JSON.stringify(state, null, 2));
    $('#menuLearn').onclick = () => showStudy(); $('#menuSources').onclick = showSources;
    $('#menuOpening').onclick = async () => { closeModal(); await playStory({ id: 'opening', scenes: OPENING.scenes }); };
    $('#menuTutorial').onclick = () => { closeModal(); state.tutorial = { battle: false, walk: 0 }; save(); renderCoachPanel(); startTutorial(); };
    $('#menuAvatar').onclick = () => chooseAvatar(id => { state.avatar = id; save(); updateUI(); toast('탐험대원을 바꿨어요.'); });
    $('#restartBtn').onclick = () => { saved = state.started ? state : saved; startNew(); };
    $('#menuHelp').onclick = () => openModal(head('천천히, 함께 탐험해요') + '<div class="fact-box">이동: 방향키 / WASD / 조이스틱(터치 화면) / 지도 화면 누르기<br>화면: 비스듬히 내려다보는 HD-2D예요. 위쪽이 북쪽이고, 칸에 얽매이지 않고 자유롭게 걸어요. 건물이 내 캐릭터를 가리면 그 둘레가 비쳐 보여요. 메뉴의 ‘그래픽’에서 낮음·보통·높음을 골라요. 왼손잡이는 ‘조작 손’에서 조이스틱 자리를 바꿔요<br>건물: 문 바로 아래에서 위로 걸으면(또는 건물을 누르면) 들어가요. 계단을 밟으면 위아래 층으로, 문 깔개를 밟으면 밖으로 나가요<br>대화·조사: 가까이에서 E·스페이스 / 대화 버튼<br>자동 안내: 수첩의 목적지 안내<br>다음 지역: 독도 지킴이 인증 후 마을 오른쪽 다리 → 길을 따라 걷기<br>세계 지도: 가 본 마을로 바로 이동<br>결투 명령: 기록 찾기 · 동료 만들기 · 도구 · 동료 · 물러나기 (전설의 우산몬은 형태변환도)<br>기록 찾기: 누르면 독도 문제가 나와요. 맞히면 위쪽 두루마리(검은 기운이 지운 기록)의 빈칸이 채워져요. 문제에 따라 나침반·순서 놓기·근거 카드로 풀고, 검은 기운이 밀려올 때는 ○ ×로 빠르게 판단해요<br>상성(화살표 앞이 뒤에 강해요): 잎→빛→메아리→잎, 파도→바위→바람→파도. 상성이 좋으면 맞혔을 때 1.5배, 틀려도 절반은 닿아요. 상성이 나쁘면 0.75배<br>사나워진 우산몬: 문제를 맞히면 검은 기운을 걷어 내요. 모두 걷히면 평온을 되찾아요<br>상대의 문제: 맞히면 충격이 40% 줄고, 틀리면 그대로 받아요. 독도 지킴이·백무 사장은 가끔 정답도 뚫고 들어와요(관통)<br>동료 만들기: 버튼을 누르면 확률로 동료가 돼요(그 차례엔 공격 못 해요). 검은 기운이 적을수록 잘 되고, 전설의 우산몬은 10%<br>동료 보관함: 함께 다니는 동료는 4마리예요. 화면 아래 ‘동료’ 단추를 누르면 보관함이 열리고, 쉬는 동료와 언제든 바로 바꿔요<br>특성: 우산몬마다 결투에서 저절로 쓰이는 특별한 능력이 하나씩 있어요(30가지). 동료 보관함과 도감에서 볼 수 있어요<br>독도 지킴이와는 인증 결투로 겨뤄요<br>힌트: 문제 아래 기록 힌트 · 학습 기록에 도움 표시<br>대화와 컷신: 클릭·엔터·스페이스로 넘기기</div>' + typeRingHTML() + '<p>길에서는 표지판, 관찰 지점, 기억 비석, 조사 상자, 길에서 만난 사람과 몽땅랜드 직원을 찾아봐요. 사나워진 야생 우산몬은 마을과 마을 사이의 길 위를 걸어 다녀요.</p>');
    $('#importSave').onchange = async e => { const file = e.target.files[0]; if (!file) return; try { if (file.size > 3e6) throw new Error('파일이 너무 커요.'); const parsed = validateSave(JSON.parse(await file.text())); saved = parsed; closeModal(); continueGame(); toast('저장한 모험을 불러왔어요.'); } catch (err) { toast(err.message || '저장 파일을 확인해 주세요.'); } };
  });
}
function showEnding() {
  openModal(head('울릉도와 독도의 기억을 되찾았어요', '두 섬의 수호사 · 여덟 개의 지킴이 도장') + `<div class="end-screen"><canvas data-portrait="100" width="160" height="160"></canvas><h2>모험은 기억으로 남아요.</h2><p>우산몬과 함께 걸으며 자연과 역사를 만났어요.<br>이제 확인한 사실을 여러분의 말로 전해 주세요.</p><div class="fact-box">수호사 인증 ${state.badges.length}/8 · 동료 ${state.caught.length}/100<br>발견한 개념 ${Object.keys(state.learning).length}/12 · 기록한 답변 ${state.answerLog.length}개</div><div class="modal-actions"><button id="endContinue" class="primary">계속 탐험하기 →</button><button id="endJournal" class="neutral">배움의 기록</button></div></div>`, () => { $('#endContinue').onclick = closeModal; $('#endJournal').onclick = showNotebook; });
}

// ── start-up ───────────────────────────────────────────────────────────────────
try { const raw = localStorage.getItem(KEY); if (raw) saved = validateSave(JSON.parse(raw)); } catch (e) { console.warn('Save recovery:', e.message); }
// 타이틀 그림(v0.47): 동도 정상에서 서도를 바라보는 두 탐험대원 — 생성형 AI로 만든 그림을 고증에 맞게 다듬어 썼어요.
$('#titleScreen').style.backgroundImage = `url("${assetURL('scenery/title-dokdo-v68.jpg')}")`;
if (saved?.started) $('#continueBtn').classList.remove('hidden');
$('#startBtn').onclick = () => { jingle('start'); startNew(); }; $('#continueBtn').onclick = () => { jingle('start'); continueGame(); };
$('#saveBtn').onclick = () => state.started ? save(true) : toast('모험을 시작하면 저장할 수 있어요.');
$('#menuBtn').onclick = showMenu; $('#mapBtn').onclick = () => { if (!battle) showMap(); }; $('#dexBtn').onclick = () => { if (!battle) showDex(); };
$('#notebookBtn').onclick = () => { if (!battle) showStudy(); }; $('#guideBtn').onclick = () => { closeModal(); guide(); };
$('#questBtn').onclick = $('#questPeek').onclick = showQuest; $('#partyBtn').onclick = $('#buddyPeek').onclick = showParty;
$('#pocketBtn').onclick = () => showStorage();
$('#fullscreenBtn').onclick = toggleFullscreen;
// 작은 지도(v0.68부터 2D·3D 모두): 내 둘레 15×15칸. 걸을 수 있는 곳은 밝게, 사람은 주황 점, 우산몬은 보라 점, 나는 바라보는 쪽을 가리키는 화살표
let miniMap = null, miniAt = 0;
function paintMiniMap(now, people) {
  if (!miniMap) { miniMap = document.createElement('canvas'); miniMap.width = miniMap.height = 120; miniMap.className = 'mini-map'; miniMap.setAttribute('aria-hidden', 'true'); scene.append(miniMap); }
  miniMap.hidden = false; if (now - miniAt < 120) return; miniAt = now;
  const g = miniMap.getContext('2d'), N = 15, S = 8, cx = Math.round(view.x), cy = Math.round(view.y);
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 120, 120);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = cx - 7 + i, y = cy - 7 + j, out = x < 0 || y < 0 || x >= map[0].length || y >= map.length, t = out ? 0 : map[y][x];
    g.fillStyle = out || t === 0 ? '#4a9fbd' : blocked(map, x, y, [], true) ? '#5c7a4c' : '#efe6c4'; g.fillRect(i * S, j * S, S, S);
  }
  for (const n of people) { const x = Math.round(n.drawX ?? n.x) - cx + 7, y = Math.round(n.drawY ?? n.y) - cy + 7; if (x < 0 || y < 0 || x >= N || y >= N || n.scenery || n.player) continue; g.fillStyle = n.kind === 'wild' || n.kind === 'friend' || n.kind === 'legend' ? '#7a3fb0' : n.actor ? '#e2702a' : '#8a6a3c'; g.fillRect(x * S + 2, y * S + 2, S - 4, S - 4); }
  g.translate(7 * S + S / 2, 7 * S + S / 2); g.rotate(in3d() ? (yaw ?? 0) : (DIR_ANGLE[state.dir] ?? 0)); g.fillStyle = '#d62828'; g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, -7); g.lineTo(5, 6); g.lineTo(0, 3); g.lineTo(-5, 6); g.closePath(); g.fill(); g.stroke();
}
// 조작 손(v0.62): 오른손잡이는 이동 조이스틱이 왼쪽·둘러보기가 오른쪽, 왼손잡이는 반대예요. 이 기기에 기억해요.
let leftHanded = false; try { leftHanded = localStorage.getItem('dokdo-hand') === 'left'; } catch { /* 기본 오른손 */ }
function setHand(left) { leftHanded = !!left; scene.classList.toggle('left-handed', leftHanded); try { localStorage.setItem('dokdo-hand', leftHanded ? 'left' : 'right'); } catch { /* 괜찮아요 */ } }
const handLabel = () => leftHanded ? '왼손잡이 · 조이스틱 오른쪽' : '오른손잡이 · 조이스틱 왼쪽';
function setView3d(on) { setGL(on); } // 시험용 고리(예전 이름): false면 2D 대체 그리기
scene.classList.add('view3d');
setHand(leftHanded);
$('#soundBtn').onclick = () => { setOn(!isOn()); if (isOn()) sfx('toggle'); updateUI(); };
window.addEventListener('beforeunload', () => save());
// 단추를 누를 때 작은 소리(결투 창은 battle-ui가 따로 내요)
document.addEventListener('click', e => { const b = e.target.closest?.('button, .party-card'); if (!b || b.disabled || b.closest('#battleScreen') || b.matches('#nextTalk, #soundBtn, #soundToggle, #startBtn, #continueBtn, #stampClose')) return; sfx('tap'); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { keys.clear(); joystick.reset(); save(); } });
setInterval(() => { if (state.started && !battle && !document.hidden) save(); }, 30000);
onAssetReady(() => { paintResidentPortrait(); paintPortraits(); paintExplorerChoices(performance.now()); if (battle) refreshBattle(); });
for (const a of Object.values(VILLAIN_ATLASES)) assetImage(a.key); // 몽땅랜드 sheets, ready before the first fight
for (const r of ['grunt', 'exec', 'boss']) assetImage(`characters/baekmudan-${r}-portrait`); // 전투 등장 그림
updateUI(); paintPortraits(); requestAnimationFrame(frame);

// Automated browser checks (open with ?test) can read and drive the game.
if (typeof location !== 'undefined' && new URLSearchParams(location.search).has('test')) {
  window.__dokdo = {
    get state() { return state; }, get battle() { return battle; }, get busy() { return busy(); }, get transition() { return transition; }, get talk() { return dialogueState; }, get map() { return map; },
    audio: () => ({ wanted: wantedMusic(), playing: currentMusic(), on: isOn() }),
    cutscene: () => cutscenes.current, people: liveNPCs, guide, interact, nextTalk, startBattle, closeModal, stampCeremony, showStudy, travel, changeMap, save, continueGame,
    motion: () => ({ view: { ...view }, walkDistance, moving, swimming: deepWater() }), walking: () => path.length > 0 || !!pathAction || !!moving, npcs: () => npcs(map, progress(), state.flags),
    playStory, stories: { OPENING, GUIDE, BOSS_REVEAL, BOSS_FALL, TREE_JOINS },
    get longestQuestion() { return QUESTIONS.reduce((m, q) => (q.prompt.length + q.options.join('').length + q.explanation.length > m.prompt.length + m.options.join('').length + m.explanation.length ? q : m)); },
    set forceQuestion(q) { testQuestion = q; }, questionById: id => QUESTIONS.find(q => q.id === id), closeBattleForTest: () => { if (battle) closeBattle(); },
    screenOf(x, y) { const r = canvas.getBoundingClientRect(), p = toScreen(x * TILE + 16, y * TILE + 16); return { x: r.left + p.x * sceneScale, y: r.top + p.y * sceneScale }; },
    get view3d() { return hdOn(); }, seabed: () => seabedLayout(map), seabedAhead, get fp() { return fp ? { name: fp.name, mode: fp.mode, yaw: fp.yaw, pitch: fp.pitch, fov: fp.fov, phase: fp.phase } : null; }, startFirstPerson, closeFP, setView3d, get look() { return { yaw, pitch }; }, setGL, get gl() { return { wanted: !force2D, mode: hdOn() ? 'hd' : '2d', ...(glView?.info || {}) }; }, setQuality, get quality() { return gfxQ; }, setWeather: v => setWeather(v), get pos() { return { x: view.x, y: view.y }; }, setLook(y, p = 0) { yaw = y; pitch = clampPitch(p); }, setHand, setClock: ms => setClock(ms), get diving() { return !!map.diving; }, toggleDive, get inWater() { return inWater(); }, get clock() { return { ms: gameClock(), hour: daylight().hour, night: isNight(), day: DAY_MS, weather: weatherNow() }; }, get music() { return musicFor(); }, setSeason: v => { const r = setSeason(v); updateUI(); return r; }, get season() { return currentSeason(); },
    standAtDoor(kind) { const b = map.buildings.find(b => b.kind === kind), f = doorFront(b); settleMovement(); freePos = null; state.x = f.x; state.y = f.y; view = { x: f.x, y: f.y }; state.dir = 'up'; return f; },
    goInside(kind) { const b = map.buildings.find(b => b.kind === kind), f = doorFront(b), p = pathfind(map, state.x, state.y, f.x, f.y, liveNPCs()); if (state.x === f.x && state.y === f.y) enterBuilding(b); else { path = p; pathAction = () => enterBuilding(b); } return p.length; },
    legendRadio: false, dexDetail, showDex, showQuest, checkLegends, place(x, y, dir = 'right') { settleMovement(); freePos = null; path = []; state.x = x; state.y = y; view = { x, y }; state.dir = dir; },
    walkToTile(x, y) { const p = pathfind(map, moving?.toX ?? state.x, moving?.toY ?? state.y, x, y, liveNPCs()); path = p; pathAction = null; return p.length; }
  };
}
