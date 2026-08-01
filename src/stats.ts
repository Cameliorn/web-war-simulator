import "./style.css";
import { drawChart, setupCanvas } from "./render";
import {
  CAVALRY_PER_DOT,
  ROUT_RATIO,
  type BattleConfig,
  type BattleStatus,
  type HistoryPoint,
  type KillStats,
  type WingOutcome,
  type WingState,
  type Winner,
} from "./simulation";
import { BLUE_COLOR, RED_COLOR, STORAGE_KEY, WING_LABELS } from "./shared";

const BG = "#faf7ef";
const GRID = "rgba(41, 37, 36, 0.1)";
const MUTED = "#8a8378";
const SERIF = "Georgia, 'Songti SC', serif";

interface SavedBattle {
  version: number;
  savedAt: number;
  config: BattleConfig;
  status: BattleStatus;
  winner: Winner;
  time: number;
  killStats: KillStats;
  history: HistoryPoint[];
  redWings: WingState[];
  blueWings: WingState[];
  redWingInitial: WingState[];
  blueWingInitial: WingState[];
  redOrgFinal: number[];
  blueOrgFinal: number[];
  redOutcome: WingOutcome[];
  blueOutcome: WingOutcome[];
  redMoraleFinal: number[];
  blueMoraleFinal: number[];
}

function query<T extends HTMLElement>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`找不到页面元素：${selector}`);
  return el;
}

function loadBattle(): SavedBattle | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SavedBattle;
  } catch {
    return null;
  }
}

const totalOf = (wings: WingState[]): number =>
  wings.reduce((n, w) => n + w.front + w.middle + w.rear, 0);

function renderSummary(b: SavedBattle): void {
  query("#stat-winner").textContent =
    b.winner === "red"
      ? "红方获胜"
      : b.winner === "blue"
        ? "蓝方获胜"
        : b.status === "finished"
          ? "平局"
          : "战斗进行中";
  query("#stat-time").textContent = `${Math.round(b.time)} 回合`;
  query("#stat-red-total").textContent = String(Math.round(totalOf(b.redWings)));
  query("#stat-blue-total").textContent = String(Math.round(totalOf(b.blueWings)));
  const killsOf = (side: "red" | "blue"): number =>
    b.killStats[side].reduce((n, w) => n + w.infantry + w.artillery, 0);
  query("#stat-red-kills").textContent = String(Math.round(killsOf("red")));
  query("#stat-blue-kills").textContent = String(Math.round(killsOf("blue")));
}

function renderKillTable(b: SavedBattle): void {
  const body = query<HTMLTableSectionElement>("#kill-table-body");
  const rows: string[] = [];
  for (const side of ["red", "blue"] as const) {
    const initials = side === "red" ? b.redWingInitial : b.blueWingInitial;
    const finals = side === "red" ? b.redWings : b.blueWings;
    const kills = b.killStats[side];
    const orgFinal = side === "red" ? b.redOrgFinal : b.blueOrgFinal;
    const outcomes = (side === "red" ? b.redOutcome : b.blueOutcome) ?? [];
    let sumInit = 0;
    let sumFin = 0;
    let sumInf = 0;
    let sumArt = 0;
    for (let i = 0; i < 3; i++) {
      const init = initials[i];
      const fin = finals[i];
      const initTotal = init.front + init.middle + init.rear;
      const finTotal = fin.front + fin.middle + fin.rear;
      const loss = initTotal - finTotal;
      const alive = finTotal > Math.max(1, initTotal * ROUT_RATIO);
      const status =
        outcomes[i] === "routing"
          ? "溃退中"
          : outcomes[i] === "retreating"
            ? "撤退中"
            : outcomes[i] === "retreated"
              ? "有序撤退"
              : outcomes[i] === "fled"
            ? "逃逸"
            : outcomes[i] === "destroyed"
              ? "溃败"
              : alive
                ? "存活"
                : "溃败";
      sumInit += initTotal;
      sumFin += finTotal;
      sumInf += kills[i].infantry;
      sumArt += kills[i].artillery;
      rows.push(
        `<tr class="kill-${side}">` +
          `<td>${side === "red" ? "红方" : "蓝方"}${WING_LABELS[i]}</td>` +
          `<td>${Math.round(initTotal)}</td>` +
          `<td>${Math.round(finTotal)}</td>` +
          `<td>${Math.round(loss)}</td>` +
          `<td>${Math.round(kills[i].infantry)}</td>` +
          `<td>${Math.round(kills[i].artillery)}</td>` +
          `<td>${Math.round(fin.guns)}</td>` +
          `<td>${Math.round(init.guns - fin.guns)}</td>` +
          `<td>${Math.round((fin.cavalry ?? 0) * CAVALRY_PER_DOT)}</td>` +
          `<td>${Math.round(((init.cavalry ?? 0) - (fin.cavalry ?? 0)) * CAVALRY_PER_DOT)}</td>` +
          `<td>${Math.round(orgFinal[i] * 100)}%</td>` +
          `<td>${status}</td>` +
          `</tr>`,
      );
    }
    rows.push(
      `<tr class="kill-${side}">` +
        `<td>${side === "red" ? "红方" : "蓝方"}合计</td>` +
        `<td>${Math.round(sumInit)}</td>` +
        `<td>${Math.round(sumFin)}</td>` +
        `<td>${Math.round(sumInit - sumFin)}</td>` +
        `<td>${Math.round(sumInf)}</td>` +
        `<td>${Math.round(sumArt)}</td>` +
        `<td></td><td></td><td></td><td></td><td></td><td></td>` +
        `</tr>`,
    );
  }
  body.innerHTML = rows.join("");
}

