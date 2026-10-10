import { createRng } from "./rng";
import type { Dog, Sheep, SheepState, World } from "./sim";
import type { Vec } from "./vec";

export interface View {
  scale: number;
  ox: number;
  oy: number;
}

/** ワールド全体が画面に収まるように拡大率と余白を決める */
export const fitView = (world: World, cw: number, ch: number): View => {
  const scale = Math.min(cw / world.width, ch / world.height);
  return {
    scale,
    ox: (cw - world.width * scale) / 2,
    oy: (ch - world.height * scale) / 2,
  };
};

export const screenToWorld = (view: View, p: Vec): Vec => ({
  x: (p.x - view.ox) / view.scale,
  y: (p.y - view.oy) / view.scale,
});

const COLORS = {
  outside: "#4d7a35",
  grass: "#79a855",
  pen: "#9a8a5c",
  fence: "#6b4a2b",
  post: "#4a321c",
  wool: "#f3efe4",
  woolEdge: "#d6cfbd",
  face: "#2f2a27",
  dog: "#1c1c22",
  dogWhite: "#f2f2f0",
  shadow: "rgba(0,0,0,0.18)",
};

const STATE_COLORS: Record<SheepState, string> = {
  graze: "#4caf50",
  walk: "#2196f3",
  alert: "#ffc107",
  flee: "#f44336",
};

let grassCache: { key: string; canvas: HTMLCanvasElement } | undefined;

const grassTexture = (world: World, scale: number): HTMLCanvasElement => {
  const key = `${world.width}x${world.height}@${scale.toFixed(3)}`;
  if (grassCache?.key === key) return grassCache.canvas;
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(world.width * scale);
  canvas.height = Math.ceil(world.height * scale);
  const g = canvas.getContext("2d")!;
  g.scale(scale, scale);
  g.fillStyle = COLORS.grass;
  g.fillRect(0, 0, world.width, world.height);
  const rng = createRng(7);
  // 濃淡のむら
  for (let i = 0; i < 70; i++) {
    g.fillStyle = rng() < 0.5 ? "rgba(255,255,200,0.04)" : "rgba(0,40,0,0.035)";
    g.beginPath();
    g.ellipse(rng() * world.width, rng() * world.height, 40 + rng() * 90, 30 + rng() * 60, rng() * 3, 0, Math.PI * 2);
    g.fill();
  }
  // 草の房
  g.lineWidth = 1.2;
  for (let i = 0; i < 1600; i++) {
    const x = rng() * world.width;
    const y = rng() * world.height;
    g.strokeStyle = rng() < 0.5 ? "rgba(40,80,20,0.35)" : "rgba(200,230,140,0.3)";
    g.beginPath();
    for (let k = -1; k <= 1; k++) {
      g.moveTo(x + k * 1.5, y);
      g.lineTo(x + k * 2.5, y - 4 - rng() * 3);
    }
    g.stroke();
  }
  // 囲いの中は踏み固められた土
  const { pen } = world;
  g.fillStyle = COLORS.pen;
  g.globalAlpha = 0.55;
  g.fillRect(pen.x, pen.y, pen.w, pen.h);
  g.globalAlpha = 1;
  grassCache = { key, canvas };
  return canvas;
};

