// Korean particles that follow the last syllable: 해국이 / 괭이갈매기가, 해국을 / 독도새우를.
const PAIRS = {
  '이/가': ['이', '가'], '을/를': ['을', '를'], '은/는': ['은', '는'], '과/와': ['과', '와'],
  '아/야': ['아', '야'], '이에요/예요': ['이에요', '예요'], '이랑/랑': ['이랑', '랑']
};
export function hasBatchim(word) {
  const s = String(word).trim(), c = s.charCodeAt(s.length - 1);
  if (c >= 0xac00 && c <= 0xd7a3) return (c - 0xac00) % 28 !== 0;
  return /[0-9lmnLMN]$/.test(s) ? !/[2459]$/.test(s) : false;
}
// '으로/로': 받침 ㄹ takes 로.
function rieul(word) { const s = String(word).trim(), c = s.charCodeAt(s.length - 1); return c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 === 8; }
export function josa(word, pair) {
  if (pair === '으로/로') return `${word}${hasBatchim(word) && !rieul(word) ? '으로' : '로'}`;
  const [withB, without] = PAIRS[pair] || pair.split('/');
  return `${word}${hasBatchim(word) ? withB : without}`;
}
// Fill "{species}을(를)" style templates: {name}이(가), {name}을(를), {name}은(는), {name}과(와), {name}(으)로.
export function fillJosa(template, values) {
  return String(template).replace(/\{(\w+)\}(이\(가\)|가\(이\)|을\(를\)|를\(을\)|은\(는\)|는\(은\)|과\(와\)|와\(과\)|\(으\)로|\(이\)에요)?/g, (_, key, particle) => {
    const v = values[key] ?? '';
    if (!particle) return v;
    const map = { '이(가)': '이/가', '가(이)': '이/가', '을(를)': '을/를', '를(을)': '을/를', '은(는)': '은/는', '는(은)': '은/는', '과(와)': '과/와', '와(과)': '과/와', '(으)로': '으로/로', '(이)에요': '이에요/예요' };
    return josa(v, map[particle]);
  });
}
