# 设计规范（DESIGN.md）

> 定稿草案 · Hazel（交互设计）· 2026-10-28 · 对应风格方向：**混搭**（骨架取 C 编辑型，列表取 A 纸与墨，深色取 B 夜航仪表），Yifeng 10/28 拍板。
> **视觉定稿（10/29 定稿，Yifeng 确认 #29「都可以推」）：** `/workspace/viastela-design/prototype/` 里的颜色、字体和 680 / 1080 内容宽度是最终方案，不再等原型反馈。视觉 PR 由 Leo 把本文逐字搬进仓库的 DESIGN.md 和 `src/ui/theme.ts`，token 逐项对照见 §18。
> 依据：main `9dfc73f` 的 DESIGN.md、`src/ui/theme.ts`、`chrome.tsx`、`Text.tsx`；效果图 `/workspace/viastela-style-mvp/hybrid/`；`/workspace/viastela-de-ai/` 的 directions.md（含修订记录）、effort.md、structure.md、checklist.md。
> 本文所有示例数字都是编的。文中的对比度都按 WCAG 2.x 相对亮度公式现算，保留两位小数。

**修订记录**
- **10/29（Hazel）：**
  - 视觉方向定稿（Yifeng 确认 #29）：颜色、字体、680 / 1080 内容宽度按原型落地。新增 §18 设计 token 对照表。
  - §4.2 首屏要求加前提：账本 5 条以内；更多时允许滚动，账本折叠放 v1.1。
  - §4.3.2 / §17.4：有缓存时的失败行定为「更新失败 · 行情更新于 HH:mm · 重试」；后台刷新请求直接报错也显示这一行（PR4）。
  - §17.1：读屏节点等骨架出现才挂上。
  - §17.2：今日页体重栏骨架和出错写法；骨架画在卡片框里；`SkeletonText` 保留 `variant`。
- **10/28 晚（Hazel）：**
  - 断点档位改名为 `compact` / `medium` / `expanded`（和 #22 合入的 `useLayoutClass` 一致）。
  - `expanded` 内容区最宽 1080、居中；`medium` 最宽 680、居中。
  - §5 `MaskedAmount` 补回原生端读屏规则（#14 写过，被新版覆盖，Mason 提出）。
  - §4.3.2 / §17.5 写入 #24 行情失败文案：无缓存时标题「总资产暂时算不出来」；有缓存时只一行状态行；时间一律写「行情更新于」。加 v1.1 备注：显示已知现金合计。
  - §17.1 常量按 §17 命名（Ethan 定），注明 #24 现名，PR 2 改名。
  - §17.2 骨架改用新 token `skeleton`（浅色 `#E2DFD5`、深色 `#363632`），对 `card` 达到 1.3:1 以上。

风格参考 Claude.ai 温暖的编辑型极简。**只是参考，和 Anthropic 没有任何关系。** 不用 Anthropic 的标志、字标或专有字体文件。

这份文档是所有模块（体重、训练、学习、资产，以及以后的模块）的约定。页面只组合 `src/ui` 里的组件；颜色和尺寸只从 token 取。效果图、原型和本文冲突时，以本文为准。

`userInterfaceStyle` 是 `automatic`，App 跟随系统深浅色，默认浅色。`src/ui/theme.ts` 不能引入 React Native，因为 `app.config.js` 会 import 它；`ThemeProvider` 负责在 `lightColor` 和 `darkColor` 之间切换。

---

## v1 最小子集（11/2 前）

11/2 验收前只做下面三个 PR（Hazel 拆分，合并规则照旧：领域 reviewer + Mason 或 Ethan + CI 全绿，只对指定 SHA 给结论）。标「（v1.1）」的章节不在这次范围内。

| PR | 日期 | 内容 | 对应章节 |
| --- | --- | --- | --- |
| **PR 1 token 与布局** | 10/29 | (a) token 和字体：颜色、字号阶梯、网页标题用系统衬线栈（**PR 1 不放任何字体文件**）、间距圆角；(b) 断点和字号放大上限：`useLayoutClass` 三档、侧栏和底栏、`Text` 的 `maxFontSizeMultiplier` | §1、§2（不含 §2.4）、§3、§4.1、§13 |
| **PR 2 共用组件** | 10/30 | `Button`（无阴影、ghost 不撑满、`mini`）、`ListRow`、`Divider`、`Columns`、`EmptyState`、`Chip`、`Card`、`Sheet`、`LineChart` 刻度和单位、`ProgressBar` | §5、§6、§14 |
| **PR 3 页面** | 10/31 | (c) 今日页；(d) 资产页；「记录」入口；页面文案 | §4.2、§4.3.1、§4.3.2、§7 |
| **PR C（Nina）** | 随 PR 3 | 五个视口的截图 | §14 末尾「截图测试」 |

- **过渡期：** PR 1 合入后会去掉浮动「+ 记录」。PR 1 合入到 PR 3 合入之间，今日页先放一个临时的主按钮「记录」（打开原来那个 Sheet），保证记录入口不断。PR 3 合入后换成 §4.2 的正式位置。
- **截图测试在 11/2 前不是 CI 闸门：** diff 作为附件交给 Hazel 看；基线只在 CI 的 Linux 容器里生成，不用本地截图做基线。

---

## 0. 总则（五条，先看这里）

1. **没有 AI 也要好用，AI 只是叠加层。** 每个页面先回答它的主问题：今日「三件事记了没有」，资产「现在多少、比上月怎样、离目标多远」，趋势「体重往哪走」，我的「设置在哪」。
2. **强调色预算。** 实心 `accent`（#CC785C）**每屏只出现一次**，就是这一屏唯一的主按钮。除此之外，`accent` 只用在**图表**的数据标记上（数据点、选中的推算线）。大数字、标题、选中态、链接、行内操作都**不用**陶土色。
3. **零装饰。** 不用阴影、渐变、发光、半透明玻璃、emoji 和 ✨。按下反馈只用 `translateY: 1` 或换背景色。
4. **一个区块最多一张卡，不再一条一卡。** 同类的多条内容是一张卡里用发丝线分隔的账本行（`ListRow`）。只有「一个概念、多个字段」的东西才单独成卡，比如总资产、推算图。
5. **数字像账本。** 数字一律无衬线、`tabular-nums lining-nums`、右对齐，单位用小一号的 `muted`。衬线只给页面标题和日期标题。

---

## 1. 颜色（Color）

正文对比度满足 WCAG AA（≥ 4.5:1）；图形元素（图表线、点、进度条、坐标轴）≥ 3:1。发丝线、网格线、卡片描边是装饰性分隔，不承担识别功能，不要求 3:1（WCAG 1.4.11 的例外），对应的控件都有文字标签。

### 1.1 调色板

**10/29 定稿（Yifeng 确认 #29）。** 原型 `prototype/index.html` 的浅色、深色色值和下表逐项一致。带 ★ 的是 10/28 新增或改值的 token（现已在仓库里）。

| Token | 浅色 | 深色 | 用途 |
| --- | --- | --- | --- |
| `paper` | `#F6F5F0` | `#141413` | 页面底色。两种模式都**不变**，PWA 的 theme_color、splash 和 `pwa.spec.ts` 断言不受影响 |
| `paperDeep` | `#F1EFE8` | ★ `#191918`（原 `#1C1C1A`） | 侧栏 |
| `card` | `#FFFFFF` | ★ `#1E1E1C`（原 `#30302E`） | 卡片、Sheet。深色是平涂，和页面只差一档亮度（1.10:1），层级靠发丝线区分 |
| `surface` | `#FBFAF6` | ★ `#232321`（原 `#262624`） | 输入框 |
| `fill` | `#F1EFE8` | ★ `#2A2A27`（原 `#3A3935`） | 次要 hover |
| `bar` ★ | `#F6F5F0` | `#1E1E1C` | 手机底栏。浅色和页面同色，深色和卡片同色（对照效果图） |
| `ink` | `#26241F` | `#FAF9F5` | 主文字、大数字、选中细线、进度条填充 |
| `muted` | `#5F5E57` | `#B0AEA5` | 标签、说明、单位、刻度文字 |
| `textFaint` | `#6A6962` | `#9C9A90` | 占位文字 |
| `line` | `#ECEAE2` | ★ `#3A3934`（原 `#45443F`） | 1px 发丝线：卡片描边、账本行分隔、进度条轨道 |
| `lineSoft` | `#F0EEE7` | ★ `#2A2A27`（原 `#3A3935`） | 只用于 hover 底和极弱分组；**账本行分隔用 `line`，不用它** |
| `accent` | `#CC785C` | `#CC785C` | 每屏唯一的主按钮底色；图表数据点、选中的推算线 |
| `accentHover` | `#D08A70` | `#D08A70` | 主按钮 hover。更亮，因为按钮文字是深色 |
| `accentInk` | `#26241F` | `#141413` | 主按钮上的文字 |
| `accentText` | `#944A34` | `#E7A08A` | **停用中。** 新界面不用（ghost、tab、Chip 都改成 ink）。唯一例外：有缓存时失败行里的「重试」（10/29 定，§17.4），所以这个 token 保留，不删 |
| `accentSoft` | `#F5ECE5` | `#4A3830` | **停用中。** 选中态不再用整块色底。迁移完后删除 |
| `pos` ★ | `#4F6F5A` | `#8AAB94` | 正向变化的小字，例如「较上月 +US$4,180」。减少用 `ink` 加负号，不用红色 |
| `moss` | `#6E9079` | `#8AAB94` | 体重图的平滑趋势线（只做图形，不做小字） |
| `target` ★ | `#7A786F` | `#8C8A82` | 图表目标线（1px 点线） |
| `chartGrid` ★ | `#ECEAE2` | `#2A2A27` | 图表网格线（只画在刻度上） |
| `chartAxis` ★ | `#5F5E57` | `#6A6962` | 图表坐标轴线 |
| `toast` / `onToast` | `#26241F` / `#FAF9F5` | 同左 | Toast。不用 `ink`，否则深色模式下是奶白配奶白 |
| `danger` | `#9A463E` | `#E29B90` | 行内错误文字 |
| `dangerFill` | `#9A463E` | `#9A463E` | 错误 toast、删号按钮底色，配 `onToast` |
| `dangerSoft` | `#F8EEEB` | `#3C2C2A` | 错误底色 |
| `warning` / `warningSoft` | `#8A5A12` / `#FBF3E4` | `#E3B26B` / `#3A3222` | 随 #14 合入（行情状态提示） |
| `overlay` | `rgba(38, 36, 31, 0.42)` | `rgba(0, 0, 0, 0.62)` | Sheet 遮罩 |
| `skeleton` ★ | `#E2DFD5` | `#363632` | 骨架屏色块（§17.2）。对 `card`：浅色 1.33、深色 1.38；对 `paper`：浅色 1.22、深色 1.62 |

