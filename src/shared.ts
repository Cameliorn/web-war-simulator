/** 跨页面共享常量：战斗页 / 统计页 / 渲染端统一引用，避免多处硬编码 */

/** 战斗页与统计页同步战斗数据的 localStorage key */
export const STORAGE_KEY = "war-sim-last-battle";

/** 翼名（0 = 左翼，1 = 中军，2 = 右翼） */
export const WING_LABELS = ["左翼", "中军", "右翼"] as const;

/** 红方主色 */
export const RED_COLOR = "#b91c1c";

/** 蓝方主色 */
export const BLUE_COLOR = "#1d4ed8";
