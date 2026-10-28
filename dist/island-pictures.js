// 독도·울릉도 도트 그림 고르기(v0.38). 쓰는 너비에 가장 가까운 크기의 그림을 골라요(작을수록 멀리 있는 듯 흐린 그림).
import { CUTSCENE_ATLAS } from './cutscene-atlas.js';
const SIZES = { dokdo: [96, 104, 110, 120, 150, 224, 360], seodo: [58, 90, 100, 120], ulleung: [104, 120, 150, 160, 190, 196, 220] };
export function islandFrame(kind, width) {
  const best = SIZES[kind].reduce((a, b) => Math.abs(b - width) < Math.abs(a - width) ? b : a);
  return CUTSCENE_ATLAS.frames[`${kind}-${best}`];
}
