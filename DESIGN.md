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

## Installed web app

The web export is an installable app. `display` is `standalone` and `start_url` is `/`. The installed name and short name live on `brand.homeScreenName` and `brand.homeScreenShortName`. `theme_color` and `background_color` are the light `paper` token. Icons are exported from `assets/icon.png`: 192, 512, a 512 maskable icon whose mark sits inside the center 80% circle, and a 180 apple touch icon. Startup images are a paper field with that icon centered.

iOS uses `apple-mobile-web-app-capable` and `apple-mobile-web-app-status-bar-style: default`, with `viewport-fit=cover`. Screens pad the top with `safe-area-inset-top`. The tab bar pads its bottom with `safe-area-inset-bottom`, and the shell’s scroll padding grows by the same inset so the home indicator does not cover the bar or the last row. Pages without a tab bar pad the bottom inset too.

The service worker caches only same-origin static files: JavaScript, CSS, images, fonts, and the `index.html` shell. Navigations are network-first and fall back to that shell, so a new deploy replaces the previous bundle. `sw.js` is served with `Cache-Control: no-cache` and registered with `updateViaCache: 'none'`. A worker that replaces one already in control reloads the page once. Supabase hosts, `/auth|rest|functions|storage|realtime/v1` paths, and any request carrying `Authorization` are not intercepted. `/.well-known/*` is not intercepted. Sign-out deletes the runtime Cache Storage.

There is no install banner. 我的 shows one row, hidden when the page is already `display-mode: standalone`. On iPhone and iPad the row says `在 Safari 点分享 → 添加到主屏幕`. Elsewhere it says `在浏览器菜单里选择「添加到主屏幕」`.

## Reminders

我的 has one reminders card and exactly two switches: `训练日提醒` and `月底更新余额提醒`. There is no master switch. The first visit does not call `Notification.requestPermission`. Permission is requested only when a person turns a switch on.

Training defaults to `08:00`. While that switch is on, a multi-select `ChipGroup` lists 周一 through 周日 (ISO weekdays 1 through 7) and a time field. Month-end defaults to `21:30` on the last civil day of the month in the subscription's own timezone. Both times can be changed. Turning training off and on again keeps the chosen weekdays. Turning a switch off keeps the row. A revoked notification permission, or a push service `404` / `410`, soft-deletes that row so nothing further is sent.

One explanation is visible at a time, in this order: no `EXPO_PUBLIC_VAPID_PUBLIC_KEY` shows `推送还没配置，月底提醒会先显示在今日页` and disables both switches (the times can still be edited); iOS that is not installed to the home screen shows `先添加到主屏幕，才能收到提醒` and disables both switches; a denied permission turns the switches off and shows `通知权限已关闭，可以在系统设置里打开`. A browser without Push shows `这个浏览器不支持提醒`.

今日 shows one extra card, and only in the last three civil days of the month, when no live balance was written in that month: `这个月还没更新资产余额`, a ghost `去更新` that opens `/assets?updateBalances=1`, and a ghost `关闭` that hides the card until next month. Training does not add a banner. The service worker opens `/` for a training notification and `/assets?updateBalances=1` for a month-end notification.
