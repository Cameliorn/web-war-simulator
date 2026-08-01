import {
  type AttackTarget,
  type DotRef,
  type FireAssignment,
  type FormationRow,
  type GunAssignment,
  type HistoryPoint,
  type WingOutcome,
  type Simulation,
  ROUT_DURATION,
  RETREAT_DURATION,
  CAVALRY_PER_DOT,
  cavalryIconCount,
  formationRows,
  gunIconCount,
} from "./simulation";
import { BLUE_COLOR, RED_COLOR, WING_LABELS } from "./shared";

export { BLUE_COLOR, RED_COLOR };

const RED_SOFT = "#d97878";
const RED_FAINT = "#e2b3b3";
const BLUE_SOFT = "#84a5dd";
const BLUE_FAINT = "#b7c9e8";
const AMBER = "#b45309";
const ARTILLERY_COLOR = "#78716c";
/** 火力单元点间距基准（像素）：默认战场宽度下的点距 */
const DOT_SPACING = 8;
/** 溃退后撤最大位移（像素）：随溃退进度线性增大，越接近离场退得越远 */
const ROUT_DRIFT_MAX = 22;
/** 有序撤退后撤最大位移（更克制，体现有序） */
const RETREAT_DRIFT_MAX = 14;
const BG_COLOR = "#faf7ef";
const GRID_COLOR = "rgba(41, 37, 36, 0.09)";
const TEXT_COLOR = "#292524";
const MUTED_COLOR = "#8a8378";
const SERIF = "Georgia, 'Songti SC', serif";

/** 战线到双方前排的距离（两军中间拉开，随画布高度自适应） */
function centerGap(height: number): number {
  return Math.max(30, Math.round(height * 0.11));
}

