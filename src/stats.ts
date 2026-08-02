import "./style.css";
import { drawChart } from "./chart";
import { setupCanvas } from "./canvas";
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
  /** 各翼成功离场（撤退/溃逃）的存活人数；旧存档可能缺失，读取时按 0 兜底 */
  redEscaped?: number[];
  blueEscaped?: number[];
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
    const battle = JSON.parse(raw) as SavedBattle;
    // 防御性校验：缺核心字段的旧/损坏存档按“无数据”处理，避免统计页报错
    if (
      typeof battle.version !== "number" ||
      !battle.config ||
      !battle.killStats ||
      !Array.isArray(battle.history) ||
      !Array.isArray(battle.redWings) ||
      !Array.isArray(battle.blueWings)
    ) {
      return null;
    }
    return battle;
  } catch {
    return null;
  }
}

const totalOf = (wings: WingState[]): number =>
  wings.reduce((n, w) => n + w.front + w.middle + w.rear, 0);

/** 各翼离场存活人数合计（旧存档缺字段时按 0 处理） */
const escapedOf = (escaped?: number[]): number =>
  (escaped ?? []).reduce((n, v) => n + v, 0);

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
  const redField = totalOf(b.redWings);
  const blueField = totalOf(b.blueWings);
  query("#stat-red-total").textContent = String(Math.round(redField));
  query("#stat-blue-total").textContent = String(Math.round(blueField));
  query("#stat-red-survived").textContent = String(
    Math.round(redField + escapedOf(b.redEscaped)),
  );
  query("#stat-blue-survived").textContent = String(
    Math.round(blueField + escapedOf(b.blueEscaped)),
  );
  // 汇总击杀口径与击杀表一致：步兵 + 火炮 + 骑兵（旧存档缺骑兵字段按 0）
  const killsOf = (side: "red" | "blue"): number =>
    b.killStats[side].reduce(
      (n, w) => n + w.infantry + w.artillery + (w.cavalry ?? 0),
      0,
    );
  query("#stat-red-kills").textContent = String(Math.round(killsOf("red")));
  query("#stat-blue-kills").textContent = String(Math.round(killsOf("blue")));
}

