/**
 * 纯布局层：火力单元 ↔ 排/点/图标的换算与阵型布点。
 * 模拟结算与渲染端共用同一套函数，保证箭头、圆点与击杀槽位完全对齐。
 */

/** 阵型中的一排（每行的人数） */
export interface FormationRow {
  row: number;
  echelon: "front" | "middle" | "rear";
  count: number;
}

/** 火力单元射击间隔（回合）：千回合约 70 发，每个点并非每回合射击 */
export const FIRE_INTERVAL = 14;

/** 每个点代表的士兵数：中军 25 人、两翼 19 人（单元粒度，与排容量换算共用） */
export function soldiersPerDot(wing: number): number {
  return wing === 1 ? 25 : 19;
}

/**
 * 每排容量（点数）：每排长度 = 战场宽度（人），按每点人数换算成火力单元。
 * 容量随 rowWidth 缩放，保证前排三排最多容纳 3 × rowWidth 人。
 */
export function rowCapacity(wing: number, rowWidth: number): number {
  return Math.max(1, Math.ceil(rowWidth / soldiersPerDot(wing)));
}

/** 把若干火力单元尽量均匀地分布到固定行数（前排固定三排） */
function distributeUnits(units: number, rows: number, cap: number): number[] {
  const counts: number[] = [];
  let remaining = units;
  for (let row = 0; row < rows; row++) {
    if (remaining <= 0) {
      counts.push(0);
      continue;
    }
    const left = rows - row;
    counts.push(Math.min(cap, Math.ceil(remaining / left)));
    remaining -= counts[counts.length - 1];
  }
  return counts;
}

/** 阵型布点（前/中/后按行排列），与绘制端共用，保证箭头与圆点对齐；
 *  前排固定三排且每排点数尽量均匀；中排/后排按“前排单行最大点数”同宽切行，
 *  避免整排点数远超前排导致显示宽度不一致 */
export function formationRows(
  front: number,
  middle: number,
  rear: number,
  wing: number,
  rowWidth: number,
): FormationRow[] {
  const cap = rowCapacity(wing, rowWidth);
  const perDot = soldiersPerDot(wing);
  const toUnits = (n: number) => Math.max(0, Math.ceil(n / perDot));
  const frontUnits = toUnits(front);
  const middleUnits = toUnits(middle);
  const rearUnits = toUnits(rear);
  const rows: FormationRow[] = [];
  let r = 0;
  const frontCounts =
    frontUnits > 0 ? distributeUnits(frontUnits, 3, cap) : [];
  for (const count of frontCounts) {
    if (count > 0) rows.push({ row: r, echelon: "front", count });
    r++;
  }
  // 中排/后排与前排同宽：没有前排时退回战场宽度容量
  const rowCap = frontCounts.length > 0 ? Math.max(...frontCounts) : cap;
  const middleRows = Math.max(0, Math.ceil(middleUnits / rowCap));
  for (let k = 0; k < middleRows; k++) {
    const count = Math.min(rowCap, Math.max(0, middleUnits - k * rowCap));
    if (count > 0) rows.push({ row: r, echelon: "middle", count });
    r++;
  }
  const rearRows = Math.max(0, Math.ceil(rearUnits / rowCap));
  for (let k = 0; k < rearRows; k++) {
    const count = Math.min(rowCap, Math.max(0, rearUnits - k * rowCap));
    if (count > 0) rows.push({ row: r, echelon: "rear", count });
    r++;
  }
  return rows;
}

/** 火炮图标数量（最多 8 个），与绘制端共用 */
export function gunIconCount(guns: number): number {
  return Math.min(8, Math.max(1, Math.round(guns / 10)));
}

/** 骑兵图标数量（最多 8 个）：每 5 个单元 1 个图标，随配置数量递增 */
export function cavalryIconCount(cavalry: number): number {
  return Math.min(8, Math.max(1, Math.ceil(cavalry / 5)));
}