/** 按设备像素比初始化画布，返回已缩放的 2D 上下文 */
export function setupCanvas(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
): CanvasRenderingContext2D {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("无法获取 Canvas 2D 上下文");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

/**
 * 战场态势（学术图表风）：
 * 红上蓝下，中间为战线与无人地带；红方前排朝下、蓝方前排朝上。
 * 每翼分前（实心高亮）/ 中（实心变暗）/ 后（空心）三梯队，平直队列。
 */
export function drawBattlefield(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  sim: Simulation,
  showKillLines = false,
): void {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, width, height);

  const centerY = Math.floor(height / 2);
  const gap = centerGap(height);

  // 无人地带（浅色带）
  const bandHalf = Math.max(8, Math.round(gap * 0.45));
  ctx.fillStyle = "rgba(41, 37, 36, 0.035)";
  ctx.fillRect(0, centerY - bandHalf, width, bandHalf * 2);

  // 战线
  ctx.strokeStyle = "rgba(41, 37, 36, 0.4)";
  ctx.setLineDash([6, 6]);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, centerY);
  ctx.lineTo(width, centerY);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = MUTED_COLOR;
  ctx.font = `italic 11px ${SERIF}`;
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";
  ctx.fillText("战线", width - 8, centerY - 4);

  const wingMargin = 12;
  const wingWidth = (width - wingMargin * 2) / 3;
  for (let i = 0; i < 3; i++) {
    const cx = wingMargin + wingWidth * (i + 0.5);
    const redWing = sim.redWings[i];
    const blueWing = sim.blueWings[i];
    const redDead = redWing.front + redWing.middle + redWing.rear <= 0;
    const blueDead = blueWing.front + blueWing.middle + blueWing.rear <= 0;
    const redFlanking = !redDead && blueDead;
    const blueFlanking = !blueDead && redDead;

    // 翼之间的分隔线（仅沿阵型区域）
    if (i > 0) {
      const sx = wingMargin + wingWidth * i;
      ctx.strokeStyle = GRID_COLOR;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(sx, 52);
      ctx.lineTo(sx, centerY - gap);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(sx, centerY + gap);
      ctx.lineTo(sx, height - 70);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 翼名 + 每翼前/中/后/火炮：红方文字簇在最上、蓝方在最下（炮兵外侧）
    drawWingLabel(
      ctx,
      cx,
      2,
      14,
      WING_LABELS[i],
      "红方",
      redWing.front,
      redWing.middle,
      redWing.rear,
      redWing.guns,
      redWing.cavalry,
      sim.getOrganization("red", i),
      sim.getMorale("red", i),
      sim.getWingOutcome("red", i),
      sim.getRoutTicksRemaining("red", i),
      redDead,
      redFlanking,
      "top",
    );
    drawWingLabel(
      ctx,
      cx,
      height - 6,
      height - 19,
      WING_LABELS[i],
      "蓝方",
      blueWing.front,
      blueWing.middle,
      blueWing.rear,
      blueWing.guns,
      blueWing.cavalry,
      sim.getOrganization("blue", i),
      sim.getMorale("blue", i),
      sim.getWingOutcome("blue", i),
      sim.getRoutTicksRemaining("blue", i),
      blueDead,
      blueFlanking,
      "bottom",
    );

    // 火炮阵地：部署在本翼后方
    drawWingBattery(ctx, cx, redWing.guns, RED_COLOR, batteryY("red", height));
    drawWingBattery(
      ctx,
      cx,
      blueWing.guns,
      BLUE_COLOR,
      batteryY("blue", height),
    );

    // 骑兵阵地：位于步兵阵型与火炮之间（三角图标，冲锋时实心高亮）
    const redRows = formationRows(
      redWing.front,
      redWing.middle,
      redWing.rear,
      i,
      sim.config.rowWidth,
    );
    const blueRows = formationRows(
      blueWing.front,
      blueWing.middle,
      blueWing.rear,
      i,
      sim.config.rowWidth,
    );
    drawWingCavalry(
      ctx,
      cx,
      redWing.cavalry,
      "red",
      RED_COLOR,
      cavalryY("red", height, redRows, centerY - gap, 52),
      cavalryAttackingIcons(sim, "red", i),
      sim.getCavalryProgress("red", i),
    );
    drawWingCavalry(
      ctx,
      cx,
      blueWing.cavalry,
      "blue",
      BLUE_COLOR,
      cavalryY("blue", height, blueRows, centerY + gap, height - 70),
      cavalryAttackingIcons(sim, "blue", i),
      sim.getCavalryProgress("blue", i),
    );

    // 平直队列：红方前排朝下（靠近中央战线），蓝方前排朝上
    drawWingFormation(
      ctx,
      cx,
      wingWidth,
      redWing.front,
      redWing.middle,
      redWing.rear,
      i,
      sim.config.rowWidth,
      centerY - gap,
      52,
      RED_COLOR,
      RED_SOFT,
      sim.isRouting("red", i),
      routDrift(sim, "red", i),
      routFade(sim, "red", i),
    );
    drawWingFormation(
      ctx,
      cx,
      wingWidth,
      blueWing.front,
      blueWing.middle,
      blueWing.rear,
      i,
      sim.config.rowWidth,
      centerY + gap,
      height - 70,
      BLUE_COLOR,
      BLUE_SOFT,
      sim.isRouting("blue", i),
      routDrift(sim, "blue", i),
      routFade(sim, "blue", i),
    );
  }

  if (sim.status !== "ready") {
    const fire = sim.getFireAssignments();
    const guns = sim.getGunAssignments();
    drawFireArrows(
      ctx,
      width,
      height,
      sim,
      groupAssignments(fire, (a) => `${a.source.side}-${a.source.wing}`),
    );
    drawArtilleryArrows(
      ctx,
      width,
      height,
      sim,
      groupAssignments(guns, (a) => `${a.side}-${a.wing}`),
    );
    drawCavalryArrows(ctx, width, height, sim);
    if (showKillLines) {
      drawKillLines(ctx, width, height, sim);
    }
    // 红叉按回合保留（最近 8 回合），暂停时也持续显示便于观察
    drawKillMarks(ctx, width, height, sim);
  }

  if (sim.status === "finished" && sim.winner) {
    ctx.fillStyle = "rgba(250, 247, 239, 0.76)";
    ctx.fillRect(0, 0, width, height);

    const winnerText =
      sim.winner === "red"
        ? "红方获胜"
        : sim.winner === "blue"
          ? "蓝方获胜"
          : "平局";
    ctx.fillStyle =
      sim.winner === "red"
        ? RED_COLOR
        : sim.winner === "blue"
          ? BLUE_COLOR
          : TEXT_COLOR;
    ctx.font = `bold 34px ${SERIF}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(winnerText, width / 2, height / 2 - 16);

    ctx.fillStyle = MUTED_COLOR;
    ctx.font = `15px ${SERIF}`;
    ctx.fillText(
      `红方 ${Math.round(sim.redTotal)} : 蓝方 ${Math.round(sim.blueTotal)}`,
      width / 2,
      height / 2 + 18,
    );
  }
}

/** 统计页所需的图表数据（初始兵力 + 历史快照） */
export interface ChartData {
  redInitial: number;
  blueInitial: number;
  redMiddleInitial: number;
  redRearInitial: number;
  blueMiddleInitial: number;
  blueRearInitial: number;
  history: HistoryPoint[];
}

/** 兵力变化曲线图：前排实线、中排虚线、后排点线 */
export function drawChart(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  data: ChartData,
): void {
  const margin = { left: 46, right: 14, top: 18, bottom: 30 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, width, height);

  const maxStrength = Math.max(
    data.redInitial,
    data.blueInitial,
    100,
  );
  const yMax = Math.ceil(maxStrength / 100) * 100;
  const last = data.history[data.history.length - 1];
  const timeMax = Math.max(last?.time ?? 0, 5);
  const xStep = niceStep(timeMax / 6);
  const xTicks = Math.max(1, Math.ceil(timeMax / xStep));

  ctx.font = `11px ${SERIF}`;
  ctx.textBaseline = "middle";
  for (let i = 0; i <= 4; i++) {
    const y = margin.top + (plotHeight * i) / 4;
    const value = yMax - (yMax * i) / 4;
    ctx.strokeStyle = GRID_COLOR;
    ctx.beginPath();
    ctx.moveTo(margin.left, y);
    ctx.lineTo(margin.left + plotWidth, y);
    ctx.stroke();
    ctx.fillStyle = MUTED_COLOR;
    ctx.textAlign = "right";
    ctx.fillText(String(Math.round(value)), margin.left - 6, y);
  }
  for (let i = 0; i <= xTicks; i++) {
    const x = margin.left + (plotWidth * i) / xTicks;
    const value = (timeMax * i) / xTicks;
    ctx.strokeStyle = GRID_COLOR;
    ctx.beginPath();
    ctx.moveTo(x, margin.top);
    ctx.lineTo(x, margin.top + plotHeight);
    ctx.stroke();
    ctx.fillStyle = MUTED_COLOR;
    ctx.textAlign = "center";
    ctx.fillText(String(Math.round(value)), x, height - 12);
  }
  ctx.fillStyle = MUTED_COLOR;
  ctx.textAlign = "left";
  ctx.fillText("兵力", 8, margin.top + 8);
  ctx.fillText("时间（次）", width - 56, height - 10);

  drawLegend(ctx, width);

  const toX = (time: number) => margin.left + (time / timeMax) * plotWidth;
  const toY = (value: number) => margin.top + (1 - value / yMax) * plotHeight;

  const series: Array<{
    color: string;
    dash?: number[];
    points: Array<readonly [number, number]>;
  }> = [];

  if (data.history.length > 1) {
    const map = <K extends keyof typeof data.history[number]>(
      key: K,
    ): Array<readonly [number, number]> =>
      data.history.map((p) => [toX(p.time), toY(p[key] as number)] as const);
    series.push(
      { color: RED_COLOR, points: map("redFront") },
      { color: RED_SOFT, dash: [5, 4], points: map("redMiddle") },
      { color: RED_FAINT, dash: [2, 3], points: map("redRear") },
      { color: BLUE_COLOR, points: map("blueFront") },
      { color: BLUE_SOFT, dash: [5, 4], points: map("blueMiddle") },
      { color: BLUE_FAINT, dash: [2, 3], points: map("blueRear") },
    );
  } else {
    const flat = (value: number): Array<readonly [number, number]> => [
      [toX(0), toY(value)],
      [toX(timeMax), toY(value)],
    ];
    series.push(
      { color: RED_COLOR, points: flat(data.redInitial) },
      { color: RED_SOFT, dash: [5, 4], points: flat(data.redMiddleInitial) },
      { color: RED_FAINT, dash: [2, 3], points: flat(data.redRearInitial) },
      { color: BLUE_COLOR, points: flat(data.blueInitial) },
      { color: BLUE_SOFT, dash: [5, 4], points: flat(data.blueMiddleInitial) },
      { color: BLUE_FAINT, dash: [2, 3], points: flat(data.blueRearInitial) },
    );
  }

  series.forEach((line) => drawLine(ctx, line.points, line.color, line.dash));
}

/** 把攻击分配按翼分组，避免每个翼都扫描全量列表 */
function groupAssignments<T>(
  items: readonly T[],
  key: (item: T) => string,
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    let list = map.get(k);
    if (!list) {
      list = [];
      map.set(k, list);
    }
    list.push(item);
  }
  return map;
}

/** 翼标签：名称/状态 + 前/中/后/火炮/骑兵 */
function drawWingLabel(
  ctx: CanvasRenderingContext2D,
  x: number,
  yName: number,
  yDetail: number,
  wingName: string,
  side: string,
  front: number,
  middle: number,
  rear: number,
  guns: number,
  cavalry: number,
  org: number,
  morale: number,
  outcome: WingOutcome,
  routRemaining: number,
  dead: boolean,
  flanking: boolean,
  baseline: "top" | "bottom",
  align: CanvasTextAlign = "center",
): void {
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.font = `11px ${SERIF}`;
  let nameText = `${side}${wingName} ${Math.round(front + middle + rear)}`;
  let nameColor = MUTED_COLOR;
  if (outcome === "routing") {
    nameText = `${side}${wingName} 溃退中 ${routRemaining}/${ROUT_DURATION}`;
    nameColor = "#b91c1c";
  } else if (outcome === "retreating") {
    nameText = `${side}${wingName} 撤退中 ${routRemaining}/${RETREAT_DURATION}`;
    nameColor = "#57534e";
  } else if (dead) {
    nameText =
      outcome === "fled"
        ? `${side}${wingName} 逃逸`
        : outcome === "retreated"
          ? `${side}${wingName} 有序撤退`
        : `${side}${wingName} 溃败`;
    nameColor = MUTED_COLOR;
  } else if (flanking) {
    nameText = `${side}${wingName} 侧击`;
    nameColor = AMBER;
  }
  ctx.fillStyle = nameColor;
  ctx.fillText(nameText, x, yName);

  if (!dead) {
    ctx.font = `10px ${SERIF}`;
    ctx.fillStyle = MUTED_COLOR;
    ctx.fillText(
      `前 ${Math.round(front)} · 中 ${Math.round(middle)} · 后 ${Math.round(rear)} · 炮 ${Math.round(guns)} · 骑 ${Math.round(cavalry * CAVALRY_PER_DOT)} · 组 ${Math.round(org * 100)}% · 气 ${morale.toFixed(2)}`,
      x,
      yDetail,
    );
  }
}

/** 火炮阵地：部署在本翼后方的一排小方块 */
function drawWingBattery(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  guns: number,
  color: string,
  y: number,
): void {
  if (guns <= 0) return;
  ctx.fillStyle = color;
  for (const x of batteryIconXs(centerX, guns)) {
    ctx.fillRect(x, y, 4, 4);
  }
}

/** 火炮图标横坐标（与画出的方块一致） */
function batteryIconXs(centerX: number, guns: number): number[] {
  const icons = gunIconCount(guns);
  const spacing = 12;
  const startX = centerX - ((icons - 1) * spacing) / 2;
  return Array.from({ length: icons }, (_, i) => startX + i * spacing);
}

/** 某方阵型靠近战线 / 远离战线的边界（与绘制阵型一致） */
function formationBounds(
  side: "red" | "blue",
  height: number,
): { nearY: number; farY: number } {
  const centerY = Math.floor(height / 2);
  const gap = centerGap(height);
  return side === "red"
    ? { nearY: centerY - gap, farY: 52 }
    : { nearY: centerY + gap, farY: height - 70 };
}

/** 炮兵阵地纵坐标：红方文字簇之下、蓝方文字簇之上 */
function batteryY(side: "red" | "blue", height: number): number {
  return side === "red" ? 26 : height - 36;
}

/** 骑兵图标横坐标（与画出的三角一致） */
function cavalryIconXs(centerX: number, cavalry: number): number[] {
  const icons = cavalryIconCount(cavalry);
  const spacing = 12;
  const startX = centerX - ((icons - 1) * spacing) / 2;
  return Array.from({ length: icons }, (_, i) => startX + i * spacing);
}

/** 骑兵阵地纵坐标：位于步兵阵型后缘与炮兵阵地正中间（随阵型行数自适应） */
function cavalryY(
  side: "red" | "blue",
  height: number,
  rows: readonly FormationRow[],
  nearY: number,
  farY: number,
): number {
  const totalRows = Math.max(1, rows.length);
  const space = Math.abs(farY - nearY);
  const spacing =
    totalRows > 1 ? Math.max(2, Math.min(10, space / (totalRows - 1))) : 0;
  const dir = nearY <= farY ? 1 : -1;
  const last = rows[rows.length - 1];
  const rearY = last ? nearY + dir * last.row * spacing : nearY;
  return (batteryY(side, height) + rearY) / 2;
}

/** 骑兵图标：指向敌方的一排三角；蓄力为空心，冲锋为实心高亮 */
function drawWingCavalry(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  cavalry: number,
  side: "red" | "blue",
  color: string,
  y: number,
  attackingIcons: ReadonlySet<number>,
  progress: number,
): void {
  if (cavalry <= 0) return;
  const xs = cavalryIconXs(centerX, cavalry);
  for (let icon = 0; icon < xs.length; icon++) {
    const x = xs[icon];
    const attacking = attackingIcons.has(icon);
    const r = attacking ? 5.2 : 4;
    // 三角尖端指向敌方：红方朝下、蓝方朝上
    const dir = side === "red" ? 1 : -1;
    ctx.beginPath();
    ctx.moveTo(x, y + dir * r);
    ctx.lineTo(x + r, y - dir * r * 0.7);
    ctx.lineTo(x - r, y - dir * r * 0.7);
    ctx.closePath();
    if (attacking) {
      ctx.globalAlpha = 1;
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
      ctx.lineWidth = 1.6;
      ctx.stroke();
    } else {
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.4;
      ctx.stroke();
      // 蓄力进度：三角形内部随进度逐渐填充，满格时几乎实心
      if (progress > 0.05) {
        ctx.globalAlpha = 0.85 * progress;
        ctx.fillStyle = color;
        ctx.fill();
      }
    }
  }
  ctx.globalAlpha = 1;
}

/** 该翼处于冲锋状态的骑兵单元所对应的图标集合 */
function cavalryAttackingIcons(
  sim: Simulation,
  side: "red" | "blue",
  wingIndex: number,
): Set<number> {
  const set = new Set<number>();
  const cavalry = (side === "red" ? sim.redWings : sim.blueWings)[wingIndex]
    .cavalry;
  const icons = cavalryIconCount(cavalry);
  for (const charge of sim.getCavalryCharges()) {
    if (charge.side !== side || charge.wing !== wingIndex) continue;
    const icon = Math.min(
      icons - 1,
      Math.floor((charge.unitIndex * icons) / Math.max(1, cavalry)),
    );
    set.add(icon);
  }
  return set;
}

/** 把阵型中的士兵点映射为画布坐标（与 drawWingFormation 同一布局） */
function formationDotXY(
  centerX: number,
  wingWidth: number,
  nearY: number,
  farY: number,
  rows: readonly FormationRow[],
  dot: DotRef,
  yOffset = 0,
): [number, number] {
  const totalRows = Math.max(1, rows.length);
  const space = Math.abs(farY - nearY);
  const spacing =
    totalRows > 1 ? Math.max(2, Math.min(10, space / (totalRows - 1))) : 0;
  const dir = nearY <= farY ? 1 : -1;
  const row = rows.find((r) => r.row === dot.row);
  const count = row?.count ?? 0;
  // 行已消失（如整排被歼）：退回到翼中心，避免红叉飘到奇怪的位置
  if (!row || count <= 0) {
    return [centerX, formationY(nearY, farY, dir, 0, spacing, yOffset)];
  }
  return [
    centerX +
      (dot.col - (count - 1) / 2) * formationRowSpacing(rows, wingWidth),
    formationY(nearY, farY, dir, dot.row, spacing, yOffset),
  ];
}

/** 阵型纵坐标：加上后撤位移，并限制在阵型带内（避免溃兵冲进标签/炮兵区） */
function formationY(
  nearY: number,
  farY: number,
  dir: number,
  row: number,
  spacing: number,
  yOffset: number,
): number {
  const y = nearY + dir * row * spacing + yOffset;
  const lo = Math.min(nearY, farY) + 6;
  const hi = Math.max(nearY, farY) - 6;
  return Math.max(lo, Math.min(hi, y));
}

/**
 * 翼内统一的横向点间距：
 * 前排数量不变时，调整战场宽度不应改变图像——点距只由实际行点数决定，
 * 点少时保持基准 8px，点多放不下时按翼宽压缩。
 */
function formationRowSpacing(
  rows: readonly FormationRow[],
  wingWidth: number,
): number {
  const maxCount = rows.reduce((max, row) => Math.max(max, row.count), 1);
  return Math.min(DOT_SPACING, (wingWidth - 16) / maxCount);
}

/** 溃退/撤退后撤位移：红方朝上、蓝方朝下（远离中央战线），随进度增大 */
function routDrift(
  sim: Simulation,
  side: "red" | "blue",
  wingIndex: number,
): number {
  const remaining = sim.getRoutTicksRemaining(side, wingIndex);
  if (remaining <= 0) return 0;
  const retreating = sim.isRetreating(side, wingIndex);
  const duration = retreating ? RETREAT_DURATION : ROUT_DURATION;
  const maxShift = retreating ? RETREAT_DRIFT_MAX : ROUT_DRIFT_MAX;
  const progress = 1 - remaining / duration;
  const dir = side === "red" ? -1 : 1;
  return dir * maxShift * progress;
}

/** 溃退/撤退淡出：越接近离场越透明（溃退散得更快，撤退保持清晰） */
function routFade(
  sim: Simulation,
  side: "red" | "blue",
  wingIndex: number,
): number {
  const remaining = sim.getRoutTicksRemaining(side, wingIndex);
  if (remaining <= 0) return 1;
  const retreating = sim.isRetreating(side, wingIndex);
  const duration = retreating ? RETREAT_DURATION : ROUT_DURATION;
  const progress = 1 - remaining / duration;
  const minAlpha = retreating ? 0.6 : 0.25;
  return 1 - (1 - minAlpha) * progress;
}

/** 攻击对象 → 画布坐标 */
function attackTargetXY(
  target: AttackTarget,
  width: number,
  height: number,
  sim: Simulation,
): [number, number] {
  const wingMargin = 12;
  const wingWidth = (width - wingMargin * 2) / 3;
  if (target.kind === "battery") {
    const wings = target.side === "red" ? sim.redWings : sim.blueWings;
    const centerX = wingMargin + wingWidth * (target.wing + 0.5);
    const x =
      batteryIconXs(centerX, wings[target.wing].guns)[target.icon] ?? centerX;
    const y = batteryY(target.side, height);
    return [x, y];
  }
  const dot = target.dot;
  const wing = (dot.side === "red" ? sim.redWings : sim.blueWings)[dot.wing];
  const { nearY, farY } = formationBounds(dot.side, height);
  const rows = formationRows(
    wing.front,
    wing.middle,
    wing.rear,
    dot.wing,
    sim.config.rowWidth,
  );
  const centerX = wingMargin + wingWidth * (dot.wing + 0.5);
  return formationDotXY(
    centerX,
    wingWidth,
    nearY,
    farY,
    rows,
    dot,
    routDrift(sim, dot.side, dot.wing),
  );
}

/** 士兵射击箭头：前三排每一个士兵点单独指向其攻击对象 */
function drawFireArrows(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  sim: Simulation,
  byWing: Map<string, FireAssignment[]>,
): void {
  const wingMargin = 12;
  const wingWidth = (width - wingMargin * 2) / 3;

  for (const side of ["red", "blue"] as const) {
    const wings = side === "red" ? sim.redWings : sim.blueWings;
    const enemyWings = side === "red" ? sim.blueWings : sim.redWings;
    for (let i = 0; i < 3; i++) {
      const wing = wings[i];
      if (wing.front + wing.middle + wing.rear <= 0) continue;

      const centerX = wingMargin + wingWidth * (i + 0.5);
      const { nearY, farY } = formationBounds(side, height);
      const rows = formationRows(
        wing.front,
        wing.middle,
        wing.rear,
        i,
        sim.config.rowWidth,
      );
      const flanking =
        enemyWings[i].front + enemyWings[i].middle + enemyWings[i].rear <= 0;
      const color = flanking ? AMBER : side === "red" ? RED_COLOR : BLUE_COLOR;
      const alpha = flanking ? 0.7 : 0.38;

      for (const assignment of byWing.get(`${side}-${i}`) ?? []) {
        const source = assignment.source;
        // 追杀线：指向无序溃退翼的攻击以实线高亮（有序撤退不额外高亮）
        const targetRouting =
          assignment.target.kind === "dot" &&
          sim.isRouted(
            assignment.target.dot.side,
            assignment.target.dot.wing,
          );
        const [sx, sy] = formationDotXY(
          centerX,
          wingWidth,
          nearY,
          farY,
          rows,
          source,
          routDrift(sim, side, i),
        );
        const [tx, ty] = attackTargetXY(
          assignment.target,
          width,
          height,
          sim,
        );
        drawArrow(
          ctx,
          sx,
          sy,
          tx,
          ty,
          color,
          targetRouting ? 0.9 : alpha,
          targetRouting || assignment.target.kind === "battery",
        );
      }
    }
  }
}

/** 火炮射击箭头：每一门火炮图标单独指向其攻击对象 */
function drawArtilleryArrows(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  sim: Simulation,
  byWing: Map<string, GunAssignment[]>,
): void {
  const wingMargin = 12;
  const wingWidth = (width - wingMargin * 2) / 3;

  for (const side of ["red", "blue"] as const) {
    const wings = side === "red" ? sim.redWings : sim.blueWings;

    for (let i = 0; i < 3; i++) {
      const guns = wings[i].guns;
      if (guns <= 0) continue;
      const centerX = wingMargin + wingWidth * (i + 0.5);
      const xs = batteryIconXs(centerX, guns);
      const y = batteryY(side, height);

      for (const assignment of byWing.get(`${side}-${i}`) ?? []) {
        const targetRouting =
          assignment.target.kind === "dot" &&
          sim.isRouted(
            assignment.target.dot.side,
            assignment.target.dot.wing,
          );
        const [tx, ty] = attackTargetXY(
          assignment.target,
          width,
          height,
          sim,
        );
        // 面杀伤：压制成形的炮弹落点画冲击圈，体现范围伤害
        if (assignment.target.kind === "dot") {
          drawArtilleryBlast(ctx, tx, ty);
        }
        drawArrow(
          ctx,
          xs[assignment.icon] ?? centerX,
          y,
          tx,
          ty,
          ARTILLERY_COLOR,
          targetRouting ? 0.9 : 0.55,
          targetRouting || assignment.target.kind === "battery",
        );
      }
    }
  }
}

/** 火炮面杀伤标记：落点周围的半透明冲击圈与溅射点 */
function drawArtilleryBlast(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
): void {
  ctx.save();
  ctx.globalAlpha = 0.26;
  ctx.fillStyle = ARTILLERY_COLOR;
  ctx.beginPath();
  ctx.arc(x, y, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.55;
  ctx.strokeStyle = ARTILLERY_COLOR;
  ctx.setLineDash([3, 3]);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(x, y, 21, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 0.8;
  ctx.fillStyle = ARTILLERY_COLOR;
  const offsets = [
    [-13, -9],
    [14, -5],
    [-7, 12],
    [16, 14],
  ] as const;
  for (const [dx, dy] of offsets) {
    ctx.beginPath();
    ctx.arc(x + dx, y + dy, 1.7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** 击杀线：上一回合实际击毙目标的那几条线，以实线高亮（短暂显示） */
function drawKillLines(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  sim: Simulation,
): void {
  const wingMargin = 12;
  const wingWidth = (width - wingMargin * 2) / 3;

  for (const assignment of sim.getSoldierKillLines()) {
    if (assignment.target.kind !== "dot") continue;
    const source = assignment.source;
    const wings = source.side === "red" ? sim.redWings : sim.blueWings;
    const wing = wings[source.wing];
    if (wing.front + wing.middle + wing.rear <= 0) continue;
    const centerX = wingMargin + wingWidth * (source.wing + 0.5);
    const { nearY, farY } = formationBounds(source.side, height);
    const rows = formationRows(
      wing.front,
      wing.middle,
      wing.rear,
      source.wing,
      sim.config.rowWidth,
    );
    const [sx, sy] = formationDotXY(
      centerX,
      wingWidth,
      nearY,
      farY,
      rows,
      source,
      routDrift(sim, source.side, source.wing),
    );
    const [tx, ty] = attackTargetXY(assignment.target, width, height, sim);
    drawArrow(
      ctx,
      sx,
      sy,
      tx,
      ty,
      source.side === "red" ? RED_COLOR : BLUE_COLOR,
      0.9,
      true,
    );
  }

  for (const assignment of sim.getArtilleryKillLines()) {
    if (assignment.target.kind !== "dot") continue;
    const wings = assignment.side === "red" ? sim.redWings : sim.blueWings;
    const centerX = wingMargin + wingWidth * (assignment.wing + 0.5);
    const xs = batteryIconXs(centerX, wings[assignment.wing].guns);
    const y = batteryY(assignment.side, height);
    const [tx, ty] = attackTargetXY(assignment.target, width, height, sim);
    // 击杀实线同样带面杀伤冲击圈
    drawArtilleryBlast(ctx, tx, ty);
    drawArrow(
      ctx,
      xs[assignment.icon] ?? centerX,
      y,
      tx,
      ty,
      ARTILLERY_COLOR,
      0.9,
      true,
    );
  }
}

/** 骑兵冲锋箭头：每个冲锋中的骑兵单元指向其目标（实线高亮） */
function drawCavalryArrows(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  sim: Simulation,
): void {
  const wingMargin = 12;
  const wingWidth = (width - wingMargin * 2) / 3;
  for (const charge of sim.getCavalryCharges()) {
    const wings = charge.side === "red" ? sim.redWings : sim.blueWings;
    const wing = wings[charge.wing];
    const enemyWings = charge.side === "red" ? sim.blueWings : sim.redWings;
    const enemy = enemyWings[charge.wing];
    // 侧击冲锋用琥珀色，与步兵侧击箭头一致
    const flanking =
      enemy.front + enemy.middle + enemy.rear <= 0;
    const cavalry = wing.cavalry;
    const icons = cavalryIconCount(cavalry);
    const centerX = wingMargin + wingWidth * (charge.wing + 0.5);
    const xs = cavalryIconXs(centerX, cavalry);
    const icon = Math.min(
      icons - 1,
      Math.floor((charge.unitIndex * icons) / Math.max(1, cavalry)),
    );
    const sx = xs[icon] ?? centerX;
    const { nearY, farY } = formationBounds(charge.side, height);
    const rows = formationRows(
      wing.front,
      wing.middle,
      wing.rear,
      charge.wing,
      sim.config.rowWidth,
    );
    const sy = cavalryY(charge.side, height, rows, nearY, farY);
    const [tx, ty] = attackTargetXY(
      { kind: "dot", dot: charge.target },
      width,
      height,
      sim,
    );
    drawArrow(
      ctx,
      sx,
      sy,
      tx,
      ty,
      flanking
        ? AMBER
        : charge.side === "red"
          ? RED_COLOR
          : BLUE_COLOR,
      0.85,
      true,
    );
  }
}

/** 红叉标记：白色底圈 + 深红叉，避免与红/蓝圆点同色而看不见 */
function drawKillMark(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
  ctx.beginPath();
  ctx.arc(x, y, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#7f1d1d";
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  const size = 4;
  ctx.beginPath();
  ctx.moveTo(x - size, y - size);
  ctx.lineTo(x + size, y + size);
  ctx.moveTo(x + size, y - size);
  ctx.lineTo(x - size, y + size);
  ctx.stroke();
}

/** 红叉：近若干回合被击毙的士兵点与被摧毁的火炮图标（与击杀线同时显示） */
function drawKillMarks(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  sim: Simulation,
): void {
  const wingMargin = 12;
  const wingWidth = (width - wingMargin * 2) / 3;
  for (const dot of sim.getKilledDots()) {
    const wings = dot.side === "red" ? sim.redWings : sim.blueWings;
    const wing = wings[dot.wing];
    const centerX = wingMargin + wingWidth * (dot.wing + 0.5);
    const { nearY, farY } = formationBounds(dot.side, height);
    const rows = formationRows(
      wing.front,
      wing.middle,
      wing.rear,
      dot.wing,
      sim.config.rowWidth,
    );
    const [x, y] = formationDotXY(
      centerX,
      wingWidth,
      nearY,
      farY,
      rows,
      dot,
      routDrift(sim, dot.side, dot.wing),
    );
    drawKillMark(ctx, x, y);
  }
  // 被摧毁的火炮图标也标红叉（按图标死亡时的总数复原坐标）
  for (const mark of sim.getKilledBatteryIcons()) {
    const centerX = wingMargin + wingWidth * (mark.wing + 0.5);
    const x = batteryIconXs(centerX, mark.count)[mark.icon] ?? centerX;
    const y = batteryY(mark.side, height);
    drawKillMark(ctx, x, y);
  }
  // 被消灭的骑兵图标也标红叉（按图标死亡时的总数复原坐标）
  for (const mark of sim.getKilledCavalryIcons()) {
    const wings = mark.side === "red" ? sim.redWings : sim.blueWings;
    const wing = wings[mark.wing];
    const centerX = wingMargin + wingWidth * (mark.wing + 0.5);
    const x = cavalryIconXs(centerX, mark.count)[mark.icon] ?? centerX;
    const { nearY, farY } = formationBounds(mark.side, height);
    const rows = formationRows(
      wing.front,
      wing.middle,
      wing.rear,
      mark.wing,
      sim.config.rowWidth,
    );
    const y = cavalryY(mark.side, height, rows, nearY, farY);
    drawKillMark(ctx, x, y);
  }
}

/** 一个翼的平直线列阵型：前排（实心高亮）→ 中排（实心变暗）→ 后排（空心） */
function drawWingFormation(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  wingWidth: number,
  front: number,
  middle: number,
  rear: number,
  wing: number,
  rowWidth: number,
  nearY: number,
  farY: number,
  color: string,
  softColor: string,
  routing = false,
  yOffset = 0,
  fade = 1,
): void {
  // 一个点代表一个火力单元：每排点数 = 战场宽度 / 每点人数
  const rows = formationRows(front, middle, rear, wing, rowWidth);
  const totalRows = Math.max(1, rows.length);
  const space = Math.abs(farY - nearY);

  const spacing =
    totalRows > 1 ? Math.max(2, Math.min(10, space / (totalRows - 1))) : 0;
  const dir = nearY <= farY ? 1 : -1;
  const fillColor = routing ? "#8f8b84" : color;
  const ringColor = routing ? "#8f8b84" : softColor;
  const frontAlpha = (routing ? 0.55 : 1) * fade;
  const middleAlpha = (routing ? 0.4 : 0.6) * fade;
  const rearAlpha = (routing ? 0.5 : 0.8) * fade;
  const dotSpacing = formationRowSpacing(rows, wingWidth);

  for (const row of rows) {
    const y = formationY(nearY, farY, dir, row.row, spacing, yOffset);
    // 点半径随横纵实际间距缩小，点数不设上限也不重叠
    const minSpacing = Math.min(dotSpacing, spacing || dotSpacing);
    // 半径按间距的 0.4 倍留出空隙，密集排也不会互相重叠
    const radius = Math.max(0.8, minSpacing * 0.4);
    const frontRadius = Math.max(
      radius,
      Math.min(radius + 0.5, minSpacing * 0.46 - 0.3),
    );
    for (let c = 0; c < row.count; c++) {
      const x = centerX + (c - (row.count - 1) / 2) * dotSpacing;
      if (row.echelon === "front") {
        ctx.globalAlpha = frontAlpha;
        ctx.fillStyle = fillColor;
        ctx.beginPath();
        ctx.arc(x, y, frontRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = routing ? "rgba(255, 255, 255, 0.25)" : "rgba(255, 255, 255, 0.45)";
        ctx.beginPath();
        ctx.arc(
          x - frontRadius * 0.3,
          y - frontRadius * 0.3,
          Math.max(0.6, frontRadius * 0.32),
          0,
          Math.PI * 2,
        );
        ctx.fill();
      } else if (row.echelon === "middle") {
        ctx.globalAlpha = middleAlpha;
        ctx.fillStyle = fillColor;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.globalAlpha = rearAlpha;
        ctx.strokeStyle = ringColor;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }
  ctx.globalAlpha = 1;
}

function drawArrow(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  alpha: number,
  solid = false,
): void {
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.3;
  ctx.setLineDash(solid ? [] : [4, 3]);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.setLineDash([]);

  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const px = -uy;
  const py = ux;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - ux * 8 + px * 4, y2 - uy * 8 + py * 4);
  ctx.lineTo(x2 - ux * 8 - px * 4, y2 - uy * 8 - py * 4);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawLegend(ctx: CanvasRenderingContext2D, width: number): void {
  const items: Array<[string, string, number[]]> = [
    ["红方前", RED_COLOR, []],
    ["红方中", RED_SOFT, [5, 4]],
    ["红方后", RED_FAINT, [2, 3]],
    ["蓝方前", BLUE_COLOR, []],
    ["蓝方中", BLUE_SOFT, [5, 4]],
    ["蓝方后", BLUE_FAINT, [2, 3]],
  ];
  const itemWidth = 62;
  const startX = width - items.length * itemWidth - 8;

  ctx.font = `10px ${SERIF}`;
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  items.forEach(([label, color, dash], index) => {
    const x = startX + index * itemWidth;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.setLineDash(dash);
    ctx.beginPath();
    ctx.moveTo(x, 7);
    ctx.lineTo(x + 12, 7);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = MUTED_COLOR;
    ctx.fillText(label, x + 15, 2);
  });
}

function drawLine(
  ctx: CanvasRenderingContext2D,
  points: ReadonlyArray<readonly [number, number]>,
  color: string,
  dash?: number[],
): void {
  if (points.length === 0) return;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.setLineDash(dash ?? []);
  ctx.beginPath();
  const [startX, startY] = points[0];
  ctx.moveTo(startX, startY);
  for (const [x, y] of points.slice(1)) {
    ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.setLineDash([]);
}

/** 选取合适的坐标轴刻度步长 */
function niceStep(target: number): number {
  const steps = [1, 2, 5, 10, 20, 50, 100, 200, 500];
  for (const step of steps) {
    if (step >= target) return step;
  }
  return 1000;
}
