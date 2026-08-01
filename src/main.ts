import "./style.css";
import {
  Simulation,
  CAVALRY_PER_DOT,
  type BattleStatus,
  type BattleConfig,
  type CounterBatteryChoice,
  type HistoryPoint,
  type RearSpeed,
  type RetreatChoice,
  type ReinforceChoice,
  type TargetChoice,
} from "./simulation";
import { drawBattlefield, setupCanvas } from "./render";
import { STORAGE_KEY } from "./shared";

const BATTLEFIELD_BASE = { w: 760, h: 360 };

function query<T extends HTMLElement>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`找不到页面元素：${selector}`);
  return el;
}

function queryAll<T extends HTMLElement>(selector: string): T[] {
  return [...document.querySelectorAll<T>(selector)];
}

function getCanvasContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("无法获取 Canvas 2D 上下文");
  return ctx;
}

// 页面级错误提示：任何运行时错误都会显示在页面上，而不是白屏
function installErrorOverlay(): void {
  const overlay = document.createElement("div");
  overlay.style.cssText =
    "position:fixed;left:0;right:0;bottom:0;z-index:9999;display:none;" +
    "padding:12px 16px;background:#7f1d1d;color:#fecaca;" +
    "font:13px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;" +
    "white-space:pre-wrap;";
  document.body.appendChild(overlay);

  const show = (message: string) => {
    overlay.textContent = `页面运行出错：\n${message}`;
    overlay.style.display = "block";
  };
  window.addEventListener("error", (event) => show(event.message));
  window.addEventListener("unhandledrejection", (event) => {
    show(String(event.reason));
  });
}

installErrorOverlay();

const stageEl = query<HTMLElement>("#stage");
const battleCanvas = query<HTMLCanvasElement>("#battlefield");
const toggleBtn = query<HTMLButtonElement>("#toggle-btn");
const resetBtn = query<HTMLButtonElement>("#reset-btn");
const collapseBtn = query<HTMLButtonElement>("#collapse-btn");
const expandBtn = query<HTMLButtonElement>("#expand-btn");
const commanderCollapseBtn = query<HTMLButtonElement>("#commander-collapse-btn");
const commanderExpandBtn = query<HTMLButtonElement>("#commander-expand-btn");
const statsBtn = query<HTMLAnchorElement>("#stats-btn");
const commanderSelects = queryAll<HTMLSelectElement>("#commander select");
const wingTargetSelects: Record<"red" | "blue", HTMLSelectElement[]> = {
  red: [0, 1, 2].map((i) =>
    query<HTMLSelectElement>(`#red-wing-${i}-target`),
  ),
  blue: [0, 1, 2].map((i) =>
    query<HTMLSelectElement>(`#blue-wing-${i}-target`),
  ),
};
/** 打击目标下拉的选项元素（启动时缓存，避免每帧查询） */
const wingTargetOptions: Record<"red" | "blue", HTMLOptionElement[][]> = {
  red: [0, 1, 2].map((i) =>
    [0, 1, 2].map((j) =>
      query<HTMLOptionElement>(`#red-wing-${i}-target option[value="${j}"]`),
    ),
  ),
  blue: [0, 1, 2].map((i) =>
    [0, 1, 2].map((j) =>
      query<HTMLOptionElement>(`#blue-wing-${i}-target option[value="${j}"]`),
    ),
  ),
};

const redInitialInput = query<HTMLInputElement>("#red-initial");
const blueInitialInput = query<HTMLInputElement>("#blue-initial");
const redEffInput = query<HTMLInputElement>("#red-eff");
const blueEffInput = query<HTMLInputElement>("#blue-eff");
const redEchelonInputs = [0, 1, 2].map((i) =>
  query<HTMLInputElement>(`#red-echelon-${i}`),
);
const blueEchelonInputs = [0, 1, 2].map((i) =>
  query<HTMLInputElement>(`#blue-echelon-${i}`),
);
const rearFillRateInput = query<HTMLInputElement>("#rear-fill-rate");
const rowWidthInput = query<HTMLInputElement>("#row-width");
const redDeployInputs = [0, 1, 2].map((i) =>
  query<HTMLInputElement>(`#red-deploy-${i}`),
);
const blueDeployInputs = [0, 1, 2].map((i) =>
  query<HTMLInputElement>(`#blue-deploy-${i}`),
);
const redArtilleryInputs = [0, 1, 2].map((i) =>
  query<HTMLInputElement>(`#red-artillery-${i}`),
);
const blueArtilleryInputs = [0, 1, 2].map((i) =>
  query<HTMLInputElement>(`#blue-artillery-${i}`),
);
const redCavalryInputs = [0, 1, 2].map((i) =>
  query<HTMLInputElement>(`#red-cavalry-${i}`),
);
const blueCavalryInputs = [0, 1, 2].map((i) =>
  query<HTMLInputElement>(`#blue-cavalry-${i}`),
);
const randomnessInput = query<HTMLInputElement>("#randomness");
const speedInput = query<HTMLInputElement>("#speed");
const damageScaleInput = query<HTMLInputElement>("#damage-scale");
const redMoraleInput = query<HTMLInputElement>("#red-morale");
const blueMoraleInput = query<HTMLInputElement>("#blue-morale");

