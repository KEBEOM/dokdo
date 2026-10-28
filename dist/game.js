import { PROPS_ATLAS } from './props-atlas.js';
import { TERRAIN_ATLAS } from './terrain-atlas.js';
// 독도 탐험대 v0.36 — screens, movement between maps, story cutscenes and Dragon Quest–style quiz battles.
import { CUTSCENE_ATLAS } from './cutscene-atlas.js';
import { worldScale } from './layout.js';
import { createJoystick } from './joystick.js';
import { roomId, parseRoomId } from './interiors.js';
import { MONSTERS, ZONES, TYPES, STARTERS, getSpecies, isUnique } from './data.js';
import { CONCEPTS, QUESTIONS, SOURCES } from './learning.js';
import { newState, validateSave, createMonster, damage, enemyHit, healAll, gainXP, captureChance, addMonster, recordAnswer, knownSkills, learnedBetween } from './engine.js';
import { portrait } from './sprites.js';
import { onAssetReady, preloadMonsters, assetImage } from './assets.js';
import { VILLAIN_ATLASES } from './villain-atlases.js';
import { EXPLORERS, PROFESSOR_PICTURE, paintExplorerCard, paintExplorerPortrait, drawResident } from './characters.js';
import { createNPCMotion } from './npc-motion.js';
import { MOVE_DURATION, moveView } from './movement.js';
import { selectBattleQuestion, shuffledChoices } from './battle-quiz.js';
import { createMap, npcs, blocked, pathfind, drawWorld, drawActors, TILE, W, H, wantedRole, VILLAIN_BY_ZONE } from './world.js';
import { MAPS, getMapDef, townId, nextMapId, prevMapId } from './maps.js';
import { createCutscenePlayer } from './cutscene.js';
import { OPENING, STARTER_MEET, GUIDE, LEGEND, arrivalScene, VILLAIN_TALES, BOSS_REVEAL, BOSS_FALL, TREE_JOINS, EPILOGUE, FERRY, FERRY_AGAIN } from './story.js';
import { createBattleUI } from './battle-ui.js';
import { josa } from './text.js';

const VERSION = '0.40';
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const wait = ms => new Promise(r => setTimeout(r, ms));
const KEY = 'dokdomon-save-v1';

let state = newState(), saved = null, map = createMap('town0');
let camera = { x: 0, y: 0 }, view = { x: state.x, y: state.y }, moving = null, path = [], pathAction = null;
let walks = 0, lastEncounter = 0, walkDistance = 0, battle = null, dialogueState = null, modalReturn = null, avatarChoice = null;
let lastTick = performance.now(), audioCtx = null, transition = false;
const npcMotion = createNPCMotion(); let npcFocus = null;
const keys = new Set();

const canvas = $('#world'), ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = false;
const actorCanvas = $('#actors'), actorCtx = actorCanvas.getContext('2d');
const scene = $('#gameApp');
let actorPixelRatio = 1, sceneScale = 1, sceneWidth = 768, sceneHeight = 480, labelKey = '', labelNodes = [], activePanel = null;

const cutscenes = createCutscenePlayer($('#cutscene'), { onBlip: () => beep(880, .015) });
const battleUI = createBattleUI($('#battleScreen'), { onBlip: () => beep(760, .012), onSelect: () => beep(620, .03) });

// ── basics ───────────────────────────────────────────────────────────────────
const z = () => ZONES[state.zone];
const progress = () => state.progress[state.zone];
const name = m => getSpecies(m.id).name;
const busy = () => !state.started || !$('#modal').classList.contains('hidden') || !!dialogueState || !!battle || cutscenes.active() || transition;
function liveNPCs() { const base = npcs(map, progress(), state.flags); npcMotion.sync(map.id, base); return npcMotion.snapshot(base); }

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
    const boat = crossesSea(map.id, target.id), label = boat ? (target.island === '울릉도' ? '울릉도행 배' : '독도행 배') : target.name;
    out.push({ name: dir === 'next' ? `${label} →${locked ? ' (인증 후)' : ''}` : `← ${label}`, x: x * TILE + 16, y: y * TILE - 10, exit: true, locked });
  }
  return out;
}
function paintWorldLabels(people = liveNPCs()) {
  const key = map.id + state.badges.length + '|' + people.map(n => n.uid).join('|');
  if (labelKey !== key) {
    labelKey = key; const layer = $('#worldLabels'); layer.replaceChildren();
    // 건물 이름은 문 위 간판처럼, 사람 이름은 머리 위에 — 가까이 갔을 때만 나타나서 다른 캐릭터를 가리지 않아요.
    const fixed = [...map.buildings.map(b => ({ name: b.name, x: (b.x + b.w / 2) * TILE, y: (b.y + b.h) * TILE - 46, door: { x: b.x + Math.floor(b.w / 2), y: b.y + b.h }, building: true })), ...exitLabels()];
    labelNodes = [...fixed, ...people.filter(n => n.actor).map(n => ({ name: n.name, uid: n.uid }))].map(n => {
      const el = document.createElement('span');
      el.className = n.exit ? `exit-label${n.locked ? ' locked' : ''}` : n.building ? 'building-label' : 'world-nameplate';
      el.textContent = n.name; layer.append(el); return { ...n, el };
    });
  }
  const positions = new Map(people.map(n => [n.uid, n])), talking = !!dialogueState;
  const near = (x, y, r) => Math.max(Math.abs(x - view.x), Math.abs(y - view.y)) <= r;
  // 사람 이름표는 한 명만: 2칸 안에서 가장 가까운 사람(말을 걸 상대)
  let closest = null, best = Infinity;
  for (const p of people) { if (!p.actor) continue; const px = p.drawX ?? p.x, py = p.drawY ?? p.y, d = Math.abs(px - view.x) + Math.abs(py - view.y); if (near(px, py, 2) && d < best) { best = d; closest = p.uid; } }
  for (const n of labelNodes) {
    const live = positions.get(n.uid), fixed = n.building || n.exit;
    const px = live?.drawX ?? live?.x ?? 0, py = live?.drawY ?? live?.y ?? 0;
    const wx = fixed ? n.x : px * TILE + 16, wy = fixed ? n.y : py * TILE + 28 - 48 - 24; // 48 = 캐릭터 키, 그 위 ‘!’ 표시보다 위쪽
    const x = Math.round((wx - camera.x) * sceneScale), y = Math.round((wy - camera.y) * sceneScale);
    const onScreen = x >= 0 && x <= sceneWidth * sceneScale && y >= 20 && y < sceneHeight * sceneScale - 25;
    const shown = onScreen && (n.exit || (!talking && (n.building ? near(n.door.x, n.door.y, 3) : n.uid === closest)));
    n.el.hidden = !onScreen; n.el.classList.toggle('show', shown);
    if (onScreen) { const half = (n.el.offsetWidth || n.name.length * 14 + 20) / 2; n.el.style.left = Math.round(Math.max(half + 5, Math.min(sceneWidth * sceneScale - half - 5, x))) + 'px'; n.el.style.top = y + 'px'; }
  }
}

function save(manual = false) {
  if (!state.started) return; state.savedAt = Date.now();
  try { localStorage.setItem(KEY, JSON.stringify(state)); $('#saveStatus').textContent = `${new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 저장됨`; if (manual) toast('모험을 이 기기에 저장했어요.'); }
  catch { $('#saveStatus').textContent = '기기 저장 공간을 확인하세요'; toast('자동 저장이 어려워요. 메뉴에서 저장 파일을 내려받아 주세요.'); }
}
function toast(message) { $('#toast').textContent = message; $('#toast').classList.remove('hidden'); clearTimeout(toast.timer); toast.timer = setTimeout(() => $('#toast').classList.add('hidden'), 3100); }
function beep(freq = 440, length = .06) {
  if (!state.sound) return;
  try {
    audioCtx ??= new (window.AudioContext || window.webkitAudioContext)(); audioCtx.resume();
    const o = audioCtx.createOscillator(), g = audioCtx.createGain(); o.type = 'triangle'; o.frequency.value = freq;
    g.gain.setValueAtTime(.035, audioCtx.currentTime); g.gain.exponentialRampToValueAtTime(.001, audioCtx.currentTime + length);
    o.connect(g); g.connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime + length);
  } catch { }
}
function settleMovement() { if (moving) { state.x = moving.toX; state.y = moving.toY; view = { x: state.x, y: state.y }; moving = null; } }
function resetTransient() {
  npcMotion.reset(); npcFocus = null; walkDistance = 0; avatarChoice = null; moving = null; path = []; pathAction = null; keys.clear();
  dialogueState = null; if (battle) battleUI.destroy(); battle = null; modalReturn = null; walks = 0; lastEncounter = 0; transition = false;
  $('#dialogue').classList.add('hidden'); $('#battleScreen').classList.add('hidden'); scene.classList.remove('battling', 'talking', 'map-fading');
  $('#coachPanel')?.remove(); tutorialSteps = 0;
}

// ── modal panels ───────────────────────────────────────────────────────────────
function restorePanel() { if (activePanel) { $('#panelStorage').append(activePanel); activePanel = null; } }
function openPanel(id, title, kicker) { openModal(head(title, kicker) + '<div id="panelMount"></div>', () => { activePanel = $(id); $('#panelMount').append(activePanel); }); }
function showQuest() { if (!battle) { openPanel('#questPanel', '모험 수첩', map.name); tutorialEvent('quest'); } }
function showParty() { if (!battle) openPanel('#partyPanel', '함께하는 우산몬', `동료 ${state.party.length} / 6`); }
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
  restorePanel(); $('#modal').classList.add('hidden'); $('#modalContent').innerHTML = ''; avatarChoice = null; canvas.focus({ preventScroll: true });
  if (modalReturn) { const fn = modalReturn; modalReturn = null; fn(); }
}
function head(title, kicker = '탐험 수첩', close = true) { return `<div class="modal-head"><div><span class="eyebrow">${kicker}</span><h2 id="modalTitle">${title}</h2></div>${close ? '<button class="modal-close" aria-label="닫기">✕</button>' : ''}</div>`; }
function paintPortraits() { $$('canvas[data-portrait]').forEach(c => portrait(c, Number(c.dataset.portrait))); }