### 1.2 对比度（现算）

**文字（要求 ≥ 4.5:1）**

| 前景 / 背景 | 浅色 | 深色 |
| --- | --- | --- |
| `ink` / `card` | 15.50 | 15.85 |
| `ink` / `paper` | 14.20 | 17.50 |
| `muted` / `card` | 6.51 | 7.51 |
| `muted` / `paper`（浅色底栏、今日账本） | 5.96 | 8.29 |
| `muted` / `paperDeep`（侧栏） | 5.66 | 7.91 |
| `textFaint` / `surface`（占位） | 5.28 | 5.58 |
| `accentInk` / `accent`（主按钮文字） | 4.73 | 5.63 |
| `accentInk` / `accentHover` | 5.57 | 6.63 |
| `pos` / `card` | 5.59 | 6.63 |
| `pos` / `paper` | 5.12 | 7.32 |
| `danger` / `card` | 6.33 | 7.41 |
| `danger` / `dangerSoft` | 5.55 | 5.88 |
| `onToast` / `dangerFill` | 6.00 | 6.00 |
| `onToast` / `toast` | 14.72 | 14.72 |

**图形（要求 ≥ 3:1）**

| 元素 / 背景 | 浅色 | 深色 |
| --- | --- | --- |
| `accent` 数据点、推算线 / `card` | 3.28 | 5.10 |
| `accent` / `paper` | 3.00（刚好达标，所以图表一律放在卡里） | 5.63 |
| `moss` 趋势线 / `card` | 3.54 | 6.63 |
| `target` 目标线 / `card` | 4.43 | 4.83 |
| `target` / `paper` | 4.06 | 5.33 |
| `chartAxis` 坐标轴 / `card` | 6.51 | 3.03 |
| 进度条：`ink` 填充 / `line` 轨道 | 12.87 | 10.98 |

**装饰性分隔（不要求 3:1，仅供参考）**：`line` / `card` 浅色 1.20、深色 1.44；`line` / `paper` 浅色 1.10、深色 1.59；`chartGrid` / `card` 深色 1.16。B 方向原来的 `#2E2D2A` 在深色卡上只有 1.21，几乎看不见，所以深色发丝线用 `#3A3934`。

**不能做小字的颜色**：`accent`（白卡上 3.28）和浅色 `moss`（3.54）都不到 4.5，不能用来写小字。正向小字用 `pos`。

---

## 2. 字体（Typography）

### 2.1 字族

**10/29 定稿（Yifeng 确认 #29）：** 字族按原型和下面的规则落地，不再变。

- **无衬线（正文和全部数字）**：`ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", "Noto Sans SC", "Microsoft YaHei", sans-serif`。**不用 Inter**（效果图里出现的 Inter 只是渲染用字体，仓库不加载它）。原生端用系统字体（`fontFamily` 不设）。
- **所有数字**：`fontVariant: ['tabular-nums', 'lining-nums']`，金额和数值列右对齐。
- **数字字体：** 可以打包一个**只含拉丁字符**的等宽数字字体；不打包时，就用系统字体加 `tabular-nums`。
- **衬线（只给页面标题和日期标题）**：
  - **分两步上线：** PR 1 只用系统衬线栈 `"Songti SC", "Noto Serif CJK SC", serif`，不放字体文件、不写 `@font-face`。子集作为 **PR 2 里单独的一个提交**加进去，超过 200KB 就撤掉这个提交，继续用系统衬线栈。
  - **网页子集（PR 2 单独提交）：** 自托管 Noto Serif SC（SIL OFL 开源协议）600 字重的**子集** woff2，放在 `public/fonts/viastela-serif-600.v1.woff2`（文件名带版本号，因为 Service Worker 缓存优先；`sw.js` 的 `shell-static-v1` 不改；`public/` 只新增 `fonts/`），`@font-face` 名为 `Viastela Serif`，`font-display: swap`。Service Worker 已经缓存同源字体，不用改。字族栈：`"Viastela Serif", "Songti SC", "Noto Serif CJK SC", serif`。**不再用 Georgia**：它的数字是旧式数字，`10月28日` 会高低不齐。
  - **体积上限 200KB：** 以构建产物 `dist` 里的文件大小为准。Mason 在 PR 描述里核对并写明实际大小。超过 200KB 就不打包子集，网页标题改用系统衬线栈 `"Songti SC", "Noto Serif CJK SC", serif`，同样不打包任何字体文件。
  - **子集字表（固定 46 个字形）：**
    - 数字 `0–9`，以及 `月 日`。
    - 页面标题用字：`资产 体重趋势 我的 删除账号 正在 已 隐私政策 找不到这一页`。
    - 品牌 `星途`，登录页字标 `V i a s t e l`。
    - 字表只定义在 `src/ui/serif-glyphs.ts` 一处，生成脚本和 `Text` 的缺字回退都从这里读。CI 检查字体里的字形和字表一致、体积 ≤200KB。
    - 源字体不进仓库：脚本从 Noto 官方发布地址下载，版本号和 sha256 固定，用 `pyftsubset` 生成；仓库只提交 woff2 和旁边的 `OFL.txt`。
    - 新增页面标题时，要把新字加进字表，重新生成子集。
  - **网页缺字回退（随子集一起进 PR 2）：** 写成 `src/ui` 里的纯函数并加单测，只在 `Platform.OS === 'web'` 时生效。`Text` 组件内部校验，`variant="title"` 的文字只要有一个字不在子集字表里，就整段改用无衬线。这样漏加字也不会出现半衬线半黑体。使用系统衬线回退栈时，不做这项校验。
  - **原生端（v1）：** 标题一律用**系统无衬线**。原因：iOS 上的宋体（Songti SC）是按需下载的字体，不是系统内置字体，不能假定它存在；Android 没有中文衬线。用 `expo-font` 内嵌字体放到 v1.1，见 §2.4。
  - **动态文本永远不用衬线**，包括账户名、训练名、学习主题和 Sheet 标题里的用户内容。

### 2.2 字号阶梯

| Text variant | 字号 / 行高 | 字族 | 字重 | 用途 | 字号放大上限 |
| --- | --- | --- | --- | --- | --- |
| `display` | 32 / 38 | 无衬线 | 600 | 每页唯一的大数字（7 日均重、总资产） | 1.2 |
| `title` | 28 / 34 | 衬线（见上） | 600 | 页面标题、日期标题 | 1.2 |
| `metric` ★ | 20 / 26 | 无衬线 | 600 | 两列小卡的金额（现金 / 股票） | 1.2 |
| `heading` | 16 / 22 | 无衬线 | 600 | 卡内小标题、Sheet 标题、空状态以外的强调行 | 1.2 |
| `body` | 15 / 22 | 无衬线 | 400（强调 500） | 正文、账本行的项目名和数值 | 1.3 |
| `tab` ★ | 14 / 20 | 无衬线 | 400，选中 600 | 底栏和侧栏导航文字 | 1.2 |
| `label` ★ | 13 / 18 | 无衬线 | 500，`muted` | 区块标签：「总资产」「推算」「今天的记录」 | 1.3 |
| `muted` | 13 / 18 | 无衬线 | 400，`muted` | 说明、参照列、单位、meta | 1.3 |
| `caption` ★ | 12 / 16 | 无衬线 | 400，`muted` | 图例、表头 | 1.3 |
| 图表刻度 | 10 / 12 | 无衬线等宽 | 400，`muted` | 只在 `LineChart` 内部用，不开放成 Text variant | 1.2 |

- 大数字只用 `ink`，不用陶土色（取代旧版 Weight 一节「The figure uses the display style and the clay accent color」）。
- 单位跟在数字后面，用 `body` 或 `muted` 尺寸的 `muted` 色，间距 4，例如 `72.5 kg`。
- 今日页标题：`10月28日` 用 `title` 衬线，后面的 `周三` 用 17/500 无衬线 `muted`（对照效果图）。资产页标题「资产」后面跟一行 `muted` 日期。
- 标题字号在三档断点下都是 28，不随宽度放大（效果图桌面档画了 32，不采用：少一套字号，也少一种放大后的组合）。

### 2.3 系统大字号（Dynamic Type / 字体缩放）

- 允许跟随系统放大，**上限统一写在 `src/ui/Text.tsx` 里**，页面不单独写：`maxFontSizeMultiplier` 按上表最后一列。正文类 1.3；标题、大数字、`metric`、`heading` 和导航文字 1.2。
- 网页上 react-native-web 不处理这个属性，用浏览器缩放，不另做限制。
- 放大后不能截断数字：账本行用 `minHeight`，不用固定 `height`；参照列允许换行；数值列不换行。

---

### 2.4 原生端衬线（v1.1）

- EAS 打包时用 `expo-font`，把 §2.1 的同一份 46 字子集内嵌进原生包。`package.json` 由 platform agent 改。
- 内嵌后，原生端也启用缺字回退校验，规则和网页一致。

## 3. 间距、圆角、尺寸（Spacing, radius, targets）

- **间距尺度：4 / 8 / 12 / 16 / 24。** 区块之间 16；卡内边距 16；卡内行与行之间 8；手机页面左右边距 16；账本行上下内边距 12。
- `32` 只用于平板和桌面档的页面内边距；`48` 不再用于新界面（保留 token 只为兼容）。
- **圆角**：卡片、Sheet、Callout、主按钮和次按钮 **10**；小控件（行内「记录」小按钮、Chip、分段控件、眼睛开关）**8**；进度条 2；`pill` 只给 toast。
- **阴影：无。** 删掉旧版「The primary button may carry a 1px clay shadow」。效果图浅色卡片上那层极淡阴影不采用。
- **点击区**：按钮、Chip、导航项、输入框、toast 至少 44pt。行内「记录」小按钮视觉高 28，用 `hitSlop` 把点击区补到 44；账本行本身 `minHeight` 48。
- **底栏**：高 56，加底部安全区。不再有凸出的浮动按钮。
- **手机内容区底部留白** = `layout.tabBar + space.md`（56 + 16），再加底部安全区（由 `useShellInset` 统一计算），保证最后一行和「记录」按钮不被底栏盖住。

---

## 4. 布局与断点（新增）

### 4.1 三档断点

