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
- `Button` — `primary` (clay, dark label), `secondary` (hairline), `ghost` (`accentText`), `danger` (`dangerFill` with light `onToast` text). `ghost` with `tone="danger"` is only an entry point to a dangerous action, for example 删除账号. The button that actually executes deletion uses `variant="danger"`. Solid `danger` is reserved for irreversible actions that have their own confirmation page, for example deleting an account. Deleting a list item uses a ghost text button, `删除`, in the card’s top-right, with a hit area of at least 44pt. The tap hides that row immediately and shows the toast `已删除 · 撤销` for 5 seconds. Further deletes in that window join the same toast, `已删除 N 条 · 撤销`, and restart the 5 seconds for every row still pending. 撤销 restores all of them and writes nothing. An error toast appears immediately, stacked above the undo toast, and both stay visible. A normal toast waits in a queue behind the undo toast and is not replaced. After the undo toast leaves, those queued toasts show in the order they were raised. A save confirmation does not cover the undo toast while a delete is pending. When the window ends with no undo, the app soft-deletes each pending row through the existing path. There is no confirm dialog. The pending delete is kept in memory only. If the app goes to the background, is closed, or the page reloads during those 5 seconds, every pending delete is dropped and the records are still there the next time the list opens.
- `Chip` — single-select, 44pt, selected fill `accentSoft` and label `accentText`.
- `ChipGroup` — a wrapping row of `Chip`s. One group is one choice: exercise, load kind, or band level.
- `StatusCard` — a tappable card. Its accessible name is the summary, for example `深蹲 4 组 · 卧推 3 组`. Tap opens the per-set list.
- `SetRow` — one set. The title is the exercise, the detail is reps and load, and `删除` sits in the top-right when the row can be removed.
- `Sheet` — centered on web, bottom sheet on native. One heading, an explicit close, an explicit save.
- `EmptyState` — title, description, and one button. No second button repeating the same action. 今日 shows it only after `ready`. While the list is loading, the page shows `读取中` and nothing else.
- `Callout` — a card for a load error plus retry. `tone="danger"` is the `dangerSoft` wash with danger text and role alert, for a failed action such as a provider sign-in that did not finish.
- `LineChart` — domain-free. The feature passes positions from 0 to 1.
- `ShellFrame`, `SidebarFrame`, `TabBar`, `NavItem`, `RecordButton` — app chrome.

## Weight

The headline number is the **7 日均重**, from `sevenDayAverageView`. It is the mean of each day’s earliest row inside seven local days, and only once at least 4 of those days have a row. Below that, the headline is `数据不足` and the line is `近 7 天有 N 天记录，满 4 天后显示均重`. Days with no row are left out of both the sum and the count. The figure uses the display style and the clay `accent` color.

The dashed moss line on the trend chart is **平滑趋势**. Its values come only from core `weightTrendEma` (default alpha 0.1). Screens do not smooth. The chart asks for 28 local days through `weightListWindow`. The legend says `最早体重` and `平滑趋势`. The caption states that the line is smoothing, not another average. Do not show a second “average” or a weekly rate next to the 7-day figure.

The first row of a local day is `晨重`. A later row that same day is `复测`, not `备注`.

Between midnight and the day switch (default 04:00), 今日 titles the accounting day, for example `10月23日 周五`, and adds the note `凌晨 4 点前的记录算作前一天`. After the switch, the title is that same accounting day and the note is hidden.

`再记 73.7 kg` opens the record sheet with that value filled in, the weight field focused, and a decimal keypad. `填入上次` stays hidden while the sheet is already filled. Nothing is written until the person presses 保存. `+ 记录` opens the same sheet empty; `填入上次` is shown then, when a previous weight exists.

## Training

今日 shows one `StatusCard` for the accounting day. Before the day switch the heading is the accounting day, for example `10月26日的训练`, the same day weight uses. A record at 01:30 still belongs to the previous day when the switch is 04:00. After the switch the heading is `今天的训练`. With no sets, the section is a `记一笔` button that opens the record sheet on 训练.

The set sheet stays open after `保存这一组` and lists today's sets for that exercise. `+1 组` copies the last of those sets into the form and writes nothing until `保存这一组`. Each save uses its own client id. `完成` closes the sheet and toasts `已记入 10月27日 · 深蹲 4 组`.

The exercise field is chips of the six most recent exercises, newest first, then `+ 其他` for a free-text name. Those chips come from a read of past sets, not from today's list. Field order is exercise, kilograms or band, then reps. Stored band levels are `light`, `medium`, `heavy`, and `extra_heavy`, labeled 轻, 中, 重, 加重. They are not converted to kilograms. A kilogram load uses `formatKg` and drops a trailing `.0`, so 40 reads `40 kg`.

Deleting a set happens on the per-set list opened from the status card, with the same 5 second undo as weight.
