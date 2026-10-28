# Design system

Inspired by Claude.ai’s warm editorial minimalism. **Inspired by, not affiliated with Anthropic.** No Anthropic logos, wordmarks, or proprietary font files.

This note is the contract for new modules (fitness, learning, finance, and the rest). Screens compose `src/ui` only. Colors and sizes come from tokens.

Sources:

- Yifeng’s spec: [g-lab DESIGN.md](https://github.com/gyfking199705/g-lab/blob/main/DESIGN.md) and `projects/planner/core/ui.jsx`
- Public paper / ink / clay references: [brand guidelines](https://github.com/anthropics/skills/blob/main/skills/brand-guidelines/SKILL.md) (`#faf9f5`, `#141413`, `#d97757`)
- The chart’s dashed line follows [g-lab `cut/calc.js`](https://github.com/gyfking199705/g-lab/blob/main/projects/planner/cut/calc.js) (exponential smoothing, alpha 0.1). It is not a second average.

`userInterfaceStyle` is `automatic`. The app follows the system scheme. `src/ui/theme.ts` stays free of React Native because `app.config.js` imports it; `ThemeProvider` swaps `lightColor` and `darkColor`.

## §0 组件

Shared pieces for a later finance screen. Screens still take colors and sizes from tokens.

`warning` is `#8A5A12` in light and `#E3B26B` in dark. `warningSoft` is `#FBF3E4` in light and `#3A3222` in dark. `warning` on `warningSoft` is 5.36:1 in light and 6.54:1 in dark. Light `warning` on a white card is 5.91:1 and on `paper` is 5.42:1. Dark `warning` on `card` is 6.83:1 and on `paper` is 9.52:1. Small warning text clears 4.5:1 on those surfaces.

`Text` accepts the tone `warning`, plus `accessibilityLabel` and `accessibilityState`.

`Field` takes `locked`. A locked value is muted and `accessibilityState` disabled. The hint stays under it.

`Callout` `tone="warning"` uses the `warningSoft` wash, `warning` text, and `role="status"`. It is a status, not an alert. `tone="danger"` is unchanged. The two tones do not share a style named `danger`.

`LineChart` still draws the weight chart from `points`, `rawLabel`, and `trendLabel`. A second prop shape is `series`: each item has `id`, `label`, points already scaled from 0 to 1 (`x` and `y`), `style` (`solid`, `dashed`, or `dotted`), `tone` (`accent`, `moss`, `muted`, or `line`), and optional `markers` and `thin`. The chart does not know the domain. The series legend sits below the plot. A dotted series uses a dotted swatch and a dashed series uses a dashed swatch, so the target line is not told apart by color alone.

`ProgressBar` takes `value` from 0 to 1. The fill is `accent` and the track is `fill`. `masked` draws the track only and the accessible name is `已隐藏金额`.

`MaskedAmount` shows the formatted text, or `••••`. While masked, the real figure is not in the tree. On web the dots are `aria-hidden` and a clipped text node reads `已隐藏金额`. On iOS and Android the amount is one `Text` whose `accessibilityLabel` is `已隐藏金额` and whose only visible characters are the dots. A row that nests an amount puts that same phrase in the outer row's `accessibilityLabel`, because a nested `Text` cannot hide or label itself. Digits use tabular figures. Each variant has one fixed slot width, shared by the masked and unmasked states, so the width does not reveal how many digits the amount has and does not jump when the mask toggles. 等宽数字，遮罩前后宽度不跳.

`TimelineItem` is one row: a 24px `fill` dot, a title, an optional detail (a string or any node, including a masked amount), and a muted `HH:mm` clock in tabular figures.

`Callout` warning and danger share a neutrally named layout style. The warning wash is `warningSoft`, not the danger style, so a later change to the danger treatment does not recolor the warning.

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
- `ChipGroup` — a wrapping row of `Chip`s. One group is one choice: exercise, load kind, band level, study topic, or duration.
- `StatusCard` — a summary card at least 96 tall. Its accessible name is the summary, for example `深蹲 4 组 · 卧推 3 组`. A collapsed training card hints `查看每组`; tapping again collapses the list. An empty card says `未记录` and offers `记一笔`.
- `CardRow` — status cards in a column below 960, and in a row from 960 up.
- `SetRow` — one set. The title is the exercise, the detail is reps and load, and `删除` sits in the top-right when the row can be removed.
- `Sheet` — centered on web, bottom sheet on native. One heading, an explicit close, an explicit save.
- `EmptyState` — title, description, and one button. No second button repeating the same action. 今日 shows it only after `ready`. While the list is loading, the page shows `读取中` and nothing else.
- `Callout` — a card for a load error plus retry. `tone="danger"` is the `dangerSoft` wash with danger text and role alert, for a failed action such as a provider sign-in that did not finish.
- `LineChart` — domain-free. The feature passes positions from 0 to 1.
- `ShellFrame`, `SidebarFrame`, `TabBar`, `NavItem`, `RecordButton` — app chrome.

## Account

`/account/delete` checks the session before it shows the confirmation page. The check matches the Edge Function: the newest `amr` timestamp, skipping `token_refresh`. Exactly 10:00 passes. Anything older, and a missing, empty, or invalid `amr`, is stale.

A stale session does not show the confirmation field or the danger button. It shows a normal `Callout` (not `tone="danger"`): `为了确认是你本人，删除账号前请重新登录一次。` Under that card, a primary button `重新登录` and a ghost button `取消`.

`重新登录` follows the newest `amr` method. `otp` and any non-OAuth method ask for the email code. `oauth` returns to Google or GitHub. Native always asks for the email code, including when the session came from OAuth. The current session is not signed out. `取消` leaves the page and the person stays signed in.

After that sign-in, the confirmation page is shown again. Nothing is deleted until the person presses the `variant="danger"` button. A server `403` `{ error: 'reauth_required' }` returns to this same explanation. It does not show `删除失败，请重试`.

## Weight

The headline number is the **7 日均重**, from `sevenDayAverageView`. It is the mean of each day’s earliest row inside seven local days, and only once at least 4 of those days have a row. Below that, the headline is `数据不足` and the line is `近 7 天有 N 天记录，满 4 天后显示均重`. Days with no row are left out of both the sum and the count. The figure uses the display style and the clay `accent` color.

The dashed moss line on the trend chart is **平滑趋势**. Its values come only from core `weightTrendEma` (default alpha 0.1). Screens do not smooth. The chart asks for 28 local days through `weightListWindow`. The legend says `最早体重` and `平滑趋势`. The caption states that the line is smoothing, not another average. Do not show a second “average” or a weekly rate next to the 7-day figure.

The first row of a local day is `晨重`. A later row that same day is `复测`, not `备注`.

Between midnight and the day switch (default 04:00), 今日 titles the accounting day, for example `10月23日 周五`, and adds the note `凌晨 4 点前的记录算作前一天`. After the switch, the title is that same accounting day and the note is hidden.

`再记 73.7 kg` opens the record sheet with that value filled in, the weight field focused, and a decimal keypad. `填入上次` stays hidden while the sheet is already filled. Nothing is written until the person presses 保存. `+ 记录` opens the same sheet empty; `填入上次` is shown then, when a previous weight exists.

## Training

今日 shows one `StatusCard` for the accounting day. Before the day switch the heading is the accounting day, for example `10月26日的训练`, the same day weight uses. A record at 01:30 still belongs to the previous day when the switch is 04:00. After the switch the heading is `今天的训练`. With no sets, the section is a `记一笔` button that opens the record sheet on 训练.

The set sheet stays open after `保存这一组` and lists today's sets for that exercise. `+1 组` copies the last of those sets into the form and writes nothing until `保存这一组`. Each save uses its own client id. `完成` is a ghost button. It closes the sheet and toasts `已记入 10月27日 · 深蹲 4 组` when the form is empty, only an exercise is selected, or `+1 组` prefilled the fields and nothing changed. Any other field change asks first: `保存这一组并完成` writes the set and closes, and `不保存，直接完成` closes without a write.

The exercise field is chips of the six most recent exercises, newest first, then `+ 其他` for a free-text name. Those chips come from a read of past sets, not from today's list. With no history, the chips are 哑铃卧推, 单臂划船, 肩推, 深蹲, 弹力带面拉, and 俯卧撑. Field order is exercise, kilograms or band, then reps. Stored band levels are `light`, `medium`, `heavy`, and `extra_heavy`, labeled 轻, 中, 重, 加重. They are not converted to kilograms. A kilogram load uses `formatKg` and drops a trailing `.0`, so 40 reads `40 kg`.

Deleting a set happens on the per-set list opened from the status card, with the same 5 second undo as weight.

## Study

今日 shows one `StatusCard` for the accounting day, titled the same way as training. With no session, the card says `未记录` and `记一笔` opens the sheet on 学习. A saved day summarises minutes by topic, for example `AI Infra 30 分钟`. The hint is `查看记录`, and tapping again collapses the list.

The study sheet is one screen: a topic (recent chips, or a typed name), a duration of 15, 30, 45, 60, or 自定义, and an optional 收获. 30 starts selected. Duration must be a whole number from 1 to 1440. 保存 closes the sheet and toasts `已记入 10月27日 · AI Infra 30 分钟`.

When weight, training, and study all have a row for the accounting day, the header note says `今天都记完了`.

## Assets

`/assets` is the asset dashboard. While the first read is in flight and nothing is ready, the page shows only `读取中`. A failed first read is `读取失败，请重试`. With no live account the empty state is `还没有账户` and `添加第一个账户`.

The headline is the server `total_usd`. Offline, that figure is the last cached quotes response. The client does not show a second total of its own. Money is `US$`, `S$`, `HK$`, or `¥`, with thousands separators and two decimals. A negative amount stays ink, not danger. Share counts keep up to six decimals and drop trailing zeros.

With no goal row, the card does not invent one. Under the total, one muted line says `还没设目标`, and a ghost button `设一个目标` opens the goal sheet. There is no progress bar and no `目标进度`. The projection still draws the three rate lines, leaves out the target line and its legend, and the conclusion is exactly `设一个目标后，这里会显示预计哪个月达成`. The dollar gap, month count, and reach date stay hidden.

### Hide amounts

Hiding amounts is on by default and stored on this device per user (`viastela.amount-mask.v1.${userId}`). Missing storage, or any value other than `0`, stays hidden. The eye button is `显示金额` or `隐藏金额`. Masking covers the total, the goal percent, the progress bar, profit and loss, share counts, and the projection chart. Cash and stock percents stay visible. Sheets show the real numbers. A hidden chart is a gray `fill` placeholder; tapping it turns masking off. It does not open the assumptions sheet. `调整假设` does.

### Projection

The card draws three return lines from `return_rates`, default `[0.03, 0.05, 0.07]`. `main_rate_index` is 1-based. The default index is 1, so the main line is 3%. Chips switch the main line among 3%, 5%, and 7%. All three lines share one `LineChart`. The actual series is an accent solid line with dots, and only when there are at least two snapshot points. The selected line is moss and dashed. The other two are muted, dashed, and thinner. The target is a dotted line. The accessible name is `实际、3%、5%、7%、目标，预计达标月份`, using the rates that are actually drawn.

The date passed into the gap is clamped to the line first, so a day outside the projection does not throw and blank the board. When monthly net is 0 or negative, the sentence has the dollar gap and no “ahead or behind N months”. When the selected line never reaches the goal, the copy is the template `按 {当前选中的年化}% 年化，50 年内达不到目标`. The percent is the selected line, never a hardcoded 3%, and the sentence is never `600 个月内达不到`. At 5% that sentence is `按 5% 年化，50 年内达不到目标`.

`snapshot: 'skipped'` with fewer than two actual points says `接入真实行情后开始记录实际走势`. Two or more actual points add no extra note, even if today was skipped. Fewer than two points after a snapshot was written says `下个月开始显示实际走势`.

### Accounts and holdings

A symbol matches `^[A-Z][A-Z.]{0,9}$`. Anything else says `代码只能是大写字母和点，例如 AAPL、BRK.B`. Editing a holding locks the symbol and the account in gray fields, with the hint `要换代码，请删除后重新添加`. The cost field is `总成本（US$）`, the total cost of every share, with helper `这笔持仓全部股数的总成本`. Editing the share count also says `股数变了，请同时核对总成本`, because the server does not rescale that total. The balance helper is `负债填负数`. Saving a holding sends quantity and cost only.

`全部更新余额` writes only accounts whose amount changed, then toasts `已更新 N 个账户`. `更新余额` on one account opens that account’s sheet directly. A USD balance always stores `usd_rate = 1`, so a later timeline `after_usd` is not null. `usd_rate` is USD per 1 unit of the account currency, and the timeline uses `after_usd = amount * usd_rate`. Quotes still arrive as units of currency per 1 USD, so a non-USD row stores `1 / rate` (1.25 SGD per USD becomes 0.8). A missing, zero, or negative quote stays null.

An account that still has a live holding cannot be deleted. The hint is `先移除这个账户里的持仓`. An account with only balances can be deleted, with the same 5 second undo. The toast is `已删除 {账户名}，它的余额不再计入总资产`. A holding delete uses the same 5 second undo. Undo writes nothing. When the window ends, the soft delete runs once. If the parent account was already deleted, the sheet closes, the list refreshes, and the notice is `这个账户已经删除了`. `immutable column` says `代码和账户不能修改，请删除后重新添加`. A duplicate symbol says `这个账户里已经有 {symbol} 了`. `record deleted` keeps `这条记录已在其他设备删除`. Anything else is `保存失败，请重试`.

Recent activity is up to three `TimelineItem`s on this card. The full timeline page is a later task.

### Quotes

The client calls the quotes function and stores the last successful book on this device, keyed by `user_id`. Prices are USD. Fresh versus stale is decided on the server. The client does not recompute the 15 minute window, and it does not invent a cost-basis price for an `unavailable` row.

`status: 'unavailable'` is always `暂无价格` and stays out of the total, even when the holding has `cost_basis_usd`. A row whose `source` is `cost_basis` and that still has a price says `按成本价估算`, including when the server called it fresh. It never says `价格更新于 HH:mm`. A fresh Finnhub price says `价格更新于 HH:mm` in the user’s time zone. A stale Finnhub price, or a cached Finnhub price kept after a failed fetch, says `价格可能过期`.

When the quotes source fails with no server cache, the function returns 502 `{ error: 'quote_unavailable' }`. When FX is missing, it returns 502 `{ error: 'fx_unavailable' }`. On those responses and on a network error, the board keeps the last local book, marks those Finnhub rows possibly expired, and does not overwrite or clear the cache. With no cache, the board uses the empty and unavailable states above. A top-level `unpriced` count says `有 N 个持仓没有价格，未计入总资产`.

A book whose `source` is `cost_basis` adds the callout `还没接入真实行情，股票按成本价估算`. A failed fetch that fell back to the device cache adds `离线中，显示的是上次取到的价格`. Both use `Callout` `tone="warning"`.

Sign-out and local sign-out (including account deletion) clear that user’s quote cache in a `finally`, so the cache is cleared even when `auth.signOut()` throws. Another user’s cache stays.

## Installed web app

The web export is an installable app. `display` is `standalone` and `start_url` is `/`. The installed name and short name live on `brand.homeScreenName` and `brand.homeScreenShortName`. `theme_color` and `background_color` are the light `paper` token. Icons are exported from `assets/icon.png`: 192, 512, a 512 maskable icon whose mark sits inside the center 80% circle, and a 180 apple touch icon. Startup images are a paper field with that icon centered.

iOS uses `apple-mobile-web-app-capable` and `apple-mobile-web-app-status-bar-style: default`, with `viewport-fit=cover`. Screens pad the top with `safe-area-inset-top`. The tab bar pads its bottom with `safe-area-inset-bottom`, and the shell’s scroll padding grows by the same inset so the home indicator does not cover the bar or the last row. Pages without a tab bar pad the bottom inset too.

The service worker caches only same-origin static files: JavaScript, CSS, images, fonts, and the `index.html` shell. Navigations are network-first and fall back to that shell, so a new deploy replaces the previous bundle. `sw.js` is served with `Cache-Control: no-cache` and registered with `updateViaCache: 'none'`. A worker that replaces one already in control reloads the page once. Supabase hosts, `/auth|rest|functions|storage|realtime/v1` paths, and any request carrying `Authorization` are not intercepted. `/.well-known/*` is not intercepted. Sign-out deletes the runtime Cache Storage.

There is no install banner. 我的 shows one row, hidden when the page is already `display-mode: standalone`. On iPhone and iPad the row says `在 Safari 点分享 → 添加到主屏幕`. Elsewhere it says `在浏览器菜单里选择「添加到主屏幕」`. Notifications are not part of this install path.