只按**窗口宽度**判断，不判断设备型号、平台或 UA。横竖屏、iPad 分屏、浏览器拖窗都会自动跟着变。原生 iPad 也走同一套（`app.config.js` 已是 `supportsTablet: true`）。

**10/29 定稿（Yifeng 确认 #29）：** 内容宽度 680 / 1080 和断点 600 / 1024 按原型落地。

| 档位 | 宽度 | 导航 | 内容区 | 页面边距 |
| --- | --- | --- | --- | --- |
| `compact` | < 600 | 底栏 4 个文字 tab：**今日 / 资产 / 趋势 / 我的** | 单列，满宽 | 16 |
| `medium` | 600–1023 | 左侧栏，宽 **184** | 单列居中，最宽 **680** | 32 |
| `expanded` | ≥ 1024 | 左侧栏，宽 **228** | 最宽 **1080**，在侧栏右侧的区域里居中；今日 2 栏，资产多栏 | 32 |

- 实现：`src/ui/chrome.tsx` 的 `useWideWeb()` 换成 `useLayoutClass(): 'compact' | 'medium' | 'expanded'`（`src/ui/layout-class.ts` 的 `layoutClassForWidth`，#22 已合入），内部只用 `useWindowDimensions().width` 和 `theme.breakpoint`，**去掉 `Platform.OS === 'web'` 的条件**。边界：599 是 `compact`，600 和 1023 是 `medium`，1024 是 `expanded`。
- 内容区宽度：`medium` 最宽 `layout.content`（680），`expanded` 最宽 `layout.contentWide`（1080），两档都在侧栏右侧的区域里水平居中；`compact` 满宽。
- 下文出现的「手机 / 平板 / 桌面」分别指 `compact` / `medium` / `expanded`。`theme.breakpoint` 的 key 仍叫 `tablet`（600）和 `desktop`（1024），和 main 一致，不改名。
- 侧栏：顶部是 V 字标 22 加衬线「星途」，下面 4 个导航项左对齐，底部一行 `muted`「星途 v1」。手机上没有侧栏，V 字标放在标题行右侧。
- 导航选中态：**2px `ink` 细线**（侧栏在文字左侧，底栏在文字上方居中，宽 28），文字 `ink` 600；未选中 `muted`。不用色块底，不用陶土色。
- 安全区：继续用 `react-native-safe-area-context`；网页 PWA 继续用 `env(safe-area-inset-*)` 和 `viewport-fit=cover`。

### 4.2 「记录」入口

- **没有浮动「+ 记录」。** 全 App 只有一个主「记录」按钮，在今日页账本下方，是这一屏唯一的实心 accent 块。它打开的 Sheet 和原来浮动「+ 记录」打开的是同一个，内容为空。
  - 手机和平板上撑满账本那一栏的宽度。
  - 桌面档放在今日页左栏，账本下方。
  - 无障碍名称：「记录」。
- **账本每一行右侧有一个描边小按钮**，显示「记录」，视觉高 28，点击区 44，打开这一类的表单。
  - 无障碍名称分别是「记录体重」「记录训练」「记录学习」。
- **Sheet 标题：** 从主按钮打开时是「记录」；从行内按钮打开时是「记录体重」「记录训练」「记录学习」。
- **趋势、资产、我的三页不放任何记录入口**，包括空状态。趋势页没有体重时，空状态只写说明，不放按钮。
- **首屏要求：**
  - 390×844 上，主按钮不用滚动就能看到。**前提是账本 5 条以内**（10/29 定）。
  - 账本超过 5 条时允许滚动，主「记录」按钮仍然放在账本下方，不改成吸底。
  - 360×800 上，最多滚动一屏。
  - 账本太长时要不要折叠，放进 v1.1 backlog。
- **过渡期：** PR 1 合入到 PR 3 合入之间，今日页放一个临时主按钮「记录」，见文首「v1 最小子集」。

### 4.3 各页面结构

#### 4.3.1 今日

```
compact（<600）                      expanded（≥1024）
┌───────────────────────┐            ┌侧栏228┬────────── 最宽 1080，居中 ──────────┐
│ 10月28日 周三        V │            │ V 星途 │ 10月28日 周三                       │
│ ┃10 月还剩 3 天…  去更新│ ←月末提醒   │ 今日   │ ┃10 月还剩 3 天 · 更新本月资产  去更新│
│ ┌7 天均重────────────┐ │            │ 资产   ├──── 左栏 1fr ─────┬─── 右栏 1fr ───┤
│ │72.8 kg             │ │            │ 趋势   │ 今天的记录 · 已记 2/3│┌7 天均重──────┐│
│ │[28 日图，带刻度]     │ │            │ 我的   │ 账本：体重/训练/学习 ││ 72.8 kg      ││
│ │● 每日晨重 -- 平滑趋势 │ │            │        │ [■ 记录]            ││ [28 日图 220]││
│ └────────────────────┘ │            │        │                     │└──────────────┘│
│ 今天的记录 · 已记 2/3   │            │        ├─────────────────────┴───────────────┤
│ 项目     今天   参照    │            │        │ 近 7 天（7 列日期 × 体重/训练/学习）  │
│ 身体                    │            └────────┴─────────────────────────────────────┘
│ 体重  72.5 kg 上次72.4 [记录]│
│ 训练    未记 近7天3次 [记录]│        medium（600–1023）：侧栏 184，内容和手机同一列，最宽 680 居中
│ 成长                    │
│ 学习 75 分钟 近7天4.5h [记录]│
│ [■■■■■ 记录 ■■■■■]     │
├───────────────────────┤
│ 今日  资产  趋势  我的   │
└───────────────────────┘
```
- 今日账本按效果图直接铺在 `paper` 上（A 的做法），用 `line` 发丝线分行，不包卡。分组标签「身体」「成长」用 `label`。
- 列：项目（左）｜今天（数值右对齐，未记写 `muted`「未记」）｜参照（`muted`，可换行，口径见 §7.1）｜行内「记录」。
- 「已记 2/3」放在区块标签里；三项都记完时，区块标签写「今天都记完了」。
- 7 天均重卡里的图高：手机 120（屏高 < 760 时 96），平板 176，桌面 220。390×844 下主按钮在首屏内；360×800 最多滚动一屏（见 §4.2）。
- 桌面档底部的「近 7 天」表只在 ≥1024 出现：一张卡，行是体重 / 训练 / 学习，列是 7 个日期加「合计」，今天那一列表头用 `ink` 600，没有记录写 `muted`「—」。

#### 4.3.2 资产

手机从上到下排列；桌面是三列网格。

1. 总览卡：`label`「总资产」，右侧 `caption`「行情更新于 09:30」（时间一律写「行情更新于」，不写「价格更新于」）；`display` 金额 + 眼睛开关；「较上月 +US$4,180 · +1.5%」（增加的金额用 `pos`，没有上月快照时整行隐藏）；「目标 US$800,000」和百分比，下面是进度条；主按钮「更新本月资产」（这一屏唯一的实心块）。没设目标时，进度条那一行换成 `muted`「还没设目标」和 ghost「设一个目标」。
   - **行情失败（#24 口径）：**
     - 有离线缓存：金额照常显示缓存价，总览卡右上角只放**一行**失败行「更新失败 · 行情更新于 HH:mm · 重试」（10/29 定，390 宽一行放得下）。「更新失败 · 行情更新于 HH:mm」用 `warning`；「重试」用 `accentText`，可以点，点了重新拉行情。时间用 `formatQuoteClock`，按用户设置的时区。不另加 Callout，不弹 toast。
     - 没有缓存：大数字位置换成 `heading`「总资产暂时算不出来」，下面一行 `muted`「行情暂时取不到」；不显示「较上月」和目标百分比，进度条不画；眼睛开关隐藏。现金 / 股票小卡写「—」。
     - 持仓行：拿不到价格的持仓，金额列写 `muted`「暂无价格，未计入总资产」（允许换行），占比写「—」。
     - 今日页的资产卡：行情失败时右上角写 `warning`「行情更新失败」，不转圈。
     - 不用余额兜底。
   - **v1.1 备注（不在 11/2 范围）：** 没有缓存时，大数字改成显示已知的现金合计，下面一行 `muted`「证券暂无价格，未计入」。前提是 Mason 先定现金合计怎么来：缓存汇率（非 USD 现金也能折算），还是只计 USD 现金。现在总额是行情接口一起算好返回的，前端没有现金合计。
2. **现金 / 股票两列小卡**：一行两张，间距 12；每张是 `label`、`metric` 金额、两行 `caption`（占比、较上月）。平板和桌面也保持两列。
3. 推算卡：`label`「推算」+ ghost「调整假设」；先写结论句，再放 3% / 5% / 7% 切换和图，图例在图下面。
4. 账户卡：一张卡，表头 账户 / 金额 / 占比，每个账户一行，持仓缩进 24 嵌在账户下面；卡头右侧 ghost「添加账户」。
5. 最近变动卡：3 行，旧值 → 新值和日期，底部 ghost「查看全部」。

桌面三列：第 1 列是总览卡加现金 / 股票；第 2–3 列是推算卡；第二行账户卡跨 2 列，最近变动占 1 列。`medium` 单列，最宽 680 居中；`expanded` 网格最宽 1080 居中。

#### 4.3.3 趋势（v1.1）

标题「体重趋势」。第一张卡是 7 日均重和 28 日图（宽屏图高 240）；第二张卡是「近 7 天」账本，7 行，左日期右体重，`muted` meta 写时间，复测写「+1 复测」，没记的日子写一行 `muted`「—」。桌面档两栏：左图右列表。整页只在图下面保留一句口径说明（见 §7）。v1 里趋势页只随 token 和组件换样式，结构不动。

#### 4.3.4 我的（v1.1）

标题「我的」。所有档位都是单列，最宽 680。一张分组设置卡（邮箱 / 日切时间 / 时区 / 添加到主屏），第二张卡是隐私政策；最后是「退出登录」和「删除账号」两个入口。

---

## 5. 组件（Components）

页面只用下面这些零件。页面里不写 `StyleSheet`，也不写裸色值（ESLint `viastela/no-raw-design-values` 会拦）。

