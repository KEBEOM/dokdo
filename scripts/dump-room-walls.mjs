// 건물 안 지도마다 벽 칸(방 왼쪽 위 기준) — scripts/import-glb-pack.py가 GLB 실내 모델과 맞는지 비교해요
import { createMap } from '../dist/world.js';
const ids = JSON.parse(process.argv[2]), out = {};
for (const id of ids) { try { const m = createMap(id); if (m.id !== id) { out[id] = null; continue; } const f = m.focus, walls = [];
  for (let y = 0; y < m.length; y++) for (let x = 0; x < m[0].length; x++) if (m[y][x] === 9) walls.push([x - f.x, y - f.y]);
  out[id] = { w: f.w, h: f.h, walls }; } catch { out[id] = null; } }
console.log(JSON.stringify(out));
