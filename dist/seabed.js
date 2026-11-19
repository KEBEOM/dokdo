import { MONSTERS } from './data.js';
// v0.87 바닷속(잠수했을 때): 바닥 타일·바다숲·생물·바위 지형·물고기 자리를 지도마다 한 번 정해요(같은 지도는 늘 같은 자리).
// 그림은 uw-atlas.js(「바닷속 HD-2D 에셋 v1」), 그리기는 terrain.js(바닥)·gl3d.js(세운 판·물고기), 충돌·살펴보기는 game.js가 이 표를 읽어요.
// 생물 설명은 동해·독도 바다에 맞춘 짧은 안내예요. 수업 자료로 쓰기 전에 선생님이 한 번 검수해 주세요.
// 물가에서 몇 칸 떨어졌는지(terrain.js seaDepth와 같은 계산 — 서로 불러오면 오프라인 판이 돌고 돌아서 여기에 따로 둬요)
function seaDepth(map) {
  const H = map.length, W = map[0].length, d = Array.from({ length: H }, () => new Array(W).fill(9)), q = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (map[y][x] !== 0) { d[y][x] = 0; q.push([x, y]); }
  for (let i = 0; i < q.length; i++) { const [x, y] = q[i]; for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) { const nx = x + a, ny = y + b; if (nx < 0 || ny < 0 || nx >= W || ny >= H || d[ny][nx] <= d[y][x] + 1) continue; d[ny][nx] = d[y][x] + 1; q.push([nx, ny]); } }
  return d;
}
// 바닷속에서 벽으로 보이는 칸: 땅(섬의 밑동) · 물 위의 바위(바위 지명 자리·바위섬) · 방파제 블록. 배 칸은 아니에요(배 밑으로 헤엄쳐 지나가요)
export function uwBlock(map, x, y) { const v = map[y]?.[x]; if (v === undefined) return false; if (v !== 0) return true; const k = `${x},${y}`; return !!(map.solid?.has(k) && !map.hull?.has(k)); }
// 항구 콘크리트(선착장·방파제): 바위 대신 안벽 무늬
export function uwQuay(map, x, y) { const v = map[y]?.[x]; return v === 6 || map.decor?.some(d => d.x === x && d.y === y && (d.kind === 'tetrapods' || d.kind === 'rail' || d.kind === 'railv')); }