function renderKillTable(b: SavedBattle): void {
  const body = query<HTMLTableSectionElement>("#kill-table-body");
  const rows: string[] = [];
  for (const side of ["red", "blue"] as const) {
    const initials = side === "red" ? b.redWingInitial : b.blueWingInitial;
    const finals = side === "red" ? b.redWings : b.blueWings;
    const escaped = (side === "red" ? b.redEscaped : b.blueEscaped) ?? [];
    const kills = b.killStats[side];
    const orgFinal = side === "red" ? b.redOrgFinal : b.blueOrgFinal;
    const outcomes = (side === "red" ? b.redOutcome : b.blueOutcome) ?? [];
    let sumInit = 0;
    let sumField = 0;
    let sumEsc = 0;
    let sumInf = 0;
    let sumArt = 0;
    let sumCav = 0;
    for (let i = 0; i < 3; i++) {
      const init = initials[i];
      const fin = finals[i];
      const initTotal = init.front + init.middle + init.rear;
      const finTotal = fin.front + fin.middle + fin.rear;
      // 战场留存 = 仍在战场；撤退存活 = 离场成功；战后存活 = 两者之和；阵亡 = 初始 - 战后存活
      const esc = escaped[i] ?? 0;
      const survived = finTotal + esc;
      const dead = initTotal - survived;
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
      sumField += finTotal;
      sumEsc += esc;
      sumInf += kills[i].infantry;
      sumArt += kills[i].artillery;
      sumCav += kills[i].cavalry ?? 0;
      rows.push(
        `<tr class="kill-${side}">` +
          `<td>${side === "red" ? "红方" : "蓝方"}${WING_LABELS[i]}</td>` +
          `<td>${Math.round(initTotal)}</td>` +
          `<td>${Math.round(finTotal)}</td>` +
          `<td>${Math.round(esc)}</td>` +
          `<td>${Math.round(survived)}</td>` +
          `<td>${Math.round(dead)}</td>` +
          `<td>${Math.round(kills[i].infantry)}</td>` +
          `<td>${Math.round(kills[i].artillery)}</td>` +
          `<td>${Math.round(kills[i].cavalry ?? 0)}</td>` +
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
        `<td>${Math.round(sumField)}</td>` +
        `<td>${Math.round(sumEsc)}</td>` +
        `<td>${Math.round(sumField + sumEsc)}</td>` +
        `<td>${Math.round(sumInit - sumField - sumEsc)}</td>` +
        `<td>${Math.round(sumInf)}</td>` +
        `<td>${Math.round(sumArt)}</td>` +
        `<td>${Math.round(sumCav)}</td>` +
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
    key: "front" | "middle" | "rear" | "org";
    dash: number[];
    alpha: number;
    color?: string;
  }> = [
    { key: "front", dash: [], alpha: 1 },
    { key: "middle", dash: [4, 3], alpha: 0.65 },
    { key: "rear", dash: [2, 3], alpha: 0.5 },
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
      const v = s.key === "org" ? raw * yMax : raw;
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

/** 骑兵与火炮曲线：数量级远小于步兵，独立刻度单独画布，避免被压成一条贴底线 */
function drawWingSupportCurve(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  history: HistoryPoint[],
  side: "red" | "blue",
  wing: number,
  yMax: number,
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
    key: "cavalry" | "guns";
    dash: number[];
    alpha: number;
    color: string;
  }> = [
    { key: "cavalry", dash: [6, 2], alpha: 0.75, color: "#a16207" },
    { key: "guns", dash: [], alpha: 1, color: "#0f766e" },
  ];
  for (const s of series) {
    ctx.globalAlpha = s.alpha;
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 1.5;
    ctx.setLineDash(s.dash);
    ctx.beginPath();
    history.forEach((p, idx) => {
      const wings = side === "red" ? p.redWings : p.blueWings;
      const raw = wings[wing]?.[s.key] ?? 0;
      const x = toX(p.time);
      const y = toY(raw);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = MUTED;
  // 刻度值字体更小：骑兵/火炮数量级小，避免数值挤占画面
  ctx.font = `7px ${SERIF}`;
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
      card.append(title);

      const mainCanvas = document.createElement("canvas");
      card.append(mainCanvas);
      const mainLabel = document.createElement("div");
      mainLabel.className = "wing-chart-label";
      mainLabel.textContent = "步兵与组织度";
      card.append(mainLabel);

      const supportCanvas = document.createElement("canvas");
      card.append(supportCanvas);
      const supportLabel = document.createElement("div");
      supportLabel.className = "wing-chart-label";
      supportLabel.textContent = "骑兵与火炮";
      card.append(supportLabel);

      container.append(card);

      const mainCtx = setupCanvas(mainCanvas, W, H);
      const yMax = Math.max(
        100,
        Math.ceil(
          (initials[i].front + initials[i].middle + initials[i].rear) / 100,
        ) * 100,
      );
      drawWingCurve(
        mainCtx,
        W,
        H,
        b.history,
        side,
        i,
        yMax,
        side === "red" ? RED_COLOR : BLUE_COLOR,
      );

      const supportCtx = setupCanvas(supportCanvas, W, H);
      // 独立刻度按初始骑兵/火炮的最大值取整，步兵不参与，刻度不会被拉平
      const supportMax = Math.max(
        1,
        Math.ceil(
          Math.max(
            (initials[i].cavalry ?? 0) * CAVALRY_PER_DOT,
            initials[i].guns ?? 0,
          ) / 10,
        ) * 10,
      );
      drawWingSupportCurve(supportCtx, W, H, b.history, side, i, supportMax);
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
  let battle: SavedBattle | null = null;
  try {
    battle = loadBattle();
  } catch {
    battle = null;
  }
  if (!battle) {
    query("#stats-empty").hidden = false;
    for (const id of STAT_SECTIONS) {
      query<HTMLElement>(id).hidden = true;
    }
    return;
  }
  if (battle.savedAt === lastSavedAt) return;
  lastSavedAt = battle.savedAt;
  try {
    renderBattle(battle);
  } catch {
    // 渲染异常时退化为空态，不让统计页每秒刷错
    query("#stats-empty").hidden = false;
    for (const id of STAT_SECTIONS) {
      query<HTMLElement>(id).hidden = true;
    }
  }
}

// 战斗页与统计页可同时打开：跨标签页由 storage 事件即时同步，同页/兜底每秒轮询
window.addEventListener("storage", (event) => {
  if (event.key === STORAGE_KEY) refresh();
});
setInterval(refresh, 1000);
refresh();