const drawFences = (ctx: CanvasRenderingContext2D, world: World): void => {
  ctx.lineCap = "round";
  for (const { a, b } of world.fences) {
    ctx.strokeStyle = COLORS.fence;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    const n = Math.max(1, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / 40));
    ctx.fillStyle = COLORS.post;
    for (let i = 0; i <= n; i++) {
      ctx.beginPath();
      ctx.arc(a.x + ((b.x - a.x) * i) / n, a.y + ((b.y - a.y) * i) / n, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
};

const WOOL_PUFFS = Array.from({ length: 8 }, (_, i) => {
  const t = (i / 8) * Math.PI * 2;
  return { x: Math.cos(t) * 8, y: Math.sin(t) * 5.5 };
});

const drawSheep = (ctx: CanvasRenderingContext2D, s: Sheep, time: number, debug: boolean): void => {
  ctx.save();
  ctx.translate(s.pos.x, s.pos.y);

  ctx.fillStyle = COLORS.shadow;
  ctx.beginPath();
  ctx.ellipse(2, 3, 12, 9, s.heading, 0, Math.PI * 2);
  ctx.fill();

  ctx.rotate(s.heading);
  // 走ると体が上下に揺れる(上から見ると大きさが変わる)
  const speed = Math.hypot(s.vel.x, s.vel.y);
  const bob = 1 + Math.min(1, speed / 90) * 0.05 * Math.sin(time * 18 + s.id);
  ctx.scale(bob, bob);

  // もこもこの胴体
  ctx.fillStyle = COLORS.woolEdge;
  ctx.beginPath();
  for (const p of WOOL_PUFFS) ctx.moveTo(p.x + 4, p.y), ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLORS.wool;
  ctx.beginPath();
  for (const p of WOOL_PUFFS) ctx.moveTo(p.x * 0.92 + 3.4, p.y * 0.92), ctx.arc(p.x * 0.92, p.y * 0.92, 3.4, 0, Math.PI * 2);
  ctx.ellipse(0, 0, 8.5, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.beginPath();
  ctx.ellipse(-1.5, -1.5, 4, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // 頭: 草を食むときは下げて前に出し、警戒時は上げて耳を立てる
  const headDown = s.state === "graze";
  const hx = headDown ? 13.5 : 12;
  const hs = headDown ? 0.85 : 1;
  ctx.fillStyle = COLORS.face;
  ctx.beginPath();
  ctx.ellipse(hx - 2, -4 * hs, 2.6 * hs, 1.3 * hs, -0.6, 0, Math.PI * 2);
  ctx.ellipse(hx - 2, 4 * hs, 2.6 * hs, 1.3 * hs, 0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(hx, 0, 4.6 * hs, 3.3 * hs, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  if (debug) {
    ctx.fillStyle = STATE_COLORS[s.state];
    ctx.beginPath();
    ctx.arc(s.pos.x, s.pos.y, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(244,67,54,${s.fear})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(s.pos.x, s.pos.y, 13, 0, Math.PI * 2);
    ctx.stroke();
  }
};

const drawDog = (ctx: CanvasRenderingContext2D, dog: Dog, time: number): void => {
  ctx.save();
  ctx.translate(dog.pos.x, dog.pos.y);

  ctx.fillStyle = COLORS.shadow;
  ctx.beginPath();
  ctx.ellipse(2, 3, 13, 7, dog.heading, 0, Math.PI * 2);
  ctx.fill();

  ctx.rotate(dog.heading);
  const speed = Math.hypot(dog.vel.x, dog.vel.y);
  // しっぽ: 走ると後ろに流れ、止まると振る
  const wag = speed > 20 ? 0.15 * Math.sin(time * 20) : 0.6 * Math.sin(time * 10);
  ctx.save();
  ctx.translate(-10, 0);
  ctx.rotate(wag);
  ctx.strokeStyle = COLORS.dog;
  ctx.lineWidth = 3.5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(-5, 2, -9, 0);
  ctx.stroke();
  ctx.strokeStyle = COLORS.dogWhite;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-8, 0.3);
  ctx.lineTo(-10, 0);
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = COLORS.dog;
  ctx.beginPath();
  ctx.ellipse(-1, 0, 11, 5.5, 0, 0, Math.PI * 2);
  ctx.fill();
  // 白い首輪状の毛
  ctx.fillStyle = COLORS.dogWhite;
  ctx.beginPath();
  ctx.ellipse(6.5, 0, 3, 5.2, 0, 0, Math.PI * 2);
  ctx.fill();
  // 頭と耳
  ctx.fillStyle = COLORS.dog;
  ctx.beginPath();
  ctx.arc(10, 0, 4.4, 0, Math.PI * 2);
  ctx.ellipse(8.5, -4, 2.2, 1.4, -0.5, 0, Math.PI * 2);
  ctx.ellipse(8.5, 4, 2.2, 1.4, 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLORS.dogWhite;
  ctx.beginPath();
  ctx.ellipse(12.5, 0, 2.6, 1.1, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  if (dog.barkTimer > 0) {
    const t = 1 - dog.barkTimer / 0.4;
    ctx.strokeStyle = `rgba(255,255,255,${0.8 * (1 - t)})`;
    ctx.lineWidth = 3;
    for (const k of [0.4, 0.7, 1]) {
      ctx.beginPath();
      ctx.arc(dog.pos.x, dog.pos.y, 15 + 60 * t * k, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
};

const drawDebug = (ctx: CanvasRenderingContext2D, world: World): void => {
  const { dog, params } = world;
  ctx.setLineDash([6, 6]);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "rgba(244,67,54,0.8)";
  ctx.beginPath();
  ctx.arc(dog.pos.x, dog.pos.y, params.flightRadius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,193,7,0.8)";
  ctx.beginPath();
  ctx.arc(dog.pos.x, dog.pos.y, params.alertRadius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = "rgba(255,255,255,0.6)";
  ctx.beginPath();
  ctx.moveTo(dog.pos.x, dog.pos.y);
  ctx.lineTo(dog.target.x, dog.target.y);
  ctx.stroke();
};

export const render = (
  ctx: CanvasRenderingContext2D,
  world: World,
  view: View,
  opts: { debug: boolean },
): void => {
  const { canvas } = ctx;
  const dpr = canvas.width / canvas.clientWidth || 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = COLORS.outside;
  ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);

  ctx.translate(view.ox, view.oy);
  ctx.drawImage(grassTexture(world, view.scale * dpr), 0, 0, world.width * view.scale, world.height * view.scale);
  ctx.scale(view.scale, view.scale);

  drawFences(ctx, world);
  if (opts.debug) drawDebug(ctx, world);
  // 奥(上)から順に描くと重なりが自然になる
  const sorted = [...world.sheep].sort((a, b) => a.pos.y - b.pos.y);
  for (const s of sorted) drawSheep(ctx, s, world.time, opts.debug);
  drawDog(ctx, world.dog, world.time);
};
