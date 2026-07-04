// Deterministic, seedable RNG (mulberry32).
// 決定論的な乱数：同じ seed から同じ列 → テスト再現性のため。
export function makeRng(seed) {
  let s = seed >>> 0;
  return function next() {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 0..n-1 の整数
export function randInt(rng, n) {
  return Math.floor(rng() * n);
}

// 配列からランダムに1つ
export function pick(rng, arr) {
  return arr[randInt(rng, arr.length)];
}