- `Screen`、`Content`、`Stack`、`Row`、`Center` — 页框和间距。传间距 token 名，不传数字。`Content` 默认 `gap="md"`（16）；新增 `width="wide"`，桌面档最宽 `layout.contentWide`。
- `Columns` ★ — 桌面档的多栏：`main` / `aside`（或 `columns={3}` 的网格），栏间距 24；窄于桌面档时按 main → aside 的顺序上下堆叠。
- `ScreenHeader` — 一个标题（就是这页的无障碍标题），可选 detail 和 note。**没有 kicker。**
- `Card` — 一个区块。圆角 10、1px `line` 描边、内边距 16、无阴影。同类的多条内容放进同一张卡的 `ListRow`。
- `ListRow` ★ — 账本行：左边是项目（`body` 500），可选一行 `muted` 副标题；右边是数值（等宽、右对齐、单位 `muted`）；再右边是 meta 和一个操作。`minHeight` 48，上下内边距 12，行与行之间 1px `line`。
- `Divider` ★ — 1px `line`。
- `Field` — 标签、值、可选提示。`TextField` — 标签、输入框、错误或帮助文字；圆角 8。
- `Button`：
  - `primary`：`accent` 底、`accentInk` 字、高 44、圆角 10、**无阴影**。**每屏只有一个。** 在它所在的那一栏里撑满宽度。
  - `secondary`：透明底、1px `line` 边、`ink` 字。空状态里的动作一律用它。
  - `size="mini"` ★：视觉高 28、圆角 8、1px `line` 边、`ink` 13/500，`hitSlop` 补到 44。只用于账本行内的「记录」，并且必须传 `accessibilityLabel`（「记录体重」「记录训练」「记录学习」）。
  - `ghost`：`ink` 500 文字，**永远不撑满整行**（`alignSelf: 'flex-start'`，左右内边距 8，点击区 44）。放在卡头右侧或行尾。hover 底色 `fill`。
  - `ghost` 加 `tone="danger"`：只是危险操作的入口，比如「删除账号」。真正执行删除的按钮用 `variant="danger"`（`dangerFill` 底、`onToast` 字）。实心 `danger` 只用于有单独确认页的不可逆操作，比如删除账号。
- **删除与撤销**（规则不变）：删除列表里的一条，用 ghost 文字按钮「删除」（体重记录在体重行展开后的子行行尾；账户和持仓在各自的编辑 Sheet 底部，见 structure.md S-11），点击区至少 44pt。点了立刻隐藏那一行，并显示 toast「已删除 · 撤销」5 秒。5 秒内再删，合并进同一个 toast「已删除 N 条 · 撤销」，并让每条待删记录重新计 5 秒。点撤销会全部恢复，不写任何数据。错误 toast 立刻出现，叠在撤销 toast 上方，两个都保持可见。普通 toast 排在撤销 toast 后面，不会顶掉它；撤销 toast 消失后，按触发顺序显示。有删除待生效时，保存成功的提示不盖住撤销 toast。5 秒到了没撤销，就按现有路径逐条软删除。没有确认弹窗。待删状态只存在内存里：5 秒内 App 进后台、被关掉或页面刷新，所有待删都作废，下次打开列表记录还在。
- `Chip` — 单选，44pt，圆角 8。未选中：透明底、1px `line` 边、`muted` 字；选中：透明底、1px `ink` 边、`ink` 500 字。只用在记录 Sheet 的表单选择里。
- `ChipGroup` — 一行可换行的 `Chip`。一组就是一个选择：动作、负重类型、弹力带档位、学习主题或时长。
- `Segmented` ★（v1.1）— 切换图表视图（年化 3% / 5% / 7%、推算范围）。文字 14，选中项 `ink` 600 加下方 2px `ink` 细线，底部一条 `line`。
- `StatusCard`、`CardRow` — **停用。** 今日页的三项状态改成账本行。训练行和学习行点开后，展开每组 / 每条（「查看每组」「查看记录」），再点一次收起；无障碍名称仍是汇总，例如 `深蹲 4 组 · 卧推 3 组`。
- `SetRow` — 一组训练。标题是动作，detail 是次数和负重，可删除时行尾有「删除」。
- `Sheet` — 网页居中，原生从底部弹出。一个标题、明确的关闭、明确的保存。圆角 10，内边距 24，内部间距 16。
- `EmptyState` — **`title` 必填，`description` 没有默认值**，最多一个动作，动作用 `secondary`。标题用 `body` 500。不重复放第二个做同一件事的按钮。今日页要等 `ready` 后才显示它；列表加载中，页面只显示「读取中」。
- `Callout` — 加载失败加重试的卡片。`tone="danger"`：`dangerSoft` 底、`danger` 字、role alert，用于失败的操作，比如第三方登录没完成。
- `ProgressBar`（随 #14）— 高 4、圆角 2，轨道 `line`，填充 `ink`（不用 `accent`，保证每屏只有一个实心 accent 块）。遮罩时只画轨道。
- `MaskedAmount`（随 #14）— 隐藏金额时显示固定宽度的 `••••`（`layout.maskWidth` 64），依赖等宽数字，不再按字数估宽。
  - **读屏（网页）：** `••••` 的可访问名称是「已隐藏金额」，圆点本身不读。
  - **读屏（原生，#14 规则）：** 金额单独是一个 `Text` 时，这个 `Text` 设 `accessibilityLabel`「已隐藏金额」；金额嵌在别的文字里（例如「较上月 ••••」「目标 ••••」）时，内层不单独设 label，由外层那一行设整行的 `accessibilityLabel`（例如「较上月，已隐藏金额」），避免读屏把一行拆成几段或读出圆点。
  - 隐藏时页面上和读屏里都不出现百分比；进度条只画轨道，下面一行 `muted`「金额已隐藏，点「显示」查看进度」。
- `TimelineItem`（随 #14）— 时间放在左侧一栏（宽 44，`muted` 等宽数字），删掉灰色实心圆占位。
- `LineChart` — 不带业务逻辑，由功能层传入点的位置（0 到 1）、刻度和单位。规则见 §6。
- `BrandMark` ★ — V 字标，用 react-native-svg 画（已在依赖里），V 用 `ink`，星用 `accent`（品牌标识，不计入强调色预算）。
- `ShellFrame`、`SidebarFrame`、`TabBar`、`NavItem` — App 外框。`RecordButton` **删除**。

---

## 6. 图表（新增）

- **宽度**：用 `onLayout` 量父容器宽度再画，不写死 358。**高度**：按 §4.3 的档位取 token。
- **y 轴**：3–5 个「好看」的刻度，步长取 {1, 2, 2.5, 5} × 10ⁿ，上下界向外取整到步长的整数倍。网格线只画在刻度上（`chartGrid` 1px），不再固定画 25/50/75%。刻度文字 `muted` 10 等宽，放在左侧 `layout.axisGutter`（32）里。**单位写在轴顶**（`kg`、`US$`），不写进每个刻度。
- **体重**：最小步长 0.5 kg；数据跨度小于 0.8 kg 时，以中位数为中心取 ±0.5 kg。x 轴 28 天，每 7 天一个标签，共 5 个，格式 `10/01 … 10/28`。
- **金额**：紧凑写法 `0 / 200k / 400k / … / 1M / 1.2M`。最小值 ≥ 0 时 y 轴从 0 开始；有负值时用 `muted` 1px 标出 0 线。推算图 x 轴标年份，4–6 个标签。
- **推算图范围**（v1.1）：默认显示「达标月份 + 12 个月」，最短 5 年、最长 15 年；没有目标或 50 年内达不到时显示 10 年；y 轴按可见区间重新计算（structure.md S-22）。
- **线型**：
  - 体重：每日晨重 = `accent` 点，直径 5（`layout.dot`），最新一点直径 8 加 `card` 色描边；平滑趋势 = `moss` 1.5px 虚线 `5 4`。
  - 推算：实际 = `ink` 1.5px 实线；选中的年化 = `accent` 1.8px 实线；另外两条年化 = `muted` 1.2px 虚线 `4 3`；目标 = `target` 1px 点线 `2 3`，右端标「目标」。
  - **禁止用 `line` 色画任何数据线或目标线。** 目标线对比度 ≥ 3:1（见 §1.2）。
  - 体重**没有目标字段**，体重图不画目标线。
- **图例**：一律放在图的下面，`caption` 尺寸。标签和说明不重复。
- 坐标轴线用 `chartAxis`。

---

## 7. 文案（新增）

- **不用 kicker。** 页头不再重复导航名。
- **页面标题**：今日用日期（例如 `10月28日 周三`）；资产用「资产」；趋势用「体重趋势」；我的用「我的」。品牌名只出现在侧栏、登录页和启动页。
- **产品里不写路线图。** 不出现「即将推出」「还在后面」这类话；没开放的功能先隐藏，隐藏之前写「暂未开放」。
- **不自我解释。** 同一句口径说明全 App 只出现一次：趋势图下面写「均重和圆点都取每天最早的一笔；虚线是平滑趋势，不是均值。」今日页和其他地方不再重复。效果图里「也可以点每行右侧的『记录』只记这一项」「— 表示当天没有记录」这类说明不上线。
- 不用感叹号、emoji、全大写和营销语气。
- 错误写在出错的位置下方，不弹窗；网络错误和业务错误分开写。
- 没有余额写「还没记余额」；持仓的「暂无价格」是行情状态，保持不变。

### 7.1 参照列口径（已定 · Ethan）

- **全 App 统一用「近 7 天」**，包括手机今日页的账本、桌面档的「近 7 天」表和趋势页。
- 定义：**含今天在内的 7 个本地记账日**，按用户自己设置的日切时间划分（默认 04:00，可改，例如 02:00），7 天的边界跟着日切时间走。
- 写法：「近 7 天 3 次」「近 7 天 4.5 小时」。
- 不用「本周」（自然周）。效果图里的「本周 3 次」「本周 4.5 h」不采用。
- 体重行的参照是「上次 72.4」，即上一条体重记录，不受这条影响。
- 口径集中在一个 core 函数里实现，页面不自己算。

---

## 8. 账号（Account）

（规则不变。）

`/account/delete` 显示确认页之前先检查会话。检查口径和 Edge Function 一致：取最新的 `amr` 时间戳，跳过 `token_refresh`。正好 10:00 算通过；更早，或 `amr` 缺失、为空、无效，都算过期。

会话过期时，不显示确认输入框和危险按钮，只显示一张普通 `Callout`（不是 `tone="danger"`）：`为了确认是你本人，删除账号前请重新登录一次。` 卡片下面是主按钮 `重新登录` 和 ghost 按钮 `取消`。

`重新登录` 按最新的 `amr` 方式走：`otp` 和其他非 OAuth 方式要邮箱验证码；`oauth` 回到 Google 或 GitHub。原生端一律要邮箱验证码，包括会话来自 OAuth 的情况。当前会话不登出。`取消` 离开这一页，用户保持登录。