const redInitialOut = query<HTMLOutputElement>("#red-initial-out");
const blueInitialOut = query<HTMLOutputElement>("#blue-initial-out");
const redEffOut = query<HTMLOutputElement>("#red-eff-out");
const blueEffOut = query<HTMLOutputElement>("#blue-eff-out");
const redEchelonOuts = [0, 1, 2].map((i) =>
  query<HTMLOutputElement>(`#red-echelon-${i}-out`),
);
const blueEchelonOuts = [0, 1, 2].map((i) =>
  query<HTMLOutputElement>(`#blue-echelon-${i}-out`),
);
const rearFillRateOut = query<HTMLOutputElement>("#rear-fill-rate-out");
const rowWidthOut = query<HTMLOutputElement>("#row-width-out");
const redDeployOuts = [0, 1, 2].map((i) =>
  query<HTMLOutputElement>(`#red-deploy-${i}-out`),
);
const blueDeployOuts = [0, 1, 2].map((i) =>
  query<HTMLOutputElement>(`#blue-deploy-${i}-out`),
);
const redArtilleryOuts = [0, 1, 2].map((i) =>
  query<HTMLOutputElement>(`#red-artillery-${i}-out`),
);
const blueArtilleryOuts = [0, 1, 2].map((i) =>
  query<HTMLOutputElement>(`#blue-artillery-${i}-out`),
);
const redCavalryOuts = [0, 1, 2].map((i) =>
  query<HTMLOutputElement>(`#red-cavalry-${i}-out`),
);
const blueCavalryOuts = [0, 1, 2].map((i) =>
  query<HTMLOutputElement>(`#blue-cavalry-${i}-out`),
);
const randomnessOut = query<HTMLOutputElement>("#randomness-out");
const speedOut = query<HTMLOutputElement>("#speed-out");
const damageScaleOut = query<HTMLOutputElement>("#damage-scale-out");
const redMoraleOut = query<HTMLOutputElement>("#red-morale-out");
const blueMoraleOut = query<HTMLOutputElement>("#blue-morale-out");

const redHud = query<HTMLSpanElement>("#red-hud");
const blueHud = query<HTMLSpanElement>("#blue-hud");
const timeHud = query<HTMLSpanElement>("#time-hud");
const statusHud = query<HTMLSpanElement>("#status-hud");

const battleCtx = getCanvasContext(battleCanvas);

let battleW = 0;
let battleH = 0;
/** 上一帧的战斗状态：用于战斗结束时自动保存统计 */
let lastStatus: BattleStatus = "ready";
/** 上次保存统计的时间（战斗进行中每 1 秒保存一次） */
let lastStatsSaveAt = 0;
/** 击杀线显示窗口：实线 1 秒（红叉按回合保留，不受此窗口限制） */
let lastRenderTime = -1;
let killLinesUntil = 0;

/** 画布随侧边栏展开/收起自适应宽度 */
function resizeCanvases(): void {
  const stageWidth = stageEl.clientWidth;
  if (!stageWidth) return;
  const width = Math.max(360, Math.min(stageWidth, 1280));
  if (width === battleW) return;

  battleW = width;
  battleH = Math.round((BATTLEFIELD_BASE.h / BATTLEFIELD_BASE.w) * width);
  setupCanvas(battleCanvas, battleW, battleH);
}

