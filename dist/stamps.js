// ─────────────────────────────────────────────────────────────────────────────
// 독도 지킴이 도장 그림 (v0.48)
//
// 지킴이를 이기면 모험 수첩에 찍히는 도장이에요. 스탬프 투어처럼 장소마다 그 곳을 닮은 그림을 넣었어요.
//   도동항 닻과 물결(항구) · 우산봉 산봉우리와 바람·돛단배(옛 항로) · 한반도바위 한반도를 닮은 바위
//   탕건봉 탕건(옛 모자)을 닮은 봉우리 · 가제바위 바위 위의 강치(가제=강치) · 코끼리바위 코끼리 모양 바위와 별
//   물골 동굴 속 샘물과 등대 · 대한봉 두 봉우리(쌍봉)와 떠오르는 해
// 그림은 100×100 칸의 SVG로 그리고, 잉크가 번진 듯한 거친 느낌(feTurbulence)을 더해요. 색은 currentColor(붉은 인주).
// ─────────────────────────────────────────────────────────────────────────────

const FRAMES = {
  circle: '<circle cx="50" cy="50" r="46" stroke-width="4.5"/><circle cx="50" cy="50" r="39.5" stroke-width="1.6"/>',
  square: '<rect x="5" y="5" width="90" height="90" rx="15" stroke-width="4.5"/><rect x="11.5" y="11.5" width="77" height="77" rx="10" stroke-width="1.6"/>',
  octagon: '<polygon points="31,5 69,5 95,31 95,69 69,95 31,95 5,69 5,31" stroke-width="4.5"/><polygon points="33.5,11 66.5,11 89,33.5 89,66.5 66.5,89 33.5,89 11,66.5 11,33.5" stroke-width="1.6"/>',
  hexagon: '<polygon points="50,4 91,27 91,73 50,96 9,73 9,27" stroke-width="4.5"/><polygon points="50,11 85,31 85,69 50,89 15,69 15,31" stroke-width="1.6"/>',
  shield: '<path d="M50 5 L90 16 L88 58 Q84 82 50 96 Q16 82 12 58 L10 16 Z" stroke-width="4.5"/><path d="M50 11.5 L84 21 L82.5 57 Q79 77 50 89 Q21 77 17.5 57 L16 21 Z" stroke-width="1.6"/>'
};
const waves = (y, x0 = 22, x1 = 78) => { let d = `M${x0} ${y}`; for (let x = x0; x < x1; x += 8) d += ` q4 -3.5 8 0`; return `<path d="${d}" fill="none" stroke-width="2.4" stroke-linecap="round"/>`; };

