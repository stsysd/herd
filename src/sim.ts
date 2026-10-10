import { createRng, range, type Rng } from "./rng";
import {
  add,
  angleDiff,
  clamp,
  closestOnSegment,
  dist,
  dot,
  fromAngle,
  len,
  limit,
  norm,
  scale,
  sub,
  vec,
  type Vec,
} from "./vec";

/**
 * 羊の行動状態。
 * - graze: ほぼ止まって草を食む
 * - walk: 数歩だけ歩く(近くの羊について行く)
 * - alert: 犬に気づいて顔を上げ、犬を気にしながらじわじわ離れる
 * - flee: 逃げる。群れの中心に寄り、仲間と向きを揃えて走る
 */
export type SheepState = "graze" | "walk" | "alert" | "flee";

export interface Sheep {
  id: number;
  pos: Vec;
  vel: Vec;
  /** 体の向き(ラジアン)。速度と別に持ち、旋回速度を制限する */
  heading: number;
  state: SheepState;
  /** 恐怖 0..1。犬との距離と仲間からの伝染で上下する */
  fear: number;
  /** graze / walk の残り時間 */
  stateTimer: number;
  /** walk 中のふらつき方向 */
  wander: number;
}

export interface Dog {
  pos: Vec;
  vel: Vec;
  heading: number;
  target: Vec;
  /** 吠えてからの残り表示時間(演出用) */
  barkTimer: number;
}