function readConfig(): BattleConfig {
  return {
    redInitial: redInitialInput.valueAsNumber,
    blueInitial: blueInitialInput.valueAsNumber,
    redEfficiency: redEffInput.valueAsNumber,
    blueEfficiency: blueEffInput.valueAsNumber,
    redEchelon: redEchelonInputs.map((el) => el.valueAsNumber) as [
      number,
      number,
      number,
    ],
    blueEchelon: blueEchelonInputs.map((el) => el.valueAsNumber) as [
      number,
      number,
      number,
    ],
    rearFillRate: rearFillRateInput.valueAsNumber,
    rowWidth: rowWidthInput.valueAsNumber,
    redDeploy: redDeployInputs.map((el) => el.valueAsNumber) as [
      number,
      number,
      number,
    ],
    blueDeploy: blueDeployInputs.map((el) => el.valueAsNumber) as [
      number,
      number,
      number,
    ],
    redArtillery: redArtilleryInputs.map((el) => el.valueAsNumber),
    blueArtillery: blueArtilleryInputs.map((el) => el.valueAsNumber),
    redCavalry: redCavalryInputs.map((el) => el.valueAsNumber),
    blueCavalry: blueCavalryInputs.map((el) => el.valueAsNumber),
    randomness: randomnessInput.valueAsNumber,
    damageScale: damageScaleInput.valueAsNumber,
    redMorale: redMoraleInput.valueAsNumber,
    blueMorale: blueMoraleInput.valueAsNumber,
  };
}

function statusText(sim: Simulation): string {
  switch (sim.status) {
    case "ready":
      return "未开始";
    case "running":
      return "进行中";
    case "paused":
      return "已暂停";
    case "finished":
      return sim.winner === "red"
        ? "红方获胜"
        : sim.winner === "blue"
          ? "蓝方获胜"
          : "平局";
  }
}

function updateHud(sim: Simulation): void {
  const redGuns = sim.redWings.reduce((total, wing) => total + wing.guns, 0);
  const blueGuns = sim.blueWings.reduce((total, wing) => total + wing.guns, 0);
  const redCavalry = sim.redWings.reduce(
    (total, wing) => total + wing.cavalry,
    0,
  );
  const blueCavalry = sim.blueWings.reduce(
    (total, wing) => total + wing.cavalry,
    0,
  );
  const avgOrg = (side: "red" | "blue"): number => {
    const sum = [0, 1, 2].reduce(
      (total, i) => total + sim.getOrganization(side, i),
      0,
    );
    return (sum / 3) * 100;
  };
  redHud.textContent =
    `红方 前 ${Math.round(sim.redFront)} · 中 ${Math.round(sim.redMiddle)}` +
    ` · 后 ${Math.round(sim.redRear)} · 火炮 ${Math.round(redGuns)}` +
    ` · 骑兵 ${Math.round(redCavalry * CAVALRY_PER_DOT)} · 组 ${Math.round(avgOrg("red"))}%`;
  blueHud.textContent =
    `蓝方 前 ${Math.round(sim.blueFront)} · 中 ${Math.round(sim.blueMiddle)}` +
    ` · 后 ${Math.round(sim.blueRear)} · 火炮 ${Math.round(blueGuns)}` +
    ` · 骑兵 ${Math.round(blueCavalry * CAVALRY_PER_DOT)} · 组 ${Math.round(avgOrg("blue"))}%`;
  // 整回合结算：时间始终为整数回合
  timeHud.textContent = `第 ${sim.time.toFixed(0)} 次`;
  statusHud.textContent = statusText(sim);
}

/**
 * 打击目标限制：当面之敌尚未被歼灭时，只能打击当面翼。
 * 同步禁用其他目标选项，并把已选的其他目标强制重置回自动。
 */
function syncCommanderTargets(sim: Simulation): void {
  for (const side of ["red", "blue"] as const) {
    const enemySide = side === "red" ? "blue" : "red";
    for (let i = 0; i < 3; i++) {
      const frontalAlive = sim.isWingAlive(enemySide, i);
      const select = wingTargetSelects[side][i];
      const options = wingTargetOptions[side][i];
      for (let j = 0; j < 3; j++) {
        options[j].disabled = frontalAlive && j !== i;
      }
      if (frontalAlive && select.value !== "auto" && select.value !== String(i)) {
        select.value = "auto";
        sim.orders[side].wings[i].target = "auto";
        sim.invalidateAssignments();
      }
    }
  }
}

function render(sim: Simulation): void {
  if (sim.time !== lastRenderTime) {
    lastRenderTime = sim.time;
    killLinesUntil = performance.now() + 1000;
  }
  drawBattlefield(
    battleCtx,
    battleW,
    battleH,
    sim,
    performance.now() < killLinesUntil,
  );
  updateHud(sim);
  syncCommanderTargets(sim);
  updateToggleButton(sim);
  // 战斗结束后锁定将领决策（与注释“战前/结束后锁定”一致）
  if (sim.status === "finished") setCommanderEnabled(false);
}