// ── map dialogue ───────────────────────────────────────────────────────────────
function talk(speakerName, lines, done, note = '게임용 재구성 대화', actor = null) {
  const speaker = liveNPCs().find(n => n.name === speakerName); actor = actor || speaker?.actor || null;
  if (speaker) { npcFocus = speaker.uid; npcMotion.face(npcFocus, state); }
  settleMovement(); keys.clear(); path = []; pathAction = null;
  dialogueState = { name: speakerName, lines, index: 0, done, note, actor }; renderTalk(); beep(500);
}
function renderTalk() {
  const d = dialogueState; scene.classList.add('talking'); $('#dialogue').classList.remove('hidden');
  $('#dialogue').innerHTML = `<div class="speaker">${d.actor ? '<canvas class="resident-portrait" width="64" height="64" aria-hidden="true"></canvas>' : ''}<span class="speaker-name">${esc(d.name)}</span></div><p>${esc(d.lines[d.index])}</p><div class="dialogue-footer"><small>${esc(d.note)} · ${d.index + 1}/${d.lines.length}</small><button id="nextTalk">${d.index === d.lines.length - 1 ? '알겠어요' : '계속 듣기'} ▸</button></div>`;
  $('#nextTalk').onclick = nextTalk; paintResidentPortrait();
}
function paintResidentPortrait() { const p = $('.resident-portrait'); if (p && dialogueState?.actor) { const c = p.getContext('2d'); c.clearRect(0, 0, 64, 64); drawResident(c, dialogueState.actor, 0, 0, 64); } }
function nextTalk() {
  if (!dialogueState) return; beep(620, .035);
  if (++dialogueState.index < dialogueState.lines.length) renderTalk();
  else { const fn = dialogueState.done, who = dialogueState.note; dialogueState = null; scene.classList.remove('talking'); $('#dialogue').classList.add('hidden'); fn?.(); if (who !== '튜토리얼') tutorialEvent('talk'); updateUI(); save(); }
}
async function playStory(script, vars = {}) {
  settleMovement(); keys.clear(); path = []; pathAction = null;
  return cutscenes.play(script, { vars: { avatar: state.avatar || 'girl', ...vars } });
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
  preloadMonsters([...STARTERS, 34, 55, 9]); assetImage(PROFESSOR_PICTURE); assetImage(CUTSCENE_ATLAS.key); assetImage(PROPS_ATLAS.key); assetImage(TERRAIN_ATLAS.key);
  await playStory(OPENING);
  await playStory(STARTER_MEET); // 김박사의 연구 기지에서 세 친구를 만나요
  chooseStarter(avatar);
}
function chooseStarter(avatar) {
  scene.classList.add('story');
  openModal(head('어떤 동료와 떠날까요?', '김박사의 우산몬', false) + `<p>세 친구 모두 끝까지 함께할 수 있어요. 마음이 가는 우산몬을 골라 주세요.</p><div class="starter-grid">${STARTERS.map(id => { const m = getSpecies(id); return `<button class="starter-card" data-start="${id}"><span class="type-chip">${TYPES[m.type].name}</span><canvas data-portrait="${id}" width="128" height="128"></canvas><h3>${m.name}</h3><small>${m.motif} 모티브</small><p>${id === 1 ? '보랏빛 꽃잎의 든든한 친구' : id === 67 ? '바닷바람을 타는 날개 친구' : '긴 더듬이를 가진 바다 친구'}</p></button>`; }).join('')}</div>`, () => {
    $$('[data-start]').forEach(b => b.onclick = async () => {
      const id = Number(b.dataset.start);
      if (!state.avatar) state.avatar = avatar;
      state.started = true; addMonster(state, createMonster(id, 5)); state.active = 0;
      view = { x: state.x, y: state.y }; map = createMap(state.map); saved = state;
      closeModal(); $('#titleScreen').classList.add('hidden');
      await playStory(GUIDE, { starter: getSpecies(id).name, starterId: id });
      scene.classList.remove('story'); state.tutorial = { battle: false, walk: 0 }; updateUI(); save(); showPlaceBanner(map.def);
      startTutorial();
    });
  });
}
function continueGame() {
  if (!saved) return;
  if (!['girl', 'boy'].includes(saved.avatar)) { chooseAvatar(id => { saved.avatar = id; continueGame(); }); return; }
  resetTransient(); state = validateSave(JSON.parse(JSON.stringify(saved))); state.started = true;
  map = createMap(state.map); view = { x: state.x, y: state.y };
  if (blocked(map, state.x, state.y, liveNPCs()) || map.exits.has(`${state.x},${state.y}`)) { const s = map.spawns.a; state.x = s.x; state.y = s.y; view = { x: s.x, y: s.y }; }
  $('#titleScreen').classList.add('hidden'); scene.classList.remove('story'); updateUI(); save();
  toast('반가워요! 수첩에서 다음 목적지를 확인하세요.'); showPlaceBanner(map.def);
  if (!state.tutorial.battle) setTimeout(startTutorial, 600); else renderCoachPanel();
}

// ── HUD ────────────────────────────────────────────────────────────────────────
function questInfo() {
  if (map.kind === 'route') {
    const next = getMapDef(nextMapId(map.id)), objs = map.parsed.objects, found = objs.filter(o => state.flags[`${map.id}:${o.key}`]).length;
    return { title: `${map.name}을 따라서`, desc: `오른쪽 끝까지 걸어가면 ${next.name}에 도착해요. 표지판·관찰 지점·기억 비석도 살펴봐요. (길에서 해낸 일 ${found})`, stage: -1 };
  }
  const p = progress(), stage = !p.met ? 0 : p.studied < 2 ? 1 : !p.enemy ? 2 : !p.boss ? 3 : 4;
  const titles = [state.zone === 0 ? '우산몬의 비밀을 찾아서' : '기억 속 인물을 찾아서', '기록판의 단서를 읽어요', '빼앗긴 기록을 되찾자', `${z().boss} 관장의 시험`, state.zone === 7 ? '두 섬의 기억을 되찾았어요' : '새로운 길이 열렸어요'];
  const nextRoute = state.zone < 7 ? getMapDef(nextMapId(map.id)) : null, nextTown = state.zone < 7 ? getMapDef(townId(state.zone + 1)) : null;
  const desc = [`${z().npc}에게 말을 걸어 이 지역의 이야기를 들어보세요.`, '배운 사실과 지난 기록을 연결해 두 가지 조사를 마치세요.', `${z().enemy}에게 다가가 기록을 돌려받으세요.`, '수호관 앞에서 관장과 대화하세요. 쉼터에서 동료를 회복할 수 있어요.',
    state.zone === 7 ? '두 섬의 기억을 되찾았어요! 도감과 다른 지역의 모험이 기다려요.' : `오른쪽 다리를 건너 ‘${nextRoute.name}’을 따라 ${josa(nextTown.name, '으로/로')} 가요.`];
  return { title: titles[stage], desc: desc[stage], stage };
}
function updateUI() {
  preloadMonsters([...STARTERS, ...state.party.map(m => m.id), ...z().wild.slice(0, 6)]);
  scene.classList.toggle('playing', state.started);
  const def = map.def;
  $('#chapterTitle').textContent = state.started ? `${String(state.zone + 1).padStart(2, '0')} · ${z().subtitle}` : '독도로 떠나는 모험';
  $('#regionTag').textContent = def.kind === 'town' ? `CHAPTER ${String(state.zone + 1).padStart(2, '0')} · ${def.island}` : def.kind === 'room' ? `${def.island} · ${def.townName}` : `${def.island} · 길`;
  $('#locationName').textContent = def.name; $('#weather').textContent = z().sky;
  $('#questCounter').textContent = String(state.zone + 1).padStart(2, '0');
  const q = questInfo();
  $('#questTitle').textContent = state.started ? q.title : '첫 동료를 만나러'; $('#questDesc').textContent = state.started ? q.desc : '새로운 모험을 시작해 보세요.';
  $('#questSteps').innerHTML = state.started && q.stage >= 0 ? ['인물과 이야기하기', '기록 조사하기', '기록 되찾기', '관장 인증 받기'].map((v, i) => `<div class="quest-step ${i < q.stage ? 'done' : i === q.stage ? 'current' : ''}"><i>${i < q.stage ? '✓' : i + 1}</i>${v}</div>`).join('') : '';
  $('#badges').innerHTML = ZONES.map((zone, i) => `<span class="badge ${state.badges.includes(i) ? 'earned' : ''}" title="${zone.badge} 인증">${zone.icon}</span>`).join('');
  $('#badgeCount').textContent = `${state.badges.length} / 8`; $('#partyCount').textContent = `${state.party.length} / 6`;
  $('#dexProgress').textContent = `${state.caught.length} / 100`; $('#learningProgress').textContent = `${Object.keys(state.learning).length} / 12`; $('#dailyNote').textContent = z().fact;
  $('#soundBtn').setAttribute('aria-label', state.sound ? '소리 끄기' : '소리 켜기'); $('#soundBtn').title = state.sound ? '소리 끄기' : '소리 켜기'; $('#soundBtn').innerHTML = `♪ <span>소리 ${state.sound ? '켜짐' : '꺼짐'}</span>`;
  $('#partyCards').innerHTML = state.party.length ? state.party.map((m, i) => `<button class="party-card ${i === state.active ? 'active' : ''}" data-party="${i}"><canvas data-portrait="${m.id}" width="64" height="64"></canvas><strong>${name(m)}</strong><small>Lv.${m.level} · ${m.hp}/${m.maxHp}</small><div class="hp-track"><i style="width:${m.hp / m.maxHp * 100}%"></i></div></button>`).join('') + Array.from({ length: 6 - state.party.length }, () => '<div class="party-slot">+</div>').join('') : '<p class="empty-party">첫 번째 동료가 당신을 기다리고 있어요.</p>';
  $$('[data-party]').forEach(b => b.onclick = () => partyDetail(Number(b.dataset.party)));
  $('#quickQuestText').textContent = $('#questTitle').textContent; $('#dockPartyCount').textContent = `${state.party.length} / 6`;
  const buddy = state.party[state.active] || state.party[0];
  if (buddy) { $('#buddyName').textContent = name(buddy); $('#buddyStatus').textContent = `Lv.${buddy.level} · ${buddy.hp}/${buddy.maxHp}`; $('#buddyImage').dataset.portrait = buddy.id; }
  paintPortraits();
}
function showPlaceBanner(def) {
  const b = $('#placeBanner'); b.querySelector('small').textContent = def.kind === 'town' ? `${def.island} · CHAPTER ${String(def.zone + 1).padStart(2, '0')}` : def.kind === 'room' ? `${def.townName} · 건물 안` : `${def.island} · 길`;
  b.querySelector('strong').textContent = def.name; b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
  clearTimeout(showPlaceBanner.t); showPlaceBanner.t = setTimeout(() => b.classList.remove('show'), 2600);
}

