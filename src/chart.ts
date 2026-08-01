import type { HistoryPoint } from "./simulation";
import { BLUE_COLOR, RED_COLOR } from "./shared";
import {
  BG_COLOR,
  BLUE_FAINT,
  BLUE_SOFT,
  GRID_COLOR,
  MUTED_COLOR,
  RED_FAINT,
  RED_SOFT,
  SERIF,
} from "./theme";

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