export interface Segment {
  a: Vec;
  b: Vec;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Params {
  sheepCount: number;
  sheepRadius: number;
  dogRadius: number;
  /** 群れの仲間として意識する距離 */
  neighborRadius: number;
  /** これより近い仲間からは離れようとする */
  separationRadius: number;
  /** 犬がこの距離に入ると逃げ出す(犬が迫る速さで広がる) */
  flightRadius: number;
  /** 犬がこの距離に入ると警戒する */
  alertRadius: number;
  walkSpeed: number;
  runSpeed: number;
  dogSpeed: number;
  dogAccel: number;
  /** 恐怖が仲間に伝わる割合 */
  contagion: number;
  /** 恐怖の上がる速さ(1/s) */
  fearRise: number;
  /** 恐怖の下がる速さ(/s) */
  fearDecay: number;
  /** 逃げるときに群れの中心へ寄る強さ */
  cohesion: number;
  /** 逃げるときに仲間と向きを揃える強さ */
  alignment: number;
  barkRadius: number;
  /** 近すぎる仲間から離れる強さ(落ち着いているとき, px/s) */
  separation: number;
  /** 近すぎる仲間から離れる強さ(怖いとき, px/s) */
  separationFear: number;
  /** 歩くときに近くの仲間の中心へ寄る強さ */
  walkCohesion: number;
  /** 歩くときに近くの仲間と向きを揃える強さ */
  walkAlignment: number;
  /** 歩くときに見える範囲の仲間へ引かれる強さ(分かれた群れの合流) */
  farAttraction: number;
  /** 草を食む時間の平均(s) */
  grazeTime: number;
  /** 一度に歩く時間の平均(s) */
  walkTime: number;
  /** 警戒中に離れていく速さの上限(歩く速さの倍率) */
  alertSpeed: number;
  /** 逃げるときに犬から離れる強さ */
  fleeStrength: number;
  /** 犬が迫る速さで逃走距離が広がる割合 */
  flightSpeedBonus: number;
  /** 加速の上限(落ち着いているとき, px/s²) */
  accel: number;
  /** 加速の上限(怖いとき, px/s²) */
  accelFear: number;
  /** 旋回の上限(落ち着いているとき, rad/s) */
  turnRate: number;
  /** 旋回の上限(怖いとき, rad/s) */
  turnRateFear: number;
}

export const defaultParams: Params = {
  sheepCount: 40,
  sheepRadius: 9,
  dogRadius: 9,
  neighborRadius: 70,
  separationRadius: 24,
  flightRadius: 110,
  alertRadius: 220,
  walkSpeed: 18,
  runSpeed: 95,
  dogSpeed: 190,
  dogAccel: 1100,
  contagion: 0.85,
  fearRise: 5,
  fearDecay: 0.18,
  cohesion: 0.9,
  alignment: 0.8,
  barkRadius: 230,
  separation: 30,
  separationFear: 80,
  walkCohesion: 0.7,
  walkAlignment: 0.3,
  farAttraction: 0.4,
  grazeTime: 4.5,
  walkTime: 1.65,
  alertSpeed: 2,
  fleeStrength: 1.6,
  flightSpeedBonus: 0.7,
  accel: 40,
  accelFear: 400,
  turnRate: 1.5,
  turnRateFear: 7.5,
};

export interface World {
  width: number;
  height: number;
  params: Params;
  sheep: Sheep[];
  dog: Dog;
  fences: Segment[];
  pen: Rect;
  rng: Rng;
  time: number;
}

const FLEE_ENTER = 0.3;
const FLEE_EXIT = 0.12;
const ALERT_ENTER = 0.06;

/** 右側に左向きの入口を持つ囲いを作る */
const makePen = (pen: Rect, gap: number): Segment[] => {
  const { x, y, w, h } = pen;
  const g0 = y + (h - gap) / 2;
  const g1 = g0 + gap;
  return [
    { a: vec(x, y), b: vec(x + w, y) },
    { a: vec(x + w, y), b: vec(x + w, y + h) },
    { a: vec(x, y + h), b: vec(x + w, y + h) },
    { a: vec(x, y), b: vec(x, g0) },
    { a: vec(x, g1), b: vec(x, y + h) },
  ];
};

export interface WorldOptions {
  seed?: number;
  params?: Partial<Params>;
}

export const createWorld = (opts: WorldOptions = {}): World => {
  const params = { ...defaultParams, ...opts.params };
  const rng = createRng(opts.seed ?? 1);
  const width = 1200;
  const height = 800;
  const pen: Rect = { x: 900, y: 270, w: 230, h: 260 };

  const sheep: Sheep[] = [];
  const center = vec(380, 400);
  for (let i = 0; i < params.sheepCount; i++) {
    let pos = center;
    for (let tries = 0; tries < 50; tries++) {
      const r = 150 * Math.sqrt(rng());
      const t = rng() * Math.PI * 2;
      pos = add(center, scale(fromAngle(t), r));
      if (sheep.every((s) => dist(s.pos, pos) > params.sheepRadius * 2.4)) break;
    }
    sheep.push({
      id: i,
      pos,
      vel: vec(0, 0),
      heading: rng() * Math.PI * 2,
      state: "graze",
      fear: 0,
      stateTimer: range(rng, 0, 5),
      wander: rng() * Math.PI * 2,
    });
  }

  const dogPos = vec(70, 730);
  return {
    width,
    height,
    params,
    sheep,
    dog: { pos: dogPos, vel: vec(0, 0), heading: 0, target: dogPos, barkTimer: 0 },
    fences: makePen(pen, 110),
    pen,
    rng,
    time: 0,
  };
};

export const setDogTarget = (world: World, target: Vec): void => {
  world.dog.target = {
    x: clamp(target.x, 0, world.width),
    y: clamp(target.y, 0, world.height),
  };
};

/** 吠える。周りの羊の恐怖を一気に上げる */
export const bark = (world: World): void => {
  const { dog, params } = world;
  dog.barkTimer = 0.4;
  for (const s of world.sheep) {
    const d = dist(s.pos, dog.pos);
    if (d < params.barkRadius) {
      s.fear = Math.max(s.fear, 0.6 + 0.4 * (1 - d / params.barkRadius));
    }
  }
};

export const isInPen = (world: World, p: Vec): boolean => {
  const { x, y, w, h } = world.pen;
  return p.x > x && p.x < x + w && p.y > y && p.y < y + h;
};

export const countInPen = (world: World): number =>
  world.sheep.filter((s) => isInPen(world, s.pos)).length;

/** 犬が迫る速さを考慮した実効的な逃走距離 */
export const effectiveFlightRadius = (world: World, s: Sheep): number => {
  const { dog, params } = world;
  const toSheep = norm(sub(s.pos, dog.pos));
  const closing = clamp(dot(dog.vel, toSheep) / params.dogSpeed, 0, 1);
  return params.flightRadius * (1 + params.flightSpeedBonus * closing);
};

const updateDog = (world: World, dt: number): void => {
  const { dog, params } = world;
  const toTarget = sub(dog.target, dog.pos);
  const d = len(toTarget);
  // 目標の近くでは減速する(arrive)
  const speed = d < 60 ? params.dogSpeed * (d / 60) : params.dogSpeed;
  const desired = scale(norm(toTarget), speed);
  const steer = limit(sub(desired, dog.vel), params.dogAccel * dt);
  dog.vel = limit(add(dog.vel, steer), params.dogSpeed);
  dog.pos = add(dog.pos, scale(dog.vel, dt));
  if (len(dog.vel) > 5) dog.heading = Math.atan2(dog.vel.y, dog.vel.x);
  dog.barkTimer = Math.max(0, dog.barkTimer - dt);
};

const updateFear = (world: World, s: Sheep, neighbors: Sheep[], dt: number): void => {
  const { dog, params } = world;
  const d = dist(s.pos, dog.pos);
  const flightR = effectiveFlightRadius(world, s);

  let target = 0;
  if (d < flightR) {
    target = Math.min(1, 0.45 + 0.8 * (1 - d / flightR));
  } else if (d < params.alertRadius) {
    target = 0.25 * (1 - (d - flightR) / (params.alertRadius - flightR));
  }

  // 恐怖の伝染: 近くで一番怖がっている仲間から、距離に応じて弱めて伝わる
  for (const n of neighbors) {
    const w = 1 - 0.4 * (dist(s.pos, n.pos) / params.neighborRadius);
    target = Math.max(target, params.contagion * w * n.fear);
  }

  if (target > s.fear) {
    s.fear += (target - s.fear) * Math.min(1, params.fearRise * dt);
  } else {
    s.fear = Math.max(target, s.fear - params.fearDecay * dt);
  }
};

const updateState = (world: World, s: Sheep, neighbors: Sheep[], dt: number): void => {
  const { rng, params } = world;
  if (s.state === "flee" ? s.fear > FLEE_EXIT : s.fear > FLEE_ENTER) {
    s.state = "flee";
    return;
  }
  if (s.fear > ALERT_ENTER) {
    s.state = "alert";
    s.stateTimer = range(rng, 0.5, 2);
    return;
  }
  if (s.state === "flee" || s.state === "alert") {
    // 落ち着いた直後は少し歩いてから草を食む
    s.state = "walk";
    s.stateTimer = range(rng, 0.5, 1.5);
    return;
  }

  s.stateTimer -= dt;
  const isolated = neighbors.length === 0;
  if (s.state === "graze") {
    // 歩いている仲間が多いとつられて歩き出す
    const walking = neighbors.filter((n) => n.state === "walk").length;
    const follow = neighbors.length > 0 ? walking / neighbors.length : 0;
    if (s.stateTimer <= 0 || isolated || rng() < follow * 1.5 * dt) {
      s.state = "walk";
      s.stateTimer = vary(rng, params.walkTime);
      s.wander = s.heading + range(rng, -0.8, 0.8);
    }
  } else if (s.stateTimer <= 0 && !isolated) {
    s.state = "graze";
    s.stateTimer = vary(rng, params.grazeTime);
  }
};

/** 平均 mean の前後 ±55% でばらつかせる */
const vary = (rng: Rng, mean: number): number => mean * range(rng, 0.45, 1.55);

const wallAvoidance = (world: World, p: Vec, margin: number): Vec => {
  let f = vec(0, 0);
  const { width, height } = world;
  if (p.x < margin) f.x += 1 - p.x / margin;
  if (p.x > width - margin) f.x -= 1 - (width - p.x) / margin;
  if (p.y < margin) f.y += 1 - p.y / margin;
  if (p.y > height - margin) f.y -= 1 - (height - p.y) / margin;
  for (const seg of world.fences) {
    const q = closestOnSegment(p, seg.a, seg.b);
    const d = dist(p, q);
    if (d < margin * 0.6 && d > 1e-6) {
      f = add(f, scale(sub(p, q), (1 - d / (margin * 0.6)) / d));
    }
  }
  return f;
};

const desiredVelocity = (world: World, s: Sheep, neighbors: Sheep[]): Vec => {
  const { dog, params, rng } = world;

  // 分離は状態によらず常に働く(px/s)
  let sep = vec(0, 0);
  for (const n of neighbors) {
    const d = dist(s.pos, n.pos);
    if (d < params.separationRadius && d > 1e-6) {
      sep = add(sep, scale(sub(s.pos, n.pos), (1 - d / params.separationRadius) / d));
    }
  }
  sep = scale(sep, params.separation + (params.separationFear - params.separation) * s.fear);

  const walls = wallAvoidance(world, s.pos, 50);

  let center = vec(0, 0);
  let avgVel = vec(0, 0);
  for (const n of neighbors) {
    center = add(center, n.pos);
    avgVel = add(avgVel, n.vel);
  }
  const hasNeighbors = neighbors.length > 0;
  if (hasNeighbors) {
    center = scale(center, 1 / neighbors.length);
  }
  const toCenter = sub(center, s.pos);
  const toCenterDir = scale(
    norm(toCenter),
    Math.min(1, len(toCenter) / (params.neighborRadius * 0.5)),
  );

  let dir = vec(0, 0);
  let speed = 0;
  switch (s.state) {
    case "graze":
      speed = 0;
      break;
    case "alert": {
      // 落ち着かない羊は犬を気にしながら、犬から離れる向きにじわじわ歩く。
      // 恐怖は伝染するので、犬から遠い羊も一緒に動き、群れ全体が押される
      const k = clamp((s.fear - ALERT_ENTER) / (FLEE_ENTER - ALERT_ENTER), 0, 1);
      speed = params.walkSpeed * (0.4 + (params.alertSpeed - 0.4) * k);
      dir = add(dir, norm(sub(s.pos, dog.pos)));
      if (hasNeighbors) {
        dir = add(dir, scale(toCenterDir, 0.5));
        dir = add(dir, scale(norm(avgVel), 0.5));
      }
      break;
    }
    case "walk": {
      speed = params.walkSpeed;
      s.wander += range(rng, -0.15, 0.15);
      dir = add(dir, scale(fromAngle(s.wander), 0.6));
      if (hasNeighbors) {
        dir = add(dir, scale(toCenterDir, params.walkCohesion));
        dir = add(dir, scale(norm(avgVel), params.walkAlignment));
        // 見える範囲の仲間にもゆるく引かれ、分かれた群れはやがて合流する
        dir = add(dir, scale(norm(sub(visibleCenter(world, s), s.pos)), params.farAttraction));
      } else {
        // はぐれた羊は一番近い仲間の方へ急ぐ
        const nearest = nearestSheep(world, s);
        if (nearest) {
          dir = add(dir, scale(norm(sub(nearest.pos, s.pos)), 2));
          speed = params.walkSpeed * 2;
        }
      }
      break;
    }
    case "flee": {
      const f = s.fear;
      speed = params.walkSpeed + (params.runSpeed - params.walkSpeed) * f;
      const away = sub(s.pos, dog.pos);
      const d = len(away);
      const threat = clamp(1 - d / (params.alertRadius * 1.2), 0, 1);
      dir = add(dir, scale(norm(away), params.fleeStrength * threat));
      if (hasNeighbors) {
        // 自分勝手な群れ(selfish herd): 怖いほど群れの中心へ潜り込む
        dir = add(dir, scale(toCenterDir, params.cohesion * (0.4 + f)));
        dir = add(dir, scale(norm(avgVel), params.alignment * (0.3 + f)));
      }
      break;
    }
  }
  dir = add(dir, scale(walls, 2.5));

  return add(add(scale(norm(dir), speed), sep), scale(walls, 40));
};

/** 見える範囲(neighborRadius の 4 倍)にいる仲間の重心 */
const visibleCenter = (world: World, s: Sheep): Vec => {
  const r = world.params.neighborRadius * 4;
  let c = vec(0, 0);
  let n = 0;
  for (const o of world.sheep) {
    if (dist(o.pos, s.pos) < r) {
      c = add(c, o.pos);
      n++;
    }
  }
  return scale(c, 1 / n);
};

const nearestSheep = (world: World, s: Sheep): Sheep | undefined => {
  let best: Sheep | undefined;
  let bestD = Infinity;
  for (const o of world.sheep) {
    if (o === s) continue;
    const d = dist(o.pos, s.pos);
    if (d < bestD) {
      bestD = d;
      best = o;
    }
  }
  return best;
};

const updateSheep = (world: World, dt: number): void => {
  const { params, dog } = world;
  const neighborsOf = world.sheep.map((s) =>
    world.sheep.filter((o) => o !== s && dist(o.pos, s.pos) < params.neighborRadius),
  );

  world.sheep.forEach((s, i) => updateFear(world, s, neighborsOf[i], dt));
  world.sheep.forEach((s, i) => updateState(world, s, neighborsOf[i], dt));

  const desired = world.sheep.map((s, i) => desiredVelocity(world, s, neighborsOf[i]));

  world.sheep.forEach((s, i) => {
    // 慣性: 怖いほど機敏に加速・旋回できる
    const accel = params.accel + (params.accelFear - params.accel) * s.fear;
    const steer = limit(sub(desired[i], s.vel), accel * dt);
    s.vel = limit(add(s.vel, steer), params.runSpeed);
    // 止まっているときは摩擦で減速する
    if (s.state === "graze") s.vel = scale(s.vel, Math.exp(-3 * dt));

    const speed = len(s.vel);
    let targetHeading = s.heading;
    if (speed > 4) {
      targetHeading = Math.atan2(s.vel.y, s.vel.x);
    } else if (s.state === "alert") {
      // 立ち止まって犬の方を見る
      targetHeading = Math.atan2(dog.pos.y - s.pos.y, dog.pos.x - s.pos.x);
    }
    const turnRate = params.turnRate + (params.turnRateFear - params.turnRate) * s.fear;
    const dh = angleDiff(targetHeading, s.heading);
    s.heading += clamp(dh, -turnRate * dt, turnRate * dt);

    s.pos = add(s.pos, scale(s.vel, dt));
  });
};

/** 重なりを押し戻す */
const resolveCollisions = (world: World): void => {
  const { params, dog } = world;
  const r = params.sheepRadius;
  const ss = world.sheep;
  for (let i = 0; i < ss.length; i++) {
    for (let j = i + 1; j < ss.length; j++) {
      const a = ss[i];
      const b = ss[j];
      const d = dist(a.pos, b.pos);
      const min = r * 2;
      if (d < min && d > 1e-6) {
        const push = scale(sub(a.pos, b.pos), (min - d) / d / 2);
        a.pos = add(a.pos, push);
        b.pos = sub(b.pos, push);
      }
    }
    const a = ss[i];
    const d = dist(a.pos, dog.pos);
    const min = r + params.dogRadius;
    if (d < min && d > 1e-6) {
      a.pos = add(dog.pos, scale(sub(a.pos, dog.pos), min / d));
    }
  }
  for (const s of ss) s.pos = collideStatic(world, s.pos, r);
  dog.pos = collideStatic(world, dog.pos, params.dogRadius);
};

const collideStatic = (world: World, p: Vec, r: number): Vec => {
  let q = p;
  for (const seg of world.fences) {
    const c = closestOnSegment(q, seg.a, seg.b);
    const d = dist(q, c);
    if (d < r) {
      q = d > 1e-6 ? add(c, scale(sub(q, c), r / d)) : add(q, vec(r, 0));
    }
  }
  return {
    x: clamp(q.x, r, world.width - r),
    y: clamp(q.y, r, world.height - r),
  };
};

export const step = (world: World, dt: number): void => {
  updateDog(world, dt);
  updateSheep(world, dt);
  resolveCollisions(world);
  world.time += dt;
};
