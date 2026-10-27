# Design system

Inspired by Claude.ai’s warm editorial minimalism. **Inspired by, not affiliated with Anthropic.** No Anthropic logos, wordmarks, or proprietary font files.

This note is the contract for new modules (fitness, learning, finance, and the rest). Screens compose `src/ui` only. Colors and sizes come from tokens.

Sources:

- Yifeng’s spec: [g-lab DESIGN.md](https://github.com/gyfking199705/g-lab/blob/main/DESIGN.md) and `projects/planner/core/ui.jsx`
- Public paper / ink / clay references: [brand guidelines](https://github.com/anthropics/skills/blob/main/skills/brand-guidelines/SKILL.md) (`#faf9f5`, `#141413`, `#d97757`)
- The chart’s dashed line follows [g-lab `cut/calc.js`](https://github.com/gyfking199705/g-lab/blob/main/projects/planner/cut/calc.js) (exponential smoothing, alpha 0.1). It is not a second average.

`userInterfaceStyle` is `automatic`. The app follows the system scheme. `src/ui/theme.ts` stays free of React Native because `app.config.js` imports it; `ThemeProvider` swaps `lightColor` and `darkColor`.

## Color

Body text meets WCAG AA (4.5:1). The clay fill `#CC785C` is for buttons, chart dots, and the large display figure only. On a white card it is about 3.3:1, which passes for large text (the 40px figure) and for non-text marks. It does not pass for small text, so small accent copy uses `accentText`.

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `paper` | `#F6F5F0` | `#141413` | Page |
| `paperDeep` | `#F1EFE8` | `#1C1C1A` | Sidebar |
| `card` | `#FFFFFF` | `#30302E` | Cards, sheets, tab bar |
| `surface` | `#FBFAF6` | `#262624` | Fields |
| `fill` | `#F1EFE8` | `#3A3935` | Secondary hover |
| `ink` | `#26241F` | `#FAF9F5` | Primary text |
| `muted` | `#5F5E57` | `#B0AEA5` | Labels, captions |
| `textFaint` | `#6A6962` | `#9C9A90` | Placeholders. Darker than a decorative gray so it still clears 4.5:1 |
| `line` | `#ECEAE2` | `#45443F` | 1px hairline |
| `accent` | `#CC785C` | `#CC785C` | Primary fill, focus ring, chart dots, display figure |
| `accentHover` | `#D08A70` | `#D08A70` | Primary hover. Lighter, because the label is dark ink |
| `accentText` | `#944A34` | `#E7A08A` | Small accent text: tabs, chips, ghost buttons |
| `accentSoft` | `#F5ECE5` | `#4A3830` | Selected nav, selected chip |
| `accentInk` | `#26241F` | `#141413` | Label on the clay fill |
| `toast` / `onToast` | `#26241F` / `#FAF9F5` | same | Toast chip. Not `ink`, or dark mode would put cream on cream |
| `moss` | `#6E9079` | `#8AAB94` | Smoothed trend line |
| `danger` | `#9A463E` | `#E29B90` | Inline error text |
| `dangerFill` | `#9A463E` | `#9A463E` | Error toast, with `onToast` |
| `dangerSoft` | `#F8EEEB` | `#3C2C2A` | Error wash |
| `overlay` | `rgba(38, 36, 31, 0.42)` | `rgba(0, 0, 0, 0.62)` | Sheet backdrop |

## Typography

| Role | Size | Face | Weight |
| --- | --- | --- | --- |
| display | 40 | serif on web | 500 |
| title | 26 | serif on web | 500 |
| heading | 18 | serif on web | 500 |
| body | 15 | system sans | 400 |
| muted | 13 | system sans | 400 |

Web serif stack: `Georgia, "Songti SC", "Noto Serif SC", serif`. Body: system sans, including PingFang SC and Noto Sans SC. Numbers use tabular figures. Do not ship a proprietary font file.

`Text` tones: `ink`, `muted`, `accent` (resolves to `accentText`, or `accent` when the variant is display), `onAccent`, `inverse` (toast text), `danger`, `moss`.

## Spacing, radius, targets

Space: 4, 8, 16, 24, 32, 48. Page columns max out at 680. Wide web (sidebar) starts at 960.

Controls, chips, nav items, fields, and toasts are at least 44pt tall. The tab bar is 88, including the floating record button.

Radius: 8 for controls, 14 for cards and sheets, pill for chips and toasts. Cards are a 1px hairline and no shadow. The primary button may carry a 1px clay shadow.

## Components

Screens use these primitives. Do not add a `StyleSheet` or a raw color in a screen.

- `Screen`, `Content`, `Stack`, `Row`, `Center` — page frame and gaps. Pass a space token, not a number.
- `ScreenHeader` — kicker, one title (the accessible heading), optional detail, optional note.
- `Card` — one idea. Lists are a stack of cards, not a dense table.
- `Field` — label, value, optional hint. `TextField` — label, input, error or helper.
- `Button` — `primary` (clay, dark label), `secondary` (hairline), `ghost` (`accentText`), `danger` (`dangerFill` with light `onToast` text). Every irreversible action uses `danger`, including 删除 and, later, deleting an account.
- `Chip` — single-select, 44pt, selected fill `accentSoft` and label `accentText`.
- `Sheet` — centered on web, bottom sheet on native. One heading, an explicit close, an explicit save.
- `EmptyState` — title, description, and one button. No second button repeating the same action. 今日 shows it only after `ready`. While the list is loading, the page shows `读取中` and nothing else.
- `Callout` — a card for a load error plus retry.
- `LineChart` — domain-free. The feature passes positions from 0 to 1.
- `ShellFrame`, `SidebarFrame`, `TabBar`, `NavItem`, `RecordButton` — app chrome.

## Weight

The headline number is the **7 日均重**, from `sevenDayAverageView`. It is the mean of each day’s earliest row inside seven local days, and only once at least 4 of those days have a row. Below that, the headline is `数据不足` and the line is `近 7 天有 N 天记录，满 4 天后显示均重`. Days with no row are left out of both the sum and the count. The figure uses the display style and the clay `accent` color.

The dashed moss line on the trend chart is **平滑趋势**. Its values come only from core `weightTrendEma` (default alpha 0.1). Screens do not smooth. The chart asks for 28 local days through `weightListWindow`. The legend says `最早体重` and `平滑趋势`. The caption states that the line is smoothing, not another average. Do not show a second “average” or a weekly rate next to the 7-day figure.

The first row of a local day is `晨重`. A later row that same day is `复测`, not `备注`.

Between midnight and the day switch (default 04:00), 今日 titles the accounting day, for example `10月23日 周五`, and adds the note `凌晨 4 点前的记录算作前一天`. After the switch, the title is that same accounting day and the note is hidden.

`再记 73.7 kg` opens the record sheet with that value filled in and the type set to 体重. Nothing is written until the person presses 保存. `+ 记录` opens the same sheet empty.