const hash = (a, b, c = 0) => { let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 2147483647); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
export const UW_NOTE = '바닷속 관찰 · 설명은 수업 전 검수 필요';
// 살펴볼 수 있는 것(그림 id → 이름·설명). 같은 무리는 한 설명을 같이 써요
// v0.88 「울릉도·독도 지상·수중 v2」 안내에 맞췄어요: 그림만으로 생물 종·암석 종류를 정하지 않아요(이름은 ‘수중 바위’처럼 일반 이름).
// 기본 배치에서 뺀 그림(default_enabled:false): 연산호 3종 · 전복 2종 · 가리비 껍데기 · 육각 기둥 바위 — 독도에 없다는 뜻이 아니라, 그림이 무엇인지 확인하지 못해서예요.
export const UW_INFO = {
  kelp: { name: '바닷말 숲', lines: ['바위에 해조류가 숲처럼 자라 있어요. 독도 연안의 바위에는 갈조류 같은 바닷말이 숲을 이뤄요.', '바다숲은 물고기가 알을 낳고 숨는 집이자 먹이터예요. (그림 속 바닷말이 어떤 종인지는 정하지 않았어요.)'] },
  algae: { name: '바위의 해조류', lines: ['바위에 붙어 자라는 해조류예요.', '독도에는 어민들이 미역을 많이 따서 ‘미역바위’라는 이름이 붙은 바위도 있어요.'] },
  shell: { name: '빈 껍데기', lines: ['모래 위의 빈 껍데기예요.', '빈 껍데기는 작은 게나 물고기가 숨는 집이 되기도 해요. 가져가지 말고 그대로 두어요.'] },
  pebbles: { name: '바닷속 자갈', lines: ['물살에 구르며 둥글게 닳은 자갈이에요.', '독도는 바다 밑 화산 활동으로 생긴 섬이라, 섬과 바닷속의 바위도 화산이 만든 암석이에요.'] },
  rock: { name: '수중 바위', lines: ['물 위로 보이는 독도는 바다 밑에서 솟은 커다란 화산체의 꼭대기예요.', '바닷속 바위는 해조류와 물고기의 집이 돼요. (그림 속 바위가 어떤 암석인지는 정하지 않았어요.)'] },
  cave: { name: '바닷속 굴과 아치', lines: ['파도와 물살이 바위의 약한 곳을 오랫동안 깎으면 굴(해식동굴)이나 아치가 생겨요.', '독도의 ‘독립문바위’나 ‘삼형제굴바위’도 이렇게 깎여 생긴 모양이에요.'] },
};
// 기본 배치에서 뺀 그림(v2 안내 default_enabled:false)
// v0.89 바닷속 생물은 바다 생물 우산몬으로(물고기 18종 · 바닥 생물 12종). 바닷말 숲·바위·자갈·빈 껍데기는 바닷속 그림 그대로
export const UW_FISH = [34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51];
const BOTTOM = { shallow: [54, 55, 56, 58, 59, 60, 53, 57], mid: [57, 58, 59, 60, 62, 53, 55, 66], deep: [61, 62, 66, 57, 52] };
export const UW_BOTTOM = [...new Set(Object.values(BOTTOM).flat())].sort((a, b) => a - b);
// 바닷속에서 만난 우산몬을 살펴볼 때 붙는 바다 이야기(그 생물의 실제 이야기 · 모습과 능력은 게임용 창작)
export const UW_MON_NOTE = {
  58: '성게가 너무 많아지면 바다숲이 사라지고 바위가 하얗게 드러나는 ‘갯녹음’이 생겨요. 그래서 독도 바다에서도 성게를 줄이는 활동을 해요.',
  59: '성게는 해조류를 갉아 먹어요. 너무 많아지면 바다숲이 사라지는 ‘갯녹음’이 생겨요.',
  53: '전복은 바위에 붙어 해조류를 갉아 먹어요. 독도에 물질하러 온 해녀들이 따던 해산물이라 ‘해녀바위’라는 이름도 남아 있어요.',
  52: '문어는 바위틈에 숨어 살아요. 몸 색을 바꿔 주변 바위처럼 숨을 수 있어요.',
  54: '홍합은 물결이 닿는 바위에 실 같은 족사로 단단히 붙어 살아요.',
  56: '거북손은 파도가 부딪치는 바위틈에 무리 지어 붙어 살아요.',
  55: '바위게는 바위틈에 숨어 살다가 위험하면 집게를 들어 몸을 지켜요.',
  66: '독도새우는 독도 주변의 깊고 찬 바다에 사는 새우들을 함께 부르는 이름이에요.',
  50: '방어는 계절 따라 넓은 바다를 오가는 회유성 물고기예요.',
  37: '볼락 무리는 바위 근처에 머물러 살아요. 바위가 많은 독도 바다는 바위에 사는 물고기에게 좋은 집이에요.',
};
const near = (list, zone) => { const local = list.filter(id => Math.abs((MONSTERS.find(m => m.id === id)?.zone ?? 9) - zone) <= 1); return local.length >= 2 ? local : list; };
export const UW_DISABLED = new Set(['pink_soft_coral', 'soft_coral_on_rocks_01', 'soft_coral_on_rocks_02', 'abalone_open_01', 'abalone_open_02', 'scallop_shell', 'basalt_hex_columns']);
const GROUP = { kelp_tall_01: 'kelp', kelp_tall_02: 'kelp', kelp_medium_01: 'kelp', kelp_medium_02: 'kelp', kelp_short_01: 'kelp', kelp_short_02: 'kelp', green_algae_on_rocks: 'algae', pink_soft_coral: 'coral', soft_coral_on_rocks_01: 'coral', soft_coral_on_rocks_02: 'coral',
  abalone_open_01: 'abalone', abalone_open_02: 'abalone', sea_urchin_large: 'urchin', sea_urchin_small: 'urchin', whelk_shell: 'shell', whelk_shell_hollow: 'shell', scallop_shell: 'shell', snail_shell: 'shell', crab_green: 'crab', crab_red: 'crab', octopus: 'octopus', basalt_pebbles: 'pebbles',
  basalt_formation_large: 'rock', basalt_formation_small: 'rock', basalt_boulder: 'rock', basalt_low_ledge: 'rock', basalt_tall_pillars: 'rock', basalt_hex_columns: 'columns', basalt_sea_cave: 'cave', basalt_natural_arch: 'cave',
  fish_school_01: 'school', fish_school_02: 'school', rockfish_large: 'rockfish', rockfish_small: 'rockfish', yellowtail_large: 'yellowtail' };