重新登录后，再次显示确认页。用户按下 `variant="danger"` 按钮之前什么都不删。服务端返回 `403` `{ error: 'reauth_required' }` 时，回到同一段说明，不显示 `删除失败，请重试`。

---

## 9. 体重（Weight）

大数字是 **7 日均重**，来自 `sevenDayAverageView`：7 个本地记账日里，每天最早的一条取平均，至少 4 天有记录才显示。不满 4 天时，大数字位置写 `还差 N 天`（`heading`，`ink`），下面一行写 `近 7 天记了 N 天，满 4 天显示均重`。没有记录的日子不进分子，也不进分母。大数字用 `display` 样式、**`ink` 色**。

趋势图上的 `moss` 虚线是**平滑趋势**，数值只来自 core 的 `weightTrendEma`（默认 alpha 0.1），页面不自己做平滑。图表通过 `weightListWindow` 取 28 个本地日。图例写 `每日晨重` 和 `平滑趋势`。**7 日均重旁边不显示第二个「均值」，也不显示周变化或周速率。**（效果图早期版本里的「较上周 −0.4 kg」v1 不做，要不要在 v1.1 加由 Ethan 决定，建议口径见 structure.md S-16。）

一个记账日的第一条是 `晨重`，同一天之后的记录是 `复测`，不是 `备注`。

在午夜到日切时间（默认 04:00）之间，今日页标题是记账日，例如 `10月23日 周五`，并加一行说明 `凌晨 {日切} 点前的记录算作前一天`（{日切} 取用户设置，默认 4）。过了日切，标题仍是那个记账日，说明隐藏。日切时间不在页面上常驻显示。

`再记 73.7 kg` 打开记录 Sheet，并预填这个值、聚焦体重输入框、弹出小数键盘。Sheet 已经预填时，不显示 `填入上次`。用户按 `保存` 前什么都不写入。今日页的主按钮 `记录` 打开同一个 Sheet，内容为空；有上一条体重时显示 `填入上次`。

---

## 10. 训练（Training）

今日页账本里有一行「训练」，对应记账日。日切之前展开后的标题是记账日，例如 `10月26日的训练`，和体重用同一个记账日：日切是 04:00 时，01:30 的记录仍算前一天。日切之后标题是 `今天的训练`。没有组时，这一行写 `muted`「未记」，行尾的「记录」打开记录 Sheet 并选中「训练」。

记一组的 Sheet 在 `保存这一组` 后不关闭，并列出今天这个动作已经记的组。`+1 组` 把其中最后一组复制进表单，但在按 `保存这一组` 之前不写入。每次保存用各自的 client id。`完成` 是 ghost 按钮。下面几种情况下，它直接关闭 Sheet，并提示 `已记入 10月27日 · 深蹲 4 组`：表单是空的；只选了动作；或者是 `+1 组` 预填后什么都没改。其他字段有改动时先问：`保存这一组并完成` 写入这一组再关闭，`不保存，直接完成` 不写入直接关闭。

动作字段是最近用过的 6 个动作的 Chip，最新的在前，最后是 `+ 其他`，可以输入自定义名称。这些 Chip 读的是历史组，不是今天的列表。没有历史时，Chip 是 哑铃卧推、单臂划船、肩推、深蹲、弹力带面拉、俯卧撑。字段顺序：动作、公斤或弹力带、次数。弹力带档位存 `light`、`medium`、`heavy`、`extra_heavy`，显示为 轻、中、重、加重，不换算成公斤。公斤负重用 `formatKg`，去掉末尾的 `.0`，所以 40 显示为 `40 kg`。

删除一组在训练行展开后的每组列表里做，撤销规则和体重一样（5 秒）。

---

## 11. 学习（Study）

今日页账本里有一行「学习」，对应记账日，标题规则和训练一样。没有记录时写 `muted`「未记」，行尾的「记录」打开 Sheet 并选中「学习」。有记录时按主题汇总分钟数，例如 `AI Infra 30 分钟`；展开提示是 `查看记录`，再点一次收起。

学习 Sheet 只有一屏：主题（最近用过的 Chip，或手动输入）、时长（15、30、45、60 或自定义）、可选的「收获」。默认选中 30。时长必须是 1 到 1440 的整数。`保存` 关闭 Sheet，并提示 `已记入 10月27日 · AI Infra 30 分钟`。

体重、训练、学习在当前记账日都有记录时，今日账本的区块标签写 `今天都记完了`。

---

## 12. 可安装的网页应用（Installed web app）

（`paper` 两种模式都没改，theme_color 和启动图底色的断言照旧成立。）

网页导出是可安装的 App。`display` 为 `standalone`，`start_url` 为 `/`。主屏标签、manifest 的 `short_name` 和 `apple-mobile-web-app-title` 都是 `brand.webName`。manifest 的 `name` 是产品名后接 `webName`，浏览器标签标题是 `webName`、间隔号、再接产品名。`theme_color` 和 `background_color` 是浅色 `paper`。网页图标是提交在 `public/` 的方案 C 文件（`favicon.svg`、`favicon.ico`、192、512、maskable 的 192 和 512，以及 180 的 apple touch 图标）。`scripts/render-pwa-icons.js` 用这张 apple touch 图标绘制启动图，居中放在 `paper` 底色上。

iOS 用 `apple-mobile-web-app-capable` 和 `apple-mobile-web-app-status-bar-style: default`，配合 `viewport-fit=cover`。页面顶部留出 `safe-area-inset-top`。底栏底部留出 `safe-area-inset-bottom`，外框的滚动区底部也加上同样的距离，Home 条不会盖住底栏和最后一行。没有底栏的页面同样留出底部安全区。

Service Worker 只缓存同源的静态文件：JavaScript、CSS、图片、字体（包括 `public/fonts/` 的衬线子集，未超 200KB 时）和 `index.html` 外壳。页面导航走网络优先，失败时回退到外壳，所以新部署会替换旧包。`sw.js` 以 `Cache-Control: no-cache` 提供，注册时用 `updateViaCache: 'none'`。新 worker 替换已在控制的旧 worker 时，页面刷新一次。Supabase 的域名、`/auth|rest|functions|storage|realtime/v1` 路径、带 `Authorization` 的请求和 `/.well-known/*` 都不拦截。退出登录时删除运行时 Cache Storage。

没有安装横幅。「我的」页设置卡里有一行「添加到主屏」，页面已经是 `display-mode: standalone` 时隐藏。iPhone 和 iPad 上写 `在 Safari 点分享 → 添加到主屏幕`，其他地方写 `在浏览器菜单里选择「添加到主屏幕」`。通知不走这个安装流程。

---

## 13. Token 表（对应 `src/ui/theme.ts`）

★ = 新增 key；△ = 改值；✕ = 停用（保留到调用点迁移完）。颜色 token 见 §1.1。

> 本表是 10/28 相对 main `9dfc73f` 的改动记录。10/29 定稿后，以 §18 为准（对照 PR3 head `2ba3448`）。

| theme.ts key | 现值（main `9dfc73f`） | 定稿值 | 说明 |
| --- | --- | --- | --- |
| `space.xs` | 4 | 4 | |
| `space.sm` | 8 | 8 | 卡内行间距 |
| `space.ms` ★ | — | 12 | 账本行上下内边距、两列小卡间距 |
| `space.md` | 16 | 16 | 区块间距、卡内边距、手机页边距 |
| `space.lg` | 24 | 24 | Sheet 内边距、桌面栏间距 |
| `space.xl` | 32 | 32 | 只用于平板 / 桌面页边距 |
| `space.xxl` ✕ | 48 | 48 | 新界面不用 |
| `font.tick` ★ | — | 10 | 图表刻度 |
| `font.caption` ★ | — | 12 | |
| `font.sm` | 13 | 13 | `label`、`muted` |
| `font.tab` ★ | — | 14 | 导航文字 |
| `font.md` | 15 | 15 | `body` |
| `font.lg` △ | 18 | 16 | `heading` |
| `font.metric` ★ | — | 20 | 两列小卡金额 |
| `font.xl` △ | 26 | 28 | `title` |
| `font.display` △ | 40 | 32 | 大数字 |
| `lineHeight` ★ | 「字号 + 8」 | tick 12 / caption 16 / sm 18 / tab 20 / md 22 / lg 22 / metric 26 / xl 34 / display 38 | 不再用「字号 + space.sm」 |
| `fontWeight` ★ | — | regular 400 / medium 500 / semibold 600 | |
| `fontScale` ★ | — | `body: 1.3`，`heading: 1.2` | `Text` 内按 variant 取 |
| `fontFamily.sans` △ | 不含 Segoe UI / Roboto | `ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", "Noto Sans SC", "Microsoft YaHei", sans-serif` | 不含 Inter |
| `fontFamily.serif` △ | `Georgia, "Songti SC", "Noto Serif SC", serif` | `"Viastela Serif", "Songti SC", "Noto Serif CJK SC", serif`；子集超过 200KB 时改为 `"Songti SC", "Noto Serif CJK SC", serif` | 去掉 Georgia；只在网页生效，原生 v1 用无衬线 |
| `radius.sm` | 8 | 8 | 小控件、输入框、Chip |
| `radius.md` | 10（未用） | 10 | 卡片、Sheet、Callout、主 / 次按钮 |
| `radius.lg` ✕△ | 14 | 10 | 改成和 `md` 相同，调用点迁到 `md` 后删除 |
| `radius.bar` ★ | — | 2 | 进度条 |
| `radius.pill` | 999 | 999 | 只给 toast |
| `border.width` | 1 | 1 | |
| `border.indicator` ★ | — | 2 | 选中细线 |
| `breakpoint.tablet` ★ | — | 600 | |
| `breakpoint.desktop` ★ | — | 1024 | |
| `layout.wide` ✕ | 960 | 删除 | 由 `breakpoint` 取代 |
| `layout.sidebar` | 228 | 228 | 桌面侧栏 |
| `layout.sidebarCompact` ★ | — | 184 | 平板侧栏 |
| `layout.content` | 680 | 680 | `medium` 居中宽度（`compact` 满宽），以及「我的」页 |
| `layout.contentWide` ★ | — | 1080 | `expanded`，居中 |
| `layout.tabBar` △ | 88 | 56 | 不含安全区；去掉凸出按钮后变矮 |
| `layout.control` | 44 | 44 | 最小点击区、主按钮高 |
| `layout.controlMini` ★ | — | 28 | 行内「记录」视觉高 |
| `layout.row` ★ | — | 48 | 账本行 `minHeight` |
| `layout.chart` | 176 | 176 | 平板图高 |
| `layout.chartPhone` ★ | — | 120 | 手机图高 |
| `layout.chartShort` ★ | — | 96 | 手机且屏高 < 760 |
| `layout.chartWide` ★ | — | 220 | 桌面今日页图高 |
| `layout.chartTrend` ★ | — | 240 | 桌面趋势页大图 |
| `layout.axisGutter` ★ | — | 32 | y 刻度槽宽 |
| `layout.dot` △ | 7 | 5 | 数据点直径 |
| `layout.dotLast` ★ | — | 8 | 最新一点直径 |
| `layout.stroke` △ | 2 | 1.5 | 数据线宽 |
| `layout.progress` ★ | — | 4 | 进度条高 |
| `layout.mark` ★ | — | 22 | V 字标尺寸 |
| `layout.maskWidth` ★ | — | 64 | 随 #14 |
| `layout.timeColumn` ★ | — | 44 | TimelineItem 时间栏，随 #14 |

