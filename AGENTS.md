# AGENTS.md

面向 AI 编程助手的工作区说明。详细功能规格见 [README.md](README.md)（本文不重复，请先阅读）。

## 项目概述

基于兰彻斯特方程（Lanchester's Laws）的近现代战争模拟器。Vite + TypeScript，纯 Canvas 渲染，无第三方游戏框架。双页面：`index.html`（战斗页）+ `stats.html`（统计页）。

## 常用命令

- `npm run dev` — 开发服务器（端口 5173，严格占用）
- `npm run build` — 类型检查 + 构建：**`tsc && vite build`**，类型错误会直接阻断构建
- `npm run preview` — 预览构建产物
- ⚠️ 不要使用工作区 tasks.json 里的 `msbuild` 构建任务（是陈旧的，本项目无 .NET 工程）
- 无测试、无 ESLint/Prettier，无自动格式化

## 架构

- [src/main.ts](src/main.ts) — 战斗页入口：DOM 绑定、参数读取、主循环、统计保存
- [src/simulation.ts](src/simulation.ts) — 模拟核心（最大最核心）：纯逻辑、无 DOM，导出所有类型与 `Simulation` 类
- [src/layout.ts](src/layout.ts) — 纯布局层：每点人数、每排容量、阵型布点、火炮/骑兵图标换算（模拟与渲染共用）
- [src/battlefield.ts](src/battlefield.ts) — 战场态势 Canvas 绘制（`drawBattlefield` 及箭头/红叉/骑兵/火炮等）
- [src/chart.ts](src/chart.ts) — 统计页兵力曲线（`drawChart`）
- [src/canvas.ts](src/canvas.ts) — 画布初始化（devicePixelRatio 缩放）
- [src/theme.ts](src/theme.ts) — 渲染主题常量（颜色/字体）
- [src/stats.ts](src/stats.ts) — 统计页入口，通过 localStorage 读取战斗数据
- [src/style.css](src/style.css) — 两页共用样式（CSS 变量主题）

## 约定

- **注释与界面语言全部为中文**；注释写「为什么」而非「是什么」。
- 命名：camelCase 函数/变量、PascalCase 类型/类、UPPER_SNAKE 常量；模拟器状态几乎全部私有，只暴露查询 getter。
- 严格 TS：`verbatimModuleSyntax` 要求类型导入必须用 `import type`；`noUnusedLocals` / `noUnusedParameters` 未用变量/参数直接编译失败。
- 翼编号：`0 = 左翼，1 = 中军，2 = 右翼`，双方各 3 翼一一对应交战。
- 时间模型为**回合制**：`sim.step(1)` 结算一整回合；速度 = 回合/秒。
- 双循环（有意为之）：`setInterval(stepTicks, 50)` 推进模拟（后台标签页照常推进），`requestAnimationFrame(loop)` 只做渲染。
- 战斗页与统计页通过 **localStorage key `"war-sim-last-battle"`** 同步（载荷带 `version: 1` 与 `savedAt`），无 BroadcastChannel。

## 关键坑（改动前必读）