export const uwGroup = id => GROUP[id] || null;
// 바위 지형: 바닥에 닿는 칸 수(가로) — 이 칸만 막혀요(그림 뒤로는 지나갈 수 있어요)
const FOOT = { basalt_formation_large: 3, basalt_formation_small: 2, basalt_boulder: 1, basalt_low_ledge: 2, basalt_tall_pillars: 2, basalt_sea_cave: 4, basalt_natural_arch: 4 };
// 바닥 타일: 깊이(물가에서 몇 칸)마다 고르는 무리
// (색이 비슷한 타일끼리 묶었어요: 모래색 → 회녹색 → 청록 → 짙은 청록)
// v0.90 깊이마다 한 띠(얕은 모래 → 자갈·해조 → 빛무늬 → 깊은 바닥)만 써요: 같은 띠의 타일은 이음매 없이 이어지고, 띠가 바뀌는 곳은 terrain.js가 색을 섞어요
const FLOOR = [null, ['sand_shallow_01', 'sand_shallow_02'], ['sand_rocks_01', 'sand_rocks_02', 'sand_seaweed_01', 'sand_seaweed_02'], ['sand_rocks_01', 'sand_seaweed_02', 'sand_rocks_02', 'sand_seaweed_01'],
  ['sand_sunlight_01', 'sand_sunlight_02'], ['sand_deep_01', 'sand_deep_02', 'sand_deep_03', 'sand_deep_04'], ['sand_deep_01', 'sand_deep_02', 'sand_deep_03', 'sand_deep_04']];
