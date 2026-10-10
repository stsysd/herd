/** シード付き乱数 (mulberry32)。テストで挙動を再現できるようにする */
export type Rng = () => number;

export const createRng = (seed: number): Rng => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const range = (rng: Rng, lo: number, hi: number): number => lo + (hi - lo) * rng();
