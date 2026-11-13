// ─────────────────────────────────────────────────────────────────────────────
// 지워진 기록 (v0.58) — 기록 되찾기 결투의 두루마리에 적히는 한 줄
//
// 검은 기운은 독도의 기록을 지워요. 문제를 맞힐 때마다 두루마리의 빈칸이 채워지고, 다 채우면 기록을 되찾아요.
// 모든 줄은 문제 은행(learning.js)의 사실에서 가져왔어요. zone: 이 장부터 나와요.
// ─────────────────────────────────────────────────────────────────────────────
export const RECORDS = [
  { zone: 0, text: '독도는 울릉도 동남쪽 87.4km' },
  { zone: 0, text: '독도는 동해의 우리 섬' },
  { zone: 0, text: '동도와 서도, 부속 섬 89개' },
  { zone: 0, text: '서도 168.5m 동도 98.6m' },
  { zone: 0, text: '경상북도 울릉군 울릉읍 독도리' },
  { zone: 1, text: '괭이갈매기가 번식하는 섬' },
  { zone: 1, text: '512년 이사부 우산국 복속' },
  { zone: 1, text: '난류와 한류가 흐르는 바다' },
  { zone: 1, text: '동도와 서도 사이 약 151m' },
  { zone: 2, text: '강치는 바다사자의 우리 이름' },
  { zone: 2, text: '천연기념물 독도 천연보호구역' },
  { zone: 2, text: '해국은 9~10월에 피는 꽃' },
  { zone: 2, text: '1882년 이규원 울릉도 검찰' },
  { zone: 3, text: '1693년 안용복과 박어둔' },
  { zone: 3, text: '동래 출신 능로군 안용복' },
  { zone: 3, text: '땅채송화와 개밀의 풀밭' },
  { zone: 3, text: '1454년 세종실록 지리지' },
  { zone: 4, text: '약 270만~210만 년 전 화산섬' },
  { zone: 4, text: '1900년 칙령 제41호 울도군' },
  { zone: 4, text: '10월 25일은 독도의 날' },
  { zone: 4, text: '서도 물골에서 떨어지는 물' },
  { zone: 5, text: '울릉전도와 죽도, 석도' },
  { zone: 5, text: '1696년 울릉우산양도감세관' },
  { zone: 5, text: '오징어 제철은 9월~1월' },
  { zone: 5, text: '2005년 동도 개방' },
  { zone: 6, text: '1906년 심흥택이 쓴 이름 독도' },
  { zone: 6, text: '1953년 독도의용수비대' },
  { zone: 6, text: '1877년 일본 태정관지령' },
  { zone: 6, text: '뿔쇠오리의 번식 확인' },
  { zone: 7, text: '1946년 지령 제677호' },
  { zone: 7, text: '홍순칠과 서른세 명의 대원' },
  { zone: 7, text: '2012년 울릉도·독도 국가지질공원' },
  { zone: 7, text: '독도경비대와 등대원이 지키는 섬' }
];
// 이 장에서 쓸 기록 하나(방금 쓴 것은 피해요)
export function pickRecord(zone, rng = Math.random, avoid = []) {
  const pool = RECORDS.filter(r => r.zone <= zone && !avoid.includes(r.text)), near = pool.filter(r => r.zone >= zone - 1);
  const from = near.length && rng() < .6 ? near : pool.length ? pool : RECORDS;
  return from[Math.floor(rng() * from.length)].text;
}
// 두루마리에 보일 글자들: done(0~1)만큼 채워요. 채우는 차례는 글마다 정해진 뒤섞인 순서예요.
export function recordCells(text, done) {
  const chars = [...text], idx = chars.map((c, i) => c === ' ' ? -1 : i).filter(i => i >= 0);
  let seed = 0; for (const c of chars) seed = (seed * 31 + c.codePointAt(0)) >>> 0;
  const order = [...idx];
  for (let i = order.length - 1; i > 0; i--) { seed = (seed * 1664525 + 1013904223) >>> 0; const j = seed % (i + 1); [order[i], order[j]] = [order[j], order[i]]; }
  const shown = new Set(order.slice(0, Math.round(Math.max(0, Math.min(1, done)) * order.length)));
  return chars.map((c, i) => ({ char: c, space: c === ' ', shown: c === ' ' || shown.has(i) }));
}