const cache = new Map();
export function seabedLayout(map) {
  if (!map || map.kind === 'room') return { floor: null, items: [], fish: [], solid: new Set() };
  const key = map.id; if (cache.has(key)) return cache.get(key);
  const mz = Number(map.zone) || 0, H = map.length, W = map[0].length, depth = seaDepth(map), z = String(map.id).split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const wet = (x, y) => map[y]?.[x] === 0 && !map.solid?.has(`${x},${y}`), used = new Set(), items = [], solid = new Set();
  const floor = Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => { if (map[y][x] !== 0) return null; const d = Math.min(6, depth[y][x]), list = FLOOR[d] || FLOOR[6]; return list[Math.floor(hash(x, y, z + 5) * list.length)]; }));
  const take = (id, x, y, extra = {}) => { items.push({ id, x, y, group: GROUP[id], ...extra }); used.add(`${x},${y}`); };
  // 1) 바위 지형: 깊은 곳(물가에서 4칸 넘게), 둘레가 모두 물인 자리에 지도마다 몇 개
  const big = Object.keys(FOOT), spots = [];
  for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 4; x++) if (depth[y][x] >= 4 && hash(x, y, z + 11) < .035) spots.push([x, y]);
  let placed = 0;
  for (const [x, y] of spots) { if (placed >= 6) break; const id = big[Math.floor(hash(x, y, z + 12) * big.length)], f = FOOT[id];
    let ok = true; for (let i = -1; i <= f; i++) for (let j = -2; j <= 1; j++) if (!wet(x + i, y + j) || used.has(`${x + i},${y + j}`)) ok = false; if (!ok) continue;
    for (let i = -1; i <= f; i++) for (let j = -2; j <= 1; j++) used.add(`${x + i},${y + j}`);
    const foot = []; for (let i = 0; i < f; i++) { foot.push([x + i, y]); solid.add(`${x + i},${y}`); }
    items.push({ id, x, y, w: f, group: GROUP[id], big: true, foot }); placed++; }
  // 2) 물가 바위벽: 북쪽이 땅인 물 칸(물속에서 보면 섬의 밑동)
  const edges = Array.from({ length: 12 }, (_, i) => `basalt_cliff_edge_${String(i + 1).padStart(2, '0')}`);
  for (let y = 1; y < H; y++) for (let x = 0; x < W; x++) if (wet(x, y) && map[y - 1][x] !== 0 && !used.has(`${x},${y}`) && hash(x, y, z + 21) < .55) take(edges[Math.floor(hash(x, y, z + 22) * 12)], x, y, { edge: true });
  // 3) 바다숲·생물: 깊이에 맞게
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!wet(x, y) || used.has(`${x},${y}`)) continue; const d = depth[y][x], r = hash(x, y, z + 31), pick = list => list[Math.floor(hash(x, y, z + 32) * list.length)];
    if (d >= 2 && d <= 5 && r < .09) take(pick(d >= 3 ? ['kelp_tall_01', 'kelp_tall_02', 'kelp_medium_01', 'kelp_medium_02'] : ['kelp_medium_01', 'kelp_medium_02', 'kelp_short_01', 'kelp_short_02']), x, y);
    else if (d >= 1 && d <= 3 && r < .12) take('green_algae_on_rocks', x, y); /* 얕은 암반 → 바닷말 숲 → 깊은 연안 암반(v2 안내의 3단계) */
    else if (d >= 1 && r < .175) { const list = near(d <= 2 ? BOTTOM.shallow : d <= 4 ? BOTTOM.mid : BOTTOM.deep, mz); take('mon', x, y, { mon: pick(list), group: 'mon', flip: hash(x, y, z + 33) < .5 }); } // 바닥 우산몬(쉬고 있어요)
    else if (d >= 1 && d <= 4 && r < .21) take(pick(['whelk_shell', 'whelk_shell_hollow', 'snail_shell', 'basalt_pebbles', 'basalt_pebbles']), x, y);
  }
  // 문어는 지도마다 한 마리: 바위 지형 옆(없으면 가장 깊은 곳)
  { const rk = items.find(i => i.big), sp = rk ? [rk.x + rk.w, rk.y] : null; if (sp && wet(...sp) && !used.has(`${sp[0]},${sp[1]}`)) take('mon', sp[0], sp[1], { mon: 52, group: 'mon', flip: false }); } // 참문어 우산몬
  // 4) 물고기: 물 칸 위를 천천히 오가요(바닥보다 위, 둥근 길)
  const fish = [], deep = []; for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) if (depth[y][x] >= 3) deep.push([x, y]);
  const fishPool = near(UW_FISH, mz), kinds = Array.from({ length: 6 }, (_, i) => fishPool[Math.floor(hash(i, z, 40) * fishPool.length)]); // 물고기 우산몬
  if (deep.length) for (let i = 0; i < Math.min(kinds.length, 2 + Math.floor(deep.length / 60)); i++) { const [x, y] = deep[Math.floor(hash(i, z, 41) * deep.length)];
    fish.push({ id: 'mon', mon: kinds[i], group: 'mon', x, y, rx: 2.5 + hash(i, z, 42) * 4, ry: .8 + hash(i, z, 43) * 1.5, speed: (kinds[i] === 50 ? .16 : .1) + hash(i, z, 44) * .06, phase: hash(i, z, 45) * 6.28, lift: 22 + hash(i, z, 46) * 30 }); }
  const out = { floor, items, fish, solid }; cache.set(key, out); return out;
}
// 지금 시각의 물고기 자리(칸 단위 소수)와 보는 방향(1 오른쪽, -1 왼쪽)
export function fishAt(f, t) { const a = f.phase + t * f.speed, x = f.x + Math.cos(a) * f.rx, y = f.y + Math.sin(a) * f.ry; return { x, y, dir: -Math.sin(a) >= 0 ? 1 : -1 }; }