// ── who to go to next ──────────────────────────────────────────────────────────
function exitTile(dir = 'next') { const k = [...map.exits].find(([, d]) => d === dir)?.[0]; if (!k) return null; const [x, y] = k.split(',').map(Number); const to = getMapDef(dir === 'next' ? nextMapId(map.id) : prevMapId(map.id)); return { exit: dir, x, y, name: crossesSea(map.id, to.id) ? (to.island === '울릉도' ? '울릉도행 배' : '독도행 배') : to.name }; }
// 울릉도(1장 도동항)와 독도 사이는 걸어갈 수 없어요: 부두 끝에서 여객선을 타요.
function crossesSea(from, to) { return !!to && (getMapDef(from).island === '울릉도') !== (getMapDef(to).island === '울릉도'); }
async function takeFerry(to, spawnKey) {
  const toDokdo = getMapDef(to).island !== '울릉도';
  settleMovement(); path = []; pathAction = null; keys.clear();
  if (toDokdo && !state.flags.ferry) { state.flags.ferry = true; await playStory(FERRY); }
  else await playStory(FERRY_AGAIN(toDokdo ? 'dokdo' : 'ulleung'));
  await changeMap(to, spawnKey);
}
function targetNPC() {
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
function guide() {
  if (!state.started || busy()) return;
  tutorialEvent('guide');
  const t = targetNPC(); if (!t) { toast('이 지역의 모험을 모두 마쳤어요. 도감을 채우거나 다른 지역을 다시 둘러봐요.'); return; }
  if (t.exit) {
    const p = pathfind(map, moving?.toX ?? state.x, moving?.toY ?? state.y, t.x, t.y, liveNPCs());
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
  const paths = [[0, 1], [1, 0], [-1, 0], [0, -1]].map(([dx, dy]) => { const x = n.x + dx, y = n.y + dy; return { x, y, path: pathfind(map, sx, sy, x, y, people) }; })
    .filter(v => v.path.length || (v.x === sx && v.y === sy)).sort((a, b) => a.path.length - b.path.length);
  if (paths.length) { path = paths[0].path; pathAction = () => interact(n); if (!path.length && !moving) { pathAction = null; interact(n); } }
  else toast('가까운 길로 조금 더 이동해 보세요.');
}

// ── talking to people and objects ──────────────────────────────────────────────
function giveItems(give = {}) {
  const parts = [];
  if (give.heal) { state.items.heal += give.heal; parts.push(`회복젤 ${give.heal}개`); }
  if (give.orb) { state.items.orb += give.orb; parts.push(`친구 구슬 ${give.orb}개`); }
  if (give.coins) { state.coins += give.coins; parts.push(`조사 코인 ${give.coins}개`); }
  if (parts.length) { toast(`${parts.join(', ')}를 받았어요!`); beep(860, .15); }
}
function setFlag(flag) { if (flag) state.flags[flag] = true; labelKey = ''; }
// The person or object right in front of you (not just beside you).
function facingNPC() { const [dx, dy] = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[state.dir] || [0, 1]; return liveNPCs().find(n => n.x === state.x + dx && n.y === state.y + dy) || null; }
function interact(n) {
  if (!n) { // E / ‘대화’: facing a door with nobody right in front of you means going in
    const b = !busy() && doorAhead();
    if (b && !facingNPC()) { enterBuilding(b); return; }
    n = nearestNPC(); if (!n) return;
  }
  if (busy()) return;
  n = liveNPCs().find(p => p.uid === n.uid) || n; npcFocus = n.uid; npcMotion.face(npcFocus, state);
  const p = progress();
  switch (n.id) {
    case 'history': return talk(n.name, z().history, () => { p.met = true; updateUI(); if (state.zone === 0 && p.studied === 0) toast('탐험 기록판의 노란 표시를 찾아보세요.'); });
    case 'resident': return talk(n.name, n.lines, null, '마을 주민 · 창작 대화', n.actor);
    case 'extra': return talk(n.name, n.lines);
    case 'guide': return talk('나루', ['나는 나루! 다른 우산몬을 만나면 동료를 바꿔 가며 문제를 풀어 봐.', '키보드가 없어도 화면 속 사람을 누르면 가까이 다가가서 이야기할 수 있어.', '마을 오른쪽 끝의 다리를 건너면 다음 지역으로 가는 길이 이어져. 길을 잃으면 수첩의 ‘목적지 안내’를 눌러 봐!', '…잠깐, 나 방금 누구한테 ‘누르라고’ 한 거지? 하늘 위에 누가 있나…?', '에이, 바닷바람 때문에 헛소리가 나왔나 봐. 못 들은 걸로 해 줘!']);
    case 'prof': return talk('연구 안내원', ['우산몬 도감에서 창작 캐릭터와 실제 생물 모티브를 비교할 수 있어요.', '각 지역의 기록판은 배운 내용과 이전 개념을 다시 확인하는 곳이에요.', '메뉴에서 저장 파일과 학습 기록을 내려받을 수 있어요.', '…메뉴요? 제가 방금 메뉴라고 했나요? 식당도 아닌데.', '연구소에 너무 오래 있었나 봐요. 바닷바람 좀 쐬고 올게요!']);
    case 'board': if (!p.met) return talk('탐험 기록판', ['먼저 이 지역의 인물에게 이야기를 들어 보세요. 자료를 이해할 단서를 얻을 수 있어요.']); return beginStudy('board');
    case 'enemy':
      if (p.studied < 2) return talk(n.name, ['이 기록이 왜 중요한지 알고 있나? 기록판에서 자료를 먼저 확인해 봐!']);
      if (state.zone === 7) { playStory(BOSS_REVEAL).then(() => startBattle('enemy')); return; }
      return talk(n.name, VILLAIN_TALES[state.zone].before, () => startBattle('enemy'), '몽땅랜드 · 창작 대화', n.actor);
    case 'boss':
      if (!p.enemy) return talk(`관장 ${z().boss}`, ['마을의 기록이 아직 돌아오지 않았어요. 기록판을 조사하고 몽땅랜드의 계획부터 막아 주세요.']);
      if (p.boss) return talk(`관장 ${z().boss}`, ['인증을 받은 뒤에도 새로운 상황에 배운 내용을 적용해 봐요. 다시 대련하고 싶다면 준비할게요.'], () => startBattle('rematch'));
      return talk(`관장 ${z().boss}`, ['잘 왔어요. 먼저 여행에서 배운 사실을 하나 확인해 볼까요?', '그다음에는 우산몬과 호흡을 맞춰 봐요. 준비된 동료와 함께 도전하세요!'], () => beginStudy('boss'));
    case 'shop': return showShop();
    case 'shopkeeper': return talk(n.name, n.lines, () => showShop(), '쉼터 · 회복과 준비', n.actor);
    case 'storage': return showStorage();
    case 'dex': return showDex();
    case 'rest': return talk(n.name, ['포근한 자리에서 잠깐 쉬었어요.', '동료들이 모두 기운을 되찾았어요!'], () => { healAll(state); beep(660, .15); updateUI(); save(); }, '쉬어 가기');
    case 'badges': {
      const got = state.badges.slice().sort((a, b) => a - b).map(i => `${ZONES[i].badge}(${ZONES[i].name})`);
      return talk(n.name, got.length ? [`지금까지 받은 인증 ${got.length}개: ${got.join(', ')}`, '인증을 받을 때마다 진열장에 이름이 새겨져요.'] : ['아직 받은 인증이 없어요.', `관장 ${z().boss}의 시험을 통과하면 여기에 ‘${z().badge}’ 인증이 새겨져요.`], null, '수호관 · 인증 진열장');
    }
    case 'wild': return startBattle('wild', n.species);
    case 'sign': return talk(n.name, n.lines, () => setFlag(n.flag), '안내판 · 실제 지명 정보');
    case 'landmark': return talk(n.name, n.lines, () => setFlag(n.flag), '실제 지명 · 지도 위 그림은 게임용');
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
      const owned = [...state.party, ...state.storage].some(m => m.id === n.species);
      if (n.used || owned) return talk(n.name, n.after || n.lines, () => { if (!n.used) setFlag(n.flag); }, '전설의 우산몬 · 실제 자연 정보');
      return talk(n.name, n.lines, () => startBattle('legend', n.species, { npc: n }), '전설의 우산몬');
    }
    case 'trainer':
      if (n.used) return talk(n.name, n.after || ['다음엔 지지 않을 거야!'], null, '몽땅랜드 · 창작 대화', n.actor);
      return talk(n.name, n.lines, () => startBattle('trainer', null, { npc: n }), '몽땅랜드 · 창작 대화', n.actor);
  }
}

// ── buildings: doors, floors and stairs ────────────────────────────────────────
// A building's door is the middle of its bottom row (both middle columns for even widths).
const doorCols = b => b.w % 2 ? [b.x + Math.floor(b.w / 2)] : [b.x + b.w / 2 - 1, b.x + b.w / 2];
function buildingDoorAt(x, y) { return map.kind === 'town' ? map.buildings.find(b => y === b.y + b.h - 1 && doorCols(b).includes(x)) : null; }
function doorAhead() { return map.kind === 'town' && state.dir === 'up' ? buildingDoorAt(state.x, state.y - 1) : null; }
function doorFront(b, people = liveNPCs()) { return doorCols(b).map(x => ({ x, y: b.y + b.h })).find(p => !blocked(map, p.x, p.y, people)) || { x: doorCols(b)[0], y: b.y + b.h }; }
let stairHold = false; // after stairs, wait until the stick / keys are let go (no bouncing between floors)
function enterBuilding(b) { beep(520, .05); changeMap(roomId(state.zone, b.kind, 1), 'a', { dir: 'up' }); }
function leaveBuilding() {
  const def = map.def, town = createMap(def.town), b = town.buildings.find(b => b.kind === def.building);
  const front = b ? doorCols(b).map(x => ({ x, y: b.y + b.h })).find(p => !blocked(town, p.x, p.y)) : null;
  changeMap(def.town, front ? { ...front, dir: 'down' } : 'a');
}
function useStairs(s) {
  const def = map.def, floor = def.floor + (s.dir === 'up' ? 1 : -1), target = createMap(roomId(def.zone, def.building, floor));
  const land = target.stairs.find(t => t.dir === (s.dir === 'up' ? 'down' : 'up'))?.land || target.spawns.a;
  stairHold = true; beep(s.dir === 'up' ? 700 : 500, .06); changeMap(target.id, { ...land, dir: 'down' });
}

// ── walking, exits and encounters ──────────────────────────────────────────────
function exitLocked(x, y) { return map.exits.get(`${x},${y}`) === 'next' && map.kind === 'town' && !state.badges.includes(state.zone); }
const lockedMessage = () => map.def.island === '울릉도' ? `관장 ${z().boss}의 인증을 받으면 독도행 배를 탈 수 있어요.` : `관장 ${z().boss}의 인증을 받으면 다리 건너 길이 열려요.`;
function move(dx, dy, now) {
  if (moving || busy() || Math.abs(dx) + Math.abs(dy) !== 1) return false;
  const nx = state.x + dx, ny = state.y + dy; state.dir = dx < 0 ? 'left' : dx > 0 ? 'right' : dy < 0 ? 'up' : 'down';
  if (exitLocked(nx, ny)) { if (!move.warned || now - move.warned > 1500) { toast(lockedMessage()); move.warned = now; } return false; }
  if (dy === -1) { const b = buildingDoorAt(nx, ny); if (b) { enterBuilding(b); return true; } } // walking up into a door
  if (blocked(map, nx, ny, liveNPCs())) return false;
  moving = { fromX: state.x, fromY: state.y, toX: nx, toY: ny, start: now }; return true;
}
function arrive() {
  if (!moving) return;
  state.x = moving.toX; state.y = moving.toY; view = { x: state.x, y: state.y }; moving = null; walks++; tutorialEvent('walk');
  if (walks % 10 === 0) save();
  const exit = map.exits.get(`${state.x},${state.y}`);
  if (exit) { const to = exit === 'next' ? nextMapId(map.id) : prevMapId(map.id), key = exit === 'next' ? 'a' : 'z'; if (crossesSea(map.id, to)) takeFerry(to, key); else changeMap(to, key); return; }
  if (map.kind === 'room') {
    if (map.doors.some(d => d.x === state.x && d.y === state.y)) { leaveBuilding(); return; }
    const s = map.stairs.find(s => s.x === state.x && s.y === state.y); if (s) { useStairs(s); return; }
  }
  if (map[state.y][state.x] === 3 && walks - lastEncounter > 8 && Math.random() < .18 && !pathAction) {
    lastEncounter = walks; path = [];
    const lo = map.kind === 'route' ? state.zone : Math.max(0, state.zone - 2), hi = map.kind === 'route' ? Math.min(6, state.zone + 1) : state.zone;
    const pool = MONSTERS.filter(m => m.stage === 1 && !isUnique(m) && m.zone <= hi && m.zone >= lo); // 전설·스타팅 우산몬은 나오지 않아요
    startBattle('wild', pool[Math.floor(Math.random() * pool.length)].id);
  }
}
async function changeMap(id, spawnKey = 'a', { heal = false, instant = false, dir = null } = {}) {
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
  transition = false; showPlaceBanner(def);
  if (first && def.zone > 0) { await playStory(arrivalScene(def.zone, ZONES[def.zone], def)); updateUI(); }
}

canvas.addEventListener('pointerdown', e => {
  if (busy()) return;
  const bounds = canvas.getBoundingClientRect();
  const tx = Math.floor(((e.clientX - bounds.left) * canvas.width / bounds.width + camera.x) / 32), ty = Math.floor(((e.clientY - bounds.top) * canvas.height / bounds.height + camera.y) / 32);
  const people = liveNPCs(), n = people.find(n => Math.abs((n.drawX ?? n.x) - tx) <= .65 && Math.abs((n.drawY ?? n.y) - ty) <= 1);
  if (n) { moveToNPC(n); return; }
  const b = map.kind === 'town' && map.buildings.find(b => tx >= b.x && tx < b.x + b.w && ty >= b.y - 1 && ty < b.y + b.h);
  if (b) { // tap a building: walk to its door and go in
    const f = doorFront(b, people), sx = moving?.toX ?? state.x, sy = moving?.toY ?? state.y;
    if (sx === f.x && sy === f.y) { if (!moving) enterBuilding(b); else { path = []; pathAction = () => enterBuilding(b); } return; }
    const p = pathfind(map, sx, sy, f.x, f.y, people); if (p.length) { path = p; pathAction = () => enterBuilding(b); }
    return;
  }
  const next = pathfind(map, moving?.toX ?? state.x, moving?.toY ?? state.y, tx, ty, people);
  if (next.length) { path = next; pathAction = null; }
  canvas.focus({ preventScroll: true });
});
const vectors = { ArrowUp: [0, -1], w: [0, -1], W: [0, -1], ArrowDown: [0, 1], s: [0, 1], S: [0, 1], ArrowLeft: [-1, 0], a: [-1, 0], A: [-1, 0], ArrowRight: [1, 0], d: [1, 0], D: [1, 0] };
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
  if (vectors[e.key]) { e.preventDefault(); keys.add(e.key); path = []; pathAction = null; }
  if (['e', 'E', ' ', 'Enter'].includes(e.key) && !e.repeat) {
    if (!$('#modal').classList.contains('hidden')) return;
    if (document.activeElement?.tagName === 'BUTTON' && !dialogueState) return;
    e.preventDefault(); if (dialogueState) nextTalk(); else interact();
  }
});
window.addEventListener('keyup', e => keys.delete(e.key)); window.addEventListener('blur', () => keys.clear());
// 가상 조이스틱: 누른 채로 밀면 그쪽으로 한 칸씩 걸어요. 대각선으로 밀면 막힌 쪽 대신 다른 쪽으로 미끄러지듯 걸어요.
const joystick = createJoystick($('#joystick'), dir => { if (dir) { path = []; pathAction = null; } });
window.addEventListener('blur', () => joystick.reset());
$('#interactBtn').onclick = () => dialogueState ? nextTalk() : interact();