颜色 key（`Palette` 类型）新增：`bar`、`pos`、`target`、`chartGrid`、`chartAxis`；`accentText`、`accentSoft` 标为停用。`warning`、`warningSoft` 随 #14 加入。

---

## 14. `src/ui` 改动清单

| 文件 | 改什么 | 备注 |
| --- | --- | --- |
| `theme.ts` | 按 §13 和 §1.1 改 token；深色 6 个色值；新增 `breakpoint`、颜色 key | `paper` 不变，PWA 不受影响 |
| `Text.tsx` | 新 variant（`metric`、`tab`、`label`、`caption`）；`display`/`heading` 改无衬线 600；衬线只给 `title`，网页按子集字表做缺字回退；`fontVariant` 加 `lining-nums`；按 variant 设 `maxFontSizeMultiplier`；行高读 `theme.lineHeight` | 原生 v1 `title` 用系统无衬线 |
| `chrome.tsx` | `useWideWeb` → `useLayoutClass`（三档，不限平台）；`useShellInset` 按 `tabBar + space.md` 加安全区；`SidebarFrame` 宽度随档位（184 / 228）、加 `BrandMark`、导航左对齐；`TabBar` 去掉 `action` 和 `plusWrap`，底色 `bar`；`NavItem` 选中改 2px `ink` 细线；**删除 `RecordButton`** | 需要同时改 `AppShell` 的调用（功能层） |
| `Content.tsx` | 默认 `gap="md"`；页边距按档位（16 / 32）；新增 `width="wide"` | |
| `layout.tsx` | `ScreenHeader` 去掉 `kicker`；新增 `Columns`、`Divider`；`Callout` 圆角 10 | |
| `ListRow.tsx` ★ | 新组件，见 §5 | |
| `BrandMark.tsx` ★ | 新组件，V 字标 | 用已有的 react-native-svg |
| `Segmented.tsx` ★（v1.1） | 新组件 | |
| `Card.tsx` | 圆角 10 | |
| `Button.tsx` | 删阴影；圆角 10；ghost 改 `ink`、`alignSelf: 'flex-start'`；新增 `size="mini"`；hover 用 `fill` | |
| `EmptyState.tsx` | `title` 必填、去掉默认文案；标题 `body` 500；`paddingVertical` 16 | e2e 里的「先记第一笔」是页面显式传的，不受影响 |
| `Chip.tsx` | 圆角 8；未选中透明底；选中 `ink` 边框 | |
| `Sheet.tsx` | 圆角 10；内部间距 16 | |
| `LineChart.tsx` | 刻度和单位 prop、网格画在刻度上、`onLayout` 取宽、`target`/`chartAxis`/`chartGrid` tone、图例统一放下面、点和线宽读新 token；web 和原生共 4 个渲染器都要改 | |
| `StatusCard.tsx` | 停用（`StatusCard`、`CardRow`），今日页迁到 `ListRow` 后删除 | 跟今日页改版一起 |
| `ProgressBar.tsx` | 高 4、圆角 2、轨道 `line`、填充 `ink` | 在 #14 里 |
| `MaskedAmount.tsx` / `masked-amount.ts` | 固定 `maskWidth`，去掉 0.62 系数 | 在 #14 里 |
| `TimelineItem.tsx` | 删灰色圆，时间放左栏 | 在 #14 里 |
| 不改 | `AppFrame`、`ChipGroup`、`Screen`、`SetRow`、`TextField`、`ThemeProvider`、`toast`、`deleted-record` | 只随 token 变化 |

`src/ui` 以外的配套：
- 字体（PR 2 单独提交，PR 1 不放）：`public/fonts/viastela-serif-600.v1.woff2` 加 `@font-face`（写在 `+html.tsx` 或 `pwa-head.js`），体积 ≤200KB，由 Mason 在 PR 描述里写明 `dist` 里的实际大小。
- 断言：`smoke.spec.ts` 里对「近 7 日」标题的断言，随标题改动更新。

**截图测试：**
- 在 `playwright.config.ts` 里加五个视口：360×800 / 390×844 / 430×932 / 768×1024 / 1440×900，截图放在 Nina 的 PR C。
- **11/2 前不是 CI 闸门。** diff 作为附件交给 Hazel 看。
- 基线只在 CI 的 Linux 容器里生成。

---

## 15. 与旧版 DESIGN.md 的差异（给 reviewer）

- 删除：「Lists are a stack of cards, not a dense table」→ 一个区块一张卡，卡内账本行。
- 删除：主按钮可带 1px 陶土色阴影 → 无阴影。
- 删除：大数字用陶土色 → `ink`。
- 删除：tab 栏 88 含浮动记录按钮 → 56，无浮动按钮；唯一的「记录」主按钮在今日账本下方。
- 删除：「Wide web (sidebar) starts at 960」→ 三档断点 600 / 1024，原生 iPad 也适用。
- 删除：`ScreenHeader` 的 kicker；`StatusCard` / `CardRow`；`RecordButton`。
- 改：圆角 14 → 10；字号 40/26/18 → 32/28/16；衬线只给页面标题和日期，网页用 ≤200KB 的子集字体（超了就用系统衬线），原生 v1 用无衬线；间距 4/8/12/16/24。
- 改：Chip 和导航选中态从色块改成细线 / 描边，颜色 `ink`。
- 改：深色模式改成平涂（卡片 `#1E1E1C`）。
- 改：体重「数据不足」→「还差 N 天」；图例「最早体重」→「每日晨重」。
- 保留：删除与 5 秒撤销、账号重新验证、体重口径和「不显示周变化」、训练与学习的 Sheet 规则、PWA 规则。

## 16. 待定事项（v1.1）

1. **「较上周」**：v1 不做，v1.1 由 Ethan 决定（structure.md S-16）。
2. **原生端衬线**（v1.1，§2.4）：EAS 打包时用 `expo-font` 内嵌子集（platform agent）。
3. **推算图范围切换**和 `Segmented`：v1.1。
4. **今日账本折叠**：账本超过 5 条时要不要折叠，v1.1 再定（§4.2）。

## 17. 加载态（Loading states）★ PR 2 组件，PR 3 页面替换

结论：统一成四种状态：**首次加载用骨架屏**、**提交中用按钮内 spinner**、**后台刷新只改状态行**、**超时或失败进入明确的错误态**。所有时间都是常量，只定义一次。

```mermaid
stateDiagram-v2
  [*] --> 等待: 开始请求
  等待 --> 内容: 1 秒内返回（不显示骨架）
  等待 --> 骨架: 超过 1 秒
  骨架 --> 内容: 返回（骨架至少停留 400ms）
  骨架 --> 错误: 超过 8 秒或失败
  错误 --> 等待: 点「重试」
  内容 --> 刷新中: 后台刷新
  刷新中 --> 内容: 成功，状态行更新时间
  刷新中 --> 内容: 失败，旧内容保留，状态行写「更新失败」
```

### 17.1 时间常量（`src/lib/timing.ts`，和 quotes 超时同一模块）

| 常量 | 值 | 用途 |
|---|---|---|
| `LOADING_DELAY_MS` | 1000 | 超过这个时间才显示骨架，避免一闪而过 |
| `LOADING_MIN_VISIBLE_MS` | 400 | 骨架一旦出现，至少停留这么久再换成内容 |
| `LOAD_TIMEOUT_MS` | 8000 | 超时进入错误态；和 quotes 的 8 秒超时是同一个常量 |
| `PULSE_DURATION_MS` | 1600 | 呼吸效果一个周期 |

> **改名说明：** #24 里现在叫 `REQUEST_TIMEOUT_MS`（8000）和 `SKELETON_DELAY_MS`（1000），`QUOTES_TIMEOUT_MS` 引用 `REQUEST_TIMEOUT_MS`。PR 2 在 `src/lib/timing.ts` 里统一改成上表的名字（`QUOTES_TIMEOUT_MS` 改为引用 `LOAD_TIMEOUT_MS`），并补上 `LOADING_MIN_VISIBLE_MS` 和 `PULSE_DURATION_MS`。以本表命名为准（Ethan 10/28 定）。

1 秒之内只显示纸色背景和页面标题（标题不依赖数据），不放任何文字或骨架。

- **读屏节点等骨架出现才挂上（10/29 定）：** 视觉隐藏的 `role="status"`「正在加载<名>」和 `aria-busy` 在骨架出现时才挂上，`LOADING_DELAY_MS`（1 秒）里不挂。这样 1 秒内返回的快速加载不会被读屏白读一遍。原型 README 里写的「0–1000ms status 节点已在」作废，以这里为准。

- **最短停留期间再次加载（10/29 定）：** 骨架还在 400ms 最短停留里时又开始新的加载，直接保持骨架，不退回延迟阶段，也不重新等 1 秒，避免骨架闪一下（PR 3）。

### 17.2 骨架屏 `Skeleton` ★

- 组件：`Skeleton`（一个块，参数 `width`、`height`、`radius`）和 `SkeletonText`（`lines`、`variant`，按 `Text` variant 的行高排，最后一行宽 60%）。页面不自己拼颜色和尺寸。
  - `SkeletonText` 保留可选的 `variant` 属性（10/29 定），不传时按 `body` 排。
