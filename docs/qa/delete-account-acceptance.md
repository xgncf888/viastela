# 删号验收用例

- 负责人：Chloe · 账号平台测试
- 基线：main `be7fd04`
- 范围：网页、安卓 APK 和 iOS（免费 Apple ID 装到真机）三端的删除账号流程，以及托管环境上的 `delete-account` 函数
- 已有自动化：`src/core/delete-account*.test.ts`、`src/core/account-policy.test.ts`、`e2e/account.spec.ts`。下面标「手测」的，是自动化覆盖不到、要在真机或托管环境上走一遍的
- 测试账号只用一次性的邮箱，不用 Yifeng 本人的账号，也不写真实资产数字

## 1. 进入删号页

| 编号 | 前置条件 | 步骤 | 预期 |
| --- | --- | --- | --- |
| D-01 | 10 分钟内刚登录 | 我的 → 删除账号 | 直接进入确认页，不弹重新登录 |
| D-02 | 最近一次登录超过 10 分钟 | 我的 → 删除账号 | 先显示 Callout「为了确认是你本人，删除账号前请重新登录一次。」，Callout 不用 danger 样式，下面是「重新登录」和「取消」两个按钮 |
| D-03 | D-02 的状态，邮箱验证码账号 | 点「重新登录」→ 输入 6 位验证码 →「验证并进入」 | 进入确认页 |
| D-04 | D-02 的状态，Google 或 GitHub 账号（网页） | 点「重新登录」，完成第三方登录 | 回到删号确认页，而不是首页 |
| D-05 | D-02 的状态 | 点「取消」 | 回到我的，账号仍是登录状态，数据都在 |
| D-06 | 验证码页 | 输错验证码 | 显示「验证码不正确或已过期」，停在验证码页 |

## 2. 确认和删除

| 编号 | 步骤 | 预期 |
| --- | --- | --- |
| D-10 | 确认框为空，或输入的不是「删除」（比如多一个空格、输成英文 delete） | 「删除账号」按钮保持禁用 |
| D-11 | 输入「删除」 | 按钮变成可点，样式是 danger |
| D-12 | 点「删除账号」 | 显示「正在删除」；完成后跳到 `/account/deleted`，本机会话被清掉 |
| D-13 | 删除中按返回键或侧滑（安卓、iOS） | 不能退回确认页，也不会重复提交 |
| D-14 | 删完以后打开应用或刷新网页 | 停在登录页，不会自动登回去 |
| D-15 | 用同一个邮箱重新登录（验证码） | 生成一个新用户（新的 `user_id`），里面没有任何旧数据 |
| D-16 | 断网后点「删除账号」 | 显示「删除失败，请重试」，停在确认页；恢复网络后重试能删掉 |
| D-17 | 停在确认页超过 10 分钟后点删除（服务端返回 `reauth_required`） | 回到重新登录那一步，不显示「删除失败」 |

## 3. 数据清理（手测，托管环境，由 Grok Ultra 用官方连接器只读查询）

删除前，给测试账号每张表都写一条数据。删除后，按旧的 `user_id` 查这些表，每张都要是 0 行：

`profiles`、`weight_records`、`training_sets`、`study_records`、`journal_entries`、`push_subscriptions`、`reminder_deliveries`（通过 `push_subscriptions` 级联）、`asset_accounts`、`account_balances`、`holdings`、`net_worth_goals`、`projection_assumptions`、`net_worth_snapshots`、`asset_events`，以及 `auth.users` 和 `auth.identities`。

`quote_cache` 和 `fx_rates` 是全局缓存，不按用户删，删号后保持原样就对了。

- D-20：上面这些表全部是 0 行
- D-21：另一个测试账号的数据一行都没少（防止误删别人的数据）
- D-22：被删账号的推送订阅不再收到提醒（等 #20 合并后补测）

## 4. 函数接口（托管环境，`verify_jwt=true`）

| 编号 | 请求 | 预期 |
| --- | --- | --- |
| D-30 | OPTIONS，Origin 是 `https://viastela.vercel.app` | 204，返回的 ACAO 就是这个 Origin，并带 `Vary: Origin` |
| D-31 | OPTIONS，Origin 是 `https://viastela-git-<分支>-xgncf888.vercel.app` | 204，ACAO 就是这个 Origin |
| D-32 | OPTIONS，Origin 是 `null`、`https://evil.example`、`https://viastela.vercel.app.evil.example`、`http://viastela.vercel.app`、`https://viastela.vercel.app:8443` | 403，没有 ACAO |
| D-33 | POST 不带 Authorization | 网关返回 401 |
| D-34 | POST 带一个过期或伪造的 JWT | 401 |
| D-35 | POST 带有效 JWT，但最近一次登录超过 10 分钟 | 403 `reauth_required`，账号还在 |
| D-36 | GET 或 PUT，带有效 JWT | 405 `method_not_allowed` |
| D-37 | POST，请求体或查询参数里写别人的 user_id | 删掉的只是 JWT 对应的那个用户，请求体和参数被忽略 |
| D-38 | 原生 App 发的 POST（不带 Origin），最近 10 分钟内登录过 | 200 `{ ok: true }` |

## 5. 隐私页和上架要求

- D-40：在应用里能找到删号入口，入口在我的页面，不超过两步（App Store 审核指南 5.1.1(v) 和 Google Play 的账号删除政策都要求）
- D-41：隐私页写清楚删号会删掉哪些数据，和第 3 节的表一致
- D-42：Google Play 上架时还要一个不用装 App 也能打开的网页删号入口：网页版的 `/account/delete` 要能在登录后直接打开

## 不在本文范围

- 删号后的数据保留期、备份清理（还没定，归 Ethan 和 Mason）
- Sign in with Apple 的 token 撤销（iOS 上线前补，见 `tasks/native-oauth.md`）
