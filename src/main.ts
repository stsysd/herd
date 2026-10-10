import { herdingBot } from "./bot";
import { fitView, render, screenToWorld, type View } from "./render";
import { bark, countInPen, createWorld, defaultParams, setDogTarget, step, type Params, type World } from "./sim";
import { add, norm, scale, vec } from "./vec";

const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
const ctx = canvas.getContext("2d")!;
const hudCount = document.querySelector<HTMLElement>("#count")!;
const barkButton = document.querySelector<HTMLButtonElement>("#bark")!;
const panel = document.querySelector<HTMLElement>("#panel")!;

let seed = 1;
const params: Params = { ...defaultParams };
let world: World = createWorld({ seed, params });
let view: View = fitView(world, innerWidth, innerHeight);
let debug = false;
let auto = false;

const reset = () => {
  seed += 1;
  world = createWorld({ seed, params });
  if (import.meta.env.DEV) Object.assign(window, { __herd: world });
};
reset();

const resize = () => {
  const dpr = devicePixelRatio || 1;
  canvas.width = Math.round(innerWidth * dpr);
  canvas.height = Math.round(innerHeight * dpr);
  view = fitView(world, innerWidth, innerHeight);
};
addEventListener("resize", resize);
resize();

// --- 入力 ---------------------------------------------------------------

const pointerToWorld = (e: PointerEvent) => screenToWorld(view, vec(e.clientX, e.clientY));

canvas.addEventListener("pointermove", (e) => {
  // マウスは追従、タッチは触れている間だけ
  if (auto) return;
  if (e.pointerType === "mouse" || e.buttons) setDogTarget(world, pointerToWorld(e));
});
canvas.addEventListener("pointerdown", (e) => {
  auto = false;
  setDogTarget(world, pointerToWorld(e));
  if (e.pointerType === "mouse" && e.button === 0) bark(world);
});
barkButton.addEventListener("click", () => bark(world));

const keys = new Set<string>();
addEventListener("keydown", (e) => {
  if (e.target instanceof HTMLInputElement) return;
  keys.add(e.code);
  if (e.code === "Space" && !e.repeat) bark(world);
  if (e.code === "KeyR") reset();
  if (e.code === "KeyV") debug = !debug;
  if (e.code === "KeyO") auto = !auto;
  if (e.code === "KeyP") panel.hidden = !panel.hidden;
  if (e.code === "Space" || e.code.startsWith("Arrow")) e.preventDefault();
});
addEventListener("keyup", (e) => keys.delete(e.code));
addEventListener("blur", () => keys.clear());

const keyboardDirection = () => {
  const has = (...codes: string[]) => codes.some((c) => keys.has(c));
  return vec(
    (has("KeyD", "ArrowRight") ? 1 : 0) - (has("KeyA", "ArrowLeft") ? 1 : 0),
    (has("KeyS", "ArrowDown") ? 1 : 0) - (has("KeyW", "ArrowUp") ? 1 : 0),
  );
};

// --- パラメータ調整パネル -----------------------------------------------------

const SLIDERS: { key: keyof Params; label: string; min: number; max: number; step: number }[] = [
  { key: "sheepCount", label: "羊の数 (R で反映)", min: 5, max: 120, step: 1 },
  { key: "flightRadius", label: "逃走距離", min: 40, max: 250, step: 5 },
  { key: "alertRadius", label: "警戒距離", min: 80, max: 400, step: 5 },
  { key: "contagion", label: "恐怖の伝染", min: 0, max: 1, step: 0.01 },
  { key: "fearDecay", label: "落ち着く速さ", min: 0.02, max: 1, step: 0.01 },
  { key: "cohesion", label: "群れる強さ", min: 0, max: 3, step: 0.05 },
  { key: "alignment", label: "向きを揃える強さ", min: 0, max: 3, step: 0.05 },
  { key: "runSpeed", label: "羊の走る速さ", min: 30, max: 200, step: 5 },
  { key: "dogSpeed", label: "犬の速さ", min: 60, max: 400, step: 10 },
];

for (const s of SLIDERS) {
  const row = document.createElement("label");
  const name = document.createElement("span");
  const value = document.createElement("output");
  const input = document.createElement("input");
  Object.assign(input, { type: "range", min: s.min, max: s.max, step: s.step, value: params[s.key] });
  name.textContent = s.label;
  value.textContent = String(params[s.key]);
  input.addEventListener("input", () => {
    params[s.key] = Number(input.value);
    value.textContent = input.value;
    // 羊の数以外はその場で反映する
    if (s.key !== "sheepCount") world.params[s.key] = params[s.key];
  });
  row.append(name, input, value);
  panel.append(row);
}

// --- ループ ---------------------------------------------------------------

const DT = 1 / 60;
let last = performance.now();
let acc = 0;
let steering = false;
let frameCount = 0;

const frame = (now: number) => {
  acc = Math.min(acc + (now - last) / 1000, DT * 5);
  last = now;

  const dir = keyboardDirection();
  if (auto) {
    if (frameCount++ % 6 === 0) herdingBot(world);
  } else if (dir.x || dir.y) {
    setDogTarget(world, add(world.dog.pos, scale(norm(dir), 80)));
    steering = true;
  } else if (steering) {
    // キーを離したらその場で止まる
    setDogTarget(world, world.dog.pos);
    steering = false;
  }

  while (acc >= DT) {
    step(world, DT);
    acc -= DT;
  }
  render(ctx, world, view, { debug });
  hudCount.textContent = `${countInPen(world)} / ${world.sheep.length}`;
  requestAnimationFrame(frame);
};
requestAnimationFrame(frame);
