import { defaultParams, type Params } from "./sim";

interface Slider {
  key: keyof Params;
  label: string;
  min: number;
  max: number;
  step: number;
  hint?: string;
}

const GROUPS: { title: string; sliders: Slider[] }[] = [
  {
    title: "群れ方(密集具合)",
    sliders: [
      { key: "separationRadius", label: "個体距離", min: 10, max: 80, step: 1, hint: "これより近い仲間からは離れようとする(px)" },
      { key: "separation", label: "離れる強さ(平常)", min: 0, max: 200, step: 5 },
      { key: "separationFear", label: "離れる強さ(怖いとき)", min: 0, max: 300, step: 5 },
      { key: "neighborRadius", label: "仲間を意識する距離", min: 20, max: 200, step: 5 },
      { key: "walkCohesion", label: "歩くとき寄る強さ", min: 0, max: 3, step: 0.05 },
      { key: "walkAlignment", label: "歩くとき向きを揃える", min: 0, max: 3, step: 0.05 },
      { key: "farAttraction", label: "遠くの仲間に引かれる", min: 0, max: 2, step: 0.05, hint: "分かれた群れが合流する強さ" },
      { key: "cohesion", label: "逃げるとき寄る強さ", min: 0, max: 3, step: 0.05 },
      { key: "alignment", label: "逃げるとき向きを揃える", min: 0, max: 3, step: 0.05 },
    ],
  },
  {
    title: "動き",
    sliders: [
      { key: "walkSpeed", label: "歩く速さ", min: 2, max: 80, step: 1, hint: "px/s" },
      { key: "runSpeed", label: "走る速さ", min: 20, max: 300, step: 5, hint: "px/s" },
      { key: "alertSpeed", label: "警戒中に離れる速さ", min: 0.4, max: 5, step: 0.1, hint: "歩く速さの何倍まで出すか" },
      { key: "accel", label: "加速(平常)", min: 5, max: 400, step: 5, hint: "px/s²" },
      { key: "accelFear", label: "加速(怖いとき)", min: 20, max: 2000, step: 10, hint: "px/s²" },
      { key: "turnRate", label: "旋回(平常)", min: 0.2, max: 10, step: 0.1, hint: "rad/s" },
      { key: "turnRateFear", label: "旋回(怖いとき)", min: 0.5, max: 20, step: 0.1, hint: "rad/s" },
    ],
  },
  {
    title: "行動のリズム",
    sliders: [
      { key: "grazeTime", label: "草を食む時間", min: 0.2, max: 20, step: 0.1, hint: "平均(s)。±55% でばらつく" },
      { key: "walkTime", label: "一度に歩く時間", min: 0.2, max: 10, step: 0.05, hint: "平均(s)。±55% でばらつく" },
    ],
  },
  {
    title: "犬への反応",
    sliders: [
      { key: "flightRadius", label: "逃走距離", min: 20, max: 300, step: 5, hint: "犬がこの距離に入ると逃げる(px)" },
      { key: "flightSpeedBonus", label: "迫られると広がる割合", min: 0, max: 3, step: 0.05, hint: "犬が全速で迫ると逃走距離が (1 + この値) 倍になる" },
      { key: "alertRadius", label: "警戒距離", min: 50, max: 500, step: 5, hint: "犬がこの距離に入ると警戒する(px)" },
      { key: "fleeStrength", label: "犬から離れる強さ", min: 0, max: 5, step: 0.1 },
      { key: "barkRadius", label: "吠え声の届く距離", min: 50, max: 600, step: 10 },
    ],
  },
  {
    title: "恐怖",
    sliders: [
      { key: "contagion", label: "伝染する割合", min: 0, max: 1, step: 0.01 },
      { key: "fearRise", label: "怖がる速さ", min: 0.5, max: 20, step: 0.5 },
      { key: "fearDecay", label: "落ち着く速さ", min: 0.01, max: 1, step: 0.01 },
    ],
  },
  {
    title: "犬",
    sliders: [
      { key: "dogSpeed", label: "犬の速さ", min: 50, max: 500, step: 10, hint: "px/s" },
      { key: "dogAccel", label: "犬の加速", min: 100, max: 5000, step: 50, hint: "px/s²" },
    ],
  },
  {
    title: "全体",
    sliders: [{ key: "sheepCount", label: "羊の数", min: 1, max: 150, step: 1, hint: "変えると羊を置き直す" }],
  },
];

const STORAGE_KEY = "herd.params.v1";

/** 保存済みの調整値を読む。壊れていたり使えなければ空を返す */
export const loadSavedParams = (): Partial<Params> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const saved = JSON.parse(raw) as Record<string, unknown>;
    const out: Partial<Params> = {};
    for (const key of Object.keys(defaultParams) as (keyof Params)[]) {
      if (typeof saved[key] === "number" && Number.isFinite(saved[key])) out[key] = saved[key];
    }
    return out;
  } catch {
    return {};
  }
};

/** 初期値から変えた値だけを取り出す */
export const changedParams = (params: Params): Partial<Params> => {
  const out: Partial<Params> = {};
  for (const key of Object.keys(defaultParams) as (keyof Params)[]) {
    if (params[key] !== defaultParams[key]) out[key] = params[key];
  }
  return out;
};

const save = (params: Params) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(changedParams(params)));
  } catch {
    // 保存できない環境では、このセッションの間だけ有効
  }
};

export interface TuningPanel {
  toggle(): void;
  /** パネルの外で変わった状態(一時停止・内部状態の表示)を表示に反映する */
  refresh(): void;
  readonly open: boolean;
}