- 颜色：`skeleton` token（浅色 `#E2DFD5`，深色 `#363632`），放在 `card` 上，对 `card` 浅色 1.33:1、深色 1.38:1。原来的 `fill`（浅色 `#F1EFE8`，对白卡只有 1.13:1）在原型上几乎看不见，不再用。不用陶土色，不用渐变。呼吸到 0.55 时对比会更低，这是动画的一部分，静止态（减少动态效果下 0.7）仍可辨认。
- 效果：**呼吸，不用扫光**。不透明度 1 → 0.55 → 1，一个周期 1600ms，ease-in-out，同一屏所有骨架同步（共用一个动画值）。扫光的高光条容易显得廉价，不用。
- 减少动态效果：系统开启「减少动态效果」时（网页 `prefers-reduced-motion`，原生 `AccessibilityInfo.isReduceMotionEnabled`）不动，固定不透明度 0.7。
- 形状贴合最终布局，**不画假数字、不画假图表线**：
  - 文字行：高度 = 字号 × 0.75，圆角 `radius.bar`（2），垂直居中在该 variant 的行高里。
  - 大数字（`display`）：宽 160、高 24；`metric`：宽 96、高 16。
  - 账本行：高 `layout.row`（48），左边一条宽 56 的标签，右边一条宽 72 的值，中间留空。
  - 图表：一个圆角 `radius.md` 的块，高度用该页的图表 token（`chart` / `chartPhone` / `chartTrend`），左侧留 `axisGutter`。
  - 卡片外框照常画（边框和圆角都是真实的），只有内容换成骨架。**骨架画在卡片框里面**，不画在卡片外面（10/29 定）。
- 各页首屏骨架：
  - 今日：日期标题是真文字；下面 3 行账本骨架（体重、训练、学习）；「记录」按钮照常显示且可用。
  - 今日页体重栏（10/29 定）：加载中用 `SkeletonText lines={2}`；出错时这一栏写 `muted`「—」，不再放一张重复的错误卡（错误卡只在区块那一级出现一次）。
  - 资产：一个 `display` 骨架 + 一行 `muted` 骨架；两张小卡各一个 `metric` 骨架；账户列表 4 行账本骨架。
  - 趋势：一个 `display` 骨架 + 图表块。
  - 我的：4 行账本骨架。

### 17.3 按钮提交中

- `Button` 加 `loading` 属性：显示 16 的 `ActivityIndicator`（颜色跟按钮文字色一致），在文字左边，间距 `space.sm`；文字改成动词加「中…」（「保存中…」「发送中…」「删除中…」），由调用方传 `loadingLabel`，没传就保持原文字。
- 宽度不跳：按钮首次布局时记下宽度，作为 `loading` 期间的 `minWidth`。只锁最小宽度、不固定宽度（10/29 定）：「保存中…」比原文字长时按钮可以变宽，但不会缩回去，这样文字不会被截断。
- 透明度：`loading` 时**不降透明度**，0.55 只留给 disabled（转圈和「保存中…」已经说明在提交，再变灰会像点不了）。
- `loading` 时禁用，重复点击无效；读屏状态 `accessibilityState={{ busy: true, disabled: true }}`，网页 `aria-busy="true"`、`aria-disabled="true"`。
- 不加遮罩、不让整张 Sheet 变灰。成功和失败按各自流程处理（例如保存目标：写入成功后关弹窗并弹「目标已更新」；失败时弹窗不关，错误显示在输入框下面）。

### 17.4 后台刷新

- 已有内容**不清空、不变淡、不换成骨架**。
- 只改页面的状态行（资产的行情状态行、今日日期标题下的小字）：刷新中写 `muted`「正在更新…」；成功后恢复成「更新于 HH:mm」（资产写「行情更新于 HH:mm」）；失败时旧内容保留，状态行换成失败行。
- **失败行（10/29 定）：** 资产页有缓存时写「更新失败 · 行情更新于 HH:mm · 重试」。「更新失败 · 行情更新于 HH:mm」用 `warning`；「重试」用 `accentText`，可以点，点了重新拉行情。时间用 `formatQuoteClock`，按用户设置的时区。今日页的资产卡仍按 §4.3.2 写 `warning`「行情更新失败」。
- **请求直接报错也一样（10/29 定，PR4）：** 后台刷新不管是超时还是请求直接报错，都显示上面的失败行。不能出现报错了页面上却什么提示都没有的情况。
- 原生下拉刷新用系统 `RefreshControl`，颜色 `muted`。
- 不弹 toast，后台刷新成功不打扰。

### 17.5 超时和错误

- 首次加载超过 `LOAD_TIMEOUT_MS` 或失败：骨架换成 `Callout`，文字「没加载出来，检查网络后再试」，带 secondary 按钮「重试」。页面标题和底栏照常可用。
- 局部失败只影响那张卡：卡内显示同样的 `Callout`，其他卡照常显示。
- 行情超时不算错误：按 #24 的口径，先用离线缓存（一行失败行「更新失败 · 行情更新于 HH:mm · 重试」，颜色见 §17.4）；没有缓存时，总览标题写「总资产暂时算不出来」，下面「行情暂时取不到」，每个拿不到价格的持仓行写「暂无价格，未计入总资产」。文案和 v1.1 备注见 §4.3.2。

### 17.6 读屏

- 每个加载区块包在 `LoadingRegion` 里：容器网页 `aria-busy="true"`；骨架出现时（不是请求一开始，见 §17.1）挂上一个视觉隐藏的 `role="status"` 节点，可访问名称固定为「正在加载<区块名>」（区块名：今日、体重记录、训练记录、学习记录、资产、账户列表、趋势图），由 `label` 属性传入；**加载完成后这个节点从 DOM 移除**（不是隐藏），同时去掉 `aria-busy`。测试以这个节点消失作为加载完成的信号。原生用 `accessibilityLiveRegion="polite"`（Android）。
- 骨架整体 `aria-hidden="true"`（原生 `importantForAccessibility="no-hide-descendants"`、`accessibilityElementsHidden`），不带任何文字、角色或 testID 文案，按文字或角色查找时不会命中。
- 加载完成不额外播报，避免噪音；内容出现后焦点不动。
- 错误态的 `Callout` 用 `role="alert"`；iOS 用 `AccessibilityInfo.announceForAccessibility` 读一次错误文字。
- 后台刷新的「正在更新…」不播报，只有「更新失败」用 polite 播报一次。

### 17.7 不做的

- 不用全屏转圈、不用整页遮罩、不用进度百分比（不知道真实进度）。
- 不用「加载中…」这一行文字作为唯一的加载态（现在的做法，替换掉）。
- 不在骨架里放 Logo、插画或品牌色。

### 17.8 落地分工（Ethan 已定）

- PR 2（10/30）：`src/lib/timing.ts` 常量（按 §17.1 改名并补齐 `LOADING_DELAY_MS`、`LOADING_MIN_VISIBLE_MS`、`LOAD_TIMEOUT_MS`、`PULSE_DURATION_MS`）、`useDelayedFlag`（延迟和最短停留）、`Skeleton` / `SkeletonText`、`Button` 的 `loading` / `loadingLabel`、`LoadingRegion`（读屏容器）。附单测：1 秒内返回不出现骨架；骨架最短 400ms；减少动态效果时不动。
- PR 3（10/31，Ethan 定）：只替换今日页、体重/训练/学习三类记录列表和资产页；趋势和我的放 v1.1。PR2 放不下时，后台刷新提示挪到 PR3。
- Nina：五个视口截图里加一组「骨架」状态（`page.route` 挂起请求），再加一条减少动态效果的截图。

---

## 18. 设计 token 对照表（10/29 定稿，Yifeng 确认 #29）

结论：视觉 PR 照这张表写 `src/ui/theme.ts`。仓库现值取自 PR3 最新 head `2ba3448` 的 `src/ui/theme.ts`；定稿值取自 `prototype/index.html`，原型没用到的取本文对应章节。**95 个 key 全部「不变」，没有新增，也没有改值**：PR1、PR2（#25）已经把 token 改到定稿值。所以视觉 PR 主要是把 DESIGN.md 换成本文，`theme.ts` 只需要核对，不需要改值。

「对比仓库」一列：**不变** = 和 `2ba3448` 的值一样；**新增** = 仓库里还没有这个 key；**改值** = key 已有，值要改。

### 18.1 颜色（`Palette`，30 个）

| key | 浅色 | 深色 | 对比仓库 | 依据 | 用途 |
| --- | --- | --- | --- | --- | --- |
| `color.paper` | `#F6F5F0` | `#141413` | 不变 | 原型 | 页面底色；PWA theme_color |
| `color.paperDeep` | `#F1EFE8` | `#191918` | 不变 | 原型 | 侧栏 |
| `color.card` | `#FFFFFF` | `#1E1E1C` | 不变 | 原型 | 卡片、Sheet |
| `color.surface` | `#FBFAF6` | `#232321` | 不变 | 原型 | 输入框 |
| `color.fill` | `#F1EFE8` | `#2A2A27` | 不变 | 原型 | 次要 hover |
| `color.bar` | `#F6F5F0` | `#1E1E1C` | 不变 | 原型 | 手机底栏 |
| `color.ink` | `#26241F` | `#FAF9F5` | 不变 | 原型 | 主文字、大数字、选中细线 |
| `color.muted` | `#5F5E57` | `#B0AEA5` | 不变 | 原型 | 标签、说明、单位 |
| `color.textFaint` | `#6A6962` | `#9C9A90` | 不变 | 原型 | 占位文字 |
| `color.line` | `#ECEAE2` | `#3A3934` | 不变 | 原型 | 1px 发丝线 |
| `color.lineSoft` | `#F0EEE7` | `#2A2A27` | 不变 | 原型 | hover 底、极弱分组 |
| `color.accent` | `#CC785C` | `#CC785C` | 不变 | 原型 | 每屏唯一主按钮；图表数据点 |
| `color.accentHover` | `#D08A70` | `#D08A70` | 不变 | 原型 | 主按钮 hover |
| `color.accentInk` | `#26241F` | `#141413` | 不变 | 原型 | 主按钮文字 |
| `color.accentText` | `#944A34` | `#E7A08A` | 不变 | 草稿 §1.1（原型未用） | 停用中；唯一例外是失败行的「重试」（10/29 定，§17.4） |
| `color.accentSoft` | `#F5ECE5` | `#4A3830` | 不变 | 草稿 §1.1（原型未用） | 停用中，迁移完删除 |
| `color.pos` | `#4F6F5A` | `#8AAB94` | 不变 | 原型 | 正向变化小字 |
| `color.moss` | `#6E9079` | `#8AAB94` | 不变 | 原型 | 体重平滑趋势线 |
| `color.target` | `#7A786F` | `#8C8A82` | 不变 | 原型 | 图表目标线 |
| `color.chartGrid` | `#ECEAE2` | `#2A2A27` | 不变 | 原型 | 图表网格线 |
| `color.chartAxis` | `#5F5E57` | `#6A6962` | 不变 | 原型 | 图表坐标轴 |
| `color.toast` | `#26241F` | `#26241F` | 不变 | 原型 | Toast 底 |
| `color.onToast` | `#FAF9F5` | `#FAF9F5` | 不变 | 原型 | Toast 文字 |
| `color.danger` | `#9A463E` | `#E29B90` | 不变 | 原型 | 行内错误文字 |
| `color.dangerFill` | `#9A463E` | `#9A463E` | 不变 | 原型 | 错误 toast、删号按钮底 |
| `color.dangerSoft` | `#F8EEEB` | `#3C2C2A` | 不变 | 原型 | 错误底色 |
| `color.warning` | `#8A5A12` | `#E3B26B` | 不变 | 原型 | 行情状态行、失败行文字 |
| `color.warningSoft` | `#FBF3E4` | `#3A3222` | 不变 | 原型 | 警示底色 |
| `color.overlay` | `rgba(38, 36, 31, 0.42)` | `rgba(0, 0, 0, 0.62)` | 不变 | 原型 | Sheet 遮罩 |
| `color.skeleton` | `#E2DFD5` | `#363632` | 不变 | 原型 | 骨架色块（§17.2） |