// art: 그림(채움 fill / 선 stroke 모두 currentColor) · label: 아래쪽 글자
export const STAMP_ART = [
  { // 도동항: 항구 — 닻과 물결
    frame: 'circle', label: '도동항',
    art: `<circle cx="50" cy="24" r="5" fill="none" stroke-width="3"/><path d="M50 29 V62" stroke-width="4" stroke-linecap="round"/><path d="M39 36 H61" stroke-width="3.6" stroke-linecap="round"/>
          <path d="M31 50 Q33 66 50 66 Q67 66 69 50" fill="none" stroke-width="3.6" stroke-linecap="round"/><path d="M26 52 L31 46 L36 52 Z M64 52 L69 46 L74 52 Z" stroke-width="1"/>
          ${waves(73, 24, 76)}`
  },
  { // 우산봉: 바람 속의 산봉우리와 옛 항로의 돛단배
    frame: 'square', label: '우산봉',
    art: `<path d="M20 66 L42 32 L52 46 L60 36 L80 66 Z" stroke-width="1.5"/><path d="M42 32 L46 38 L42 41 L38 38 Z" fill="#fbf3df" stroke="none"/>
          <path d="M18 27 q8 -6 16 0 t16 0" fill="none" stroke-width="2.2" stroke-linecap="round"/><path d="M58 22 q7 -5 14 0" fill="none" stroke-width="2" stroke-linecap="round"/>
          <path d="M66 50 V60 M66 51 L74 59 H66 M59 61 H76 L73 64 H62 Z" stroke-width="1.6" fill="none"/>${waves(71, 20, 80)}`
  },
  { // 한반도바위: 한반도를 닮은 바위
    frame: 'octagon', label: '한반도바위',
    art: `<path d="M53 16 L60 19 L64 18 L66 24 L60 30 L63 37 L60 44 L65 51 L63 59 L57 66 L50 70 L44 68 L46 61 L41 55 L44 47 L39 40 L43 33 L40 26 L46 22 Z" stroke-width="1.4" transform="translate(-14 0) scale(1.27 1)"/>
          <path d="M26 70 Q38 64 50 72 Q62 64 74 70" fill="none" stroke-width="2.6" stroke-linecap="round"/>${waves(76, 24, 76)}`
  },
  { // 탕건봉: 탕건(말총으로 엮은 옛 모자)을 닮은 봉우리
    frame: 'square', label: '탕건봉',
    art: `<path d="M26 64 L29 46 Q31 40 38 40 L44 40 L46 30 Q50 22 60 22 Q70 22 72 32 L74 64 Z" fill="none" stroke-width="3.4" stroke-linejoin="round"/>
          <path d="M46 30 Q60 26 72 32 M29 46 Q37 43 45 44" fill="none" stroke-width="1.8"/><path d="M34 47 V62 M40 45 V62 M50 32 V62 M56 29 V62 M62 29 V62 M68 31 V62" stroke-width="1.4"/>
          <path d="M23 60 H77 V65 H23 Z" stroke-width="1"/>${waves(72, 22, 78)}`
  },
  { // 가제바위: 바위 위에서 쉬는 강치(가제는 강치를 부르던 옛말)
    frame: 'circle', label: '가제바위',
    art: `<path d="M18 68 Q24 56 36 58 Q44 52 54 58 Q66 54 82 68 Z" stroke-width="1.2"/>
          <path d="M32 58 Q30 44 42 38 Q46 28 55 27 Q61 27 62 31 Q63 34 58 35 L55 35 Q60 44 66 56 Q58 54 52 57 Q44 52 32 58 Z" fill="#fbf3df" stroke-width="2.8" stroke-linejoin="round"/>
          <circle cx="56" cy="30.5" r="1.4" stroke="none"/><path d="M62 33 L68 31 M62 34.5 L68 35" stroke-width="1.1"/><path d="M44 50 Q40 56 36 55" fill="none" stroke-width="2.2"/>${waves(74, 22, 78)}`
  },
  { // 코끼리바위: 코를 바다에 담근 코끼리 모양 바위와 별빛
    frame: 'shield', label: '코끼리바위',
    art: `<path d="M18 70 L21 48 Q30 28 50 30 Q68 32 72 50 L72 70 L64 70 Q64 56 58 54 Q53 54 52 62 L52 70 Z" stroke-width="1.2"/><circle cx="34" cy="43" r="2.2" fill="#fbf3df" stroke="none"/>
          <path d="M73 20 L75 26 L81 28 L75 30 L73 36 L71 30 L65 28 L71 26 Z" stroke-width=".8"/><path d="M14 72 H86" stroke-width="2.4" stroke-linecap="round"/>`
  },
  { // 물골: 서도의 동굴에서 솟는 샘물, 섬을 지키는 등대
    frame: 'hexagon', label: '물골',
    art: `<path d="M22 70 V50 Q22 28 46 28 Q70 28 70 50 V70" fill="none" stroke-width="4" stroke-linecap="round"/>
          <path d="M46 40 Q54 52 46 59 Q38 52 46 40 Z" stroke-width="1"/><path d="M32 66 q7 -3 14 0 t14 0" fill="none" stroke-width="2"/>
          <path d="M76 70 L78 44 H82 L84 70 Z M77 41 H83 L80 36 Z" stroke-width="1"/><path d="M71 39 L76 40 M84 40 L89 39" stroke-width="1.4"/>`
  },
  { // 대한봉: 서도의 두 봉우리(쌍봉)와 떠오르는 해
    frame: 'circle', label: '대한봉',
    art: `<circle cx="50" cy="54" r="13" fill="none" stroke-width="2.6"/><path d="M50 34 V38 M36 40 L39 43 M64 40 L61 43 M30 54 H34 M66 54 H70" stroke-width="2.2" stroke-linecap="round"/>
          <path d="M16 70 L34 42 L46 58 L60 34 L84 70 Z" stroke-width="1.2"/><path d="M60 34 L64 40 L60 43 L56 40 Z M34 42 L37 47 L34 49 L31 47 Z" fill="#fbf3df" stroke="none"/>`
  }
];

// 아래쪽 글자 자리: 틀이 좁아지는 곳(동그라미·육각형·방패)은 조금 위로
const LABEL_Y = { circle: 82, square: 86, octagon: 82, hexagon: 78, shield: 77 };
// 도장 하나를 SVG로 (번짐 효과는 도장마다 조금씩 다르게)
export function stampSVG(i) {
  const s = STAMP_ART[i]; if (!s) return '';
  const id = `ink${i}`;
  return `<svg class="stamp-svg" viewBox="0 0 100 100" role="img" aria-label="${s.label} 도장" xmlns="http://www.w3.org/2000/svg">
    <defs><filter id="${id}" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="${i * 7 + 3}" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="1.6" result="d"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.1 1.5" result="speck"/><feComposite in="d" in2="speck" operator="in"/></filter></defs>
    <g filter="url(#${id})" fill="currentColor" stroke="currentColor" fill-opacity="1">
      <g fill="none">${FRAMES[s.frame]}</g><g transform="translate(6 1.5) scale(.88)">${s.art}</g>
      <text x="50" y="${LABEL_Y[s.frame]}" text-anchor="middle" font-size="${s.label.length >= 5 ? 9 : s.label.length === 4 ? 10.5 : 12}" font-weight="900" stroke="none" style="font-family:var(--serif, serif);letter-spacing:.06em">${s.label}</text>
    </g></svg>`;
}