export interface TuningOptions {
  /** シミュレーションと共有している値。パネルはこれを直接書き換える */
  params: Params;
  onRespawn(): void;
  isPaused(): boolean;
  setPaused(paused: boolean): void;
  isDebug(): boolean;
  setDebug(debug: boolean): void;
}

const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] => {
  const e = Object.assign(document.createElement(tag), props);
  e.append(...children);
  return e;
};

const decimals = (step: number) => (String(step).split(".")[1] ?? "").length;

export const createTuningPanel = (root: HTMLElement, toggleButton: HTMLButtonElement, opts: TuningOptions): TuningPanel => {
  const { params } = opts;
  const rows: { slider: Slider; sync(): void }[] = [];

  const set = (key: keyof Params, value: number) => {
    params[key] = value;
    save(params);
    if (key === "sheepCount") opts.onRespawn();
    syncAll();
  };

  const header = el("div", { className: "tune-header" }, el("strong", {}, "パラメータ調整"));
  const closeButton = el("button", { type: "button", className: "tune-close", title: "閉じる (P)" }, "×");
  header.append(closeButton);

  const pause = el("button", { type: "button" });
  const respawn = el("button", { type: "button", title: "羊を置き直す (R)" }, "置き直す");
  const debug = el("input", { type: "checkbox" });
  const toolbar = el(
    "div",
    { className: "tune-toolbar" },
    pause,
    respawn,
    el("label", { className: "tune-check" }, debug, "内部状態"),
  );

  const sections = GROUPS.map((group) => {
    const body = el("div", { className: "tune-grid" });
    for (const slider of group.sliders) {
      const range = el("input", { type: "range", min: String(slider.min), max: String(slider.max), step: String(slider.step) });
      const num = el("input", { type: "number", min: String(slider.min), max: String(slider.max), step: String(slider.step) });
      const reset = el("button", { type: "button", className: "tune-reset", title: `初期値 ${defaultParams[slider.key]} に戻す` }, "↺");
      const name = el("span", { className: "tune-name", title: slider.hint ?? "" }, slider.label);
      if (slider.hint) name.append(el("small", {}, slider.hint));
      const row = el("div", { className: "tune-row" }, name, range, num, reset);

      // 羊の数は動かしている間ずっと置き直すと重いので、手を離したときに反映する
      const live = slider.key !== "sheepCount";
      range.addEventListener("input", () => {
        num.value = range.value;
        if (live) set(slider.key, Number(range.value));
      });
      range.addEventListener("change", () => set(slider.key, Number(range.value)));
      num.addEventListener("change", () => {
        const v = Number(num.value);
        if (Number.isFinite(v)) set(slider.key, v);
        else sync();
      });
      reset.addEventListener("click", () => set(slider.key, defaultParams[slider.key]));

      const sync = () => {
        const v = params[slider.key];
        range.value = String(v);
        num.value = v.toFixed(decimals(slider.step));
        row.classList.toggle("changed", v !== defaultParams[slider.key]);
      };
      rows.push({ slider, sync });
      body.append(row);
    }
    return el("details", { open: true }, el("summary", {}, group.title), body);
  });

  const exported = el("textarea", { readOnly: true, rows: 4, className: "tune-export", hidden: true });
  const status = el("span", { className: "tune-status" });
  const exportButton = el("button", { type: "button", title: "初期値から変えた値を JSON で書き出す" }, "書き出し");
  const resetAll = el("button", { type: "button" }, "すべて初期値に戻す");
  const footer = el(
    "div",
    { className: "tune-footer" },
    el("div", { className: "tune-toolbar" }, exportButton, resetAll, status),
    exported,
    el("p", { className: "tune-note" }, "変更はこのブラウザに保存されます。"),
  );

  root.replaceChildren(header, toolbar, ...sections, footer);

  // 操作後もフォーカスが残ると、Space(吠える)や WASD(犬の移動)がパネルに取られるので外す
  root.addEventListener("click", (e) => {
    if (e.target instanceof HTMLButtonElement) e.target.blur();
  });
  root.addEventListener("pointerup", (e) => {
    if (e.target instanceof HTMLInputElement && e.target.type === "range") e.target.blur();
  });

  const syncAll = () => {
    for (const r of rows) r.sync();
    pause.textContent = opts.isPaused() ? "▶ 再開" : "⏸ 一時停止";
    debug.checked = opts.isDebug();
    const n = Object.keys(changedParams(params)).length;
    resetAll.disabled = n === 0;
    status.textContent = n ? `${n} 項目を変更中` : "";
  };

  pause.addEventListener("click", () => {
    opts.setPaused(!opts.isPaused());
    syncAll();
  });
  respawn.addEventListener("click", opts.onRespawn);
  debug.addEventListener("change", () => opts.setDebug(debug.checked));
  resetAll.addEventListener("click", () => {
    const respawnNeeded = params.sheepCount !== defaultParams.sheepCount;
    Object.assign(params, defaultParams);
    save(params);
    if (respawnNeeded) opts.onRespawn();
    exported.hidden = true;
    syncAll();
  });
  exportButton.addEventListener("click", async () => {
    exported.value = JSON.stringify(changedParams(params), null, 2);
    exported.hidden = false;
    exported.select();
    try {
      await navigator.clipboard.writeText(exported.value);
      status.textContent = "クリップボードにコピーしました";
    } catch {
      status.textContent = "選択した JSON をコピーしてください";
    }
  });

  const panel: TuningPanel = {
    get open() {
      return !root.hidden;
    },
    toggle() {
      root.hidden = !root.hidden;
      toggleButton.hidden = !root.hidden;
      if (!root.hidden) syncAll();
    },
    refresh: () => syncAll(),
  };
  closeButton.addEventListener("click", () => panel.toggle());
  toggleButton.addEventListener("click", () => panel.toggle());

  syncAll();
  return panel;
};