`skeleton` 对 `card` 的对比度：浅色 1.33、深色 1.38（§1.1）。

### 18.2 字体、间距、圆角、断点、布局（65 个）

| key | 仓库现值（`2ba3448`） | 定稿值 | 对比仓库 | 依据 | 说明 |
| --- | --- | --- | --- | --- | --- |
| `space.xs` | 4 | 4 | 不变 | 草稿 §3 | |
| `space.sm` | 8 | 8 | 不变 | 原型、§3 | 卡内行间距 |
| `space.ms` | 12 | 12 | 不变 | 原型、§3 | 账本行上下内边距、两列小卡间距 |
| `space.md` | 16 | 16 | 不变 | 原型、§3 | 区块间距、卡内边距、手机页边距 |
| `space.lg` | 24 | 24 | 不变 | 原型、§3 | Sheet 内边距、桌面栏间距 |
| `space.xl` | 32 | 32 | 不变 | 原型、§3 | 只用于平板 / 桌面页边距 |
| `space.xxl` | 48 | 48 | 不变 | 草稿 §3 | 停用，新界面不用 |
| `font.tick` | 10 | 10 | 不变 | 原型、§2.2 | 图表刻度 |
| `font.caption` | 12 | 12 | 不变 | 原型、§2.2 | |
| `font.sm` | 13 | 13 | 不变 | 原型、§2.2 | `label`、`muted` |
| `font.tab` | 14 | 14 | 不变 | 原型、§2.2 | 导航文字 |
| `font.md` | 15 | 15 | 不变 | 原型、§2.2 | `body` |
| `font.lg` | 16 | 16 | 不变 | 原型、§2.2 | `heading` |
| `font.metric` | 20 | 20 | 不变 | 原型、§2.2 | 两列小卡金额 |
| `font.xl` | 28 | 28 | 不变 | 原型、§2.2 | `title`，三档都是 28 |
| `font.display` | 32 | 32 | 不变 | 原型、§2.2 | 大数字 |
| `lineHeight.tick` | 12 | 12 | 不变 | §2.2 | |
| `lineHeight.caption` | 16 | 16 | 不变 | 原型、§2.2 | |
| `lineHeight.sm` | 18 | 18 | 不变 | 原型、§2.2 | |
| `lineHeight.tab` | 20 | 20 | 不变 | 原型、§2.2 | |
| `lineHeight.md` | 22 | 22 | 不变 | 原型、§2.2 | |
| `lineHeight.lg` | 22 | 22 | 不变 | 原型、§2.2 | |
| `lineHeight.metric` | 26 | 26 | 不变 | 原型、§2.2 | |
| `lineHeight.xl` | 34 | 34 | 不变 | 原型、§2.2 | |
| `lineHeight.display` | 38 | 38 | 不变 | 原型、§2.2 | |
| `fontWeight.regular` | '400' | '400' | 不变 | 原型、§2.2 | |
| `fontWeight.medium` | '500' | '500' | 不变 | 原型、§2.2 | |
| `fontWeight.semibold` | '600' | '600' | 不变 | 原型、§2.2 | |
| `fontScale.body` | 1.3 | 1.3 | 不变 | §2.3 | 正文类放大上限 |
| `fontScale.heading` | 1.2 | 1.2 | 不变 | §2.3 | 标题、大数字、`metric`、导航 |
| `fontFamily.sans` | 见右 | `ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", "Noto Sans SC", "Microsoft YaHei", sans-serif` | 不变 | 原型、§2.1 | 不含 Inter；原生不设 `fontFamily`，用系统字体 |
| `fontFamily.serif` | `"Songti SC", "Noto Serif CJK SC", serif` | 现阶段同左；网页子集提交合入后改为 `"Viastela Serif", "Songti SC", "Noto Serif CJK SC", serif` | 不变（子集提交时改值） | 原型、§2.1 | 只给页面标题和日期标题，只在网页生效。子集按 §2.1：46 个字形、≤200KB、超了就撤掉子集提交、继续用系统衬线栈。原生 v1 标题一律用系统无衬线（§2.1），v1.1 见 §2.4 |
| `fontFamily.mono` | `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace` | 同左 | 不变 | 原型（图表刻度用 `ui-monospace, SFMono-Regular, Menlo, monospace`，是现值的子集） | 图表刻度 |
| `radius.sm` | 8 | 8 | 不变 | 原型、§3 | 小控件、输入框、Chip、mini 按钮 |
| `radius.md` | 10 | 10 | 不变 | 原型、§3 | 卡片、Sheet、Callout、主 / 次按钮 |
| `radius.lg` | 10 | 10 | 不变 | §13 | 停用，调用点迁到 `md` 后删除 |
| `radius.bar` | 2 | 2 | 不变 | 原型、§3 | 进度条、骨架文字行 |
| `radius.pill` | 999 | 999 | 不变 | 原型、§3 | 只给 toast |
| `border.width` | 1 | 1 | 不变 | 原型 | |
| `border.indicator` | 2 | 2 | 不变 | 原型、§4.1 | 导航选中细线 |
| `breakpoint.tablet` | 600 | 600 | 不变 | 原型、§4.1 | ≥600 为 `medium` |
| `breakpoint.desktop` | 1024 | 1024 | 不变 | 原型、§4.1 | ≥1024 为 `expanded` |
| `layout.sidebar` | 228 | 228 | 不变 | 原型、§4.1 | `expanded` 侧栏 |
| `layout.sidebarCompact` | 184 | 184 | 不变 | 原型、§4.1 | `medium` 侧栏 |
| `layout.content` | 680 | 680 | 不变 | 原型、§4.1 | `medium` 最宽，居中；「我的」页 |
| `layout.contentWide` | 1080 | 1080 | 不变 | 原型、§4.1 | `expanded` 最宽，在侧栏右侧区域里居中 |
| `layout.auth` | 360 | 同左 | 不变 | 原型和草稿都没覆盖 | 登录页栏宽。沿用仓库现值，见下方待定 |
| `layout.authFull` | 480 | 同左 | 不变 | 原型和草稿都没覆盖 | 这个宽度以内登录栏满宽。沿用仓库现值，见下方待定 |
| `layout.tabBar` | 56 | 56 | 不变 | 原型、§3 | 不含安全区 |
| `layout.control` | 44 | 44 | 不变 | 原型、§3 | 最小点击区、主按钮高 |
| `layout.controlMini` | 28 | 28 | 不变 | 原型、§3 | 行内「记录」视觉高 |
| `layout.row` | 48 | 48 | 不变 | 原型、§3 | 账本行 `minHeight` |
| `layout.chart` | 176 | 176 | 不变 | 原型、§4.3.1 | 平板图高 |
| `layout.chartPhone` | 120 | 120 | 不变 | 原型、§4.3.1 | 手机图高 |
| `layout.chartShort` | 96 | 96 | 不变 | §4.3.1 | 手机且屏高 < 760（原型没有这一档） |
| `layout.chartWide` | 220 | 220 | 不变 | 原型、§4.3.1 | 桌面今日页图高 |
| `layout.chartTrend` | 240 | 240 | 不变 | 原型、§4.3.3 | 桌面趋势 / 体重页大图 |
| `layout.axisGutter` | 32 | 32 | 不变 | 原型、§6 | y 刻度槽宽 |
| `layout.dot` | 5 | 5 | 不变 | 原型、§6 | 数据点直径 |
| `layout.dotLast` | 8 | 8 | 不变 | 原型、§6 | 最新一点直径 |
| `layout.stroke` | 1.5 | 1.5 | 不变 | 原型、§6 | 数据线宽 |
| `layout.progress` | 4 | 4 | 不变 | 原型、§5 | 进度条高 |
| `layout.mark` | 22 | 22 | 不变 | 原型、§4.1 | V 字标尺寸 |
| `layout.maskWidth` | 64 | 64 | 不变 | 原型、§5 | 隐藏金额宽度 |
| `layout.timeColumn` | 44 | 44 | 不变 | §5 | TimelineItem 时间栏（原型未画） |

字体规则补充（不是 token，照 §2.1 写进 `Text`）：
- 网页标题用衬线。子集字体是 PR2 里单独的一个提交，46 个字形，字表只在 `src/ui/serif-glyphs.ts` 一处，`dist` 里 ≤200KB；超了就撤掉这个提交，继续用系统衬线栈。`variant="title"` 只要有一个字不在字表里，整段改用无衬线。
- 原生 v1 标题一律用系统无衬线，`fontFamily` 不设。
- 数字一律 `tabular-nums lining-nums`。

### 18.3 待定（原型或本文里没有定值，不编）

1. **`layout.auth` 360、`layout.authFull` 480：** 原型没画登录页，本文也没写。先沿用仓库现值，登录页改版时再定。
2. **原型里出现、但没有 token 的数：**
   - 今日标题后的「周三」17/500，侧栏「星途」17。字号阶梯里没有 17。
   - Sheet 最宽 420。
   - 推算图高 200（手机、平板）/ 260（桌面）。
   - 间距 2、6、10、14、20（字段间距、表头下边距、mini 按钮左右内边距、Chip 左右内边距、toast 左右内边距）。
   - spinner 16，加载按钮的转圈。
   
   这些先不进 token，视觉 PR 里用到时由 Leo 列出来，我逐个定：进 token，还是取最近的已有 token。
3. **失败行「重试」的颜色：** 原型画的是 `ink` 加下划线。以本文为准，用 `accentText`（§17.4）。
