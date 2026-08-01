import {
  FIRE_INTERVAL,
  cavalryIconCount,
  formationRows,
  gunIconCount,
  soldiersPerDot,
  type FormationRow,
} from "./layout";

export interface BattleConfig {
  redInitial: number;
  blueInitial: number;
  /** α：红方直瞄火力效率 */
  redEfficiency: number;
  /** β：蓝方直瞄火力效率 */
  blueEfficiency: number;
  /** 红方梯队占比（前/中/后），自动归一化 */
  redEchelon: [number, number, number];
  /** 蓝方梯队占比（前/中/后），自动归一化 */
  blueEchelon: [number, number, number];
  /** 后排支援前排的速度（慢速，0~1） */
  rearFillRate: number;
  /** 战场宽度：一排最多站多少人 */
  rowWidth: number;
  /** 红方三翼部署占比（左/中/右），自动归一化 */
  redDeploy: [number, number, number];
  /** 蓝方三翼部署占比（左/中/右），自动归一化 */
  blueDeploy: [number, number, number];
  /** 红方火炮按翼部署：[左翼, 中军, 右翼] */
  redArtillery: number[];
  /** 蓝方火炮按翼部署：[左翼, 中军, 右翼] */
  blueArtillery: number[];
  /** 红方骑兵按翼部署：[左翼, 中军, 右翼] */
  redCavalry: number[];
  /** 蓝方骑兵按翼部署：[左翼, 中军, 右翼] */
  blueCavalry: number[];
  /** 战斗随机性（0~1，0 为完全确定） */
  randomness: number;
  /** 伤害水平倍率（0.01~1，1 为原始伤害） */
  damageScale: number;
  /** 红方士气（0.5~2，1 为默认；越高组织度越坚韧） */
  redMorale: number;
  /** 蓝方士气（0.5~2，1 为默认） */
  blueMorale: number;
}

export type TargetChoice = "auto" | 0 | 1 | 2;
export type ReinforceChoice = "hold" | 0 | 1 | 2;
export type RetreatChoice = "hold" | "retreat";
export type CounterBatteryChoice = "auto" | "on" | "off";
export type RearSpeed = "slow" | "medium" | "fast";

/** 单个翼的作战命令 */
export interface WingOrder {
  /** 打击目标：auto 为自动（正面交战，翼灭后侧击） */
  target: TargetChoice;
  /** 人员调度：hold 为固守，其余为向指定友翼抽调后排 */
  reinforce: ReinforceChoice;
  /** 撤退决策：hold 固守；retreat 主动撤退（有序撤退，被击杀率低） */
  retreat: RetreatChoice;
}

/** 单支火炮的作战命令 */
export interface BatteryOrder {
  /** 压制目标：auto 为自动（本翼敌翼优先，翼灭后转移） */
  target: TargetChoice;
  /** 反炮策略 */
  counterBattery: CounterBatteryChoice;
}

/** 一方的将领决策 */
export interface SideOrders {
  wings: WingOrder[];
  batteries: BatteryOrder[];
  /** 后排投入速度（影响后排支援前排的速率） */
  rearSpeed: RearSpeed;
}

/** 将领机制：战斗中实时决策的作战命令 */
export interface CommanderOrders {
  red: SideOrders;
  blue: SideOrders;
}

export type BattleStatus = "ready" | "running" | "paused" | "finished";
export type Winner = "red" | "blue" | "draw" | null;

export interface WingState {
  /** 前排：最前面三排，唯一开火的梯队 */
  front: number;
  /** 中排：紧贴前排，瞬间补位 */
  middle: number;
  /** 后排：纵深预备队，慢速支援 */
  rear: number;
  /** 部署在本翼后方的火炮数量 */
  guns: number;
  /** 部署在本翼后方（步兵与火炮之间）的骑兵数量 */
  cavalry: number;
}

/** 单个翼在某一时刻的兵力快照 */
export interface WingSnapshot {
  front: number;
  middle: number;
  rear: number;
  guns: number;
  cavalry: number;
  /** 组织度（0~1） */
  org: number;
}

/** 翼的最终状态：存活 / 溃退中 / 撤退中 / 有序撤退成功 / 溃逃成功 / 被歼 */
export type WingOutcome =
  | "alive"
  | "routing"
  | "retreating"
  | "retreated"
  | "fled"
  | "destroyed";

export interface HistoryPoint {
  time: number;
  redFront: number;
  redMiddle: number;
  redRear: number;
  blueFront: number;
  blueMiddle: number;
  blueRear: number;
  /** 每翼兵力快照（供统计页按翼维度展示） */
  redWings: WingSnapshot[];
  blueWings: WingSnapshot[];
}

/** 单个翼的击杀统计（按兵种） */
export interface WingKills {
  /** 士兵击杀（含士兵摧毁的火炮） */
  infantry: number;
  /** 火炮击杀（含反炮摧毁火炮、面杀伤折算） */
  artillery: number;
}

/** 双方各翼击杀统计 */
export interface KillStats {
  red: WingKills[];
  blue: WingKills[];
}

export interface ArtilleryTargets {
  /** 是否对敌方本翼火炮进行反炮射击 */
  counterBattery: boolean;
  /** 火炮压制的敌翼列表 */
  formations: number[];
}

/** 阵型中的一个士兵点（前三排点） */
export interface DotRef {
  side: "red" | "blue";
  wing: number;
  /** 阵型行号（0 起，0 为最靠近战线的一行） */
  row: number;
  /** 行内列号（0 起） */
  col: number;
}

/** 被摧毁的火炮图标（供渲染端标红叉） */
export interface BatteryMarkRef {
  side: "red" | "blue";
  wing: number;
  /** 图标序号（0 起） */
  icon: number;
  /** 图标死亡时整翼的图标总数：复原该图标的画布坐标用 */
  count: number;
}

/** 冲锋中的骑兵单元（供渲染端画箭头与高亮） */
export interface CavalryChargeRef {
  side: "red" | "blue";
  wing: number;
  /** 单元在翼内骑兵数组中的序号（映射到图标用） */
  unitIndex: number;
  /** 本次冲锋的目标 */
  target: DotRef;
}

/** 被消灭的骑兵图标（供渲染端标红叉） */
export interface CavalryMarkRef {
  side: "red" | "blue";
  wing: number;
  icon: number;
  /** 图标死亡时整翼的图标总数：复原该图标的画布坐标用 */
  count: number;
}

/** 单个骑兵单元的状态机：准备（蓄力，不受伤害）→ 冲锋（一次对决）→ 回到准备 */
interface CavalryUnitState {
  /** 单元稳定序号：阵亡 splice 后数组下标会变，随机种子必须用稳定 id */
  id: number;
  /** 剩余蓄力回合数 */
  chargeTicks: number;
  /** 冲锋中：下一回合结算一次对决（保留一回合可见的冲锋状态） */
  attacking: boolean;
  /** 冲锋剩余可见回合数（倒计时到 0 才结算对决） */
  attackTicks: number;
  /** 本次冲锋的目标（结算与绘制共用） */
  target: DotRef | null;
}

/** 攻击对象：敌方前三排中的某个点，或敌方某门火炮 */
export type AttackTarget =
  | { kind: "dot"; dot: DotRef }
  | { kind: "battery"; side: "red" | "blue"; wing: number; icon: number };

/** 前排士兵点 → 攻击对象的逐点分配 */
export interface FireAssignment {
  source: DotRef;
  target: AttackTarget;
}

/** 火炮 → 攻击对象的逐炮分配 */
export interface GunAssignment {
  side: "red" | "blue";
  wing: number;
  /** 火炮图标序号（0 起，最多 8 个） */
  icon: number;
  target: AttackTarget;
}

interface Noise {
  red: number[];
  blue: number[];
  redBattery: number[];
  blueBattery: number[];
}

/** 前排命中点槽位：每个士兵点独立存在，单发命中按概率击毙 */
interface FrontSlotState {
  alive: boolean[];
}

interface FireParams {
  rowWidth: number;
  rearFillRate: number;
}

