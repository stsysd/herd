import { herdingBot } from "./bot";
import { fitView, render, screenToWorld, type View } from "./render";
import { bark, countInPen, createWorld, defaultParams, setDogTarget, step, type Params, type World } from "./sim";
import { createTuningPanel, loadSavedParams } from "./tuning";
import { add, norm, scale, vec } from "./vec";

const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
const ctx = canvas.getContext("2d")!;
const hudCount = document.querySelector<HTMLElement>("#count")!;
const barkButton = document.querySelector<HTMLButtonElement>("#bark")!;
const panelRoot = document.querySelector<HTMLElement>("#panel")!;
const tuneButton = document.querySelector<HTMLButtonElement>("#tune")!;

let seed = 1;
// 調整パネルで書き換える値。ワールドを作り直しても同じオブジェクトを共有する
const params: Params = { ...defaultParams, ...loadSavedParams() };
let world: World = createWorld({ seed, params });
let view: View = fitView(world, innerWidth, innerHeight);
let debug = false;
let auto = false;
let paused = false;

const reset = () => {
  seed += 1;
  world = createWorld({ seed, params });
  world.params = params;
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
  if (e.code === "KeyP") panel.toggle();
  panel.refresh();
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

const panel = createTuningPanel(panelRoot, tuneButton, {
  params,
  onRespawn: reset,
  isPaused: () => paused,
  setPaused: (p) => (paused = p),
  isDebug: () => debug,
  setDebug: (d) => (debug = d),
});
if (new URLSearchParams(location.search).has("tune")) panel.toggle();

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
    if (!paused) step(world, DT);
    acc -= DT;
  }
  render(ctx, world, view, { debug });
  hudCount.textContent = `${countInPen(world)} / ${world.sheep.length}`;
  requestAnimationFrame(frame);
};
requestAnimationFrame(frame);