function frame(now) {
  const dt = Math.max(0, Math.min(now - lastTick, 100)); lastTick = now;
  if (state.started && !document.hidden) state.playMs += dt;
  if (!pathAction && !dialogueState && !busy()) npcFocus = null;
  const baseNPCs = npcs(map, progress(), state.flags); npcMotion.sync(map.id, baseNPCs);
  npcMotion.update(baseNPCs, map, { dt, player: { x: state.x, y: state.y, toX: moving?.toX, toY: moving?.toY }, paused: busy() || document.hidden, holdKey: npcFocus, route: path });
  let nextStart = now;
  if (moving) { const result = moveView(view, moving, now); walkDistance += result.distance; if (result.complete) { nextStart = Math.max(moving.start + MOVE_DURATION, now - MOVE_DURATION); arrive(); } }
  if (!moving && !busy()) {
    const stick = stairHold ? null : joystick.direction;
    if (stairHold && !joystick.direction && !keys.size) stairHold = false;
    if (stairHold) { /* let go first */ }
    else if (stick) { if (!move(...stick.primary, nextStart) && stick.secondary) move(...stick.secondary, nextStart); }
    else if (keys.size) { const k = [...keys].find(k => vectors[k]); if (k) move(...vectors[k], nextStart); }
    else if (path.length) { const [x, y] = path.shift(); if (!move(x - state.x, y - state.y, nextStart)) { path = []; pathAction = null; } }
    else if (pathAction) { const fn = pathAction; pathAction = null; fn(); }
  }
  // Render any residual part of the next tile in the same frame, avoiding a pause at tile edges.
  if (moving) { const result = moveView(view, moving, now); walkDistance += result.distance; if (result.complete) arrive(); }
  if (!cutscenes.active() && !battle) {
    const walking = !!moving && !busy(), people = liveNPCs();
    camera = drawWorld(ctx, map, state, view, now, path.length ? { x: path.at(-1)[0], y: path.at(-1)[1] } : null, { walking, distance: walkDistance }, { width: sceneWidth, height: sceneHeight, labels: false, actors: false }, people);
    actorCtx.setTransform(1, 0, 0, 1, 0, 0); actorCtx.clearRect(0, 0, actorCanvas.width, actorCanvas.height); actorCtx.save();
    actorCtx.scale(sceneScale * actorPixelRatio, sceneScale * actorPixelRatio); actorCtx.translate(-camera.x, -camera.y);
    drawActors(actorCtx, state, view, now, { walking, distance: walkDistance }, people, map); actorCtx.restore(); paintWorldLabels(people);
  }
  if (avatarChoice) $$('canvas[data-explorer-sprite]').forEach(c => paintExplorerCard(c, c.dataset.explorerSprite, now, avatarChoice.selected === c.dataset.explorerSprite));
  const door = !busy() && !facingNPC() && doorAhead(), n = !door && !busy() && nearestNPC(); $('#interactionPrompt').classList.toggle('hidden', !n && !door);
  if (door) $('#interactionPrompt').textContent = `${matchMedia('(pointer:coarse)').matches ? '대화' : 'E'} · ${door.name} 들어가기`;
  else if (n) $('#interactionPrompt').textContent = `${matchMedia('(pointer:coarse)').matches ? '대화' : 'E'} · ${n.name}`;
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
  const title = { boss: '관장의 기억 확인', board: '기록을 연결해요', stone: '기억 비석의 질문' }[kind] || '배운 내용을 다시 만나기';
  function show() {
    const q = questions[index];
    openModal(head(title, `${map.name} · ${index + 1}/${questions.length}`) + `<div class="progress-dots">${questions.map((_, i) => `<i class="${i < index ? 'done' : ''}"></i>`).join('')}</div><div class="question-tag">${CONCEPTS.find(c => c.id === q.concept)?.title || '기록 탐구'}</div><h3 class="question-title">${esc(q.prompt)}</h3><div class="answer-options">${q.options.map((opt, i) => `<button class="answer-option" data-answer="${i}"><b>${i + 1}</b><span>${esc(opt)}</span></button>`).join('')}</div><div id="feedbackArea"></div><p class="footer-note">틀려도 괜찮아요. 자료를 함께 읽고 다음에 다시 확인해요.</p>`, () => {
      $$('[data-answer]').forEach(b => b.onclick = () => {
        const answer = Number(b.dataset.answer), correct = answer === q.answer;
        recordAnswer(state, q, correct, assisted);
        $$('[data-answer]').forEach(btn => { btn.disabled = true; if (Number(btn.dataset.answer) === q.answer) btn.classList.add('correct'); });
        if (!correct) b.classList.add('wrong'); beep(correct ? 720 : 290, .12);
        $('#feedbackArea').innerHTML = `<div class="feedback"><strong>${correct ? '잘 연결했어요!' : '근거를 다시 살펴볼까요?'}</strong><br>${esc(q.explanation)}<br><a class="source-link" href="${q.source}" target="_blank" rel="noopener">실제 자료 살펴보기 ↗</a></div><div class="modal-actions"><button id="nextQuestion" class="primary">${!correct ? '근거를 읽고 다시 풀기' : index < questions.length - 1 ? '다음 기록' : '조사 마치기'} →</button></div>`;
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
function startTutorial() { if (!battle && state.started) startBattle('tutorial', 2); }
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
  t.walk++; tutorialSteps = 0; beep(880, .08); save();
  if (t.walk >= 4) { renderCoachPanel(); toast('튜토리얼 끝! 이제 마음껏 독도를 탐험해요.'); }
  else renderCoachPanel();
}

// ── Dragon Quest–style duel: calm berserk (사나워짐) 우산몬 by clearing their dark energy ──
// Wild and 몽땅랜드 우산몬 are 사나워짐 (wrapped in 검은 기운). A correct answer clears some of it;
// at zero they find their calm again. 관장 duels are friendly certification matches.
const active = () => state.party[state.active];
const enemy = () => battle.enemies[battle.index];
const berserk = b => b.kind !== 'boss' && b.kind !== 'rematch';
function opponentName(b) { return b.kind === 'enemy' ? z().enemy : b.kind === 'trainer' ? b.npc.name : `관장 ${z().boss}`; }
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
  const base = 5 + state.zone * 4 + (map.kind === 'route' ? 2 : 0);
  let enemies;
  if (kind === 'wild') enemies = [createMonster(id, Math.max(3, base - 2 + Math.floor(Math.random() * 3)))];
  else if (kind === 'legend') enemies = [createMonster(id, base + 4)];
  else if (kind === 'tutorial') {
    // a gentle practice foe: two right answers calm it, and it only taps lightly
    const foe = createMonster(id, 3), mine = state.party[state.active] || state.party[0];
    foe.maxHp = foe.hp = damage(mine, foe, 1.2, () => .5).amount * 2 - 1; foe.attack = 3; enemies = [foe];
  }
  else if (kind === 'enemy') { const pool = z().wild.filter(i => !STARTERS.includes(i)); enemies = (state.zone === 7 ? bossTeam() : [pool[2] || pool[0] || 21]).map(i => createMonster(i, base + (i === TREE ? 2 : 0))); }
  else if (kind === 'trainer') enemies = (opts.npc.team?.length ? opts.npc.team : [z().wild.filter(i => !STARTERS.includes(i))[3]]).map(i => createMonster(i, base));
  else enemies = z().bossTeam.slice(0, kind === 'rematch' ? 3 : 2).map(i => createMonster(i, base + 1 + (kind === 'rematch' ? 2 : 0)));
  for (const m of enemies) if (!state.seen.includes(m.id)) state.seen.push(m.id);
  preloadMonsters(enemies.map(m => m.id));
  for (const r of ['grunt', 'exec', 'boss']) assetImage(`characters/baekmudan-${r}-portrait`);
  $('#toast').classList.add('hidden');
  battle = { kind, enemies, index: 0, turn: 1, npc: opts.npc || null, captureTried: false, guard: false, quiz: null };
  $('#battleScreen').classList.remove('hidden'); scene.classList.add('battling');
  const foeTrainer = kind === 'enemy' ? VILLAIN_BY_ZONE[state.zone] : kind === 'trainer' ? opts.npc.actor : null;
  const foePortrait = villainPortrait(foeTrainer);
  battleUI.mount({ backdrop: backdropKind(), sky: z().color, aura: berserk(battle), island: map.def?.island || '', label: kind === 'tutorial' ? '연습 대결 · 김박사와 함께' : kind === 'wild' ? `사나워진 우산몬 · ${map.name}` : kind === 'legend' ? `전설의 우산몬 · ${map.name}` : kind === 'boss' || kind === 'rematch' ? `${opponentName(battle)} · 인증 결투` : opponentName(battle), foeTrainer, foePortrait });
  refreshBattle(); if (!(foePortrait && battleUI.portraitIn())) battleUI.enemyEnter(); beep(320, .12); setTimeout(() => beep(480, .12), 120); updateUI();
  runBattle(battle).catch(err => { console.error(err); if (battle) finishBattle(false, true); });
}
function refreshBattle() {
  if (!battle) return;
  const a = active(), e = enemy(), sp = getSpecies(e.id), dark = berserk(battle);
  battleUI.setStatus(a, { name: name(a) }, state.party.map((m, i) => ({ hp: m.hp, name: name(m), active: i === state.active })));
  battleUI.setFoe(e, { name: sp.name, type: TYPES[sp.type].name, gauge: dark ? '검은 기운' : '기운', dark }, battle.enemies.length > 1 ? `${battle.index + 1} / ${battle.enemies.length}번째 우산몬` : '');
  if (dark) battleUI.setAura(e.hp > 0 ? Math.max(.25, e.hp / e.maxHp) : 0);
}
function explanationHTML(q) { return `<p class="dq-explain">${esc(q.explanation)}</p><a class="source-link" href="${q.source}" target="_blank" rel="noopener">자료 확인 ↗</a>`; }
async function askQuiz(b, phase, header) {
  const q = testQuestion || selectBattleQuestion(state), order = shuffledChoices(q);
  b.quiz = { q, phase, order, answered: false, assisted: false };
  const rule = phase === 'attack'
    ? (berserk(b) ? '맞히면 검은 기운을 걷어 내요. 틀리면 마음이 닿지 않아요.' : '맞히면 상대의 기운이 줄어요. 틀리면 빗나가요.')
    : '맞히면 잘 막아서 조금만 아파요. 틀리면 그대로 충격을 받아요.';
  const res = await battleUI.quiz({ q, order, phase, header, rule, concept: CONCEPTS.find(c => c.id === q.concept)?.title || '기억 확인' });
  if (battle !== b) return null;
  const correct = res.choice === q.answer;
  Object.assign(b.quiz, { answered: true, assisted: res.assisted, correct, choice: res.choice });
  recordAnswer(state, q, correct, res.assisted, { mode: 'battle', phase, opponent: enemy().id });
  battleUI.reveal(q, res.choice); beep(correct ? 720 : 200, .12); save();
  return { q, correct };
}
async function attackWithQuiz(b, power, skillName) {
  const a = active(), e = enemy(), dark = berserk(b);
  battleUI.allyAct?.('lunge');
  tip(b, '알맞은 답을 눌러요. 맞히면 검은 기운이 줄어요. 모르겠으면 ‘기록 힌트 보기’를 눌러도 돼요.');
  const r = await askQuiz(b, 'attack', `${name(a)}의 ${skillName}!`); if (!r) return;
  tip(b, r.correct ? '잘했어요! 오른쪽 위 보라색 막대가 줄어든 게 보이죠?' : '괜찮아요! 틀려도 내 우산몬은 다치지 않아요. 다시 해 봐요.');
  if (r.correct) {
    const d = damage(a, e, power); e.hp = Math.max(0, e.hp - d.amount); battleUI.damage(d.amount, 'enemy'); refreshBattle();
    const eff = d.mult > 1 ? ' 마음이 크게 닿았다!' : d.mult < 1 ? ' 잘 닿지 않은 것 같다…' : '';
    await battleUI.explain(dark ? `정답! ${name(e)}의 검은 기운을 ${d.amount}만큼 걷어 냈다!${eff}` : `정답! ${name(e)}의 기운이 ${d.amount} 줄었다!${eff}`, explanationHTML(r.q), 'good');
  } else {
    // a wrong answer on my turn just misses (no damage to either side)
    await battleUI.explain(dark ? `아쉬워요! ${name(a)}의 마음이 닿지 않았다.` : `아쉬워요! ${name(a)}의 기술이 빗나갔다!`, explanationHTML(r.q), 'bad');
  }
}
const SKILL_KIND = { attack: '정화', heal: '회복', guard: '보호' };
// 정화하기: choose one of the skills this 우산몬 has learned (2 at first, more as it grows).
async function purify(b) {
  const a = active(), list = knownSkills(a), dark = berserk(b);
  const tired = list.every(s => s.kind !== 'attack' || a.pp[s.index] <= 0);
  const first = tut(b) && b.turn === 1;
  const items = list.map(s => ({ label: s.name, value: `skill-${s.index}`, sub: `${s.kind === 'attack' ? (s.index === 1 ? '강한 ' : '') + (dark ? '정화' : '겨루기') : SKILL_KIND[s.kind]} · ${a.pp[s.index]}/${s.max}`, disabled: a.pp[s.index] <= 0 || (first && s.index !== 0), hint: first && s.index === 0 }));
  if (first) tip(b, `‘${list[0].name}’${josa(list[0].name, '을/를').slice(list[0].name.length)} 골라요. 기술을 쓰면 독도 문제가 나와요!`);
  if (tired) items.push({ label: '있는 힘껏', value: 'skill-last', sub: '기술 횟수를 다 썼을 때' });
  const pick = await battleUI.menu(items, { title: '정화하기', prompt: dark ? '어떤 기술로 정화할까? 문제를 맞혀야 마음이 닿아요.' : '어떤 기술로 겨룰까? 문제를 맞혀야 닿아요.', cancel: true });
  if (battle !== b) return 'end';
  if (pick === null) return 'free';
  if (pick === 'skill-last') { await attackWithQuiz(b, 1, '있는 힘껏'); return 'turn'; }
  const sk = list.find(s => `skill-${s.index}` === pick); a.pp[sk.index] = Math.max(0, a.pp[sk.index] - 1);
  if (sk.kind === 'attack') { await attackWithQuiz(b, sk.power, sk.name); return 'turn'; }
  if (sk.kind === 'heal') { const before = a.hp; a.hp = Math.min(a.maxHp, a.hp + Math.ceil(a.maxHp * .35)); refreshBattle(); updateUI(); await battleUI.say(`${name(a)}의 ${sk.name}! 체력이 ${a.hp - before} 회복됐다!`, { tone: 'good' }); return 'turn'; }
  b.guard = true; await battleUI.say(`${name(a)}의 ${sk.name}! 이번 차례에 받는 충격이 절반으로 줄어든다.`); return 'turn';
}
async function playerTurn(b) {
  const a = active(), dark = berserk(b), first = tut(b) && b.turn === 1;
  tip(b, first ? '‘정화하기’를 눌러 보세요. 우산몬이 쓸 수 있는 기술이 나와요.' : '이번엔 마음대로 골라 봐요! ‘보호’를 쓰면 다음에 받는 충격이 절반이 돼요.');
  const cmd = await battleUI.menu([
    { label: '정화하기', value: 'purify', sub: `기술 ${knownSkills(a).length}가지`, hint: first },
    { label: '도구', value: 'item', sub: `회복젤 ${state.items.heal} · 친구 구슬 ${state.items.orb}`, disabled: first },
    { label: '동료', value: 'party', sub: '교체', disabled: first || state.party.filter(m => m.hp > 0).length < 2 },
    { label: '물러나기', value: 'run', sub: b.kind === 'wild' ? '' : '결투 중', disabled: first }
  ], { prompt: `${josa(name(a), '은/는')} 무엇을 할까?` });
  if (battle !== b) return 'end';
  if (cmd === 'purify') return purify(b);
  if (cmd === 'item') {
    const orbNote = b.kind !== 'wild' ? '야생 우산몬에게만' : b.captureTried ? '이번 만남에 이미 사용' : '검은 기운이 적을수록 잘 통해요';
    const pick = await battleUI.menu([
      { label: `회복젤 ×${state.items.heal}`, value: 'heal', sub: '체력 45% 회복', disabled: state.items.heal <= 0 || a.hp === a.maxHp },
      { label: `친구 구슬 ×${state.items.orb}`, value: 'orb', sub: orbNote, disabled: b.kind !== 'wild' || state.items.orb <= 0 || b.captureTried }
    ], { title: '도구', prompt: '어떤 도구를 쓸까?', cancel: true });
    if (pick === null) return 'free';
    if (pick === 'heal') {
      state.items.heal--; const before = a.hp; a.hp = Math.min(a.maxHp, a.hp + Math.ceil(a.maxHp * .45)); refreshBattle(); updateUI(); save();
      await battleUI.say(`회복젤을 썼다! ${name(a)}의 체력이 ${a.hp - before} 회복됐다!`); return 'turn';
    }
    state.items.orb--; b.captureTried = true; const e = enemy();
    await battleUI.say(`친구 구슬을 건넸다… ${name(e)}에게 마음이 닿을까?`);
    if (battle !== b) return 'end';
    if (state.caught.length < 2 || Math.random() < captureChance(e)) {
      addMonster(state, createMonster(e.id, e.level)); beep(850, .2);
      await battleUI.say(`검은 기운이 걷히고, ${josa(name(e), '이/가')} 마음을 열어 동료가 되었다!`, { tone: 'good' });
      finishBattle(false, false, { captured: e }); return 'end';
    }
    await battleUI.say('아직 마음을 열지 않았다. 검은 기운을 더 걷어 내 보자.'); return 'turn';
  }
  if (cmd === 'party') {
    const pick = await battleUI.menu(state.party.map((m, i) => ({ label: name(m), value: String(i), sub: `Lv ${m.level} · HP ${m.hp}/${m.maxHp}`, disabled: m.hp <= 0 || i === state.active })), { title: '동료', prompt: '누구와 교체할까?', cancel: true });
    if (pick === null) return 'free';
    state.active = Number(pick); refreshBattle(); battleUI.allyAct?.('enter'); updateUI(); save();
    await battleUI.say(`${name(active())}, 부탁해!`); return 'turn';
  }
  if (tut(b)) { await battleUI.say('연습 대결은 끝까지 해 봐요! 그만하려면 위쪽 ‘연습 건너뛰기’를 눌러요.'); return 'free'; }
  if (b.kind !== 'wild' && b.kind !== 'legend') { await battleUI.say('이 결투에서는 물러날 수 없다!'); return 'free'; }
  if (Math.random() < .8) { await battleUI.say('무사히 물러났다!'); finishBattle(false, true); return 'end'; }
  await battleUI.say('물러나지 못했다!'); return 'turn';
}
async function enemyTurn(b) {
  const a = active(), e = enemy(), dark = berserk(b);
  tip(b, '이번엔 사나워진 우산몬 차례예요! 문제를 맞히면 살짝만 아프게 막을 수 있어요.');
  const r = await askQuiz(b, 'defense', dark ? `사나워진 ${josa(name(e), '이/가')} 날뛴다!` : `${name(e)}의 문제 도전!`); if (!r) return;
  const d = enemyHit(e, a, { correct: r.correct, guard: b.guard });
  a.hp = Math.max(tut(b) ? 1 : 0, a.hp - d);
  tip(b, '내 체력(HP)은 왼쪽 위에서 볼 수 있어요. 줄어들면 쉼터나 회복젤로 채워요.'); battleUI.damage(d, 'player'); refreshBattle(); updateUI();
  const guarded = b.guard ? ' (보호 기술로 충격이 더 줄었다)' : '';
  if (r.correct) await battleUI.explain(`정답! ${josa(name(a), '이/가')} 잘 막아 내서 ${d}의 충격만 받았다!${guarded}`, explanationHTML(r.q), 'good');
  else await battleUI.explain(`${dark ? `${josa(name(e), '이/가')} 날뛰었다!` : `${name(e)}의 도전!`} ${josa(name(a), '은/는')} ${d}의 충격을 받았다!${guarded}`, explanationHTML(r.q), 'bad');
}
async function allyFainted(b) {
  battleUI.allyAct?.('tired');
  await battleUI.say(`${josa(name(active()), '이/가')} 지쳐서 더 이상 겨룰 수 없다!`, { tone: 'bad' });
  const next = state.party.findIndex(m => m.hp > 0);
  if (next < 0) { await battleUI.say('동료들이 모두 지쳐 버렸다… 쉼터로 돌아가 쉬자.', { tone: 'bad' }); finishBattle(false); return false; }
  state.active = next; refreshBattle(); battleUI.allyAct?.('enter'); updateUI();
  await battleUI.say(`${name(active())}, 부탁해!`); return true;
}
async function enemyFainted(b) {
  const e = enemy(); battleUI.enemyCalmed?.(); battleUI.setAura(0);
  tip(b, '검은 기운이 모두 걷혔어요! 이렇게 우산몬을 원래대로 돌려 주면 돼요.');
  if (berserk(b)) await battleUI.say(`${name(e)}의 검은 기운이 모두 사라졌다! ${josa(name(e), '이/가')} 원래대로 돌아왔다.`, { tone: 'good' });
  else await battleUI.say(`${josa(name(e), '이/가')} 기운을 다 써서 물러났다!`);
  if (battle !== b) return false;
  if (b.index + 1 < b.enemies.length) {
    b.index++; b.turn++; refreshBattle();
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
  const kind = b.kind, coins = { wild: 12, enemy: 45, trainer: 30, tutorial: 10 }[kind] ?? 80, xp = kind === 'tutorial' ? 10 : kind === 'wild' ? 25 + state.zone * 15 : 65 + state.zone * 40;
  state.coins += coins;
  const ups = [];
  for (const m of state.party) {
    const before = m.level; gainXP(m, xp);
    if (m.level > before) ups.push(`${name(m)}의 레벨이 올라 Lv.${josa(String(m.level), '이/가')} 되었다!`);
    for (const sk of learnedBetween(m, before, m.level)) ups.push(`${josa(name(m), '은/는')} 새 기술 ‘${sk.name}’${josa(sk.name, '을/를').slice(sk.name.length)} 배웠다!`);
    if (!state.caught.includes(m.id)) state.caught.push(m.id); if (!state.seen.includes(m.id)) state.seen.push(m.id);
  }
  refreshBattle(); updateUI(); save();
  if (kind === 'wild') await battleUI.say(`원래대로 돌아온 ${josa(name(enemy()), '이/가')} 고마운 듯 풀숲으로 돌아갔다.`, { tone: 'good' });
  await battleUI.say(`동료들이 경험치 ${xp}을 얻었다. 조사 코인 ${coins}개를 받았다!`, { tone: 'good' });
  for (const line of ups.slice(0, 6)) { if (battle !== b) return; beep(980, .12); await battleUI.say(line, { tone: 'good' }); }
  if (battle === b) finishBattle(true);
}
async function runBattle(b) {
  const alive = () => battle === b, e0 = enemy();
  if (tut(b)) {
    tip(b, '연습 대결이에요! 제가 옆에서 하나씩 알려 줄게요.');
    await battleUI.say(`연습 대결! 사나워진 ${josa(name(e0), '이/가')} 나타났다!`); if (!alive()) return;
    tip(b, '오른쪽 위 보라색 막대가 ‘검은 기운’이에요. 모두 없애면 우산몬이 원래대로 돌아와요.');
    await battleUI.say(`${josa(name(e0), '이/가')} 검은 기운에 휩싸여 괴로워하고 있다. 정화해서 도와주자!`, { tone: 'dark' }); if (!alive()) return;
  }
  else if (b.kind === 'legend') { await battleUI.say(`전설의 우산몬 ${josa(name(e0), '이/가')} 깨어났다!`); if (!alive()) return; await battleUI.say(`오랜 세월을 견딘 ${josa(name(e0), '이/가')} 검은 기운에 괴로워하고 있다. 정화하자!`, { tone: 'dark' }); }
  else if (b.kind === 'wild') { await battleUI.say(`사나워진 ${josa(name(e0), '이/가')} 나타났다!`); if (!alive()) return; await battleUI.say(`${josa(name(e0), '이/가')} 검은 기운에 휩싸여 괴로워하고 있다. 정화해서 도와주자!`, { tone: 'dark' }); }
  else if (b.kind === 'enemy' || b.kind === 'trainer') {
    await battleUI.say(`${josa(opponentName(b), '이/가')} 나타났다!`);
    if (!alive()) return;
    battleUI.portraitOut(); // the member fades away as the 우산몬 comes out
    await battleUI.say(`${josa(opponentName(b), '이/가')} 사나워진 ${josa(name(e0), '을/를')} 내보냈다!`);
    if (!alive()) return;
    await battleUI.say(`${josa(name(e0), '이/가')} 검은 기운에 휩싸여 날뛰고 있다. 정화하자!`, { tone: 'dark' });
  } else await battleUI.say(`${opponentName(b)}의 인증 결투! ${josa(name(e0), '이/가')} 나왔다!`);
  while (alive()) {
    const outcome = await playerTurn(b);
    if (!alive() || outcome === 'end') return;
    if (outcome === 'free') continue;
    if (enemy().hp <= 0) { if (!(await enemyFainted(b))) return; continue; }
    if (active().hp <= 0) { if (!(await allyFainted(b))) return; }
    await enemyTurn(b); if (!alive()) return;
    if (active().hp <= 0 && !(await allyFainted(b))) return;
    b.turn++; b.guard = false;
  }
}
function closeBattle() { battle = null; battleUI.destroy(); $('#battleScreen').classList.add('hidden'); scene.classList.remove('battling'); lastEncounter = walks; }
function returnToShelter() {
  if (map.kind !== 'town') { const def = getMapDef(townId(state.zone)); state.map = def.id; map = createMap(def.id); npcMotion.reset(); labelKey = ''; }
  const shop = map.parsed.roles.shop, people = npcs(map, progress(), state.flags);
  const spot = shop && [[0, 1], [1, 0], [-1, 0], [0, -1]].map(([dx, dy]) => ({ x: shop.x + dx, y: shop.y + dy })).find(p => !blocked(map, p.x, p.y, people) && !map.exits.has(`${p.x},${p.y}`));
  const s = spot || map.spawns.a; state.x = s.x; state.y = s.y; view = { x: s.x, y: s.y };
}
function finishBattle(win, escaped = false, info = {}) {
  if (!battle) return;
  const b = battle, kind = b.kind; closeBattle();
  if (info.captured) toast(`${josa(getSpecies(info.captured.id).name, '이/가')} 동료가 되었어요!`);
  else if (win) {
    if (kind === 'enemy') {
      progress().enemy = true; state.items.heal += 2;
      if (state.zone === 7) bossFall(b);
      else talk(z().enemy, VILLAIN_TALES[state.zone].after, () => talk('서하', [z().story, '쉼터에서 동료를 회복하고 수호관으로 가 보세요.']), '몽땅랜드 · 창작 대화', VILLAIN_BY_ZONE[state.zone]);
    }
    else if (kind === 'tutorial') finishTutorialBattle();
    else if (kind === 'trainer') { setFlag(b.npc.flag); talk(b.npc.name, b.npc.after || ['다음엔 지지 않을 거야!'], null, '몽땅랜드 · 창작 대화', b.npc.actor); }
    else if (kind === 'boss') {
      progress().boss = true; if (!state.badges.includes(state.zone)) state.badges.push(state.zone);
      const learned = [];
      for (const m of state.party) { const goal = 8 + state.zone * 4, before = m.level; while (m.level < goal) gainXP(m, m.level * 13); for (const sk of learnedBetween(m, before, m.level)) learned.push(`${name(m)} ‘${sk.name}’`); if (!state.caught.includes(m.id)) state.caught.push(m.id); if (!state.seen.includes(m.id)) state.seen.push(m.id); }
      if (learned.length) setTimeout(() => toast(`새 기술을 배웠어요: ${learned.slice(0, 3).join(', ')}`), 400);
      healAll(state); state.items.orb += 5; state.items.heal += 2; labelKey = '';
      talk(`관장 ${z().boss}`, [`훌륭해요! ${z().badge} 인증을 드릴게요. 우산몬과 함께 한 걸음 더 성장했어요.`, state.zone === 7 ? '울릉도와 독도, 두 섬의 기억을 되찾은 당신은 이제 두 섬의 수호사예요!' : `이제 마을 오른쪽 다리가 열렸어요. ‘${getMapDef(nextMapId(map.id)).name}’을 따라 다음 지역으로 가 보세요!`], () => { if (state.zone === 7) { state.ended = true; save(); playStory(EPILOGUE).then(showEnding); } });
    }
  } else if (!escaped) {
    healAll(state); returnToShelter();
    talk('쉼터지기', ['동료들이 푹 쉬고 기운을 되찾았어요. 잃어버린 기록이나 동료는 없으니 걱정하지 마세요.', '회복젤과 동료 교체, 보호 기술을 활용해 다시 결투해 보세요.']);
  } else toast('사나워진 우산몬에게서 잠시 물러났어요.');
  updateUI(); save();
}
async function bossFall(b) {
  await playStory(BOSS_FALL);
  const tree = b?.enemies.find(m => m.id === TREE);
  if (tree && !ownsTree()) await treeJoins(tree);
  if (!state.legend) await legendEncounter();
  else talk('서하', [z().story, '쉼터에서 동료를 회복하고 수호관으로 가 보세요.']);
}
// 사철나무: 백무 사장에게서 정화하면 동료가 되어 함께해요 (게임 전체에 한 마리).
async function treeJoins(e) {
  addMonster(state, createMonster(e.id, e.level)); if (!state.caught.includes(e.id)) state.caught.push(e.id); save();
  await playStory(TREE_JOINS);
  await new Promise(done => openModal(head('오래된 사철나무', `전설의 우산몬 · NO.${String(e.id).padStart(3, '0')}`) + `<div class="end-screen"><canvas data-portrait="${e.id}" width="160" height="160"></canvas><p>검은 기운이 걷히자 사철나무가 잎을 흔들며 인사했어요.<br>이제 당신과 함께 독도를 지키고 싶어 해요.</p><div class="fact-box">독도의 사철나무는 동도 천장굴 위쪽 비탈에서 100년 넘게 자란, 독도에서 가장 오래된 나무예요. 2012년 천연기념물 제538호로 지정되었어요. 게임 속 모습은 창작이에요.</div><div class="modal-actions"><button id="legendTreeOK" class="primary">함께 가자 →</button></div></div>`, () => { paintPortraits(); $('#legendTreeOK').onclick = () => { closeModal(); updateUI(); save(); done(); }; }));
}
async function legendEncounter() {
  state.legend = true; addMonster(state, createMonster(100, 34)); save();
  await playStory(LEGEND);
  openModal(head('기억의 강치', '전설의 우산몬 · NO.100') + '<div class="end-screen"><canvas data-portrait="100" width="160" height="160"></canvas><p>흩어진 강치의 기록이 하나로 이어졌어요.<br>강치는 당신과 함께 기억을 지키고 싶어 해요.</p><div class="fact-box">현실의 강치는 남획으로 멸종했어요. 게임 속 강치는 탐사 장치가 보여 주는 기억의 세계에서 만나는 창작 우산몬이며, 실제 생물이 되살아났다는 뜻은 아니에요.</div><div class="modal-actions"><button id="legendOK" class="primary">함께 기억할게 →</button></div></div>', () => { $('#legendOK').onclick = () => { closeModal(); updateUI(); save(); talk('서하', [z().story, '쉼터에서 동료를 회복하고 수호관으로 가 보세요.']); }; });
}

// ── shop, party, dex, world map, notebook, menu ────────────────────────────────
function showShop() {
  openModal(head('쉼터', '회복 · 준비 · 동료 관리') + `<p>잠깐 쉬어 가요. 동료 회복은 언제나 무료예요.</p><div class="fact-box">조사 코인 <strong>${state.coins}</strong> · 회복젤 ${state.items.heal} · 친구 구슬 ${state.items.orb}</div><div class="modal-actions"><button id="healAll" class="primary">모두 회복하기</button><button id="buyHeal" class="neutral" ${state.coins < 20 ? 'disabled' : ''}>회복젤 +3 · 20코인</button><button id="buyOrb" class="neutral" ${state.coins < 25 ? 'disabled' : ''}>친구 구슬 +5 · 25코인</button><button id="storageBtn" class="neutral">동료 보관함 (${state.storage.length})</button></div>`, () => {
    $('#healAll').onclick = () => { healAll(state); save(); updateUI(); closeModal(); toast('모든 동료의 체력을 회복했어요.'); beep(660, .15); };
    $('#buyHeal').onclick = () => { state.coins -= 20; state.items.heal += 3; save(); showShop(); };
    $('#buyOrb').onclick = () => { state.coins -= 25; state.items.orb += 5; save(); showShop(); };
    $('#storageBtn').onclick = showStorage;
  });
}
function showStorage() {
  openModal(head('동료 보관함') + `<p>동료를 눌러 함께 다닐 파티를 바꿀 수 있어요. 현재 파티 ${state.party.length}/6</p><h3>함께하는 동료</h3><div class="dex-grid">${state.party.map((m, i) => `<button class="dex-card owned" data-store="${i}"><canvas data-portrait="${m.id}" width="80" height="80"></canvas><strong>${name(m)}</strong><small>Lv.${m.level} · 보관하기</small></button>`).join('')}</div><h3>쉬고 있는 동료</h3><div class="dex-grid">${state.storage.map((m, i) => `<button class="dex-card" data-take="${i}"><canvas data-portrait="${m.id}" width="80" height="80"></canvas><strong>${name(m)}</strong><small>Lv.${m.level} · 데려가기</small></button>`).join('')}</div>`, () => {
    $$('[data-store]').forEach(b => b.onclick = () => { if (state.party.length === 1) { toast('함께할 동료 한 마리는 남겨 주세요.'); return; } state.storage.push(state.party.splice(Number(b.dataset.store), 1)[0]); state.active = 0; save(); updateUI(); showStorage(); });
    $$('[data-take]').forEach(b => b.onclick = () => { if (state.party.length >= 6) { toast('먼저 동료 한 마리를 보관해 주세요.'); return; } state.party.push(state.storage.splice(Number(b.dataset.take), 1)[0]); save(); updateUI(); showStorage(); });
  });
}
function partyDetail(index) {
  if (battle) return; const m = state.party[index]; if (!m) return; const sp = getSpecies(m.id);
  openModal(head(sp.name, `함께하는 동료 · Lv.${m.level}`) + `<div class="monster-detail"><canvas data-portrait="${m.id}" width="160" height="160"></canvas><div><span class="type-chip">${TYPES[sp.type].name}</span><p>${sp.motif} 모티브</p><div class="stat-list"><span>체력 ${m.hp}/${m.maxHp}</span><span>정답의 힘 ${m.attack}</span><span>튼튼함 ${m.defense}</span></div></div></div><div class="fact-box">결투에서는 ‘결투’나 정화 기술을 고른 뒤 문제를 풀어요. 맞힌 답이 사나워진 우산몬의 검은 기운을 걷어 내요.</div><div class="modal-actions"><button id="leadMon" class="primary" ${m.hp <= 0 ? 'disabled' : ''}>첫 번째로 내보내기</button><button id="fieldHeal" class="neutral" ${state.items.heal <= 0 ? 'disabled' : ''}>회복젤 사용 (${state.items.heal})</button></div>`, () => {
    $('#leadMon').onclick = () => { state.active = index; save(); updateUI(); closeModal(); };
    $('#fieldHeal').onclick = () => { state.items.heal--; m.hp = Math.min(m.maxHp, m.hp + Math.ceil(m.maxHp * .45)); save(); updateUI(); partyDetail(index); };
  });
}
function showDex(filter = 'all') {
  openModal(head('우산몬 도감', `100개의 만남 · 동료 ${state.caught.length}종`) + `<div class="filter-row">${[['all', '전체 100종'], ['caught', '동료'], ['seen', '발견'], ['bird', '조류'], ['fish', '어류'], ['plant', '식물'], ['legend', '전설']].map(([id, label]) => `<button data-filter="${id}" class="${filter === id ? 'selected' : ''}">${label}</button>`).join('')}</div><p class="footer-note">실제 생물 이름으로 만나는 100종. 레벨이 올라가도 같은 이름으로 함께해요.</p><div class="dex-grid">${MONSTERS.filter(m => filter === 'all' || filter === 'caught' && state.caught.includes(m.id) || filter === 'seen' && state.seen.includes(m.id) || filter === 'bird' && ['bird', 'raptor'].includes(m.shape) || filter === 'fish' && ['fish', 'goby'].includes(m.shape) || filter === 'plant' && ['flower', 'plant', 'kelp'].includes(m.shape) || filter === 'legend' && m.legendary).map(m => `<button data-dex="${m.id}" class="dex-card ${state.caught.includes(m.id) ? 'owned' : !state.seen.includes(m.id) ? 'locked' : ''}"><small>NO.${String(m.id).padStart(3, '0')}</small><canvas data-portrait="${m.id}" width="80" height="80"></canvas><strong>${state.seen.includes(m.id) ? m.name : '???'}</strong></button>`).join('')}</div>`, () => {
    $$('[data-filter]').forEach(b => b.onclick = () => showDex(b.dataset.filter)); $$('[data-dex]').forEach(b => b.onclick = () => dexDetail(Number(b.dataset.dex), filter));
  });
}
function dexDetail(id, filter) {
  const m = getSpecies(id), seen = state.seen.includes(id);
  openModal(head(seen ? m.name : '아직 만나지 못한 친구', `NO.${String(id).padStart(3, '0')}`) + `<div class="monster-detail"><canvas data-portrait="${id}" width="160" height="160" style="${seen ? '' : 'filter:brightness(0) opacity(.2)'}"></canvas><div><span class="type-chip">${seen ? TYPES[m.type].name : '발견 전'}</span><p>${seen ? m.detail : `${ZONES[m.zone].name} 부근에서 단서를 찾아보세요.`}</p></div></div>${seen ? `<div class="fact-box"><strong>실제 생물 모티브 · ${m.motif}</strong><br>${esc(m.area)} · ${esc(m.group)}<br>기록 확인: ${esc(m.recordStatus)}<br>${esc(m.recordNote)}<br>모습과 능력은 게임용 창작이에요.${m.source ? `<br><a href="${m.source}" target="_blank" rel="noopener" class="source-link">관련 자료 살펴보기 ↗</a>` : ''}</div>` : ''}<div class="modal-actions"><button id="backDex" class="neutral">← 도감으로</button></div>`, () => $('#backDex').onclick = () => showDex(filter));
}
// ── 세계 지도: 두 섬을 그린 그림 지도. 가 본 마을을 누르면 바로 이동해요. ──
// 자리(320×200 지도 칸)는 실제 지명의 대략적인 방향을 따랐어요. 섬 모양은 게임용 그림이에요.
const WORLD_SPOTS = {
  town0: [26, 24], town1: [222, 98], town2: [252, 116], town3: [148, 70], town4: [118, 16], town5: [52, 102], town6: [76, 64], town7: [110, 96]
};
const ROUTE_LABEL = { route0: [206, 150] };
const ROUTE_BENDS = { route0: [[30, 60], [18, 186], [170, 190], [204, 146]], route1: [[246, 80]], route2: [[170, 152], [150, 112]], route3: [[136, 40]], route4: [[62, 36]], route6: [[90, 82]] };
function drawWorldMap(c) {
  const g = c.getContext('2d'), W = c.width, H = c.height; g.imageSmoothingEnabled = false;
  const img = g.createImageData(W, H), px = img.data;
  const rnd = (x, y) => { const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return v - Math.floor(v); };
  const islands = [{ cx: 98, cy: 82, rx: 66, ry: 60, peak: [110, 92] }, { cx: 222, cy: 112, rx: 46, ry: 40, peak: [222, 100] }];
  const set = (i, c) => { px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = 255; };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4; let land = -1, isl = null;
    for (const s of islands) {
      const dx = (x - s.cx) / s.rx, dy = (y - s.cy) / s.ry, ang = Math.atan2(dy, dx);
      const r = 1 + .12 * Math.sin(ang * 5 + s.cx) + .07 * Math.sin(ang * 11 + s.cy) + .05 * (rnd(Math.round(ang * 30), s.cx) - .5);
      const d = 1 - Math.hypot(dx, dy) / r; if (d > land) { land = d; isl = s; }
    }
    // v0.39 블랙/화이트 느낌: 밝고 평평한 색, 섬 둘레 진한 선과 흰 물거품
    if (land < 0) {
      const wave = (x % 14 < 5) && (y + (x >> 3) * 3) % 11 === 0 && rnd(x >> 4, y) > .45;
      if (land > -.016) set(i, [43, 38, 34]);                      // outline
      else if (land > -.04) set(i, [255, 255, 255]);               // surf
      else if (land > -.1) set(i, [142, 212, 239]);                // shallows
      else set(i, wave ? [166, 220, 242] : [74, 169, 216]);        // open sea with little wave marks
      continue;
    }
    const pk = Math.hypot(x - isl.peak[0], y - isl.peak[1]) / 30;
    if (land < .03) set(i, [108, 85, 71]);                                                   // cliff foot
    else if (land < .07) set(i, (x + y) % 5 === 0 ? [142, 112, 90] : [155, 125, 101]);       // cliffs
    else if (land < .085) set(i, [95, 158, 71]);                                             // grass edge line
    else if (pk < .3) set(i, (x * 3 + y) % 7 === 0 ? [142, 112, 90] : [179, 160, 138]);       // rocky peak
    else if (pk < .36) set(i, [108, 85, 71]);
    else set(i, (x * 7 + y * 3) % 23 === 0 ? [108, 179, 80] : [143, 209, 106]);             // bright grass with tufts
  }
  // little rocks around the islands
  for (const [x, y, r] of [[20, 150, 3], [28, 158, 2], [180, 30, 3], [290, 160, 3], [300, 150, 2], [170, 180, 2], [140, 172, 3], [280, 60, 2], [44, 20, 2]])
    for (let yy = -r - 1; yy <= r + 1; yy++) for (let xx = -r - 1; xx <= r + 1; xx++) { const d = xx * xx + yy * yy; if (d <= r * r) set(((y + yy) * W + x + xx) * 4, xx + yy < 0 ? [179, 160, 138] : [124, 99, 80]); else if (d <= (r + 1) * (r + 1)) set(((y + yy) * W + x + xx) * 4, [43, 38, 34]); }
  g.putImageData(img, 0, 0);
  // 울릉도 (작게 줄인 그림): 왼쪽 위 네모 안. 실제로는 독도에서 서북쪽으로 약 87.4km 떨어져 있어요.
  g.fillStyle = '#2b2622'; g.fillRect(0, 0, 66, 48); g.fillStyle = '#4aa9d8'; g.fillRect(2, 2, 62, 44); g.fillStyle = '#ffffff'; g.fillRect(2, 2, 62, 1);
  g.fillStyle = '#2b2622'; g.beginPath(); g.ellipse(28, 24, 22, 17, -.3, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#9b7d65'; g.beginPath(); g.ellipse(28, 24, 21, 16, -.3, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#4f8a4a'; g.beginPath(); g.ellipse(28, 23, 18, 13, -.3, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#78ad5c'; g.beginPath(); g.ellipse(25, 20, 10, 7, -.3, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#2f5e3e'; g.fillRect(25, 18, 4, 3);
  g.fillStyle = '#ffffff'; g.fillRect(36, 34, 4, 2);
  // the walking routes between towns (and the ferry)
  const towns = MAPS.filter(m => m.kind === 'town');
  g.lineWidth = 2; g.setLineDash([3, 3]);
  towns.slice(0, -1).forEach((t, i) => {
    const route = `route${i}`, a = WORLD_SPOTS[t.id], b = WORLD_SPOTS[`town${i + 1}`];
    const walked = state.visited.includes(i + 1);
    g.strokeStyle = map.id === route ? '#ffe28a' : walked ? '#fff6dc' : '#ffffff88';
    g.beginPath(); g.moveTo(...a); for (const p of ROUTE_BENDS[route] || []) g.lineTo(...p); g.lineTo(...b); g.stroke();
  });
  g.setLineDash([]);
}
function showMap() {
  const towns = MAPS.filter(m => m.kind === 'town'), routes = MAPS.filter(m => m.kind === 'route');
  const pct = ([x, y]) => `left:${Math.min(92, Math.max(8, x / 320 * 100)).toFixed(2)}%;top:${Math.min(87, Math.max(13, y / 200 * 100)).toFixed(2)}%`; // markers stay inside the picture
  const routeSpot = r => { const a = WORLD_SPOTS[`town${r.zone}`], b = WORLD_SPOTS[`town${r.zone + 1}`], bend = ROUTE_LABEL[r.id] || ROUTE_BENDS[r.id]?.[0]; return bend || [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; };
  const townMarks = towns.map((t, i) => {
    const visited = state.visited.includes(t.zone), here = (map.def.town || map.id) === t.id, badge = state.badges.includes(t.zone);
    const status = here ? '지금 여기' : visited ? '눌러서 바로 이동' : '아직 가 보지 않은 곳';
    return `<button class="wm-town ${here ? 'here' : ''} ${visited ? 'visited' : 'locked'}" style="${pct(WORLD_SPOTS[t.id])}" data-zone="${t.zone}" ${!visited || here ? 'disabled' : ''} aria-label="${esc(t.name)} · ${status}"><i>${here ? '★' : visited ? (badge ? '✓' : ZONES[t.zone].icon) : '?'}</i><span>${String(i + 1).padStart(2, '0')} ${esc(visited ? t.name : '???')}</span></button>`;
  }).join('');
  const routeMarks = routes.map(r => `<span class="wm-route ${map.id === r.id ? 'here' : ''}" style="${pct(routeSpot(r))}">${map.id === r.id ? '★ ' : ''}${esc(state.visited.includes(r.zone + 1) || map.id === r.id ? r.name : '…')}</span>`).join('');
  openModal(head('울릉도·독도 탐험 지도', '실제 지명 · 마을과 길은 게임 속 창작') + `<p>가 본 마을을 누르면 바로 이동해요(동료도 회복). 처음 가는 곳은 점선 길을 따라 걸어가요.</p>
    <div class="world-map"><canvas id="worldMapArt" width="320" height="200" aria-hidden="true"></canvas><span class="wm-island small" style="left:10%;top:27%">울릉도</span><span class="wm-ferry" style="left:6%;top:64%">⛴ 약 87.4km</span><span class="wm-island" style="left:28%;top:94%">서도</span><span class="wm-island" style="left:70%;top:94%">동도</span><span class="wm-compass" aria-hidden="true">N<br>▲</span>${routeMarks}${townMarks}</div>
    <div class="wm-legend"><span><i class="here">★</i> 지금 여기</span><span><i class="visited">✓</i> 인증 받은 마을</span><span><i class="visited">≈</i> 가 본 마을</span><span><i class="locked">?</i> 아직 못 가 본 곳</span></div>
    <p class="footer-note">지명은 실제 울릉도·독도의 이름이고 대략적인 방향을 따랐지만, 섬 모양·마을·건물은 게임용 그림이에요. 울릉도는 실제로 훨씬 크고 멀리(약 87.4km) 있어서 왼쪽 위에 작게 줄여 그렸어요.</p>`, () => {
    drawWorldMap($('#worldMapArt'));
    $$('[data-zone]').forEach(b => b.onclick = () => travel(Number(b.dataset.zone)));
  });
}
async function travel(zone) {
  if (battle || !state.started || !state.visited.includes(zone)) return;
  const boat = crossesSea(map.def.town || map.id, townId(zone));
  closeModal(); await changeMap(townId(zone), 'a', { heal: true });
  toast(`${boat ? '배를 타고 ' : ''}${map.name}에 도착했어요. 동료들도 기운을 되찾았어요.`);
}
function showNotebook() {
  openModal(head('배움의 기록', `발견한 개념 ${Object.keys(state.learning).length}/12`) + `<p>게임 레벨과 배움의 기록은 달라요. 힌트 없이 해결한 경험과 여러 번의 학습을 함께 살펴봐요.</p>${CONCEPTS.map(c => { const r = state.learning[c.id]; const status = !r ? '아직 발견 전' : r.independent >= 3 && r.sessions.length >= 2 ? '반복 확인 중' : r.independent ? '혼자 해결한 경험' : '도움받아 배우는 중'; return `<div class="knowledge-row"><div><strong>${c.title}</strong><small>${c.standard} · ${status}</small><small>독립 정답 ${r?.independent || 0} · 학습 세션 ${r?.sessions.length || 0}</small></div><button data-review="${c.id}" ${!state.started ? 'disabled' : ''}>다시 보기</button></div>`; }).join('')}<div class="modal-actions"><button id="exportLearning" class="neutral">학습 기록 내려받기</button><button id="sourceBtn" class="neutral">학습 자료 출처</button></div><p class="footer-note">이 기록만으로 성취기준 도달을 확정하지 않아요. 학생의 설명과 지연 확인을 함께 살펴보세요.</p>`, () => {
    $$('[data-review]').forEach(b => b.onclick = () => beginStudy('review', b.dataset.review)); $('#exportLearning').onclick = exportLearning; $('#sourceBtn').onclick = showSources;
  });
}
function showSources() {
  openModal(head('사실과 창작을 구분해요') + `<p>지역 이름은 실제 독도의 지명이에요. 우산몬·마을·건물·NPC 대사·기억의 세계는 창작입니다. 실제 역사와 자연은 아래 자료를 바탕으로 살펴봐요.</p><div class="resource-list">${SOURCES.map(s => `<a href="${s.url}" target="_blank" rel="noopener">${esc(s.title)} ↗</a>`).join('')}<a href="https://www.moe.go.kr/boardCnts/viewRenew.do?boardID=141&boardSeq=93458&lev=0&m=040401" target="_blank" rel="noopener">교육부 · 2022 개정 교육과정 고시 ↗</a></div><div class="fact-box">중심 성취기준: 사회 [6사01-02]<br>자료 신뢰성: 국어 [6국06-02]<br>생태계 보전: 과학 [4과14-01~03]의 선수학습 복습</div><p class="footer-note">개별 생물 모티브는 도감의 자료 링크에서 확인할 수 있어요. 수업 효과는 아직 검증하지 않았어요.</p>`);
}
function exportLearning() {
  const quote = v => '"' + String(v).replace(/"/g, '""') + '"';
  const rows = [['문항', '개념', '정답', '도움받음', '학습세션', '시각', '학습상황', '전투단계', '상대우산몬', '지역'], ...state.answerLog.map(a => [a.q, CONCEPTS.find(c => c.id === a.concept)?.title || a.concept, a.correct ? '1' : '0', a.assisted ? '1' : '0', a.session, new Date(a.time).toISOString(), a.mode || 'study', a.phase || '', a.opponent ? getSpecies(a.opponent).name : '', Number.isInteger(a.zone) ? ZONES[a.zone].name : ''])];
  download('dokdomon-learning.csv', '﻿' + rows.map(r => r.map(quote).join(',')).join('\r\n'), 'text/csv;charset=utf-8');
}
function download(fileName, content, type = 'application/json') { const blob = new Blob([content], { type }), url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = fileName; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
function showMenu() {
  if (battle) { toast('결투를 마친 뒤 메뉴를 열어 주세요.'); return; }
  openModal(head('모험 메뉴', `DOKDO EXPLORERS · BUILD ${VERSION}`) + `<div class="settings-grid"><button id="menuSave" class="neutral" ${!state.started ? 'disabled' : ''}>▣ 지금 저장하기</button><button id="exportSave" class="neutral" ${!state.started ? 'disabled' : ''}>↓ 저장 파일 내려받기</button><label class="neutral">↑ 저장 파일 불러오기 <input id="importSave" type="file" accept="application/json,.json"></label><button id="menuLearn" class="neutral">✎ 배움의 기록 · 교사용 내보내기</button><button id="menuSources" class="neutral">학습 자료와 출처</button><button id="menuHelp" class="neutral">조작 방법</button><button id="menuOpening" class="neutral" ${!state.started ? 'disabled' : ''}>오프닝 다시 보기</button><button id="menuTutorial" class="neutral" ${!state.started ? 'disabled' : ''}>튜토리얼 다시 하기</button><button id="menuAvatar" class="neutral" ${!state.started ? 'disabled' : ''}>탐험대원 바꾸기</button><button id="restartBtn" class="neutral danger">새로운 모험</button></div><p class="footer-note">진행은 현재 브라우저에 저장돼요. 다른 기기에서는 저장 파일을 불러와 이어갈 수 있어요. 서버에 학생 이름이나 기록을 전송하지 않아요.</p>`, () => {
    $('#menuSave').onclick = () => save(true); $('#exportSave').onclick = () => download('dokdomon-save.json', JSON.stringify(state, null, 2));
    $('#menuLearn').onclick = showNotebook; $('#menuSources').onclick = showSources;
    $('#menuOpening').onclick = async () => { closeModal(); await playStory({ id: 'opening', scenes: [...OPENING.scenes, ...STARTER_MEET.scenes] }); };
    $('#menuTutorial').onclick = () => { closeModal(); state.tutorial = { battle: false, walk: 0 }; save(); renderCoachPanel(); startTutorial(); };
    $('#menuAvatar').onclick = () => chooseAvatar(id => { state.avatar = id; save(); updateUI(); toast('탐험대원을 바꿨어요.'); });
    $('#restartBtn').onclick = () => { saved = state.started ? state : saved; startNew(); };
    $('#menuHelp').onclick = () => openModal(head('천천히, 함께 탐험해요') + '<div class="fact-box">이동: 방향키 / WASD / 조이스틱(터치 화면) / 지도 화면 누르기<br>건물: 문 바로 아래에서 위로 걸으면(또는 건물을 누르면) 들어가요. 계단을 밟으면 위아래 층으로, 문 깔개를 밟으면 밖으로 나가요<br>대화·조사: 가까이에서 E·스페이스 / 대화 버튼<br>자동 안내: 수첩의 목적지 안내<br>다음 지역: 관장 인증 후 마을 오른쪽 다리 → 길을 따라 걷기<br>세계 지도: 가 본 마을로 바로 이동<br>결투 명령: 정화하기 · 도구 · 동료 · 물러나기<br>정화하기: 배운 기술 중 하나를 골라 문제를 풀어요. 처음엔 기술 2가지, 레벨 8과 12에 새 기술을 배워요<br>사나워진 우산몬: 문제를 맞히면 검은 기운을 걷어 내요. 모두 걷히면 평온을 되찾아요<br>정화 기술: 틀리면 마음이 닿지 않아요(피해 없음)<br>날뛰는 우산몬의 문제: 맞히면 조금만 아프고, 틀리면 그대로 충격을 받아요<br>관장과는 인증 결투로 겨뤄요<br>힌트: 문제 아래 기록 힌트 · 학습 기록에 도움 표시<br>대화와 컷신: 클릭·엔터·스페이스로 넘기기</div><p>길에서는 표지판, 관찰 지점, 기억 비석, 조사 상자, 길에서 만난 사람과 몽땅랜드 직원을 찾아봐요. 사나워진 야생 우산몬은 풀숲에서 만나요.</p>');
    $('#importSave').onchange = async e => { const file = e.target.files[0]; if (!file) return; try { if (file.size > 3e6) throw new Error('파일이 너무 커요.'); const parsed = validateSave(JSON.parse(await file.text())); saved = parsed; closeModal(); continueGame(); toast('저장한 모험을 불러왔어요.'); } catch (err) { toast(err.message || '저장 파일을 확인해 주세요.'); } };
  });
}
function showEnding() {
  openModal(head('울릉도와 독도의 기억을 되찾았어요', '두 섬의 수호사 · 여덟 개의 인증') + `<div class="end-screen"><canvas data-portrait="100" width="160" height="160"></canvas><h2>모험은 기억으로 남아요.</h2><p>우산몬과 함께 걸으며 자연과 역사를 만났어요.<br>이제 확인한 사실을 여러분의 말로 전해 주세요.</p><div class="fact-box">수호사 인증 ${state.badges.length}/8 · 동료 ${state.caught.length}/100<br>발견한 개념 ${Object.keys(state.learning).length}/12 · 기록한 답변 ${state.answerLog.length}개</div><div class="modal-actions"><button id="endContinue" class="primary">계속 탐험하기 →</button><button id="endJournal" class="neutral">배움의 기록</button></div></div>`, () => { $('#endContinue').onclick = closeModal; $('#endJournal').onclick = showNotebook; });
}

// ── start-up ───────────────────────────────────────────────────────────────────
try { const raw = localStorage.getItem(KEY); if (raw) saved = validateSave(JSON.parse(raw)); } catch (e) { console.warn('Save recovery:', e.message); }
if (saved?.started) $('#continueBtn').classList.remove('hidden');
$('#startBtn').onclick = startNew; $('#continueBtn').onclick = continueGame;
$('#saveBtn').onclick = () => state.started ? save(true) : toast('모험을 시작하면 저장할 수 있어요.');
$('#menuBtn').onclick = showMenu; $('#mapBtn').onclick = () => { if (!battle) showMap(); }; $('#dexBtn').onclick = () => { if (!battle) showDex(); };
$('#notebookBtn').onclick = () => { if (!battle) showNotebook(); }; $('#guideBtn').onclick = () => { closeModal(); guide(); };
$('#questBtn').onclick = $('#questPeek').onclick = showQuest; $('#partyBtn').onclick = $('#buddyPeek').onclick = showParty;
$('#fullscreenBtn').onclick = toggleFullscreen;
$('#soundBtn').onclick = () => { state.sound = !state.sound; if (state.sound) beep(660, .15); updateUI(); save(); };
window.addEventListener('beforeunload', () => save());
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
    cutscene: () => cutscenes.current, people: liveNPCs, guide, interact, nextTalk, startBattle, closeModal, travel, changeMap, save, continueGame,
    motion: () => ({ view: { ...view }, walkDistance, moving }), npcs: () => npcs(map, progress(), state.flags),
    playStory, stories: { OPENING, STARTER_MEET, GUIDE, BOSS_REVEAL, BOSS_FALL, TREE_JOINS },
    get longestQuestion() { return QUESTIONS.reduce((m, q) => (q.prompt.length + q.options.join('').length + q.explanation.length > m.prompt.length + m.options.join('').length + m.explanation.length ? q : m)); },
    set forceQuestion(q) { testQuestion = q; }, closeBattleForTest: () => { if (battle) closeBattle(); },
    screenOf(x, y) { const r = canvas.getBoundingClientRect(); return { x: r.left + (x * TILE + 16 - camera.x) * sceneScale, y: r.top + (y * TILE + 16 - camera.y) * sceneScale }; },
    standAtDoor(kind) { const b = map.buildings.find(b => b.kind === kind), f = doorFront(b); settleMovement(); state.x = f.x; state.y = f.y; view = { x: f.x, y: f.y }; state.dir = 'up'; return f; },
    goInside(kind) { const b = map.buildings.find(b => b.kind === kind), f = doorFront(b), p = pathfind(map, state.x, state.y, f.x, f.y, liveNPCs()); if (state.x === f.x && state.y === f.y) enterBuilding(b); else { path = p; pathAction = () => enterBuilding(b); } return p.length; },
    walkToTile(x, y) { const p = pathfind(map, moving?.toX ?? state.x, moving?.toY ?? state.y, x, y, liveNPCs()); path = p; pathAction = null; return p.length; }
  };
}