/** 把当前战斗结果保存到 localStorage，统计页读取展示 */
function saveBattleStats(sim: Simulation): void {
  const payload = {
    version: 1,
    savedAt: Date.now(),
    config: sim.config,
    status: sim.status,
    winner: sim.winner,
    time: sim.time,
    killStats: sim.killStats,
    history: downsampleHistory(sim.history),
    redWings: sim.redWings,
    blueWings: sim.blueWings,
    redWingInitial: [0, 1, 2].map((i) => ({
      front: sim.redWingFrontInitial[i],
      middle: sim.redWingMiddleInitial[i],
      rear: sim.redWingRearInitial[i],
      guns: sim.config.redArtillery[i] ?? 0,
      cavalry: sim.config.redCavalry[i] ?? 0,
    })),
    blueWingInitial: [0, 1, 2].map((i) => ({
      front: sim.blueWingFrontInitial[i],
      middle: sim.blueWingMiddleInitial[i],
      rear: sim.blueWingRearInitial[i],
      guns: sim.config.blueArtillery[i] ?? 0,
      cavalry: sim.config.blueCavalry[i] ?? 0,
    })),
    redOrgFinal: [0, 1, 2].map((i) => sim.getOrganization("red", i)),
    blueOrgFinal: [0, 1, 2].map((i) => sim.getOrganization("blue", i)),
    redOutcome: [0, 1, 2].map((i) => sim.getWingOutcome("red", i)),
    blueOutcome: [0, 1, 2].map((i) => sim.getWingOutcome("blue", i)),
    redMoraleFinal: [0, 1, 2].map((i) => sim.getMorale("red", i)),
    blueMoraleFinal: [0, 1, 2].map((i) => sim.getMorale("blue", i)),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

/** 历史曲线降采样：限制统计载荷体积，长战斗也能流畅同步 */
function downsampleHistory(history: HistoryPoint[]): HistoryPoint[] {
  const MAX_POINTS = 800;
  if (history.length <= MAX_POINTS) return history;
  const step = Math.ceil(history.length / MAX_POINTS);
  const sampled: HistoryPoint[] = [];
  for (let i = 0; i < history.length; i += step) {
    sampled.push(history[i]);
  }
  const last = history[history.length - 1];
  if (sampled[sampled.length - 1] !== last) sampled.push(last);
  return sampled;
}

function setParamsDisabled(disabled: boolean): void {
  [
    redInitialInput,
    blueInitialInput,
    redEffInput,
    blueEffInput,
    ...redEchelonInputs,
    ...blueEchelonInputs,
    rearFillRateInput,
    rowWidthInput,
    ...redDeployInputs,
    ...blueDeployInputs,
    ...redArtilleryInputs,
    ...blueArtilleryInputs,
    ...redCavalryInputs,
    ...blueCavalryInputs,
    randomnessInput,
    damageScaleInput,
    redMoraleInput,
    blueMoraleInput,
  ].forEach((el) => {
    el.disabled = disabled;
  });
}

function updateToggleButton(sim: Simulation): void {
  toggleBtn.textContent =
    sim.status === "ready"
      ? "开始模拟"
      : sim.status === "running"
        ? "暂停"
        : sim.status === "paused"
          ? "继续"
          : "再来一局";
}

function setSidebarHidden(hidden: boolean): void {
  document.body.classList.toggle("sidebar-hidden", hidden);
}

/** 将领决策栏收起/展开（与左侧参数栏独立） */
function setCommanderHidden(hidden: boolean): void {
  document.body.classList.toggle("commander-hidden", hidden);
}

/** 将领决策面板：战斗进行中可实时调整，战前/结束后锁定 */
function setCommanderEnabled(enabled: boolean): void {
  commanderSelects.forEach((el) => {
    el.disabled = !enabled;
  });
}

/** 把右侧将领面板的选项写入当前战斗的作战命令 */
function applyCommanderOrders(): void {
  for (const side of ["red", "blue"] as const) {
    sim.orders[side].rearSpeed = query<HTMLSelectElement>(
      `#${side}-rear-speed`,
    ).value as RearSpeed;
    for (let i = 0; i < 3; i++) {
      const wing = sim.orders[side].wings[i];
      wing.target = query<HTMLSelectElement>(
        `#${side}-wing-${i}-target`,
      ).value as TargetChoice;
      wing.reinforce = query<HTMLSelectElement>(
        `#${side}-wing-${i}-reinforce`,
      ).value as ReinforceChoice;
      wing.retreat = query<HTMLSelectElement>(
        `#${side}-wing-${i}-retreat`,
      ).value as RetreatChoice;

      const battery = sim.orders[side].batteries[i];
      battery.target = query<HTMLSelectElement>(
        `#${side}-batt-${i}-target`,
      ).value as TargetChoice;
      battery.counterBattery = query<HTMLSelectElement>(
        `#${side}-batt-${i}-counter`,
      ).value as CounterBatteryChoice;
    }
  }
  sim.invalidateAssignments();
}

resizeCanvases();
let sim = new Simulation(readConfig());
setCommanderEnabled(false);
render(sim);

function reset(): void {
  sim = new Simulation(readConfig());
  tickAccumulator = 0;
  applyCommanderOrders();
  setParamsDisabled(false);
  setCommanderEnabled(false);
  updateToggleButton(sim);
  render(sim);
}

function toggle(): void {
  if (sim.status === "finished") {
    sim = new Simulation(readConfig());
    tickAccumulator = 0;
    applyCommanderOrders();
    setParamsDisabled(false);
  }
  if (sim.status === "ready" || sim.status === "paused") {
    sim.start();
    setParamsDisabled(true);
    setCommanderEnabled(true);
  } else if (sim.status === "running") {
    sim.pause();
    setParamsDisabled(false);
    setCommanderEnabled(true);
  }
  updateToggleButton(sim);
  render(sim);
}

toggleBtn.addEventListener("click", toggle);
resetBtn.addEventListener("click", reset);
// 快捷键：空格 = 开始/暂停/继续，R = 重置（输入框聚焦时不触发）
window.addEventListener("keydown", (event) => {
  const target = event.target as HTMLElement | null;
  if (target && /^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(target.tagName)) return;
  if (event.code === "Space") {
    event.preventDefault();
    toggle();
  } else if (event.key === "r" || event.key === "R") {
    reset();
  }
});
collapseBtn.addEventListener("click", () => setSidebarHidden(true));
expandBtn.addEventListener("click", () => setSidebarHidden(false));
commanderCollapseBtn.addEventListener("click", () => setCommanderHidden(true));
commanderExpandBtn.addEventListener("click", () => setCommanderHidden(false));
statsBtn.addEventListener("click", () => saveBattleStats(sim));
commanderSelects.forEach((el) => {
  el.addEventListener("change", applyCommanderOrders);
});

const paramInputs = [
  redInitialInput,
  blueInitialInput,
  redEffInput,
  blueEffInput,
  ...redEchelonInputs,
  ...blueEchelonInputs,
  rearFillRateInput,
  rowWidthInput,
  ...redDeployInputs,
  ...blueDeployInputs,
  ...redArtilleryInputs,
  ...blueArtilleryInputs,
  ...redCavalryInputs,
  ...blueCavalryInputs,
  randomnessInput,
  damageScaleInput,
  redMoraleInput,
  blueMoraleInput,
] as const;

paramInputs.forEach((el) => {
  el.addEventListener("input", reset);
  el.addEventListener("change", reset);
});

const outputBindings: Array<readonly [HTMLInputElement, HTMLOutputElement]> = [
  [redInitialInput, redInitialOut],
  [blueInitialInput, blueInitialOut],
  [redEffInput, redEffOut],
  [blueEffInput, blueEffOut],
  [rearFillRateInput, rearFillRateOut],
  [rowWidthInput, rowWidthOut],
  ...redArtilleryInputs.map((input, i) => [input, redArtilleryOuts[i]] as const),
  ...blueArtilleryInputs.map((input, i) => [input, blueArtilleryOuts[i]] as const),
  ...redCavalryInputs.map((input, i) => [input, redCavalryOuts[i]] as const),
  ...blueCavalryInputs.map((input, i) => [input, blueCavalryOuts[i]] as const),
  [randomnessInput, randomnessOut],
  [speedInput, speedOut],
  [redMoraleInput, redMoraleOut],
  [blueMoraleInput, blueMoraleOut],
];

outputBindings.forEach(([input, output]) => {
  const sync = () => {
    output.textContent = input.valueAsNumber.toFixed(
      input.step.includes(".") ? 2 : 0,
    );
  };
  input.addEventListener("input", sync);
  sync();
});

// 伤害水平显示为倍率（如 ×0.10）
const syncDamageScale = () => {
  const decimals = damageScaleInput.step.split(".")[1]?.length ?? 2;
  damageScaleOut.textContent = `×${damageScaleInput.valueAsNumber.toFixed(decimals)}`;
};
damageScaleInput.addEventListener("input", syncDamageScale);
syncDamageScale();

/** 联动占比滑杆：拖动一个时，其余滑块按原比例缩放，总和保持 100，滑块与数值同步移动 */
function bindLinkedPercentage(
  inputs: readonly HTMLInputElement[],
  outputs: readonly HTMLOutputElement[],
): void {
  const TARGET = 100;
  const sync = (changedIndex: number): void => {
    const value = Math.max(
      0,
      Math.min(TARGET, inputs[changedIndex].valueAsNumber),
    );
    inputs[changedIndex].value = String(value);
    const others = inputs.filter((_, j) => j !== changedIndex);
    const prevSum = others.reduce((sum, el) => sum + el.valueAsNumber, 0);
    const remaining = TARGET - value;
    const shares: number[] = [];
    if (prevSum <= 0) {
      // 其余滑块全为 0：把剩余占比平均分给其余滑块
      const base = Math.floor(remaining / others.length);
      shares.push(...others.map(() => base));
      let rest = remaining - base * others.length;
      for (let k = 0; rest > 0; k = (k + 1) % others.length, rest--) {
        shares[k]++;
      }
    } else {
      const raw = others.map(
        (el) => (el.valueAsNumber / prevSum) * remaining,
      );
      shares.push(...raw.map(Math.floor));
      let rest = remaining - shares.reduce((a, b) => a + b, 0);
      // 最大余数法补足取整误差，保证总和恰好 100
      const order = raw
        .map((v, k) => [v - Math.floor(v), k] as const)
        .sort((a, b) => b[0] - a[0]);
      for (let k = 0; rest > 0; k++, rest--) {
        shares[order[k % order.length][1]]++;
      }
    }
    others.forEach((el, k) => {
      el.value = String(shares[k]);
    });
    inputs.forEach((el, k) => {
      outputs[k].textContent = `${Math.round(el.valueAsNumber)}%`;
    });
  };
  inputs.forEach((input, i) => {
    input.addEventListener("input", () => sync(i));
  });
  sync(0);
}

// 梯队配置：联动占比（前/中/后）
[redEchelonInputs, blueEchelonInputs].forEach((inputs, side) => {
  bindLinkedPercentage(inputs, side === 0 ? redEchelonOuts : blueEchelonOuts);
});

// 翼部署：联动占比（左/中/右）
[redDeployInputs, blueDeployInputs].forEach((inputs, side) => {
  bindLinkedPercentage(inputs, side === 0 ? redDeployOuts : blueDeployOuts);
});

// 主循环：渲染跟随 rAF；整回合结算由定时器驱动（后台标签页也能继续推进）
/** 不足 1 回合的累计时间（单位：回合），攒满 1 回合才结算一次 */
let tickAccumulator = 0;
let lastStepAt = performance.now();

function stepTicks(): void {
  const now = performance.now();
  const dtSeconds = Math.min((now - lastStepAt) / 1000, 0.5);
  lastStepAt = now;

  if (sim.status === "running") {
    tickAccumulator += dtSeconds * speedInput.valueAsNumber;
    // 整回合结算：0.1 次/秒 = 每 10 秒结算 1 回合，与滑块时间严格同步
    let guard = 0;
    while (tickAccumulator >= 1 && guard < 20) {
      sim.step(1);
      tickAccumulator -= 1;
      guard++;
    }
    if (guard >= 20) tickAccumulator = 0;
  }

  // 定期保存统计：运行中每 1 秒一次；暂停/结束时状态变化保存一次，
  // 让统计页（可同时打开）实时同步
  const shouldSave =
    (sim.status === "running" && now - lastStatsSaveAt >= 1000) ||
    ((sim.status === "paused" || sim.status === "finished") &&
      sim.status !== lastStatus);
  if (shouldSave) {
    saveBattleStats(sim);
    lastStatsSaveAt = now;
  }
  lastStatus = sim.status;
}

setInterval(stepTicks, 50);

function loop(): void {
  resizeCanvases();
  render(sim);
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
