export interface Vec {
  x: number;
  y: number;
}

export const vec = (x: number, y: number): Vec => ({ x, y });
export const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (a: Vec, k: number): Vec => ({ x: a.x * k, y: a.y * k });
export const dot = (a: Vec, b: Vec): number => a.x * b.x + a.y * b.y;
export const len = (a: Vec): number => Math.hypot(a.x, a.y);
export const dist = (a: Vec, b: Vec): number => Math.hypot(a.x - b.x, a.y - b.y);

export const norm = (a: Vec): Vec => {
  const l = len(a);
  return l > 1e-9 ? { x: a.x / l, y: a.y / l } : { x: 0, y: 0 };
};

export const limit = (a: Vec, max: number): Vec => {
  const l = len(a);
  return l > max ? scale(a, max / l) : a;
};

export const fromAngle = (t: number): Vec => ({ x: Math.cos(t), y: Math.sin(t) });

/** 角度差を (-π, π] に正規化する */
export const angleDiff = (a: number, b: number): number => {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d <= -Math.PI) d += Math.PI * 2;
  return d;
};

export const clamp = (x: number, lo: number, hi: number): number =>
  x < lo ? lo : x > hi ? hi : x;

/** 線分 ab 上で p に最も近い点 */
export const closestOnSegment = (p: Vec, a: Vec, b: Vec): Vec => {
  const ab = sub(b, a);
  const l2 = dot(ab, ab);
  if (l2 === 0) return a;
  const t = clamp(dot(sub(p, a), ab) / l2, 0, 1);
  return { x: a.x + ab.x * t, y: a.y + ab.y * t };
};