const WING_COUNT = 3;
const FIELDS_PER_WING = 4; // front / middle / rear / guns
const STATE_SIZE = WING_COUNT * FIELDS_PER_WING * 2;
const FIELD_FRONT = 0;
const FIELD_MIDDLE = 1;
const FIELD_REAR = 2;
const FIELD_GUNS = 3;
/** 翼总兵力低于自身初始值该比例时视为溃败（统计页共用） */
export const ROUT_RATIO = 0.01;
/** 默认士气下，伤亡达到该比例时组织度归零（士气可缩放该阈值） */
const ORG_BREAK_LOSS = 0.3;
/** 溃退持续回合数：期间无法攻击、只能被击杀，结束后视为逃生成功 */
export const ROUT_DURATION = 10;
/** 有组织撤退持续回合数（比溃退更快离场） */
export const RETREAT_DURATION = 8;
/** 溃退期每回合溃散减员比例（对当前剩余兵力） */
const ROUT_ATTRITION_RATE = 0.06;
/** 有组织撤退期每回合减员比例（远低于溃退） */
const RETREAT_ATTRITION_RATE = 0.008;
/** 溃退目标受到敌方火力的额外倍率（溃兵更易被杀伤） */
const ROUT_TARGET_KILL_MULT = 2;
/** 撤退目标受到敌方火力的倍率（有序撤退伤亡低） */
const RETREAT_TARGET_KILL_MULT = 0.5;
/** 红叉标记保留回合数（暂停观察时也保留） */
export const KILL_MARK_TICKS = 8;
/** 骑兵蓄力回合数：准备状态持续该回合数后发动一次冲锋 */
export const CAVALRY_CHARGE_TICKS = 30;
/** 骑兵冲锋可见回合数：进入冲锋状态后保留该回合数再结算对决 */
const CAVALRY_ATTACK_TICKS = 3;
/** 骑兵对决基础胜率：配合 2 倍杀伤，单次冲锋期望交换比为正但风险高 */
const CAVALRY_DUEL_CHANCE = 0.4;
/** 每个骑兵单元代表的骑兵人数（历史配比约 5%~10%，默认 900 人 = 9%） */
export const CAVALRY_PER_DOT = 25;
/** 冲锋成功时击杀的敌方火力单元数（多倍杀伤；失败仅损失 1 个骑兵单元） */
const CAVALRY_KILL_MULT = 2;
/** 士气动态波动：伤亡占比下降系数 */
const MORALE_CAS_COEFF = 1;
/** 士气动态波动：击杀占比上升系数 */
const MORALE_KILL_COEFF = 0.8;
/** 士气动态波动：双方总兵力比持续压力系数 */
const MORALE_RATIO_COEFF = 0.001;
/** 士气随机波动幅度 */
const MORALE_RANDOM = 0.005;
/** 士气下限 / 上限 */
const MORALE_MIN = 0.3;
const MORALE_MAX = 3;
/** 单次结算最大模拟步长（次），按整回合结算 */
const MAX_STEP_TICKS = 1;
/** 火炮系数：每门炮每轮的基础面杀伤（按火力单元模型重标定，默认战斗约 1000 回合、火炮占比约 7%） */
const ARTILLERY_COEFF = 0.6;
/** 炮兵伤害倍率：面杀伤与反炮统一放大 */
const ARTILLERY_DAMAGE_MULT = 5;
/** 炮兵对后排（掩体内）的杀伤衰减系数 */
const ARTILLERY_REAR_COVER = 0.3;
/** 反炮系数：每门己方火炮每轮摧毁的敌方火炮数 */
const COUNTER_COEFF = 0.04;
/** 士兵攻击系数：每名有效射手每轮摧毁的火炮数（翼被歼后火炮暴露） */
const GUN_KILL_COEFF = 0.02;
/** 翼间调度系数：每轮从本翼后排抽调的比例 */
const REINFORCE_RATE = 0.1;
/** 后排投入速度 -> 后排支援速率倍率 */
const REAR_SPEED_MULT: Record<RearSpeed, number> = {
  slow: 1,
  medium: 3,
  fast: 8,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function addScaled(base: number[], delta: number[], scale: number): number[] {
  return base.map((value, index) => value + delta[index] * scale);
}

function sumWings(wings: WingState[], pick: (w: WingState) => number): number {
  return wings.reduce((total, wing) => total + pick(wing), 0);
}

/** 三翼部署占比归一化（左/中/右） */
function deployWeights(deploy: [number, number, number]): number[] {
  const sum = deploy[0] + deploy[1] + deploy[2] || 1;
  return [deploy[0] / sum, deploy[1] / sum, deploy[2] / sum];
}

/** 梯队占比归一化（前/中/后） */
function normalizeEchelon(echelon: [number, number, number]): [number, number, number] {
  const sum = echelon[0] + echelon[1] + echelon[2] || 1;
  return [echelon[0] / sum, echelon[1] / sum, echelon[2] / sum];
}

/** 确定性伪随机（按轮次种子），保证同一轮内箭头不闪烁 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 初始化一个翼：前排固定三排、每排长度 = 战场宽度；
 *  front 与 middle 各自独立按同一宽度上限计算（每排长度相同，显示上更整齐），
 *  各自超过 3×rowWidth 的部分自动转入后排 */
function initWing(
  total: number,
  echelon: [number, number, number],
  rowWidth: number,
  guns: number,
  cavalry: number,
): WingState {
  const formationWidth = 3 * rowWidth;
  const front = Math.min(total * echelon[0], formationWidth);
  const middle = Math.min(total * echelon[1], formationWidth);
  const rear = Math.max(0, total - front - middle);
  return { front, middle, rear, guns, cavalry };
}

/** 默认将领命令：全部自动 / 固守 / 慢速投入 */
function createDefaultOrders(): CommanderOrders {
  const side = (): SideOrders => ({
    wings: [0, 1, 2].map(() => ({
      target: "auto",
      reinforce: "hold",
      retreat: "hold",
    })),
    batteries: [0, 1, 2].map(() => ({
      target: "auto",
      counterBattery: "auto",
    })),
    rearSpeed: "slow",
  });
  return { red: side(), blue: side() };
}

/**
 * 战斗模拟核心（三翼独立战斗 + 前/中/后三梯队 + 按翼部署的火炮）。
 *
 * - 前排 = 最前面三排，唯一开火的梯队（每翼 ≤ 战场宽度）；
 * - 中排紧贴前排，瞬间补位（同一轮内补齐前排缺额）；
 * - 后排为纵深预备队，按“后排支援速度”慢速前移；
 * - 前 + 中合计每翼不超过战场宽度（全翼合计 ≤ 3 × 战场宽度）；
 * - 火炮部署在指定翼后方：翼存活时受保护，翼被歼后暴露；
 *   火炮之间可以互相攻击（反炮），面杀伤正比于敌翼（前+中）厚度，
 *   对后排（掩体内）伤害衰减。
 */
export class Simulation {
  readonly config: BattleConfig;
  /** 将领决策：战斗中可实时修改，立即生效 */
  readonly orders: CommanderOrders;
  readonly redWings: WingState[];
  readonly blueWings: WingState[];
  readonly redWingFrontInitial: number[];
  readonly blueWingFrontInitial: number[];
  readonly redWingMiddleInitial: number[];
  readonly blueWingMiddleInitial: number[];
  readonly redWingRearInitial: number[];
  readonly blueWingRearInitial: number[];
  readonly redWingInitial: number[];
  readonly blueWingInitial: number[];

  time = 0;
  status: BattleStatus = "ready";
  winner: Winner = null;
  readonly history: HistoryPoint[] = [];
  /** 模拟轮次计数：每 step 一次，用于逐点箭头的确定性随机 */
  private tick = 0;
  /** 前排命中点槽位：每翼一列，直瞄火力按点逐个结算 */
  private redSlots: FrontSlotState[] = [];
  private blueSlots: FrontSlotState[] = [];
  private redFrontSlotCap: number[] = [];
  private blueFrontSlotCap: number[] = [];
  /** 击杀统计（按翼 / 兵种），战斗中实时累计 */
  readonly killStats: KillStats;
  /** 按整回合缓存的攻击分配，避免每帧重复计算 */
  private assignmentCachePlan = -1;
  private assignmentCacheStep = -1;
  private fireAssignmentsCache: FireAssignment[] = [];
  private gunAssignmentsCache: GunAssignment[] = [];
  /** 上一回合实际造成击杀的攻击线（渲染为实线击杀线） */
  private soldierKillLines: FireAssignment[] = [];
  private artilleryKillLines: GunAssignment[] = [];
  /** 近若干回合被击毙的士兵点（渲染红叉标记） */
  private killedDotHistory: Array<{ dot: DotRef; tick: number }> = [];
  /** 近若干回合被摧毁的火炮图标（渲染红叉标记） */
  private killedBatteryHistory: Array<BatteryMarkRef & { tick: number }> = [];
  /** 骑兵单元状态机：每翼一列，按翼配置数量初始化 */
  private cavalryUnits: {
    red: CavalryUnitState[][];
    blue: CavalryUnitState[][];
  } = { red: [[], [], []], blue: [[], [], []] };
  /** 近若干回合被消灭的骑兵图标（渲染红叉标记） */
  private killedCavalryHistory: Array<CavalryMarkRef & { tick: number }> = [];
  /** 各翼累计伤亡人数（用于组织度计算） */
  private casualties: { red: number[]; blue: number[] } = {
    red: [0, 0, 0],
    blue: [0, 0, 0],
  };
  /** 各翼当前士气（初始来自配置，战斗中动态波动） */
  private morale: { red: number[]; blue: number[] } = {
    red: [1, 1, 1],
    blue: [1, 1, 1],
  };
  /** 本回合各翼伤亡 / 击杀数（用于士气波动） */
  private tickCasualties: { red: number[]; blue: number[] } = {
    red: [0, 0, 0],
    blue: [0, 0, 0],
  };
  private tickKills: { red: number[]; blue: number[] } = {
    red: [0, 0, 0],
    blue: [0, 0, 0],
  };
  /** 溃退剩余回合数（0 = 未溃退） */
  private routTicks: { red: number[]; blue: number[] } = {
    red: [0, 0, 0],
    blue: [0, 0, 0],
  };
  /** 离场类型：rout 溃退 / retreat 有组织撤退 / null 未离场 */
  private retreatKind: {
    red: Array<"rout" | "retreat" | null>;
    blue: Array<"rout" | "retreat" | null>;
  } = {
    red: [null, null, null],
    blue: [null, null, null],
  };
  /** 各翼最终状态 */
  private outcomes: { red: WingOutcome[]; blue: WingOutcome[] } = {
    red: ["alive", "alive", "alive"],
    blue: ["alive", "alive", "alive"],
  };

  constructor(config: BattleConfig) {
    this.config = { ...config };
    this.orders = createDefaultOrders();

    const redEchelon = normalizeEchelon(config.redEchelon);
    const blueEchelon = normalizeEchelon(config.blueEchelon);
    const redWeights = deployWeights(config.redDeploy);
    const blueWeights = deployWeights(config.blueDeploy);
    this.redWingInitial = redWeights.map((w) => config.redInitial * w);
    this.blueWingInitial = blueWeights.map((w) => config.blueInitial * w);

    this.redWings = this.redWingInitial.map(
      (total, i) =>
        initWing(
          total,
          redEchelon,
          config.rowWidth,
          config.redArtillery[i] ?? 0,
          (config.redCavalry ?? [])[i] ?? 0,
        ),
    );
    this.blueWings = this.blueWingInitial.map(
      (total, i) =>
        initWing(
          total,
          blueEchelon,
          config.rowWidth,
          config.blueArtillery[i] ?? 0,
          (config.blueCavalry ?? [])[i] ?? 0,
        ),
    );

    this.redWingFrontInitial = this.redWings.map((w) => w.front);
    this.blueWingFrontInitial = this.blueWings.map((w) => w.front);
    this.redWingMiddleInitial = this.redWings.map((w) => w.middle);
    this.blueWingMiddleInitial = this.blueWings.map((w) => w.middle);
    this.redWingRearInitial = this.redWings.map((w) => w.rear);
    this.blueWingRearInitial = this.blueWings.map((w) => w.rear);

    // 前排离散化为命中点：每个点代表一个火力单元（多名士兵），点数取初始前排的单元数
    const initSlots = (
      wings: WingState[],
      frontInitial: number[],
    ): FrontSlotState[] =>
      wings.map((_wing, i) => {
        const perDot = soldiersPerDot(i);
        const units = Math.max(0, Math.ceil(frontInitial[i] / perDot));
        return {
          alive: Array.from({ length: units }, () => true),
        };
      });
    this.redSlots = initSlots(this.redWings, this.redWingFrontInitial);
    this.blueSlots = initSlots(this.blueWings, this.blueWingFrontInitial);
    // 前排士兵口径上限 = 初始前排人数（clamp 与补位都按士兵计，单元仅作命中粒度）
    this.redFrontSlotCap = [...this.redWingFrontInitial];
    this.blueFrontSlotCap = [...this.blueWingFrontInitial];
    // 骑兵状态机：所有单元从满蓄力开始（同步首轮冲锋）
    let cavalryId = 0;
    const initCavalry = (counts: number[]): CavalryUnitState[][] =>
      [0, 1, 2].map((i) =>
        Array.from(
          { length: Math.max(0, Math.round(counts[i] ?? 0)) },
          () => ({
            id: cavalryId++,
            chargeTicks: CAVALRY_CHARGE_TICKS,
            attacking: false,
            attackTicks: 0,
            target: null,
          }),
        ),
      );
    this.cavalryUnits = {
      red: initCavalry(config.redCavalry ?? []),
      blue: initCavalry(config.blueCavalry ?? []),
    };
    this.killStats = {
      red: [0, 1, 2].map(() => ({ infantry: 0, artillery: 0 })),
      blue: [0, 1, 2].map(() => ({ infantry: 0, artillery: 0 })),
    };
    this.morale = {
      red: [0, 1, 2].map(() => config.redMorale),
      blue: [0, 1, 2].map(() => config.blueMorale),
    };
    this.history.push(this.snapshot());
  }

  get redFront(): number {
    return sumWings(this.redWings, (w) => w.front);
  }

  get redMiddle(): number {
    return sumWings(this.redWings, (w) => w.middle);
  }

  get redRear(): number {
    return sumWings(this.redWings, (w) => w.rear);
  }

  get blueFront(): number {
    return sumWings(this.blueWings, (w) => w.front);
  }

  get blueMiddle(): number {
    return sumWings(this.blueWings, (w) => w.middle);
  }

  get blueRear(): number {
    return sumWings(this.blueWings, (w) => w.rear);
  }

  get redTotal(): number {
    return this.redFront + this.redMiddle + this.redRear;
  }

  get blueTotal(): number {
    return this.blueFront + this.blueMiddle + this.blueRear;
  }

  get redFrontInitial(): number {
    return this.redWingFrontInitial.reduce((total, value) => total + value, 0);
  }

  get blueFrontInitial(): number {
    return this.blueWingFrontInitial.reduce((total, value) => total + value, 0);
  }

  start(): void {
    if (this.status !== "finished") {
      this.status = "running";
    }
  }

  pause(): void {
    if (this.status === "running") {
      this.status = "paused";
    }
  }

  step(dtTicks: number): void {
    if (this.status !== "running") return;

    const dt = Math.min(dtTicks, MAX_STEP_TICKS);
    const noise = this.buildNoise();
    this.soldierKillLines = [];
    this.artilleryKillLines = [];
    this.tickCasualties = { red: [0, 0, 0], blue: [0, 0, 0] };
    this.tickKills = { red: [0, 0, 0], blue: [0, 0, 0] };
    // 红叉按回合保留：只保留最近 KILL_MARK_TICKS 回合的击杀
    this.killedDotHistory = this.killedDotHistory.filter(
      (entry) => entry.tick > this.tick - KILL_MARK_TICKS,
    );
    this.killedBatteryHistory = this.killedBatteryHistory.filter(
      (entry) => entry.tick > this.tick - KILL_MARK_TICKS,
    );
    this.killedCavalryHistory = this.killedCavalryHistory.filter(
      (entry) => entry.tick > this.tick - KILL_MARK_TICKS,
    );
    const next = this.integrate(this.toState(), dt);
    this.applyState(next);
    this.settleDirectFire(dt, noise);
    this.settleArtillery(dt, noise);
    this.settleCavalry(dt, noise);
    this.refillFrontSlots();
    this.updateRoutStates();
    this.updateMorale();
    this.time += dt;
    this.history.push(this.snapshot());
    this.tick++;

    const redAlive = this.countAliveWings("red");
    const blueAlive = this.countAliveWings("blue");
    if (redAlive === 0 || blueAlive === 0) {
      if (redAlive === 0) this.zeroWings("red");
      if (blueAlive === 0) this.zeroWings("blue");
      this.status = "finished";
      this.winner =
        redAlive === 0 && blueAlive === 0
          ? "draw"
          : redAlive === 0
            ? "blue"
            : "red";
    }
  }

  /** 当前状态下本翼的直瞄火力目标（供战场显示射击箭头） */
  fireTargets(side: "red" | "blue", wingIndex: number): number[] {
    const state = this.toState();
    const enemyBase = side === "red" ? 12 : 0;
    const sectorEnemyAlive = this.isAlive(
      state[enemyBase + wingIndex * 4 + FIELD_FRONT],
      state[enemyBase + wingIndex * 4 + FIELD_MIDDLE],
      state[enemyBase + wingIndex * 4 + FIELD_REAR],
      this.wingInitial(side === "red" ? "blue" : "red", wingIndex),
    );
    const targets = this.fireTargetsFromState(
      side,
      wingIndex,
      state,
      sectorEnemyAlive,
    );
    // 将领目标覆盖同样作用于显示
    const order = this.orders[side].wings[wingIndex];
    if (order.target !== "auto") {
      const ordered = order.target as number;
      if (
        !sectorEnemyAlive &&
        this.isAlive(
          state[enemyBase + ordered * 4 + FIELD_FRONT],
          state[enemyBase + ordered * 4 + FIELD_MIDDLE],
          state[enemyBase + ordered * 4 + FIELD_REAR],
          this.wingInitial(side === "red" ? "blue" : "red", ordered),
        )
      ) {
        return [ordered];
      }
    }
    return targets;
  }

  /** 指定翼是否仍具备战斗力（用于界面限制打击目标选择） */
  isWingAlive(side: "red" | "blue", wingIndex: number): boolean {
    const wings = side === "red" ? this.redWings : this.blueWings;
    const initial =
      side === "red" ? this.redWingInitial : this.blueWingInitial;
    const wing = wings[wingIndex];
    return this.isAlive(
      wing.front,
      wing.middle,
      wing.rear,
      initial[wingIndex],
    );
  }

  /** 指定翼当前组织度（0~1；默认士气下伤亡 30% 归零） */
  getOrganization(side: "red" | "blue", wingIndex: number): number {
    const initial = (side === "red" ? this.redWingInitial : this.blueWingInitial)[
      wingIndex
    ];
    const morale = this.morale[side][wingIndex];
    const lossRatio =
      this.casualties[side][wingIndex] / Math.max(1, initial);
    return clamp(1 - lossRatio / (ORG_BREAK_LOSS * morale), 0, 1);
  }

  /** 当前士气（初始来自配置，战斗中动态波动） */
  getMorale(side: "red" | "blue", wingIndex: number): number {
    return this.morale[side][wingIndex];
  }

  /** 是否处于溃退状态（无法攻击、只能被击杀） */
  isRouting(side: "red" | "blue", wingIndex: number): boolean {
    return this.routTicks[side][wingIndex] > 0;
  }

  /** 是否处于有序撤退状态（比溃退更少被杀伤） */
  isRetreating(side: "red" | "blue", wingIndex: number): boolean {
    return (
      this.routTicks[side][wingIndex] > 0 &&
      this.retreatKind[side][wingIndex] === "retreat"
    );
  }

  /** 是否处于溃退状态（无序溃逃，被追杀大量减员） */
  isRouted(side: "red" | "blue", wingIndex: number): boolean {
    return (
      this.routTicks[side][wingIndex] > 0 &&
      this.retreatKind[side][wingIndex] === "rout"
    );
  }

  /** 溃退剩余回合数（0 = 未溃退） */
  getRoutTicksRemaining(side: "red" | "blue", wingIndex: number): number {
    return this.routTicks[side][wingIndex];
  }

  /** 翼的最终状态：存活 / 溃退中 / 逃生成功 / 溃退中被歼 */
  getWingOutcome(side: "red" | "blue", wingIndex: number): WingOutcome {
    return this.outcomes[side][wingIndex];
  }

  /** 目标翼的离场杀伤倍率：溃退 2 倍、有序撤退 0.5 倍、正常 1 倍 */
  private targetKillMult(side: "red" | "blue", wingIndex: number): number {
    const kind = this.retreatKind[side][wingIndex];
    if (kind === "retreat") return RETREAT_TARGET_KILL_MULT;
    if (kind === "rout") return ROUT_TARGET_KILL_MULT;
    return 1;
  }

  /** 本翼火炮的当前射击目标（供战场显示火炮箭头） */
  artilleryTargets(side: "red" | "blue", wingIndex: number): ArtilleryTargets {
    const enemyWings = side === "red" ? this.blueWings : this.redWings;
    const enemyInitial =
      side === "red" ? this.blueWingInitial : this.redWingInitial;
    const enemy = enemyWings[wingIndex];
    const enemyAlive = this.isAlive(
      enemy.front,
      enemy.middle,
      enemy.rear,
      enemyInitial[wingIndex],
    );
    const batteryOrder = this.orders[side].batteries[wingIndex];
    const counterOn =
      batteryOrder.counterBattery === "off"
        ? false
        : batteryOrder.counterBattery === "on" || enemy.guns > 0;
    return {
      counterBattery: counterOn && enemy.guns > 0,
      formations: enemyAlive
        ? [wingIndex]
        : [0, 1, 2].filter(
            (j) =>
              j !== wingIndex &&
              this.isAlive(
                enemyWings[j].front,
                enemyWings[j].middle,
                enemyWings[j].rear,
                enemyInitial[j],
              ),
          ),
    };
  }

  /** 敌方对应翼已被歼灭且其火炮暴露时，本翼士兵可以攻击火炮 */
  canAttackEnemyBattery(side: "red" | "blue", wingIndex: number): boolean {
    const enemyWings = side === "red" ? this.blueWings : this.redWings;
    const enemyInitial =
      side === "red" ? this.blueWingInitial : this.redWingInitial;
    const enemy = enemyWings[wingIndex];
    return (
      !this.isAlive(
        enemy.front,
        enemy.middle,
        enemy.rear,
        enemyInitial[wingIndex],
      ) && enemy.guns > 0
    );
  }

  /** 某翼阵型中指定梯队的所有士兵点（与绘制端同一布局） */
  private echelonDots(
    side: "red" | "blue",
    wing: number,
    echelon: FormationRow["echelon"],
  ): DotRef[] {
    const w = side === "red" ? this.redWings[wing] : this.blueWings[wing];
    const dots: DotRef[] = [];
    for (const row of formationRows(
      w.front,
      w.middle,
      w.rear,
      wing,
      this.config.rowWidth,
    )) {
      if (row.echelon !== echelon) continue;
      for (let c = 0; c < row.count; c++) {
        dots.push({ side, wing, row: row.row, col: c });
      }
    }
    return dots;
  }

  /** 某翼阵型中所有前三排士兵点 */
  private frontDots(side: "red" | "blue", wing: number): DotRef[] {
    return this.echelonDots(side, wing, "front");
  }

  /** 某翼当前可被攻击的士兵点：前排优先，其次中排，最后后排 */
  private attackableDots(side: "red" | "blue", wing: number): DotRef[] {
    const front = this.frontDots(side, wing);
    if (front.length > 0) return front;
    const middle = this.echelonDots(side, wing, "middle");
    if (middle.length > 0) return middle;
    return this.echelonDots(side, wing, "rear");
  }

  /**
   * 当前轮次各前排士兵点的攻击对象：当面敌翼存活时只能打当面；
   * 当面翼被歼后可打其余敌翼可攻击点（前三排 → 中排 → 后排），
   * 也可攻击暴露的敌火炮。
   */
  getFireAssignments(): FireAssignment[] {
    const planTick = Math.floor(this.time);
    this.ensureAssignmentsCached(planTick);
    return this.fireAssignmentsCache;
  }

  /** 将领命令变化后调用，使攻击分配缓存失效（暂停时也能立即反映） */
  invalidateAssignments(): void {
    this.assignmentCachePlan = -1;
  }

  /** 上一回合士兵实际击毙目标造成的攻击线（实线击杀线） */
  getSoldierKillLines(): FireAssignment[] {
    return this.soldierKillLines;
  }

  /** 上一回合火炮实际击毙目标造成的攻击线（实线击杀线） */
  getArtilleryKillLines(): GunAssignment[] {
    return this.artilleryKillLines;
  }

  /** 近若干回合被击毙的士兵点（渲染红叉） */
  getKilledDots(): DotRef[] {
    return this.killedDotHistory.map((entry) => entry.dot);
  }

  /** 近若干回合被摧毁的火炮图标（渲染红叉） */
  getKilledBatteryIcons(): BatteryMarkRef[] {
    return this.killedBatteryHistory.map(({ side, wing, icon, count }) => ({
      side,
      wing,
      icon,
      count,
    }));
  }

  /** 当前处于冲锋状态、等待结算的骑兵单元（渲染箭头与高亮） */
  getCavalryCharges(): CavalryChargeRef[] {
    const charges: CavalryChargeRef[] = [];
    for (const side of ["red", "blue"] as const) {
      for (let i = 0; i < WING_COUNT; i++) {
        this.cavalryUnits[side][i].forEach((unit, unitIndex) => {
          if (unit.attacking && unit.target) {
            charges.push({ side, wing: i, unitIndex, target: unit.target });
          }
        });
      }
    }
    return charges;
  }

  /** 近若干回合被消灭的骑兵图标（渲染红叉） */
  getKilledCavalryIcons(): CavalryMarkRef[] {
    return this.killedCavalryHistory.map(({ side, wing, icon, count }) => ({
      side,
      wing,
      icon,
      count,
    }));
  }

  /** 骑兵蓄力进度（0~1，供渲染端显示准备状态）：所有单元同步蓄力，取平均值 */
  getCavalryProgress(side: "red" | "blue", wingIndex: number): number {
    const units = this.cavalryUnits[side][wingIndex];
    if (units.length === 0) return 0;
    let sum = 0;
    for (const unit of units) {
      sum += unit.attacking
        ? 1
        : 1 - unit.chargeTicks / CAVALRY_CHARGE_TICKS;
    }
    return sum / units.length;
  }

  /** 每个整回合只计算一次攻击分配（显示与结算共用同一份） */
  private ensureAssignmentsCached(planTick: number): void {
    if (
      this.assignmentCachePlan === planTick &&
      this.assignmentCacheStep === this.tick
    ) {
      return;
    }
    this.computeFireAssignments(planTick);
    this.computeGunAssignments(planTick);
    this.assignmentCachePlan = planTick;
    this.assignmentCacheStep = this.tick;
  }

  private computeFireAssignments(planTick: number): void {
    const assignments: FireAssignment[] = [];
    // 按完整回合数取种子：低速时同一回合内箭头保持稳定（慢放可见）
    for (const side of ["red", "blue"] as const) {
      const enemySide = side === "red" ? "blue" : "red";
      for (let i = 0; i < WING_COUNT; i++) {
        if (this.isRouting(side, i)) continue;
        const attackers = this.frontDots(side, i);
        if (attackers.length === 0) continue;

        const rng = mulberry32(
          planTick * 1009 + (side === "red" ? 100 : 200) + i * 17,
        );
        const targetWings = this.fireTargets(side, i);
        const candidates = targetWings.flatMap((j) =>
          this.attackableDots(enemySide, j),
        );
        const battery = this.canAttackEnemyBattery(side, i);
        const enemyGuns =
          (enemySide === "red" ? this.redWings : this.blueWings)[i].guns;
        const batteryIcons = gunIconCount(enemyGuns);

        for (let k = 0; k < attackers.length; k++) {
          // 射击节奏：每个火力单元每 FIRE_INTERVAL 回合射击一次（千回合约 70 发）
          if ((planTick + k) % FIRE_INTERVAL !== 0) continue;
          let target: AttackTarget | null = null;
          const toBattery =
            battery && (k % 4 === 0 || candidates.length === 0);
          if (toBattery) {
            target = {
              kind: "battery",
              side: enemySide,
              wing: i,
              icon: Math.floor(rng() * batteryIcons),
            };
          } else if (candidates.length > 0) {
            target = {
              kind: "dot",
              dot: candidates[Math.floor(rng() * candidates.length)],
            };
          }
          if (target) assignments.push({ source: attackers[k], target });
        }
      }
    }
    this.fireAssignmentsCache = assignments;
  }

  /**
   * 当前轮次各门火炮的攻击对象：反炮时部分火炮打敌方火炮，
   * 其余火炮打敌方存活翼的前三排任意一点。
   */
  getGunAssignments(): GunAssignment[] {
    const planTick = Math.floor(this.time);
    this.ensureAssignmentsCached(planTick);
    return this.gunAssignmentsCache;
  }

  private computeGunAssignments(planTick: number): void {
    const assignments: GunAssignment[] = [];
    for (const side of ["red", "blue"] as const) {
      const enemySide = side === "red" ? "blue" : "red";
      for (let i = 0; i < WING_COUNT; i++) {
        if (this.isRouting(side, i)) continue;
        const guns = (side === "red" ? this.redWings : this.blueWings)[i].guns;
        if (guns <= 0) continue;

        const icons = gunIconCount(guns);
        const rng = mulberry32(
          planTick * 2039 + (side === "red" ? 300 : 400) + i * 29,
        );
        const targets = this.artilleryTargets(side, i);
        // 敌翼前排打光时依次改瞄中排、后排，攻击线继续显示
        const candidates = targets.formations.flatMap((j) =>
          this.attackableDots(enemySide, j),
        );
        let counterIcons = targets.counterBattery
          ? Math.ceil(icons / 2)
          : 0;
        // 单个图标的小炮位：反炮与压制交替进行，避免“只反炮不压制”
        if (icons === 1 && targets.counterBattery && candidates.length > 0) {
          counterIcons = planTick % 2 === 0 ? 1 : 0;
        }
        const enemyGuns =
          (enemySide === "red" ? this.redWings : this.blueWings)[i].guns;
        const enemyIcons = gunIconCount(enemyGuns);

        for (let icon = 0; icon < icons; icon++) {
          let target: AttackTarget | null = null;
          if (icon < counterIcons && enemyIcons > 0) {
            target = {
              kind: "battery",
              side: enemySide,
              wing: i,
              icon: Math.floor(rng() * enemyIcons),
            };
          } else if (candidates.length > 0) {
            target = {
              kind: "dot",
              dot: candidates[Math.floor(rng() * candidates.length)],
            };
          }
          if (target) assignments.push({ side, wing: i, icon, target });
        }
      }
    }
    this.gunAssignmentsCache = assignments;
  }

  /** 火炮图标数跨过阈值后，把新消失的图标记入红叉历史 */
  private recordBatteryIconLoss(
    side: "red" | "blue",
    wing: number,
    beforeIcons: number,
    afterIcons: number,
  ): void {
    for (let icon = afterIcons; icon < beforeIcons; icon++) {
      this.killedBatteryHistory.push({
        side,
        wing,
        icon,
        count: beforeIcons,
        tick: this.tick,
      });
    }
  }

  /**
   * 直瞄火力逐点结算：每一个前排士兵点向自己的攻击对象射击，
   * 单发命中按概率击毙目标点（概率 = 单位火力 × 步长），
   * 伤亡从第一轮起连续流动，聚合速率与原连续模型一致。
   */
  private settleDirectFire(dt: number, noise: Noise): void {
    const killRng: Record<"red" | "blue", Array<() => number>> = {
      red: [0, 1, 2].map((i) =>
        mulberry32(this.tick * 4099 + 100 + i * 31),
      ),
      blue: [0, 1, 2].map((i) =>
        mulberry32(this.tick * 4099 + 200 + i * 31),
      ),
    };
    for (const assignment of this.getFireAssignments()) {
      const source = assignment.source;
      const noiseVal = (source.side === "red" ? noise.red : noise.blue)[
        source.wing
      ];
      const coeff =
        source.side === "red"
          ? this.config.redEfficiency
          : this.config.blueEfficiency;
      const targetMult =
        assignment.target.kind === "dot"
          ? this.targetKillMult(
              assignment.target.dot.side,
              assignment.target.dot.wing,
            )
          : 1;
      // 单发威力按射击间隔补偿：每点射击频率降为 1/间隔，但每发歼灭一个单元，
      // 单元规模因子在「射击次数 × 单元人数」中相互抵消，聚合杀伤率与原模型一致
      const killChance =
        coeff *
        noiseVal *
        dt *
        this.config.damageScale *
        targetMult *
        FIRE_INTERVAL;

      if (assignment.target.kind === "battery") {
        const enemyWings =
          assignment.target.side === "red" ? this.redWings : this.blueWings;
        const enemy = enemyWings[assignment.target.wing];
        const beforeIcons = gunIconCount(enemy.guns);
        // 每个攻击点逐发摧毁火炮：伤害 = 摧毁系数 × 扰动 × 步长 × 伤害倍率
        // （不再乘直瞄火力系数，否则会被额外缩小约 25 倍）
        const gunLoss = Math.min(
          enemy.guns,
          GUN_KILL_COEFF * noiseVal * dt * this.config.damageScale,
        );
        enemy.guns -= gunLoss;
        const afterIcons = enemy.guns <= 0 ? 0 : gunIconCount(enemy.guns);
        this.recordBatteryIconLoss(
          assignment.target.side,
          assignment.target.wing,
          beforeIcons,
          afterIcons,
        );
        this.killStats[source.side][source.wing].infantry += gunLoss;
      } else {
        const killed = this.tryKillDot(
          assignment.target.dot,
          killChance,
          killRng[source.side][source.wing],
          source.side,
          source.wing,
          "infantry",
        );
        if (killed) this.soldierKillLines.push(assignment);
      }
    }
  }

  /**
   * 火炮逐门结算：反炮火炮摧毁敌方火炮，压制火炮对其目标前排点按概率击毙，
   * 溅射到中排正常、后排（掩体内）衰减。
   */
  private settleArtillery(dt: number, noise: Noise): void {
    const killRng: Record<"red" | "blue", Array<() => number>> = {
      red: [0, 1, 2].map((i) =>
        mulberry32(this.tick * 4099 + 300 + i * 41),
      ),
      blue: [0, 1, 2].map((i) =>
        mulberry32(this.tick * 4099 + 400 + i * 41),
      ),
    };
    for (const assignment of this.getGunAssignments()) {
      const wings =
        assignment.side === "red" ? this.redWings : this.blueWings;
      const guns = wings[assignment.wing].guns;
      if (guns <= 0) continue;
      const icons = gunIconCount(guns);
      const perGun = guns / icons;
      const noiseVal = (
        assignment.side === "red" ? noise.redBattery : noise.blueBattery
      )[assignment.wing];

      if (assignment.target.kind === "battery") {
        const enemyWings =
          assignment.target.side === "red" ? this.redWings : this.blueWings;
        const enemy = enemyWings[assignment.target.wing];
        const beforeIcons = gunIconCount(enemy.guns);
        const gunLoss = Math.min(
          enemy.guns,
          perGun *
            COUNTER_COEFF *
            noiseVal *
            dt *
            this.config.damageScale *
            ARTILLERY_DAMAGE_MULT,
        );
        enemy.guns -= gunLoss;
        const afterIcons = enemy.guns <= 0 ? 0 : gunIconCount(enemy.guns);
        this.recordBatteryIconLoss(
          assignment.target.side,
          assignment.target.wing,
          beforeIcons,
          afterIcons,
        );
        this.killStats[assignment.side][assignment.wing].artillery += gunLoss;
        continue;
      }

      const dot = assignment.target.dot;
      const targetMult = this.targetKillMult(dot.side, dot.wing);
      const enemyWings = dot.side === "red" ? this.redWings : this.blueWings;
      const target = enemyWings[dot.wing];
      const total = target.front + target.middle + target.rear;
      if (total <= 0) continue;
      // 阵型厚度：前+中兵力 ÷ 每排宽度（新口径下每排长度 = 战场宽度，厚度最多 3 排）
      const depth = (target.front + target.middle) / this.config.rowWidth;
      const damage =
        perGun *
        ARTILLERY_COEFF *
        depth *
        noiseVal *
        dt *
        this.config.damageScale *
        ARTILLERY_DAMAGE_MULT *
        targetMult;
      // 面杀伤按前排占比折算为对目标点的击毙概率：
      // 概率 = 前排应受伤害（人）÷ 每点人数（一个点代表 25/19 人），
      // 与中排/后排直接按人扣减保持同一聚合口径
      const frontKillChance =
        (damage * (target.front / total)) / soldiersPerDot(dot.wing);
      const killed = this.tryKillDot(
        dot,
        Math.min(1, frontKillChance),
        killRng[assignment.side][assignment.wing],
        assignment.side,
        assignment.wing,
        "artillery",
      );
      if (killed) this.artilleryKillLines.push(assignment);
      let loss = 0;
      if (target.middle > 0) {
        const middleLoss = Math.min(
          target.middle,
          damage * (target.middle / total),
        );
        target.middle -= middleLoss;
        loss += middleLoss;
      }
      if (target.rear > 0) {
        const rearLoss = Math.min(
          target.rear,
          damage * (target.rear / total) * ARTILLERY_REAR_COVER,
        );
        target.rear -= rearLoss;
        loss += rearLoss;
      }
      this.killStats[assignment.side][assignment.wing].artillery += loss;
      this.casualties[dot.side][dot.wing] += loss;
      this.tickCasualties[dot.side][dot.wing] += loss;
    }
  }

  /**
   * 骑兵状态机：准备状态蓄力（不受伤害），蓄满后进入冲锋；
   * 冲锋时每个骑兵单元与目标做一次对决：成功则击杀目标单元、自身无损，
   * 失败则自身阵亡一个单元、目标无损，随后回到准备状态重新蓄力。
   */
  private settleCavalry(dt: number, noise: Noise): void {
    // 少量对决用全战场共享的随机流：避免红蓝各自种子在小样本下产生系统性偏差
    const duelRng = mulberry32(this.tick * 7331 + 500);
    for (const side of ["red", "blue"] as const) {
      for (let i = 0; i < WING_COUNT; i++) {
        // 溃退/撤退中的翼不会主动冲锋
        if (this.isRouting(side, i)) continue;
        const wing = (side === "red" ? this.redWings : this.blueWings)[i];
        const units = this.cavalryUnits[side][i];
        // 数量同步：对决失败后截断多余状态
        while (units.length > Math.max(0, wing.cavalry)) units.pop();
        if (wing.cavalry <= 0) continue;

        let idx = 0;
        while (idx < units.length) {
          const unit = units[idx];
          if (unit.attacking) {
            // 冲锋状态保留数回合再结算，让攻击动画清晰可见
            unit.attackTicks -= dt;
            if (unit.attackTicks > 0) {
              idx++;
              continue;
            }
            this.resolveCavalryDuel(side, i, idx, unit, noise, duelRng);
            if (unit.attacking) {
              // 阵亡：单元已被移除，idx 保持原位继续下一个
              continue;
            }
            // 对决结束且存活：回到准备状态重新蓄力
            unit.chargeTicks = CAVALRY_CHARGE_TICKS;
            unit.target = null;
            idx++;
          } else {
            unit.chargeTicks -= dt;
            if (unit.chargeTicks <= 0) {
              // 蓄满：进入冲锋状态并锁定目标（保留 3 回合冲锋动画后结算）
              unit.attacking = true;
              unit.attackTicks = CAVALRY_ATTACK_TICKS;
              unit.target = this.pickCavalryTarget(side, i, unit);
            }
            idx++;
          }
        }
      }
    }
  }

  /** 骑兵冲锋候选目标：当面敌翼优先，翼灭后按侧击规则转移 */
  private cavalryTargetCandidates(
    side: "red" | "blue",
    wingIndex: number,
  ): DotRef[] {
    const enemySide = side === "red" ? "blue" : "red";
    const targetWings = this.fireTargets(side, wingIndex);
    return targetWings.flatMap((j) => this.attackableDots(enemySide, j));
  }

  /** 选择一个骑兵冲锋目标（渲染箭头与主目标用） */
  private pickCavalryTarget(
    side: "red" | "blue",
    wingIndex: number,
    unit: CavalryUnitState,
  ): DotRef | null {
    const candidates = this.cavalryTargetCandidates(side, wingIndex);
    if (candidates.length === 0) return null;
    const rng = mulberry32(
      this.tick * 6133 + (side === "red" ? 700 : 800) + wingIndex * 43 + unit.id * 97,
    );
    return candidates[Math.floor(rng() * candidates.length)];
  }

  /** 一次骑兵对决：成功必杀目标单元；失败则自身阵亡并记录红叉 */
  private resolveCavalryDuel(
    side: "red" | "blue",
    wingIndex: number,
    unitIndex: number,
    unit: CavalryUnitState,
    noise: Noise,
    duelRng: () => number,
  ): void {
    const wing = (side === "red" ? this.redWings : this.blueWings)[wingIndex];
    const candidates = this.cavalryTargetCandidates(side, wingIndex);
    // 没有可攻击目标：退回蓄力，不算对决失败（避免一直停留在冲锋状态）
    if (candidates.length === 0) {
      unit.attacking = false;
      return;
    }
    const target = unit.target ?? candidates[0];
    // 主目标可能随阵型变化失效：退回候选第一个
    const targetValid = candidates.some(
      (c) =>
        c.wing === target.wing && c.row === target.row && c.col === target.col,
    );
    const primary = targetValid ? target : candidates[0];
    const chance = CAVALRY_DUEL_CHANCE * noise[side][wingIndex];
    if (duelRng() < chance) {
      // 冲锋成功：多倍杀伤——主目标必杀，再补杀其余敌方火力单元，自身无损
      this.tryKillDot(primary, 1, () => 0, side, wingIndex, "infantry");
      let extra = CAVALRY_KILL_MULT - 1;
      for (const c of candidates) {
        if (extra <= 0) break;
        if (
          c.wing === primary.wing &&
          c.row === primary.row &&
          c.col === primary.col
        ) {
          continue;
        }
        if (this.tryKillDot(c, 1, () => 0, side, wingIndex, "infantry")) {
          extra--;
        }
      }
      unit.attacking = false;
    } else {
      // 对决失败：自身阵亡一个单元，目标无损失
      const beforeIcons = cavalryIconCount(wing.cavalry);
      wing.cavalry = Math.max(0, wing.cavalry - 1);
      const afterIcons = wing.cavalry <= 0 ? 0 : cavalryIconCount(wing.cavalry);
      for (let icon = afterIcons; icon < beforeIcons; icon++) {
        this.killedCavalryHistory.push({
          side,
          wing: wingIndex,
          icon,
          count: beforeIcons,
          tick: this.tick,
        });
      }
      this.cavalryUnits[side][wingIndex].splice(unitIndex, 1);
    }
  }

  /** 对指定敌士兵点结算一次命中：按概率击毙（确定性随机保证可复现），返回是否击毙 */
  private tryKillDot(
    dot: DotRef,
    probability: number,
    roll: () => number,
    attackerSide: "red" | "blue",
    attackerWing: number,
    type: "infantry" | "artillery",
  ): boolean {
    const wings = dot.side === "red" ? this.redWings : this.blueWings;
    const wing = wings[dot.wing];
    const rows = formationRows(
      wing.front,
      wing.middle,
      wing.rear,
      dot.wing,
      this.config.rowWidth,
    );
    const rowInfo = rows.find((r) => r.row === dot.row);
    if (!rowInfo || dot.col >= rowInfo.count) return false;
    const echelon = rowInfo.echelon;

    if (echelon === "middle" || echelon === "rear") {
      // 中排/后排按单元结算：命中后该梯队减少一个火力单元的兵力；
      // 末单元可能是余数，按实际剩余扣减，避免击杀统计虚高
      if (roll() >= probability) return false;
      const size = soldiersPerDot(dot.wing);
      const loss = Math.min(size, echelon === "middle" ? wing.middle : wing.rear);
      if (echelon === "middle") {
        wing.middle -= loss;
      } else {
        wing.rear -= loss;
      }
      this.killStats[attackerSide][attackerWing][type] += loss;
      this.casualties[dot.side][dot.wing] += loss;
      this.tickCasualties[dot.side][dot.wing] += loss;
      this.tickKills[attackerSide][attackerWing] += 1;
      this.killedDotHistory.push({ dot, tick: this.tick });
      return true;
    }

    if (wing.front <= 0) return false;
    const slots = dot.side === "red" ? this.redSlots : this.blueSlots;
    const state = slots[dot.wing];
    const rank = this.frontDotRank(dot.side, dot.wing, dot.row, dot.col);
    if (rank < 0) return false;

    let slotIndex = -1;
    let seen = 0;
    for (let s = 0; s < state.alive.length; s++) {
      if (!state.alive[s]) continue;
      if (seen === rank) {
        slotIndex = s;
        break;
      }
      seen++;
    }
    if (slotIndex < 0) return false;

    if (roll() < probability) {
      state.alive[slotIndex] = false;
      const size = this.slotSoldiers(dot.side, dot.wing, slotIndex);
      wing.front = Math.max(0, wing.front - size);
      this.killStats[attackerSide][attackerWing][type] += size;
      this.casualties[dot.side][dot.wing] += size;
      this.tickCasualties[dot.side][dot.wing] += size;
      this.tickKills[attackerSide][attackerWing] += 1;
      this.killedDotHistory.push({ dot, tick: this.tick });
      return true;
    }
    return false;
  }

  /** 前三排点（row, col）在阵型中的行优先序号 */
  private frontDotRank(
    side: "red" | "blue",
    wingIndex: number,
    row: number,
    col: number,
  ): number {
    const wing = (side === "red" ? this.redWings : this.blueWings)[wingIndex];
    const rows = formationRows(
      wing.front,
      wing.middle,
      wing.rear,
      wingIndex,
      this.config.rowWidth,
    ).filter((r) => r.echelon === "front");
    let rank = 0;
    for (const r of rows) {
      if (r.row === row) return rank + col;
      rank += r.count;
    }
    return -1;
  }

  private toState(): number[] {
    const state: number[] = [];
    for (const wings of [this.redWings, this.blueWings]) {
      for (const wing of wings) {
        state.push(wing.front, wing.middle, wing.rear, wing.guns);
      }
    }
    return state;
  }

  private applyState(state: number[]): void {
    for (let side = 0; side < 2; side++) {
      const wings = side === 0 ? this.redWings : this.blueWings;
      const middleInitial =
        side === 0 ? this.redWingMiddleInitial : this.blueWingMiddleInitial;
      const gunsInitial =
        side === 0 ? this.config.redArtillery : this.config.blueArtillery;
      for (let i = 0; i < WING_COUNT; i++) {
        const base = side * 12 + i * 4;
        wings[i].front = clamp(
          state[base + FIELD_FRONT],
          0,
          this.frontSlotCap(side === 0 ? "red" : "blue", i),
        );
        wings[i].middle = clamp(state[base + FIELD_MIDDLE], 0, middleInitial[i]);
        // 后排不设初始上限：翼间调度会把友翼后排增援进来（此前 clamp 会吞掉增援）
        wings[i].rear = Math.max(0, state[base + FIELD_REAR]);
        wings[i].guns = clamp(
          state[base + FIELD_GUNS],
          0,
          gunsInitial[i] ?? 0,
        );
      }
    }
  }

  /** 中排瞬间补位：把缺员的前排命中点补满（每个点消耗其对应的士兵数） */
  private refillFrontSlots(): void {
    for (const side of ["red", "blue"] as const) {
      const wings = side === "red" ? this.redWings : this.blueWings;
      const slots = side === "red" ? this.redSlots : this.blueSlots;
      for (let i = 0; i < WING_COUNT; i++) {
        if (this.isRouting(side, i)) continue;
        const wing = wings[i];
        const cap = this.frontSlotCap(side, i);
        const state = slots[i];
        while (wing.front < cap) {
          const idx = state.alive.findIndex((alive) => !alive);
          if (idx < 0) break;
          const size = this.slotSoldiers(side, i, idx);
          if (wing.middle < size) break;
          state.alive[idx] = true;
          wing.middle -= size;
          wing.front += size;
        }
      }
    }
  }

  /** 指定前排槽位代表的士兵数（最后一个槽位可能是不足整单元的余数） */
  private slotSoldiers(
    side: "red" | "blue",
    wingIndex: number,
    slotIndex: number,
  ): number {
    const initial = this.frontInitial(side, wingIndex);
    const perDot = soldiersPerDot(wingIndex);
    const units = Math.max(1, Math.ceil(initial / perDot));
    return slotIndex === units - 1 ? initial - (units - 1) * perDot : perDot;
  }

  /** 离场状态机：主动撤退命令触发有序撤退（低伤亡），组织度归零触发溃退（高伤亡）；
   *  两者期间都无法攻击、只能被击杀，倒计时结束离场，途中被全歼则战毁 */
  private updateRoutStates(): void {
    for (const side of ["red", "blue"] as const) {
      const wings = side === "red" ? this.redWings : this.blueWings;
      const slots = side === "red" ? this.redSlots : this.blueSlots;
      const wingInitial =
        side === "red" ? this.redWingInitial : this.blueWingInitial;
      for (let i = 0; i < WING_COUNT; i++) {
        // 已离场（逃逸/有序撤退/被歼）的翼不再改变状态
        const final = this.outcomes[side][i];
        if (final === "fled" || final === "retreated" || final === "destroyed") {
          continue;
        }
        const wing = wings[i];
        const total = wing.front + wing.middle + wing.rear;
        const totalRout = Math.max(1, wingInitial[i] * ROUT_RATIO);
        const remaining = this.routTicks[side][i];
        const kind = this.retreatKind[side][i];

        if (remaining > 0) {
          // 减员：溃退为追杀式大量减员，有序撤退减员显著更低
          this.applyRoutAttrition(side, i);
          // 减员后重新取总兵力，避免最后一批溃兵被判定为“逃逸”而非“溃败”
          const totalAfter = wing.front + wing.middle + wing.rear;
          if (totalAfter <= totalRout) {
            // 离场途中被全歼
            this.zeroWing(side, i, slots);
            this.outcomes[side][i] = "destroyed";
            this.routTicks[side][i] = 0;
            this.retreatKind[side][i] = null;
          } else if (remaining <= 1) {
            // 倒计时结束，离场成功
            this.zeroWing(side, i, slots);
            this.outcomes[side][i] = kind === "retreat" ? "retreated" : "fled";
            this.routTicks[side][i] = 0;
            this.retreatKind[side][i] = null;
          } else {
            this.routTicks[side][i] = remaining - 1;
          }
          continue;
        }

        // 将领下令主动撤退：立即开始有序撤退（无论组织度）
        const ordered =
          this.orders[side].wings[i].retreat === "retreat" && total > totalRout;
        if (ordered) {
          this.routTicks[side][i] = RETREAT_DURATION;
          this.retreatKind[side][i] = "retreat";
          this.outcomes[side][i] = "retreating";
          continue;
        }

        if (total <= totalRout) {
          this.zeroWing(side, i, slots);
          this.outcomes[side][i] = "destroyed";
        } else if (this.getOrganization(side, i) <= 0) {
          // 组织度归零 → 开始溃退
          this.routTicks[side][i] = ROUT_DURATION;
          this.retreatKind[side][i] = "rout";
          this.outcomes[side][i] = "routing";
        }
      }
    }
  }

  /** 离场减员：随机击毙一定比例兵力，击杀记在当面敌军头上 */
  private applyRoutAttrition(side: "red" | "blue", wingIndex: number): void {
    const wing = (side === "red" ? this.redWings : this.blueWings)[wingIndex];
    const total = wing.front + wing.middle + wing.rear;
    const kind = this.retreatKind[side][wingIndex];
    const rate =
      kind === "retreat" ? RETREAT_ATTRITION_RATE : ROUT_ATTRITION_RATE;
    // 按火力单元粒度折算：每杀一个点代表歼灭一个单元
    const kills = Math.floor(
      (total * rate) / soldiersPerDot(wingIndex),
    );
    if (kills <= 0) return;
    const rng = mulberry32(
      this.tick * 617 + (side === "red" ? 500 : 600) + wingIndex * 23,
    );
    const attackerSide = side === "red" ? "blue" : "red";
    for (let k = 0; k < kills; k++) {
      const dots = this.attackableDots(side, wingIndex);
      if (dots.length === 0) break;
      const dot = dots[Math.floor(rng() * dots.length)];
      // 概率 1 的必杀结算：走统一的击杀路径（红叉、击杀线、统计都生效）
      this.tryKillDot(dot, 1, () => 0, attackerSide, wingIndex, "infantry");
    }
  }

  /** 清空一个翼（溃退离场或被歼） */
  private zeroWing(
    side: "red" | "blue",
    wingIndex: number,
    slots: FrontSlotState[],
  ): void {
    const wings = side === "red" ? this.redWings : this.blueWings;
    const wing = wings[wingIndex];
    wing.front = 0;
    wing.middle = 0;
    wing.rear = 0;
    wing.guns = 0;
    wing.cavalry = 0;
    slots[wingIndex].alive.fill(false);
    this.cavalryUnits[side][wingIndex].length = 0;
  }

  private zeroWings(side: "red" | "blue"): void {
    const wings = side === "red" ? this.redWings : this.blueWings;
    const slots = side === "red" ? this.redSlots : this.blueSlots;
    wings.forEach((wing, i) => {
      wing.front = 0;
      wing.middle = 0;
      wing.rear = 0;
      wing.guns = 0;
      wing.cavalry = 0;
      slots[i].alive.fill(false);
      this.cavalryUnits[side][i].length = 0;
    });
  }

  private countAliveWings(side: "red" | "blue"): number {
    const wings = side === "red" ? this.redWings : this.blueWings;
    const initial = side === "red" ? this.redWingInitial : this.blueWingInitial;
    return wings.reduce(
      (count, wing, i) =>
        wing.front + wing.middle + wing.rear >
        Math.max(1, initial[i] * ROUT_RATIO)
          ? count + 1
          : count,
      0,
    );
  }

  /** 士气动态波动：伤亡压制、击杀提振、兵力比持续压力、随机扰动 */
  private updateMorale(): void {
    const r = this.config.randomness;
    for (const side of ["red", "blue"] as const) {
      const enemySide = side === "red" ? "blue" : "red";
      const ownTotal = this.sideTotal(side);
      const enemyTotal = this.sideTotal(enemySide);
      const ratio =
        (ownTotal - enemyTotal) / Math.max(1, ownTotal + enemyTotal);
      for (let i = 0; i < WING_COUNT; i++) {
        const initial = Math.max(1, this.wingInitial(side, i));
        const casRatio = this.tickCasualties[side][i] / initial;
        const killRatio = this.tickKills[side][i] / initial;
        const rand =
          r <= 0 ? 0 : (Math.random() * 2 - 1) * MORALE_RANDOM * (0.3 + r);
        const delta =
          -MORALE_CAS_COEFF * casRatio +
          MORALE_KILL_COEFF * killRatio +
          MORALE_RATIO_COEFF * ratio +
          rand;
        this.morale[side][i] = clamp(
          this.morale[side][i] + delta,
          MORALE_MIN,
          MORALE_MAX,
        );
      }
    }
  }

  private sideTotal(side: "red" | "blue"): number {
    return side === "red" ? this.redTotal : this.blueTotal;
  }

  private snapshot(): HistoryPoint {
    const wingSnapshot = (
      side: "red" | "blue",
      wings: WingState[],
    ): WingSnapshot[] =>
      wings.map((wing, i) => ({
        front: wing.front,
        middle: wing.middle,
        rear: wing.rear,
        guns: wing.guns,
        cavalry: wing.cavalry,
        org: this.getOrganization(side, i),
      }));
    return {
      time: this.time,
      redFront: this.redFront,
      redMiddle: this.redMiddle,
      redRear: this.redRear,
      blueFront: this.blueFront,
      blueMiddle: this.blueMiddle,
      blueRear: this.blueRear,
      redWings: wingSnapshot("red", this.redWings),
      blueWings: wingSnapshot("blue", this.blueWings),
    };
  }

  /** 每轮生成乘性扰动因子；随机性为 0 时全部为 1 */
  private buildNoise(): Noise {
    const r = this.config.randomness;
    const jitter = () => (r <= 0 ? 1 : 1 + r * (Math.random() * 2 - 1));
    return {
      red: [0, 1, 2].map(jitter),
      blue: [0, 1, 2].map(jitter),
      redBattery: [0, 1, 2].map(jitter),
      blueBattery: [0, 1, 2].map(jitter),
    };
  }

  /** 24 维状态：[红左F,红左M,红左R,红左G, ... 蓝左F,...] */
  private derivatives(state: number[]): number[] {
    const out = new Array<number>(STATE_SIZE).fill(0);
    const { rowWidth, rearFillRate } = this.config;

    for (let i = 0; i < WING_COUNT; i++) {
      this.wingDerivative(out, state, "red", i, {
        rowWidth,
        rearFillRate,
      });
      this.wingDerivative(out, state, "blue", i, {
        rowWidth,
        rearFillRate,
      });
    }
    return out;
  }

  /** 连续部分：后排→中排支援与翼间调度（直瞄火力与火炮改为逐点/逐门结算） */
  private wingDerivative(
    out: number[],
    state: number[],
    side: "red" | "blue",
    wingIndex: number,
    params: FireParams,
  ): void {
    const base = side === "red" ? 0 : 12;
    const fi = base + wingIndex * 4 + FIELD_FRONT;
    const mi = fi + 1;
    const ri = fi + 2;
    const front = state[fi];
    const rear = state[ri];
    const wingTotal = front + state[fi + 1] + rear;
    const wingInitial = this.wingInitial(side, wingIndex);

    if (wingTotal <= Math.max(1, wingInitial * ROUT_RATIO)) return;
    if (this.isRouting(side, wingIndex)) return;

    const wingOrder = this.orders[side].wings[wingIndex];

    // 后排慢速支援：先补中排，中排在 step 内逐点补入前排
    const frontInitial = this.frontInitial(side, wingIndex);
    const gap = Math.max(0, frontInitial - front);
    const rearSpeedMult = REAR_SPEED_MULT[this.orders[side].rearSpeed];
    const middleInitial =
      (side === "red" ? this.redWingMiddleInitial : this.blueWingMiddleInitial)[
        wingIndex
      ];
    const rearTransfer = Math.min(
      rear,
      params.rearFillRate * rearSpeedMult * gap,
      // 中排已满（或为 0）时不再从后排抽人，避免 applyState 截断导致兵力凭空消失
      Math.max(0, middleInitial - state[fi + 1]),
    );
    out[mi] += rearTransfer;
    out[ri] -= rearTransfer;

    // 翼间调度：按将领命令从本翼后排抽调兵力支援友翼
    if (wingOrder.reinforce !== "hold") {
      const targetWing = wingOrder.reinforce as number;
      if (
        targetWing !== wingIndex &&
        this.isAlive(
          state[base + targetWing * 4 + FIELD_FRONT],
          state[base + targetWing * 4 + FIELD_MIDDLE],
          state[base + targetWing * 4 + FIELD_REAR],
          this.wingInitial(side, targetWing),
        )
      ) {
        const transfer = Math.min(
          Math.max(0, rear - rearTransfer),
          REINFORCE_RATE * rear,
        );
        out[ri] -= transfer;
        out[base + targetWing * 4 + FIELD_REAR] += transfer;
      }
    }
  }

  private fireTargetsFromState(
    side: "red" | "blue",
    wingIndex: number,
    state: number[],
    sectorEnemyAlive: boolean,
  ): number[] {
    const ownBase = side === "red" ? 0 : 12;
    const enemyBase = side === "red" ? 12 : 0;

    if (sectorEnemyAlive) return [wingIndex];

    const enemyTargets = [0, 1, 2].filter((j) =>
      this.isAlive(
        state[enemyBase + j * 4 + FIELD_FRONT],
        state[enemyBase + j * 4 + FIELD_MIDDLE],
        state[enemyBase + j * 4 + FIELD_REAR],
        this.wingInitial(side === "red" ? "blue" : "red", j),
      ),
    );
    if (enemyTargets.length === 0) return [];

    const hasFriendly = [0, 1, 2].some(
      (j) =>
        j !== wingIndex &&
        this.isAlive(
          state[ownBase + j * 4 + FIELD_FRONT],
          state[ownBase + j * 4 + FIELD_MIDDLE],
          state[ownBase + j * 4 + FIELD_REAR],
          this.wingInitial(side, j),
        ),
    );
    if (hasFriendly) return enemyTargets;

    return [enemyTargets[0]];
  }

  private isAlive(
    front: number,
    middle: number,
    rear: number,
    wingInitial: number,
  ): boolean {
    return front + middle + rear > Math.max(1, wingInitial * ROUT_RATIO);
  }

  private frontInitial(side: "red" | "blue", wingIndex: number): number {
    return side === "red"
      ? this.redWingFrontInitial[wingIndex]
      : this.blueWingFrontInitial[wingIndex];
  }

  private frontSlotCap(side: "red" | "blue", wingIndex: number): number {
    return (side === "red" ? this.redFrontSlotCap : this.blueFrontSlotCap)[
      wingIndex
    ];
  }

  private wingInitial(side: "red" | "blue", wingIndex: number): number {
    return side === "red"
      ? this.redWingInitial[wingIndex]
      : this.blueWingInitial[wingIndex];
  }

  /** RK4 积分一步（噪声在一次步长内保持不变，保证数值稳定） */
  private integrate(state: number[], dt: number): number[] {
    const k1 = this.derivatives(state);
    const k2 = this.derivatives(addScaled(state, k1, dt / 2));
    const k3 = this.derivatives(addScaled(state, k2, dt / 2));
    const k4 = this.derivatives(addScaled(state, k3, dt));
    return state.map(
      (value, index) =>
        value +
        (dt / 6) *
          (k1[index] + 2 * k2[index] + 2 * k3[index] + k4[index]),
    );
  }
}