const ratioText = (values: readonly [number, number, number]): string => {
  const sum = values[0] + values[1] + values[2] || 1;
  return `${Math.round((values[0] / sum) * 100)}/${Math.round((values[1] / sum) * 100)}/${Math.round((values[2] / sum) * 100)}%`;
};

function renderConfig(b: SavedBattle): void {
  const c = b.config;
  const items: Array<[string, string]> = [
    ["红方总兵力", String(c.redInitial)],
    ["蓝方总兵力", String(c.blueInitial)],
    ["红方效率 α", c.redEfficiency.toFixed(3)],
    ["蓝方效率 β", c.blueEfficiency.toFixed(3)],
    ["伤害水平", `×${c.damageScale.toFixed(2)}`],
    ["红方士气", c.redMorale.toFixed(2)],
    ["蓝方士气", c.blueMorale.toFixed(2)],
    ["战斗随机性", c.randomness.toFixed(2)],
    ["战场宽度", String(c.rowWidth)],
    ["后排支援速度", c.rearFillRate.toFixed(2)],
    ["红方部署（左/中/右）", ratioText(c.redDeploy)],
    ["蓝方部署（左/中/右）", ratioText(c.blueDeploy)],
    ["红方梯队（前/中/后）", ratioText(c.redEchelon)],
    ["蓝方梯队（前/中/后）", ratioText(c.blueEchelon)],
    ["红方火炮（左/中/右）", c.redArtillery.join(" / ")],
    ["蓝方火炮（左/中/右）", c.blueArtillery.join(" / ")],
    [
      "红方骑兵（左/中/右）",
      (c.redCavalry ?? []).map((v) => v * CAVALRY_PER_DOT).join(" / "),
    ],
    [
      "蓝方骑兵（左/中/右）",
      (c.blueCavalry ?? []).map((v) => v * CAVALRY_PER_DOT).join(" / "),
    ],
  ];
  query("#config-list").innerHTML = items
    .map(([label, value]) => `<dt>${label}</dt><dd>${value}</dd>`)
    .join("");
}

function renderChart(b: SavedBattle): void {
  const canvas = query<HTMLCanvasElement>("#chart");
  const ctx = setupCanvas(canvas, 960, 360);
  const sum = (wings: WingState[], pick: (w: WingState) => number): number =>
    wings.reduce((n, w) => n + pick(w), 0);
  drawChart(ctx, 960, 360, {
    redInitial: b.config.redInitial,
    blueInitial: b.config.blueInitial,
    redMiddleInitial: sum(b.redWingInitial, (w) => w.middle),
    redRearInitial: sum(b.redWingInitial, (w) => w.rear),
    blueMiddleInitial: sum(b.blueWingInitial, (w) => w.middle),
    blueRearInitial: sum(b.blueWingInitial, (w) => w.rear),
    history: b.history,
  });
}