### 火力单元模型（核心粒度）
- **点 ≠ 士兵**：一个点代表一个火力单元（`soldiersPerDot(wing)`：中军 25 人、两翼 19 人）。每排容量 `rowCapacity(wing, rowWidth)`：每排长度 = 战场宽度（人），点数 = ceil(rowWidth / 每点人数)。改布点/槽位时必须保持"点数 = ceil(兵力 / 每点人数)"这一换算一致。
- **前排固定三排**：`formationRows` 中前排只要还有单元就铺成 3 排（`distributeUnits` 均匀分布，默认宽度下如中军 30/30/28、两翼 10/10/10）；中排/后排按「前排单行最大点数」同宽切行（也可多排），没有前排时退回战场宽度容量。
- **射击节奏**：每个火力单元每 `FIRE_INTERVAL = 14` 回合射击一次（`(planTick + rank) % FIRE_INTERVAL === 0`），千回合约 70 发，并非每回合都射。单发命中概率已按 `FIRE_INTERVAL` 补偿（聚合杀伤率不变）；**不要再乘单元规模**（单元规模在"射击次数 × 每点人数"中抵消，重复计入会让战斗快几十倍）。
- 前排槽位（`FrontSlotState`）是单元粒度，但 `front`/`middle`/`rear` 字段始终是**士兵口径**（RK4、组织度、HUD 都按士兵计）。击杀/补位一个单元增减其 `slotSoldiers`（末槽可能是余数）。`frontSlotCap` 是士兵口径的初始前排人数。
- 默认配置（index.html）：双方各 10000 人、翼部署 17/66/17、梯队 30/30/40、宽度 4500、火炮 10/40/10、骑兵 4/12/4、伤害 0.014（随机默认下约 1000 回合，火炮占比约 7%）。
- 骑兵（离散状态机）：按翼配置（类似火炮），部署在步兵阵型后缘与炮兵正中间（`cavalryY` 按当前阵型行数自适应）；每个单元 = 25 名骑兵（`CAVALRY_PER_DOT`），图标每 5 单元 1 个（`cavalryIconCount` = ceil(count/5)，随配置递增）。每个单元独立在「准备（蓄力 30 回合）→ 冲锋（保留 3 回合动画后结算）→ 准备」间循环。准备状态不受任何伤害（当前所有火力都只指向士兵点与火炮，天然不会打到骑兵）；冲锋时做一次对决（胜率 0.4 × 随机性噪声，全战场共享随机流避免红蓝小样本偏差）：成功多倍杀伤——主目标必杀并补杀 `CAVALRY_KILL_MULT - 1` 个敌方火力单元、自身无损，失败仅阵亡 1 个骑兵单元、目标无损失。骑兵目标遵守当面翼约束（`fireTargets`，侧击箭头渲染为琥珀色），溃退/撤退中的翼不冲锋；蓄力与目标选择走确定性种子。

### 模拟真相：混合模型
- 中排↔后排的支援/调度是**连续 RK4 积分**（24 维状态）；直瞄火力与火炮是**离散逐点/逐门结算**。两者相加才是模拟结果，不要试图统一为单一模型。
- 随机性为 0 时攻击分配/击杀判定是**确定性的**（mulberry32 种子 = 回合数 × 质数）。改动种子常量会改变整场战斗走向。

### render 与 simulation 的耦合（最危险）
- simulation.ts 与 battlefield.ts **共享同一套布点函数** `formationRows` / `rowCapacity` / `gunIconCount` / `cavalryIconCount`（统一由 src/layout.ts 导出）。箭头起点、圆点位置、击杀槽位映射全部依赖这套布局。**改动这些函数任何一处，会导致箭头错位、击杀落空**（`tryKillDot` 在布局中找不到 `(row,col)` 会直接 return false）。
- 攻击分配有共享缓存：`getFireAssignments()` / `getGunAssignments()` 触发 `ensureAssignmentsCached`，显示与结算共用同一份。**修改 `sim.orders` 后必须调用 `sim.invalidateAssignments()`**，否则暂停时箭头不更新。

### 关键不变量（模拟正确性）
- **仅前排开火**：只有前排火力单元参与攻击分配，且按 `FIRE_INTERVAL` 节奏轮射；溃退/撤退中的翼不攻击。
- 当面翼约束：当面敌翼存活时只能攻击当面；当面翼被歼后可侧击其余翼或打暴露火炮（simulation 与 UI 双重实现，改动需同步）。
- 宽度约束：每排最多 rowWidth 人，`front` 与 `middle` 各自独立 ≤ 3 × rowWidth（超出自动转后排）。
- 溃败阈值：翼兵力低于自身初始值 **1%** 即视为死。

### 多文件重复定义（改动需同步）
- 已统一：localStorage key、`WING_LABELS`、红蓝颜色集中在 `src/shared.ts`；`ROUT_RATIO` 由 simulation.ts 导出、stats.ts 引用。新增跨页共享常量请放进 `src/shared.ts`。
- `SavedBattle` 载荷结构：main.ts 组装、stats.ts 手工声明，字段两边都要改。

### 其他
- Canvas 必须经 `setupCanvas` 创建（处理 devicePixelRatio 缩放）；直接 `getContext("2d")` 会模糊/错位。
- `speed` 滑块不在 `BattleConfig` 中，`readConfig` 不读它。
- 击杀红叉按 `KILL_MARK_TICKS = 8` 回合保留（暂停也显示），与墙钟无关；士兵点与被摧毁的火炮图标都会标红叉；击杀实线才是 1 秒墙钟窗口。