function drawWingCurve(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  history: HistoryPoint[],
  side: "red" | "blue",
  wing: number,
  yMax: number,
  color: string,
): void {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, width, height);

  const margin = 6;
  const timeMax = Math.max(history[history.length - 1]?.time ?? 0, 1);
  const toX = (t: number) =>
    margin + (t / timeMax) * (width - margin * 2);
  const toY = (v: number) =>
    height - margin - (Math.min(v, yMax) / yMax) * (height - margin * 2);

  ctx.strokeStyle = GRID;
  ctx.lineWidth = 1;
  for (let i = 0; i <= 2; i++) {
    const y = margin + ((height - margin * 2) * i) / 2;
    ctx.beginPath();
    ctx.moveTo(margin, y);
    ctx.lineTo(width - margin, y);
    ctx.stroke();
  }

  const series: Array<{
    key: "front" | "middle" | "rear" | "cavalry" | "org";
    dash: number[];
    alpha: number;
    color?: string;
  }> = [
    { key: "front", dash: [], alpha: 1 },
    { key: "middle", dash: [4, 3], alpha: 0.65 },
    { key: "rear", dash: [2, 3], alpha: 0.5 },
    { key: "cavalry", dash: [6, 2], alpha: 0.75, color: "#a16207" },
    { key: "org", dash: [1, 2], alpha: 0.9, color: "#57534e" },
  ];
  for (const s of series) {
    ctx.globalAlpha = s.alpha;
    ctx.strokeStyle = s.color ?? color;
    ctx.lineWidth = 1.5;
    ctx.setLineDash(s.dash);
    ctx.beginPath();
    history.forEach((p, idx) => {
      const wings = side === "red" ? p.redWings : p.blueWings;
      const raw = wings[wing]?.[s.key] ?? 0;
      // 组织度为 0~1 比例：画在 0~100% 全高刻度上，100% 在顶部
      const v = s.key === "org" ? (1 - raw) * yMax : raw;
      const x = toX(p.time);
      const y = toY(v);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = MUTED;
  ctx.font = `9px ${SERIF}`;
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";
  ctx.fillText(`${Math.round(yMax)}`, width - margin, height - margin);
}

function renderWingCharts(b: SavedBattle): void {
  const container = query<HTMLElement>("#wing-charts");
  container.innerHTML = "";
  const W = 300;
  const H = 130;
  for (const side of ["red", "blue"] as const) {
    const initials = side === "red" ? b.redWingInitial : b.blueWingInitial;
    for (let i = 0; i < 3; i++) {
      const card = document.createElement("div");
      card.className = "wing-chart-card";
      const title = document.createElement("h3");
      title.textContent = `${side === "red" ? "红方" : "蓝方"}${WING_LABELS[i]}`;
      const canvas = document.createElement("canvas");
      card.append(title, canvas);
      container.append(card);
      const ctx = setupCanvas(canvas, W, H);
      const yMax = Math.max(
        100,
        Math.ceil(
          (initials[i].front + initials[i].middle + initials[i].rear) / 100,
        ) * 100,
      );
      drawWingCurve(
        ctx,
        W,
        H,
        b.history,
        side,
        i,
        yMax,
        side === "red" ? RED_COLOR : BLUE_COLOR,
      );
    }
  }
}

const STAT_SECTIONS = [
  "#stats-summary",
  "#stats-config",
  "#stats-chart",
  "#stats-kills",
  "#stats-wings",
] as const;

/** 渲染一份战斗数据（供首屏与实时刷新共用） */
function renderBattle(battle: SavedBattle): void {
  query("#stats-empty").hidden = true;
  for (const id of STAT_SECTIONS) {
    query<HTMLElement>(id).hidden = false;
  }
  renderSummary(battle);
  renderKillTable(battle);
  renderConfig(battle);
  renderChart(battle);
  renderWingCharts(battle);
}

let lastSavedAt = 0;

function refresh(): void {
  const battle = loadBattle();
  if (!battle) {
    query("#stats-empty").hidden = false;
    for (const id of STAT_SECTIONS) {
      query<HTMLElement>(id).hidden = true;
    }
    return;
  }
  if (battle.savedAt === lastSavedAt) return;
  lastSavedAt = battle.savedAt;
  renderBattle(battle);
}

// 战斗页与统计页可同时打开：跨标签页由 storage 事件即时同步，同页/兜底每秒轮询
window.addEventListener("storage", (event) => {
  if (event.key === STORAGE_KEY) refresh();
});
setInterval(refresh, 1000);
refresh();
